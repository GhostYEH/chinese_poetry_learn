/**
 * 进一步诊断：查看 poems ID 分布
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function diagnose() {
  // ID 分布
  const idRange = await query('SELECT MIN(id) as min_id, MAX(id) as max_id FROM poems');
  console.log(`poems ID 范围: ${idRange.min_id} ~ ${idRange.max_id}`);

  // 统计不同区间的数量
  const small = await query('SELECT COUNT(*) as count FROM poems WHERE id <= 100');
  const mid = await query('SELECT COUNT(*) as count FROM poems WHERE id > 100 AND id <= 1000');
  const large = await query('SELECT COUNT(*) as count FROM poems WHERE id > 1000');
  console.log(`  - ID <= 100: ${small.count} 首`);
  console.log(`  - 100 < ID <= 1000: ${mid.count} 首`);
  console.log(`  - ID > 1000: ${large.count} 首`);

  // 小 ID 的诗词
  console.log('\n【小 ID 诗词 (ID <= 50)】');
  const smallPoems = await queryAll('SELECT id, title, author, dynasty FROM poems WHERE id <= 50');
  smallPoems.forEach(p => console.log(`  - ID:${p.id} 《${p.title}》 ${p.author} ${p.dynasty}`));

  // 查看 learning_records 中的 poem_id 范围
  const lrRange = await query('SELECT MIN(poem_id) as min_id, MAX(poem_id) as max_id FROM learning_records');
  console.log(`\nlearning_records poem_id 范围: ${lrRange.min_id} ~ ${lrRange.max_id}`);

  // 看看 poems 表中有没有标题能匹配的
  console.log('\n【尝试通过标题匹配】');
  // 查几条 learning_records 看看原来可能是什么诗
  const lrSamples = await queryAll('SELECT DISTINCT poem_id FROM learning_records WHERE poem_id <= 50 LIMIT 10');
  console.log('learning_records 中出现过的旧 poem_id:', lrSamples.map(r => r.poem_id).join(', '));

  // 查看 wrong_questions 表的结构和数据
  console.log('\n【wrong_questions 表结构】');
  const wqSchema = await queryAll("PRAGMA table_info(wrong_questions)");
  wqSchema.forEach(col => console.log(`  - ${col.name}: ${col.type}`));

  // wrong_questions 示例
  console.log('\n【wrong_questions 示例】');
  const wqSamples = await queryAll('SELECT id, user_id, title, author, full_poem FROM wrong_questions LIMIT 10');
  wqSamples.forEach(r => console.log(`  - [${r.id}] user=${r.user_id} title="${r.title}" author="${r.author}" poem="${(r.full_poem || '').substring(0, 20)}..."`));

  // 查看 collections 的 poem_id 范围
  const colRange = await query('SELECT MIN(poem_id) as min_id, MAX(poem_id) as max_id FROM collections');
  console.log(`\ncollections poem_id 范围: ${colRange.min_id} ~ ${colRange.max_id}`);

  // 看看 wrong_questions 中有多少能通过 full_poem 匹配到 poems 表
  console.log('\n【wrong_questions 能否用 full_poem 匹配】');
  const wqWithPoem = await queryAll(`
    SELECT wq.id, wq.title, wq.author, wq.full_poem, p.id as matched_id, p.title as matched_title
    FROM wrong_questions wq
    LEFT JOIN poems p ON wq.full_poem = p.content
    WHERE wq.full_poem IS NOT NULL AND wq.full_poem != ''
    LIMIT 10
  `);
  let matched = 0, unmatched = 0;
  wqWithPoem.forEach(r => {
    if (r.matched_id) {
      matched++;
      console.log(`  ✓ [${r.id}] "${r.title}" => matched ID:${r.matched_id} 《${r.matched_title}》`);
    } else {
      unmatched++;
      console.log(`  ✗ [${r.id}] "${r.title}" => NOT matched, poem: "${(r.full_poem || '').substring(0, 30)}..."`);
    }
  });

  console.log(`\n  匹配统计: 匹配 ${matched}, 未匹配 ${unmatched} (抽样10条)`);

  db.close();
}

function query(sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function queryAll(sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

diagnose().catch(err => {
  console.error('诊断失败:', err);
  db.close();
});
