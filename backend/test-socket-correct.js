// 使用正确JWT密钥的Socket.io测试
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

// 使用与.env文件相同的密钥
const JWT_SECRET = 'your-secret-key-change-this-in-production';

console.log('=== Socket.io 测试（使用正确密钥） ===\n');
console.log('JWT密钥:', JWT_SECRET);

// 生成测试token
const testUser = { id: 1, username: '测试用户' };
const token = jwt.sign(
  { id: testUser.id, username: testUser.username },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('测试Token:', token.substring(0, 50) + '...\n');

// 连接Socket
const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling']
});

console.log('正在连接到服务器...');

socket.on('connect', () => {
  console.log('✅ 连接成功! Socket ID:', socket.id);
  console.log('\n发送认证请求...');
  socket.emit('authenticate', { token });
});

socket.on('authenticated', (data) => {
  console.log('✅ 认证成功!', data);
});

socket.on('online-users', (users) => {
  console.log('✅ 收到在线用户列表:', users);
  console.log('\n测试完成，断开连接...');
  socket.disconnect();
  setTimeout(() => process.exit(0), 1000);
});

socket.on('error', (error) => {
  console.log('❌ 错误:', error);
});

socket.on('disconnect', () => {
  console.log('⚠️  连接断开');
});

// 监听所有事件
socket.onAny((event, ...args) => {
  console.log(`📨 收到事件: ${event}`, args);
});

// 30秒后退出
setTimeout(() => {
  console.log('\n测试超时，退出...');
  socket.disconnect();
  process.exit(0);
}, 30000);
