/**
 * 深度搜索 poems 表，找出不匹配诗词的正确名称
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function search() {
  // 搜索 "庐山" 相关
  console.log('【搜索 "庐山" 相关诗词】');
  const lushan = await queryAll(`SELECT id, title, author, dynasty FROM poems WHERE title LIKE '%庐山%'`);
  console.log(`找到 ${lushan.length} 首:`);
  lushan.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "瀑布" 相关
  console.log('\n【搜索 "瀑布" 相关诗词】');
  const pubu = await queryAll(`SELECT id, title, author, dynasty FROM poems WHERE title LIKE '%瀑布%'`);
  console.log(`找到 ${pubu.length} 首:`);
  pubu.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "钱塘" 相关
  console.log('\n【搜索 "钱塘" 相关诗词】');
  const qiantang = await queryAll(`SELECT id, title, author, dynasty FROM poems WHERE title LIKE '%钱塘%'`);
  console.log(`找到 ${qiantang.length} 首:`);
  qiantang.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "春行" 相关
  console.log('\n【搜索 "春行" 相关诗词】');
  const chunxing = await queryAll(`SELECT id, title, author, dynasty FROM poems WHERE title LIKE '%春行%'`);
  console.log(`找到 ${chunxing.length} 首:`);
  chunxing.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "李白" + "瀑布"
  console.log('\n【搜索 "李白" + "瀑布"】');
  const libaipub = await queryAll(`SELECT id, title, author, dynasty FROM poems WHERE author LIKE '%李白%' AND title LIKE '%瀑布%'`);
  console.log(`找到 ${libaipub.length} 首:`);
  libaipub.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "白居易" + "钱塘"
  console.log('\n【搜索 "白居易" + "钱塘"】');
  const baijuyi = await queryAll(`SELECT id, title, author, dynasty FROM poems WHERE author LIKE '%白居易%' AND title LIKE '%钱塘%'`);
  console.log(`找到 ${baijuyi.length} 首:`);
  baijuyi.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索王之涣的凉州词
  console.log('\n【搜索 "王之涣" 的诗词】');
  const wangzhihuan = await queryAll(`SELECT id, title, author, dynasty FROM poems WHERE author LIKE '%王之涣%'`);
  console.log(`找到 ${wangzhihuan.length} 首:`);
  wangzhihuan.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索李白的所有诗（部分）
  console.log('\n【搜索 "李白" 的诗（前20首）】');
  const libai = await queryAll(`SELECT id, title, author FROM poems WHERE author LIKE '%李白%' LIMIT 20`);
  console.log(`找到前20首:`);
  libai.forEach(p => console.log(`  - [${p.id}] ${p.title}`));

  // 搜索白居易的诗
  console.log('\n【搜索 "白居易" 的诗（前20首）】');
  const baijuyi2 = await queryAll(`SELECT id, title, author FROM poems WHERE author LIKE '%白居易%' LIMIT 20`);
  console.log(`找到前20首:`);
  baijuyi2.forEach(p => console.log(`  - [${p.id}] ${p.title}`));

  db.close();
}

function queryAll(sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

search().catch(err => { console.error(err); db.close(); });
