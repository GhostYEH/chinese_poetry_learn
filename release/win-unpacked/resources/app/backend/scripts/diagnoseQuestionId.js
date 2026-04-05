/**
 * 诊断 wrong_questions question_id 当前状态
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function diagnose() {
  console.log('=== wrong_questions question_id 诊断 ===\n');

  // 查看 question_id 的值分布
  const dist = await queryAll(`
    SELECT
      CASE
        WHEN question_id IS NULL THEN 'NULL'
        WHEN question_id = 0 THEN '0'
        ELSE '非零'
      END as status,
      COUNT(*) as count
    FROM wrong_questions
    GROUP BY 1
  `);
  console.log('question_id 分布:');
  dist.forEach(r => console.log(`  ${r.status}: ${r.count}`));

  // 查看 question_id 非空/非零的记录
  const withId = await queryAll(`
    SELECT wq.id, wq.title, wq.author, wq.question_id,
           p.id as p_id, p.title as p_title, p.author as p_author
    FROM wrong_questions wq
    LEFT JOIN poems p ON wq.question_id = p.id
    WHERE wq.question_id IS NOT NULL AND wq.question_id != 0
    LIMIT 10
  `);
  console.log('\n有 question_id 的记录（前10条）:');
  withId.forEach(r => {
    const ok = r.p_title ? '✓' : '✗';
    console.log(`  ${ok} wq[${r.id}] question_id=${r.question_id} => p[${r.p_id}] "${r.p_title || '未匹配'}"`);
  });

  // 查看前20条 wrong_questions 的原始数据
  console.log('\nwrong_questions 前20条:');
  const allRows = await queryAll('SELECT id, title, author, question_id FROM wrong_questions LIMIT 20');
  allRows.forEach(r => {
    console.log(`  [${r.id}] title="${r.title}" author="${r.author}" question_id=${r.question_id}`);
  });

  db.close();
}

function query(sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}
function queryAll(sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}

diagnose().catch(err => { console.error(err); db.close(); });
