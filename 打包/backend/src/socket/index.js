// Socket.io 核心逻辑
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { db } = require('../utils/db');
const feihuaRankingService = require('../services/feihuaRankingService');

// 在线用户管理
const onlineUsers = new Map();

// 邀请管理
const invitations = new Map();

// 游戏房间管理
const gameRooms = new Map();

// 飞花令关键字列表（只包含数据库中已有的关键字，确保判题准确）
const FEIHUA_KEYWORDS = [
  '春', '月', '花', '山', '水', '风', '雪', '云',
  '酒', '愁', '江', '河', '日', '夜', '心', '人',
  '天', '鸟', '雨', '秋', '梅', '柳', '松', '竹',
  '桃', '光'
];

// 填空题题库（与 poetryQuestions.json 同步）
const POETRY_QUESTIONS = require('../data/poetryQuestions.json');

// 生成唯一ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// 生成指定数量的填空题（随机打乱，不重复）
function generateQuestions(count) {
  const shuffled = [...POETRY_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(q => ({
    question: q.question,
    answer: q.answer,
    poem: q.poem,
    author: q.author
  }));
}

// 清理房间并重置玩家状态
function cleanUpRoom(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;

  gameRooms.delete(roomId);

  for (const player of room.players) {
    const user = onlineUsers.get(player.userId);
    if (user) user.inGame = false;
  }

  // 延迟广播，等 io 可用
  setTimeout(() => broadcastOnlineUsers(io), 50);
}

// 验证JWT token
function verifyToken(token) {
  if (!token) return null;
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    return {
      userId: decoded.userId || decoded.id,
      username: decoded.username,
      role: decoded.role
    };
  } catch (error) {
    console.error('Token验证失败:', error.message);
    return null;
  }
}

// 获取用户班级信息
async function getUserClassInfo(userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT u.id, u.username, u.class_id, 
              COALESCE(fhr.max_rounds, 0) as max_rounds
       FROM users u
       LEFT JOIN feihua_high_records fhr ON u.id = fhr.user_id
       WHERE u.id = ?`,
      [userId],
      (err, row) => {
        if (err) {
          console.error('获取用户信息失败:', err);
          resolve(null);
        } else {
          resolve(row);
        }
      }
    );
  });
}

// 广播在线用户列表
async function broadcastOnlineUsers(io) {
  const users = [];
  
  for (const [userId, user] of onlineUsers.entries()) {
    const classInfo = await getUserClassInfo(userId);
    users.push({
      userId: user.userId,
      username: user.username,
      classId: classInfo?.class_id || null,
      maxRounds: classInfo?.max_rounds || 0,
      inGame: user.inGame || false
    });
  }
  
  io.emit('online-list-update', users);
}

// 保存对战记录
async function saveBattleRecord(room, winnerId, loserId, isRankingMatch = false) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const battleHistory = JSON.stringify({
      keyword: room.keyword,
      difficulty: room.difficulty,
      isRanking: isRankingMatch,
      usedPoems: room.usedPoems,
      totalRounds: room.currentQuestionIndex + 1
    });
    
    // 保存对战记录
    db.run(
      `INSERT INTO feihua_battles
       (player1_id, player2_id, keyword, winner_id, loser_id, total_rounds,
        battle_history, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        room.players[0].userId,
        room.players[1].userId,
        room.keyword || '填空对战',
        winnerId,
        loserId,
        room.currentQuestionIndex + 1,
        battleHistory,
        new Date(room.startTime).toISOString(),
        now
      ],
      async (err) => {
        if (err) {
          console.error('保存对战记录失败:', err);
          reject(err);
          return;
        }
        
        // 更新用户最高记录
        updateHighRecords(room, winnerId, loserId);
        
        // 仅在排位赛模式且设置了标识时更新排位分
        if (isRankingMatch && room.isRanking) {
          try {
            await feihuaRankingService.updateRankingAfterBattle(winnerId, loserId);
            console.log(`[排位赛] 更新排位数据: 胜者 ${winnerId}, 败者 ${loserId}`);
          } catch (rankingErr) {
            console.error('[排位赛] 更新排位数据失败:', rankingErr);
          }
        } else {
          console.log(`[飞花令] 普通对战记录已保存，不计入排位（isRanking=${room.isRanking}, flag=${isRankingMatch}）`);
        }
        
        resolve();
      }
    );
  });
}

