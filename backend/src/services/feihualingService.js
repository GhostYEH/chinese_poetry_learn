const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/db');

class FeihualingService {
  constructor() {
    this.onlineUsers = new Map();
    this.rooms = new Map();
    this.pendingInvitations = new Map();
    this.roomLocks = new Map();
    this.disconnectedPlayers = new Map();
    this.RECONNECT_TIMEOUT = 30000;
  }

  // 修改：添加用户时获取班级和最高记录信息
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

    // 先添加用户到在线列表（使用默认值）
    this.onlineUsers.set(userId, {
      userId: userId.toString(),
      username,
      socketId,
      classId: null,
      maxRounds: 0,
      inGame: false
    });

    // 异步从数据库获取用户信息并更新
    db.get(
      'SELECT class_id, (SELECT MAX(total_rounds) FROM feihua_battles WHERE player1_id = ? OR player2_id = ?) as max_rounds FROM users WHERE id = ?',
      [userId, userId, userId],
      (err, row) => {
        if (!err && row) {
          const user = this.onlineUsers.get(userId);
          if (user) {
            user.classId = row.class_id || null;
            user.maxRounds = row.max_rounds || 0;
          }
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
    if (!disconnectedInfo) return;

    const room = this.rooms.get(disconnectedInfo.roomId);
    if (!room || room.status !== 'playing') {
      this.disconnectedPlayers.delete(userId);
      return;
    }

    const player = room.players.find(p => p.id === userId);
    if (player && player.disconnected) {
      this.disconnectedPlayers.delete(userId);
      const winner = room.players.find(p => p.id !== userId);
      room.status = 'finished';
      room.winner = winner;
      room.endReason = 'disconnect_timeout';

      this.saveFightHistory(room);

      room.players.forEach(p => {
        const user = this.onlineUsers.get(p.id);
        if (user) user.inGame = false;
      });

      this.rooms.delete(disconnectedInfo.roomId);

      if (winner && winner.socketId) {
        return {
          event: 'opponent-disconnected',
          winnerSocketId: winner.socketId,
          winner,
          reason: '对手断线超时，你获胜！'
        };
      }
    }

    this.disconnectedPlayers.delete(userId);
    return null;
  }

  // 修改：返回符合前端期望的用户数据结构
  getOnlineUsers() {
    return Array.from(this.onlineUsers.values()).map(u => ({
      userId: u.userId,
      username: u.username,
      classId: u.classId,
      maxRounds: u.maxRounds,
      inGame: u.inGame
    }));
  }

  getUser(userId) {
    return this.onlineUsers.get(userId);
  }

  sendInvitation(fromUserId, toUserId) {
    const fromUser = this.onlineUsers.get(fromUserId);
    const toUser = this.onlineUsers.get(toUserId);

    if (!fromUser || !toUser) {
      return { success: false, error: '用户不在线' };
    }

    if (toUser.inGame) {
      return { success: false, error: '对方正在游戏中' };
    }

    if (fromUser.inGame) {
      return { success: false, error: '你正在游戏中' };
    }

    const invitationId = uuidv4();
    this.pendingInvitations.set(toUserId, {
      id: invitationId,
      from: {
        userId: fromUserId,
        username: fromUser.username
      },
      to: {
        userId: toUserId,
        username: toUser.username
      },
      timestamp: Date.now()
    });

    return {
      success: true,
      invitationId,
      toSocketId: toUser.socketId,
      from: { userId: fromUserId, username: fromUser.username }
    };
  }

  // 修改：acceptInvitation接受邀请者和邀请者ID
  acceptInvitation(userId, inviteId, inviterId) {
    const invitation = this.pendingInvitations.get(userId);
    if (!invitation) {
      return { success: false, error: '邀请不存在或已过期' };
    }

    if (Date.now() - invitation.timestamp > 60000) {
      this.pendingInvitations.delete(userId);
      return { success: false, error: '邀请已过期' };
    }

    const fromUser = this.onlineUsers.get(inviterId);
    const toUser = this.onlineUsers.get(userId);

    if (!fromUser || !toUser) {
      return { success: false, error: '用户不在线' };
    }

    if (fromUser.inGame || toUser.inGame) {
      return { success: false, error: '对方已在游戏中' };
    }

    // 创建游戏房间
    const roomId = uuidv4();
    const room = {
      id: roomId,
      status: 'playing',
      keyword: '花', // 默认令字，应该从邀请中获取
      players: [
        {
          id: fromUser.userId,
          username: fromUser.username,
          socketId: fromUser.socketId,
          score: 0,
          throwCount: 0,
          disconnected: false
        },
        {
          id: toUser.userId,
          username: toUser.username,
          socketId: toUser.socketId,
          score: 0,
          throwCount: 0,
          disconnected: false
        }
      ],
      currentTurn: Math.floor(Math.random() * 2),
      currentRound: 1,
      usedPoems: [],
      turnTimeLimit: 60,
      turnStartTime: Date.now(),
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);

    // 更新用户状态
    fromUser.inGame = true;
    toUser.inGame = true;
    fromUser.inGame = roomId;
    toUser.inGame = roomId;

    // 清除邀请
    this.pendingInvitations.delete(userId);

    return {
      success: true,
      room,
      fromSocketId: fromUser.socketId,
      toSocketId: toUser.socketId
    };
  }

  // 修改：rejectInvitation接受邀请者和邀请者ID
  rejectInvitation(userId, inviteId, inviterId) {
    const invitation = this.pendingInvitations.get(userId);
    if (!invitation) {
      return { success: false, error: '邀请不存在或已过期' };
    }

    if (Date.now() - invitation.timestamp > 60000) {
      this.pendingInvitations.delete(userId);
      return { success: false, error: '邀请已过期' };
    }

    const fromUser = this.onlineUsers.get(inviterId);

    this.pendingInvitations.delete(userId);

    return {
      success: true,
      fromSocketId: fromUser ? fromUser.socketId : null
    };
  }

  submitAnswer(roomId, userId, poem) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: '房间不存在' };
    }

