
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

console.log('开始修复重要诗词...\n');

function fixJingyesi() {
  db.all('SELECT id, title, author, content FROM poems WHERE id = 1803', function(err, rows) {
    if (err) {
      console.error(err);
    } else if (rows.length &gt; 0) {
      const row = rows[0];
      console.log('找到静夜思 (ID 1803):');
      console.log('  当前内容: ' + row.content);
      
      const correct = '床前明月光，疑是地上霜。举头望明月，低头思故乡。';
      db.run('UPDATE poems SET content = ? WHERE id = 1803', [correct], function(err) {
        if (err) {
          console.error('  修复失败:', err);
        } else {
          console.log('  ✓ 已修复为: ' + correct);
        }
        fixBusuanzi();
      });
    } else {
      console.log('未找到静夜思');
      fixBusuanzi();
    }
  });
}

function fixBusuanzi() {
  db.all('SELECT id, title, author, content FROM poems WHERE id = 1900', function(err, rows) {
    if (err) {
      console.error(err);
    } else if (rows.length &gt; 0) {
      const row = rows[0];
      console.log('\n找到卜算子 (ID 1900):');
      console.log('  当前内容: ' + row.content);
      
      const correct = '缺月挂疏桐，漏断人初静。时见幽人独往来，缥缈孤鸿影。惊起却回头，有恨无人省。拣尽寒枝不肯栖，寂寞沙洲冷。';
      db.run('UPDATE poems SET content = ? WHERE id = 1900', [correct], function(err) {
        if (err) {
          console.error('  修复失败:', err);
        } else {
          console.log('  ✓ 已修复为: ' + correct);
        }
        console.log('\n修复完成！');
        db.close();
      });
    } else {
      console.log('\n未找到卜算子');
      console.log('\n修复完成！');
      db.close();
    }
  });
}

fixJingyesi();
