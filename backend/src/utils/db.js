// 数据库连接和初始化
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 使用环境变量配置数据库路径，支持打包后的相对路径
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../db/poetry.db');

// 确保数据库目录存在
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// 创建数据库连接
let db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到SQLite数据库');
  }
});

// 初始化数据库表结构
function initDatabase() {
  return new Promise((resolve, reject) => {
    // 创建用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        class_id INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (class_id) REFERENCES class_stats(class_id) ON DELETE SET NULL
      )
    `, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // 创建诗词表
      db.run(`
        CREATE TABLE IF NOT EXISTS poems (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          dynasty TEXT NOT NULL,
          content TEXT NOT NULL,
          tags TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // 创建学习记录表
        db.run(`
          CREATE TABLE IF NOT EXISTS learning_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            poem_id INTEGER NOT NULL,
            view_count INTEGER DEFAULT 0,
            ai_explain_count INTEGER DEFAULT 0,
            recite_attempts INTEGER DEFAULT 0,
            best_score INTEGER DEFAULT 0,
            total_score INTEGER DEFAULT 0,
            study_time INTEGER DEFAULT 0,
            last_view_time TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (poem_id) REFERENCES poems(id)
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          // 创建错题本表
          db.run(`
            CREATE TABLE IF NOT EXISTS mistakes (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              poem_id INTEGER NOT NULL,
              mistake_type TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id),
              FOREIGN KEY (poem_id) REFERENCES poems(id)
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }

            // 创建收藏表
            db.run(`
              CREATE TABLE IF NOT EXISTS collections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                poem_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (poem_id) REFERENCES poems(id),
                UNIQUE(user_id, poem_id)
              )
            `, (err) => {
              if (err) {
                reject(err);
                return;
              }

              // 创建创作表
              db.run(`
                CREATE TABLE IF NOT EXISTS creations (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  title TEXT NOT NULL,
                  content TEXT NOT NULL,
                  type TEXT NOT NULL,
                  score INTEGER DEFAULT 0,
                  created_at TEXT NOT NULL,
                  FOREIGN KEY (user_id) REFERENCES users(id)
                )
              `, (err) => {
                if (err) {
                  reject(err);
                  return;
                }

                // 创建班级表
                db.run(`
                  CREATE TABLE IF NOT EXISTS classes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    class_name TEXT UNIQUE NOT NULL,
                    teacher_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                  )
                `, (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  // 创建飞花令对战历史表
                  db.run(`
                    CREATE TABLE IF NOT EXISTS fight_history (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      player1 TEXT NOT NULL,
                      player2 TEXT NOT NULL,
                      winner TEXT NOT NULL,
                      date TEXT NOT NULL
                    )
                  `, (err) => {
                    if (err) {
                      reject(err);
                      return;
                    }

                    // 创建对战历史索引
                    db.run(`CREATE INDEX IF NOT EXISTS idx_fight_player1 ON fight_history(player1)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_fight_player2 ON fight_history(player2)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_fight_date ON fight_history(date)`);
                    console.log('✓ 飞花令对战历史表创建成功');

                    // 创建错题复习表
                    db.run(`
                      CREATE TABLE IF NOT EXISTS wrong_questions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT,
                        question_id INTEGER,
                        question TEXT,
                        answer TEXT,
                        user_answer TEXT,
                        level INTEGER,
                        wrong_count INTEGER DEFAULT 1,
                        last_wrong_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                        correct_streak INTEGER DEFAULT 0,
                        mastered INTEGER DEFAULT 0,
                        full_poem TEXT,
                        author TEXT,
                        title TEXT
                      )
                    `, (err) => {
                      if (err) {
                        reject(err);
                        return;
                      }

                      // 创建错题复习索引
                      db.run(`CREATE INDEX IF NOT EXISTS idx_wrong_user ON wrong_questions(user_id)`);
                      db.run(`CREATE INDEX IF NOT EXISTS idx_wrong_mastered ON wrong_questions(mastered)`);
                      console.log('✓ 错题复习表创建成功');

                      // 创建教师表
                      db.run(`
                        CREATE TABLE IF NOT EXISTS teachers (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          username TEXT UNIQUE NOT NULL,
                          password TEXT NOT NULL,
                          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                      `, (err) => {
                        if (err) {
                          reject(err);
                          return;
                        }

                        // 创建班级统计表
                        db.run(`
                          CREATE TABLE IF NOT EXISTS class_stats (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            class_id INTEGER UNIQUE,
                            total_students INTEGER DEFAULT 0,
                            total_poems_studied INTEGER DEFAULT 0,
                            avg_study_time INTEGER DEFAULT 0,
                            avg_completion_rate FLOAT DEFAULT 0,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                          )
                        `, (err) => {
                          if (err) {
                            reject(err);
                            return;
                          }

                          // 创建学生学习统计视图
                          db.run(`
                            CREATE VIEW IF NOT EXISTS v_student_learning_stats AS
                            SELECT 
                              u.id AS user_id,
                              u.username,
                              u.class_id,
                              COUNT(DISTINCT lr.poem_id) AS poem_count,
                              SUM(lr.study_time) AS total_study_time,
                              MAX(lr.last_view_time) AS last_study_time
                            FROM users u
                            LEFT JOIN learning_records lr ON u.id = lr.user_id
                            GROUP BY u.id, u.username
                          `, (err) => {
                            if (err) {
                              reject(err);
                              return;
                            }

                            // 初始化创作模块数据表
                            initCreationTables()
                              .then(() => {
                                // 检查诗词表是否为空
                                db.get('SELECT COUNT(*) as count FROM poems', (err, row) => {
                                  if (err) {
                                    reject(err);
                                    return;
                                  }

                                  if (row.count === 0) {
                                    // 插入默认诗词数据
                                    insertDefaultPoems()
                                      .then(() => resolve())
                                      .catch(err => reject(err));
                                  } else {
                                    resolve();
                                  }
                                });
                              })
                              .catch(err => reject(err));
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

// 插入默认诗词数据
function insertDefaultPoems() {
  return new Promise((resolve, reject) => {
    const defaultPoems = [
      { title: "静夜思", author: "李白", dynasty: "唐", content: "床前明月光，疑是地上霜。举头望明月，低头思故乡。", tags: "思乡,月亮" },
      { title: "春晓", author: "孟浩然", dynasty: "唐", content: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。", tags: "春天,自然" },
      { title: "望庐山瀑布", author: "李白", dynasty: "唐", content: "日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。", tags: "山水,壮观" },
      { title: "黄鹤楼送孟浩然之广陵", author: "李白", dynasty: "唐", content: "故人西辞黄鹤楼，烟花三月下扬州。孤帆远影碧空尽，唯见长江天际流。", tags: "送别,友情" },
      { title: "江雪", author: "柳宗元", dynasty: "唐", content: "千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。", tags: "山水,孤独" },
      { title: "望岳", author: "杜甫", dynasty: "唐", content: "岱宗夫如何？齐鲁青未了。造化钟神秀，阴阳割昏晓。荡胸生曾云，决眦入归鸟。会当凌绝顶，一览众山小。", tags: "山水,励志" },
      { title: "春望", author: "杜甫", dynasty: "唐", content: "国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。", tags: "爱国,忧伤" },
      { title: "赋得古原草送别", author: "白居易", dynasty: "唐", content: "离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。", tags: "送别,自然" },
      { title: "钱塘湖春行", author: "白居易", dynasty: "唐", content: "孤山寺北贾亭西，水面初平云脚低。几处早莺争暖树，谁家新燕啄春泥。乱花渐欲迷人眼，浅草才能没马蹄。最爱湖东行不足，绿杨阴里白沙堤。", tags: "春天,山水" },
      { title: "凉州词", author: "王之涣", dynasty: "唐", content: "黄河远上白云间，一片孤城万仞山。羌笛何须怨杨柳，春风不度玉门关。", tags: "边塞,思乡" },
      { title: "登鹳雀楼", author: "王之涣", dynasty: "唐", content: "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。", tags: "山水,励志" },
      { title: "清明", author: "杜牧", dynasty: "唐", content: "清明时节雨纷纷，路上行人欲断魂。借问酒家何处有？牧童遥指杏花村。", tags: "清明,思乡" },
      { title: "山行", author: "杜牧", dynasty: "唐", content: "远上寒山石径斜，白云生处有人家。停车坐爱枫林晚，霜叶红于二月花。", tags: "山水,秋天" },
      { title: "泊秦淮", author: "杜牧", dynasty: "唐", content: "烟笼寒水月笼沙，夜泊秦淮近酒家。商女不知亡国恨，隔江犹唱后庭花。", tags: "爱国,忧伤" },
      { title: "夜雨寄北", author: "李商隐", dynasty: "唐", content: "君问归期未有期，巴山夜雨涨秋池。何当共剪西窗烛，却话巴山夜雨时。", tags: "思乡,爱情" },
      { title: "锦瑟", author: "李商隐", dynasty: "唐", content: "锦瑟无端五十弦，一弦一柱思华年。庄生晓梦迷蝴蝶，望帝春心托杜鹃。沧海月明珠有泪，蓝田日暖玉生烟。此情可待成追忆？只是当时已惘然。", tags: "爱情,忧伤" },
      { title: "送元二使安西", author: "王维", dynasty: "唐", content: "渭城朝雨浥轻尘，客舍青青柳色新。劝君更尽一杯酒，西出阳关无故人。", tags: "送别,友情" },
      { title: "九月九日忆山东兄弟", author: "王维", dynasty: "唐", content: "独在异乡为异客，每逢佳节倍思亲。遥知兄弟登高处，遍插茱萸少一人。", tags: "思乡,亲情" },
      { title: "山居秋暝", author: "王维", dynasty: "唐", content: "空山新雨后，天气晚来秋。明月松间照，清泉石上流。竹喧归浣女，莲动下渔舟。随意春芳歇，王孙自可留。", tags: "山水,秋天" },
      { title: "鹿柴", author: "王维", dynasty: "唐", content: "空山不见人，但闻人语响。返景入深林，复照青苔上。", tags: "山水,幽静" },
      { title: "相思", author: "王维", dynasty: "唐", content: "红豆生南国，春来发几枝。愿君多采撷，此物最相思。", tags: "爱情,相思" },
      { title: "望天门山", author: "李白", dynasty: "唐", content: "天门中断楚江开，碧水东流至此回。两岸青山相对出，孤帆一片日边来。", tags: "山水,壮观" },
      { title: "早发白帝城", author: "李白", dynasty: "唐", content: "朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。", tags: "山水,轻快" },
      { title: "独坐敬亭山", author: "李白", dynasty: "唐", content: "众鸟高飞尽，孤云独去闲。相看两不厌，只有敬亭山。", tags: "山水,孤独" },
      { title: "秋浦歌", author: "李白", dynasty: "唐", content: "白发三千丈，缘愁似个长。不知明镜里，何处得秋霜？", tags: "忧伤,秋天" },
      { title: "望洞庭", author: "刘禹锡", dynasty: "唐", content: "湖光秋月两相和，潭面无风镜未磨。遥望洞庭山水翠，白银盘里一青螺。", tags: "山水,秋天" },
      { title: "乌衣巷", author: "刘禹锡", dynasty: "唐", content: "朱雀桥边野草花，乌衣巷口夕阳斜。旧时王谢堂前燕，飞入寻常百姓家。", tags: "怀旧,感慨" },
      { title: "竹枝词", author: "刘禹锡", dynasty: "唐", content: "杨柳青青江水平，闻郎江上唱歌声。东边日出西边雨，道是无晴却有晴。", tags: "爱情,自然" },
      { title: "别董大", author: "高适", dynasty: "唐", content: "千里黄云白日曛，北风吹雁雪纷纷。莫愁前路无知己，天下谁人不识君？", tags: "送别,友情" },
      { title: "芙蓉楼送辛渐", author: "王昌龄", dynasty: "唐", content: "寒雨连江夜入吴，平明送客楚山孤。洛阳亲友如相问，一片冰心在玉壶。", tags: "送别,友情" }
    ];

    // 开始事务
    db.serialize(() => {
      const stmt = db.prepare('INSERT INTO poems (title, author, dynasty, content, tags) VALUES (?, ?, ?, ?, ?)');

      defaultPoems.forEach(poem => {
        stmt.run(poem.title, poem.author, poem.dynasty, poem.content, poem.tags);
      });

      stmt.finalize((err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`成功插入 ${defaultPoems.length} 首诗词到数据库`);
          resolve();
        }
      });
    });
  });
}

// 初始化创作模块数据表
function initCreationTables() {
  return new Promise((resolve, reject) => {
    // 创建用户创作记录表
    db.run(`
      CREATE TABLE IF NOT EXISTS user_creations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        genre TEXT NOT NULL,
        theme TEXT NOT NULL,
        creation_mode TEXT NOT NULL,
        ai_reference TEXT,
        score_data TEXT,
        modification_suggestions TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // 创建创作成长统计表
      db.run(`
        CREATE TABLE IF NOT EXISTS creation_stats (
          user_id INTEGER PRIMARY KEY,
          total_creations INTEGER DEFAULT 0,
          qualified_works INTEGER DEFAULT 0,
          average_score REAL DEFAULT 0,
          highest_score INTEGER DEFAULT 0,
          last_creation_time TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // 创建用户闯关进度表
        db.run(`
          CREATE TABLE IF NOT EXISTS user_challenge_progress (
            user_id INTEGER PRIMARY KEY,
            highest_level INTEGER DEFAULT 0,
            current_challenge_level INTEGER DEFAULT 1,
            last_challenge_time TEXT,
            total_ai_help_used INTEGER DEFAULT 0,
            total_errors INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          // 创建用户答题记录表
          db.run(`
            CREATE TABLE IF NOT EXISTS user_challenge_records (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              level INTEGER NOT NULL,
              question_content TEXT NOT NULL,
              user_answer TEXT,
              correct_answer TEXT NOT NULL,
              is_correct INTEGER DEFAULT 0,
              used_ai_help INTEGER DEFAULT 0,
              added_to_error_book INTEGER DEFAULT 0,
              answered_at TEXT NOT NULL,
              poem_title TEXT,
              poem_author TEXT,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }

            // 创建用户错题本表
            db.run(`
              CREATE TABLE IF NOT EXISTS user_error_book (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                record_id INTEGER NOT NULL,
                question_content TEXT NOT NULL,
                user_answer TEXT,
                correct_answer TEXT NOT NULL,
                explanation TEXT,
                added_at TEXT NOT NULL,
                is_reviewed INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (record_id) REFERENCES user_challenge_records(id)
              )
            `, (err) => {
              if (err) {
                reject(err);
                return;
              }

              // 创建在线飞花令对战记录表
              db.run(`
                CREATE TABLE IF NOT EXISTS feihua_battles (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  player1_id INTEGER NOT NULL,
                  player2_id INTEGER NOT NULL,
                  keyword TEXT NOT NULL,
                  winner_id INTEGER,
                  loser_id INTEGER,
                  total_rounds INTEGER DEFAULT 0,
                  player1_throw_count INTEGER DEFAULT 0,
                  player2_throw_count INTEGER DEFAULT 0,
                  battle_history TEXT,
                  started_at TEXT NOT NULL,
                  ended_at TEXT,
                  FOREIGN KEY (player1_id) REFERENCES users(id),
                  FOREIGN KEY (player2_id) REFERENCES users(id),
                  FOREIGN KEY (winner_id) REFERENCES users(id),
                  FOREIGN KEY (loser_id) REFERENCES users(id)
                )
              `, (err) => {
                if (err) {
                  reject(err);
                  return;
                }

                // 创建用户飞花令最高记录表
                db.run(`
                  CREATE TABLE IF NOT EXISTS feihua_high_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    keyword TEXT NOT NULL,
                    max_rounds INTEGER DEFAULT 0,
                    total_battles INTEGER DEFAULT 0,
                    wins INTEGER DEFAULT 0,
                    losses INTEGER DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(user_id, keyword)
                  )
                `, (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  // 创建索引
                  db.run(`CREATE INDEX IF NOT EXISTS idx_feihua_battles_player1 ON feihua_battles(player1_id)`);
                  db.run(`CREATE INDEX IF NOT EXISTS idx_feihua_battles_player2 ON feihua_battles(player2_id)`);
                  db.run(`CREATE INDEX IF NOT EXISTS idx_feihua_high_records_user ON feihua_high_records(user_id)`);
                  console.log('✓ 在线飞花令表创建成功');

                  // 初始化能力评估表
                  initAbilityTables();
                  resolve();
                });
              });
            });
          });
        });
      });
    });
  });
}

// 初始化能力评估和高级功能表
function initAbilityTables() {
  // 能力评估表
  db.run(`
    CREATE TABLE IF NOT EXISTS ability_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      memory_score INTEGER DEFAULT 0,
      understanding_score INTEGER DEFAULT 0,
      application_score INTEGER DEFAULT 0,
      creativity_score INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) { console.error('能力评估表创建失败:', err); return; }
    console.log('✓ 能力评估表创建成功');
  });

  // 学习路径表
  db.run(`
    CREATE TABLE IF NOT EXISTS learning_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      level TEXT DEFAULT '初级',
      recommendations TEXT,
      current_focus TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id)
    )
  `, (err) => {
    if (err) { console.error('学习路径表创建失败:', err); return; }
    console.log('✓ 学习路径表创建成功');
  });

  // 每日打卡表
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_checkin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      poem_id INTEGER,
      checked_in_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, date)
    )
  `, (err) => {
    if (err) { console.error('每日打卡表创建失败:', err); return; }
    console.log('✓ 每日打卡表创建成功');
  });

  // 每日推荐诗词表
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_poems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poem_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      theme TEXT,
      FOREIGN KEY (poem_id) REFERENCES poems(id),
      UNIQUE(date)
    )
  `, (err) => {
    if (err) { console.error('每日推荐诗词表创建失败:', err); return; }
    console.log('✓ 每日推荐诗词表创建成功');
  });

  // 复习计划表
  db.run(`
    CREATE TABLE IF NOT EXISTS review_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      poem_id INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      review_count INTEGER DEFAULT 0,
      next_review TEXT,
      interval_days INTEGER DEFAULT 1,
      mastered INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (poem_id) REFERENCES poems(id)
    )
  `, (err) => {
    if (err) { console.error('复习计划表创建失败:', err); return; }
    console.log('✓ 复习计划表创建成功');
  });

  // 教师布置任务表
  db.run(`
    CREATE TABLE IF NOT EXISTS teacher_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      class_id INTEGER,
      target_user_id INTEGER,
      title TEXT NOT NULL,
      content TEXT,
      task_type TEXT,
      level_start INTEGER,
      level_end INTEGER,
      deadline TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES teachers(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (target_user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) { console.error('教师任务表创建失败:', err); return; }
    console.log('✓ 教师任务表创建成功');
  });

  // 飞花令排位表
  db.run(`
    CREATE TABLE IF NOT EXISTS feihua_rankings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      rank_level TEXT DEFAULT '青铜',
      rating INTEGER DEFAULT 1000,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      total_battles INTEGER DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0,
      last_battle_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) { console.error('飞花令排位表创建失败:', err); return; }
    console.log('✓ 飞花令排位表创建成功');
  });

  // 诗词闯关对战表
  db.run(`
    CREATE TABLE IF NOT EXISTS challenge_battles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player1_id INTEGER NOT NULL,
      player2_id INTEGER NOT NULL,
      winner_id INTEGER,
      loser_id INTEGER,
      total_questions INTEGER DEFAULT 0,
      player1_correct INTEGER DEFAULT 0,
      player2_correct INTEGER DEFAULT 0,
      total_rounds INTEGER DEFAULT 0,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      FOREIGN KEY (player1_id) REFERENCES users(id),
      FOREIGN KEY (player2_id) REFERENCES users(id),
      FOREIGN KEY (winner_id) REFERENCES users(id),
      FOREIGN KEY (loser_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) { console.error('诗词闯关对战表创建失败:', err); return; }
    console.log('✓ 诗词闯关对战表创建成功');
    db.run(`CREATE INDEX IF NOT EXISTS idx_challenge_battles_p1 ON challenge_battles(player1_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_challenge_battles_p2 ON challenge_battles(player2_id)`);
  });

  // 闯关对战：用户已出现过的诗词标题（避免跨局重复出题）
  db.run(`
    CREATE TABLE IF NOT EXISTS challenge_duel_seen_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      poem_title TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      UNIQUE(user_id, poem_title),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) { console.error('闯关对战已见诗词表创建失败:', err); return; }
    console.log('✓ 闯关对战已见诗词表创建成功');
    db.run(`CREATE INDEX IF NOT EXISTS idx_duel_seen_user ON challenge_duel_seen_titles(user_id)`);
  });

  // 诗词创作挑战表
  db.run(`
    CREATE TABLE IF NOT EXISTS poetry_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      theme TEXT NOT NULL,
      keyword TEXT,
      generated_poem TEXT,
      user_score INTEGER DEFAULT 0,
      ai_score INTEGER DEFAULT 0,
      status TEXT DEFAULT 'generated',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) { console.error('诗词创作挑战表创建失败:', err); return; }
    console.log('✓ 诗词创作挑战表创建成功');
  });

  // 错题分类表
  db.run(`
    CREATE TABLE IF NOT EXISTS wrong_question_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      category TEXT DEFAULT '记忆错误',
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (question_id) REFERENCES wrong_questions(id)
    )
  `, (err) => {
    if (err) { console.error('错题分类表创建失败:', err); return; }
    console.log('✓ 错题分类表创建成功');
  });

  // 学习活动日志表
  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      activity_data TEXT,
      duration_seconds INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) { console.error('活动日志表创建失败:', err); return; }
    console.log('✓ 活动日志表创建成功');

    // 创建活动日志索引
    db.run(`CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_logs(activity_type)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at)`);
  });
}

// 关闭数据库连接
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('关闭数据库连接失败:', err.message);
    } else {
      console.log('数据库连接已关闭');
    }
  });
}

// 导出函数
module.exports = {
  db,
  initDatabase,
  initCreationTables,
  initAbilityTables,
  closeDatabase
};
