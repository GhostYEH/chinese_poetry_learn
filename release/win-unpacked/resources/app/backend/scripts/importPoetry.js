/**
 * 诗词数据导入脚本
 * 将 poetry 文件夹中的诗词数据导入到数据库
 */
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const POETRY_DIR = path.join(__dirname, '../../poetry');

const DYNASTY_MAP = {
  '全唐诗': '唐',
  '御定全唐詩': '唐',
  '宋词': '宋',
  '五代诗词': '五代',
  '元曲': '元',
  '诗经': '先秦',
  '楚辞': '先秦',
  '汉赋': '汉',
  '汉乐府': '汉',
  '蒙学': '宋',
  '四书五经': '先秦',
  '曹操诗集': '魏晋'
};

const SKIP_FILES = [
  'datas.json',
  'authors.song.json',
  'authors.tang.json',
  'author.song.json',
  'README.md'
];

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
        tags TEXT
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

function getJsonFiles(dir, files = []) {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      if (item.startsWith('.') || item === 'node_modules') continue;
      const fullPath = path.join(dir, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          if (item !== 'loader' && item !== 'rank' && item !== 'strains') {
            getJsonFiles(fullPath, files);
          }
        } else if (item.endsWith('.json') && !SKIP_FILES.includes(item)) {
          files.push(fullPath);
        }
      } catch (e) {}
    }
  } catch (e) {}
  return files;
}

function getDynasty(filePath) {
  const parts = filePath.split(path.sep);
  for (const part of parts) {
    if (DYNASTY_MAP[part]) return DYNASTY_MAP[part];
  }
  return '唐';
}

function parsePoems(data, dynasty) {
  const poems = [];
  
  if (!Array.isArray(data)) return poems;
  
  for (const item of data) {
    try {
      let title = item.title || item.rhythmic || item.name || '';
      let author = item.author || item.作者 || '';
      let content = '';
      
      if (item.paragraphs && Array.isArray(item.paragraphs)) {
        content = item.paragraphs.join('\n');
      } else if (item.content) {
        content = Array.isArray(item.content) ? item.content.join('\n') : item.content;
      } else if (item.sentences && Array.isArray(item.sentences)) {
        content = item.sentences.map(s => Array.isArray(s) ? s.join('') : s).join('\n');
      }
      
      content = content.trim();
      title = title.trim();
      author = author.trim();
      
      if (title && author && content) {
        poems.push({
          title: title,
          author: author,
          dynasty: dynasty,
          content: content,
          tags: ''
        });
      }
    } catch (e) {}
  }
  
  return poems;
}

function insertPoems(db, poems) {
  return new Promise((resolve, reject) => {
    if (poems.length === 0) {
      resolve(0);
      return;
    }
    
    let inserted = 0;
    let pending = poems.length;
    
    const stmt = db.prepare('INSERT INTO poems (title, author, dynasty, content, tags) VALUES (?, ?, ?, ?, ?)');
    
    for (const poem of poems) {
      stmt.run(poem.title, poem.author, poem.dynasty, poem.content, poem.tags, (err) => {
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
  console.log('开始导入诗词数据...\n');

  let db;
  try {
    db = await initDb();
    await createTable(db);
    await clearTable(db);
    console.log('数据库初始化完成\n');

    const jsonFiles = getJsonFiles(POETRY_DIR);
    console.log(`找到 ${jsonFiles.length} 个诗词 JSON 文件\n`);

    let totalCount = 0;
    let processedFiles = 0;
    const limitFiles = 50;

    for (const file of jsonFiles) {
      if (processedFiles >= limitFiles) {
        console.log(`\n已达到限制 ${limitFiles} 个文件，停止导入`);
        break;
      }
      
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const data = JSON.parse(content);
        const dynasty = getDynasty(file);
        
        const poems = parsePoems(data, dynasty);
        
        if (poems.length > 0) {
          const count = await insertPoems(db, poems);
          totalCount += count;
          console.log(`[${processedFiles + 1}] ${path.basename(file)}: 导入 ${count} 首 (${dynasty})`);
        }
        
        processedFiles++;
      } catch (err) {
        console.log(`[${processedFiles + 1}] ${path.basename(file)}: 跳过 (${err.message})`);
        processedFiles++;
      }
    }

    console.log(`\n导入完成！共导入 ${totalCount} 首诗词`);

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
      db.close((err) => {
        if (err) console.log('关闭数据库时出错:', err.message);
        else console.log('\n数据库已关闭');
      });
    }
  }
}

main();
