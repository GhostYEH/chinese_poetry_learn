const { db } = require('../utils/db');
const aiService = require('./aiService');

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
    'Ｋ': 'K', 'Ｌ': 'L', 'Ｍ': 'M', 'Ν': 'N', 'Ｏ': 'O',
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
      ORDER BY mastered ASC, wrong_count DESC, last_wrong_time DESC
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

/**
 * 判断题目类型
 */
function classifyQuestionType(question, answer) {
  const q = (question || '').toLowerCase();
  const a = (answer || '');

  if (q.includes('作者') || q.includes('谁写的') || q.includes('出自') || q.includes('诗人')) {
    return 'author';
  }
  if (q.includes('哪一句') || q.includes('第几') || q.includes('第几句') || q.includes('排序')) {
    return 'line_order';
  }
  if (q.includes('哪个字') || q.includes('填空') || q.includes('字音') || q.includes('读音')) {
    return 'fill_blank';
  }
  if (q.includes('意思') || q.includes('含义') || q.includes('解释') || q.includes('手法')) {
    return 'meaning';
  }
  if (q.includes('情感') || q.includes('意境') || q.includes('志') || q.includes('抱负')) {
    return 'emotion';
  }
  return 'general';
}

/**
 * 获取渐进式AI提示（核心修复）
 * 三层提示策略：
 *   Level 1（轻度）：广度引导，只给背景/氛围，不涉及答案
 *   Level 2（中度）：深度线索，给出思考方向或诗句位置线索
 *   Level 3（强提示）：字形/首字/韵脚等强暗示，但不直接给答案
 */
async function getAIHints(question, answer, fullPoem, author, title) {
  const questionType = classifyQuestionType(question, answer);
  const poem = fullPoem || '';
  const ans = answer || '';
  const auth = author || '唐代诗人';
  const ttl = title || '未知';

  const buildHint1 = () => {
    if (questionType === 'author') {
      return `这是一首古诗词的作者推断题。请问"${auth}"是哪个朝代的著名诗人？他以什么题材的诗作闻名？`;
    }
    if (questionType === 'fill_blank') {
      return `这是一道古诗词理解题，请先通读全诗，感受诗句描写的画面和情感氛围。`;
    }
    if (questionType === 'line_order') {
      return `这是古诗词句序题，需要理解每联诗句的对仗关系和逻辑顺序。`;
    }
    if (questionType === 'meaning') {
      return `这是古诗词鉴赏题，需要结合诗句内容和诗人创作背景来理解。`;
    }
    if (questionType === 'emotion') {
      return `这是古诗词情感题，请回想诗人写作此诗时的处境和心境。`;
    }
    return `请仔细阅读题目，结合诗句意境、诗人风格和创作背景综合思考。`;
  };

  const buildHint2 = () => {
    if (questionType === 'author') {
      return `提示：唐代诗人分为初唐、盛唐、中唐、晚唐四个时期，"${auth}"属于哪个时期？这个时期的诗人有何共同特点？`;
    }
    if (questionType === 'fill_blank') {
      const lines = poem.split('\n').filter(l => l.trim());
      if (lines.length >= 2) {
        return lines.length === 4
          ? `提示：这是一首五言/七言律诗，全诗共${lines.length}句，请注意对仗和押韵的句子。`
          : `提示：全诗共${lines.length}句，请注意前句的意象和后句的承接关系。`;
      }
      return `提示：仔细观察题干前后的关键词，比如动词、名词或意象，这些往往能提示答案。`;
    }
    if (questionType === 'line_order') {
      return `提示：在格律诗中，颔联和颈联必须对仗工整，请找出对仗的词组来确定顺序。`;
    }
    if (questionType === 'meaning') {
      const keyWords = poem.match(/[江山河风云雨月柳花鸟]/g);
      if (keyWords && keyWords.length > 0) {
        return `提示：诗中出现了"${[...new Set(keyWords)].slice(0, 3).join('、')}..."等意象，这些意象常用来表达某种特定情感。`;
      }
      return `提示：古诗词中的意象往往有固定的文化内涵，如"柳"谐音"留"，"月"象征思乡。`;
    }
    if (questionType === 'emotion') {
      return `提示：古诗词情感通常可以从景与情的关系、诗人用词色彩、典故运用等方面判断。`;
    }
    if (poem) {
      const firstLine = poem.split('\n')[0];
      return `提示：仔细阅读首联"${firstLine || ''}"，它往往奠定了全诗的感情基调。`;
    }
    return `提示：从诗句的用词、色彩、意象入手，结合诗人的人生经历进行推断。`;
  };

  const buildHint3 = () => {
    if (questionType === 'author') {
      const knownAuthors = ['李白', '杜甫', '白居易', '王维', '苏轼', '李清照', '辛弃疾', '陆游'];
      const otherAuthors = knownAuthors.filter(a => a !== auth).slice(0, 2);
      return `强提示：这是一道作者识别题，正确答案是"${auth}"，常见的干扰选项有"${otherAuthors.join('、')}"等，注意辨别诗风差异。`;
    }
    if (questionType === 'fill_blank') {
      if (ans.length > 0) {
        const char = ans.charAt(0);
        return `强提示：答案的第一个字是"${char}"，仔细回忆包含这个字的完整诗句。`;
      }
      return `强提示：请回忆题干所给的上一句或下一句，从对仗、押韵的角度推断空缺处。`;
    }
    if (questionType === 'line_order') {
      return `强提示：注意上下句之间的对仗关系——词性相同、词义相对或相近的词往往在同一位置。`;
    }
    if (questionType === 'meaning') {
      return `强提示：理解诗意可以从"写了什么（意象）→ 怎么写（手法）→ 为何写（情感）"三个层面递进分析。`;
    }
    if (questionType === 'emotion') {
      return `强提示：注意诗中直接表达情感的词语（如"愁""恨""喜""忧"），以及以乐景写哀情的反衬手法。`;
    }
    if (ans.length > 0) {
      return `强提示：答案以"${ans.charAt(0)}"开头，结合诗句韵脚和意境可以找到它。`;
    }
    return `强提示：请再仔细读题，注意题干中的关键词——它往往直接指向答案所在位置。`;
  };

  const built = {
    hint1: buildHint1(),
    hint2: buildHint2(),
    hint3: buildHint3()
  };

  // 单次请求生成三条提示（避免 3 路并行打满限流/超时，也缩短总耗时）
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (apiKey) {
    try {
      const aiHints = await callSiliconFlowForHints({
        question,
        answer: ans,
        fullPoem: poem,
        author: auth,
        title: ttl,
        questionType,
        builtFallback: built
      }, apiKey);

      if (aiHints) {
        return aiHints;
      }
    } catch (err) {
      console.warn('[wrongQuestionService] AI提示生成失败，使用内置提示:', err.message);
    }
  }

  return built;
}

