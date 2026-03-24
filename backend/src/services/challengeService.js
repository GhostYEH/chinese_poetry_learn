const { db } = require('../utils/db');
const aiService = require('./aiService');

const questionCache = new Map();

function getDifficulty(level) {
  if (level <= 50) return 'easy';
  if (level <= 120) return 'medium';
  if (level <= 180) return 'hard';
  return 'challenge';
}

function normalizeAnswer(answer) {
  if (!answer) return '';
  let normalized = answer.replace(/\s/g, '');
  normalized = normalized.replace(/[，。！？；：""''（）【】、]/g, '');
  normalized = normalized.replace(/[，。！？；：""''（）【】、]/g, '');
  const fullWidthMap = {
    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
    'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｅ': 'e',
    'ｆ': 'f', 'ｇ': 'g', 'ｈ': 'h', 'ｉ': 'i', 'ｊ': 'j',
    'ｋ': 'k', 'ｌ': 'l', 'ｍ': 'm', 'ｎ': 'n', 'ｏ': 'o',
    'ｐ': 'p', 'ｑ': 'q', 'ｒ': 'r', 'ｓ': 's', 'ｔ': 't',
    'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x', 'ｙ': 'y', 'ｚ': 'z',
    'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D', 'Ｅ': 'E',
    'Ｆ': 'F', 'Ｇ': 'G', 'Ｈ': 'H', 'Ｉ': 'I', 'Ｊ': 'J',
    'Ｋ': 'K', 'Ｌ': 'L', 'Ｍ': 'M', 'Ｎ': 'N', 'Ｏ': 'O',
    'Ｐ': 'P', 'Ｑ': 'Q', 'Ｒ': 'R', 'Ｓ': 'S', 'Ｔ': 'T',
    'Ｕ': 'U', 'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X', 'Ｙ': 'Y', 'Ｚ': 'Z'
  };
  return normalized.split('').map(char => fullWidthMap[char] || char).join('');
}

function checkAnswer(userAnswer, correctAnswer) {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  return normalizedUser === normalizedCorrect;
}

async function getUserProgress(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM user_challenge_progress WHERE user_id = ?', [userId], (err, row) => {
      if (err) {
        reject(err);
      } else if (row) {
        resolve(row);
      } else {
        db.run(
          'INSERT INTO user_challenge_progress (user_id, highest_level, current_challenge_level, last_challenge_time) VALUES (?, 0, 1, ?)',
          [userId, new Date().toISOString()],
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve({
                user_id: userId,
                highest_level: 0,
                current_challenge_level: 1,
                last_challenge_time: new Date().toISOString(),
                total_ai_help_used: 0,
                total_errors: 0
              });
            }
          }
        );
      }
    });
  });
}

async function updateUserProgress(userId, level) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM user_challenge_progress WHERE user_id = ?', [userId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      const newHighestLevel = row ? Math.max(row.highest_level, level) : level;
      const nextLevel = level + 1;
      if (row) {
        db.run(
          'UPDATE user_challenge_progress SET highest_level = ?, current_challenge_level = ?, last_challenge_time = ? WHERE user_id = ?',
          [newHighestLevel, nextLevel, new Date().toISOString(), userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      } else {
        db.run(
          'INSERT INTO user_challenge_progress (user_id, highest_level, current_challenge_level, last_challenge_time) VALUES (?, ?, ?, ?)',
          [userId, newHighestLevel, nextLevel, new Date().toISOString()],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      }
    });
  });
}

async function generateQuestions(startLevel, count) {
  const cacheKey = `questions_${startLevel}_${count}`;
  
  if (questionCache.has(cacheKey)) {
    const cached = questionCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.questions;
    }
  }

  const difficulty = getDifficulty(startLevel);
  
  const prompt = `你是一个古诗词教育专家，请生成高质量、完全正确的古诗词填空题。

要求：
1. 生成 ${count} 道题
2. 难度必须严格符合 level 范围：
   - 1-50：简单（名句填空）
   - 51-120：中等（上下句）
   - 121-180：困难（指定字填空）
   - 181-200：挑战（多空）
3. 必须保证：
   - 诗句完全正确（不能编造）
   - 上下句关系正确
   - 不重复
   - 出自真实古诗词
4. 输出 JSON 格式：
[
  {
    "id": 1,
    "level": ${startLevel},
    "question": "床前明月光，____。",
    "answer": "疑是地上霜",
    "full_poem": "床前明月光，疑是地上霜。",
    "author": "李白",
    "title": "静夜思",
    "difficulty": "${difficulty}",
    "analysis": "描写思乡"
  }
]`;

  try {
    let questions = await aiService.getAIGeneratedQuestions(prompt);
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      questions = generateMockQuestions(startLevel, count, difficulty);
    }
    
    questionCache.set(cacheKey, {
      questions,
      timestamp: Date.now()
    });
    
    return questions;
  } catch (error) {
    console.error('AI生成题目失败，使用默认题目:', error);
    const questions = generateMockQuestions(startLevel, count, difficulty);
    questionCache.set(cacheKey, {
      questions,
      timestamp: Date.now()
    });
    return questions;
  }
}