// 更新用户最高记录
async function updateHighRecords(room, winnerId, loserId) {
  const now = new Date().toISOString();
  
  // 更新获胜者记录
  db.run(
    `INSERT INTO feihua_high_records (user_id, keyword, max_rounds, total_battles, wins, losses, updated_at)
     VALUES (?, ?, ?, 1, 1, 0, ?)
     ON CONFLICT(user_id, keyword) DO UPDATE SET
       max_rounds = MAX(max_rounds, ?),
       total_battles = total_battles + 1,
       wins = wins + 1,
       updated_at = ?`,
    [winnerId, room.keyword || '填空对战', room.currentQuestionIndex + 1, now, room.currentQuestionIndex + 1, now],
    (err) => {
      if (err) console.error('更新获胜者记录失败:', err);
    }
  );

  // 更新失败者记录
  db.run(
    `INSERT INTO feihua_high_records (user_id, keyword, max_rounds, total_battles, wins, losses, updated_at)
     VALUES (?, ?, ?, 1, 0, 1, ?)
     ON CONFLICT(user_id, keyword) DO UPDATE SET
       max_rounds = MAX(max_rounds, ?),
       total_battles = total_battles + 1,
       losses = losses + 1,
       updated_at = ?`,
    [loserId, room.keyword || '填空对战', room.currentQuestionIndex + 1, now, room.currentQuestionIndex + 1, now],
    (err) => {
      if (err) console.error('更新失败者记录失败:', err);
    }
  );
}

