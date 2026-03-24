// 添加class_id字段到users表
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, './db/poetry.db');

// 创建数据库连接
let db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  } else {
    console.log('成功连接到SQLite数据库');
    addClassIdColumn();
  }
});

// 添加class_id字段到users表
function addClassIdColumn() {
  db.run(`
    ALTER TABLE users ADD COLUMN class_id INTEGER DEFAULT NULL
  `, (err) => {
    if (err) {
      console.error('添加class_id字段失败:', err.message);
    } else {
      console.log('成功添加class_id字段到users表');
    }
    
    // 关闭数据库连接
    db.close();
    process.exit(0);
  });
}