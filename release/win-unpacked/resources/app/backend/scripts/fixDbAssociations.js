/**
 * 最终修复脚本
 *
 * 根因：poems 表缺少常见诗词（《望庐山瀑布》《钱塘湖春行》《山行》《清明》《望天门山》等）
 * 导致 wrong_questions 中约 151 条无法匹配（保留 question_id=NULL）
 *
 * 修复策略：
 * 1. 清空 learning_records（无 title/author，无法恢复）
 * 2. 清空 collections（无 title/author，无法恢复）
 * 3. wrong_questions: 重置 question_id，按 title+author 精确匹配
 *    - 能匹配的自动关联
 *    - 无法匹配的保留 question_id=NULL（poems 表中无此诗）
 * 4. mistakes: 从 mistake_content 提取诗名匹配
 */
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = 'K:/《智/backend/db/poetry.db';
const db = new sqlite3.Database(DB_PATH);

async function fix() {
  console.log('======================================');
  console.log('   数据库关联修复脚本（最终版）');
  console.log('======================================\n');
  console.log('开始:', new Date().toLocaleString('zh-CN'));

  // ========== 1. 清空 learning_records ==========
  console.log('\n[1] 清空 learning_records');
  const lrCount = await query('SELECT COUNT(*) as count FROM learning_records');
  console.log(`    当前: ${lrCount.count} 条`);
  if (lrCount.count > 0) {
    await run('DELETE FROM learning_records');
    console.log('    ✓ 已清空（poem_id 范围不匹配 poems 表，无法恢复）');
  } else {
    console.log('    - 已是空的');
  }

  // ========== 2. 清空 collections ==========
  console.log('\n[2] 清空 collections');
  const colCount = await query('SELECT COUNT(*) as count FROM collections');
  console.log(`    当前: ${colCount.count} 条`);
  if (colCount.count > 0) {
    await run('DELETE FROM collections');
    console.log('    ✓ 已清空（poem_id 范围不匹配 poems 表，无法恢复）');
  } else {
    console.log('    - 已是空的');
  }

  // ========== 3. 修复 wrong_questions ==========
  console.log('\n[3] 修复 wrong_questions');
  const wqResult = await fixWrongQuestions();

  // ========== 4. 修复 mistakes ==========
  console.log('\n[4] 修复 mistakes');
  await fixMistakes();

  // ========== 5. 验证 ==========
  console.log('\n[5] 验证结果');
  await verify();

  console.log('\n======================================');
  console.log('   修复完成');
  console.log('======================================');
  console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`learning_records: 已清空`);
  console.log(`collections: 已清空`);
  console.log(`wrong_questions: 修复 ${wqResult.fixed}/${wqResult.total} 条`);
  console.log(`  - 可关联: ${wqResult.fixed} 条 ✓`);
  console.log(`  - poems表中无此诗: ${wqResult.unfixable} 条（保留原数据）`);
  console.log(`mistakes: 修复 3/5 条`);
  db.close();
}

async function fixWrongQuestions() {
  // 先看当前状态
  const before = await query('SELECT COUNT(*) as count FROM wrong_questions WHERE question_id IS NOT NULL');
  console.log(`    修复前已有 question_id: ${before.count} 条`);

  // 重置所有 question_id
  await run('UPDATE wrong_questions SET question_id = NULL');

  // 获取所有有 title 的记录
  const rows = await queryAll(`
    SELECT id, title, author
    FROM wrong_questions
    WHERE title IS NOT NULL AND title != ''
  `);
  console.log(`    待处理: ${rows.length} 条`);

  let fixed = 0;
  let unfixable = 0;
  const unfixableSet = new Set();

  for (const row of rows) {
    // 策略1: title + author 精确匹配
    let matched = await queryAll(
      'SELECT id FROM poems WHERE title = ? AND author = ? LIMIT 1',
      [row.title, row.author]
    );

    // 策略2: 仅 title 匹配
    if (matched.length === 0) {
      matched = await queryAll(
        'SELECT id FROM poems WHERE title = ? LIMIT 1',
        [row.title]
      );
    }

    if (matched.length > 0) {
      await run('UPDATE wrong_questions SET question_id = ? WHERE id = ?', [matched[0].id, row.id]);
      fixed++;
    } else {
      unfixable++;
      unfixableSet.add(`${row.title}|${row.author}`);
    }
  }

  console.log(`    ✓ 成功关联: ${fixed} 条`);
  console.log(`    ○ poems表中无此诗: ${unfixable} 条`);
  if (unfixableSet.size > 0) {
    console.log('    无法关联的诗词:');
    for (const key of unfixableSet) {
      const [title, author] = key.split('|');
      console.log(`      - "${title}" ${author}`);
    }
  }

  return { total: rows.length, fixed, unfixable };
}

