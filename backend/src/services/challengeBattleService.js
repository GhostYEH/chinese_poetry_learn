const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/db');
const { generateDuelQuestions } = require('./aiService');

class ChallengeBattleService {
  constructor() {
    this.onlineUsers = new Map();
    this.rooms = new Map();
    this.pendingInvitations = new Map();
    this.disconnectedPlayers = new Map();
    this.RECONNECT_TIMEOUT = 30000;
  }

  addUser(userId, username, socketId) {
    const existingUser = this.onlineUsers.get(userId);
    if (existingUser) {
      this.onlineUsers.set(userId, {
        ...existingUser,
        socketId,
        inGame: existingUser.inGame
      });

      if (existingUser.inGame) {
        const room = this.rooms.get(existingUser.inGame);
        if (room) {
          const player = room.players.find(p => p.id === userId);
          if (player) {
            player.socketId = socketId;
            player.disconnected = false;
          }
        }
      }

      this.disconnectedPlayers.delete(userId);
      return this.getOnlineUsers();
    }

    this.onlineUsers.set(userId, {
      userId: userId.toString(),
      username,
      socketId,
      classId: null,
      inGame: false
    });

    db.get(
      'SELECT class_id FROM users WHERE id = ?',
      [userId],
      (err, row) => {
        if (!err && row) {
          const user = this.onlineUsers.get(userId);
          if (user) user.classId = row.class_id || null;
        }
      }
    );

    return this.getOnlineUsers();
  }

  removeUser(socketId) {
    for (const [userId, user] of this.onlineUsers) {
      if (user.socketId === socketId) {
        if (user.inGame) {
          const roomId = user.inGame;
          const room = this.rooms.get(roomId);
          if (room && room.status === 'playing') {
            const player = room.players.find(p => p.id === userId);
            if (player) {
              player.disconnected = true;
              player.disconnectTime = Date.now();
            }

            this.disconnectedPlayers.set(userId, {
              roomId,
              username: user.username,
              disconnectTime: Date.now()
            });

            setTimeout(() => {
              this.handleReconnectTimeout(userId);
            }, this.RECONNECT_TIMEOUT);

            continue;
          }
        }
        this.onlineUsers.delete(userId);
        this.pendingInvitations.delete(userId);
        break;
      }
    }
    return this.getOnlineUsers();
  }

