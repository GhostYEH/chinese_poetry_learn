
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

console.log('=== 验证已修复的诗词 ===\n');

// 验证静夜思
db.all('SELECT id, title, author, content FROM poems WHERE id = 1803', function(err, rows) {
  if (err) {
    console.error(err);
  } else {
    console.log('【静夜思 (ID 1803)】');
    rows.forEach(function(row) {
      console.log('  标题: ' + row.title);
      console.log('  作者: ' + row.author);
      console.log('  内容: ' + row.content);
      if (row.content.indexOf('举头望明月') !== -1) {
        console.log('  ✓ 正确');
      } else {
        console.log('  ⚠️  还有问题');
      }
    });
  }
  
  // 验证卜算子
  db.all('SELECT id, title, author, content FROM poems WHERE id = 1900', function(err, rows) {
    if (err) {
      console.error(err);
    } else {
      console.log('\n【卜算子 (ID 1900)】');
      rows.forEach(function(row) {
        console.log('  标题: ' + row.title);
        console.log('  作者: ' + row.author);
        console.log('  内容: ' + row.content);
        if (row.content.indexOf('寂寞沙洲冷') !== -1) {
          console.log('  ✓ 正确');
        } else {
          console.log('  ⚠️  还有问题');
        }
      });
    }
    db.close();
  });
});
