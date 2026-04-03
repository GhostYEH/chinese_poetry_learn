/**
 * 诗词数据导入脚本
 * 将 poetry 文件夹中的诗词数据导入到数据库
 */
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const POETRY_DIR = path.join(__dirname, '../../poetry');

// 朝代映射
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

// 初始化数据库
function initDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(db);
      }
    });
  });
}

// 创建 poems 表
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

// 清空现有数据
async function clearTable(db) {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM poems', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 获取所有 JSON 文件
function getJsonFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getJsonFiles(fullPath, files);
    } else if (item.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

// 判断朝代
function getDynasty(dirPath) {
  const parts = dirPath.split(path.sep);
  for (const part of parts) {
    if (DYNASTY_MAP[part]) {
      return DYNASTY_MAP[part];
    }
  }
  return '唐'; // 默认唐朝
}

// 解析全唐诗格式
function parseTangPoetry(data, dynasty) {
  const poems = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.title && item.author && item.paragraphs) {
        poems.push({
          title: item.title,
          author: item.author,
          dynasty: dynasty,
          content: item.paragraphs.join('\n'),
          tags: ''
        });
      }
    }
  }
  return poems;
}

// 解析宋词格式
function parseSongCi(data, dynasty) {
  const poems = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item.rhythmic && item.author && item.paragraphs) {
        poems.push({
          title: item.rhythmic, // 词牌名作为标题
          author: item.author,
          dynasty: dynasty,
          content: item.paragraphs.join('\n'),
          tags: ''
        });
      }
    }
  }
  return poems;
}

// 通用解析
function parseGeneric(data, dynasty) {
  const poems = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      let title = item.title || item.name || '';
      let author = item.author || item.作者 || '';
      let content = '';

      // 处理不同格式
      if (item.paragraphs) {
        content = item.paragraphs.join('\n');
      } else if (item.content) {
        content = item.content;
      } else if (item.contentArray) {
        content = item.contentArray.join('\n');
      } else if (item.rhythmic) {
        title = item.rhythmic; // 词牌名
      }

      // 处理句子数组
      if (item.sentences && !content) {
        content = item.sentences.map(s => s.join('')).join('\n');
      }

      if (title && author && content) {
        poems.push({
          title: title,
          author: author,
          dynasty: dynasty,
          content: content,
          tags: ''
        });
      }
    }
  }
  return poems;
}

// 插入诗词
function insertPoems(db, poems) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO poems (title, author, dynasty, content, tags) VALUES (?, ?, ?, ?, ?)');
    const insertMany = db.transaction((items) => {
      for (const poem of items) {
        stmt.run(poem.title, poem.author, poem.dynasty, poem.content, poem.tags);
      }
    });
    insertMany(poems);
    stmt.finalize();
    resolve(poems.length);
  });
}

// 主函数
async function main() {
  console.log('开始导入诗词数据...\n');

  try {
    // 初始化数据库
    const db = await initDb();
    await createTable(db);
    await clearTable(db);
    console.log('数据库初始化完成\n');

    // 获取所有 JSON 文件
    const jsonFiles = getJsonFiles(POETRY_DIR);
    console.log(`找到 ${jsonFiles.length} 个 JSON 文件\n`);

    let totalCount = 0;
    let processedFiles = 0;

    // 处理每个文件
    for (const file of jsonFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const data = JSON.parse(content);
        const dynasty = getDynasty(file);
        let poems = [];

        // 根据路径选择解析方式
        if (file.includes('全唐诗') || file.includes('御定全唐詩')) {
          poems = parseTangPoetry(data, dynasty);
        } else if (file.includes('宋词')) {
          poems = parseSongCi(data, dynasty);
        } else {
          poems = parseGeneric(data, dynasty);
        }

        if (poems.length > 0) {
          const count = await insertPoems(db, poems);
          totalCount += count;
          console.log(`[${processedFiles + 1}/${jsonFiles.length}] ${path.basename(file)}: 导入 ${count} 首 (${dynasty})`);
        }

        processedFiles++;
      } catch (err) {
        console.log(`[${processedFiles + 1}/${jsonFiles.length}] ${path.basename(file)}: 跳过 (${err.message})`);
        processedFiles++;
      }
    }

    console.log(`\n导入完成！共导入 ${totalCount} 首诗词`);

    // 显示统计
    db.all('SELECT dynasty, COUNT(*) as count FROM poems GROUP BY dynasty ORDER BY count DESC', (err, rows) => {
      if (!err) {
        console.log('\n朝代分布:');
        for (const row of rows) {
          console.log(`  ${row.dynasty}: ${row.count} 首`);
        }
      }
      db.close();
    });

  } catch (err) {
    console.error('导入失败:', err);
  }
}

main();
