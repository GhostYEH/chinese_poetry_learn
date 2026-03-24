// 错题本服务
const { db } = require('../utils/db');

// 错题数据存储（内存缓存）
let mistakes = {};

// 初始化错题本
function initMistakes() {
  // 从数据库加载错题记录
  // 注意：现在错题需要与用户关联，所以这里不再自动加载所有错题
  // 错题将在用户请求时按用户ID加载
  console.log('错题本服务初始化完成');
}

// 添加错题
function addMistake(userId, poemId, score, poemTitle, poemAuthor, originalText, inputText) {
  return new Promise((resolve, reject) => {
    // 检查是否已经存在相同的错题
    db.get('SELECT * FROM mistakes WHERE user_id = ? AND poem_id = ?', [userId, poemId], (err, row) => {
      if (err) {
        console.error('查询错题失败:', err);
        reject(err);
        return;
      }
      
      if (row) {
        // 更新现有错题
        const updatedAt = new Date().toISOString();
        db.run(
          'UPDATE mistakes SET score = ?, updated_at = ?, original_text = ?, input_text = ? WHERE id = ? AND user_id = ?',
          [score, updatedAt, originalText, inputText, row.id, userId],
          (err) => {
            if (err) {
              console.error('更新错题失败:', err);
              reject(err);
              return;
            }
            
            const updatedMistake = {
              ...row,
              score,
              updated_at: updatedAt,
              original_text: originalText,
              input_text: inputText
            };
            
            // 更新内存缓存
            const cacheKey = `${userId}:${poemId}`;
            mistakes[cacheKey] = updatedMistake;
            
            resolve(updatedMistake);
          }
        );
      } else {
        // 创建新错题
        const now = new Date().toISOString();
        db.run(
          'INSERT INTO mistakes (user_id, poem_id, mistake_content, mistake_type, created_at) VALUES (?, ?, ?, ?, ?)',
          [userId, poemId, `得分: ${score}, 原文: ${originalText.substring(0, 50)}...`, '背诵错误', now],
          function(err) {
            if (err) {
              console.error('添加错题失败:', err);
              reject(err);
              return;
            }
            
            const newMistake = {
              id: this.lastID,
              user_id: userId,
              poem_id: poemId,
              score,
              created_at: now,
              updated_at: now,
              poem_title: poemTitle,
              poem_author: poemAuthor,
              original_text: originalText,
              input_text: inputText
            };
            
            // 添加到内存缓存
            const cacheKey = `${userId}:${poemId}`;
            mistakes[cacheKey] = newMistake;
            
            resolve(newMistake);
          }
        );
      }
    });
  });
}

// 获取错题列表
function getMistakes(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
      SELECT m.*, p.title as poem_title, p.author as poem_author 
      FROM mistakes m
      JOIN poems p ON m.poem_id = p.id
      WHERE m.user_id = ?
      ORDER BY m.created_at DESC
      `,
      [userId],
      (err, rows) => {
        if (err) {
          console.error('获取错题列表失败:', err);
          reject(err);
          return;
        }
        
        // 更新内存缓存
        rows.forEach(mistake => {
          const cacheKey = `${userId}:${mistake.poem_id}`;
          mistakes[cacheKey] = mistake;
        });
        
        resolve(rows);
      }
    );
  });
}

// 删除错题
function deleteMistake(userId, mistakeId) {
  return new Promise((resolve, reject) => {
    // 先获取错题信息，用于更新缓存
    db.get('SELECT * FROM mistakes WHERE id = ? AND user_id = ?', [mistakeId, userId], (err, row) => {
      if (err) {
        console.error('查询错题失败:', err);
        reject(err);
        return;
      }
      
      if (!row) {
        resolve(false);
        return;
      }
      
      db.run('DELETE FROM mistakes WHERE id = ? AND user_id = ?', [mistakeId, userId], function(err) {
        if (err) {
          console.error('删除错题失败:', err);
          reject(err);
          return;
        }
        
        if (this.changes > 0) {
          // 从内存缓存中删除
          const cacheKey = `${userId}:${row.poem_id}`;
          delete mistakes[cacheKey];
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  });
}

// 检查并处理错题（用于背诵检测后自动处理）
function checkAndHandleMistake(userId, poemId, score, poemTitle, poemAuthor, originalText, inputText) {
  return new Promise((resolve, reject) => {
    if (score < 90) {
      addMistake(userId, poemId, score, poemTitle, poemAuthor, originalText, inputText)
        .then(mistake => resolve(mistake))
        .catch(err => reject(err));
    } else {
      // 得分高于90，自动移除错题
      db.run('DELETE FROM mistakes WHERE user_id = ? AND poem_id = ?', [userId, poemId], function(err) {
        if (err) {
          console.error('删除错题失败:', err);
          reject(err);
          return;
        }
        
        // 从内存缓存中删除
        const cacheKey = `${userId}:${poemId}`;
        delete mistakes[cacheKey];
        resolve(null);
      });
    }
  });
}

module.exports = {
  initMistakes,
  addMistake,
  getMistakes,
  deleteMistake,
  checkAndHandleMistake
};
