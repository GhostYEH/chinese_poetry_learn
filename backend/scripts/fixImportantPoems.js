
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

console.log('开始修复重要诗词...\n');

const poemsToFix = [
  {
    title: '静夜思',
    author: '李白',
    content: '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
  },
  {
    title: '卜算子',
    author: '苏轼',
    content: '缺月挂疏桐，漏断人初静。时见幽人独往来，缥缈孤鸿影。惊起却回头，有恨无人省。拣尽寒枝不肯栖，寂寞沙洲冷。'
  }
];

let fixedCount = 0;
let totalToFix = poemsToFix.length;

for (let i = 0; i &lt; poemsToFix.length; i++) {
  (function(index) {
    const poem = poemsToFix[index];
    
    db.all('SELECT id, title, author, content FROM poems WHERE title LIKE ? AND author LIKE ?', 
      ['%' + poem.title + '%', '%' + poem.author + '%'], 
      function(err, rows) {
        if (err) {
          console.error(err);
        } else if (rows.length &gt; 0) {
          for (let j = 0; j &lt; rows.length; j++) {
            const row = rows[j];
            console.log('找到: [' + row.id + '] ' + row.title + ' - ' + row.author);
            console.log('  当前: ' + row.content);
            
            db.run('UPDATE poems SET content = ? WHERE id = ?', 
              [poem.content, row.id], 
              function(err) {
                if (err) {
                  console.error('  修复失败:', err);
                } else {
                  console.log('  ✓ 已修复为: ' + poem.content);
                  fixedCount++;
                }
                
                if (fixedCount &gt;= totalToFix) {
                  console.log('\n修复完成！');
                  db.close();
                }
              }
            );
          }
        } else {
          console.log('未找到: ' + poem.title + ' - ' + poem.author);
          totalToFix--;
          if (fixedCount &gt;= totalToFix) {
            console.log('\n修复完成！');
            db.close();
          }
        }
      }
    );
  })(i);
}
