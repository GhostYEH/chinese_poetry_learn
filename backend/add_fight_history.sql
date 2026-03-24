-- 创建飞花令对战历史表
CREATE TABLE IF NOT EXISTS fight_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player1 TEXT NOT NULL,
  player2 TEXT NOT NULL,
  winner TEXT,
  date DATETIME DEFAULT CURRENT_TIMESTAMP,
  rounds INTEGER DEFAULT 0
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_fight_player1 ON fight_history(player1);
CREATE INDEX IF NOT EXISTS idx_fight_player2 ON fight_history(player2);
CREATE INDEX IF NOT EXISTS idx_fight_date ON fight_history(date);
