// Socket.io 核心逻辑
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { db } = require('../utils/db');

// 在线用户管理
const onlineUsers = new Map();

// 邀请管理
const invitations = new Map();

// 游戏房间管理
const gameRooms = new Map();

// 生成唯一ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
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
async function saveBattleRecord(room, winnerId, loserId) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    const battleHistory = JSON.stringify({
      keyword: room.keyword,
      difficulty: room.difficulty,
      usedPoems: room.usedPoems,
      totalRounds: room.currentRound
    });
    
    // 保存对战记录
    db.run(
      `INSERT INTO feihua_battles 
       (player1_id, player2_id, keyword, winner_id, loser_id, total_rounds, 
        player1_throw_count, player2_throw_count, battle_history, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        room.players[0].userId,
        room.players[1].userId,
        room.keyword,
        winnerId,
        loserId,
        room.currentRound,
        3 - room.players[0].throwCount,
        3 - room.players[1].throwCount,
        battleHistory,
        new Date(room.startTime).toISOString(),
        now
      ],
      (err) => {
        if (err) {
          console.error('保存对战记录失败:', err);
          reject(err);
          return;
        }
        
        // 更新用户最高记录
        updateHighRecords(room, winnerId, loserId);
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
    [winnerId, room.keyword, room.currentRound, now, room.currentRound, now],
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
    [loserId, room.keyword, room.currentRound, now, room.currentRound, now],
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
          userId: user.userId,
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
    
    // 发送邀请
    socket.on('send-invitation', async (data) => {
      const { targetUserId, keyword, difficulty } = data;
      const inviter = onlineUsers.get(socket.userId);
      
      if (!inviter) {
        socket.emit('error', { message: '未认证用户' });
        return;
      }
      
      const targetUser = onlineUsers.get(targetUserId);
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
      
      // 存储邀请信息
      invitations.set(inviteId, {
        inviterId: socket.userId,
        inviterName: inviter.username,
        inviterClassId: inviter.classId,
        inviterMaxRounds: inviter.maxRounds,
        targetId: targetUserId,
        keyword: keyword,
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
        keyword: keyword,
        difficulty: difficulty
      });
      
      console.log(`${inviter.username} 邀请 ${targetUser.username} 进行飞花令对战，令字: ${keyword}`);
    });
    
    // 接受邀请
    socket.on('accept-invitation', async (data) => {
      const { inviteId, inviterId } = data;
      const invitation = invitations.get(inviteId);
      
      if (!invitation) {
        socket.emit('error', { message: '邀请不存在或已过期' });
        return;
      }
      
      const inviter = onlineUsers.get(inviterId);
      const acceptor = onlineUsers.get(socket.userId);
      
      if (!inviter || !acceptor) {
        socket.emit('error', { message: '用户不在线' });
        return;
      }
      
      // 生成房间ID
      const roomId = generateId();
      
      // 创建游戏房间
      gameRooms.set(roomId, {
        players: [
          { 
            userId: inviterId, 
            username: inviter.username, 
            classId: inviter.classId,
            throwCount: 3, // 扔题特权次数
            score: 0
          },
          { 
            userId: socket.userId, 
            username: acceptor.username, 
            classId: acceptor.classId,
            throwCount: 3, // 扔题特权次数
            score: 0
          }
        ],
        keyword: invitation.keyword,
        difficulty: invitation.difficulty,
        currentTurn: 0, // 当前轮到谁（0或1）
        currentRound: 1, // 当前回合数
        usedPoems: [], // 已使用的诗句
        status: 'active',
        startTime: Date.now(),
        timeLimit: invitation.difficulty === 'easy' ? 60 : invitation.difficulty === 'medium' ? 45 : 30
      });
      
      // 标记用户正在游戏中
      inviter.inGame = true;
      acceptor.inGame = true;
      
      // 将双方加入房间
      socket.join(roomId);
      io.to(inviter.socketId).socketsJoin(roomId);
      
      // 通知双方游戏开始
      io.to(roomId).emit('game-start', {
        roomId,
        keyword: invitation.keyword,
        difficulty: invitation.difficulty,
        players: gameRooms.get(roomId).players,
        currentTurn: 0,
        timeLimit: gameRooms.get(roomId).timeLimit
      });
      
      console.log(`${acceptor.username} 接受了 ${inviter.username} 的邀请，进入房间 ${roomId}，令字: ${invitation.keyword}`);
      
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
      
      const inviter = onlineUsers.get(inviterId);
      if (inviter) {
        io.to(inviter.socketId).emit('invitation-rejected', {
          rejecterId: socket.userId
        });
      }
      
      console.log(`邀请 ${inviteId} 被拒绝`);
      
      // 清理邀请
      invitations.delete(inviteId);
    });
    
    // 提交诗句
    socket.on('submit-poem', (data) => {
      const { roomId, poem } = data;
      const room = gameRooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      
      // 检查是否轮到当前用户
      const currentPlayerIndex = room.players.findIndex(p => p.userId === socket.userId);
      if (currentPlayerIndex !== room.currentTurn) {
        socket.emit('error', { message: '还没轮到你' });
        return;
      }
      
      // 验证诗句（简化版）
      const isValid = poem.includes(room.keyword);
      
      if (!isValid) {
        socket.emit('error', { message: '诗句不包含令字' });
        return;
      }
      
      // 检查是否重复
      if (room.usedPoems.includes(poem)) {
        socket.emit('error', { message: '该诗句已被使用' });
        return;
      }
      
      // 添加到已使用诗句列表
      room.usedPoems.push(poem);
      
      // 更新当前玩家分数
      room.players[currentPlayerIndex].score += 1;
      
      // 切换到下一个玩家
      room.currentTurn = (room.currentTurn + 1) % 2;
      room.currentRound += 1;
      
      // 广播给房间内所有玩家
      io.to(roomId).emit('poem-submitted', {
        poem,
        playerId: socket.userId,
        playerName: room.players[currentPlayerIndex].username,
        currentTurn: room.currentTurn,
        currentRound: room.currentRound,
        usedPoems: room.usedPoems,
        players: room.players
      });
      
      console.log(`玩家 ${socket.userId} 在房间 ${roomId} 提交了诗句: ${poem}`);
    });
    
    // 扔题特权
    socket.on('throw-question', (data) => {
      const { roomId } = data;
      const room = gameRooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      
      // 检查是否轮到当前用户
      const currentPlayerIndex = room.players.findIndex(p => p.userId === socket.userId);
      if (currentPlayerIndex !== room.currentTurn) {
        socket.emit('error', { message: '还没轮到你' });
        return;
      }
      
      // 检查扔题次数
      if (room.players[currentPlayerIndex].throwCount <= 0) {
        socket.emit('error', { message: '扔题次数已用完' });
        return;
      }
      
      // 减少扔题次数
      room.players[currentPlayerIndex].throwCount -= 1;
      
      // 切换到下一个玩家（扔题后对方必须回答）
      room.currentTurn = (room.currentTurn + 1) % 2;
      
      // 广播给房间内所有玩家
      io.to(roomId).emit('question-thrown', {
        playerId: socket.userId,
        playerName: room.players[currentPlayerIndex].username,
        currentTurn: room.currentTurn,
        players: room.players
      });
      
      console.log(`玩家 ${socket.userId} 使用了扔题特权`);
    });
    
    // 超时处理
    socket.on('timeout', async (data) => {
      const { roomId } = data;
      const room = gameRooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      
      // 当前玩家超时，判负
      const loserIndex = room.currentTurn;
      const winnerIndex = (loserIndex + 1) % 2;
      
      const loser = room.players[loserIndex];
      const winner = room.players[winnerIndex];
      
      // 保存对战记录
      await saveBattleRecord(room, winner.userId, loser.userId);
      
      // 通知房间内所有玩家
      io.to(roomId).emit('game-result', {
        winnerId: winner.userId,
        winnerName: winner.username,
        loserId: loser.userId,
        loserName: loser.username,
        totalRounds: room.currentRound,
        reason: 'timeout'
      });
      
      console.log(`房间 ${roomId} 游戏结束，获胜者: ${winner.username}，原因: 超时`);
      
      // 清理房间
      gameRooms.delete(roomId);
      
      // 标记用户不在游戏中
      const loserUser = onlineUsers.get(loser.userId);
      const winnerUser = onlineUsers.get(winner.userId);
      if (loserUser) loserUser.inGame = false;
      if (winnerUser) winnerUser.inGame = false;
      
      // 广播在线用户列表更新
      await broadcastOnlineUsers(io);
    });
    
    // 游戏结束
    socket.on('game-over', async (data) => {
      const { roomId, winnerId, loserId, reason } = data;
      const room = gameRooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      
      // 保存对战记录
      await saveBattleRecord(room, winnerId, loserId);
      
      // 通知房间内所有玩家
      io.to(roomId).emit('game-result', {
        winnerId,
        loserId,
        totalRounds: room.currentRound,
        reason: reason || 'normal'
      });
      
      console.log(`房间 ${roomId} 游戏结束，获胜者: ${winnerId}`);
      
      // 清理房间
      gameRooms.delete(roomId);
      
      // 标记用户不在游戏中
      const winner = room.players.find(p => p.userId === winnerId);
      const loser = room.players.find(p => p.userId === loserId);
      const winnerUser = onlineUsers.get(winnerId);
      const loserUser = onlineUsers.get(loserId);
      if (winnerUser) winnerUser.inGame = false;
      if (loserUser) loserUser.inGame = false;
      
      // 广播在线用户列表更新
      await broadcastOnlineUsers(io);
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
          await saveBattleRecord(room, otherPlayer.userId, socket.userId);
          
          // 通知房间内其他玩家
          io.to(roomId).emit('opponent-disconnected', {
            winnerId: otherPlayer.userId,
            winnerName: otherPlayer.username
          });
          
          // 标记另一个玩家不在游戏中
          const otherUser = onlineUsers.get(otherPlayer.userId);
          if (otherUser) otherUser.inGame = false;
          
          gameRooms.delete(roomId);
        }
      }
    });
  });
}

module.exports = setupSocket;