const feihualingService = require('./services/feihualingService');
const challengeBattleService = require('./services/challengeBattleService');
const { evaluateFeihuaPoem } = require('./services/aiService');
const jwt = require('jsonwebtoken');
const config = require('./config/config');

const JWT_SECRET = config.jwt.secret;

const roomTimers = new Map();
const duelTimers = new Map();

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('[Socket] 新的Socket连接:', socket.id);

    let currentUserId = null;

    // 认证
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

        socket.emit('authenticated', {
          userId: currentUserId,
          username: decoded.username
        });

        // 广播给所有客户端，保证其他玩家能及时看到新上线的用户
        io.emit('online-users', onlineUsers);

        console.log(`[Socket] 用户 ${decoded.username} 加入飞花令在线状态`);
      } catch (error) {
        console.error('[Socket] 登录失败:', error);
        socket.emit('error', { error: '登录失败，请重新登录' });
      }
    });

    // 获取难度和令字配置
    socket.on('get-game-config', () => {
      const keywords = feihualingService.getRecommendedKeywords();
      const difficulties = Object.entries(feihualingService.DIFFICULTY_CONFIG).map(([key, val]) => ({
        level: key,
        name: val.name,
        timeLimit: val.timeLimit,
        throwCount: val.throwCount
      }));
      socket.emit('game-config', { keywords, difficulties });
    });

    // 发送邀请
    socket.on('send-invitation', (data) => {
      const targetUserId = data.targetUserId.toString();
      const keyword = data.keyword || '花';
      const difficulty = data.difficulty || 'medium';

      const result = feihualingService.sendInvitation(currentUserId, targetUserId, keyword, difficulty);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      if (result.toSocketId) {
        io.to(result.toSocketId).emit('receive-invitation', {
          inviteId: result.invitationId,
          from: result.from,
          keyword: result.keyword,
          difficulty: result.difficulty
        });
      }

      socket.emit('invitation-sent', { success: true });
    });

    // 接受邀请
    socket.on('accept-invitation', (data) => {
      const { inviteId, inviterId, keyword, difficulty } = data;
      const result = feihualingService.acceptInvitation(currentUserId, inviteId, inviterId, keyword, difficulty);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      const { room, fromSocketId, toSocketId } = result;

      // 给双方发送 game-start，包含完整房间信息
      const gameStartPayload = {
        room: {
          id: room.id,
          keyword: room.keyword,
          difficulty: room.difficulty,
          difficultyName: room.difficultyName,
          players: room.players.map(p => ({
            id: p.id,
            userId: p.id,
            username: p.username,
            score: p.score,
            throwCount: p.throwCount,
            remainingThrows: p.remainingThrows
          })),
          currentTurn: room.currentTurn,
          currentRound: room.currentRound,
          usedPoems: room.usedPoems,
          turnTimeLimit: room.turnTimeLimit
        }
      };

      if (fromSocketId) {
        io.to(fromSocketId).emit('game-start', gameStartPayload);
      }

      if (toSocketId) {
        io.to(toSocketId).emit('game-start', gameStartPayload);
      }

      startTurnTimer(room.id, io);

      // 更新在线用户列表
      const onlineUsers = feihualingService.getOnlineUsers();
      io.emit('online-users', onlineUsers);
    });

    // 主动拉取在线列表（返回大厅等场景）
    socket.on('feihualing:get-online-users', () => {
      if (!currentUserId) return;
      socket.emit('online-users', feihualingService.getOnlineUsers());
    });

    // 拒绝邀请
    socket.on('reject-invitation', (data) => {
      const { inviteId, inviterId } = data;
      const result = feihualingService.rejectInvitation(currentUserId, inviteId, inviterId);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      if (result.fromSocketId) {
        io.to(result.fromSocketId).emit('invitation-rejected', {
          inviteId,
          fromUserId: currentUserId
        });
      }

      // 拒绝后刷新所有人的在线列表（邀请方需要看到对方不再"忙碌"）
      io.emit('online-users', feihualingService.getOnlineUsers());
      socket.emit('invitation-rejected', { success: true });
    });

    // 取消邀请（邀请方主动撤消）
    socket.on('cancel-invitation', () => {
      feihualingService.cancelInvitation(currentUserId);
      socket.emit('invitation-cancelled');
      io.emit('online-users', feihualingService.getOnlineUsers());
    });

    // 提交诗句（使用AI评判）
    socket.on('submit-poem', async (data) => {
      const { roomId, poem } = data;

      const submitResult = feihualingService.submitAnswer(roomId, currentUserId, poem);

      if (!submitResult.success) {
        socket.emit('error', { error: submitResult.error, isDuplicate: submitResult.isDuplicate });
        return;
      }

      const { room, currentPlayer, normalizedPoem } = submitResult;

      // 获取已用诗句的原始格式列表（用于AI判断重复）
      const usedPoemTexts = room.usedPoems.map(p => p.original || p.normalized);

      // 向双方发送正在验证中的状态
      room.players.forEach(player => {
        if (player.socketId) {
          io.to(player.socketId).emit('validating', {
            poem,
            submittedBy: currentPlayer.username,
            round: room.currentRound
          });
        }
      });

      // 调用AI评判诗句
      let aiResult = await evaluateFeihuaPoem(
        poem,
        room.keyword,
        room.difficulty || 'medium',
        usedPoemTexts
      );

      // 服务端强制校验令字，避免模型误判导致错误放行
      const keywordOk = normalizedPoem.includes(room.keyword);
      if (!keywordOk) {
        aiResult = {
          isValid: false,
          score: 0,
          reason: `诗句中未包含令字「${room.keyword}」`,
          poemInfo: { title: null, author: null }
        };
      }

      clearTurnTimer(roomId);

      const verifyResult = feihualingService.verifyAnswer(roomId, currentUserId, poem, aiResult, normalizedPoem);

      if (!verifyResult) {
        socket.emit('error', { error: '验证失败' });
        return;
      }

      if (verifyResult.isCorrect) {
        // 诗句有效，继续游戏
        room.players.forEach(player => {
          if (player.socketId) {
            io.to(player.socketId).emit('poem-submitted', {
              ...verifyResult,
              submittedBy: currentPlayer.username,
              poem,
              aiResult,
              isValid: true
            });
          }
        });

        // 重新启动回合计时器
        startTurnTimer(roomId, io);
      } else {
        // 诗句无效，游戏结束
        room.players.forEach(player => {
          if (player.socketId) {
            io.to(player.socketId).emit('game-result', {
              winner: verifyResult.winner,
              loser: verifyResult.loser,
              reason: verifyResult.reason,
              totalRounds: verifyResult.totalRounds,
              usedPoems: verifyResult.usedPoems,
              players: verifyResult.players,
              aiResult,
              poem
            });
          }
        });
      }
    });

    // 扔题
    socket.on('throw-question', (data) => {
      const { roomId } = data;

      const result = feihualingService.throwQuestion(roomId, currentUserId);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      const { room, remainingThrows } = result;

      room.players.forEach(player => {
        if (player.socketId) {
          io.to(player.socketId).emit('question-thrown', {
            thrownBy: currentUserId,
            thrownByName: room.players.find(p => p.id === currentUserId)?.username,
            throwCount: room.players.find(p => p.id === currentUserId)?.throwCount,
            remainingThrows,
            currentTurn: result.currentTurn,
            players: result.players,
            nextPlayer: result.nextPlayer
          });
        }
      });

      // 重启计时器
      startTurnTimer(roomId, io);
    });

    // 手动结束游戏
    socket.on('game-over', (data) => {
      const { roomId, winnerId, loserId, reason } = data;

      const result = feihualingService.endGame(roomId, winnerId, loserId, reason);

      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      clearTurnTimer(roomId);

      // endGame 中已将 room 从 rooms Map 删除，players 通过 result.players 传入
      result.players.forEach(player => {
        if (player.socketId) {
          io.to(player.socketId).emit('game-result', {
            winner: result.winner,
            loser: result.loser,
            reason: reason,
            totalRounds: result.totalRounds,
            usedPoems: result.usedPoems,
            players: result.players,
            currentRound: result.totalRounds
          });
        }
      });
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log('[Socket] Socket断开连接:', socket.id);

      if (currentUserId) {
        // 处理飞花令断线
        const onlineUsers = feihualingService.removeUser(socket.id);
        io.emit('online-users', onlineUsers);

        const user = feihualingService.getUser(currentUserId);
        if (user && user.inGame) {
          const roomId = user.inGame;
          const room = feihualingService.getRoom(roomId);
          if (room && room.status === 'playing') {
            const result = feihualingService.handleDisconnect(roomId, currentUserId);
            if (result) {
              // 使用 result.players 而非 room.players（endGame 中 room 已从 Map 删除）
              result.players.forEach(player => {
                if (player.socketId && player.id !== currentUserId) {
                  io.to(player.socketId).emit('opponent-disconnected', {
                    opponentId: currentUserId,
                    opponentName: result.loser?.username,
                    winner: { userId: result.winner.id, username: result.winner.username },
                    message: '对手已断线，你获胜！',
                    reason: result.reason,
                    currentRound: result.totalRounds
                  });
                }
              });
            }
          }
        }

        // 处理闯关对战断线
        const challengeUsers = challengeBattleService.removeUser(socket.id);
        io.emit('challenge-online-users', challengeUsers);

        const challengeUser = challengeBattleService.getUser(currentUserId);
        if (challengeUser && challengeUser.inGame) {
          const roomId = challengeUser.inGame;
          const room = challengeBattleService.getRoom(roomId);
          if (room && room.status === 'playing') {
            clearDuelTimer(roomId);
            const result = challengeBattleService.handleDisconnect(roomId, currentUserId);
            if (result) {
              room.players.forEach(p => {
                if (p.socketId && p.id !== currentUserId) {
                  io.to(p.socketId).emit('challenge-result', {
                    type: 'finished',
                    winner: { id: result.winner.id, username: result.winner.username, correct: result.winner.correct, wrong: result.winner.wrong },
                    loser: { id: result.loser.id, username: result.loser.username, correct: result.loser.correct, wrong: result.loser.wrong },
                    reason: 'disconnected',
                    totalQuestions: room.questions.length,
                    players: room.players.map(p2 => ({ id: p2.id, username: p2.username, correct: p2.correct, wrong: p2.wrong })),
                    questions: room.questions
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

    // ==============================================================
    // 诗词闯关对战 - Socket事件
    // ==============================================================

    // 加入闯关对战在线列表
    socket.on('challenge-auth', (data) => {
      try {
        const token = data.token;
        if (!token) { socket.emit('error', { error: '未提供token' }); return; }
        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || !decoded.userId) { socket.emit('error', { error: 'token无效' }); return; }
        currentUserId = decoded.userId.toString();
        const onlineUsers = challengeBattleService.addUser(currentUserId, decoded.username, socket.id);
        socket.emit('challenge-authenticated', { userId: currentUserId, username: decoded.username });
        socket.emit('challenge-online-users', onlineUsers);
        console.log(`[Challenge] 用户 ${decoded.username} 加入闯关对战在线列表`);
      } catch (error) {
        console.error('[Challenge] 认证失败:', error);
        socket.emit('error', { error: '登录失败，请重新登录' });
      }
    });

    // 获取在线用户
    socket.on('challenge-get-users', () => {
      const users = challengeBattleService.getOnlineUsers();
      socket.emit('challenge-online-users', users);
    });

    // 发送闯关对战邀请
    socket.on('challenge-invite', (data) => {
      const targetUserId = data.targetUserId.toString();
      const result = challengeBattleService.sendInvitation(currentUserId, targetUserId);
      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }
      if (result.toSocketId) {
        io.to(result.toSocketId).emit('challenge-receive-invite', {
          inviteId: result.invitationId,
          from: result.from
        });
      }
      socket.emit('challenge-invite-sent', { success: true });
    });

    // 接受闯关对战邀请
    socket.on('challenge-accept', async (data) => {
      const { inviteId, inviterId } = data;
      const result = await challengeBattleService.acceptInvitation(currentUserId, inviteId, inviterId);
      if (!result.success) {
        socket.emit('error', { error: result.error });
        return;
      }

      const { room, fromSocketId, toSocketId } = result;

      const startPayload = {
        room: buildDuelRoomPayload(room)
      };

      if (fromSocketId) io.to(fromSocketId).emit('challenge-start', startPayload);
      if (toSocketId) io.to(toSocketId).emit('challenge-start', startPayload);

      startDuelTimer(room.id, io);

      const onlineUsers = challengeBattleService.getOnlineUsers();
      io.emit('challenge-online-users', onlineUsers);
    });

    // 拒绝闯关对战邀请
    socket.on('challenge-reject', (data) => {
      const { inviteId, inviterId } = data;
      const result = challengeBattleService.rejectInvitation(currentUserId, inviteId, inviterId);
      if (!result.success) return;
      if (result.fromSocketId) {
        io.to(result.fromSocketId).emit('challenge-invite-rejected', { inviteId });
      }
    });

    // 取消邀请
    socket.on('challenge-cancel-invite', () => {
      // 清除待处理邀请
    });

    // 提交闯关对战答案
    socket.on('challenge-answer', async (data) => {
      const { roomId, answer } = data;

      const submitResult = await challengeBattleService.submitAnswer(roomId, currentUserId, answer);
      if (!submitResult.success) {
        socket.emit('error', { error: submitResult.error });
        return;
      }

      const { room, currentQuestion, isCorrect, submittedAnswer, submitter, opponent } = submitResult;

      // 向双方发送验证中状态
      room.players.forEach(p => {
        if (p.socketId) {
          io.to(p.socketId).emit('challenge-validating', {
            answer,
            submittedBy: submitter.username,
            round: room.currentRound
          });
        }
      });

      // 处理答题结果
      const processResult = await challengeBattleService.processAnswerResult(roomId, currentUserId, submitResult);

      clearDuelTimer(roomId);

      if (processResult.type === 'correct') {
        // 正确：向双方广播下一题
        const payload = {
          type: 'correct',
          submittedAnswer,
          currentQuestion: processResult.currentQuestion,
          currentRound: processResult.currentRound,
          players: processResult.players,
          currentTurn: processResult.currentTurn,
          nextPlayer: processResult.nextPlayer
        };
        room.players.forEach(p => {
          if (p.socketId) io.to(p.socketId).emit('challenge-next', payload);
        });
        startDuelTimer(roomId, io);
      } else {
        // 结束：向双方广播结果
        const resultPayload = {
          type: 'finished',
          winner: processResult.winner,
          loser: processResult.loser,
          reason: processResult.reason,
          totalQuestions: processResult.totalQuestions,
          players: processResult.players,
          questions: processResult.questions
        };
        room.players.forEach(p => {
          if (p.socketId) io.to(p.socketId).emit('challenge-result', resultPayload);
        });
      }
    });
  });

  return io;
}

function buildDuelRoomPayload(room) {
  return {
    id: room.id,
    players: room.players.map(p => ({
      id: p.id,
      username: p.username,
      correct: p.correct,
      wrong: p.wrong
    })),
    currentTurn: room.currentTurn,
    currentRound: room.currentRound,
    currentQuestion: room.questions[room.questions.length - 1],
    turnTimeLimit: room.turnTimeLimit
  };
}

function startDuelTimer(roomId, io) {
  clearDuelTimer(roomId);

  const room = challengeBattleService.getRoom(roomId);
  if (!room) return;

  const timer = setInterval(() => {
    const currentRoom = challengeBattleService.getRoom(roomId);
    if (!currentRoom || currentRoom.status !== 'playing') {
      clearDuelTimer(roomId);
      return;
    }

    const elapsed = Math.floor((Date.now() - currentRoom.turnStartTime) / 1000);
    const remaining = currentRoom.turnTimeLimit - elapsed;

    currentRoom.players.forEach(player => {
      if (player.socketId) {
        io.to(player.socketId).emit('challenge-timer-tick', {
          remaining,
          total: currentRoom.turnTimeLimit,
          currentPlayerId: currentRoom.players[currentRoom.currentTurn].id,
          currentTurn: currentRoom.currentTurn,
          currentRound: currentRoom.currentRound,
          players: currentRoom.players.map(p => ({
            id: p.id,
            username: p.username,
            correct: p.correct,
            wrong: p.wrong
          }))
        });
      }
    });

    if (remaining <= 0) {
      clearDuelTimer(roomId);
      const result = challengeBattleService.handleTimeout(roomId);
      if (result) {
        currentRoom.players.forEach(p => {
          if (p.socketId) {
            io.to(p.socketId).emit('challenge-result', {
              type: 'finished',
              winner: result.winner,
              loser: result.loser,
              reason: result.reason,
              totalQuestions: result.totalQuestions,
              players: result.players,
              questions: result.questions
            });
          }
        });
      }
    }
  }, 1000);

  duelTimers.set(roomId, timer);
}

function clearDuelTimer(roomId) {
  if (duelTimers.has(roomId)) {
    clearInterval(duelTimers.get(roomId));
    duelTimers.delete(roomId);
  }
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
          currentPlayerId: currentRoom.players[currentRoom.currentTurn].id,
          currentRound: currentRoom.currentRound,
          usedPoemsCount: currentRoom.usedPoems.length
        });
      }
    });

    if (remaining <= 0) {
      clearTurnTimer(roomId);

      const result = feihualingService.handleTimeout(roomId);
      if (result) {
        currentRoom.players.forEach(player => {
          if (player.socketId) {
            io.to(player.socketId).emit('game-result', {
              winner: result.winner,
              loser: result.loser,
              reason: result.reason,
              totalRounds: result.totalRounds,
              usedPoems: currentRoom.usedPoems,
              players: result.players,
              currentRound: result.totalRounds
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
