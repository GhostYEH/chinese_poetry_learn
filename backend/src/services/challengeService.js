const { db } = require('../utils/db');
const aiService = require('./aiService');

function getDifficulty(level) {
  if (level <= 50) return 'easy';
  if (level <= 120) return 'medium';
  if (level <= 180) return 'hard';
  return 'challenge';
}

function normalizeAnswer(answer) {
  if (!answer) return '';
  let normalized = answer.replace(/\s/g, ''); // 移除所有空格
  normalized = normalized.replace(/[，。！？；：""''（）【】、,.!?;:"'()\[\]\\/]/g, ''); // 移除所有标点符号
  
  // 全角转半角
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
    '　': ' ' // 全角空格
  };
  
  normalized = normalized.split('').map(char => {
    // 处理全角字符
    if (fullWidthMap[char]) {
      return fullWidthMap[char];
    }
    // 处理全角转半角（通用方法）
    const code = char.charCodeAt(0);
    if (code >= 65281 && code <= 65374) {
      return String.fromCharCode(code - 65248);
    }
    return char;
  }).join('');
  
  // 移除剩余的空格
  normalized = normalized.replace(/\s/g, '');
  
  return normalized;
}

function checkAnswer(userAnswer, correctAnswer) {
  const normalizedUser = normalizeAnswer(userAnswer);
  const normalizedCorrect = normalizeAnswer(correctAnswer);
  
  // 日志记录，便于调试
  if (normalizedUser !== normalizedCorrect) {
    console.log('答案比对:', {
      userInput: userAnswer,
      correctAnswer,
      normalizedUser,
      normalizedCorrect
    });
  }
  
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

async function generateQuestions(userId, startLevel, count) {
  // 获取用户已经回答过的题目（正确和错误都算）
  const answeredQuestions = await new Promise((resolve, reject) => {
    db.all(
      'SELECT DISTINCT poem_title, poem_author FROM user_challenge_records WHERE user_id = ?',
      [userId],
      (err, rows) => {
        if (err) {
          console.error('获取已答题目失败:', err);
          resolve([]);
        } else {
          resolve(rows || []);
        }
      }
    );
  });

  const answeredPoems = new Set(
    answeredQuestions
      .filter(r => r.poem_title && r.poem_author)
      .map(r => `${r.poem_title}_${r.poem_author}`)
  );

  const difficulty = getDifficulty(startLevel);
  const batchAsk = count + 22;

  const prompt = `你是古诗词教育专家。请生成诗词「逗号相邻半句」接句填空题（供闯关练习）。

硬性规则（服务器会据 full_poem 自动校验，不满足则整题丢弃）：
1. full_poem 必须是该作品完整正文。题干只能是「甲，____。」或「____，乙。」之一，且甲/乙必须与正文中某一逗号偶句的左/右半句字面一致；answer 必须是该偶句的另一半。
2. 禁止「____，乙」中乙为某句读小节开头第一半句（前面没有同小节可接的逗号前半句）。
3. 本次请生成 ${batchAsk} 道题（宁多勿少）；难度标签填「${difficulty}」；每题 level 填 ${startLevel}。
4. 诗词须真实可查，禁止编造。各题 title+author 尽量不重复。
5. 严格返回一个 JSON 对象（仅此对象），格式为 {"questions":[ ... ]}，数组内每项含：id, level, question, answer, full_poem, author, title, difficulty, analysis

示例（结构示意）：
{"questions":[{"id":1,"level":${startLevel},"question":"床前明月光，____。","answer":"疑是地上霜","full_poem":"床前明月光，疑是地上霜。举头望明月，低头思故乡。","author":"李白","title":"静夜思","difficulty":"${difficulty}","analysis":"《静夜思》上句接下句。"}]}`;

  const normalizePoemKey = (q) => `${q.title}_${q.author}`;

  const pushValidFromRaw = (rawList, acc, seenKeys) => {
    if (!rawList || !Array.isArray(rawList)) return;
    for (let i = 0; i < rawList.length && acc.length < count; i++) {
      const q = rawList[i];
      if (!q || !q.question || !q.answer || !q.full_poem || !q.title || !q.author) continue;
      const key = normalizePoemKey(q);
      if (answeredPoems.has(key) || seenKeys.has(key)) continue;
      const fixed = aiService.repairDuelQuestionFromFullPoem({
        ...q,
        level: q.level != null ? q.level : startLevel,
        difficulty: q.difficulty || difficulty
      });
      if (!fixed) continue;
      seenKeys.add(key);
      acc.push(fixed);
    }
  };

  const valid = [];
  const seenKeys = new Set();

  for (let round = 0; round < 3 && valid.length < count; round++) {
    try {
      const raw = await aiService.getAIGeneratedQuestions(prompt);
      pushValidFromRaw(raw, valid, seenKeys);
    } catch (e) {
      console.error('[challengeService] 拉取 AI 题目失败:', e.message);
    }
  }

  if (valid.length < count) {
    console.warn('[challengeService] AI 有效题不足，用模拟题库补足', { need: count, have: valid.length });
    const mock = generateMockQuestions(startLevel, Math.max(count * 2, 24), difficulty, answeredPoems);
    pushValidFromRaw(mock, valid, seenKeys);
  }

  if (valid.length < count) {
    throw new Error('无法生成足够有效题目，请稍后重试');
  }

  return valid.slice(0, count);
}

function generateMockQuestions(startLevel, count, difficulty, answeredPoems = new Set()) {
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
    { title: "凉州词", author: "王翰", content: "葡萄美酒夜光杯，欲饮琵琶马上催。醉卧沙场君莫笑，古来征战几人回。" },
    { title: "送孟浩然之广陵", author: "李白", content: "故人西辞黄鹤楼，烟花三月下扬州。孤帆远影碧空尽，唯见长江天际流。" },
    { title: "望天门山", author: "李白", content: "天门中断楚江开，碧水东流至此回。两岸青山相对出，孤帆一片日边来。" },
    { title: "绝句", author: "杜甫", content: "两个黄鹂鸣翠柳，一行白鹭上青天。窗含西岭千秋雪，门泊东吴万里船。" },
    { title: "九月九日忆山东兄弟", author: "王维", content: "独在异乡为异客，每逢佳节倍思亲。遥知兄弟登高处，遍插茱萸少一人。" },
    { title: "望洞庭", author: "刘禹锡", content: "湖光秋月两相和，潭面无风镜未磨。遥望洞庭山水翠，白银盘里一青螺。" }
  ];

  // 过滤掉用户已答过的诗词
  const availablePoems = defaultPoems.filter(poem => {
    const key = `${poem.title}_${poem.author}`;
    return !answeredPoems.has(key);
  });

  // 如果所有诗词都答过了，使用所有诗词
  const poemsToUse = availablePoems.length > 0 ? availablePoems : defaultPoems;

  const questions = [];
  const usedPoemLines = new Set();

  for (let i = 0; i < count; i++) {
    let poem, question, answer, analysis;
    let attempts = 0;
    const maxAttempts = 100;

    // 确保找到未使用的诗句
    while (attempts < maxAttempts) {
      const poemIndex = (i + attempts) % poemsToUse.length;
      poem = poemsToUse[poemIndex];
      const lines = poem.content.split('。').filter(l => l.trim());

      // 随机选择题目类型：0=上句填下句，1=下句填上句
      const questionType = Math.random() > 0.5 ? 0 : 1;

      // 根据难度选择不同的行
      let lineIndex;
      switch (difficulty) {
        case 'easy':
          lineIndex = 0; // 第一行（名句）
          break;
        case 'medium':
          lineIndex = 1; // 第二行（上下句）
          break;
        case 'hard':
        case 'challenge':
          lineIndex = Math.floor(Math.random() * lines.length); // 随机行
          break;
        default:
          lineIndex = 0;
      }

      const line = lines[lineIndex];
      if (!line || line.length < 8) {
        attempts++;
        continue;
      }

      const parts = line.split('，');
      if (parts.length < 2) {
        attempts++;
        continue;
      }

      if (questionType === 0) {
        // 上句填下句
        question = `${parts[0]}，____。`;
        answer = parts[1];
        analysis = `此句出自${poem.author}的《${poem.title}》，上句描述了${parts[0]}的场景，下句应该接`;
      } else {
        // 下句填上句
        question = `____，${parts[1]}。`;
        answer = parts[0];
        analysis = `此句出自${poem.author}的《${poem.title}》，下句描述了${parts[1]}的场景，上句应该是`;
      }

      const questionKey = `${question}_${answer}`;

      if (!usedPoemLines.has(questionKey)) {
        usedPoemLines.add(questionKey);
        break;
      }

      attempts++;
    }

    // 如果找不到合适的诗句，使用默认的
    if (!poem) {
      poem = poemsToUse.length > 0 ? poemsToUse[0] : defaultPoems[0];
      question = "床前明月光，____。";
      answer = "疑是地上霜";
      analysis = "经典古诗词";
    }

    questions.push({
      id: i + 1,
      level: startLevel + i,
      question,
      answer,
      full_poem: poem.content,
      author: poem.author,
      title: poem.title,
      difficulty,
      analysis
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
