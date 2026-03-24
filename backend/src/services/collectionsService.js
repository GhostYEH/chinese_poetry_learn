// 收藏服务
const { db } = require('../utils/db');

// 收藏数据存储（内存缓存）
let collections = {};

// 添加收藏
function addCollection(userId, poemId) {
  return new Promise((resolve, reject) => {
    const cacheKey = `${userId}:${poemId}`;
    
    // 检查是否已经收藏
    db.get('SELECT * FROM collections WHERE user_id = ? AND poem_id = ?', [userId, poemId], (err, row) => {
      if (err) {
        console.error('查询收藏失败:', err);
        reject(err);
        return;
      }
      
      if (row) {
        // 已经收藏，直接返回
        resolve(row);
        return;
      }
      
      // 创建新收藏
      const now = new Date().toISOString();
      db.run(
        'INSERT INTO collections (user_id, poem_id, created_at) VALUES (?, ?, ?)',
        [userId, poemId, now],
        function(err) {
          if (err) {
            console.error('添加收藏失败:', err);
            reject(err);
            return;
          }
          
          const newCollection = {
            id: this.lastID,
            user_id: userId,
            poem_id: poemId,
            created_at: now
          };
          
          // 添加到内存缓存
          collections[cacheKey] = newCollection;
          
          resolve(newCollection);
        }
      );
    });
  });
}

// 删除收藏
function removeCollection(userId, poemId) {
  return new Promise((resolve, reject) => {
    const cacheKey = `${userId}:${poemId}`;
    
    db.run('DELETE FROM collections WHERE user_id = ? AND poem_id = ?', [userId, poemId], function(err) {
      if (err) {
        console.error('删除收藏失败:', err);
        reject(err);
        return;
      }
      
      if (this.changes > 0) {
        // 从内存缓存中删除
        delete collections[cacheKey];
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

// 获取用户收藏列表
function getUserCollections(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT c.*, p.title as poem_title, p.author as poem_author, p.content as poem_content 
      FROM collections c
      JOIN poems p ON c.poem_id = p.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
      `,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('获取收藏列表失败:', err);
          reject(err);
          return;
        }
        
        // 更新内存缓存
        rows.forEach(collection => {
          const cacheKey = `${userId}:${collection.poem_id}`;
          collections[cacheKey] = collection;
        });
        
        resolve(rows);
      }
    );
  });
}

// 检查是否收藏
function checkCollection(userId, poemId) {
  return new Promise((resolve, reject) => {
    const cacheKey = `${userId}:${poemId}`;
    
    // 先从缓存获取
    if (collections[cacheKey]) {
      resolve(true);
      return;
    }
    
    // 从数据库获取
    db.get('SELECT * FROM collections WHERE user_id = ? AND poem_id = ?', [userId, poemId], (err, row) => {
      if (err) {
        console.error('查询收藏失败:', err);
        reject(err);
        return;
      }
      
      const isCollected = !!row;
      if (isCollected) {
        collections[cacheKey] = row;
      }
      
      resolve(isCollected);
    });
  });
}

module.exports = {
  addCollection,
  removeCollection,
  getUserCollections,
  checkCollection
};
