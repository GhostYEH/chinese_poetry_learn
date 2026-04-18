
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const POETRY_DIR = path.join(__dirname, '../../poetry');

const db = new sqlite3.Database(DB_PATH);

console.log('开始导入精选诗词数据...\n');

db.serialize(function() {
  db.run('DELETE FROM poems', function(err) {
    if (err) {
      console.error(err);
      db.close();
      return;
    }
    
    console.log('数据库已清空\n');
    
    const files = [
      path.join(POETRY_DIR, '全唐诗', '唐诗三百首.json'),
      path.join(POETRY_DIR, '宋词', '宋词三百首.json')
    ];
    
    let totalInserted = 0;
    let filesProcessed = 0;
    
    function processNextFile() {
      if (filesProcessed &gt;= files.length) {
        console.log('\n导入完成！共导入 ' + totalInserted + ' 首诗词');
        db.close();
        return;
      }
      
      const file = files[filesProcessed];
      filesProcessed++;
      
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const data = JSON.parse(content);
        const dynasty = file.indexOf('唐诗') &gt; -1 ? '唐' : '宋';
        
        let insertedInFile = 0;
        const stmt = db.prepare('INSERT INTO poems (title, author, dynasty, content, tags) VALUES (?, ?, ?, ?, ?)');
        
        for (let i = 0; i &lt; data.length; i++) {
          const item = data[i];
          try {
            let title = item.title || item.rhythmic || item.name || '';
            let author = item.author || item.作者 || '';
            let contentText = '';
            let tags = (item.tags || []).join(',');
            
            if (item.paragraphs &amp;&amp; Array.isArray(item.paragraphs)) {
              contentText = item.paragraphs.join('');
            }
            
            contentText = contentText.trim();
            title = title.trim();
            author = author.trim();
            
            if (title &amp;&amp; author &amp;&amp; contentText) {
              stmt.run(title, author, dynasty, contentText, tags);
              insertedInFile++;
              totalInserted++;
            }
          } catch (e) {}
        }
        
        stmt.finalize(function(err) {
          if (err) console.error(err);
          console.log(path.basename(file) + ': 导入 ' + insertedInFile + ' 首 (' + dynasty + ')');
          processNextFile();
        });
        
      } catch (err) {
        console.log(path.basename(file) + ': 错误 - ' + err.message);
        processNextFile();
      }
    }
    
    processNextFile();
  });
});
