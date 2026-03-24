const { db } = require('../utils/db');
const aiService = require('./aiService');
const { normalizeAnswer } = require('./challengeService');

const wrongQuestionCache = new Map();

function normalizeAnswerForReview(answer) {
  if (!answer) return '';
  let normalized = answer.replace(/\s/g, '');
  normalized = normalized.replace(/[，。！？；：""''（）【】、,.!?;:"'()\[\]\\/]/g, '');
  
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
    'Ｕ': 'U', 'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X', 'Ｙ': 'Y', 'Ｚ': 'Z',
    '　': ' '
  };
  
  normalized = normalized.split('').map(char => {
    if (fullWidthMap[char]) {
      return fullWidthMap[char];
    }
    const code = char.charCodeAt(0);
    if (code >= 65281 && code <= 65374) {
      return String.fromCharCode(code - 65248);
    }
    return char;
  }).join('');
  
  normalized = normalized.replace(/\s/g, '');
  
  return normalized;
}

function checkAnswer(userAnswer, correctAnswer) {
  const normalizedUser = normalizeAnswerForReview(userAnswer);
  const normalizedCorrect = normalizeAnswerForReview(correctAnswer);
  
  return normalizedUser === normalizedCorrect;
}

async function getReviewStats(userId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN mastered = 0 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN mastered = 1 THEN 1 ELSE 0 END) as mastered
      FROM wrong_questions 
      WHERE user_id = ?
    `, [userId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        const row = rows[0];
        resolve({
          total: row.total || 0,
          pending: row.pending || 0,
          mastered: row.mastered || 0
        });
      }
    });
  });
}

async function getWrongQuestions(userId, limit = 20) {
  const cacheKey = `wrong_questions_${userId}`;
  
  if (wrongQuestionCache.has(cacheKey)) {
    const cached = wrongQuestionCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.questions;
    }
  }
  
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM wrong_questions 
      WHERE user_id = ? 
        AND mastered = 0 
      ORDER BY wrong_count DESC, last_wrong_time DESC 
      LIMIT ?
    `, [userId, limit], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        wrongQuestionCache.set(cacheKey, {
          questions: rows,
          timestamp: Date.now()
        });
        resolve(rows);
      }
    });
  });
}

async function addWrongQuestion(userId, questionData) {
  const { question_id, question, answer, user_answer, level, full_poem, author, title } = questionData;
  
  wrongQuestionCache.delete(`wrong_questions_${userId}`);
  
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM wrong_questions WHERE user_id = ? AND question = ?',
      [userId, question],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row) {
          db.run(
            `UPDATE wrong_questions 
             SET wrong_count = wrong_count + 1, 
                 user_answer = ?, 
                 last_wrong_time = CURRENT_TIMESTAMP,
                 correct_streak = 0,
                 mastered = 0
             WHERE id = ?`,
            [user_answer, row.id],
            (err) => {
              if (err) reject(err);
              else resolve({ ...row, wrong_count: row.wrong_count + 1 });
            }
          );
        } else {
          db.run(
            `INSERT INTO wrong_questions 
             (user_id, question_id, question, answer, user_answer, level, full_poem, author, title) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, question_id, question, answer, user_answer, level, full_poem, author, title],
            function(err) {
              if (err) reject(err);
              else resolve({ id: this.lastID, wrong_count: 1 });
            }
          );
        }
      }
    );
  });
}

async function submitReviewAnswer(userId, questionId, userAnswer) {
  wrongQuestionCache.delete(`wrong_questions_${userId}`);
  
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM wrong_questions WHERE id = ? AND user_id = ?',
      [questionId, userId],
      async (err, question) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!question) {
          reject(new Error('题目不存在'));
          return;
        }
        
        const isCorrect = checkAnswer(userAnswer, question.answer);
        
        if (isCorrect) {
          const newStreak = question.correct_streak + 1;
          const mastered = newStreak >= 2 ? 1 : 0;
          
          db.run(
            `UPDATE wrong_questions 
             SET correct_streak = ?, mastered = ? 
             WHERE id = ?`,
            [newStreak, mastered, questionId],
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve({
                  correct: true,
                  mastered,
                  newStreak,
                  correctAnswer: question.answer
                });
              }
            }
          );
        } else {
          db.run(
            `UPDATE wrong_questions 
             SET wrong_count = wrong_count + 1, 
                 user_answer = ?, 
                 last_wrong_time = CURRENT_TIMESTAMP,
                 correct_streak = 0 
             WHERE id = ?`,
            [userAnswer, questionId],
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve({
                  correct: false,
                  correctAnswer: question.answer,
                  userAnswer
                });
              }
            }
          );
        }
      }
    );
  });
}

async function markAsMastered(userId, questionId) {
  wrongQuestionCache.delete(`wrong_questions_${userId}`);
  
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE wrong_questions SET mastered = 1 WHERE id = ? AND user_id = ?',
      [questionId, userId],
      (err) => {
        if (err) reject(err);
        else resolve({ success: true });
      }
    );
  });
}

async function deleteWrongQuestion(userId, questionId) {
  wrongQuestionCache.delete(`wrong_questions_${userId}`);
  
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM wrong_questions WHERE id = ? AND user_id = ?',
      [questionId, userId],
      (err) => {
        if (err) reject(err);
        else resolve({ success: true });
      }
    );
  });
}

async function getAIHints(question, answer, fullPoem, author, title) {
  const prompt = `你是一个古诗词教学专家，请针对一道填空题提供"逐步提示"。

要求：
1. 不允许直接给出答案
2. 提供分层提示：
   - 第一层：作者、朝代
   - 第二层：诗句意境或关键词
   - 第三层：提示答案的第一个字

输入：
题目：${question}
答案：${answer}
完整诗句：${fullPoem}
作者：${author}
标题：${title}

输出格式：
{
  "hint1": "",
  "hint2": "",
  "hint3": ""
}`;

  try {
    const result = await aiService.getAIResponse(prompt);
    
    if (result && typeof result === 'string') {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
    
    return {
      hint1: `这首诗的作者是${author}`,
      hint2: '仔细想想诗句的意境',
      hint3: `答案的第一个字是"${answer.charAt(0)}"`
    };
  } catch (error) {
    console.error('获取AI提示失败:', error);
    return {
      hint1: `这首诗的作者是${author}`,
      hint2: '仔细想想诗句的意境',
      hint3: `答案的第一个字是"${answer.charAt(0)}"`
    };
  }
}

module.exports = {
  getReviewStats,
  getWrongQuestions,
  addWrongQuestion,
  submitReviewAnswer,
  markAsMastered,
  deleteWrongQuestion,
  getAIHints,
  checkAnswer
};
