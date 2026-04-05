const express = require('express');
const router = express.Router();
const { db } = require('../utils/db');
const aiService = require('../services/aiService');
const challengeService = require('../services/challengeService');

// ==================== 初始化游戏数据表 ====================
function initCardGameTables() {
  const sqls = [
    `CREATE TABLE IF NOT EXISTS card_game_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      score INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      missed_count INTEGER NOT NULL DEFAULT 0,
      duration INTEGER NOT NULL DEFAULT 0,
      difficulty_level INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS card_game_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      user_answer TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      ai_reason TEXT,
      ai_explanation TEXT,
      ai_memory_tip TEXT,
      added_to_review INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (record_id) REFERENCES card_game_records(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS card_game_review (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 1,
      question_text TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      user_answer TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`
  ];
  sqls.forEach(sql => db.run(sql));
  console.log('[cardGameRoutes] 游戏数据表初始化完成');
}
initCardGameTables();

// ==================== 保存游戏记录 ====================
router.post('/save', (req, res) => {
  const { userId, score, wrongCount, correctCount, missedCount, duration, difficultyLevel, errors } = req.body;
  if (typeof score !== 'number') {
    return res.status(400).json({ success: false, message: '参数错误' });
  }
  const finalUserId = userId || 1;
  const finalWrong = wrongCount || 0;
  const finalCorrect = correctCount || 0;
  const finalMissed = missedCount || 0;
  const finalDuration = duration || 0;
  const finalDifficulty = difficultyLevel || 1;

  db.run(
    `INSERT INTO card_game_records (user_id, score, wrong_count, correct_count, missed_count, duration, difficulty_level)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [finalUserId, score, finalWrong, finalCorrect, finalMissed, finalDuration, finalDifficulty],
    function (err) {
      if (err) {
        console.error('保存游戏记录失败:', err);
        return res.status(500).json({ success: false, message: '保存失败' });
      }
      const recordId = this.lastID;

      // 保存错误记录
      if (errors && Array.isArray(errors) && errors.length > 0) {
        const errorStmt = db.prepare(
          `INSERT INTO card_game_errors (record_id, question_text, user_answer, correct_answer)
           VALUES (?, ?, ?, ?)`
        );
        errors.forEach(e => {
          errorStmt.run(recordId, e.questionText || '', e.userAnswer || '', e.correctAnswer || '');
        });
        errorStmt.finalize();
      }

      res.json({ success: true, recordId, message: '游戏记录已保存' });
    }
  );
});

// ==================== 获取用户历史记录 ====================
router.get('/history', (req, res) => {
  const userId = parseInt(req.query.userId) || 1;
  const limit = parseInt(req.query.limit) || 10;

  db.all(
    `SELECT * FROM card_game_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit],
    (err, rows) => {
      if (err) {
        console.error('获取历史记录失败:', err);
        return res.status(500).json({ success: false, message: '获取失败' });
      }
      res.json({ success: true, records: rows });
    }
  );
});

// ==================== 获取游戏记录详情（含错误记录） ====================
router.get('/record/:id', (req, res) => {
  const recordId = parseInt(req.params.id);
  db.get(
    `SELECT * FROM card_game_records WHERE id = ?`,
    [recordId],
    (err, record) => {
      if (err || !record) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }
      db.all(
        `SELECT * FROM card_game_errors WHERE record_id = ?`,
        [recordId],
        (err2, errors) => {
          if (err2) {
            return res.status(500).json({ success: false, message: '获取错误记录失败' });
          }
          res.json({ success: true, record, errors });
        }
      );
    }
  );
});