const QUESTION_TYPE_LABEL = {
  author: '作者/出处类',
  line_order: '句序/排序类',
  fill_blank: '填空/字词类',
  meaning: '含义/鉴赏类',
  emotion: '情感/意境类',
  general: '综合类'
};

function parseHintsFromModelContent(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    const obj = JSON.parse(s);
    const h1 = (obj.hint1 || '').trim();
    const h2 = (obj.hint2 || '').trim();
    const h3 = (obj.hint3 || '').trim();
    if (h1 && h2 && h3) {
      return { hint1: h1, hint2: h2, hint3: h3 };
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

/**
 * 单次调用硅基流动 API，生成三条结构化提示（JSON）
 */
async function callSiliconFlowForHints(ctx, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  const typeLabel = QUESTION_TYPE_LABEL[ctx.questionType] || QUESTION_TYPE_LABEL.general;
  const userPrompt = `你是古诗词错题复习助教。请根据下面材料生成 3 条「由浅入深」的提示，帮助学生自己推出答案。

【题型】${typeLabel}
【题目】${ctx.question || '（无）'}
【全诗或节选】
${ctx.fullPoem || '（未提供）'}
【文献】作者：${ctx.author || '未知'}；篇名：${ctx.title || '未知'}
【正确答案】${ctx.answer || '（未知）'}（仅供你把握方向，请勿在输出中直接抄写完整答案原句；填空类不要把整句诗当作 hint1/hint2 给出。）

硬性要求：
1. 只输出一个 JSON 对象，不要 markdown、不要解释。格式：{"hint1":"...","hint2":"...","hint3":"..."}
2. 每条提示必须包含至少一个具体抓手：意象、诗句位置（如首联/颔联）、手法、字义、格律、时代背景等；禁止单独输出空洞句如「请结合意境思考」「请仔细读题」这类无信息套话。
3. hint1（浅）：约 20–45 字，给背景或诗体线索，不要等价于公布答案。
4. hint2（中）：约 25–55 字，指向诗中某句或某个字词与题干的关联，仍不写出完整标答。
5. hint3（深）：约 20–50 字，可提示首字、字数、或作者类题给朝代/别集线索；仍避免整句默写标答。

若材料不足，可结合常识推断，但不要编造篇名作者。`;

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3-8B',
        messages: [
          {
            role: 'system',
            content: '你只输出合法 JSON 对象，键为 hint1、hint2、hint3，值为中文短句。不输出任何其他字符。'
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.35,
        max_tokens: 500,
        top_p: 0.85,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[wrongQuestionService] 硅基流动API失败:', response.status, errText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    const parsed = parseHintsFromModelContent(content);
    if (parsed) {
      return parsed;
    }

    // 模型未按 JSON 返回时，用已算好的内置提示兜底，避免前端再走简陋文案
    console.warn('[wrongQuestionService] AI 返回无法解析为 JSON，使用内置渐进提示');
    return ctx.builtFallback;
  } catch (error) {
    const msg = error.name === 'AbortError' || String(error.message || '').includes('aborted')
      ? '请求超时或已中断（请检查网络或稍后再试）'
      : error.message;
    console.error('[wrongQuestionService] 调用硅基流动API异常:', msg);
    return null;
  } finally {
    clearTimeout(timeoutId);
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
