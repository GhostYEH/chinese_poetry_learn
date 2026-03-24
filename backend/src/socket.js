const { Server } = require('socket.io');

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('新的Socket连接:', socket.id);
    
    // 处理断开连接
    socket.on('disconnect', () => {
      console.log('Socket断开连接:', socket.id);
    });
    
    // 处理心跳
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });
  
  return io;
}

// 向指定用户发送消息
function emitToUser(userId, event, data) {
  return false;
}

// 向所有用户广播消息
function broadcast(event, data) {
  if (global.io) {
    global.io.emit(event, data);
  }
}

module.exports = setupSocket;
module.exports.emitToUser = emitToUser;
module.exports.broadcast = broadcast;
