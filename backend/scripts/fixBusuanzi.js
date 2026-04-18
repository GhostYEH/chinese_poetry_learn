
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

console.log('=== 检查并修复《卜算子》 ===');

db.all('SELECT id, title, author, content FROM poems WHERE title LIKE "%卜算子%"', function(err, rows) {
  if (err) {
    console.error(err);
    db.close();
    return;
  }
  
  if (rows.length === 0) {
    console.log('未找到《卜算子》相关诗词');
    db.close();
    return;
  }
  
  rows.forEach(function(row) {
    console.log('');
    console.log('ID: ' + row.id);
    console.log('标题: ' + row.title);
    console.log('作者: ' + row.author);
    console.log('内容: ' + row.content);
  });
  
  db.close();
});
