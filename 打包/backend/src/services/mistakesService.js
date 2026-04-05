// 错题本服务
const { db } = require('../utils/db');
let mistakes = {};

// 初始化错题本
function initMistakes() {
  console.log('错题本服务初始化完成');
  return;
}

// 添加错题
function addMistake(userId, poemId, score, poemTitle, poemAuthor, originalText, inputText) {
  return new Promise(function(resolve, reject) {
    db.get('SELECT * FROM mistakes WHERE user_id = ? AND poem_id = ?', [userId, poemId], function(err, row) {
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
          function(err) {
            if (err) {
              console.error('更新错题失败:', err);
              reject(err);
              return;
            }

            const updatedMistake = {};
            updatedMistake.id = row.id;
            updatedMistake.user_id = row.user_id;
            updatedMistake.poem_id = row.poem_id;
            updatedMistake.mistake_content = row.mistake_content;
            updatedMistake.mistake_type = row.mistake_type;
            updatedMistake.created_at = row.created_at;
            updatedMistake.score = score;
            updatedMistake.updated_at = updatedAt;
            updatedMistake.original_text = originalText;
            updatedMistake.input_text = inputText;

            // 更新内存缓存
            const cacheKey = String(userId) + ':' + String(poemId);
            mistakes[cacheKey] = updatedMistake;

            resolve(updatedMistake);
          }
        );
      } else {
        // 创建新错题
        const now = new Date().toISOString();
        let mistakeContent = '得分: ' + score + ', 原文: ' + originalText.substring(0, 50) + '...';
        db.run(
          'INSERT INTO mistakes (user_id, poem_id, mistake_content, mistake_type, created_at) VALUES (?, ?, ?, ?, ?)',
          [userId, poemId, mistakeContent, '背诵错误', now],
          function(err) {
            if (err) {
              console.error('添加错题失败:', err);
              reject(err);
              return;
            }

            const newMistake = {};
            newMistake.id = this.lastID;
            newMistake.user_id = userId;
            newMistake.poem_id = poemId;
            newMistake.score = score;
            newMistake.created_at = now;
            newMistake.updated_at = now;
            newMistake.poem_title = poemTitle;
            newMistake.poem_author = poemAuthor;
            newMistake.original_text = originalText;
            newMistake.input_text = inputText;

            // 添加到内存缓存
            const cacheKey = String(userId) + ':' + String(poemId);
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
  return new Promise(function(resolve, reject) {
    db.all(
      'SELECT m.*, p.title as poem_title, p.author as poem_author FROM mistakes m JOIN poems p ON m.poem_id = p.id WHERE m.user_id = ? ORDER BY m.created_at DESC',
      [userId],
      function(err, rows) {
        if (err) {
          console.error('获取错题列表失败:', err);
          reject(err);
          return;
        }

        // 更新内存缓存
        for (let i = 0; i < rows.length; i++) {
          const mistake = rows[i];
          const cacheKey = String(userId) + ':' + String(mistake.poem_id);
          mistakes[cacheKey] = mistake;
        }

        resolve(rows);
      }
    );
  });
}

// 删除错题
function deleteMistake(userId, mistakeId) {
  return new Promise(function(resolve, reject) {
    db.get('SELECT * FROM mistakes WHERE id = ? AND user_id = ?', [mistakeId, userId], function(err, row) {
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
          const cacheKey = String(userId) + ':' + String(row.poem_id);
          delete mistakes[cacheKey];
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  });
}

// 检查并处理错题
function checkAndHandleMistake(userId, poemId, score, poemTitle, poemAuthor, originalText, inputText) {
  return new Promise(function(resolve, reject) {
    if (score < 90) {
      addMistake(userId, poemId, score, poemTitle, poemAuthor, originalText, inputText)
        .then(function(mistake) {
          resolve(mistake);
        })
        .catch(function(err) {
          reject(err);
        });
    } else {
      // 得分高于90，自动移除错题
      db.run('DELETE FROM mistakes WHERE user_id = ? AND poem_id = ?', [userId, poemId], function(err) {
        if (err) {
          console.error('删除错题失败:', err);
          reject(err);
          return;
        }

        // 从内存缓存中删除
        const cacheKey = String(userId) + ':' + String(poemId);
        delete mistakes[cacheKey];
        resolve(null);
      });
    }
  });
}

module.exports = {
  initMistakes: initMistakes,
  addMistake: addMistake,
  getMistakes: getMistakes,
  deleteMistake: deleteMistake,
  checkAndHandleMistake: checkAndHandleMistake
};
