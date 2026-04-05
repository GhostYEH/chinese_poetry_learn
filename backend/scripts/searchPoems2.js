/**
 * 进一步搜索 poems 表，查找缺失诗词
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function search() {
  // 搜索 "望" 开头的诗
  console.log('【搜索 "望" 开头的诗词】');
  const wang = await queryAll(`SELECT id, title, author FROM poems WHERE title LIKE '望%' ORDER BY id`);
  console.log(`找到 ${wang.length} 首:`);
  wang.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "天门山"
  console.log('\n【搜索 "天门山"】');
  const tianmen = await queryAll(`SELECT id, title, author FROM poems WHERE title LIKE '%天门山%'`);
  console.log(`找到 ${tianmen.length} 首:`);
  tianmen.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "清明" 杜牧
  console.log('\n【搜索 "清明" 杜牧】');
  const qingming = await queryAll(`SELECT id, title, author FROM poems WHERE title LIKE '%清明%'`);
  console.log(`找到 ${qingming.length} 首:`);
  qingming.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "山行" 杜牧
  console.log('\n【搜索 "山行"】');
  const shanxing = await queryAll(`SELECT id, title, author FROM poems WHERE title LIKE '%山行%'`);
  console.log(`找到 ${shanxing.length} 首:`);
  shanxing.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "送元二" 或 "送元二使安西"
  console.log('\n【搜索 "送元二" 或 "阳关"】');
  const yangguan = await queryAll(`SELECT id, title, author FROM poems WHERE title LIKE '%送元%' OR title LIKE '%阳关%' OR title LIKE '%渭城%'`);
  console.log(`找到 ${yangguan.length} 首:`);
  yangguan.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "游山西村" 陆游
  console.log('\n【搜索 "山西村"】');
  const shanxicun = await queryAll(`SELECT id, title, author FROM poems WHERE title LIKE '%山西村%'`);
  console.log(`找到 ${shanxicun.length} 首:`);
  shanxicun.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索 "冬夜读书" 陆游
  console.log('\n【搜索 "冬夜读书"】');
  const dongye = await queryAll(`SELECT id, title, author FROM poems WHERE title LIKE '%冬夜读书%'`);
  console.log(`找到 ${dongye.length} 首:`);
  dongye.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索陆游的诗
  console.log('\n【搜索 "陆游" 的诗（前20首）】');
  const luyou = await queryAll(`SELECT id, title, author FROM poems WHERE author LIKE '%陆游%' LIMIT 20`);
  console.log(`找到前20首:`);
  luyou.forEach(p => console.log(`  - [${p.id}] ${p.title}`));

  // 搜索杜牧的诗
  console.log('\n【搜索 "杜牧" 的诗（前20首）】');
  const dumuzhizhi = await queryAll(`SELECT id, title, author FROM poems WHERE author LIKE '%杜牧%' LIMIT 20`);
  console.log(`找到前20首:`);
  dumuzhizhi.forEach(p => console.log(`  - [${p.id}] ${p.title}`));

  // 搜索 "望洞庭" 刘禹锡
  console.log('\n【搜索 "望洞庭"】');
  const wangdongting = await queryAll(`SELECT id, title, author FROM poems WHERE title LIKE '%望洞庭%'`);
  console.log(`找到 ${wangdongting.length} 首:`);
  wangdongting.forEach(p => console.log(`  - [${p.id}] ${p.title} ${p.author}`));

  // 搜索刘禹锡的诗
  console.log('\n【搜索 "刘禹锡" 的诗（前20首）】');
  const liuyuxi = await queryAll(`SELECT id, title, author FROM poems WHERE author LIKE '%刘禹锡%' LIMIT 20`);
  console.log(`找到前20首:`);
  liuyuxi.forEach(p => console.log(`  - [${p.id}] ${p.title}`));

  // 总共唐诗数量
  console.log('\n【诗词朝代分布】');
  const dynasties = await queryAll(`SELECT dynasty, COUNT(*) as count FROM poems GROUP BY dynasty ORDER BY count DESC`);
  dynasties.forEach(r => console.log(`  ${r.dynasty}: ${r.count} 首`));

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