function generateMockQuestions(startLevel, count, difficulty) {
  const defaultPoems = [
    { title: "静夜思", author: "李白", content: "床前明月光，疑是地上霜。举头望明月，低头思故乡。" },
    { title: "春晓", author: "孟浩然", content: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。" },
    { title: "望庐山瀑布", author: "李白", content: "日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。" },
    { title: "江雪", author: "柳宗元", content: "千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。" },
    { title: "相思", author: "王维", content: "红豆生南国，春来发几枝。愿君多采撷，此物最相思。" },
    { title: "登鹳雀楼", author: "王之涣", content: "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。" },
    { title: "悯农", author: "李绅", content: "锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。" },
    { title: "鹅", author: "骆宾王", content: "鹅鹅鹅，曲项向天歌。白毛浮绿水，红掌拨清波。" },
    { title: "咏柳", author: "贺知章", content: "碧玉妆成一树高，万条垂下绿丝绦。不知细叶谁裁出，二月春风似剪刀。" },
    { title: "凉州词", author: "王翰", content: "葡萄美酒夜光杯，欲饮琵琶马上催。醉卧沙场君莫笑，古来征战几人回。" }
  ];

  const questions = [];
  for (let i = 0; i < count; i++) {
    const poem = defaultPoems[i % defaultPoems.length];
    const lines = poem.content.split('。').filter(l => l.trim());
    const firstLine = lines[0] + '。';
    const parts = firstLine.split('，');
    const question = `${parts[0]}，____。`;
    const answer = parts[1].replace('。', '');
    
    questions.push({
      id: i + 1,
      level: startLevel + i,
      question,
      answer,
      full_poem: poem.content,
      author: poem.author,
      title: poem.title,
      difficulty,
      analysis: "经典古诗词"
    });
  }
  
  return questions;
}

async function submitAnswer(userId, level, question, userAnswer, correctAnswer, poemTitle, poemAuthor) {
  const isCorrect = checkAnswer(userAnswer, correctAnswer);
  const now = new Date().toISOString();

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO user_challenge_records 
      (user_id, level, question_content, user_answer, correct_answer, is_correct, answered_at, poem_title, poem_author) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, level, question, userAnswer, correctAnswer, isCorrect ? 1 : 0, now, poemTitle, poemAuthor],
      function(err) {
        if (err) {
          reject(err);
          return;
        }

        if (isCorrect) {
          updateUserProgress(userId, level).then(() => {
            resolve({
              correct: true,
              recordId: this.lastID
            });
          }).catch(reject);
        } else {
          db.run(
            'UPDATE user_challenge_progress SET total_errors = total_errors + 1 WHERE user_id = ?',
            [userId],
            () => {
              resolve({
                correct: false,
                recordId: this.lastID
              });
            }
          );
        }
      }
    );
  });
}

async function addToErrorBook(userId, recordId, question, userAnswer, correctAnswer, explanation) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO user_error_book 
      (user_id, record_id, question_content, user_answer, correct_answer, explanation, added_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, recordId, question, userAnswer, correctAnswer, explanation, new Date().toISOString()],
      (err) => {
        if (err) {
          reject(err);
        } else {
          db.run(
            'UPDATE user_challenge_records SET added_to_error_book = 1 WHERE id = ?',
            [recordId],
            () => resolve()
          );
        }
      }
    );
  });
}

async function getErrorBook(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM user_error_book WHERE user_id = ? ORDER BY added_at DESC',
      [userId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

async function removeFromErrorBook(userId, id) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM user_error_book WHERE user_id = ? AND id = ?',
      [userId, id],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function getLeaderboard() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT u.username, ucp.highest_level 
       FROM user_challenge_progress ucp 
       JOIN users u ON ucp.user_id = u.id 
       WHERE ucp.highest_level > 0 
       ORDER BY ucp.highest_level DESC 
       LIMIT 50`,
      [],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

module.exports = {
  getUserProgress,
  updateUserProgress,
  generateQuestions,
  submitAnswer,
  addToErrorBook,
  getErrorBook,
  removeFromErrorBook,
  getLeaderboard,
  checkAnswer,
  normalizeAnswer
};
