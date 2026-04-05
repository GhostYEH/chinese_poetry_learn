const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/poetry.db');

db.all("SELECT dynasty, COUNT(*) as count FROM poems GROUP BY dynasty", (err, rows) => {
  if (err) {
    console.log('错误:', err);
  } else {
    console.log('=== 各朝代诗词数量 ===');
    rows.forEach(r => {
      console.log(`${r.dynasty}: ${r.count} 首`);
    });
  }
  
  db.all("SELECT title, author FROM poems WHERE dynasty = '宋' LIMIT 10", (err2, songs) => {
    if (!err2) {
      console.log('\n=== 宋朝诗词示例 ===');
      songs.forEach((s, i) => {
        console.log(`${i+1}. ${s.title} - ${s.author}`);
      });
    }
    db.close();
  });
});
