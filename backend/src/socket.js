const feihualingService = require('./services/feihualingService');
const challengeBattleService = require('./services/challengeBattleService');
const { evaluateFeihuaPoem } = require('./services/aiService');
const jwt = require('jsonwebtoken');
const config = require('./config/config');

const JWT_SECRET = config.jwt.secret;

const roomTimers = new Map();

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
      try {
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
      } catch (err) {
        console.error('[Feihua] 提交诗句失败:', err);
        socket.emit('error', { error: '提交诗句失败，请重试' });
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

      }
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });

    // ==============================================================
    // 诗词闯关对战 - 简化为单人练习模式（本地出题，无AI）
    // ==============================================================

    // 开始闯关对战
    socket.on('challenge-start', async (data) => {
      try {
        if (!currentUserId) {
          socket.emit('error', { error: '未登录' });
          return;
        }

        const room = await challengeBattleService.startGame(currentUserId, data.username || '玩家');
        socket.emit('challenge-started', {
          roomId: room.id,
          currentQuestion: room.questions[0],
          currentRound: 1
        });
      } catch (err) {
        console.error('[Challenge] 开始游戏失败:', err);
        socket.emit('error', { error: '开始游戏失败' });
      }
    });

    // 提交答案
    socket.on('challenge-answer', async (data) => {
      try {
        const { roomId, answer } = data;
        const submitResult = challengeBattleService.submitAnswer(roomId, currentUserId, answer);

        if (!submitResult.success) {
          socket.emit('error', { error: submitResult.error });
          return;
        }

        const { isCorrect, correctAnswer, question, room } = submitResult;

        socket.emit('challenge-answer-result', {
          isCorrect,
          submittedAnswer: answer,
          correctAnswer: correctAnswer,
          question: question
        });

        setTimeout(async () => {
          const nextResult = await challengeBattleService.nextQuestion(roomId);

          if (nextResult.type === 'finished') {
            const finishedRoom = challengeBattleService.getRoom(roomId);
            if (finishedRoom) {
              challengeBattleService.saveBattleRecord(finishedRoom);
            }

            socket.emit('challenge-finished', {
              type: 'finished',
              reason: nextResult.reason,
              totalQuestions: nextResult.totalQuestions,
              correctCount: nextResult.correctCount,
              wrongCount: nextResult.wrongCount,
              questions: nextResult.questions,
              wrongQuestions: nextResult.wrongQuestions,
              players: nextResult.resultPlayers
            });
          } else if (nextResult.success) {
            socket.emit('challenge-next', {
              question: nextResult.question,
              currentRound: nextResult.currentRound,
              correctCount: nextResult.correctCount,
              wrongCount: nextResult.wrongCount
            });
          }
        }, 800);
      } catch (err) {
        console.error('[Challenge] 提交答案失败:', err);
        socket.emit('error', { error: '提交答案失败' });
      }
    });

    // 超时处理
    socket.on('challenge-timeout', async (data) => {
      try {
        const { roomId } = data;
        const room = challengeBattleService.getRoom(roomId);
        if (!room || room.status !== 'playing') return;

        const submitResult = challengeBattleService.submitAnswer(roomId, currentUserId, '__TIMEOUT__');

        if (submitResult.isCorrect === false) {
          const nextResult = await challengeBattleService.nextQuestion(roomId);

          if (nextResult.type === 'finished') {
            challengeBattleService.saveBattleRecord(room);
            socket.emit('challenge-finished', {
              type: 'finished',
              reason: 'timeout',
              totalQuestions: nextResult.totalQuestions,
              correctCount: nextResult.correctCount,
              wrongCount: nextResult.wrongCount,
              questions: nextResult.questions,
              wrongQuestions: nextResult.wrongQuestions,
              players: nextResult.resultPlayers
            });
          } else if (nextResult.success) {
            socket.emit('challenge-timeouted', {
              correctAnswer: submitResult.correctAnswer,
              question: nextResult.question,
              currentRound: nextResult.currentRound,
              correctCount: nextResult.correctCount,
              wrongCount: nextResult.wrongCount
            });
          }
        }
      } catch (err) {
        console.error('[Challenge] 超时处理失败:', err);
      }
    });

    // 获取对战历史
    socket.on('challenge-history', async (data) => {
      try {
        if (!currentUserId) return;
        const history = await challengeBattleService.getBattleHistory(parseInt(currentUserId));
        socket.emit('challenge-history-result', { history });
      } catch (err) {
        console.error('[Challenge] 获取历史失败:', err);
      }
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