  handleReconnectTimeout(userId) {
    const disconnectedInfo = this.disconnectedPlayers.get(userId);
    if (!disconnectedInfo) return null;

    const room = this.rooms.get(disconnectedInfo.roomId);
    if (!room || room.status !== 'playing') {
      this.disconnectedPlayers.delete(userId);
      return null;
    }

    const player = room.players.find(p => p.id === userId);
    if (player && player.disconnected) {
      this.disconnectedPlayers.delete(userId);
      const winner = room.players.find(p => p.id !== userId);

      room.status = 'finished';
      room.winner = winner;
      room.loser = player;
      room.endReason = 'disconnect_timeout';
      room.endedAt = Date.now();

      this.saveBattleRecord(room);

      room.players.forEach(p => {
        const u = this.onlineUsers.get(p.id);
        if (u) u.inGame = false;
      });

      this.rooms.delete(disconnectedInfo.roomId);

      if (winner && winner.socketId) {
        return {
          winnerSocketId: winner.socketId,
          winner,
          loser: player,
          reason: 'disconnect_timeout'
        };
      }
    }

    this.disconnectedPlayers.delete(userId);
    return null;
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers.values()).map(u => ({
      userId: u.userId,
      username: u.username,
      classId: u.classId,
      inGame: u.inGame
    }));
  }

  getUser(userId) {
    return this.onlineUsers.get(userId);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  sendInvitation(fromUserId, toUserId) {
    const fromUser = this.onlineUsers.get(fromUserId);
    const toUser = this.onlineUsers.get(toUserId);

    if (!fromUser || !toUser) return { success: false, error: '用户不在线' };
    if (toUser.inGame) return { success: false, error: '对方正在游戏中' };
    if (fromUser.inGame) return { success: false, error: '你正在游戏中' };

    const invitationId = uuidv4();
    this.pendingInvitations.set(toUserId, {
      id: invitationId,
      from: { userId: fromUserId, username: fromUser.username, classId: fromUser.classId },
      to: { userId: toUserId, username: toUser.username },
      timestamp: Date.now()
    });

    return {
      success: true,
      invitationId,
      toSocketId: toUser.socketId,
      from: { userId: fromUserId, username: fromUser.username }
    };
  }

  getMergedSeenTitles(userIdA, userIdB) {
    return new Promise((resolve, reject) => {
      const a = parseInt(userIdA, 10);
      const b = parseInt(userIdB, 10);
      if (Number.isNaN(a) || Number.isNaN(b)) {
        resolve([]);
        return;
      }
      db.all(
        `SELECT DISTINCT poem_title AS t FROM challenge_duel_seen_titles WHERE user_id = ? OR user_id = ?`,
        [a, b],
        (err, rows) => {
          if (err) reject(err);
          else resolve((rows || []).map(r => r.t).filter(Boolean));
        }
      );
    });
  }

  recordDuelTitlesSeenForPlayers(rawIds, title) {
    if (!title || !rawIds || !rawIds.length) return;
    const now = new Date().toISOString();
    for (const raw of rawIds) {
      const uid = parseInt(raw, 10);
      if (Number.isNaN(uid)) continue;
      db.run(
        `INSERT OR IGNORE INTO challenge_duel_seen_titles (user_id, poem_title, first_seen_at) VALUES (?, ?, ?)`,
        [uid, title, now]
      );
    }
  }

  async acceptInvitation(userId, inviteId, inviterId) {
    const invitation = this.pendingInvitations.get(userId);
    if (!invitation) return { success: false, error: '邀请不存在或已过期' };
    if (Date.now() - invitation.timestamp > 60000) {
      this.pendingInvitations.delete(userId);
      return { success: false, error: '邀请已过期' };
    }

    const fromUser = this.onlineUsers.get(inviterId);
    const toUser = this.onlineUsers.get(userId);
    if (!fromUser || !toUser) return { success: false, error: '用户不在线' };
    if (fromUser.inGame || toUser.inGame) return { success: false, error: '对方已在游戏中' };

    let excludePersonal = [];
    try {
      excludePersonal = await this.getMergedSeenTitles(inviterId, userId);
    } catch (e) {
      console.error('[challengeBattle] 读取已见诗词失败:', e.message);
    }

    // 生成第一道题（AI出题，排除双方历史上对战已出现过的篇目）
    const questionData = await generateDuelQuestions(1, excludePersonal);
    const question = questionData && questionData.questions && questionData.questions[0]
      ? questionData.questions[0]
      : getFallbackQuestion(excludePersonal);

    this.recordDuelTitlesSeenForPlayers([inviterId, userId], question.title);

    const roomId = uuidv4();
    const room = {
      id: roomId,
      status: 'playing',
      players: [
        {
          id: fromUser.userId,
          username: fromUser.username,
          socketId: fromUser.socketId,
          correct: 0,
          wrong: 0,
          disconnected: false
        },
        {
          id: toUser.userId,
          username: toUser.username,
          socketId: toUser.socketId,
          correct: 0,
          wrong: 0,
          disconnected: false
        }
      ],
      currentTurn: Math.floor(Math.random() * 2),
      questions: [{ ...question, round: 1 }],
      usedTitles: [question.title],
      currentRound: 1,
      turnTimeLimit: 45,
      turnStartTime: Date.now(),
      createdAt: Date.now(),
      totalRounds: 1,
      winner: null,
      loser: null,
      endReason: null,
      endedAt: null
    };

    this.rooms.set(roomId, room);

    fromUser.inGame = roomId;
    toUser.inGame = roomId;

    this.pendingInvitations.delete(userId);

    return {
      success: true,
      room,
      fromSocketId: fromUser.socketId,
      toSocketId: toUser.socketId
    };
  }

  rejectInvitation(userId, inviteId, inviterId) {
    const invitation = this.pendingInvitations.get(userId);
    if (!invitation) return { success: false, error: '邀请不存在或已过期' };
    this.pendingInvitations.delete(userId);
    const fromUser = this.onlineUsers.get(inviterId);
    return { success: true, fromSocketId: fromUser ? fromUser.socketId : null };
  }

  async submitAnswer(roomId, userId, answer) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: '房间不存在' };
    if (room.status !== 'playing') return { success: false, error: '游戏已结束' };

    const playerIndex = room.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) return { success: false, error: '你不在该房间中' };
    if (playerIndex !== room.currentTurn) return { success: false, error: '还没轮到你' };

    const currentQuestion = room.questions[room.questions.length - 1];
    const normalizedUser = normalizeStr(answer);
    const normalizedCorrect = normalizeStr(currentQuestion.answer);
    const isCorrect = normalizedUser === normalizedCorrect;

    const submitter = room.players[playerIndex];

    if (isCorrect) {
      submitter.correct += 1;
    } else {
      submitter.wrong += 1;
    }

    return {
      success: true,
      room,
      currentQuestion,
      isCorrect,
      submittedAnswer: answer,
      submitter: { id: submitter.id, username: submitter.username, correct: submitter.correct, wrong: submitter.wrong },
      opponent: room.players[1 - playerIndex]
    };
  }

  async nextQuestion(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.status !== 'playing') return null;

    let excludePersonal = [];
    try {
      const p0 = room.players[0]?.id;
      const p1 = room.players[1]?.id;
      if (p0 != null && p1 != null) {
        excludePersonal = await this.getMergedSeenTitles(p0, p1);
      }
    } catch (e) {
      console.error('[challengeBattle] 读取已见诗词失败:', e.message);
    }

    const mergedExclude = [...new Set([...(room.usedTitles || []), ...excludePersonal])];

    // AI生成下一题（本局已用 + 双方历史对战已见篇目均排除）
    const questionData = await generateDuelQuestions(1, mergedExclude);
    const question = questionData && questionData.questions && questionData.questions[0]
      ? questionData.questions[0]
      : getFallbackQuestion(mergedExclude);

    this.recordDuelTitlesSeenForPlayers(room.players.map(p => p.id), question.title);

    room.questions.push({ ...question, round: room.questions.length + 1 });
    room.usedTitles.push(question.title);
    room.currentRound = room.questions.length;
    room.currentTurn = (room.currentTurn + 1) % 2;
    room.turnStartTime = Date.now();
    room.totalRounds = room.questions.length;

    return {
      success: true,
      room,
      currentQuestion: question,
      currentRound: room.currentRound,
      currentTurn: room.currentTurn,
      nextPlayer: room.players[room.currentTurn],
      players: room.players.map(p => ({
        id: p.id, username: p.username,
        correct: p.correct, wrong: p.wrong
      }))
    };
  }

  async processAnswerResult(roomId, userId, answerResult) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const { isCorrect, submitter, opponent } = answerResult;
    const playerIndex = room.players.findIndex(p => p.id === userId);

    if (isCorrect) {
      // 正确：切换到对手，出下一题
      const nextResult = await this.nextQuestion(roomId, userId);
      if (!nextResult) return null;

      // 检查是否已达到最大回合（默认50轮）
      if (nextResult.currentRound > 50) {
        // 达到最大回合，按得分决胜
        return this._endBattle(room, 'max_rounds');
      }

      return {
        type: 'correct',
        ...nextResult,
        submittedAnswer: answerResult.submittedAnswer,
        currentQuestion: nextResult.currentQuestion
      };
    } else {
      // 错误：对手获胜
      room.loser = room.players[playerIndex];
      room.winner = opponent;
      room.endReason = 'wrong_answer';
      return this._endBattle(room, 'wrong_answer');
    }
  }

  handleTimeout(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const loserIndex = room.currentTurn;
    const winnerIndex = (loserIndex + 1) % 2;
    const loser = room.players[loserIndex];
    const winner = room.players[winnerIndex];

    room.loser = loser;
    room.winner = winner;
    room.endReason = 'timeout';

    return this._endBattle(room, 'timeout');
  }

  handleDisconnect(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const playerIndex = room.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) return null;

    const winner = room.players[1 - playerIndex];
    const loser = room.players[playerIndex];

    room.loser = loser;
    room.winner = winner;
    room.endReason = 'disconnected';

    return this._endBattle(room, 'disconnected');
  }

  _endBattle(room, reason) {
    room.status = 'finished';
    room.endReason = reason;
    room.endedAt = Date.now();

    this.saveBattleRecord(room);

    room.players.forEach(p => {
      const u = this.onlineUsers.get(p.id);
      if (u) u.inGame = false;
    });

    this.rooms.delete(room.id);

    return {
      type: 'finished',
      winner: room.winner ? { id: room.winner.id, username: room.winner.username, correct: room.winner.correct, wrong: room.winner.wrong } : null,
      loser: room.loser ? { id: room.loser.id, username: room.loser.username, correct: room.loser.correct, wrong: room.loser.wrong } : null,
      reason,
      totalQuestions: room.questions.length,
      players: room.players.map(p => ({
        id: p.id, username: p.username, correct: p.correct, wrong: p.wrong
      })),
      questions: room.questions
    };
  }

  saveBattleRecord(room) {
    if (!room.winner || !room.loser) return;

    const stmt = db.prepare(
      'INSERT INTO challenge_battles (player1_id, player2_id, winner_id, loser_id, total_questions, player1_correct, player2_correct, total_rounds, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    stmt.run(
      room.players[0].id,
      room.players[1].id,
      room.winner ? room.winner.id : null,
      room.loser ? room.loser.id : null,
      room.questions.length,
      room.players[0].correct,
      room.players[1].correct,
      room.totalRounds,
      room.createdAt,
      room.endedAt || Date.now()
    );

    stmt.finalize();
  }

  getBattleHistory(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT cb.*,
          p1.username as player1_name,
          p2.username as player2_name,
          w.username as winner_name,
          l.username as loser_name
        FROM challenge_battles cb
        JOIN users p1 ON cb.player1_id = p1.id
        JOIN users p2 ON cb.player2_id = p2.id
        LEFT JOIN users w ON cb.winner_id = w.id
        LEFT JOIN users l ON cb.loser_id = l.id
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

function getFallbackQuestion(excludeTitles = []) {
  const pool = [
    { question: "床前明月光，____。", answer: "疑是地上霜", full_poem: "床前明月光，疑是地上霜。举头望明月，低头思故乡。", title: "静夜思", author: "李白", type: "上句填下句", analysis: "此句出自李白《静夜思》" },
    { question: "____，疑是地上霜。", answer: "床前明月光", full_poem: "床前明月光，疑是地上霜。举头望明月，低头思故乡。", title: "静夜思", author: "李白", type: "下句填上句", analysis: "此句出自李白《静夜思》" },
    { question: "春眠不觉晓，____。", answer: "处处闻啼鸟", full_poem: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。", title: "春晓", author: "孟浩然", type: "上句填下句", analysis: "此句出自孟浩然《春晓》" },
    { question: "____，处处闻啼鸟。", answer: "春眠不觉晓", full_poem: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。", title: "春晓", author: "孟浩然", type: "下句填上句", analysis: "此句出自孟浩然《春晓》" },
    { question: "白日依山尽，____。", answer: "黄河入海流", full_poem: "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。", title: "登鹳雀楼", author: "王之涣", type: "上句填下句", analysis: "此句出自王之涣《登鹳雀楼》" },
    { question: "____，黄河入海流。", answer: "白日依山尽", full_poem: "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。", title: "登鹳雀楼", author: "王之涣", type: "下句填上句", analysis: "此句出自王之涣《登鹳雀楼》" },
    { question: "千山鸟飞绝，____。", answer: "万径人踪灭", full_poem: "千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。", title: "江雪", author: "柳宗元", type: "上句填下句", analysis: "此句出自柳宗元《江雪》" },
    { question: "____，万径人踪灭。", answer: "千山鸟飞绝", full_poem: "千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。", title: "江雪", author: "柳宗元", type: "下句填上句", analysis: "此句出自柳宗元《江雪》" },
    { question: "红豆生南国，____。", answer: "春来发几枝", full_poem: "红豆生南国，春来发几枝。愿君多采撷，此物最相思。", title: "相思", author: "王维", type: "上句填下句", analysis: "此句出自王维《相思》" },
    { question: "____，春来发几枝。", answer: "红豆生南国", full_poem: "红豆生南国，春来发几枝。愿君多采撷，此物最相思。", title: "相思", author: "王维", type: "下句填上句", analysis: "此句出自王维《相思》" }
  ];

  const available = pool.filter(q => !excludeTitles.includes(q.title));
  const source = available.length > 0 ? available : pool;
  return source[Math.floor(Math.random() * source.length)];
}

module.exports = new ChallengeBattleService();
