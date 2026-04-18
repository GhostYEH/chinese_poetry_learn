
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

console.log('=== 开始修复静夜思 ===');

// 先读取静夜思
db.all('SELECT id, title, author, content FROM poems WHERE title LIKE "%静夜思%"', function(err, rows) {
  if (err) {
    console.error(err);
    db.close();
    return;
  }
  
  rows.forEach(function(row) {
    console.log('找到诗词:');
    console.log('  ID: ' + row.id);
    console.log('  标题: ' + row.title);
    console.log('  作者: ' + row.author);
    console.log('  当前内容: ' + row.content);
    
    const correctContent = '床前明月光，疑是地上霜。举头望明月，低头思故乡。';
    
    db.run('UPDATE poems SET content = ? WHERE id = ?', [correctContent, row.id], function(err) {
      if (err) {
        console.error('更新失败:', err);
      } else {
        console.log('✓ 已成功修复！');
        console.log('  修复后内容: ' + correctContent);
      }
      
      // 验证修复
      db.all('SELECT id, title, content FROM poems WHERE id = ?', [row.id], function(err, verifyRows) {
        if (err) {
          console.error(err);
        } else {
          console.log('\n验证结果:');
          verifyRows.forEach(function(v) {
            console.log('  内容: ' + v.content);
          });
        }
        db.close();
      });
    });
  });
});
