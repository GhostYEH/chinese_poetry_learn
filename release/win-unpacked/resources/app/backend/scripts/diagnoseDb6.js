/**
 * 综合诊断：测试修复策略
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function diagnose() {
  console.log('=== 测试各类表的修复策略 ===\n');

  // === wrong_questions 修复策略测试 ===
  console.log('【wrong_questions 修复策略】');

  // 策略1: title + author 精确匹配
  const strategy1 = await query(`
    SELECT COUNT(DISTINCT wq.id) as count
    FROM wrong_questions wq
    JOIN poems p ON wq.title = p.title AND wq.author = p.author
    WHERE wq.title IS NOT NULL AND wq.title != ''
  `);
  console.log(`  策略1 (title+author精确匹配): ${strategy1.count} 条`);

  // 策略2: 仅 title 匹配（可能有重复，但 poems 表 title+author 是唯一的）
  const strategy2 = await query(`
    SELECT COUNT(DISTINCT wq.id) as count
    FROM wrong_questions wq
    JOIN poems p ON wq.title = p.title
    WHERE wq.title IS NOT NULL AND wq.title != ''
  `);
  console.log(`  策略2 (仅title匹配): ${strategy2.count} 条`);

  // 策略3: title 包含匹配
  const strategy3 = await query(`
    SELECT COUNT(DISTINCT wq.id) as count
    FROM wrong_questions wq
    JOIN poems p ON p.title LIKE '%' || wq.title || '%'
    WHERE wq.title IS NOT NULL AND wq.title != ''
  `);
  console.log(`  策略3 (title包含匹配): ${strategy3.count} 条`);

  // 看看具体哪些 title 无法匹配
  console.log('\n  无法 title+author 匹配的 title 列表:');
  const unmatchedTitles = await queryAll(`
    SELECT DISTINCT wq.title, wq.author, COUNT(*) as cnt
    FROM wrong_questions wq
    LEFT JOIN poems p ON wq.title = p.title AND wq.author = p.author
    WHERE wq.title IS NOT NULL AND wq.title != '' AND p.id IS NULL
    GROUP BY wq.title, wq.author
    ORDER BY cnt DESC
  `);
  unmatchedTitles.forEach(r => {
    console.log(`    - "${r.title}" ${r.author} (${r.cnt}条)`);
  });

  // 看看 poems 表中有没有这些诗
  console.log('\n  poems 表中搜索这些诗:');
  const searchTerms = ['望庐山', '庐山瀑布', '钱塘湖', '凉州词', '望天门山', '子夜吴歌'];
  for (const term of searchTerms) {
    const found = await queryAll(`SELECT id, title, author FROM poems WHERE title LIKE '%${term}%' LIMIT 3`);
    console.log(`    搜索 "${term}": ${found.length} 个`);
    found.forEach(p => console.log(`      - [${p.id}] ${p.title} ${p.author}`));
  }

  // === learning_records 修复策略测试 ===
  console.log('\n【learning_records 修复策略】');
  console.log('  关键问题: poem_id 范围 1~2162， poems 表 ID 范围 1493~2918');
  console.log('  交集范围: 1493~2162，共', await query('SELECT COUNT(*) as count FROM learning_records WHERE poem_id >= 1493 AND poem_id <= 2162'), '条');

  // 检查 learning_records poem_id 在 poems ID 范围内有多少
  const inRange = await query(`
    SELECT COUNT(*) as count FROM learning_records lr
    JOIN poems p ON lr.poem_id = p.id
  `);
  console.log(`  poem_id 在 poems 表中有对应记录: ${inRange.count} 条`);

  // === collections 修复策略测试 ===
  console.log('\n【collections 修复策略】');
  const colInRange = await query(`
    SELECT COUNT(*) as count FROM collections c
    JOIN poems p ON c.poem_id = p.id
  `);
  console.log(`  poem_id 在 poems 表中有对应记录: ${colInRange.count} 条`);

  // === mistakes 修复策略测试 ===
  console.log('\n【mistakes 修复策略】');
  const misInRange = await query(`
    SELECT COUNT(*) as count FROM mistakes m
    JOIN poems p ON m.poem_id = p.id
  `);
  console.log(`  poem_id 在 poems 表中有对应记录: ${misInRange.count} 条`);

  // mistakes 通过 mistake_content 中的诗名匹配
  console.log('  通过 mistake_content 匹配:');
  const misContentMatches = await queryAll(`
    SELECT id, user_id, mistake_content, mistake_type
    FROM mistakes
    LIMIT 5
  `);
  misContentMatches.forEach(r => {
    console.log(`    [${r.id}] user=${r.user_id} content="${r.mistake_content.substring(0, 50)}..."`);
  });

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
