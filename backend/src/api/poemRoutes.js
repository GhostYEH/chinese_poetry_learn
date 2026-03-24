// 诗词相关的API路由
const express = require('express');
const router = express.Router();

// 诗词数据（在主服务器文件中加载）
let poems = [];

// 设置诗词数据
function setPoems(data) {
  poems = data;
}

// 获取诗词列表
router.get('/poems', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 30;
  const isRandom = req.query.random === 'true';
  
  if (isRandom) {
    // 随机抽取 pageSize 个不重复的诗词
    const randomPoems = [];
    const tempPoems = [...poems]; // 创建副本以免修改原数组
    
    // 如果请求数量大于总数，返回所有并打乱
    if (pageSize >= tempPoems.length) {
      // Fisher-Yates 洗牌算法
      for (let i = tempPoems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tempPoems[i], tempPoems[j]] = [tempPoems[j], tempPoems[i]];
      }
      return res.json(tempPoems);
    }
    
    // 随机抽取
    const indices = new Set();
    while (indices.size < pageSize) {
      const index = Math.floor(Math.random() * poems.length);
      indices.add(index);
    }
    
    for (const index of indices) {
      randomPoems.push(poems[index]);
    }
    
    return res.json(randomPoems);
  }

  // 计算起始和结束索引
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  
  // 提取分页数据
  const paginatedPoems = poems.slice(startIndex, endIndex);
  
  res.json(paginatedPoems);
});

// 获取诗词详情
router.get('/poems/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const poem = poems.find(p => p.id === id);
  if (poem) {
    res.json(poem);
  } else {
    res.status(404).json({ message: '诗词未找到' });
  }
});

// 获取每日一诗（改为随机一诗）
router.get('/daily-poem', (req, res) => {
  if (poems.length === 0) {
    return res.status(503).json({ message: '数据加载中' });
  }
  
  // 完全随机选择
  const index = Math.floor(Math.random() * poems.length);
  const dailyPoem = poems[index];
  
  res.json(dailyPoem);
});

// 导出router和setPoems函数
module.exports = {
  router,
  setPoems
};
