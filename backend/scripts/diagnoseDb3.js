/**
 * 诊断：通过 title+author 匹配 poems 表
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function diagnose() {
  // 1. 尝试通过 title + author 匹配 wrong_questions
  console.log('【wrong_questions: title+author 匹配 poems】');
  const wqByTitle = await queryAll(`
    SELECT wq.id, wq.title, wq.author, wq.full_poem,
           p.id as matched_id, p.title as matched_title, p.author as matched_author
    FROM wrong_questions wq
    LEFT JOIN poems p ON wq.title = p.title AND wq.author = p.author
    WHERE wq.title IS NOT NULL AND wq.title != ''
    LIMIT 20
  `);

  let matched = 0, unmatched = 0, multi = 0;
  const unmatchedList = [];
  wqByTitle.forEach(r => {
    if (r.matched_id) {
      matched++;
      if (matched <= 5) {
        console.log(`  ✓ [${r.id}] "${r.title}" ${r.author} => ID:${r.matched_id} 《${r.matched_title}》 ${r.matched_author}`);
      }
    } else {
      unmatched++;
      if (unmatchedList.length < 10) {
        unmatchedList.push(r);
      }
    }
  });
  console.log(`  抽样20条: 匹配 ${matched}, 未匹配 ${unmatched}`);
  if (unmatchedList.length > 0) {
    console.log('  未匹配示例:');
    unmatchedList.forEach(r => {
      console.log(`    - [${r.id}] title="${r.title}" author="${r.author}" poem="${(r.full_poem || '').substring(0, 25)}..."`);
    });
  }

  // 2. 统计 wrong_questions 总体匹配率
  console.log('\n【wrong_questions 总体匹配率】');
  const wqTotal = await query('SELECT COUNT(*) as count FROM wrong_questions WHERE title IS NOT NULL AND title != ""');
  const wqMatched = await query(`
    SELECT COUNT(*) as count FROM wrong_questions wq
    JOIN poems p ON wq.title = p.title AND wq.author = p.author
    WHERE wq.title IS NOT NULL AND wq.title != ''
  `);
  console.log(`  总数: ${wqTotal.count}, title+author 匹配成功: ${wqMatched.count}`);
  console.log(`  匹配率: ${((wqMatched.count / wqTotal.count) * 100).toFixed(1)}%`);

  // 3. 尝试通过 full_poem 内容匹配（取前20字）
  console.log('\n【wrong_questions: full_poem 前20字匹配 poems】');
  const wqByContent = await queryAll(`
    SELECT wq.id, wq.title, wq.author, wq.full_poem,
           p.id as matched_id, p.title as matched_title
    FROM wrong_questions wq
    LEFT JOIN poems p ON substr(wq.full_poem, 1, 20) = substr(p.content, 1, 20)
    WHERE wq.full_poem IS NOT NULL AND wq.full_poem != ''
    LIMIT 20
  `);
  let matchedC = 0;
  wqByContent.forEach(r => {
    if (r.matched_id) matchedC++;
  });
  console.log(`  抽样20条: 匹配 ${matchedC}`);

  // 4. 查看 poems 中"江雪"的实际内容
  console.log('\n【poems 表中"江雪"的实际数据】');
  const jiangxue = await queryAll("SELECT id, title, author, content FROM poems WHERE title = '江雪' LIMIT 5");
  jiangxue.forEach(p => {
    console.log(`  - ID:${p.id} 《${p.title}》 ${p.author}`);
    console.log(`    content: "${p.content}"`);
  });

  // 5. 查看 wrong_questions 中"江雪"的实际数据
  console.log('\n【wrong_questions 中"江雪"的实际数据】');
  const wqJiangxue = await queryAll("SELECT id, title, author, full_poem FROM wrong_questions WHERE title = '江雪' LIMIT 3");
  wqJiangxue.forEach(r => {
    console.log(`  - [${r.id}] "${r.title}" ${r.author}`);
    console.log(`    full_poem: "${r.full_poem}"`);
  });

  // 6. 尝试只看 title 匹配
  console.log('\n【wrong_questions: 仅 title 匹配 poems（可能有重复标题）】');
  const wqByTitleOnly = await queryAll(`
    SELECT wq.id, wq.title, wq.author,
           COUNT(p.id) as match_count,
           GROUP_CONCAT(p.id || ':' || p.title || ':' || p.author, ' | ') as matches
    FROM wrong_questions wq
    LEFT JOIN poems p ON wq.title = p.title
    WHERE wq.title IS NOT NULL AND wq.title != ''
    GROUP BY wq.title, wq.author
    LIMIT 10
  `);
  wqByTitleOnly.forEach(r => {
    console.log(`  - "${r.title}" ${r.author} => ${r.match_count} 个匹配: ${r.matches || '无'}`);
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
