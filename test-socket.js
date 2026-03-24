// 测试 socket 连接
const io = require('socket.io-client');

// 创建 socket 实例
const socket = io('http://localhost:3000', {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
});

// 监听连接成功事件
socket.on('connect', () => {
  console.log('Socket 已连接:', socket.id);
  
  // 发送认证信息
  const authToken = 'test_user:测试用户:default';
  console.log('Sending authenticate event with token:', authToken);
  socket.emit('authenticate', { token: authToken });
});

// 监听连接错误
socket.on('connect_error', (error) => {
  console.error('Socket 连接错误:', error);
});

// 监听断开连接
socket.on('disconnect', (reason) => {
  console.log('Socket 已断开连接:', reason);
});

// 监听在线用户列表更新
socket.on('online-list-update', (users) => {
  console.log('收到在线用户列表更新:', users);
});

// 连接 socket
console.log('正在连接 socket...');
socket.connect();

// 5 秒后断开连接
setTimeout(() => {
  console.log('断开 socket 连接...');
  socket.disconnect();
}, 5000);