// ==================== 获取所有玩家排名（前N名） ====================
router.get('/ranking', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  db.all(
    `SELECT r.id, r.score, r.wrong_count, r.correct_count, r.duration, r.difficulty_level, r.created_at,
            u.username
     FROM card_game_records r
     LEFT JOIN users u ON r.user_id = u.id
     ORDER BY r.score DESC, r.duration ASC
     LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) {
        console.error('获取排名失败:', err);
        return res.status(500).json({ success: false, message: '获取失败' });
      }
      res.json({ success: true, ranking: rows });
    }
  );
});

// ==================== AI 讲解（诗词辨析） ====================
router.post('/ai-explain', async (req, res) => {
  const { questionText, wrongAnswer, correctAnswer } = req.body;
  if (!questionText || !wrongAnswer || !correctAnswer) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const systemContent = `你是一位精通中国古诗词的专家，擅长分析诗句错误的原因并给出通俗易懂的讲解。
请根据用户提供的题目、错误答案和正确答案，给出JSON格式的讲解内容。
要求：
- reason: 简洁说明错误原因（20字以内）
- explanation: 详细讲解正确答案的含义和出处（60字以内）
- memory_tip: 一个帮助记忆正确答案的趣味口诀或联想提示（30字以内）
请用中文回答，返回纯JSON对象，不要包含markdown代码块标记。`;

  const userContent = `题目：${questionText}
错误的下句：${wrongAnswer}
正确的下句：${correctAnswer}
请分析：错误答案错在哪里？正确答案好在哪里？如何记住正确答案？`;

  try {
    const result = await aiService.callAIGenerateJSON(userContent, systemContent, {
      max_tokens: 400,
      temperature: 0.7
    });
    
    if (result && result.reason && result.explanation && result.memory_tip) {
      res.json({ success: true, data: result });
    } else {
      const fallbackData = {
        reason: result?.reason || '该下句与此诗意境不符',
        explanation: result?.explanation || `正确答案"${correctAnswer}"出自原文，意境优美，韵律和谐。`,
        memory_tip: result?.memory_tip || '记住关键词，多读几遍原诗。'
      };
      res.json({ success: true, data: fallbackData, mock: true });
    }
  } catch (error) {
    console.error('AI讲解失败:', error);
    res.json({
      success: true,
      data: {
        reason: '该下句与上句不匹配',
        explanation: `正确下句应为"${correctAnswer}"。该句出自经典诗词，意境深远。`,
        memory_tip: '反复朗读原诗，加深记忆。'
      },
      mock: true
    });
  }
});

// ==================== 添加到错题本 ====================
router.post('/add-to-review', (req, res) => {
  const { userId, questionText, correctAnswer, userAnswer, recordId, errorId } = req.body;
  const uid = userId || 1;

  if (!questionText || !correctAnswer) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const now = new Date().toISOString();

  db.run(
    `INSERT INTO wrong_questions (user_id, question, answer, user_answer, wrong_count, last_wrong_time)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [String(uid), questionText, correctAnswer, userAnswer || '', now],
    function (err) {
      if (err) {
        console.error('添加错题失败:', err);
        return res.status(500).json({ success: false, message: '添加失败' });
      }
      if (errorId) {
        db.run(`UPDATE card_game_errors SET added_to_review = 1 WHERE id = ?`, [errorId]);
      }
      res.json({ success: true, message: '已添加到错题本', id: this.lastID });
    }
  );
});

// ==================== 获取复盘填空练习题 ====================
router.get('/review-questions', (req, res) => {
  const userId = parseInt(req.query.userId) || 1;
  db.all(
    `SELECT * FROM card_game_review WHERE user_id = ? ORDER BY reviewed_at DESC LIMIT 20`,
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: '获取失败' });
      }
      res.json({ success: true, questions: rows });
    }
  );
});

// ==================== 提交复盘填空答案 ====================
router.post('/review-answer', (req, res) => {
  const { reviewId, userAnswer, isCorrect } = req.body;
  db.run(
    `UPDATE card_game_review SET user_answer = ?, is_correct = ?, reviewed_at = datetime('now') WHERE id = ?`,
    [userAnswer || '', isCorrect ? 1 : 0, reviewId],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: '提交失败' });
      }
      res.json({ success: true, message: '已记录' });
    }
  );
});

// ==================== 获取诗词大富翁题目（从闯关题库200关） ====================
// 支持按难度和关卡范围筛选，每次返回指定数量的题目
router.get('/questions', (req, res) => {
  const { difficulty, startLevel, count } = req.query;
  const limit = parseInt(count) || 20;
  const start = parseInt(startLevel) || 1;

  try {
    const { POEMS } = challengeService;
    if (!POEMS || POEMS.length === 0) {
      return res.json({ success: true, questions: [], message: '题库为空' });
    }

    // 按难度筛选
    let filtered = POEMS;
    if (difficulty && ['easy', 'medium', 'hard', 'challenge'].includes(difficulty)) {
      filtered = POEMS.filter((p) => p.difficulty === difficulty);
    }

    // 按关卡范围筛选
    if (start > 1) {
      filtered = filtered.filter((p) => p.level >= start);
    }

    // 生成题目列表
    const questions = [];
    const endLevel = start + limit * 2; // 多取一些以便随机选择
    for (const poem of filtered) {
      if (poem.level >= start && poem.level < endLevel) {
        for (const couplet of poem.couplets) {
          questions.push({
            question: couplet.question,
            answer: couplet.answer,
            poem: poem.title,
            author: poem.author,
            level: poem.level,
            difficulty: poem.difficulty,
            full_poem: poem.full_poem
          });
        }
      }
    }

    // 打乱顺序后取指定数量
    const shuffled = questions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(limit, shuffled.length));

    res.json({ success: true, questions: selected, total: questions.length });
  } catch (err) {
    console.error('[cardGame] 获取题目失败:', err);
    res.status(500).json({ success: false, message: '获取题目失败' });
  }
});

// ==================== 提交答案判题 ====================
router.post('/check', (req, res) => {
  const { question, userAnswer } = req.body;
  if (!question || !userAnswer) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  try {
    const { POEMS } = challengeService;
    // 在题库中查找对应题目
    let matched = null;
    for (const poem of POEMS) {
      for (const couplet of poem.couplets) {
        if (couplet.question === question) {
          matched = couplet;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      return res.status(404).json({ success: false, message: '题目未找到' });
    }

    const { checkAnswer, normalize } = challengeService;
    const isCorrect = checkAnswer(userAnswer, matched.answer);

    res.json({
      success: true,
      isCorrect,
      correctAnswer: matched.answer,
      userAnswer,
      normalizedUser: normalize(userAnswer),
      normalizedCorrect: normalize(matched.answer)
    });
  } catch (err) {
    console.error('[cardGame] 判题失败:', err);
    res.status(500).json({ success: false, message: '判题失败' });
  }
});

module.exports = router;
