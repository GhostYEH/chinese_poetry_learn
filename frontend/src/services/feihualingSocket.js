import { io } from 'socket.io-client';

class FeihualingSocket {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.eventHandlers = {};
  }

  connect(token) {
    if (this.socket && this.connected) {
      return this.socket;
    }

    this.socket = io('http://localhost:3000', {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('飞花令Socket连接成功');
      this.connected = true;
      
      // 发送认证
      this.socket.emit('authenticate', { token });
    });

    this.socket.on('disconnect', () => {
      console.log('飞花令Socket断开连接');
      this.connected = false;
      this.trigger('disconnected');
    });

    // 初始化成功
    this.socket.on('init', (data) => {
      console.log('用户认证成功:', data);
      this.trigger('authenticated', data);
    });

    // 在线用户列表更新
    this.socket.on('online-list-update', (users) => {
      this.trigger('online-users', users);
    });

    // 接收邀请
    this.socket.on('receive-invitation', (data) => {
      this.trigger('receive-invitation', data);
    });

    // 邀请被拒绝
    this.socket.on('invitation-rejected', (data) => {
      this.trigger('invitation-rejected', data);
    });

    // 邀请被取消
    this.socket.on('invitation-cancelled', (data) => {
      this.trigger('invitation-cancelled', data);
    });

    // 游戏开始
    this.socket.on('game-start', (data) => {
      this.trigger('game-start', data);
    });

    // 诗句提交成功
    this.socket.on('poem-submitted', (data) => {
      this.trigger('poem-submitted', data);
    });

    // 扔题成功
    this.socket.on('question-thrown', (data) => {
      this.trigger('question-thrown', data);
    });

    // 游戏结果
    this.socket.on('game-result', (data) => {
      this.trigger('game-result', data);
    });

    // 对手断线
    this.socket.on('opponent-disconnected', (data) => {
      this.trigger('opponent-disconnected', data);
    });

    // 错误处理
    this.socket.on('error', (error) => {
      console.error('飞花令错误:', error);
      this.trigger('error', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // 发送邀请
  sendInvitation(targetUserId, keyword, difficulty) {
    this.socket.emit('send-invitation', {
      targetUserId,
      keyword,
      difficulty
    });
  }

  // 接受邀请
  acceptInvitation(inviteId, inviterId) {
    this.socket.emit('accept-invitation', {
      inviteId,
      inviterId
    });
  }

  // 拒绝邀请
  rejectInvitation(inviteId, inviterId) {
    this.socket.emit('reject-invitation', {
      inviteId,
      inviterId
    });
  }

  // 提交诗句
  submitPoem(roomId, poem) {
    this.socket.emit('submit-poem', {
      roomId,
      poem
    });
  }

  // 扔题
  throwQuestion(roomId) {
    this.socket.emit('throw-question', {
      roomId
    });
  }

  // 超时
  timeout(roomId) {
    this.socket.emit('timeout', {
      roomId
    });
  }

  // 游戏结束
  gameOver(roomId, winnerId, loserId, reason) {
    this.socket.emit('game-over', {
      roomId,
      winnerId,
      loserId,
      reason
    });
  }

  // 事件监听
  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
  }

  // 移除事件监听
  off(event, callback) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(callback);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  // 触发事件
  trigger(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(callback => {
        callback(data);
      });
    }
  }
}

export default new FeihualingSocket();
