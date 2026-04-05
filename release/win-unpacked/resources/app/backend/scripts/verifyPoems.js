const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const db = new sqlite3.Database('./db/poetry.db');

db.all('SELECT title, author, content FROM poems LIMIT 5', (err, rows) => {
  if (err) {
    console.log('错误:', err);
  } else {
    let output = '=== 验证繁简转换效果 ===\n\n';
    rows.forEach((r, i) => {
      output += `【诗词 ${i+1}】\n`;
      output += `标题: ${r.title}\n`;
      output += `作者: ${r.author}\n`;
      output += `内容: ${r.content.substring(0, 80)}...\n\n`;
    });
    
    fs.writeFileSync('./验证结果.txt', output, 'utf-8');
    console.log('已写入到 验证结果.txt');
  }
  db.close();
});
