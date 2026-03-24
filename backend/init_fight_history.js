const { db } = require('./src/utils/db');

async function initFightHistoryTable() {
  console.log('正在初始化飞花令对战历史表...');
  
  try {
    // 创建fight_history表
    await db.run(`
      CREATE TABLE IF NOT EXISTS fight_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1 TEXT NOT NULL,
        player2 TEXT NOT NULL,
        winner TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        rounds INTEGER DEFAULT 0
      )
    `);
    console.log('✓ fight_history表创建成功');

    // 创建索引
    await db.run(`CREATE INDEX IF NOT EXISTS idx_fight_player1 ON fight_history(player1)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_fight_player2 ON fight_history(player2)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_fight_date ON fight_history(date)`);
    console.log('✓ 索引创建成功');

    console.log('\n飞花令对战历史表初始化完成！');
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

// 执行初始化
initFightHistoryTable().then(() => {
  process.exit(0);
});