// 设置Socket.io
function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('新用户连接:', socket.id);
    
    // 身份验证
    socket.on('authenticate', async (data) => {
      const { token } = data;
      const user = verifyToken(token);
      
      if (user) {
        // 获取用户班级信息
        const classInfo = await getUserClassInfo(user.userId);
        
        // 将用户加入在线列表
        onlineUsers.set(user.userId, {
          ...user,
          socketId: socket.id,
          classId: classInfo?.class_id || null,
          maxRounds: classInfo?.max_rounds || 0,
          inGame: false
        });
        
        // 存储用户信息到socket
        socket.userId = user.userId;
        
        console.log('用户认证成功:', user.username, '班级:', classInfo?.class_id);
        
        // 发送用户ID给当前连接的客户端
        socket.emit('init', { 
          userId: String(user.userId),
          username: user.username,
          classId: classInfo?.class_id || null
        });
        
        // 广播在线用户列表
        await broadcastOnlineUsers(io);
      } else {
        console.log('用户认证失败');
        socket.emit('error', { message: '认证失败，请重新登录' });
        socket.disconnect();
      }
    });

    // 刷新在线用户列表
    socket.on('refresh-online-users', async () => {
      await broadcastOnlineUsers(io);
      console.log(`用户 ${socket.userId} 刷新了在线用户列表`);
    });
    
    // 发送邀请
    socket.on('send-invitation', async (data) => {
      const { targetUserId, keyword, difficulty } = data;
      const inviter = onlineUsers.get(socket.userId);
      
      if (!inviter) {
        socket.emit('error', { message: '未认证用户' });
        return;
      }
      
      // 确保 targetUserId 是数字类型
      const actualTargetUserId = Number(targetUserId);
      const targetUser = onlineUsers.get(actualTargetUserId);
      if (!targetUser) {
        socket.emit('error', { message: '目标用户不在线' });
        return;
      }
      
      if (targetUser.inGame) {
        socket.emit('error', { message: '目标用户正在游戏中' });
        return;
      }
      
      // 生成邀请ID
      const inviteId = generateId();

      // 存储邀请信息（令字在accept时再随机生成，保持一致性）
      invitations.set(inviteId, {
        inviterId: socket.userId,
        inviterName: inviter.username,
        inviterClassId: inviter.classId,
        inviterMaxRounds: inviter.maxRounds,
        targetId: actualTargetUserId,
        keyword: keyword, // 让邀请方选择或留空
        difficulty: difficulty,
        timestamp: Date.now()
      });
      
      // 向目标用户发送邀请
      io.to(targetUser.socketId).emit('receive-invitation', {
        inviteId,
        inviterId: inviter.userId,
        inviterName: inviter.username,
        inviterClassId: inviter.classId,
        inviterMaxRounds: inviter.maxRounds,
        keyword: keyword || '待定（接受后随机）', // 提示待定
        difficulty: difficulty
      });

      const savedInvitation = invitations.get(inviteId);
      socket.emit('invitation-sent', {
        inviteId,
        keyword: savedInvitation ? savedInvitation.keyword : (keyword || '随机'),
        difficulty: difficulty
      });

      console.log(`${inviter.username} 邀请 ${targetUser.username} 进行飞花令对战，令字: ${keyword || '随机'}`);
    });
    
    // 接受邀请
    socket.on('accept-invitation', async (data) => {
      const { inviteId, inviterId, keyword, difficulty } = data;
      const invitation = invitations.get(inviteId);
      
      if (!invitation) {
        socket.emit('error', { message: '邀请不存在或已过期' });
        return;
      }
      
      // 使用 invitation 中存储的 inviterId（确保类型一致），同时兼容前端传递的值
      const actualInviterId = invitation.inviterId || Number(inviterId);
      const inviter = onlineUsers.get(actualInviterId);
      const acceptor = onlineUsers.get(socket.userId);
      
      console.log(`[accept-invitation] inviterId=${actualInviterId}, socket.userId=${socket.userId}`);
      console.log(`[accept-invitation] inviter exists=${!!inviter}, acceptor exists=${!!acceptor}`);
      console.log(`[accept-invitation] onlineUsers keys:`, [...onlineUsers.keys()]);
      
      if (!inviter || !acceptor) {
        socket.emit('error', { message: '用户不在线' });
        return;
      }
      
      // 生成房间ID
      const roomId = generateId();
      
      // 确定令字：优先使用邀请时指定的，否则随机生成
      const finalKeyword = (invitation.keyword && invitation.keyword !== '待定（接受后随机）')
        ? invitation.keyword
        : FEIHUA_KEYWORDS[Math.floor(Math.random() * FEIHUA_KEYWORDS.length)];
      
      // 判断是否为排位赛：邀请中的 difficulty 为 'ranking' 时开启排位
      const isRankingMode = invitation.difficulty === 'ranking';
      
      // 创建游戏房间
      const questions = generateQuestions(30);

      gameRooms.set(roomId, {
        players: [
          {
            userId: actualInviterId,
            username: inviter.username,
            classId: inviter.classId,
            score: 0,
            correctAnswers: 0,
            wrongAnswers: 0
          },
          {
            userId: socket.userId,
            username: acceptor.username,
            classId: acceptor.classId,
            score: 0,
            correctAnswers: 0,
            wrongAnswers: 0
          }
        ],
        keyword: finalKeyword,
        difficulty: invitation.difficulty,
        isRanking: isRankingMode,
        currentTurn: 0,
        currentRound: 1,
        questions: questions,
        currentQuestionIndex: 0,
        usedPoems: [],
        status: 'active',
        startTime: Date.now(),
        timeLimit: 30
      });

      // 标记用户正在游戏中
      inviter.inGame = true;
      acceptor.inGame = true;

      // 将双方加入房间
      socket.join(roomId);
      io.to(inviter.socketId).socketsJoin(roomId);

      const firstQuestion = questions[0];
      io.to(roomId).emit('game-start', {
        roomId,
        keyword: finalKeyword,
        difficulty: invitation.difficulty,
        isRanking: isRankingMode,
        players: [
          { userId: String(actualInviterId), username: inviter.username },
          { userId: String(socket.userId), username: acceptor.username }
        ],
        currentTurn: 0,
        timeLimit: 30,
        currentQuestion: firstQuestion,
        totalQuestions: 30,
        currentQuestionIndex: 0
      });
      
      console.log(`${acceptor.username} 接受了 ${inviter.username} 的邀请，进入房间 ${roomId}，令字: ${finalKeyword}`);
      
      // 清理邀请
      invitations.delete(inviteId);
      
      // 广播在线用户列表更新
      await broadcastOnlineUsers(io);
    });
    
    // 拒绝邀请
    socket.on('reject-invitation', (data) => {
      const { inviteId, inviterId } = data;
      const invitation = invitations.get(inviteId);
      
      if (!invitation) {
        socket.emit('error', { message: '邀请不存在' });
        return;
      }
      
      // 使用 invitation 中存储的 inviterId（确保类型一致）
      const actualInviterId = invitation.inviterId || Number(inviterId);
      const inviter = onlineUsers.get(actualInviterId);
      if (inviter) {
        io.to(inviter.socketId).emit('invitation-rejected', {
          rejecterId: socket.userId
        });
      }
      
      console.log(`邀请 ${inviteId} 被拒绝`);
      
      // 清理邀请
      invitations.delete(inviteId);
    });
    
    // 提交答案（填空题答题）
    socket.on('submit-poem', async (data) => {
      const { roomId, answer } = data;
      const room = gameRooms.get(roomId);

      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }

      if (room.status !== 'active') {
        socket.emit('error', { message: '游戏已结束' });
        return;
      }

      // 检查是否轮到当前用户
      const currentPlayerIndex = room.players.findIndex(p => p.userId === socket.userId);
      if (currentPlayerIndex !== room.currentTurn) {
        socket.emit('error', { message: '还没轮到你' });
        return;
      }

      const currentQuestion = room.questions[room.currentQuestionIndex];
      if (!currentQuestion) {
        socket.emit('error', { message: '题目不存在' });
        return;
      }

      // 判题：答案完全匹配（题目在开局时已预置，直接比对）
      const normalizedAnswer = (answer || '').trim();
      const correctAnswer = (currentQuestion.answer || '').trim();
      const isCorrect = normalizedAnswer === correctAnswer;

      // 立即广播判题结果，不再延迟
      if (!isCorrect) {
          // 答错：当轮玩家判负，对手获胜
          const loserIndex = currentPlayerIndex;
          const winnerIndex = (loserIndex + 1) % 2;
          const loser = room.players[loserIndex];
          const winner = room.players[winnerIndex];

          await saveBattleRecord(room, winner.userId, loser.userId, room.isRanking);

          io.to(roomId).emit('poem-submitted', {
            isCorrect: false,
            playerId: socket.userId,
            playerName: loser.username,
            correctAnswer: correctAnswer,
            yourAnswer: normalizedAnswer,
            question: currentQuestion.question,
            currentQuestionIndex: room.currentQuestionIndex,
            totalQuestions: room.questions.length
          });

          room.status = 'finished';
          io.to(roomId).emit('game-result', {
            winnerId: String(winner.userId),
            winnerName: winner.username,
            loserId: String(loser.userId),
            loserName: loser.username,
            reason: 'wrong_answer',
            winnerScore: winner.correctAnswers,
            loserScore: loser.correctAnswers,
            totalRounds: room.currentQuestionIndex + 1,
            isRanking: room.isRanking
          });

          cleanUpRoom(roomId);
          return;
        }

        // 答对：得分，切换到对方，进入下一题
        room.players[currentPlayerIndex].correctAnswers += 1;
        room.players[currentPlayerIndex].score += 1;

        const nextQuestionIndex = room.currentQuestionIndex + 1;

        // 所有题目已答完
        if (nextQuestionIndex >= room.questions.length) {
          const p0 = room.players[0];
          const p1 = room.players[1];

          let winnerId, loserId, reason;
          if (p0.correctAnswers > p1.correctAnswers) {
            winnerId = p0.userId; loserId = p1.userId; reason = 'score';
          } else if (p1.correctAnswers > p0.correctAnswers) {
            winnerId = p1.userId; loserId = p0.userId; reason = 'score';
          } else {
            // 平局：邀请者（索引0）获胜
            winnerId = p0.userId; loserId = p1.userId; reason = 'tie';
          }

          await saveBattleRecord(room, winnerId, loserId, room.isRanking);

          io.to(roomId).emit('poem-submitted', {
            isCorrect: true,
            playerId: String(socket.userId),
            playerName: room.players[currentPlayerIndex].username,
            correctAnswer: correctAnswer,
            question: currentQuestion.question,
            currentQuestionIndex: room.currentQuestionIndex,
            totalQuestions: room.questions.length,
            players: room.players.map(p => ({
              userId: String(p.userId),
              username: p.username,
              correctAnswers: p.correctAnswers
            })),
            gameOver: true
          });

          room.status = 'finished';
          io.to(roomId).emit('game-result', {
            winnerId: String(winnerId),
            loserId: String(loserId),
            winnerScore: room.players[0].userId === winnerId ? p0.correctAnswers : p1.correctAnswers,
            loserScore: room.players[0].userId === winnerId ? p1.correctAnswers : p0.correctAnswers,
            reason,
            totalRounds: room.questions.length,
            isRanking: room.isRanking
          });

          cleanUpRoom(roomId);
          return;
        }

        // 进入下一题，切换回合
        room.currentQuestionIndex = nextQuestionIndex;
        room.currentTurn = (room.currentTurn + 1) % 2;
        const nextQuestion = room.questions[nextQuestionIndex];

        io.to(roomId).emit('poem-submitted', {
          isCorrect: true,
          playerId: String(socket.userId),
          playerName: room.players[currentPlayerIndex].username,
          correctAnswer: correctAnswer,
          question: currentQuestion.question,
          currentQuestionIndex: room.currentQuestionIndex,
          totalQuestions: room.questions.length,
          players: room.players.map(p => ({
            userId: String(p.userId),
            username: p.username,
            correctAnswers: p.correctAnswers
          })),
          nextQuestion: nextQuestion,
          nextTurn: room.currentTurn,
          timeLimit: room.timeLimit
        });

        io.to(roomId).emit('timer-resume', { timeLimit: room.timeLimit });
    });
    socket.on('timeout', async (data) => {
      const { roomId } = data;
      const room = gameRooms.get(roomId);

      if (!room || room.status !== 'active') {
        socket.emit('error', { message: '房间不存在或游戏已结束' });
        return;
      }

      // 当前玩家超时，判负
      const loserIndex = room.currentTurn;
      const winnerIndex = (loserIndex + 1) % 2;
      const loser = room.players[loserIndex];
      const winner = room.players[winnerIndex];
      const currentQuestion = room.questions[room.currentQuestionIndex];

      await saveBattleRecord(room, winner.userId, loser.userId, room.isRanking);

      room.status = 'finished';
      io.to(roomId).emit('game-result', {
        winnerId: String(winner.userId),
        winnerName: winner.username,
        loserId: String(loser.userId),
        loserName: loser.username,
        correctAnswer: currentQuestion ? currentQuestion.answer : '',
        question: currentQuestion ? currentQuestion.question : '',
        reason: 'timeout',
        winnerScore: winner.correctAnswers,
        loserScore: loser.correctAnswers,
        totalRounds: room.currentQuestionIndex + 1,
        isRanking: room.isRanking
      });

      cleanUpRoom(roomId);
      console.log(`房间 ${roomId} 游戏结束，获胜者: ${winner.username}，原因: 超时`);
    });
    
    // 游戏结束
    socket.on('game-over', async (data) => {
      const { roomId, winnerId, loserId, reason } = data;
      const room = gameRooms.get(roomId);

      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }

      await saveBattleRecord(room, winnerId, loserId, room.isRanking);

      room.status = 'finished';
      io.to(roomId).emit('game-result', {
        winnerId: String(winnerId),
        loserId: String(loserId),
        winnerScore: room.players[0].userId === winnerId ? room.players[0].correctAnswers : room.players[1].correctAnswers,
        loserScore: room.players[0].userId === winnerId ? room.players[1].correctAnswers : room.players[0].correctAnswers,
        reason: reason || 'normal',
        totalRounds: room.currentQuestionIndex + 1,
        isRanking: room.isRanking
      });

      cleanUpRoom(roomId);
      console.log(`房间 ${roomId} 游戏结束，获胜者: ${winnerId}`);
    });
    
    // 断开连接
    socket.on('disconnect', async () => {
      console.log('用户断开连接:', socket.id);
      
      // 从在线列表中移除
      for (const [userId, user] of onlineUsers.entries()) {
        if (user.socketId === socket.id) {
          onlineUsers.delete(userId);
          console.log('用户离线:', user.username);
          break;
        }
      }
      
      // 广播在线用户列表更新
      await broadcastOnlineUsers(io);
      
      // 清理相关邀请
      for (const [inviteId, invitation] of invitations.entries()) {
        if (invitation.inviterId === socket.userId || invitation.targetId === socket.userId) {
          // 通知对方邀请已取消
          const otherUserId = invitation.inviterId === socket.userId ? invitation.targetId : invitation.inviterId;
          const otherUser = onlineUsers.get(otherUserId);
          if (otherUser) {
            io.to(otherUser.socketId).emit('invitation-cancelled', {
              reason: 'user-disconnected'
            });
          }
          invitations.delete(inviteId);
        }
      }
      
      // 清理相关游戏房间
      for (const [roomId, room] of gameRooms.entries()) {
        if (room.players.some(p => p.userId === socket.userId)) {
          // 找到另一个玩家
          const otherPlayer = room.players.find(p => p.userId !== socket.userId);
          
          // 保存对战记录（断开连接的玩家判负）
          await saveBattleRecord(room, otherPlayer.userId, socket.userId, room.isRanking);
          
          room.status = 'finished';
          io.to(roomId).emit('opponent-disconnected', {
            winnerId: String(otherPlayer.userId),
            winnerName: otherPlayer.username,
            loserId: String(socket.userId),
            loserName: room.players.find(p => p.userId === socket.userId)?.username || '未知',
            isRanking: room.isRanking
          });

          cleanUpRoom(roomId);
        }
      }
    });
  });
}

module.exports = setupSocket;