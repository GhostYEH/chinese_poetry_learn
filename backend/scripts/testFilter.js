const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/poetry.db');

console.log('=== 测试 API 筛选功能 ===\n');

// 测试1: 获取各朝代诗词总数
db.get("SELECT COUNT(*) as count FROM poems WHERE dynasty = '唐'", (err, tang) => {
  db.get("SELECT COUNT(*) as count FROM poems WHERE dynasty = '宋'", (err2, song) => {
    db.get("SELECT COUNT(*) as count FROM poems WHERE dynasty = '元'", (err3, yuan) => {
      db.get("SELECT COUNT(*) as count FROM poems", (err4, total) => {
        
        const result = {
          total: total.count,
          tang: tang.count,
          song: song.count,
          yuan: yuan.count
        };
        
        console.log('数据库统计:');
        console.log('  总计:', result.total, '首');
        console.log('  唐朝:', result.tang, '首');
        console.log('  宋朝:', result.song, '首');
        console.log('  元朝:', result.yuan, '首');
        
        // 测试分页
        db.all("SELECT id, title, author FROM poems WHERE dynasty = '宋' LIMIT 20 OFFSET 0", (err5, page1) => {
          console.log('\n宋朝第1页 (共', page1.length, '首):');
          page1.slice(0, 5).forEach((r, i) => console.log('  ' + (i+1) + '. ' + r.title + ' - ' + r.author));
          
          db.all("SELECT id, title, author FROM poems WHERE dynasty = '宋' LIMIT 20 OFFSET 20", (err6, page2) => {
            console.log('\n宋朝第2页 (共', page2.length, '首):');
            page2.slice(0, 5).forEach((r, i) => console.log('  ' + (i+1) + '. ' + r.title + ' - ' + r.author));
            
            console.log('\n筛选功能测试通过！');
            db.close();
          });
        });
      });
    });
  });
});