    if (room.status !== 'playing') {
      return { success: false, error: '游戏已结束' };
    }

    const playerIndex = room.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) {
      return { success: false, error: '你不在该房间中' };
    }

    if (playerIndex !== room.currentTurn) {
      return { success: false, error: '还没轮到你' };
    }

    const player = room.players[playerIndex];
    if (player.disconnected) {
      return { success: false, error: '你已断线' };
    }

    // 检查诗句是否重复
    const normalizedPoem = poem.replace(/[，。！？、；：""''（）【】《》\s]/g, '');
    if (room.usedPoems.includes(normalizedPoem)) {
      return { success: false, error: '该诗句已被使用', isDuplicate: true };
    }

    return {
      success: true,
      room,
      currentPlayer: player,
      normalizedPoem
    };
  }

  verifyAnswer(roomId, userId, poem, isValid, normalizedPoem) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    if (!isValid) {
      // 诗句无效，游戏结束
      const loserIndex = room.currentTurn;
      const winnerIndex = (loserIndex + 1) % 2;

      room.status = 'finished';
      room.winner = room.players[winnerIndex];
      room.loser = room.players[loserIndex];
      room.endReason = 'invalid_poem';

      this.saveFightHistory(room);

      // 更新用户状态
      room.players.forEach(p => {
        const user = this.onlineUsers.get(p.id);
        if (user) user.inGame = false;
      });

      this.rooms.delete(roomId);

      return {
        isCorrect: false,
        winner: room.winner,
        loser: room.loser,
        reason: '诗句无效'
      };
    }

    // 诗句有效，继续游戏
    room.usedPoems.push(normalizedPoem);
    room.players[room.currentTurn].score += 1;
    room.currentTurn = (room.currentTurn + 1) % 2;
    room.currentRound += 1;
    room.turnStartTime = Date.now();

    return {
      isCorrect: true,
      nextPlayer: room.players[room.currentTurn],
      currentRound: room.currentRound,
      usedPoems: room.usedPoems,
      players: room.players
    };
  }

  throwQuestion(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: '房间不存在' };
    }

    if (room.status !== 'playing') {
      return { success: false, error: '游戏已结束' };
    }

    const playerIndex = room.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) {
      return { success: false, error: '你不在该房间中' };
    }

    const player = room.players[playerIndex];
    if (player.throwCount >= 3) {
      return { success: false, error: '扔题次数已用完' };
    }

    player.throwCount += 1;
    const remainingThrows = 3 - player.throwCount;

    // 切换到下一个玩家
    room.currentTurn = (room.currentTurn + 1) % 2;
    room.turnStartTime = Date.now();

    return {
      success: true,
      room,
      throwCount: player.throwCount,
      remainingThrows
    };
  }

  handleTimeout(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const loserIndex = room.currentTurn;
    const winnerIndex = (loserIndex + 1) % 2;

    room.status = 'finished';
    room.winner = room.players[winnerIndex];
    room.loser = room.players[loserIndex];
    room.endReason = 'timeout';

    this.saveFightHistory(room);

    // 更新用户状态
    room.players.forEach(p => {
      const user = this.onlineUsers.get(p.id);
      if (user) user.inGame = false;
    });

    this.rooms.delete(roomId);

    return {
      winner: room.winner,
      loser: room.loser,
      reason: '超时'
    };
  }

  handleDisconnect(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const playerIndex = room.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) {
      return null;
    }

    const winnerIndex = (playerIndex + 1) % 2;

    room.status = 'finished';
    room.winner = room.players[winnerIndex];
    room.loser = room.players[playerIndex];
    room.endReason = 'disconnected';

    this.saveFightHistory(room);

    // 更新用户状态
    room.players.forEach(p => {
      const user = this.onlineUsers.get(p.id);
      if (user) user.inGame = false;
    });

    this.rooms.delete(roomId);

    return {
      winner: room.winner,
      loser: room.loser,
      reason: '对手断线'
    };
  }

  endGame(roomId, winnerId, loserId, reason) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: '房间不存在' };
    }

    room.status = 'finished';
    room.winner = room.players.find(p => p.id === winnerId);
    room.loser = room.players.find(p => p.id === loserId);
    room.endReason = reason;

    this.saveFightHistory(room);

    // 更新用户状态
    room.players.forEach(p => {
      const user = this.onlineUsers.get(p.id);
      if (user) user.inGame = false;
    });

    this.rooms.delete(roomId);

    return {
      success: true,
      winner: room.winner,
      loser: room.loser
    };
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  leaveRoom(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const playerIndex = room.players.findIndex(p => p.id === userId);
    if (playerIndex === -1) {
      return { success: false, error: '你不在该房间中' };
    }

    const otherPlayerIndex = (playerIndex + 1) % 2;
    const otherPlayer = room.players[otherPlayerIndex];

    room.status = 'finished';
    room.winner = otherPlayer;
    room.loser = room.players[playerIndex];
    room.endReason = 'leave';

    this.saveFightHistory(room);

    // 更新用户状态
    room.players.forEach(p => {
      const user = this.onlineUsers.get(p.id);
      if (user) user.inGame = false;
    });

    this.rooms.delete(roomId);

    return {
      success: true,
      winner: room.winner,
      otherPlayer
    };
  }

  saveFightHistory(room) {
    const stmt = db.prepare(
      'INSERT INTO feihua_battles (player1_id, player2_id, keyword, winner_id, loser_id, total_rounds, player1_throw_count, player2_throw_count, battle_history, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    stmt.run(
      room.players[0].id,
      room.players[1].id,
      room.keyword,
      room.winner ? room.winner.id : null,
      room.loser ? room.loser.id : null,
      room.currentRound,
      room.players[0].throwCount,
      room.players[1].throwCount,
      JSON.stringify(room.usedPoems),
      room.createdAt,
      Date.now()
    );

    stmt.finalize();
  }

  // 获取对战历史
  getFightHistory(username) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          f.id, 
          p1.username as player1, 
          p2.username as player2, 
          f.keyword, 
          f.winner_id, 
          f.loser_id, 
          f.total_rounds, 
          f.ended_at as date
        FROM feihua_battles f
        JOIN users p1 ON f.player1_id = p1.id
        JOIN users p2 ON f.player2_id = p2.id
        WHERE p1.username = ? OR p2.username = ?
        ORDER BY f.ended_at DESC
        LIMIT 20`,
        [username, username],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            const history = rows.map(row => {
              return {
                id: row.id,
                player1: row.player1,
                player2: row.player2,
                keyword: row.keyword,
                winner: row.winner_id,
                loser: row.loser_id,
                rounds: row.total_rounds,
                date: row.date
              };
            });
            resolve(history);
          }
        }
      );
    });
  }
}

module.exports = new FeihualingService();
