const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/db');

class ChallengeBattleService {
  constructor() {
    this.rooms = new Map();
    this.matchmakingQueue = [];
    this.POEMS_CACHE = null;
    this.cacheLoadTime = 0;
    this.CACHE_TTL = 5 * 60 * 1000;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  async loadPoemsCache() {
    const now = Date.now();
    if (this.POEMS_CACHE && (now - this.cacheLoadTime) < this.CACHE_TTL) {
      return this.POEMS_CACHE;
    }

    return new Promise((resolve) => {
      db.all(`SELECT id, title, author, content FROM poems`, [], (err, poems) => {
        if (err || !poems || poems.length === 0) {
          this.POEMS_CACHE = [];
          this.cacheLoadTime = now;
          resolve([]);
          return;
        }

        const processedPoems = poems.map(poem => {
          const content = (poem.content || '').replace(/[，、；：""''（）【】《》]/g, '，').replace(/[。！？…；]/g, '。');
          const lines = content.split('。').filter(l => l.trim().length >= 4);
          
          const couplets = [];
          for (const line of lines) {
            const parts = line.split('，').filter(p => p.trim().length >= 2);
            for (let i = 0; i < parts.length - 1; i++) {
              const left = parts[i].trim();
              const right = parts[i + 1].trim();
              if (left.length >= 2 && right.length >= 2) {
                const isTop = Math.random() > 0.5;
                couplets.push({
                  question: isTop ? `${left}，____。` : `____，${right}。`,
                  answer: isTop ? right : left,
                  type: isTop ? '上句填下句' : '下句填上句'
                });
              }
            }
          }

          return {
            ...poem,
            content,
            couplets,
            difficulty: this.estimateDifficulty(poem)
          };
        }).filter(p => p.couplets.length > 0);

        this.POEMS_CACHE = processedPoems;
        this.cacheLoadTime = now;
        resolve(processedPoems);
      });
    });
  }

  estimateDifficulty(poem) {
    const title = poem.title || '';
    const author = poem.author || '';
    const content = poem.content || '';

    const easyPoems = [
      '静夜思', '春晓', '登鹳雀楼', '江雪', '相思', '悯农', '咏柳', '绝句',
      '望庐山瀑布', '赠汪伦', '早发白帝城', '望天门山', '夜宿山寺', '枫桥夜泊',
      '出塞', '芙蓉楼送辛渐', '从军行', '凉州词', '望洞庭', '浪淘沙', '乌衣巷',
      '竹枝词', '秋夕', '泊秦淮', '赤壁', '夜雨寄北', '无题', '游山西村',
      '示儿', '过零丁洋', '晓出净慈寺送林子方', '小池', '春日', '观书有感',
      '游园不值', '村居', '所见', '敕勒歌', '山行', '清明', '江南春'
    ];

    const mediumPoems = [
      '水调歌头', '念奴娇', '江城子', '定风波', '西江月', '清平乐', '菩萨蛮',
      '青玉案', '如梦令', '醉花阴', '声声慢', '渔歌子', '题西林壁', '饮湖上初晴后雨',
      '惠崇春江晚景', '泊船瓜洲', '书湖阴先生壁', '冬夜读书示子聿', '剑门道中遇微雨',
      '秋夜将晓出篱门迎凉有感', '使至塞上', '山居秋暝', '鸟鸣涧', '竹里馆', '鹿柴'
    ];

    for (const name of easyPoems) {
      if (title.includes(name)) return 'easy';
    }
    for (const name of mediumPoems) {
      if (title.includes(name)) return 'medium';
    }

    if (content.length > 100) return 'hard';
    if (content.length > 60) return 'medium';
    return 'easy';
  }

  getDifficultyByRound(round) {
    if (round <= 10) return 'easy';
    if (round <= 20) return 'medium';
    return 'hard';
  }

  async generateQuestion(usedTitles = [], currentRound = 1) {
    const poems = await this.loadPoemsCache();
    
    if (poems.length === 0) {
      return this.getFallbackQuestion(usedTitles);
    }

    const targetDifficulty = this.getDifficultyByRound(currentRound);
    const usedSet = new Set(usedTitles);

    let candidates = poems.filter(p => !usedSet.has(p.title));
    
    const difficultyOrder = { 'easy': 1, 'medium': 2, 'hard': 3 };
    const targetLevel = difficultyOrder[targetDifficulty];
    
    const preferredCandidates = candidates.filter(p => {
      const poemLevel = difficultyOrder[p.difficulty] || 1;
      return poemLevel <= targetLevel;
    });

    if (preferredCandidates.length > 0) {
      candidates = preferredCandidates;
    }

    if (candidates.length === 0) {
      candidates = poems.filter(p => !usedSet.has(p.title));
    }
    if (candidates.length === 0) {
      candidates = poems;
    }

    const poem = candidates[Math.floor(Math.random() * candidates.length)];
    const couplet = poem.couplets[Math.floor(Math.random() * poem.couplets.length)];

    return {
      question: couplet.question,
      answer: couplet.answer,
      full_poem: poem.content,
      title: poem.title,
      author: poem.author,
      type: couplet.type || '诗词接句',
      analysis: `此句出自${poem.author || '未知'}《${poem.title}》`,
      difficulty: poem.difficulty
    };
  }

  async generateQuestionBatch(count = 20, usedTitles = [], startRound = 1) {
    const questions = [];
    const usedTitlesSet = new Set(usedTitles);

    for (let i = 0; i < count * 3 && questions.length < count; i++) {
      const round = startRound + questions.length;
      const q = await this.generateQuestion([...usedTitlesSet], round);
      if (q && !usedTitlesSet.has(q.title)) {
        usedTitlesSet.add(q.title);
        questions.push(q);
      }
    }

    if (questions.length === 0) {
      questions.push(this.getFallbackQuestion(usedTitles));
    }

    return questions;
  }

  getFallbackQuestion(excludeTitles = []) {
    const pool = [
      { question: '床前明月光，____。', answer: '疑是地上霜', full_poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', title: '静夜思', author: '李白', type: '上句填下句', analysis: '此句出自李白《静夜思》', difficulty: 'easy' },
      { question: '____，疑是地上霜。', answer: '床前明月光', full_poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', title: '静夜思', author: '李白', type: '下句填上句', analysis: '此句出自李白《静夜思》', difficulty: 'easy' },
      { question: '春眠不觉晓，____。', answer: '处处闻啼鸟', full_poem: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。', title: '春晓', author: '孟浩然', type: '上句填下句', analysis: '此句出自孟浩然《春晓》', difficulty: 'easy' },
      { question: '____，处处闻啼鸟。', answer: '春眠不觉晓', full_poem: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。', title: '春晓', author: '孟浩然', type: '下句填上句', analysis: '此句出自孟浩然《春晓》', difficulty: 'easy' },
      { question: '白日依山尽，____。', answer: '黄河入海流', full_poem: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', title: '登鹳雀楼', author: '王之涣', type: '上句填下句', analysis: '此句出自王之涣《登鹳雀楼》', difficulty: 'easy' },
      { question: '____，黄河入海流。', answer: '白日依山尽', full_poem: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', title: '登鹳雀楼', author: '王之涣', type: '下句填上句', analysis: '此句出自王之涣《登鹳雀楼》', difficulty: 'easy' },
      { question: '千山鸟飞绝，____。', answer: '万径人踪灭', full_poem: '千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。', title: '江雪', author: '柳宗元', type: '上句填下句', analysis: '此句出自柳宗元《江雪》', difficulty: 'easy' },
      { question: '____，万径人踪灭。', answer: '千山鸟飞绝', full_poem: '千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。', title: '江雪', author: '柳宗元', type: '下句填上句', analysis: '此句出自柳宗元《江雪》', difficulty: 'easy' },
      { question: '红豆生南国，____。', answer: '春来发几枝', full_poem: '红豆生南国，春来发几枝。愿君多采撷，此物最相思。', title: '相思', author: '王维', type: '上句填下句', analysis: '此句出自王维《相思》', difficulty: 'easy' },
      { question: '____，春来发几枝。', answer: '红豆生南国', full_poem: '红豆生南国，春来发几枝。愿君多采撷，此物最相思。', title: '相思', author: '王维', type: '下句填上句', analysis: '此句出自王维《相思》', difficulty: 'easy' },
      { question: '独在异乡为异客，____。', answer: '每逢佳节倍思亲', full_poem: '独在异乡为异客，每逢佳节倍思亲。遥知兄弟登高处，遍插茱萸少一人。', title: '九月九日忆山东兄弟', author: '王维', type: '上句填下句', analysis: '此句出自王维《九月九日忆山东兄弟》', difficulty: 'easy' },
      { question: '____，每逢佳节倍思亲。', answer: '独在异乡为异客', full_poem: '独在异乡为异客，每逢佳节倍思亲。遥知兄弟登高处，遍插茱萸少一人。', title: '九月九日忆山东兄弟', author: '王维', type: '下句填上句', analysis: '此句出自王维《九月九日忆山东兄弟》', difficulty: 'easy' },
      { question: '两岸猿声啼不住，____。', answer: '轻舟已过万重山', full_poem: '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。', title: '早发白帝城', author: '李白', type: '上句填下句', analysis: '此句出自李白《早发白帝城》', difficulty: 'easy' },
      { question: '____，轻舟已过万重山。', answer: '两岸猿声啼不住', full_poem: '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。', title: '早发白帝城', author: '李白', type: '下句填上句', analysis: '此句出自李白《早发白帝城》', difficulty: 'easy' },
      { question: '随风潜入夜，____。', answer: '润物细无声', full_poem: '好雨知时节，当春乃发生。随风潜入夜，润物细无声。野径云俱黑，江船火独明。晓看红湿处，花重锦官城。', title: '春夜喜雨', author: '杜甫', type: '上句填下句', analysis: '此句出自杜甫《春夜喜雨》', difficulty: 'easy' },
      { question: '____，润物细无声。', answer: '随风潜入夜', full_poem: '好雨知时节，当春乃发生。随风潜入夜，润物细无声。野径云俱黑，江船火独明。晓看红湿处，花重锦官城。', title: '春夜喜雨', author: '杜甫', type: '下句填上句', analysis: '此句出自杜甫《春夜喜雨》', difficulty: 'easy' },
      { question: '日照香炉生紫烟，____。', answer: '遥看瀑布挂前川', full_poem: '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。', title: '望庐山瀑布', author: '李白', type: '上句填下句', analysis: '此句出自李白《望庐山瀑布》', difficulty: 'easy' },
      { question: '____，遥看瀑布挂前川。', answer: '日照香炉生紫烟', full_poem: '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。', title: '望庐山瀑布', author: '李白', type: '下句填上句', analysis: '此句出自李白《望庐山瀑布》', difficulty: 'easy' },
      { question: '举头望明月，____。', answer: '低头思故乡', full_poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', title: '静夜思', author: '李白', type: '上句填下句', analysis: '此句出自李白《静夜思》', difficulty: 'easy' },
      { question: '____，低头思故乡。', answer: '举头望明月', full_poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', title: '静夜思', author: '李白', type: '下句填上句', analysis: '此句出自李白《静夜思》', difficulty: 'easy' },
      { question: '欲穷千里目，____。', answer: '更上一层楼', full_poem: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', title: '登鹳雀楼', author: '王之涣', type: '上句填下句', analysis: '此句出自王之涣《登鹳雀楼》', difficulty: 'easy' },
      { question: '____，更上一层楼。', answer: '欲穷千里目', full_poem: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', title: '登鹳雀楼', author: '王之涣', type: '下句填上句', analysis: '此句出自王之涣《登鹳雀楼》', difficulty: 'easy' },
      { question: '野火烧不尽，____。', answer: '春风吹又生', full_poem: '离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。', title: '赋得古原草送别', author: '白居易', type: '上句填下句', analysis: '此句出自白居易《赋得古原草送别》', difficulty: 'easy' },
      { question: '____，春风吹又生。', answer: '野火烧不尽', full_poem: '离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。', title: '赋得古原草送别', author: '白居易', type: '下句填上句', analysis: '此句出自白居易《赋得古原草送别》', difficulty: 'easy' },
      { question: '海内存知己，____。', answer: '天涯若比邻', full_poem: '城阙辅三秦，风烟望五津。与君离别意，同是宦游人。海内存知己，天涯若比邻。无为在歧路，儿女共沾巾。', title: '送杜少府之任蜀州', author: '王勃', type: '上句填下句', analysis: '此句出自王勃《送杜少府之任蜀州》', difficulty: 'medium' },
      { question: '____，天涯若比邻。', answer: '海内存知己', full_poem: '城阙辅三秦，风烟望五津。与君离别意，同是宦游人。海内存知己，天涯若比邻。无为在歧路，儿女共沾巾。', title: '送杜少府之任蜀州', author: '王勃', type: '下句填上句', analysis: '此句出自王勃《送杜少府之任蜀州》', difficulty: 'medium' },
      { question: '谁知盘中餐，____。', answer: '粒粒皆辛苦', full_poem: '锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。', title: '悯农', author: '李绅', type: '上句填下句', analysis: '此句出自李绅《悯农》', difficulty: 'easy' },
      { question: '____，粒粒皆辛苦。', answer: '谁知盘中餐', full_poem: '锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。', title: '悯农', author: '李绅', type: '下句填上句', analysis: '此句出自李绅《悯农》', difficulty: 'easy' },
      { question: '停车坐爱枫林晚，____。', answer: '霜叶红于二月花', full_poem: '远上寒山石径斜，白云深处有人家。停车坐爱枫林晚，霜叶红于二月花。', title: '山行', author: '杜牧', type: '上句填下句', analysis: '此句出自杜牧《山行》', difficulty: 'medium' },
      { question: '____，霜叶红于二月花。', answer: '停车坐爱枫林晚', full_poem: '远上寒山石径斜，白云深处有人家。停车坐爱枫林晚，霜叶红于二月花。', title: '山行', author: '杜牧', type: '下句填上句', analysis: '此句出自杜牧《山行》', difficulty: 'medium' },
    ];

    const available = pool.filter(q => !excludeTitles.includes(q.title));
    const source = available.length > 0 ? available : pool;
    return source[Math.floor(Math.random() * source.length)];
  }

  async startSingleGame(userId, username) {
    const roomId = uuidv4();
    const initialQuestion = await this.generateQuestion([], 1);

    const room = {
      id: roomId,
      mode: 'single',
      userId,
      username,
      status: 'playing',
      questions: [{ ...initialQuestion, round: 1 }],
      usedTitles: [initialQuestion.title],
      wrongQuestions: [],
      currentRound: 1,
      totalTime: 30,
      correctCount: 0,
      wrongCount: 0,
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    return room;
  }

  addToMatchmaking(userId, username, socketId) {
    this.matchmakingQueue = this.matchmakingQueue.filter(m => m.userId !== userId);
    this.matchmakingQueue.push({ userId, username, socketId, joinedAt: Date.now() });

    if (this.matchmakingQueue.length >= 2) {
      const player1 = this.matchmakingQueue.shift();
      const player2 = this.matchmakingQueue.shift();
      return this._createDualRoom(player1, player2);
    }
    return null;
  }

  removeFromMatchmaking(userId) {
    this.matchmakingQueue = this.matchmakingQueue.filter(m => m.userId !== userId);
  }

  getMatchmakingQueueSize() {
    return this.matchmakingQueue.length;
  }

  async _createDualRoom(player1, player2) {
    const roomId = uuidv4();
    const question = await this.generateQuestion([], 1);

    const room = {
      id: roomId,
      mode: 'dual',
      players: [
        { id: player1.userId, username: player1.username, socketId: player1.socketId, correct: 0, wrong: 0, answered: false, answer: null, isCorrect: null },
        { id: player2.userId, username: player2.username, socketId: player2.socketId, correct: 0, wrong: 0, answered: false, answer: null, isCorrect: null }
      ],
      status: 'playing',
      currentRound: 1,
      totalRounds: 30,
      question: { ...question, round: 1 },
      usedTitles: [question.title],
      questionStartTime: Date.now(),
      totalTime: 30,
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoomInfo(room) {
    if (room.mode === 'single') {
      return {
        id: room.id,
        mode: 'single',
        username: room.username,
        currentRound: room.currentRound,
        totalRounds: 30
      };
    } else {
      return {
        id: room.id,
        mode: 'dual',
        players: room.players.map(p => ({
          id: p.id,
          username: p.username,
          correct: p.correct,
          wrong: p.wrong
        })),
        currentRound: room.currentRound,
        totalRounds: room.totalRounds
      };
    }
  }

  submitDualAnswer(roomId, userId, answer) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: '房间不存在' };
    if (room.status !== 'playing') return { success: false, error: '游戏未开始或已结束' };
    if (room.mode !== 'dual') return { success: false, error: '不是双人模式' };

    const player = room.players.find(p => p.id === userId);
    if (!player) return { success: false, error: '玩家不在此房间' };
    if (player.answered) return { success: false, error: '已回答过本题' };

    const normalizedUser = normalizeStr(answer);
    const normalizedCorrect = normalizeStr(room.question.answer);
    const isCorrect = normalizedUser === normalizedCorrect;

    player.answered = true;
    player.answer = answer;
    player.isCorrect = isCorrect;

    if (isCorrect) {
      player.correct++;
    } else {
      player.wrong++;
    }

    const allAnswered = room.players.every(p => p.answered);
    if (allAnswered) {
      return { success: true, bothAnswered: true, question: room.question };
    }
    return { success: true, bothAnswered: false, question: room.question };
  }

  handleDualTimeout(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return null;
    if (room.mode !== 'dual') return null;

    const player = room.players.find(p => p.id === userId);
    if (!player || player.answered) return null;

    player.answered = true;
    player.answer = '__TIMEOUT__';
    player.isCorrect = false;
    player.wrong++;

    const allAnswered = room.players.every(p => p.answered);
    if (allAnswered) {
      return { bothAnswered: true, question: room.question };
    }
    return { bothAnswered: false };
  }

  async advanceDualRound(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'playing') return null;

    const nextRound = room.currentRound + 1;

    if (nextRound > room.totalRounds) {
      return this.endDualGame(room);
    }

    const question = await this.generateQuestion(room.usedTitles, nextRound);

    room.players.forEach(p => {
      p.answered = false;
      p.answer = null;
      p.isCorrect = null;
    });

    room.currentRound = nextRound;
    room.question = { ...question, round: nextRound };
    room.usedTitles.push(question.title);
    room.questionStartTime = Date.now();

    return {
      success: true,
      question: room.question,
      currentRound: room.currentRound,
      players: room.players.map(p => ({
        id: p.id,
        username: p.username,
        correct: p.correct,
        wrong: p.wrong
      }))
    };
  }

  endDualGame(room) {
    room.status = 'finished';
    room.endedAt = Date.now();

    const p1 = room.players[0];
    const p2 = room.players[1];

    let winner = null;
    let loser = null;
    let reason = 'completed';

    if (p1.correct > p2.correct) {
      winner = { id: p1.id, username: p1.username, correct: p1.correct };
      loser = { id: p2.id, username: p2.username, correct: p2.correct };
    } else if (p2.correct > p1.correct) {
      winner = { id: p2.id, username: p2.username, correct: p2.correct };
      loser = { id: p1.id, username: p1.username, correct: p1.correct };
    } else {
      winner = { id: p1.id, username: p1.username, correct: p1.correct, tie: true };
      loser = { id: p2.id, username: p2.username, correct: p2.correct, tie: true };
    }

    this._saveDualBattleRecord(room, winner, loser);

    return {
      success: true,
      type: 'finished',
      reason,
      totalRounds: room.currentRound,
      players: room.players.map(p => ({
        id: p.id,
        username: p.username,
        correct: p.correct,
        wrong: p.wrong
      })),
      winner,
      loser
    };
  }

  _saveDualBattleRecord(room, winner, loser) {
    const stmt = db.prepare(
      `INSERT INTO challenge_battles
       (player1_id, player2_id, winner_id, loser_id, total_questions, player1_correct, player2_correct, total_rounds, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    stmt.run(
      room.players[0].id,
      room.players[1].id,
      winner.tie ? null : winner.id,
      loser.tie ? null : loser.id,
      room.currentRound,
      room.players[0].correct,
      room.players[1].correct,
      room.currentRound,
      room.createdAt,
      room.endedAt || Date.now()
    );
    stmt.finalize();
  }

  async nextSingleQuestion(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return null;
    if (room.mode !== 'single') return null;

    const nextRound = room.questions.length + 1;
    if (nextRound > 30) {
      return this.endSingleGame(room);
    }

    const question = await this.generateQuestion(room.usedTitles, nextRound);

    room.questions.push({ ...question, round: nextRound });
    room.usedTitles.push(question.title);
    room.currentRound = nextRound;

    return {
      success: true,
      question,
      currentRound: room.currentRound,
      correctCount: room.correctCount,
      wrongCount: room.wrongCount
    };
  }

  submitSingleAnswer(roomId, userId, answer) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: '房间不存在' };
    if (room.status !== 'playing') return { success: false, error: '游戏已结束' };
    if (room.mode !== 'single') return { success: false, error: '不是单人模式' };

    const currentQuestion = room.questions[room.questions.length - 1];
    const normalizedUser = normalizeStr(answer);
    const normalizedCorrect = normalizeStr(currentQuestion.answer);
    const isCorrect = normalizedUser === normalizedCorrect;

    if (isCorrect) {
      room.correctCount++;
    } else {
      room.wrongCount++;
      room.wrongQuestions.push({
        question: currentQuestion.question,
        answer: currentQuestion.answer,
        userAnswer: answer,
        fullPoem: currentQuestion.full_poem,
        author: currentQuestion.author,
        title: currentQuestion.title
      });
    }

    return {
      success: true,
      isCorrect,
      correctAnswer: currentQuestion.answer,
      question: currentQuestion
    };
  }

  async timeoutSingleGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return null;
    if (room.mode !== 'single') return null;

    room.wrongCount++;
    const currentQuestion = room.questions[room.questions.length - 1];
    room.wrongQuestions.push({
      question: currentQuestion.question,
      answer: currentQuestion.answer,
      userAnswer: '(超时)',
      fullPoem: currentQuestion.full_poem,
      author: currentQuestion.author,
      title: currentQuestion.title
    });

    const nextResult = await this.nextSingleQuestion(roomId);
    if (nextResult.type === 'finished') {
      this.saveSingleRecord(room);
      return nextResult;
    }
    return {
      correctAnswer: currentQuestion.answer,
      ...nextResult
    };
  }

  endSingleGame(room) {
    room.status = 'finished';
    room.endedAt = Date.now();
    return {
      type: 'finished',
      reason: 'completed',
      totalQuestions: room.questions.length,
      correctCount: room.correctCount,
      wrongCount: room.wrongCount,
      wrongQuestions: room.wrongQuestions,
      resultPlayers: [{
        id: room.userId,
        username: room.username,
        correct: room.correctCount,
        wrong: room.wrongCount
      }]
    };
  }

  saveSingleRecord(room) {
    const stmt = db.prepare(
      `INSERT INTO challenge_battles
       (player1_id, player2_id, winner_id, loser_id, total_questions, player1_correct, player2_correct, total_rounds, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const winnerId = room.correctCount >= room.wrongCount ? room.userId : null;
    const loserId = room.correctCount < room.wrongCount ? room.userId : null;

    stmt.run(
      room.userId, room.userId,
      winnerId, loserId,
      room.questions.length,
      room.correctCount, 0,
      room.currentRound,
      room.createdAt,
      room.endedAt || Date.now()
    );
    stmt.finalize();

    if (room.wrongQuestions && room.wrongQuestions.length > 0) {
      const now = new Date().toISOString();
      for (const wq of room.wrongQuestions) {
        db.get(
          'SELECT * FROM wrong_questions WHERE user_id = ? AND question = ?',
          [room.userId, wq.question],
          (err, existing) => {
            if (err) return;
            if (existing) {
              db.run(
                `UPDATE wrong_questions SET wrong_count = wrong_count + 1, user_answer = ?, last_wrong_time = ?, correct_streak = 0, mastered = 0 WHERE id = ?`,
                [wq.userAnswer || '', now, existing.id]
              );
            } else {
              db.run(
                `INSERT INTO wrong_questions (user_id, question, answer, user_answer, level, full_poem, author, title, wrong_count, last_wrong_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [room.userId, wq.question, wq.answer, wq.userAnswer || '', 1, wq.fullPoem || '', wq.author || '', wq.title || '', 1, now]
              );
            }
          }
        );
      }
    }
  }

  getBattleHistory(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cb.*, u1.username as player1_name, u2.username as player2_name
         FROM challenge_battles cb
         LEFT JOIN users u1 ON cb.player1_id = u1.id
         LEFT JOIN users u2 ON cb.player2_id = u2.id
         WHERE cb.player1_id = ? OR cb.player2_id = ?
         ORDER BY cb.ended_at DESC
         LIMIT 20`,
        [userId, userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }
}

function normalizeStr(str) {
  if (!str) return '';
  let s = str.replace(/\s/g, '');
  s = s.replace(/[，。！？、；：""''（）【】、,.!?;:"'()\[\]\\/]/g, '');
  const fullWidthMap = {
    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
    '　': ''
  };
  s = s.split('').map(c => {
    if (fullWidthMap[c]) return fullWidthMap[c];
    const code = c.charCodeAt(0);
    if (code >= 65281 && code <= 65374) return String.fromCharCode(code - 65248);
    return c;
  }).join('');
  return s.replace(/\s/g, '');
}

module.exports = new ChallengeBattleService();
