/**
 * 增量添加诗词脚本
 * 在现有数据库基础上添加更多诗词，自动去重
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

const ADD_CONFIG = [
  { 
    path: '全唐诗', 
    dynasty: '唐', 
    name: '唐诗',
    targetAdd: 70,
    files: ['唐诗三百首.json', 'poet.tang.0.json', 'poet.tang.1.json', 'poet.tang.2.json']
  },
  { 
    path: '宋词', 
    dynasty: '宋', 
    name: '宋词',
    targetAdd: 70,
    files: ['宋词三百首.json', 'ci.song.0.json', 'ci.song.1.json']
  },
  { 
    path: '元曲', 
    dynasty: '元', 
    name: '元曲',
    targetAdd: 60,
    files: ['yuanqu.json']
  },
];

function initDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE, (err) => {
      if (err) reject(err);
      else resolve(db);
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
      
      if (!title || !author || !content) continue;
      
      title = toSimplified(title);
      author = toSimplified(author);
      content = toSimplified(content);
      tags = toSimplified(tags);
      
      poems.push({
        title: title,
        author: author,
        dynasty: dynasty,
        content: content,
        tags: tags
      });
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

async function getCurrentCount(db, dynasty) {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM poems WHERE dynasty = ?', [dynasty], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
}

async function getTotalCount(db) {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM poems', (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });
}

async function main() {
  console.log('=== 增量添加诗词脚本 ===\n');
  console.log('目标: 在现有基础上添加约200首诗词\n');

  let db;
  try {
    db = await initDb();
    
    const beforeTotal = await getTotalCount(db);
    console.log(`当前数据库共有 ${beforeTotal} 首诗词\n`);

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const config of ADD_CONFIG) {
      console.log(`--- 处理 ${config.name} ---`);
      
      const currentCount = await getCurrentCount(db, config.dynasty);
      console.log(`当前 ${config.dynasty} 诗词: ${currentCount} 首`);
      
      let inserted = 0;
      let skipped = 0;
      
      for (const fileName of config.files) {
        if (inserted >= config.targetAdd) break;
        
        const filePath = path.join(POETRY_DIR, config.path, fileName);
        
        if (!fs.existsSync(filePath)) {
          console.log(`  [跳过] ${fileName}: 文件不存在`);
          continue;
        }
        
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          const poems = parsePoems(data, config.dynasty);
          
          if (poems.length > 0) {
            const needCount = config.targetAdd - inserted;
            const poemsToInsert = poems.slice(0, Math.min(needCount * 2, poems.length));
            
            const result = await insertPoems(db, poemsToInsert);
            inserted += result.inserted;
            skipped += result.skipped;
            
            console.log(`  ${fileName}: 新增 ${result.inserted} 首, 跳过 ${result.skipped} 首重复`);
          }
        } catch (err) {
          console.log(`  [错误] ${fileName}: ${err.message}`);
        }
      }
      
      totalInserted += inserted;
      totalSkipped += skipped;
      console.log(`${config.name} 完成: 新增 ${inserted} 首\n`);
    }

    const afterTotal = await getTotalCount(db);
    
    console.log('=== 导入完成 ===');
    console.log(`新增: ${totalInserted} 首`);
    console.log(`跳过重复: ${totalSkipped} 首`);
    console.log(`导入前总数: ${beforeTotal} 首`);
    console.log(`导入后总数: ${afterTotal} 首`);

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
