const feihualingService = require('./services/feihualingService');
const { db } = require('./utils/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-secret-key-change-in-production';

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('新的Socket连接:', socket.id);
    
    let currentUserId = null;

    socket.on('feihualing:login', (data) => {
      try {
        const token = data.token;
        if (!token) {
          socket.emit('feihualing:error', { error: '未提供token' });
          return;
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        currentUserId = decoded.id.toString();
        
        const onlineUsers = feihualingService.addUser(currentUserId, decoded.username, socket.id);
        
        socket.emit('feihualing:online-users', { users: onlineUsers });
        io.emit('feihualing:user-joined', { 
          user: { id: currentUserId, username: decoded.username, inRoom: null } 
        });
        
        console.log(`用户 ${decoded.username} 加入飞花令在线状态`);
      } catch (error) {
        console.error('登录失败:', error);
        socket.emit('feihualing:error', { error: '登录失败' });
      }
    });

    socket.on('feihualing:get-online-users', () => {
      const users = feihualingService.getOnlineUsers();
      socket.emit('feihualing:online-users', { users });
    });

    socket.on('feihualing:send-invitation', (data) => {
      const toUserId = data.toUserId.toString();
      const result = feihualingService.sendInvitation(currentUserId, toUserId);
      
      if (!result.success) {
        socket.emit('feihualing:error', { error: result.error });
        return;
      }
      
      if (result.toSocketId) {
        io.to(result.toSocketId).emit('feihualing:invitation-received', {
          from: result.from
        });
      }
      
      socket.emit('feihualing:invitation-sent', { success: true });
    });

    socket.on('feihualing:accept-invitation', () => {
      const result = feihualingService.acceptInvitation(currentUserId);
      
      if (!result.success) {
        socket.emit('feihualing:error', { error: result.error });
        return;
      }
      
      const { room, fromSocketId, toSocketId } = result;
      
      if (fromSocketId) {
        io.to(fromSocketId).emit('feihualing:game-started', { room });
      }
      
      if (toSocketId) {
        io.to(toSocketId).emit('feihualing:game-started', { room });
      }
      
      const users = feihualingService.getOnlineUsers();
      io.emit('feihualing:online-users', { users });
    });

    socket.on('feihualing:decline-invitation', () => {
      const result = feihualingService.declineInvitation(currentUserId);
      
      if (!result.success) {
        socket.emit('feihualing:error', { error: result.error });
        return;
      }
      
      if (result.fromSocketId) {
        io.to(result.fromSocketId).emit('feihualing:invitation-declined');
      }
      
      socket.emit('feihualing:invitation-declined', { success: true });
    });

    socket.on('feihualing:submit-answer', async (data) => {
      const { roomId, poem } = data;
      
      const submitResult = feihualingService.submitAnswer(roomId, currentUserId, poem);
      
      if (!submitResult.success) {
        socket.emit('feihualing:error', { error: submitResult.error });
        return;
      }
      
      const { room, currentPlayer } = submitResult;
      
      const isValid = await validatePoem(poem, room.keyword);
      
      const verifyResult = feihualingService.verifyAnswer(roomId, currentUserId, poem, isValid);
      
      if (!verifyResult) {
        socket.emit('feihualing:error', { error: '验证失败' });
        return;
      }
      
      room.players.forEach(player => {
        if (player.socketId) {
          io.to(player.socketId).emit('feihualing:answer-result', {
            ...verifyResult,
            submittedBy: currentPlayer.username,
            poem
          });
        }
      });
      
      if (verifyResult.isCorrect) {
        socket.emit('feihualing:answer-correct', {
          nextPlayer: verifyResult.nextPlayer
        });
      } else {
        socket.emit('feihualing:game-ended', {
          winner: verifyResult.winner
        });
      }
    });

    socket.on('feihualing:leave-game', (data) => {
      const { roomId } = data;
      const result = feihualingService.leaveRoom(roomId, currentUserId);
      
      if (!result) {
        socket.emit('feihualing:error', { error: '离开房间失败' });
        return;
      }
      
      if (result.otherPlayer && result.otherPlayer.socketId) {
        io.to(result.otherPlayer.socketId).emit('feihualing:opponent-left', {
          winner: result.winner
        });
      }
      
      socket.emit('feihualing:left-game', { success: true });
      
      const users = feihualingService.getOnlineUsers();
      io.emit('feihualing:online-users', { users });
    });

    socket.on('disconnect', () => {
      console.log('Socket断开连接:', socket.id);
      
      if (currentUserId) {
        const onlineUsers = feihualingService.removeUser(socket.id);
        io.emit('feihualing:user-left', { userId: currentUserId });
        io.emit('feihualing:online-users', { users: onlineUsers });
      }
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });
  });
  
  return io;
}

async function validatePoem(poem, keyword) {
  try {
    return new Promise((resolve) => {
      db.get(
        'SELECT * FROM poems WHERE content LIKE ? LIMIT 1',
        [`%${poem}%`],
        (err, row) => {
          if (err || !row) {
            resolve(false);
          } else {
            const containsKeyword = poem.includes(keyword);
            resolve(containsKeyword);
          }
        }
      );
    });
  } catch (error) {
    console.error('验证诗句失败:', error);
    return false;
  }
}

function emitToUser(userId, event, data) {
  return false;
}

function broadcast(event, data) {
  if (global.io) {
    global.io.emit(event, data);
  }
}

module.exports = setupSocket;
module.exports.emitToUser = emitToUser;
module.exports.broadcast = broadcast;
