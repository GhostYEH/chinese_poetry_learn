
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

async function fixPoems() {
  console.log('=== 修复诗词数据库内容 ===\n');
  
  // 修复静夜思
  console.log('【修复《静夜思》】');
  const jingyesi = await queryAll('SELECT id, title, author, dynasty, content FROM poems WHERE title LIKE "%静夜思%"');
  for (let i = 0; i &lt; jingyesi.length; i++) {
    const p = jingyesi[i];
    console.log('  当前内容: ' + p.content);
    const correctContent = '床前明月光，疑是地上霜。举头望明月，低头思故乡。';
    await updatePoem(p.id, correctContent);
    console.log('  ✓ 已修复为: ' + correctContent);
  }

  // 检查其他常见诗词
  console.log('\n【检查常见诗词】');
  const commonPoems = [
    { title: '春晓', author: '孟浩然', correctContent: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。' },
    { title: '望庐山瀑布', author: '李白', correctContent: '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。' },
    { title: '江雪', author: '柳宗元', correctContent: '千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。' },
    { title: '登鹳雀楼', author: '王之涣', correctContent: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。' },
    { title: '清明', author: '杜牧', correctContent: '清明时节雨纷纷，路上行人欲断魂。借问酒家何处有？牧童遥指杏花村。' }
  ];

  for (let i = 0; i &lt; commonPoems.length; i++) {
    const poem = commonPoems[i];
    const results = await queryAll('SELECT id, title, author, content FROM poems WHERE title LIKE "%' + poem.title + '%" AND author LIKE "%' + poem.author + '%"');
    for (let j = 0; j &lt; results.length; j++) {
      const p = results[j];
      console.log('\n  [' + p.id + '] ' + p.title + ' - ' + p.author);
      if (p.content !== poem.correctContent) {
        console.log('  ⚠️  内容不匹配');
        console.log('    当前: ' + p.content);
        console.log('    正确: ' + poem.correctContent);
        console.log('  正在修复...');
        await updatePoem(p.id, poem.correctContent);
        console.log('  ✓ 已修复');
      } else {
        console.log('  ✓ 内容正确');
      }
    }
  }

  console.log('\n=== 修复完成 ===');
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

function updatePoem(id, content) {
  return new Promise(function(resolve, reject) {
    db.run('UPDATE poems SET content = ? WHERE id = ?', [content, id], function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

fixPoems().catch(function(err) { 
  console.error(err); 
  db.close(); 
});
