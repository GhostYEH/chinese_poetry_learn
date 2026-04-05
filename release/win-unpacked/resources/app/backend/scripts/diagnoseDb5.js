/**
 * 最终诊断：确定各表修复策略
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function diagnose() {
  // 1. 检查 poems 表 title+author 组合的唯一性
  console.log('【poems title+author 唯一性分析】');
  const uniqueTitles = await queryAll(`
    SELECT title, author, COUNT(*) as cnt, MIN(id) as first_id
    FROM poems
    GROUP BY title, author
    HAVING cnt > 1
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log(`有重复 title+author 的诗词: ${uniqueTitles.length} 组`);
  uniqueTitles.forEach(r => {
    if (r.cnt > 2) {
      console.log(`  "${r.title}" ${r.author}: ${r.cnt} 个`);
    }
  });

  // 2. 检查 poems 内容中的换行符情况
  console.log('\n【poems content 换行符分析】');
  const newlineCheck = await queryAll(`
    SELECT id, title, author,
           LENGTH(content) as total_len,
           LENGTH(REPLACE(content, '\n', '')) as no_newline_len,
           LENGTH(content) - LENGTH(REPLACE(content, '\n', '')) as newline_count
    FROM poems
    WHERE content LIKE '%' || X'0A' || '%'
    LIMIT 5
  `);
  const newlineTotal = await query('SELECT COUNT(*) as count FROM poems WHERE content LIKE \'%\' || X\'0A\' || \'%\'');
  console.log(`  含换行符的诗词: ${newlineTotal.count} 首`);
  console.log(`  示例:`);
  newlineCheck.forEach(r => {
    console.log(`    [${r.id}] "${r.title}" ${r.author}: 长度${r.total_len}, 去换行${r.no_newline_len}, 换行${r.newline_count}个`);
  });

  // 3. 检查 wrong_questions 中未能 title+author 匹配的记录
  console.log('\n【wrong_questions 未匹配 title+author 的记录分析】');
  const unmatchedWQ = await queryAll(`
    SELECT wq.id, wq.title, wq.author, wq.full_poem, p.id as only_title_match
    FROM wrong_questions wq
    LEFT JOIN poems p ON wq.title = p.title
    WHERE wq.title IS NOT NULL AND wq.title != ''
      AND p.id IS NULL
    ORDER BY wq.id
    LIMIT 15
  `);
  console.log(`未匹配记录数: ${unmatchedWQ.length} 条（仅显示前15条）`);
  unmatchedWQ.forEach(r => {
    console.log(`  [${r.id}] title="${r.title}" author="${r.author}"`);
  });

  // 4. 尝试 content 去掉换行后匹配
  console.log('\n【poems content 去掉换行后匹配 wrong_questions】');
  const wqByNormContent = await queryAll(`
    SELECT wq.id, wq.title, wq.author, wq.full_poem,
           p.id as matched_id, p.title as matched_title
    FROM wrong_questions wq
    LEFT JOIN poems p ON
      REPLACE(REPLACE(wq.full_poem, '\n', ''), ' ', '') =
      REPLACE(REPLACE(p.content, '\n', ''), ' ', '')
    WHERE wq.full_poem IS NOT NULL AND wq.full_poem != ''
    LIMIT 20
  `);
  let matched = 0;
  const unmatched = [];
  wqByNormContent.forEach(r => {
    if (r.matched_id) {
      matched++;
      if (matched <= 3) {
        console.log(`  ✓ "${r.title}" => ID:${r.matched_id} 《${r.matched_title}》`);
      }
    } else {
      if (unmatched.length < 5) {
        unmatched.push(r);
      }
    }
  });
  console.log(`  抽样20条: 匹配 ${matched}`);
  unmatched.forEach(r => {
    console.log(`  ✗ "${r.title}" 诗: "${r.full_poem}"`);
  });

  // 5. wrong_questions 总体匹配率（规范化内容匹配）
  console.log('\n【wrong_questions 规范化内容匹配总体统计】');
  const totalWQ = await query('SELECT COUNT(*) as count FROM wrong_questions WHERE full_poem IS NOT NULL AND full_poem != ""');
  const matchedWQ = await query(`
    SELECT COUNT(DISTINCT wq.id) as count
    FROM wrong_questions wq
    JOIN poems p ON
      REPLACE(REPLACE(wq.full_poem, '\n', ''), ' ', '') =
      REPLACE(REPLACE(p.content, '\n', ''), ' ', '')
    WHERE wq.full_poem IS NOT NULL AND wq.full_poem != ''
  `);
  console.log(`  总数: ${totalWQ.count}, 规范化内容匹配: ${matchedWQ.count}`);
  console.log(`  匹配率: ${totalWQ.count > 0 ? ((matchedWQ.count / totalWQ.count) * 100).toFixed(1) : 0}%`);

  // 6. 检查 learning_records 通过 title 匹配的可能性（是否有 title 字段）
  console.log('\n【learning_records 是否存了 title】');
  const lrSchema = await queryAll("PRAGMA table_info(learning_records)");
  console.log('  learning_records 表结构:');
  lrSchema.forEach(col => console.log(`    - ${col.name}: ${col.type}`));

  // 7. 检查 collections 是否存了 title
  console.log('\n【collections 表结构】');
  const colSchema = await queryAll("PRAGMA table_info(collections)");
  colSchema.forEach(col => console.log(`    - ${col.name}: ${col.type}`));

  // 8. 检查 mistakes 表
  console.log('\n【mistakes 表结构】');
  const misSchema = await queryAll("PRAGMA table_info(mistakes)");
  misSchema.forEach(col => console.log(`    - ${col.name}: ${col.type}`));
  const misSamples = await queryAll('SELECT * FROM mistakes LIMIT 5');
  console.log('  示例:');
  misSamples.forEach(r => console.log(`    - ${JSON.stringify(r)}`));

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
