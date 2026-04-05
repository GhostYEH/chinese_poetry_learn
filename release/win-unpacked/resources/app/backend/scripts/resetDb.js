const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/poetry.db');

db.serialize(() => {
  db.run('DROP TABLE IF EXISTS poems');
  db.run(`
    CREATE TABLE poems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      dynasty TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      UNIQUE(title, author)
    )
  `, (err) => {
    if (err) console.log('错误:', err);
    else console.log('表已重建，添加了唯一约束，现在可以重新运行导入脚本');
    db.close();
  });
});
