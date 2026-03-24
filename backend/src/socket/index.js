// Socket.io 核心逻辑

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

// 验证JWT token（简化版）
function verifyToken(token) {
  // 这里应该使用真实的JWT验证逻辑
  // 简化版：假设token格式为 "userId:username:avatar"
  if (!token) return null;
  
  console.log('Received token:', token);
  
  const parts = token.split(':');
  console.log('Token parts:', parts);
  
  // 即使parts数组长度小于3，也生成默认用户信息
  const userId = parts[0] || `user_${Date.now()}`;
  const username = parts[1] || `用户${Math.floor(Math.random() * 1000)}`;
  const avatar = parts[2] || 'default';
  
  console.log('Verified user:', { userId, username, avatar });
  
  return {
    userId: userId,
    username: username,
    avatar: avatar
  };
}

// 广播在线用户列表
function broadcastOnlineUsers(io) {
  const users = Array.from(onlineUsers.values()).map(user => ({
    userId: user.userId,
    username: user.username,
    avatar: user.avatar
  }));
  
  io.emit('online-list-update', users);
}

// 设置Socket.io
function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('新用户连接:', socket.id);
    
    // 身份验证
    socket.on('authenticate', (data) => {
      const { token } = data;
      const user = verifyToken(token);
      
      if (user) {
        // 将用户加入在线列表
        onlineUsers.set(user.userId, {
          ...user,
          socketId: socket.id
        });
        
        // 存储用户信息到socket
        socket.userId = user.userId;
        
        console.log('用户认证成功:', user.username);
        
        // 发送用户ID给当前连接的客户端
        socket.emit('init', { userId: user.userId });
        
        // 广播在线用户列表
        broadcastOnlineUsers(io);
      } else {
        console.log('用户认证失败');
        socket.disconnect();
      }
    });
    
    // 发送邀请
    socket.on('send-invitation', (data) => {
      const { targetUserId } = data;
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
      
      // 生成邀请ID
      const inviteId = generateId();
      
      // 存储邀请信息
      invitations.set(inviteId, {
        inviterId: socket.userId,
        inviterName: inviter.username,
        inviterAvatar: inviter.avatar,
        targetId: targetUserId,
        timestamp: Date.now()
      });
      
      // 向目标用户发送邀请
      io.to(targetUser.socketId).emit('receive-invitation', {
        inviterId: inviter.userId,
        inviterName: inviter.username,
        inviterAvatar: inviter.avatar,
        inviteId
      });
      
      console.log(`${inviter.username} 邀请 ${targetUser.username} 进行飞花令对战`);
    });
    
    // 接受邀请
    socket.on('accept-invitation', (data) => {
      const { inviteId, inviterId } = data;
      const invitation = invitations.get(inviteId);
      
      if (!invitation) {
        socket.emit('error', { message: '邀请不存在' });
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
          { userId: inviterId, username: inviter.username, avatar: inviter.avatar },
          { userId: socket.userId, username: acceptor.username, avatar: acceptor.avatar }
        ],
        status: 'active',
        startTime: Date.now()
      });
      
      // 将双方加入房间
      socket.join(roomId);
      io.to(inviter.socketId).socketsJoin(roomId);
      
      // 通知双方游戏开始
      io.to(roomId).emit('game-start', {
        roomId,
        opponent: inviterId === socket.userId ? 
          { userId: acceptor.userId, username: acceptor.username, avatar: acceptor.avatar } :
          { userId: inviter.userId, username: inviter.username, avatar: inviter.avatar }
      });
      
      console.log(`${acceptor.username} 接受了 ${inviter.username} 的邀请，进入房间 ${roomId}`);
      
      // 清理邀请
      invitations.delete(inviteId);
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
      const { roomId, poem, keyword, position } = data;
      const room = gameRooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      
      // 验证诗句（简化版）
      const isValid = poem.includes(keyword);
      
      if (isValid) {
        // 广播给房间内其他玩家
        socket.to(roomId).emit('opponent-moved', {
          poem,
          playerId: socket.userId
        });
        
        console.log(`玩家 ${socket.userId} 在房间 ${roomId} 提交了诗句: ${poem}`);
      } else {
        socket.emit('error', { message: '诗句不符合规则' });
      }
    });
    
    // 游戏结束
    socket.on('game-over', (data) => {
      const { roomId, winnerId, loserId } = data;
      const room = gameRooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: '房间不存在' });
        return;
      }
      
      // 通知房间内所有玩家
      io.to(roomId).emit('game-result', {
        winnerId,
        loserId
      });
      
      console.log(`房间 ${roomId} 游戏结束，获胜者: ${winnerId}`);
      
      // 清理房间
      gameRooms.delete(roomId);
    });
    
    // 断开连接
    socket.on('disconnect', () => {
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
      broadcastOnlineUsers(io);
      
      // 清理相关邀请
      for (const [inviteId, invitation] of invitations.entries()) {
        if (invitation.inviterId === socket.userId || invitation.targetId === socket.userId) {
          invitations.delete(inviteId);
        }
      }
      
      // 清理相关游戏房间
      for (const [roomId, room] of gameRooms.entries()) {
        if (room.players.some(p => p.userId === socket.userId)) {
          // 通知房间内其他玩家
          socket.to(roomId).emit('opponent-disconnected');
          gameRooms.delete(roomId);
        }
      }
    });
  });
}

module.exports = setupSocket;