const feihualingService = require('./services/feihualingService');
const { db } = require('./utils/db');
const jwt = require('jsonwebtoken');
const config = require('./config/config');

const JWT_SECRET = config.jwt.secret;

const roomTimers = new Map();

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('新的Socket连接:', socket.id);

    let currentUserId = null;

    // 修改：authenticate 替代 feihualing:login
    socket.on('authenticate', (data) => {
      try {
        const token = data.token;
        if (!token) {
          socket.emit('error', { error: '未提供token' });
          return;
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || !decoded.userId) {
          socket.emit('error', { error: 'token无效' });
          return;
        }
        currentUserId = decoded.userId.toString();

        const onlineUsers = feihualingService.addUser(currentUserId, decoded.username, socket.id);

        // 修改：发送用户信息给前端
        socket.emit('authenticated', {
          userId: currentUserId,
          username: decoded.username
        });

        // 修改：online-users 替代 feihualing:online-users
        socket.emit('online-users', onlineUsers);

        console.log(`用户 ${decoded.username} 加入飞花令在线状态`);
      } catch (error) {
        console.error('登录失败:', error);
        socket.emit('error', { error: '登录失败，请重新登录' });
      }
    });

    // 修改：send-invitation 替代 feihualing:send-invitation
    socket.on('send-invitation', (data) => {
      const targetUserId = data.targetUserId.toString();
      const result = feihualingService.sendInvitation(currentUserId, targetUserId);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      if (result.toSocketId) {
        // 修改：receive-invitation 替代 feihualing:invitation-received
        io.to(result.toSocketId).emit('receive-invitation', {
          inviteId: result.inviteId,
          from: result.from
        });
      }

      // 修改：invitation-sent 替代 feihualing:invitation-sent
      socket.emit('invitation-sent', { success: true });
    });

    // 修改：accept-invitation 替代 feihualing:accept-invitation
    socket.on('accept-invitation', (data) => {
      const inviteId = data.inviteId;
      const inviterId = data.inviterId;
      const result = feihualingService.acceptInvitation(currentUserId, inviteId, inviterId);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      const { room, fromSocketId, toSocketId } = result;

      // 修改：game-start 替代 feihualing:game-started
      if (fromSocketId) {
        io.to(fromSocketId).emit('game-start', { room });
      }

      if (toSocketId) {
        io.to(toSocketId).emit('game-start', { room });
      }

      startTurnTimer(room.id, io);

      // 更新在线用户列表
      const onlineUsers = feihualingService.getOnlineUsers();
      io.emit('online-users', onlineUsers);
    });

    // 修改：reject-invitation 替代 feihualing:decline-invitation
    socket.on('reject-invitation', (data) => {
      const inviteId = data.inviteId;
      const inviterId = data.inviterId;
      const result = feihualingService.rejectInvitation(currentUserId, inviteId, inviterId);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      if (result.fromSocketId) {
        // 修改：invitation-rejected 替代 feihualing:invitation-declined
        io.to(result.fromSocketId).emit('invitation-rejected', {
          inviteId,
          fromUserId: currentUserId
        });
      }

      socket.emit('invitation-rejected', { success: true });
    });

    // 修改：submit-poem 替代 feihualing:submit-answer
    socket.on('submit-poem', async (data) => {
      const { roomId, poem } = data;

      const submitResult = feihualingService.submitAnswer(roomId, currentUserId, poem);

      if (!submitResult.success) {
        socket.emit('error', { error: submitResult.error, isDuplicate: submitResult.isDuplicate });
        return;
      }

      const { room, currentPlayer, normalizedPoem } = submitResult;

      room.players.forEach(player => {
        if (player.socketId) {
          // 修改：validating
          io.to(player.socketId).emit('validating', {
            poem,
            submittedBy: currentPlayer.username
          });
        }
      });

      const isValid = await validatePoem(poem, room.keyword);

      const verifyResult = feihualingService.verifyAnswer(roomId, currentUserId, poem, isValid, normalizedPoem);

      if (!verifyResult) {
        socket.emit('error', { error: '验证失败' });
        return;
      }

      clearTurnTimer(roomId);

      room.players.forEach(player => {
        if (player.socketId) {
          // 修改：poem-submitted 替代 feihualing:answer-result
          io.to(player.socketId).emit('poem-submitted', {
            ...verifyResult,
            submittedBy: currentPlayer.username,
            poem,
            isValid
          });
        }
      });

      if (verifyResult.isCorrect) {
        startTurnTimer(roomId, io);

        socket.emit('answer-correct', {
          nextPlayer: verifyResult.nextPlayer
        });
      } else {
        room.players.forEach(player => {
          if (player.socketId) {
            // 修改：game-result 替代 feihualing:game-ended
            io.to(player.socketId).emit('game-result', {
              winner: verifyResult.winner,
              loser: verifyResult.loser,
              reason: '回答错误',
              totalRounds: room.currentRound
            });
          }
        });
      }
    });

    // 修改：throw-question
    socket.on('throw-question', (data) => {
      const { roomId } = data;

      const result = feihualingService.throwQuestion(roomId, currentUserId);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      const { room, throwCount } = result;

      room.players.forEach(player => {
        if (player.socketId) {
          io.to(player.socketId).emit('question-thrown', {
            thrownBy: currentUserId,
            throwCount: throwCount,
            remainingThrows: result.remainingThrows
          });
        }
      });
    });

    // 修改：game-over
    socket.on('game-over', (data) => {
      const { roomId, winnerId, loserId, reason } = data;

      const result = feihualingService.endGame(roomId, winnerId, loserId, reason);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      clearTurnTimer(roomId);

      room.players.forEach(player => {
        if (player.socketId) {
          io.to(player.socketId).emit('game-result', {
            winner: result.winner,
            loser: result.loser,
            reason: reason,
            totalRounds: room.currentRound
          });
        }
      });
    });

    socket.on('disconnect', () => {
      console.log('Socket断开连接:', socket.id);

      if (currentUserId) {
        const onlineUsers = feihualingService.removeUser(socket.id);

        // 修改：online-users 替代 feihualing:online-users
        io.emit('online-users', onlineUsers);

        // 检查用户是否在游戏中
        const user = feihualingService.getUser(currentUserId);
        if (user && user.inRoom) {
          const room = feihualingService.getRoom(user.inRoom);
          if (room && room.status === 'playing') {
            const result = feihualingService.handleDisconnect(room.id, currentUserId);
            if (result) {
              room.players.forEach(player => {
                if (player.socketId && player.id !== currentUserId) {
                  // 修改：opponent-disconnected
                  io.to(player.socketId).emit('opponent-disconnected', {
                    opponentId: currentUserId,
                    message: '对手已断线'
                  });
                }
              });
            }
          }
        }
      }
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  return io;
}

function startTurnTimer(roomId, io) {
  clearTurnTimer(roomId);

  const room = feihualingService.getRoom(roomId);
  if (!room) return;

  const timer = setInterval(() => {
    const currentRoom = feihualingService.getRoom(roomId);
    if (!currentRoom || currentRoom.status !== 'playing') {
      clearTurnTimer(roomId);
      return;
    }

    const elapsed = Math.floor((Date.now() - currentRoom.turnStartTime) / 1000);
    const remaining = currentRoom.turnTimeLimit - elapsed;

    currentRoom.players.forEach(player => {
      if (player.socketId) {
        io.to(player.socketId).emit('timer-tick', {
          remaining,
          total: currentRoom.turnTimeLimit,
          currentPlayerId: currentRoom.players[currentRoom.currentTurn].id
        });
      }
    });

    if (remaining <= 0) {
      clearTurnTimer(roomId);

      const result = feihualingService.handleTimeout(roomId);
      if (result) {
        currentRoom.players.forEach(player => {
          if (player.socketId) {
            // 修改：game-result
            io.to(player.socketId).emit('game-result', {
              winner: result.winner,
              loser: result.loser,
              reason: result.reason,
              totalRounds: currentRoom.currentRound
            });
          }
        });
      }
    }
  }, 1000);

  roomTimers.set(roomId, timer);
}

function clearTurnTimer(roomId) {
  if (roomTimers.has(roomId)) {
    clearInterval(roomTimers.get(roomId));
    roomTimers.delete(roomId);
  }
}

async function validatePoem(poem, keyword) {
  try {
    const cleanPoem = poem.replace(/[，。！？、；：""''（）【】《》\s]/g, '');

    if (!cleanPoem.includes(keyword)) {
      return false;
    }

    return new Promise((resolve) => {
      const searchTerms = [
        cleanPoem,
        cleanPoem.substring(0, Math.min(cleanPoem.length, 10)),
        cleanPoem.substring(Math.max(0, cleanPoem.length - 10))
      ];

      const searchPromises = searchTerms.map(term => {
        return new Promise((res) => {
          db.get(
            'SELECT * FROM poems WHERE content LIKE ? LIMIT 1',
            [`%${term}%`],
            (err, row) => {
              if (err || !row) {
                res(false);
              } else {
                res(true);
              }
            }
          );
        });
      });

      Promise.any(searchPromises).then((found) => {
        resolve(found);
      }).catch(() => {
        resolve(false);
      });
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
