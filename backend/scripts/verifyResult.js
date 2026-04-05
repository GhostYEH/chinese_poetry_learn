const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const db = new sqlite3.Database('./db/poetry.db');

db.all('SELECT dynasty, COUNT(*) as count FROM poems GROUP BY dynasty ORDER BY count DESC', (err, rows) => {
  if (err) {
    console.log('错误:', err);
  } else {
    let output = '=== 导入结果验证 ===\n\n';
    let total = 0;
    rows.forEach(r => {
      output += `${r.dynasty}: ${r.count} 首\n`;
      total += r.count;
    });
    output += `\n总计: ${total} 首\n`;
    fs.writeFileSync('./导入结果.txt', output, 'utf-8');
    console.log('已写入到 导入结果.txt');
  }
  db.close();
});
