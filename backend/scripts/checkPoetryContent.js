
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

async function checkPoems() {
  console.log('=== 检查诗词数据库内容 ===\n');
  
  // 检查静夜思
  console.log('【检查《静夜思》】');
  const jingyesi = await queryAll('SELECT id, title, author, dynasty, content FROM poems WHERE title LIKE "%静夜思%"');
  jingyesi.forEach(p => {
    console.log('  [' + p.id + '] ' + p.title + ' - ' + p.author + ' (' + p.dynasty + ')');
    console.log('  内容: ' + p.content);
    if (p.content.indexOf('霜月') !== -1) {
      console.log('  ⚠️  发现错误：应该是"明月"而非"霜月"');
    }
  });

  // 检查李白的其他诗
  console.log('\n【检查李白的诗（前20首）】');
  const libai = await queryAll('SELECT id, title, author, content FROM poems WHERE author LIKE "%李白%" LIMIT 20');
  libai.forEach(p => {
    console.log('  [' + p.id + '] ' + p.title);
  });

  // 检查所有诗的数量
  console.log('\n【数据库统计】');
  const count = await queryAll('SELECT COUNT(*) as total FROM poems');
  console.log('  总诗词数量: ' + count[0].total);

  db.close();
}

function queryAll(sql) {
  return new Promise(function(resolve, reject) {
    db.all(sql, function(err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

checkPoems().catch(function(err) { 
  console.error(err); 
  db.close(); 
});