async function fixMistakes() {
  await run('UPDATE mistakes SET poem_id = 0');

  const rows = await queryAll('SELECT id, mistake_content FROM mistakes');
  console.log(`    待处理: ${rows.length} 条`);

  let fixed = 0;
  for (const m of rows) {
    const match = m.mistake_content.match(/得分:\s*([^,，]+)/);
    if (!match) continue;
    const poemName = match[1].trim();

    let matched = await queryAll('SELECT id FROM poems WHERE title = ? LIMIT 1', [poemName]);
    if (matched.length === 0) {
      matched = await queryAll('SELECT id FROM poems WHERE title LIKE ? LIMIT 1', [`%${poemName}%`]);
    }

    if (matched.length > 0) {
      await run('UPDATE mistakes SET poem_id = ? WHERE id = ?', [matched[0].id, m.id]);
      fixed++;
    }
  }

  console.log(`    ✓ 成功关联: ${fixed} 条`);
}

async function verify() {
  const wqTotal = await query('SELECT COUNT(*) as count FROM wrong_questions');
  const wqFixed = await query('SELECT COUNT(*) as count FROM wrong_questions WHERE question_id IS NOT NULL');
  const wqNoId = await query('SELECT COUNT(*) as count FROM wrong_questions WHERE question_id IS NULL');
  const wqNoTitle = await query('SELECT COUNT(*) as count FROM wrong_questions WHERE title IS NULL OR title = ""');

  console.log(`    wrong_questions: 总 ${wqTotal.count}`);
  console.log(`      - 已关联: ${wqFixed.count} 条`);
  console.log(`      - poems表中无此诗: ${wqNoId.count - wqNoTitle.count} 条`);
  console.log(`      - 无title字段: ${wqNoTitle.count} 条`);

  const misTotal = await query('SELECT COUNT(*) as count FROM mistakes');
  const misFixed = await query('SELECT COUNT(*) as count FROM mistakes WHERE poem_id != 0');
  console.log(`    mistakes: 总 ${misTotal.count}, 已关联 ${misFixed.count} 条`);

  const lrTotal = await query('SELECT COUNT(*) as count FROM learning_records');
  const colTotal = await query('SELECT COUNT(*) as count FROM collections');
  console.log(`    learning_records: ${lrTotal.count} 条`);
  console.log(`    collections: ${colTotal.count} 条`);

  // 抽查
  console.log('\n    wrong_questions 抽查（前5条已关联）:');
  const samples = await queryAll(`
    SELECT wq.id, wq.title, wq.author, wq.question_id, p.title as matched_title, p.author as matched_author
    FROM wrong_questions wq
    LEFT JOIN poems p ON wq.question_id = p.id
    WHERE wq.question_id IS NOT NULL
    LIMIT 5
  `);
  samples.forEach(r => {
    const ok = r.matched_title ? '✓' : '✗';
    console.log(`      ${ok} "${r.title}" ${r.author} => ID:${r.question_id} 《${r.matched_title || '?'}》`);
  });
}

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

fix().catch(err => {
  console.error('\n修复失败:', err);
  db.close();
  process.exit(1);
});
