const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const db = new sqlite3.Database('./db/poetry.db');

db.all("SELECT DISTINCT dynasty FROM poems", (err, rows) => {
  if (err) {
    console.log('错误:', err);
  } else {
    let output = '=== 数据库中的朝代值 ===\n';
    rows.forEach(r => {
      output += `  "${r.dynasty}"\n`;
    });
    fs.writeFileSync('./朝代值.txt', output, 'utf-8');
    console.log('已写入到 朝代值.txt');
  }
  db.close();
});
