const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/db');

class ChallengeBattleService {
  constructor() {
    this.rooms = new Map();
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // 从数据库诗词生成题目
  generateLocalQuestion(usedTitles = []) {
    return new Promise((resolve) => {
      db.all(`SELECT id, title, author, content FROM poems ORDER BY RANDOM() LIMIT 50`, [], (err, poems) => {
        if (err || !poems || poems.length === 0) {
          resolve(this.getFallbackQuestion(usedTitles));
          return;
        }

        const available = poems.filter(p => !usedTitles.includes(p.title));
        const source = available.length > 0 ? poems : poems;
        const poem = source[Math.floor(Math.random() * source.length)];
        const content = (poem.content || '').replace(/[，、；：""''（）【】《》]/g, '，').replace(/[。！？…；]/g, '。');
        const lines = content.split('。').filter(l => l.trim().length >= 4);

        if (lines.length < 2) {
          resolve(this.getFallbackQuestion(usedTitles));
          return;
        }

        const usedPairs = new Set();
        const questions = [];

        for (const line of lines) {
          const parts = line.split('，').filter(p => p.trim().length >= 2);
          for (let i = 0; i < parts.length - 1; i++) {
            const left = parts[i].trim();
            const right = parts[i + 1].trim();
            if (left.length >= 2 && right.length >= 2) {
              const key = `${poem.title}::${left}`;
              if (!usedPairs.has(key)) {
                usedPairs.add(key);
                const isTop = Math.random() > 0.5;
                questions.push({
                  question: isTop ? `${left}，____。` : `____，${right}。`,
                  answer: isTop ? right : left,
                  full_poem: content.replace(/，/g, '，').replace(/。/g, '。') + '。',
                  title: poem.title,
                  author: poem.author,
                  type: isTop ? '上句填下句' : '下句填上句',
                  analysis: `此句出自${poem.author || '未知'}《${poem.title}》`
                });
              }
            }
          }
        }

        if (questions.length > 0) {
          const q = questions[Math.floor(Math.random() * questions.length)];
          resolve(q);
        } else {
          resolve(this.getFallbackQuestion(usedTitles));
        }
      });
    });
  }

  // 生成一批备选题用于快速抽取
  async generateQuestionBatch(count = 20, usedTitles = []) {
    const questions = [];
    const usedTitlesSet = new Set(usedTitles);

    for (let i = 0; i < count * 3 && questions.length < count; i++) {
      const q = await this.generateLocalQuestion([...usedTitlesSet]);
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
      { question: '床前明月光，____。', answer: '疑是地上霜', full_poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', title: '静夜思', author: '李白', type: '上句填下句', analysis: '此句出自李白《静夜思》' },
      { question: '____，疑是地上霜。', answer: '床前明月光', full_poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', title: '静夜思', author: '李白', type: '下句填上句', analysis: '此句出自李白《静夜思》' },
      { question: '春眠不觉晓，____。', answer: '处处闻啼鸟', full_poem: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。', title: '春晓', author: '孟浩然', type: '上句填下句', analysis: '此句出自孟浩然《春晓》' },
      { question: '____，处处闻啼鸟。', answer: '春眠不觉晓', full_poem: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。', title: '春晓', author: '孟浩然', type: '下句填上句', analysis: '此句出自孟浩然《春晓》' },
      { question: '白日依山尽，____。', answer: '黄河入海流', full_poem: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', title: '登鹳雀楼', author: '王之涣', type: '上句填下句', analysis: '此句出自王之涣《登鹳雀楼》' },
      { question: '____，黄河入海流。', answer: '白日依山尽', full_poem: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', title: '登鹳雀楼', author: '王之涣', type: '下句填上句', analysis: '此句出自王之涣《登鹳雀楼》' },
      { question: '千山鸟飞绝，____。', answer: '万径人踪灭', full_poem: '千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。', title: '江雪', author: '柳宗元', type: '上句填下句', analysis: '此句出自柳宗元《江雪》' },
      { question: '____，万径人踪灭。', answer: '千山鸟飞绝', full_poem: '千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。', title: '江雪', author: '柳宗元', type: '下句填上句', analysis: '此句出自柳宗元《江雪》' },
      { question: '红豆生南国，____。', answer: '春来发几枝', full_poem: '红豆生南国，春来发几枝。愿君多采撷，此物最相思。', title: '相思', author: '王维', type: '上句填下句', analysis: '此句出自王维《相思》' },
      { question: '____，春来发几枝。', answer: '红豆生南国', full_poem: '红豆生南国，春来发几枝。愿君多采撷，此物最相思。', title: '相思', author: '王维', type: '下句填上句', analysis: '此句出自王维《相思》' },
      { question: '独在异乡为异客，____。', answer: '每逢佳节倍思亲', full_poem: '独在异乡为异客，每逢佳节倍思亲。遥知兄弟登高处，遍插茱萸少一人。', title: '九月九日忆山东兄弟', author: '王维', type: '上句填下句', analysis: '此句出自王维《九月九日忆山东兄弟》' },
      { question: '____，每逢佳节倍思亲。', answer: '独在异乡为异客', full_poem: '独在异乡为异客，每逢佳节倍思亲。遥知兄弟登高处，遍插茱萸少一人。', title: '九月九日忆山东兄弟', author: '王维', type: '下句填上句', analysis: '此句出自王维《九月九日忆山东兄弟》' },
      { question: '两岸猿声啼不住，____。', answer: '轻舟已过万重山', full_poem: '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。', title: '早发白帝城', author: '李白', type: '上句填下句', analysis: '此句出自李白《早发白帝城》' },
      { question: '____，轻舟已过万重山。', answer: '两岸猿声啼不住', full_poem: '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。', title: '早发白帝城', author: '李白', type: '下句填上句', analysis: '此句出自李白《早发白帝城》' },
      { question: '随风潜入夜，____。', answer: '润物细无声', full_poem: '好雨知时节，当春乃发生。随风潜入夜，润物细无声。野径云俱黑，江船火独明。晓看红湿处，花重锦官城。', title: '春夜喜雨', author: '杜甫', type: '上句填下句', analysis: '此句出自杜甫《春夜喜雨》' },
      { question: '____，润物细无声。', answer: '随风潜入夜', full_poem: '好雨知时节，当春乃发生。随风潜入夜，润物细无声。野径云俱黑，江船火独明。晓看红湿处，花重锦官城。', title: '春夜喜雨', author: '杜甫', type: '下句填上句', analysis: '此句出自杜甫《春夜喜雨》' },
      { question: '日照香炉生紫烟，____。', answer: '遥看瀑布挂前川', full_poem: '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。', title: '望庐山瀑布', author: '李白', type: '上句填下句', analysis: '此句出自李白《望庐山瀑布》' },
      { question: '____，遥看瀑布挂前川。', answer: '日照香炉生紫烟', full_poem: '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。', title: '望庐山瀑布', author: '李白', type: '下句填上句', analysis: '此句出自李白《望庐山瀑布》' },
      { question: '举头望明月，____。', answer: '低头思故乡', full_poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', title: '静夜思', author: '李白', type: '上句填下句', analysis: '此句出自李白《静夜思》' },
      { question: '____，低头思故乡。', answer: '举头望明月', full_poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。', title: '静夜思', author: '李白', type: '下句填上句', analysis: '此句出自李白《静夜思》' },
      { question: '欲穷千里目，____。', answer: '更上一层楼', full_poem: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', title: '登鹳雀楼', author: '王之涣', type: '上句填下句', analysis: '此句出自王之涣《登鹳雀楼》' },
      { question: '____，更上一层楼。', answer: '欲穷千里目', full_poem: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。', title: '登鹳雀楼', author: '王之涣', type: '下句填上句', analysis: '此句出自王之涣《登鹳雀楼》' },
      { question: '野火烧不尽，____。', answer: '春风吹又生', full_poem: '离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。', title: '赋得古原草送别', author: '白居易', type: '上句填下句', analysis: '此句出自白居易《赋得古原草送别》' },
      { question: '____，春风吹又生。', answer: '野火烧不尽', full_poem: '离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。', title: '赋得古原草送别', author: '白居易', type: '下句填上句', analysis: '此句出自白居易《赋得古原草送别》' },
      { question: '海内存知己，____。', answer: '天涯若比邻', full_poem: '城阙辅三秦，风烟望五津。与君离别意，同是宦游人。海内存知己，天涯若比邻。无为在歧路，儿女共沾巾。', title: '送杜少府之任蜀州', author: '王勃', type: '上句填下句', analysis: '此句出自王勃《送杜少府之任蜀州》' },
      { question: '____，天涯若比邻。', answer: '海内存知己', full_poem: '城阙辅三秦，风烟望五津。与君离别意，同是宦游人。海内存知己，天涯若比邻。无为在歧路，儿女共沾巾。', title: '送杜少府之任蜀州', author: '王勃', type: '下句填上句', analysis: '此句出自王勃《送杜少府之任蜀州》' },
      { question: '谁知盘中餐，____。', answer: '粒粒皆辛苦', full_poem: '锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。', title: '悯农', author: '李绅', type: '上句填下句', analysis: '此句出自李绅《悯农》' },
      { question: '____，粒粒皆辛苦。', answer: '谁知盘中餐', full_poem: '锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。', title: '悯农', author: '李绅', type: '下句填上句', analysis: '此句出自李绅《悯农》' },
      { question: '停车坐爱枫林晚，____。', answer: '霜叶红于二月花', full_poem: '远上寒山石径斜，白云深处有人家。停车坐爱枫林晚，霜叶红于二月花。', title: '山行', author: '杜牧', type: '上句填下句', analysis: '此句出自杜牧《山行》' },
      { question: '____，霜叶红于二月花。', answer: '停车坐爱枫林晚', full_poem: '远上寒山石径斜，白云深处有人家。停车坐爱枫林晚，霜叶红于二月花。', title: '山行', author: '杜牧', type: '下句填上句', analysis: '此句出自杜牧《山行》' },
    ];

    const available = pool.filter(q => !excludeTitles.includes(q.title));
    const source = available.length > 0 ? available : pool;
    return source[Math.floor(Math.random() * source.length)];
  }

  // 开始单人对战
  async startGame(userId, username) {
    const roomId = uuidv4();

    const initialQuestion = this.getFallbackQuestion([]);

    const room = {
      id: roomId,
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

  // 本地判题（极速）
  submitAnswer(roomId, userId, answer) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: '房间不存在' };
    if (room.status !== 'playing') return { success: false, error: '游戏已结束' };

    const currentQuestion = room.questions[room.questions.length - 1];
    const normalizedUser = normalizeStr(answer);
    const normalizedCorrect = normalizeStr(currentQuestion.answer);
    const isCorrect = normalizedUser === normalizedCorrect;

    if (isCorrect) {
      room.correctCount += 1;
    } else {
      room.wrongCount += 1;
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
      submittedAnswer: answer,
      correctAnswer: currentQuestion.answer,
      question: currentQuestion,
      room
    };
  }

  // 下一题
  async nextQuestion(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'playing') return null;

    const nextRound = room.questions.length + 1;

    if (nextRound > 30) {
      return this.endGame(room, 'max_rounds');
    }

    let question;
    const mergedExclude = [...room.usedTitles];
    const batch = await this.generateQuestionBatch(20, mergedExclude);
    question = batch.length > 0 ? batch[0] : this.getFallbackQuestion(mergedExclude);

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

  // 结束游戏
  endGame(room, reason = 'completed') {
    room.status = 'finished';
    room.endReason = reason;
    room.endedAt = Date.now();

    return {
      type: 'finished',
      reason,
      totalQuestions: room.questions.length,
      correctCount: room.correctCount,
      wrongCount: room.wrongCount,
      questions: room.questions,
      wrongQuestions: room.wrongQuestions,
      resultPlayers: [{
        id: room.userId,
        username: room.username,
        correct: room.correctCount,
        wrong: room.wrongCount
      }]
    };
  }

  // 保存对战记录到数据库
  saveBattleRecord(room) {
    const stmt = db.prepare(
      'INSERT INTO challenge_battles (player1_id, player2_id, winner_id, loser_id, total_questions, player1_correct, player2_correct, total_rounds, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    const winnerId = room.correctCount >= room.wrongCount ? room.userId : null;
    const loserId = room.correctCount < room.wrongCount ? room.userId : null;

    stmt.run(
      room.userId,
      room.userId,
      winnerId,
      loserId,
      room.questions.length,
      room.correctCount,
      0,
      room.currentRound,
      room.createdAt,
      room.endedAt || Date.now()
    );
    stmt.finalize();

    // 保存错题到错题本
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
                `INSERT INTO wrong_questions (user_id, question, answer, user_answer, level, full_poem, author, title, wrong_count, last_wrong_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        `SELECT cb.*, u.username as player1_name
         FROM challenge_battles cb
         JOIN users u ON cb.player1_id = u.id
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
