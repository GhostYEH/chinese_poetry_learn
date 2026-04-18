
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const POETRY_DIR = path.join(__dirname, '../../poetry');

function initDb() {
  return new Promise((resolve, reject) =&gt; {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) =&gt; {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

async function clearTable(db) {
  return new Promise((resolve, reject) =&gt; {
    db.run('DELETE FROM poems', (err) =&gt; {
      if (err) reject(err);
      else resolve();
    });
  });
}

function insertPoems(db, poems) {
  return new Promise((resolve, reject) =&gt; {
    if (poems.length === 0) {
      resolve(0);
      return;
    }
    
    let inserted = 0;
    let pending = poems.length;
    
    const stmt = db.prepare('INSERT INTO poems (title, author, dynasty, content, tags) VALUES (?, ?, ?, ?, ?)');
    
    for (const poem of poems) {
      stmt.run(poem.title, poem.author, poem.dynasty, poem.content, poem.tags, (err) =&gt; {
        pending--;
        if (!err) inserted++;
        if (pending === 0) {
          stmt.finalize();
          resolve(inserted);
        }
      });
    }
  });
}

async function main() {
  console.log('开始导入精选诗词数据...\n');

  let db;
  try {
    db = await initDb();
    await clearTable(db);
    console.log('数据库已清空\n');

    const poems = [];
    
    const files = [
      path.join(POETRY_DIR, '全唐诗', '唐诗三百首.json'),
      path.join(POETRY_DIR, '宋词', '宋词三百首.json')
    ];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const data = JSON.parse(content);
        
        for (const item of data) {
          try {
            let title = item.title || item.rhythmic || item.name || '';
            let author = item.author || item.作者 || '';
            let dynasty = file.indexOf('唐诗') &gt; -1 ? '唐' : '宋';
            let contentText = '';
            let tags = (item.tags || []).join(',');
            
            if (item.paragraphs &amp;&amp; Array.isArray(item.paragraphs)) {
              contentText = item.paragraphs.join('');
            }
            
            contentText = contentText.trim();
            title = title.trim();
            author = author.trim();
            
            if (title &amp;&amp; author &amp;&amp; contentText) {
              poems.push({
                title: title,
                author: author,
                dynasty: dynasty,
                content: contentText,
                tags: tags
              });
            }
          } catch (e) {}
        }
        
        console.log(`${path.basename(file)}: 解析出 ${poems.length} 首`);
      } catch (err) {
        console.log(`${path.basename(file)}: 错误 - ${err.message}`);
      }
    }

    console.log(`\n共找到 ${poems.length} 首诗词`);
    const count = await insertPoems(db, poems);
    console.log(`成功导入 ${count} 首诗词`);

  } catch (err) {
    console.error('导入失败:', err);
  } finally {
    if (db) {
      db.close((err) =&gt; {
        if (err) console.log('关闭数据库时出错:', err.message);
        else console.log('\n数据库已关闭');
      });
    }
  }
}

main();
