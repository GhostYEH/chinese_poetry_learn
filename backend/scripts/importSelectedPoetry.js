/**
 * 精选诗词导入脚本
 * 只导入唐诗三百首、宋词三百首等经典诗词
 * 自动将繁体字转换为简体中文
 */
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const OpenCC = require('opencc-js');

const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

function toSimplified(text) {
  if (!text) return text;
  return converter(text);
}

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const POETRY_DIR = path.join(__dirname, '../../poetry');

const SELECTED_FILES = [
  { path: '全唐诗/唐诗三百首.json', dynasty: '唐', name: '唐诗三百首' },
  { path: '宋词/宋词三百首.json', dynasty: '宋', name: '宋词三百首' },
  { path: '元曲/yuanqu.json', dynasty: '元', name: '元曲精选', limit: 100 },
];

const CLEAR_BEFORE_IMPORT = true;

function initDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

async function createTable(db) {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS poems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        dynasty TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        UNIQUE(title, author)
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function clearTable(db) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM poems', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function parsePoems(data, dynasty) {
  const poems = [];
  
  if (!Array.isArray(data)) return poems;
  
  for (const item of data) {
    try {
      let title = item.title || item.rhythmic || item.name || '';
      let author = item.author || item.作者 || '';
      let content = '';
      let tags = item.tags ? item.tags.join(',') : '';
      
      if (item.paragraphs && Array.isArray(item.paragraphs)) {
        content = item.paragraphs.join('\n');
      } else if (item.content) {
        content = Array.isArray(item.content) ? item.content.join('\n') : item.content;
      }
      
      content = content.trim();
      title = title.trim();
      author = author.trim();
      
      title = toSimplified(title);
      author = toSimplified(author);
      content = toSimplified(content);
      tags = toSimplified(tags);
      
      if (title && author && content) {
        poems.push({
          title: title,
          author: author,
          dynasty: dynasty,
          content: content,
          tags: tags
        });
      }
    } catch (e) {}
  }
  
  return poems;
}

function insertPoems(db, poems) {
  return new Promise((resolve, reject) => {
    if (poems.length === 0) {
      resolve({ inserted: 0, skipped: 0 });
      return;
    }
    
    let inserted = 0;
    let skipped = 0;
    let pending = poems.length;
    
    const stmt = db.prepare('INSERT OR IGNORE INTO poems (title, author, dynasty, content, tags) VALUES (?, ?, ?, ?, ?)');
    
    for (const poem of poems) {
      stmt.run(poem.title, poem.author, poem.dynasty, poem.content, poem.tags, function(err) {
        pending--;
        if (!err && this.changes > 0) {
          inserted++;
        } else if (!err && this.changes === 0) {
          skipped++;
        }
        if (pending === 0) {
          stmt.finalize();
          resolve({ inserted, skipped });
        }
      });
    }
  });
}

async function main() {
  console.log('=== 精选诗词导入脚本 (繁体转简体) ===\n');
  console.log('将导入以下诗词集:');
  SELECTED_FILES.forEach(f => console.log(`  - ${f.name} (${f.dynasty})${f.limit ? ' (限制' + f.limit + '首)' : ''}`));
  console.log('');

  let db;
  try {
    db = await initDb();
    await createTable(db);
    
    if (CLEAR_BEFORE_IMPORT) {
      await clearTable(db);
      console.log('已清空现有数据\n');
    } else {
      console.log('增量导入模式：保留现有数据\n');
    }
    
    console.log('数据库初始化完成\n');

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const fileConfig of SELECTED_FILES) {
      const filePath = path.join(POETRY_DIR, fileConfig.path);
      
      if (!fs.existsSync(filePath)) {
        console.log(`[跳过] ${fileConfig.name}: 文件不存在`);
        continue;
      }
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        let poems = parsePoems(data, fileConfig.dynasty);
        
        if (fileConfig.limit && poems.length > fileConfig.limit) {
          poems = poems.slice(0, fileConfig.limit);
        }
        
        if (poems.length > 0) {
          const result = await insertPoems(db, poems);
          totalInserted += result.inserted;
          totalSkipped += result.skipped;
          
          let msg = `[成功] ${fileConfig.name}: 导入 ${result.inserted} 首 (${fileConfig.dynasty})`;
          if (result.skipped > 0) {
            msg += `, 跳过 ${result.skipped} 首重复`;
          }
          console.log(msg);
        } else {
          console.log(`[警告] ${fileConfig.name}: 未找到有效诗词`);
        }
      } catch (err) {
        console.log(`[错误] ${fileConfig.name}: ${err.message}`);
      }
    }

    console.log(`\n导入完成！共导入 ${totalInserted} 首精选诗词`);
    if (totalSkipped > 0) {
      console.log(`(共跳过 ${totalSkipped} 首重复诗词)`);
    }

    const rows = await new Promise((resolve, reject) => {
      db.all('SELECT dynasty, COUNT(*) as count FROM poems GROUP BY dynasty ORDER BY count DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    console.log('\n朝代分布:');
    for (const row of rows) {
      console.log(`  ${row.dynasty}: ${row.count} 首`);
    }

    const total = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM poems', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    console.log(`\n数据库总计: ${total} 首诗词`);

    console.log('\n示例诗词:');
    db.get('SELECT title, author, content FROM poems LIMIT 1', (err, row) => {
      if (row) {
        console.log(`  标题: ${row.title}`);
        console.log(`  作者: ${row.author}`);
        console.log(`  内容: ${row.content.substring(0, 50)}...`);
      }
    });

  } catch (err) {
    console.error('导入失败:', err);
  } finally {
    if (db) {
      setTimeout(() => {
        db.close((err) => {
          if (err) console.log('关闭数据库时出错:', err.message);
          else console.log('\n数据库已关闭');
        });
      }, 100);
    }
  }
}

main();
