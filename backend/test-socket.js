// Socket.io 完整测试脚本
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const configModule = require('./src/config/config');

const JWT_SECRET = configModule.jwt.secret;

console.log('=== Socket.io 服务测试 ===\n');

// 测试配置
const config = {
  serverUrl: 'http://localhost:3000',
  testUser1: {
    id: 345,
    username: 'yao'
  },
  testUser2: {
    id: 344,
    username: '黄伟51'
  }
};

// 生成测试token
function generateTestToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}: 通过 ${message}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}: 失败 ${message}`);
  }
  testResults.tests.push({ name, passed, message });
}

// 测试1: 基础连接测试
async function testBasicConnection() {
  console.log('\n--- 测试1: 基础连接 ---');
  
  return new Promise((resolve) => {
    const socket = io(config.serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000
    });

    const timeout = setTimeout(() => {
      logTest('基础连接', false, '连接超时');
      socket.disconnect();
      resolve(false);
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      logTest('基础连接', true, `Socket ID: ${socket.id}`);
      
      // 测试ping/pong
      socket.emit('ping');
      socket.on('pong', () => {
        logTest('Ping/Pong', true);
      });
      
      setTimeout(() => {
        socket.disconnect();
        resolve(true);
      }, 1000);
    });

    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      logTest('基础连接', false, `错误: ${error.message}`);
      resolve(false);
    });
  });
}

// 测试2: 用户认证测试
async function testAuthentication() {
  console.log('\n--- 测试2: 用户认证 ---');
  
  return new Promise((resolve) => {
    const token = generateTestToken(config.testUser1);
    const socket = io(config.serverUrl, {
      transports: ['websocket', 'polling']
    });

    const timeout = setTimeout(() => {
      logTest('用户认证', false, '认证超时');
      socket.disconnect();
      resolve(false);
    }, 5000);

    socket.on('connect', () => {
      console.log('  连接成功，发送认证请求...');
      socket.emit('authenticate', { token });
    });

    socket.on('authenticated', (data) => {
      clearTimeout(timeout);
      logTest('用户认证', true, `用户: ${data.username}`);
      
      setTimeout(() => {
        socket.disconnect();
        resolve(true);
      }, 1000);
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      logTest('用户认证', false, `错误: ${error.error}`);
      socket.disconnect();
      resolve(false);
    });
  });
}

// 测试3: 在线用户列表测试
async function testOnlineUsers() {
  console.log('\n--- 测试3: 在线用户列表 ---');
  
  return new Promise((resolve) => {
    const token = generateTestToken(config.testUser1);
    const socket = io(config.serverUrl, {
      transports: ['websocket', 'polling']
    });

    const timeout = setTimeout(() => {
      logTest('在线用户列表', false, '获取超时');
      socket.disconnect();
      resolve(false);
    }, 5000);

    socket.on('connect', () => {
      socket.emit('authenticate', { token });
    });

    socket.on('online-users', (users) => {
      clearTimeout(timeout);
      logTest('在线用户列表', true, `用户数: ${users.length}`);
      console.log('  在线用户:', users.map(u => u.username || u.userId).join(', '));
      
      setTimeout(() => {
        socket.disconnect();
        resolve(true);
      }, 1000);
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      logTest('在线用户列表', false, `错误: ${error.error}`);
      socket.disconnect();
      resolve(false);
    });
  });
}

// 测试4: 邀请功能测试
async function testInvitation() {
  console.log('\n--- 测试4: 邀请功能 ---');
  
  return new Promise((resolve) => {
    const token1 = generateTestToken(config.testUser1);
    const token2 = generateTestToken(config.testUser2);
    
    const socket1 = io(config.serverUrl, { transports: ['websocket', 'polling'] });
    const socket2 = io(config.serverUrl, { transports: ['websocket', 'polling'] });

    let user1Authenticated = false;
    let user2Authenticated = false;
    let invitationReceived = false;

    const timeout = setTimeout(() => {
      logTest('邀请功能', false, '邀请超时');
      socket1.disconnect();
      socket2.disconnect();
      resolve(false);
    }, 10000);

    // 用户1连接
    socket1.on('connect', () => {
      socket1.emit('authenticate', { token: token1 });
    });

    socket1.on('authenticated', () => {
      user1Authenticated = true;
      console.log('  用户1认证成功');
      
      if (user2Authenticated) {
        // 发送邀请
        setTimeout(() => {
          console.log('  用户1发送邀请给用户2...');
          socket1.emit('send-invitation', {
            targetUserId: config.testUser2.id,
            keyword: '花',
            difficulty: 1
          });
        }, 1000);
      }
    });

    socket1.on('invitation-sent', () => {
      logTest('发送邀请', true);
    });

    // 用户2连接
    socket2.on('connect', () => {
      socket2.emit('authenticate', { token: token2 });
    });

    socket2.on('authenticated', () => {
      user2Authenticated = true;
      console.log('  用户2认证成功');
      
      if (user1Authenticated) {
        setTimeout(() => {
          console.log('  用户1发送邀请给用户2...');
          socket1.emit('send-invitation', {
            targetUserId: config.testUser2.id,
            keyword: '花',
            difficulty: 1
          });
        }, 1000);
      }
    });

    socket2.on('receive-invitation', (data) => {
      clearTimeout(timeout);
      invitationReceived = true;
      logTest('接收邀请', true, `来自: ${data.from.username}`);
      
      setTimeout(() => {
        socket1.disconnect();
        socket2.disconnect();
        resolve(true);
      }, 1000);
    });

    socket1.on('error', (error) => {
      console.log('  用户1错误:', error.error);
    });

    socket2.on('error', (error) => {
      console.log('  用户2错误:', error.error);
    });
  });
}

// 测试5: 游戏流程测试
async function testGameFlow() {
  console.log('\n--- 测试5: 游戏流程 ---');
  
  return new Promise((resolve) => {
    const token1 = generateTestToken(config.testUser1);
    const token2 = generateTestToken(config.testUser2);
    
    const socket1 = io(config.serverUrl, { transports: ['websocket', 'polling'] });
    const socket2 = io(config.serverUrl, { transports: ['websocket', 'polling'] });

    let inviteId = null;
    let inviterId = null;

    const timeout = setTimeout(() => {
      logTest('游戏流程', false, '游戏超时');
      socket1.disconnect();
      socket2.disconnect();
      resolve(false);
    }, 15000);

    // 用户1
    socket1.on('connect', () => {
      socket1.emit('authenticate', { token: token1 });
    });

    socket1.on('authenticated', () => {
      setTimeout(() => {
        socket1.emit('send-invitation', {
          targetUserId: config.testUser2.id,
          keyword: '花',
          difficulty: 1
        });
      }, 1000);
    });

    socket1.on('game-start', (data) => {
      logTest('游戏开始', true, `房间ID: ${data.room.id}`);
      console.log('  令字:', data.room.keyword);
      console.log('  玩家:', data.room.players.map(p => p.username).join(' vs '));
      console.log('  当前轮到:', data.room.players[data.room.currentTurn].username);
      
      // 检查是否轮到用户1
      const myIndex = data.room.players.findIndex(p => p.id === config.testUser1.id.toString());
      if (myIndex === data.room.currentTurn) {
        // 提交诗句
        setTimeout(() => {
          console.log('  用户1提交诗句...');
          socket1.emit('submit-poem', {
            roomId: data.room.id,
            poem: '花落知多少'
          });
        }, 1000);
      } else {
        console.log('  不是用户1的回合，等待...');
      }
    });

    socket1.on('poem-submitted', (data) => {
      clearTimeout(timeout);
      logTest('诗句提交', true, `诗句: ${data.poem}`);
      
      setTimeout(() => {
        socket1.disconnect();
        socket2.disconnect();
        resolve(true);
      }, 1000);
    });

    // 用户2
    socket2.on('connect', () => {
      socket2.emit('authenticate', { token: token2 });
    });

    socket2.on('receive-invitation', (data) => {
      inviteId = data.inviteId;
      inviterId = data.from.userId;
      
      setTimeout(() => {
        console.log('  用户2接受邀请...');
        socket2.emit('accept-invitation', {
          inviteId: data.inviteId,
          inviterId: data.from.userId
        });
      }, 500);
    });

    socket2.on('game-start', (data) => {
      console.log('  用户2: 游戏已开始');
      console.log('  用户2: 当前轮到:', data.room.players[data.room.currentTurn].username);
      
      // 检查是否轮到用户2
      const myIndex = data.room.players.findIndex(p => p.id === config.testUser2.id.toString());
      if (myIndex === data.room.currentTurn) {
        // 提交诗句
        setTimeout(() => {
          console.log('  用户2提交诗句...');
          socket2.emit('submit-poem', {
            roomId: data.room.id,
            poem: '花落知多少'
          });
        }, 1000);
      } else {
        console.log('  不是用户2的回合，等待...');
      }
    });

    socket2.on('poem-submitted', (data) => {
      clearTimeout(timeout);
      logTest('游戏流程', true, `诗句提交成功: ${data.poem}`);
      
      setTimeout(() => {
        socket1.disconnect();
        socket2.disconnect();
        resolve(true);
      }, 1000);
    });

    socket1.on('error', (error) => {
      console.log('  用户1错误:', error.error);
    });

    socket2.on('error', (error) => {
      console.log('  用户2错误:', error.error);
    });
  });
}

// 测试6: 断线重连测试
async function testDisconnect() {
  console.log('\n--- 测试6: 断线重连 ---');
  
  return new Promise((resolve) => {
    const token = generateTestToken(config.testUser1);
    const socket = io(config.serverUrl, {
      transports: ['websocket', 'polling']
    });

    const timeout = setTimeout(() => {
      logTest('断线重连', false, '测试超时');
      socket.disconnect();
      resolve(false);
    }, 10000);

    socket.on('connect', () => {
      console.log('  首次连接成功');
      socket.emit('authenticate', { token });
    });

    socket.on('authenticated', () => {
      console.log('  认证成功，模拟断线...');
      
      // 主动断开
      socket.disconnect();
      
      // 3秒后重连
      setTimeout(() => {
        console.log('  尝试重连...');
        socket.connect();
      }, 3000);
    });

    socket.on('disconnect', () => {
      console.log('  已断开连接');
    });

    // 监听重连成功事件
    socket.io.on('reconnect', (attemptNumber) => {
      clearTimeout(timeout);
      console.log('  重连成功，尝试次数:', attemptNumber);
      
      // 重连后重新认证
      socket.emit('authenticate', { token });
    });

    // 监听认证成功事件
    socket.on('authenticated', () => {
      console.log('  重连后认证成功');
      logTest('断线重连', true, '重连成功并重新认证');
      
      setTimeout(() => {
        socket.disconnect();
        resolve(true);
      }, 1000);
    });

    socket.on('error', (error) => {
      console.log('  错误:', error.error);
    });
  });
}

// 运行所有测试
async function runAllTests() {
  console.log('开始测试 Socket.io 服务...\n');
  console.log('服务器地址:', config.serverUrl);
  console.log('测试用户:', config.testUser1.username, ',', config.testUser2.username);
  
  try {
    await testBasicConnection();
    await testAuthentication();
    await testOnlineUsers();
    await testInvitation();
    await testGameFlow();
    await testDisconnect();
  } catch (error) {
    console.error('\n测试过程出错:', error);
  }
  
  // 输出测试报告
  console.log('\n=== 测试报告 ===');
  console.log(`总测试数: ${testResults.total}`);
  console.log(`通过: ${testResults.passed} ✅`);
  console.log(`失败: ${testResults.failed} ❌`);
  console.log(`成功率: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
  
  console.log('\n详细结果:');
  testResults.tests.forEach((test, index) => {
    const status = test.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${test.name}: ${test.message || '无'}`);
  });
  
  console.log('\n=== 测试完成 ===');
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// 启动测试
runAllTests();
