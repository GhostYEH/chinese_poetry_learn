const express = require('express');
const cors = require('cors');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
const port = 3000;
const CACHE_DIR = path.join(__dirname, 'cache');

// 导入数据库模块
const { initDatabase, initCreationTables, db } = require('./src/utils/db');

// 导入模块化路由
const poemRoutesModule = require('./src/api/poemRoutes');
const aiRoutes = require('./src/api/aiRoutes');
const learningRoutesModule = require('./src/api/learningRoutes');
const mistakesRoutesModule = require('./src/api/mistakesRoutes');
const recommendRoutesModule = require('./src/api/recommendRoutes');
const authRoutes = require('./src/api/authRoutes');
const collectionsRoutes = require('./src/api/collectionsRoutes');
const feihuaRoutes = require('./src/api/feihuaRoutes');
const teacherRoutes = require('./src/api/teacherRoutes');
const challengeRoutes = require('./src/api/challengeRoutes');

// 提取router对象
const poemRoutes = poemRoutesModule.router;
const learningRoutes = learningRoutesModule.router;
const mistakesRoutes = mistakesRoutesModule.router;
const recommendRoutes = recommendRoutesModule.router;

// 导入工具和配置
const config = require('./src/config/config');
const dataLoader = require('./src/utils/dataLoader');

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// 确保JSON解析器使用UTF-8编码
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
// 静态文件服务（如果需要）
app.use(express.static('public'));

// 设置响应编码
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// 打印请求体以调试编码问题
app.use((req, res, next) => {
  if (req.method === 'POST' && (req.path === '/api/ai/recite-check' || req.path === '/api/creation/novice/generate')) {
    console.log('接收到的请求体:', req.body);
    if (req.rawBody) {
      console.log('原始请求体:', req.rawBody.toString('utf8'));
    }
  }
  next();
});

// 加载真实诗词数据
let poems = [];

// 初始化加载诗词数据
async function initData() {
  try {
    // 初始化数据库
    await initDatabase();
    console.log('数据库初始化完成');
    
    // 从数据库加载诗词数据
    poems = await dataLoader.loadPoems();
    console.log('诗词数据加载完成');
  } catch (error) {
    console.error('初始化数据失败:', error);
    // 使用默认数据作为备用
    poems = dataLoader.useDefaultPoems();
  }
}

// 初始化数据
initData().then(async () => {
  // 设置诗词数据到各模块
  poemRoutesModule.setPoems(poems);
  
  // 初始化学习记录
  learningRoutesModule.initLearningRecords(poems);
  
  // 初始化错题本
  mistakesRoutesModule.initMistakes();
  
  // 设置推荐路由的诗词数据
  recommendRoutesModule.setPoems(poems);
  
  // 初始化教师相关表
  try {
    // 直接在 teacherRoutes.js 中初始化，不需要在这里调用
    console.log('教师相关表初始化完成');
  } catch (error) {
    console.error('教师相关表初始化失败:', error);
  }
  
  // 初始化创作模块数据表
  /*try {
    await initCreationTables();
    console.log('创作模块数据表初始化完成');
  } catch (error) {
    console.error('创作模块数据表初始化失败:', error);
  }*/
  
  console.log('所有模块初始化完成');
  console.log(`诗词数据数量: ${poems.length}`);
});

// 基础路由
app.get('/', (req, res) => {
  res.send('古诗词学习系统 API');
});

// 测试POST请求的端点
app.post('/api/test', (req, res) => {
  console.log('接收到测试POST请求:', req.body);
  res.json({ message: '测试成功', data: req.body });
});

// 设置路由
// 诗词相关路由
app.use('/api', poemRoutes);

// AI相关路由
app.use('/api/ai', aiRoutes);

// 学习记录相关路由
app.use('/api/learn', learningRoutes);

// 错题本相关路由
app.use('/api/mistakes', mistakesRoutes);

// 推荐学习相关路由
app.use('/api/recommend', recommendRoutes);

// 用户认证相关路由
app.use('/api/auth', authRoutes);

// 收藏相关路由
app.use('/api/collections', collectionsRoutes);

// 飞花令游戏相关路由
app.use('/api/feihua', feihuaRoutes);

// 教师相关路由
app.use('/api/teacher', teacherRoutes);

// 创作模块路由
const creationRoutes = require('./src/api/creationRoutes');
app.use('/api/creation', creationRoutes);

// 闯关模块路由
app.use('/api/challenge', challengeRoutes);

// 导出poems变量，供其他模块使用
module.exports = { poems };

// 导入 socket 逻辑
const setupSocket = require('./src/socket');
setupSocket(io);

// 暴露io实例为全局变量，供其他模块使用
global.io = io;

// 启动服务器
server.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});