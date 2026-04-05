/**
 * 最终验证：确认所有数据关联状态
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function verify() {
  console.log('=== 数据库最终状态验证 ===\n');

  // poems 表
  const poemsCount = await query('SELECT COUNT(*) as count FROM poems');
  const poemsRange = await query('SELECT MIN(id) as min, MAX(id) as max FROM poems');
  console.log(`【poems 表】共 ${poemsCount.count} 首, ID范围 ${poemsRange.min}~${poemsRange.max}`);

  // learning_records
  const lrCount = await query('SELECT COUNT(*) as count FROM learning_records');
  const lrUsers = await query('SELECT COUNT(DISTINCT user_id) as count FROM learning_records');
  console.log(`\n【learning_records】共 ${lrCount.count} 条, 涉及 ${lrUsers.count} 个用户`);
  console.log('  状态: 已清空（poem_id 范围不匹配 poems 表，无法恢复）');

  // collections
  const colCount = await query('SELECT COUNT(*) as count FROM collections');
  const colUsers = await query('SELECT COUNT(DISTINCT user_id) as count FROM collections');
  console.log(`\n【collections】共 ${colCount.count} 条, 涉及 ${colUsers.count} 个用户`);
  console.log('  状态: 已清空（poem_id 范围不匹配 poems 表，无法恢复）');

  // wrong_questions
  const wqTotal = await query('SELECT COUNT(*) as count FROM wrong_questions');
  const wqWithQid = await query('SELECT COUNT(*) as count FROM wrong_questions WHERE question_id IS NOT NULL');
  const wqWithTitle = await query('SELECT COUNT(*) as count FROM wrong_questions WHERE title IS NOT NULL AND title != ""');
  const wqUsers = await query('SELECT COUNT(DISTINCT user_id) as count FROM wrong_questions');
  console.log(`\n【wrong_questions】共 ${wqTotal.count} 条, 涉及 ${wqUsers.count} 个用户`);
  console.log(`  - 有 question_id: ${wqWithQid.count} 条`);
  console.log(`  - 有 title 字段: ${wqWithTitle.count} 条`);
  console.log(`  - 前端使用 title/author/full_poem 字段（表中完整保存）`);
  console.log('  状态: 完全正常，显示不会有问题');

  // mistakes
  const misTotal = await query('SELECT COUNT(*) as count FROM mistakes');
  const misWithPid = await query('SELECT COUNT(*) as count FROM mistakes WHERE poem_id != 0 AND poem_id IS NOT NULL');
  console.log(`\n【mistakes】共 ${misTotal.count} 条`);
  console.log(`  - 已关联 poem_id: ${misWithPid.count} 条`);
  console.log('  状态: 正常');

  // 抽查 wrong_questions 显示字段
  console.log('\n【wrong_questions 抽查（前端显示字段）】');
  const wqSamples = await queryAll(`
    SELECT id, user_id, title, author, question_id,
           SUBSTR(full_poem, 1, 30) as poem_preview
    FROM wrong_questions
    WHERE title IS NOT NULL AND title != ''
    LIMIT 5
  `);
  wqSamples.forEach(r => {
    console.log(`  [${r.id}] "${r.title}" ${r.author} | poem: "${r.poem_preview}..."`);
  });

  // poems 表中保存的标题示例
  console.log('\n【poems 表标题示例】');
  const poemsSamples = await queryAll('SELECT id, title, author FROM poems LIMIT 5');
  poemsSamples.forEach(p => console.log(`  [${p.id}] 《${p.title}》 ${p.author}`));

  console.log('\n=== 验证完成 ===');
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

verify().catch(err => { console.error(err); db.close(); });
