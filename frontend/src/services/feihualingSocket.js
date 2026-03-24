import { io } from 'socket.io-client';

class FeihualingSocket {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.eventHandlers = {};
  }

  connect() {
    if (this.socket && this.connected) {
      return this.socket;
    }

    this.socket = io('http://localhost:3000', {
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('飞花令Socket连接成功');
      this.connected = true;
      this.emit('feihualing:login', {
        token: localStorage.getItem('token')
      });
    });

    this.socket.on('disconnect', () => {
      console.log('飞花令Socket断开连接');
      this.connected = false;
    });

    this.socket.on('feihualing:online-users', (data) => {
      this.trigger('online-users', data.users);
    });

    this.socket.on('feihualing:user-joined', (data) => {
      this.trigger('user-joined', data.user);
    });

    this.socket.on('feihualing:user-left', (data) => {
      this.trigger('user-left', data.userId);
    });

    this.socket.on('feihualing:invitation-received', (data) => {
      this.trigger('invitation-received', data);
    });

    this.socket.on('feihualing:invitation-sent', (data) => {
      this.trigger('invitation-sent', data);
    });

    this.socket.on('feihualing:invitation-declined', (data) => {
      this.trigger('invitation-declined', data);
    });

    this.socket.on('feihualing:game-started', (data) => {
      this.trigger('game-started', data.room);
    });

    this.socket.on('feihualing:answer-result', (data) => {
      this.trigger('answer-result', data);
    });

    this.socket.on('feihualing:answer-correct', (data) => {
      this.trigger('answer-correct', data);
    });

    this.socket.on('feihualing:game-ended', (data) => {
      this.trigger('game-ended', data);
    });

    this.socket.on('feihualing:opponent-left', (data) => {
      this.trigger('opponent-left', data);
    });

    this.socket.on('feihualing:left-game', (data) => {
      this.trigger('left-game', data);
    });

    this.socket.on('feihualing:error', (data) => {
      console.error('飞花令错误:', data.error);
      this.trigger('error', data.error);
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

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
  }

  off(event, callback) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(callback);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  trigger(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(callback => {
        callback(data);
      });
    }
  }

  getOnlineUsers() {
    this.emit('feihualing:get-online-users');
  }

  sendInvitation(toUserId) {
    this.emit('feihualing:send-invitation', { toUserId });
  }

  acceptInvitation() {
    this.emit('feihualing:accept-invitation');
  }

  declineInvitation() {
    this.emit('feihualing:decline-invitation');
  }

  submitAnswer(roomId, poem) {
    this.emit('feihualing:submit-answer', { roomId, poem });
  }

  leaveGame(roomId) {
    this.emit('feihualing:leave-game', { roomId });
  }
}

export default new FeihualingSocket();
