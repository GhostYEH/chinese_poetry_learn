/**
 * 深度诊断：分析 poems 表 ID 分布和内容特征
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function diagnose() {
  // 1. poems ID 分布
  console.log('【poems ID 分布分析】');
  const idStats = await queryAll(`
    SELECT
      COUNT(*) as total,
      MIN(id) as min_id,
      MAX(id) as max_id,
      MIN(id) as range_start
    FROM poems
  `);
  console.log(`总: ${idStats[0].total}, ID范围: ${idStats[0].min_id} ~ ${idStats[0].max_id}`);

  // 按区间统计
  const ranges = [
    [1400, 1500], [1500, 1600], [1600, 1700], [1700, 1800],
    [1800, 1900], [1900, 2000], [2000, 2100], [2100, 2200],
    [2200, 2300], [2300, 2400], [2400, 2500], [2500, 2600],
    [2600, 2700], [2700, 2800], [2800, 2900], [2900, 3000]
  ];
  for (const [start, end] of ranges) {
    const cnt = await query(`SELECT COUNT(*) as count FROM poems WHERE id >= ${start} AND id < ${end}`);
    if (cnt.count > 0) {
      console.log(`  ID ${start}-${end}: ${cnt.count} 首`);
    }
  }

  // 2. 查找内容完全相同的诗词（重复导入）
  console.log('\n【poems 表中内容重复的诗词】');
  const duplicates = await queryAll(`
    SELECT content, COUNT(*) as cnt, GROUP_CONCAT(id || ':' || title, ' | ') as ids_titles
    FROM poems
    GROUP BY content
    HAVING cnt > 1
    LIMIT 10
  `);
  console.log(`找到 ${duplicates.length} 组重复内容`);
  duplicates.forEach(d => {
    console.log(`  内容重复 ${d.cnt} 次: ${d.ids_titles}`);
  });

  // 3. 尝试通过 content 前30字匹配 wrong_questions
  console.log('\n【wrong_questions: content 前30字匹配 poems】');
  const wqByContent30 = await queryAll(`
    SELECT wq.id, wq.title, wq.author, wq.full_poem,
           p.id as matched_id, p.title as matched_title, p.author as matched_author
    FROM wrong_questions wq
    LEFT JOIN poems p ON substr(wq.full_poem, 1, 30) = substr(p.content, 1, 30)
    WHERE wq.full_poem IS NOT NULL AND wq.full_poem != ''
    LIMIT 20
  `);
  let matched30 = 0;
  const unmatched30 = [];
  wqByContent30.forEach(r => {
    if (r.matched_id) {
      matched30++;
      if (matched30 <= 5) {
        console.log(`  ✓ [${r.id}] "${r.title}" => ID:${r.matched_id} 《${r.matched_title}》 ${r.matched_author}`);
      }
    } else {
      if (unmatched30.length < 5) {
        unmatched30.push(r);
      }
    }
  });
  console.log(`  抽样20条: 匹配 ${matched30}`);
  if (unmatched30.length > 0) {
    unmatched30.forEach(r => {
      console.log(`  ✗ "${r.title}" 诗: "${r.full_poem.substring(0, 30)}..."`);
    });
  }

  // 4. 尝试通过 content 前50字匹配
  console.log('\n【wrong_questions: content 前50字匹配 poems】');
  const wqByContent50 = await queryAll(`
    SELECT wq.id, wq.title, wq.full_poem,
           p.id as matched_id, p.title as matched_title
    FROM wrong_questions wq
    LEFT JOIN poems p ON substr(wq.full_poem, 1, 50) = substr(p.content, 1, 50)
    WHERE wq.full_poem IS NOT NULL AND wq.full_poem != ''
    LIMIT 20
  `);
  let matched50 = 0;
  wqByContent50.forEach(r => {
    if (r.matched_id) matched50++;
  });
  console.log(`  抽样20条: 匹配 ${matched50}`);

  // 5. 总体匹配率统计（content前30字）
  console.log('\n【wrong_questions: content前30字总体匹配率】');
  const wqTotal = await query('SELECT COUNT(*) as count FROM wrong_questions WHERE full_poem IS NOT NULL AND full_poem != ""');
  const wqMatched30 = await query(`
    SELECT COUNT(DISTINCT wq.id) as count FROM wrong_questions wq
    JOIN poems p ON substr(wq.full_poem, 1, 30) = substr(p.content, 1, 30)
    WHERE wq.full_poem IS NOT NULL AND wq.full_poem != ''
  `);
  console.log(`  总有 full_poem 的记录: ${wqTotal.count}`);
  console.log(`  content前30字匹配成功: ${wqMatched30.count}`);
  console.log(`  匹配率: ${wqTotal.count > 0 ? ((wqMatched30.count / wqTotal.count) * 100).toFixed(1) : 0}%`);

  // 6. 抽查几条 wrong_questions 的 full_poem 和 poems 表内容对比
  console.log('\n【wrong_questions full_poem vs poems content 逐条对比】');
  const samples = await queryAll(`
    SELECT wq.id, wq.title, wq.author, wq.full_poem, wq.answer,
           p.id as pid, p.title as ptitle, p.author as pauthor, p.content
    FROM wrong_questions wq
    LEFT JOIN poems p ON wq.title = p.title AND wq.author = p.author
    WHERE wq.title IS NOT NULL AND wq.full_poem IS NOT NULL
    LIMIT 5
  `);
  samples.forEach(r => {
    console.log(`\n  [${r.id}] "${r.title}" ${r.author}`);
    console.log(`  wq.full_poem: "${r.full_poem}"`);
    console.log(`  poems content: "${r.content || '无匹配'}"`);
  });

  // 7. 看看 learning_records 中最大的 poem_id 范围
  console.log('\n【learning_records poem_id 分布】');
  const lrIdRanges = [
    [1, 100], [101, 500], [501, 1000], [1001, 1500], [1501, 2000], [2001, 2500]
  ];
  for (const [start, end] of lrIdRanges) {
    const cnt = await query(`SELECT COUNT(*) as count FROM learning_records WHERE poem_id >= ${start} AND poem_id <= ${end}`);
    if (cnt.count > 0) {
      console.log(`  poem_id ${start}-${end}: ${cnt.count} 条`);
    }
  }

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
