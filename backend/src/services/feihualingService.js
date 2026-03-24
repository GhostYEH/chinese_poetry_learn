const { v4: uuidv4 } = require('uuid');
const { db } = require('../utils/db');

class FeihualingService {
  constructor() {
    this.onlineUsers = new Map();
    this.rooms = new Map();
    this.pendingInvitations = new Map();
  }

  addUser(userId, username, socketId) {
    this.onlineUsers.set(userId, {
      id: userId,
      username,
      socketId,
      inRoom: null
    });
    return Array.from(this.onlineUsers.values()).map(u => ({
      id: u.id,
      username: u.username,
      inRoom: u.inRoom
    }));
  }

  removeUser(socketId) {
    for (const [userId, user] of this.onlineUsers) {
      if (user.socketId === socketId) {
        if (user.inRoom) {
          this.leaveRoom(user.inRoom, userId);
        }
        this.onlineUsers.delete(userId);
        this.pendingInvitations.delete(userId);
        break;
      }
    }
    return Array.from(this.onlineUsers.values()).map(u => ({
      id: u.id,
      username: u.username,
      inRoom: u.inRoom
    }));
  }

  getOnlineUsers() {
    return Array.from(this.onlineUsers.values()).map(u => ({
      id: u.id,
      username: u.username,
      inRoom: u.inRoom
    }));
  }

  sendInvitation(fromUserId, toUserId) {
    const fromUser = this.onlineUsers.get(fromUserId);
    const toUser = this.onlineUsers.get(toUserId);
    
    if (!fromUser || !toUser) {
      return { success: false, error: '用户不在线' };
    }
    
    if (toUser.inRoom) {
      return { success: false, error: '对方正在游戏中' };
    }
    
    if (fromUser.inRoom) {
      return { success: false, error: '你正在游戏中' };
    }
    
    const invitationId = uuidv4();
    this.pendingInvitations.set(toUserId, {
      id: invitationId,
      from: {
        id: fromUserId,
        username: fromUser.username
      },
      to: {
        id: toUserId,
        username: toUser.username
      },
      timestamp: Date.now()
    });
    
    return {
      success: true,
      invitationId,
      toSocketId: toUser.socketId,
      from: { id: fromUserId, username: fromUser.username }
    };
  }

  acceptInvitation(userId) {
    const invitation = this.pendingInvitations.get(userId);
    if (!invitation) {
      return { success: false, error: '邀请不存在' };
    }
    
    const fromUser = this.onlineUsers.get(invitation.from.id);
    const toUser = this.onlineUsers.get(userId);
    
    if (!fromUser || !toUser) {
      return { success: false, error: '用户不在线' };
    }
    
    this.pendingInvitations.delete(userId);
    
    const roomId = uuidv4();
    const keywords = ['春', '花', '月', '风', '山', '水', '雪', '云'];
    const keyword = keywords[Math.floor(Math.random() * keywords.length)];
    
    const room = {
      id: roomId,
      players: [
        { id: fromUser.id, username: fromUser.username, socketId: fromUser.socketId },
        { id: toUser.id, username: toUser.username, socketId: toUser.socketId }
      ],
      currentTurn: 0,
      keyword,
      usedPoems: [],
      status: 'playing',
      startTime: Date.now(),
      rounds: 0
    };
    
    this.rooms.set(roomId, room);
    fromUser.inRoom = roomId;
    toUser.inRoom = roomId;
    
    return {
      success: true,
      room,
      fromSocketId: fromUser.socketId,
      toSocketId: toUser.socketId
    };
  }

  declineInvitation(userId) {
    const invitation = this.pendingInvitations.get(userId);
    if (!invitation) {
      return { success: false, error: '邀请不存在' };
    }
    
    const fromUser = this.onlineUsers.get(invitation.from.id);
    this.pendingInvitations.delete(userId);
    
    return {
      success: true,
      fromSocketId: fromUser?.socketId
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
    
    const currentPlayer = room.players[room.currentTurn];
    if (currentPlayer.id !== userId) {
      return { success: false, error: '不是你的回合' };
    }
    
    if (room.usedPoems.includes(poem)) {
      return { success: false, error: '诗句已使用过', isDuplicate: true };
    }
    
    return {
      success: true,
      room,
      currentPlayer,
      poem
    };
  }

  verifyAnswer(roomId, userId, poem, isValid) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }
    
    if (isValid) {
      room.usedPoems.push(poem);
      room.rounds++;
      room.currentTurn = (room.currentTurn + 1) % room.players.length;
      
      return {
        success: true,
        room,
        isCorrect: true,
        nextPlayer: room.players[room.currentTurn]
      };
    } else {
      const winner = room.players[(room.currentTurn + 1) % room.players.length];
      room.status = 'finished';
      room.winner = winner;
      
      this.saveFightHistory(room);
      
      room.players.forEach(p => {
        const user = this.onlineUsers.get(p.id);
        if (user) user.inRoom = null;
      });
      
      this.rooms.delete(roomId);
      
      return {
        success: true,
        room,
        isCorrect: false,
        winner
      };
    }
  }

  leaveRoom(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const leavingPlayer = room.players.find(p => p.id === userId);
    if (!leavingPlayer) return null;
    
    const winner = room.players.find(p => p.id !== userId);
    room.status = 'finished';
    room.winner = winner;
    
    this.saveFightHistory(room);
    
    room.players.forEach(p => {
      const user = this.onlineUsers.get(p.id);
      if (user) user.inRoom = null;
    });
    
    this.rooms.delete(roomId);
    
    return {
      room,
      winner,
      leaver: leavingPlayer,
      otherPlayer: winner
    };
  }

  saveFightHistory(room) {
    const player1 = room.players[0]?.username || '';
    const player2 = room.players[1]?.username || '';
    const winner = room.winner?.username || null;
    
    db.run(
      'INSERT INTO fight_history (player1, player2, winner, rounds, date) VALUES (?, ?, ?, ?, datetime("now"))',
      [player1, player2, winner, room.rounds],
      (err) => {
        if (err) {
          console.error('保存对战历史失败:', err);
        }
      }
    );
  }

  getFightHistory(username) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM fight_history 
         WHERE player1 = ? OR player2 = ? 
         ORDER BY date DESC 
         LIMIT 20`,
        [username, username],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }
}

module.exports = new FeihualingService();
