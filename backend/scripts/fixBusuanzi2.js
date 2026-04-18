
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

console.log('=== 修复苏轼《卜算子》 ===');

const correctContent = '缺月挂疏桐，漏断人初静。时见幽人独往来，缥缈孤鸿影。惊起却回头，有恨无人省。拣尽寒枝不肯栖，寂寞沙洲冷。';

db.run('UPDATE poems SET content = ? WHERE id = ?', [correctContent, 1900], function(err) {
  if (err) {
    console.error('更新失败:', err);
    db.close();
    return;
  }
  
  console.log('✓ 已成功修复！');
  
  db.all('SELECT id, title, author, content FROM poems WHERE id = 1900', function(err, rows) {
    if (err) {
      console.error(err);
    } else {
      rows.forEach(function(row) {
        console.log('验证结果:');
        console.log('  ' + row.content);
      });
    }
    db.close();
  });
});
