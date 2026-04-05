/**
 * 诊断脚本：检查诗词数据库的关联状态
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 直接使用绝对路径
const DB_PATH = 'K:/《智/backend/db/poetry.db';

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('无法连接到数据库:', err.message);
    process.exit(1);
  }
});

console.log('=== 数据库诊断报告 ===\n');

async function diagnose() {
  // 1. 查看 poems 表总数
  const poemsCount = await query('SELECT COUNT(*) as count FROM poems');
  console.log(`【poems 表】共 ${poemsCount.count} 首诗词`);

  // 2. 查看是否存在"无题"诗
  const 无题Poems = await queryAll('SELECT id, title, author, dynasty FROM poems WHERE title = "无题" OR title LIKE "%无题%"');
  console.log(`\n【无题诗词】共 ${无题Poems.length} 首`);
  if (无题Poems.length > 0) {
    无题Poems.forEach(p => console.log(`  - ID:${p.id} 《${p.title}》 ${p.author}`));
  }

  // 3. 查看 learning_records 表总数
  const lrCount = await query('SELECT COUNT(*) as count FROM learning_records');
  console.log(`\n【learning_records 表】共 ${lrCount.count} 条记录`);

  // 4. 检查 learning_records 中的 poem_id 是否都存在于 poems 表
  const lrWithPoem = await queryAll(`
    SELECT lr.id, lr.user_id, lr.poem_id, p.title, p.author
    FROM learning_records lr
    LEFT JOIN poems p ON lr.poem_id = p.id
  `);

  let validLr = 0, invalidLr = 0;
  const invalidLrList = [];
  lrWithPoem.forEach(r => {
    if (r.title) {
      validLr++;
    } else {
      invalidLr++;
      invalidLrList.push(r);
    }
  });
  console.log(`  - 有效关联: ${validLr} 条`);
  console.log(`  - 无效关联(poem_id 不存在): ${invalidLr} 条`);

  // 5. 查看 collections 表
  const colCount = await query('SELECT COUNT(*) as count FROM collections');
  console.log(`\n【collections 表】共 ${colCount.count} 条记录`);

  const colWithPoem = await queryAll(`
    SELECT c.id, c.user_id, c.poem_id, p.title, p.author
    FROM collections c
    LEFT JOIN poems p ON c.poem_id = p.id
  `);

  let validCol = 0, invalidCol = 0;
  const invalidColList = [];
  colWithPoem.forEach(r => {
    if (r.title) {
      validCol++;
    } else {
      invalidCol++;
      invalidColList.push(r);
    }
  });
  console.log(`  - 有效关联: ${validCol} 条`);
  console.log(`  - 无效关联(poem_id 不存在): ${invalidCol} 条`);

  // 6. 查看 mistakes 表
  const misCount = await query('SELECT COUNT(*) as count FROM mistakes');
  console.log(`\n【mistakes 表】共 ${misCount.count} 条记录`);

  const misWithPoem = await queryAll(`
    SELECT m.id, m.user_id, m.poem_id, p.title, p.author
    FROM mistakes m
    LEFT JOIN poems p ON m.poem_id = p.id
    LIMIT 20
  `);

  let validMis = 0, invalidMis = 0;
  misWithPoem.forEach(r => {
    if (r.title) validMis++;
    else invalidMis++;
  });
  const misTotal = await query('SELECT COUNT(*) as count FROM mistakes');
  console.log(`  - 检查前 ${misWithPoem.length} 条: 有效 ${validMis}, 无效 ${invalidMis}`);

  // 7. 查看 wrong_questions 表
  const wqCount = await query('SELECT COUNT(*) as count FROM wrong_questions');
  console.log(`\n【wrong_questions 表】共 ${wqCount.count} 条记录`);

  const wqWithTitle = await queryAll('SELECT COUNT(*) as count FROM wrong_questions WHERE title IS NOT NULL AND title != ""');
  console.log(`  - 有 title 字段的记录: ${wqWithTitle.count} 条`);

  // 8. 查看各表的前几条记录示例
  console.log('\n【poems 表示例（前5条）】');
  const poemsSample = await queryAll('SELECT id, title, author FROM poems LIMIT 5');
  poemsSample.forEach(p => console.log(`  - ID:${p.id} 《${p.title}》 ${p.author}`));

  console.log('\n【learning_records 示例外链 poems（前5条）】');
  const lrSample = await queryAll(`
    SELECT lr.id, lr.user_id, lr.poem_id, p.title, p.author
    FROM learning_records lr
    LEFT JOIN poems p ON lr.poem_id = p.id
    LIMIT 5
  `);
  lrSample.forEach(r => console.log(`  - lr.id=${r.id} user=${r.user_id} poem_id=${r.poem_id} => ${r.title || 'NULL'} ${r.author || ''}`));

  // 9. 抽样检查: 随机找一条 learning_record, 看 poem_id 和诗是否对应
  console.log('\n【抽样: 部分 learning_records 详情】');
  const lrDetail = await queryAll(`
    SELECT lr.id, lr.user_id, lr.poem_id, p.title, p.author, p.content
    FROM learning_records lr
    LEFT JOIN poems p ON lr.poem_id = p.id
    LIMIT 10
  `);
  lrDetail.forEach(r => {
    console.log(`  [${r.id}] user=${r.user_id} poem_id=${r.poem_id} => ${r.title || '无标题'} ${r.author || ''}`);
  });

  // 10. 查看没有有效关联的 learning_records
  if (invalidLr > 0) {
    console.log('\n【无效 learning_records 详情】');
    invalidLrList.slice(0, 10).forEach(r => {
      console.log(`  - lr.id=${r.id} user_id=${r.user_id} poem_id=${r.poem_id} (poem 不存在)`);
    });
  }

  // 11. 查看没有有效关联的 collections
  if (invalidCol > 0) {
    console.log('\n【无效 collections 详情】');
    invalidColList.slice(0, 10).forEach(r => {
      console.log(`  - col.id=${r.id} user_id=${r.user_id} poem_id=${r.poem_id} (poem 不存在)`);
    });
  }

  console.log('\n=== 诊断完成 ===');
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
  process.exit(1);
});
