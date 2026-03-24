// 缓存工具函数
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');

// 内存缓存（二级缓存）
const memoryCache = new Map();
const MAX_MEMORY_CACHE_SIZE = 100; // 最大内存缓存数量

// 确保缓存目录存在
function ensureCacheDirectory() {
  const cacheDir = path.join(__dirname, '../../', config.cache.directory);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

// 生成缓存键
function getCacheKey(title, author, explanationType) {
  return `${title || 'unknown'}-${author || 'unknown'}-${explanationType || 'all'}`;
}

// 生成缓存文件名
function getCacheFilePath(title, author, explanationType) {
  const cacheDir = ensureCacheDirectory();
  // 使用 MD5 生成唯一且安全的文件名
  const data = getCacheKey(title, author, explanationType);
  const hash = crypto.createHash('md5').update(data).digest('hex');
  return path.join(cacheDir, `${hash}.json`);
}

// 读取缓存（先尝试内存缓存，再尝试文件缓存）
function readCache(title, author, explanationType) {
  try {
    // 1. 尝试从内存缓存读取
    const cacheKey = getCacheKey(title, author, explanationType);
    if (memoryCache.has(cacheKey)) {
      console.log('命中内存缓存:', cacheKey);
      return memoryCache.get(cacheKey);
    }
    
    // 2. 尝试从文件缓存读取
    const filePath = getCacheFilePath(title, author, explanationType);
    if (fs.existsSync(filePath)) {
      const cachedData = fs.readFileSync(filePath, 'utf8');
      const parsedData = JSON.parse(cachedData);
      
      // 将文件缓存同步到内存缓存
      setMemoryCache(cacheKey, parsedData);
      console.log('命中文件缓存:', filePath);
      return parsedData;
    }
    return null;
  } catch (err) {
    console.error('读取缓存失败:', err);
    return null;
  }
}

// 写入缓存（同时写入内存缓存和文件缓存）
function writeCache(title, author, explanationType, data) {
  try {
    // 1. 写入内存缓存
    const cacheKey = getCacheKey(title, author, explanationType);
    setMemoryCache(cacheKey, data);
    
    // 2. 写入文件缓存
    const filePath = getCacheFilePath(title, author, explanationType);
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
    return true;
  } catch (err) {
    console.error('写入缓存失败:', err);
    return false;
  }
}

// 设置内存缓存（带大小限制）
function setMemoryCache(key, data) {
  // 如果内存缓存达到上限，删除最旧的条目
  if (memoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
    const oldestKey = memoryCache.keys().next().value;
    memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, data);
}

// 清空内存缓存
function clearMemoryCache() {
  memoryCache.clear();
  console.log('内存缓存已清空');
}

module.exports = {
  getCacheFilePath,
  readCache,
  writeCache,
  ensureCacheDirectory,
  clearMemoryCache
};
