
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

console.log('=== 检查《卜算子》 ===');

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
    console.log('找到诗词:');
    console.log('  ID: ' + row.id);
    console.log('  标题: ' + row.title);
    console.log('  作者: ' + row.author);
    console.log('  内容: ' + row.content);
    
    if (row.content.indexOf('枫落吴江冷') !== -1) {
      console.log('');
      console.log('⚠️  发现错误！应该是"寂寞沙洲冷"而非"枫落吴江冷"');
      
      const correctContent = '缺月挂疏桐，漏断人初静。时见幽人独往来，缥缈孤鸿影。惊起却回头，有恨无人省。拣尽寒枝不肯栖，寂寞沙洲冷。';
      
      db.run('UPDATE poems SET content = ? WHERE id = ?', [correctContent, row.id], function(err) {
        if (err) {
          console.error('更新失败:', err);
        } else {
          console.log('✓ 已成功修复！');
          console.log('  修复后内容: ' + correctContent);
        }
        db.close();
      });
    }
  });
  
  if (rows.length &gt; 0 &amp;&amp; rows[0].content.indexOf('枫落吴江冷') === -1) {
    db.close();
  }
});
