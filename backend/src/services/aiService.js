// AI服务模块
const { spawn } = require('child_process');
const config = require('../config/config');
const { getCacheFilePath, readCache, writeCache } = require('../utils/cache');
const fetch = require('node-fetch');

/**
 * 从文本中提取JSON（处理AI返回的markdown代码块等）
 */
function extractJSON(text) {
  if (!text) return null;
  let s = text.trim();
  // 去掉 markdown 代码块
  const codeBlockMatch = s.match(/```(?:json)?\s*\n?([\s\S]+?)\n?```/);
  if (codeBlockMatch) s = codeBlockMatch[1].trim();
  // 直接解析
  try { return JSON.parse(s); } catch (_) {}
  // 找第一个 { ... } 或 [ ... ]
  const objMatch = s.match(/\{[\s\S]+\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch (_) {}
  }
  const arrMatch = s.match(/\[[\s\S]+\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch (_) {}
  }
  return null;
}

/**
 * 调用AI生成JSON格式的内容（带自动重试和JSON修复）
 * @param {string} prompt - 用户Prompt
 * @param {string} systemContent - 系统Prompt
 * @param {object} options - 可选配置
 * @returns {Promise<object|null>} 成功返回解析后的JSON对象，失败返回null
 */
async function callAIGenerateJSON(prompt, systemContent, options = {}) {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const apiKey = process.env.SILICONFLOW_API_KEY;
      if (!apiKey) {
        console.log('[aiService] 缺少SILICONFLOW_API_KEY环境变量，返回null');
        return null;
      }

      // 第0次尝试用给定 temperature，第1次降低以减少随机，第2次再降
      const temperatures = [0.7, 0.2, 0.05];
      const defaultConfig = {
        temperature: config.ai.defaultTemperature || 0.7,
        max_tokens: config.ai.defaultMaxTokens || 500,
        top_p: config.ai.defaultTopP || 0.7,
        stream: false,
        timeout: 60000
      };
      const finalConfig = { ...defaultConfig, ...options };
      if (options.maxTokens != null) finalConfig.max_tokens = options.maxTokens;
      // 重试时逐步降低随机性
      if (attempt > 0) {
        finalConfig.temperature = temperatures[Math.min(attempt, temperatures.length - 1)];
        console.log(`[aiService] 重试第${attempt + 1}次，temperature=${finalConfig.temperature}`);
      }

      const requestData = {
        model: config.ai.model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: prompt }
        ],
        temperature: finalConfig.temperature,
        max_tokens: finalConfig.max_tokens,
        top_p: finalConfig.top_p,
        stream: finalConfig.stream,
        response_format: { type: "json_object" }
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(config.ai.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('[aiService] API请求失败:', response.status, errText);
        return null;
      }

      const responseData = await response.json();
      const msg = responseData.choices?.[0]?.message || {};
      const rawContent = (msg.content || msg.reasoning_content || '').trim();

      // 尝试提取并解析JSON
      const result = extractJSON(rawContent);
      if (result) {
        console.log('[aiService] JSON解析成功');
        return result;
      }

      // JSON 解析失败，且已达到最大重试次数
      if (attempt === MAX_RETRIES) {
        console.error('[aiService] JSON解析重试全部失败，原始内容:', rawContent.substring(0, 300));
        return null;
      }

      // 重试前追加约束 prompt
      console.warn(`[aiService] JSON解析失败，将重试（第${attempt + 1}次）`);

    } catch (error) {
      console.error(`[aiService] 调用AI失败（尝试${attempt + 1}）:`, error.message);
      if (attempt === MAX_RETRIES) return null;
    }
  }
  return null;
}

// 导出新函数
module.exports.callAIGenerateJSON = callAIGenerateJSON;

// 构建AI讲解提示词
function buildPrompt(poem, title, author, explanationType) {
  if (explanationType === "daily_life_explanation") {
    return `
      请赏析以下古诗文，重点从生活化诗意解释的角度进行分析：
      将诗词意境转化为现代生活场景描述，让读者更容易理解
      
      古诗文信息：
      标题：${title}
      作者：${author}
      内容：${poem}
      
      要求：
      - 分析要具体，结合诗词的具体内容
      - 语言要流畅、简洁
      - 回答长度控制在50-100字之间
      - 请按照JSON格式返回结果，包含以下字段：
      - daily_life_explanation: 生活化诗意解释
      
      示例JSON格式：
      {"daily_life_explanation": "..."}
      `;
  } else if (explanationType === "keyword_analysis") {
    return `
      请赏析以下古诗文，重点从关键词深度解析的角度进行分析：
      对核心意象、典故、修辞手法的专业解读
      
      古诗文信息：
      标题：${title}
      作者：${author}
      内容：${poem}
      
      要求：
      - 分析要具体，结合诗词的具体内容
      - 语言要流畅、简洁
      - 回答长度控制在50-100字之间
      - 请按照JSON格式返回结果，包含以下字段：
      - keyword_analysis: 关键词深度解析
      
      示例JSON格式：
      {"keyword_analysis": "..."}
      `;
  } else if (explanationType === "artistic_conception") {
    return `
      请赏析以下古诗文，重点从意境赏析的角度进行分析：
      分析诗词营造的具体意境，表达的情感和思想
      
      古诗文信息：
      标题：${title}
      作者：${author}
      内容：${poem}
      
      要求：
      - 分析要具体，结合诗词的具体内容
      - 语言要流畅、简洁
      - 回答长度控制在50-100字之间
      - 请按照JSON格式返回结果，包含以下字段：
      - artistic_conception: 意境赏析
      
      示例JSON格式：
      {"artistic_conception": "..."}
      `;
  } else if (explanationType === "thinking_questions") {
    return `
      请赏析以下古诗文，重点从引导性思考题的角度进行分析：
      设计开放性问题，促进深度学习与思考
      
      古诗文信息：
      标题：${title}
      作者：${author}
      内容：${poem}
      
      要求：
      - 问题要具体，结合诗词的具体内容
      - 语言要流畅、简洁
      - 请设计3个问题，每个问题控制在20-30字之间
      - 请按照JSON格式返回结果，包含以下字段：
      - thinking_questions: 引导性思考题（数组格式）
      
      示例JSON格式：
      {"thinking_questions": ["...", "...", "..."]}
      `;
  } else {
    // 默认提示词，包含所有四个方面
    return `
      请赏析以下古诗文，从以下四个方面进行分析：
      1. 生活化诗意解释：将诗词意境转化为现代生活场景描述
      2. 关键词深度解析：对核心意象、典故、修辞手法的解读
      3. 意境赏析：分析诗词营造的具体意境，表达的情感
      4. 引导性思考题：设计开放性问题，促进思考
      
      古诗文信息：
      标题：${title}
      作者：${author}
      内容：${poem}
      
      要求：
      - 分析要具体，结合诗词的具体内容
      - 语言要流畅、简洁
      - 前三个方面的回答长度各控制在50-100字之间
      - 请设计3个引导性问题，每个问题控制在20-30字之间
      - 请按照JSON格式返回结果，包含以下字段：
      - daily_life_explanation: 生活化诗意解释
      - keyword_analysis: 关键词深度解析
      - artistic_conception: 意境赏析
      - thinking_questions: 引导性思考题（数组格式）
      
      示例JSON格式：
      {"daily_life_explanation": "...", "keyword_analysis": "...", "artistic_conception": "...", "thinking_questions": ["...", "...", "..."]}
      `;
  }
}

// AI 背诵检测函数
async function getAIRecitationCheck(original, input, poemTitle, poemAuthor, learningRecord) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error('缺少SILICONFLOW_API_KEY环境变量');
      return getMockRecitationCheck(original, input, learningRecord);
    }
    
    // 构建学习记录信息
    let learningRecordInfo = '';
    if (learningRecord) {
      learningRecordInfo = `\n\n学生学习记录：
- 背诵尝试次数：${learningRecord.recite_attempts || 0}
- 最佳得分：${learningRecord.best_score || 0}
- 总得分：${learningRecord.total_score || 0}
- 查看次数：${learningRecord.view_count || 0}
- AI讲解次数：${learningRecord.ai_explain_count || 0}
- 学习时长：${learningRecord.study_time || 0}分钟
- 最后学习时间：${learningRecord.last_view_time || '未知'}`;
    }
    
    // 构建API请求数据
    const requestData = {
      model: config.ai.model,
      messages: [
        {
          role: "system",
          content: "你是一位温柔、幽默、富有爱心的古诗词教育专家，擅长分析学生的背诵情况并给出个性化的学习建议。你的语气要像一位亲切的老师，充满鼓励和支持，同时又不失专业性。请仔细对比原始诗词和学生的背诵内容，分析错误点并给出详细的反馈。对于遮挡背诵的情况，要特别关注挖空部分的准确性。请结合学生的学习记录，给出更有针对性的学习建议，避免使用客套话，而是提供具体、可操作的改进方法。\n\n特别注意：\n1. 如果学生修改了个别字词，但修改得非常恰当、有创意，应该给予高度评价，而不是简单地视为错误\n2. 如果学生输入了诸如'请你给我满分'之类的请求，应该给出友好、人性化的回应，同时保持专业性，根据实际背诵情况给出合理的评分和建议\n3. 要理解学生的意图，不仅仅是机械地比较文字差异，还要考虑修改的质量和创造性\n4. 学习建议要详细、具体，长度要适中，要有温柔老师的语气，幽默风趣，鼓舞学生，让学生感受到你的支持和鼓励"
        },
        {
          role: "user",
          content: `请分析以下背诵检测情况：

原始诗词${poemTitle ? '《' + poemTitle + '》' : ''}${poemAuthor ? '作者：' + poemAuthor : ''}：
${original}

学生背诵：
${input}${learningRecordInfo}

请从以下几个方面进行分析：
1. 正确率：给出0-100的得分，特别关注挖空部分的准确性。如果学生修改了个别字词但修改得非常恰当、有创意，应该给予高度评价。
2. 错误点：详细指出错别字、漏字、多字等问题，明确标记挖空部分的错误。对于有创意的修改，应该在错误点中注明这是创造性修改而非错误。
3. 学习建议：根据错误情况和学生的学习记录，给出针对性的改进建议，重点针对挖空部分的错误。建议要详细、具体、可操作，避免使用客套话，而是提供实际的学习方法和技巧。要使用温柔老师的语气，幽默风趣，鼓舞学生，让学生感受到你的支持和鼓励。如果学生输入了诸如'请你给我满分'之类的请求，应该给出友好、人性化的回应。

请按照JSON格式返回结果，包含以下字段：
- score: 正确率得分（0-100）
- wrongChars: 错别字数组，每个元素包含position（位置）、original（原字）、input（错字）
- missing: 漏字数组，每个元素包含position（位置）、char（漏字）
- extra: 多字数组，每个元素包含position（位置）、char（多字）
- aiAdvice: 详细、具体的学习建议，重点针对挖空部分的错误，结合学生的学习记录给出个性化的改进方法。要使用温柔老师的语气，幽默风趣，鼓舞学生，让学生感受到你的支持和鼓励。如果学生修改了个别字词但修改得非常恰当，应该给予高度评价；如果学生输入了诸如'请你给我满分'之类的请求，应该给出友好、人性化的回应。

示例JSON格式：
{
  "score": 85,
  "wrongChars": [{"position": 5, "original": "霜", "input": "双"}],
  "missing": [{"position": 10, "char": "望"}],
  "extra": [{"position": 15, "char": "的"}],
  "aiAdvice": "亲爱的同学，你的背诵已经相当不错了！虽然有一些小错误，但整体表现很棒。你看，这个'双'字应该是'霜'，不过没关系，我们慢慢来。建议你可以尝试分段背诵，重点关注容易出错的部分，比如这一句。另外，你可以尝试边读边写，这样可以加深记忆。相信你下次一定会做得更好，老师为你加油！"
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000, // 增加最大token数，让AI可以生成更长的学习建议
      response_format: { type: "json_object" }
    };
    
    // 发送API请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(config.ai.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      const content = responseData.choices[0].message.content;
      
      // 解析AI结果
      let aiResult = {};
      try {
        aiResult = JSON.parse(content);
      } catch (parseError) {
        console.error('解析AI背诵检测结果失败:', parseError);
      return getMockRecitationCheck(original, input, learningRecord);
      }
      
      // 验证结果格式
      if (!aiResult.score || !aiResult.aiAdvice) {
        throw new Error('AI返回结果格式错误');
      }
      
      return {
        score: aiResult.score,
        wrongChars: aiResult.wrongChars || [],
        missing: aiResult.missing || [],
        extra: aiResult.extra || [],
        aiAdvice: aiResult.aiAdvice
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('AI背诵检测失败:', error);
    return getMockRecitationCheck(original, input);
  }
}

// 获取模拟背诵检测结果
function getMockRecitationCheck(original, input, learningRecord) {
  // 检查用户是否输入了"请你给我满分"之类的请求
  const isRequestForFullScore = input.includes('请你给我满分') || input.includes('给我满分') || input.includes('满分');
  
  // 检查用户是否有创意性修改
  const hasCreativeModification = false; // 这里可以根据实际情况判断，暂时设为false
  
  // 先使用程序检测作为基础
  let programResult = checkRecitation(original, input);
  
  // 生成更智能的反馈
  let advice = '';
  let score = programResult.score;
  
  // 如果用户输入了"请你给我满分"，给出友好的回应
  if (isRequestForFullScore) {
    advice = '哈哈，亲爱的同学，我理解你想要满分的心情！不过你知道吗？背诵的真正目的不是为了分数，而是为了真正感受诗词的魅力，理解其中的意境和情感。';
    if (score >= 90) {
      advice += ' 不过话说回来，你的背诵已经非常出色了，得分' + score + '分，几乎接近满分了！你看，你已经做得很棒了！';
    } else if (score >= 70) {
      advice += ' 你的背诵还不错哦，得分' + score + '分！虽然还有一些小地方可以改进，但整体已经很好了。';
    } else {
      advice += ' 你的背诵还有较大的提升空间，得分' + score + '分。不过没关系，学习是一个过程，慢慢来，老师相信你一定可以的！';
    }
    advice += ' 继续努力，当你真正理解并爱上这首诗词时，满分自然就会到来！建议你可以先尝试理解诗词的意思，想象诗词描绘的场景，然后分段练习，重点关注容易出错的部分。你可以边读边写，或者尝试用自己的话复述诗词的内容，这样记忆会更深刻哦！老师为你加油，你一定可以的！';
  } 
  // 如果用户有创意性修改
  else if (hasCreativeModification) {
    // 提高评分，因为用户有创意性修改
    score = Math.min(95, score + 10);
    advice = '哇，亲爱的同学，你真是太有创意了！你对诗词的修改非常恰当，展现了你的独特见解和对诗词的深入理解，这种创新精神值得大大的鼓励！得分' + score + '分，真的很棒！';
    if (learningRecord && learningRecord.recite_attempts > 1) {
      advice += '而且相比之前的尝试，你的进步非常明显，老师都看在眼里，为你感到骄傲！';
    }
    advice += '你的修改让老师眼前一亮，说明你不仅在背诵，还在思考，在理解，这才是学习诗词的正确方式。建议你继续保持这种创新思维，同时也要掌握原诗词的精髓，这样可以更好地欣赏和理解古典诗词的魅力。老师相信你未来会在诗词学习中取得更大的进步，继续加油哦！';
  }
  // 正常情况
  else {
    if (score >= 90) {
      advice = '太棒了，亲爱的同学！你背诵得非常准确，得分' + score + '分，简直太棒了！';
      if (learningRecord && learningRecord.recite_attempts > 1) {
        advice += '而且相比之前的尝试，你的进步非常明显，老师都看在眼里，为你感到骄傲！';
      }
      advice += '你已经掌握了这首诗词的精髓，继续保持这种专注的学习态度！建议你可以尝试背诵更长的诗词，或者挑战自己在不看原文的情况下背诵，甚至可以尝试理解诗词的深层含义，感受诗人的情感。你这么有天赋，老师相信你一定可以在诗词学习中取得更大的成就！';
    } else if (score >= 70) {
      advice = '不错哦，亲爱的同学！你已经掌握了大部分内容，得分' + score + '分，整体表现很好！';
      if (programResult.wrongChars.length > 0) {
        advice += '不过有几个小错误需要注意一下，比如：' + programResult.wrongChars.map(item => item.input + '应该是' + item.original).join('，') + '。';
      }
      if (programResult.missing.length > 0) {
        advice += '还有一些内容不小心漏掉了，比如：' + programResult.missing.map(item => item.char).join('、') + '。';
      }
      if (programResult.extra.length > 0) {
        advice += '另外，有一些多余的内容可以去掉，比如：' + programResult.extra.map(item => item.char).join('、') + '。';
      }
      if (learningRecord && learningRecord.recite_attempts > 2) {
        advice += '你已经尝试了多次背诵，老师建议你分析一下每次错误的模式，重点关注重复出错的部分，这样可以更有针对性地进行练习。';
      } else {
        advice += '建议你尝试分段背诵，把诗词分成几个小部分，每部分熟练后再连起来背诵。重点关注容易出错的部分，你可以多花一些时间在这些地方。';
      }
      advice += '你已经做得很好了，只要继续努力，一定可以取得更大的进步！老师相信你，加油哦！';
    } else {
      advice = '亲爱的同学，你的背诵还有较大的提升空间，得分' + score + '分。不过没关系，学习是一个过程，慢慢来，老师相信你一定可以的！';
      if (programResult.wrongChars.length > 0) {
        advice += '有一些错别字需要注意，比如：' + programResult.wrongChars.map(item => item.input + '应该是' + item.original).join('，') + '。';
      }
      if (programResult.missing.length > 0) {
        advice += '还有一些内容需要补充，比如：' + programResult.missing.map(item => item.char).join('、') + '。';
      }
      if (programResult.extra.length > 0) {
        advice += '另外，有一些多余的内容可以去掉，比如：' + programResult.extra.map(item => item.char).join('、') + '。';
      }
      if (learningRecord && learningRecord.ai_explain_count < 1) {
        advice += '建议你先使用AI讲解功能，理解诗词的意思和结构，这样背诵会更容易哦！';
      } else {
        advice += '建议你先理解诗词的意思，想象诗词描绘的场景，然后分段背诵，每段熟练后再连贯起来。你可以边读边写，或者尝试用自己的话复述诗词的内容，这样记忆会更深刻。';
      }
      advice += '不要着急，学习是一个循序渐进的过程，老师会一直支持你，相信你一定可以越做越好！加油，你是最棒的！';
    }
  }
  
  return {
    score: score,
    wrongChars: programResult.wrongChars,
    missing: programResult.missing,
    extra: programResult.extra,
    aiAdvice: advice
  };
}

// 调用AI API获取讲解
async function getAIExplanation(poem, title, author, explanationType) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error('缺少SILICONFLOW_API_KEY环境变量');
      return getMockExplanation(title, author, explanationType);
    }
    
    // 构建API请求数据
    const requestData = {
      model: config.ai.model,
      messages: [
        {
          role: "system",
          content: "你是一位精通中国古典文学的专家，善于简洁明了地分析古诗文。你的分析应该具体、简洁，控制在50-100字之间，避免冗长和模板化语言。"
        },
        {
          role: "user",
          content: buildPrompt(poem, title, author, explanationType)
        }
      ],
      temperature: 0.3, // 降低温度，减少随机性，提高推理速度
      max_tokens: 200, // 减少最大token数，提高推理速度
      response_format: { type: "json_object" },
      top_p: 0.7, // 使用top_p采样，提高推理速度
      stream: false // 禁用流式输出，提高响应速度
    };
    
    // 发送API请求（添加超时控制）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
    
    try {
      const response = await fetch(config.ai.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      const content = responseData.choices[0].message.content;
      
      // 尝试解析JSON格式的结果
      let aiResult = {};
      try {
        aiResult = JSON.parse(content);
      } catch (parseError) {
        console.error('解析AI结果失败:', parseError);
        return getMockExplanation(title, author, explanationType);
      }
      
      // 根据讲解类型返回对应的数据
      let finalResponseData = {};
      if (explanationType === 'daily_life_explanation') {
        finalResponseData = { daily_life_explanation: aiResult.daily_life_explanation || '暂无生活化解释' };
      } else if (explanationType === 'keyword_analysis') {
        finalResponseData = { keyword_analysis: aiResult.keyword_analysis || '暂无关键词解析' };
      } else if (explanationType === 'artistic_conception') {
        finalResponseData = { artistic_conception: aiResult.artistic_conception || '暂无意境赏析' };
      } else if (explanationType === 'thinking_questions') {
        finalResponseData = { thinking_questions: aiResult.thinking_questions || ['请思考这首诗表达了怎样的情感？', '诗中的哪些意象给你留下了深刻印象？', '你认为这首诗在艺术上有什么特色？'] };
      } else {
        finalResponseData = aiResult;
      }
      
      // 写入缓存
      writeCache(title, author, explanationType, finalResponseData);
      
      return finalResponseData;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('获取AI讲解失败:', error);
    return getMockExplanation(title, author, explanationType);
  }
}

// 获取模拟讲解数据
function getMockExplanation(title, author, explanationType) {
  const mockExplanation = {
    daily_life_explanation: `这首诗《${title || '未知'}》由${author || '未知作者'}所作，通过简洁的语言表达了深刻的情感。诗句结构紧凑，意境深远，展现了诗人对生活的独特感悟。`,
    keyword_analysis: `诗中运用了多种修辞手法，如比喻、拟人等，使诗歌更加生动有趣。核心意象鲜明，表达了诗人的情感和思想。`,
    artistic_conception: `诗中描绘的场景生动形象，仿佛将读者带入了一个宁静而美好的世界。诗人通过细腻的观察和丰富的想象，创造出了独特的艺术意境，给人以美的享受。`,
    thinking_questions: ['请思考这首诗表达了怎样的情感？', '诗中的哪些意象给你留下了深刻印象？', '你认为这首诗在艺术上有什么特色？'],
    is_mock: true
  };
  
  if (explanationType === 'daily_life_explanation') {
    return { daily_life_explanation: mockExplanation.daily_life_explanation, is_mock: true };
  } else if (explanationType === 'keyword_analysis') {
    return { keyword_analysis: mockExplanation.keyword_analysis, is_mock: true };
  } else if (explanationType === 'artistic_conception') {
    return { artistic_conception: mockExplanation.artistic_conception, is_mock: true };
  } else if (explanationType === 'thinking_questions') {
    return { thinking_questions: mockExplanation.thinking_questions, is_mock: true };
  } else {
    return mockExplanation;
  }
}

// 程序级背诵检测函数
function checkRecitation(original, input) {
  console.log('原始输入 - original:', original);
  console.log('原始输入 - input:', input);
  
  // 去除标点和空白
  function normalize(text) {
    if (!text) return '';
    // 简单的字符过滤：只保留中文字符
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      // 检查是否是中文字符
      if (char >= '\u4e00' && char <= '\u9fff') {
        result += char;
      }
    }
    console.log('归一化结果:', result);
    return result;
  }
  
  const normalizedOriginal = normalize(original);
  const normalizedInput = normalize(input);
  
  console.log('归一化后 - original:', normalizedOriginal);
  console.log('归一化后 - input:', normalizedInput);
  
  const wrongChars = [];
  const missing = [];
  const extra = [];
  
  // 字符差异检测
  const maxLength = Math.max(normalizedOriginal.length, normalizedInput.length);
  console.log('最大长度:', maxLength);
  
  for (let i = 0; i < maxLength; i++) {
    const origChar = normalizedOriginal[i];
    const inputChar = normalizedInput[i];
    
    console.log('位置', i, '- 原字符:', origChar, '- 输入字符:', inputChar);
    
    if (!origChar) {
      // 输入比原诗长，多余字符
      extra.push({
        position: i,
        char: inputChar
      });
      console.log('发现多余字符:', inputChar);
    } else if (!inputChar) {
      // 输入比原诗短，缺失字符
      missing.push({
        position: i,
        char: origChar
      });
      console.log('发现缺失字符:', origChar);
    } else if (origChar !== inputChar) {
      // 字符不匹配，错字
      wrongChars.push({
        position: i,
        original: origChar,
        input: inputChar
      });
      console.log('发现错字:', inputChar, '→', origChar);
    }
  }
  
  console.log('错字:', wrongChars);
  console.log('缺失:', missing);
  console.log('多余:', extra);
  
  // 计算正确率
  let score = 0;
  if (normalizedOriginal.length > 0) {
    const correctCount = normalizedOriginal.length - wrongChars.length - missing.length;
    const totalCount = normalizedOriginal.length;
    score = Math.round((Math.max(0, correctCount) / totalCount) * 100);
  }
  
  console.log('正确数:', normalizedOriginal.length - wrongChars.length - missing.length);
  console.log('总数:', normalizedOriginal.length);
  console.log('得分:', score);
  
  const result = {
    score,
    wrongChars,
    missing,
    extra,
    aiAdvice: ''
  };
  
  console.log('最终结果:', result);
  return result;
}

// 处理AI讲解请求
async function handleAIExplanation(req, res, explanationType) {
  console.log('接收到AI讲解请求:', {
    explanationType,
    hasPoem: !!req.body.poem,
    hasTitle: !!req.body.title,
    hasAuthor: !!req.body.author
  });
  
  const { poem, title, author } = req.body;
  
  if (!poem) {
    console.log('缺少诗词内容');
    return res.status(400).json({ message: '缺少诗词内容' });
  }
  
  console.log('开始处理AI讲解请求:', {
    title: title || '无标题',
    author: author || '无作者',
    poemLength: poem.length
  });

  // 1. 检查缓存
  const cachedData = readCache(title, author, explanationType);
  if (cachedData) {
    console.log(`命中缓存: ${title} - ${explanationType || 'full'}`);
    // 添加缓存标识（可选，用于调试）
    cachedData.from_cache = true;
    return res.json(cachedData);
  }
  
  // 2. 缓存未命中，调用API获取AI讲解
  console.log('直接调用API获取AI讲解');
  
  const aiResult = await getAIExplanation(poem, title, author, explanationType);
  res.json(aiResult);
}

// 构建AI对话式助教提示词
function buildTutorPrompt(poem, title, author, question, history = []) {
  // 限制历史记录长度，避免请求过大
  const recentHistory = history.slice(-3); // 只保留最近3条记录
  
  const historyText = recentHistory.length > 0 
    ? `最近的对话历史：\n${recentHistory.map(h => `${h.role === 'user' ? '学生：' : '老师：'}${h.content}`).join('\n')}\n\n` 
    : ''; 
  
  // 解析诗句，方便AI理解用户关于诗句的问题
  const poemLines = poem.split('\n').filter(line => line.trim());
  const lineInfo = poemLines.length > 0 
    ? `\n\n诗句解析：\n${poemLines.map((line, index) => `${index + 1}. ${line}`).join('\n')}` 
    : '';
  
  return `
    你是一位中学语文老师，现在需要围绕以下古诗词回答学生的问题：
    
    古诗词信息：
    标题：${title || '未知'}
    作者：${author || '未知'}
    内容：${poem}${lineInfo}
    
    ${historyText}
    学生当前问题：
    ${question}
    
    核心规则（必须严格遵守）：
    1. 只能讨论这首诗，不允许跑题
    2. 不回答与这首诗无关的问题
    3. 回答必须基于这首诗的标题、作者、正文内容
    4. 必须引用具体诗句来支持你的回答
    5. 教学风格，亲切自然，符合中学语文老师身份
    6. 回答简洁明了，不超过100字
    7. 用解释语气，有结构，不学术论文口吻，不闲聊口吻
    8. 直接回答问题，不要使用任何引言或开场白
    9. 保持上下文连贯，记住之前的对话内容
    10. 当学生提到"第一句"、"第二句"等诗句序号时，要明确对应到具体的诗句内容
    
    示例回答风格：
    这首诗通过"明月""长风"等意象，
    营造出辽阔孤高的边塞意境，
    表达了诗人胸怀壮志却远离中原的情感。
    `;
}

// 调用AI API获取对话式助教回答
async function getAIResponse(poem, title, author, question, history = []) {
  try {
    console.log('处理AI助教请求:', {
      title: title || '未知',
      author: author || '未知',
      question: question.substring(0, 50)
    });
    
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error('缺少SILICONFLOW_API_KEY环境变量');
      return {
        answer: `针对你关于这首诗的问题，我需要更多信息来为你解答。请具体说明你想了解的方面，比如诗句含义、作者背景、艺术特色等，我会为你详细分析。`
      };
    }
    
    // 构建缓存键（使用简短的标识）
    const tutorCacheKey = `tutor_${question.substring(0, 30)}`;
    console.log('缓存键:', tutorCacheKey);
    
    // 尝试从缓存获取
    const cachedData = readCache(title, author, tutorCacheKey);
    if (cachedData) {
      console.log('命中AI助教缓存');
      return cachedData;
    }
    console.log('未命中缓存，调用API');
    
    // 构建API请求数据
    const requestData = {
      model: config.ai.model,
      messages: [
        {
          role: "system",
          content: "你是一位中学语文老师，专门讲解中国古典诗词。你的职责是：1. 只讨论当前指定的古诗词；2. 以教学风格回答，简洁明了，不超过100字；3. 引用具体诗句支持回答；4. 保持上下文连贯，记住之前的对话；5. 不回答与当前诗词无关的问题；6. 用解释语气，有结构，不学术论文口吻，不闲聊口吻。"
        },
        {
          role: "user",
          content: buildTutorPrompt(poem, title, author, question, history)
        }
      ],
      temperature: 0.1, // 进一步降低温度，减少随机性
      max_tokens: 80, // 进一步减少最大token数
      top_p: 0.5, // 进一步减少top_p值
      stream: false,
      frequency_penalty: 0.0, // 禁用频率惩罚
      presence_penalty: 0.0, // 禁用存在惩罚
      logprobs: null // 禁用概率计算
    };
    
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 减少超时时间，避免长时间等待
    
    try {
      console.log('发送AI API请求...');
      // 发送API请求
      const response = await fetch(config.ai.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log('AI API请求成功:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API请求失败:', response.status, response.statusText, errorData);
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('API返回数据:', JSON.stringify(responseData).substring(0, 200) + '...');
      
      if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
        throw new Error('API返回格式错误');
      }
      
      let answer = responseData.choices[0].message.content;
      console.log('原始回答长度:', answer.length);
      
      // 确保回答不超过100字
      if (answer.length > 100) {
        answer = answer.substring(0, 97) + '...';
        console.log('截断后回答长度:', answer.length);
      }
      
      const result = {
        answer: answer.trim()
      };
      console.log('最终回答:', result.answer);
      
      // 写入缓存
      console.log('写入缓存...');
      writeCache(title, author, tutorCacheKey, result);
      console.log('缓存写入完成');
      
      return result;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error('API请求错误:', fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error('获取AI对话回答失败:', error);
    return {
      answer: `针对你关于这首诗的问题，我需要更多信息来为你解答。请具体说明你想了解的方面，比如诗句含义、作者背景、艺术特色等，我会为你详细分析。`
    };
  }
}

// 构建AI改写诗意提示词
function buildRewritePrompt(poem, title, author) {
  return `
    请将以下古诗改写为现代白话文解释，保持原意的同时，使用通俗易懂的现代语言表达，让读者更容易理解诗中的意境和情感。
    
    古诗信息：
    标题：${title}
    作者：${author}
    内容：${poem}
    
    要求：
    1. 语言要流畅、自然，符合现代口语表达习惯
    2. 保持诗歌的意境和情感，不要遗漏重要内容
    3. 回答长度控制在200字以内
    4. 请直接输出改写后的内容，不要添加任何引言或开场白
    `;
}

// 构建按维度解释的提示词
function buildDimensionPrompt(poem, title, author, dimension) {
  const dimensionMap = {
    '情感': '分析这首诗表达的情感，引用具体诗句说明',
    '意象': '分析诗中的核心意象及其象征意义',
    '写法': '分析诗的写作手法和艺术特色',
    '结构': '分析诗的结构安排和层次',
    '考点': '分析这首诗的重要考点和考试重点',
    '背诵技巧': '提供背诵这首诗的有效技巧和方法'
  };
  
  const dimensionPrompt = dimensionMap[dimension] || '分析这首诗的内容和艺术特色';
  
  return `
    你是一位中学语文老师，现在需要从以下维度分析古诗词：
    
    古诗词信息：
    标题：${title || '未知'}
    作者：${author || '未知'}
    内容：${poem}
    
    分析维度：${dimension}
    分析要求：${dimensionPrompt}
    
    回答规则：
    1. 只能讨论这首诗，不允许跑题
    2. 以教学风格回答，简洁明了，不超过150字
    3. 引用具体诗句支持你的分析
    4. 用解释语气，有结构，不学术论文口吻，不闲聊口吻
    5. 直接回答，不要使用任何引言或开场白
    `;
}

// 构建学习建议提示词
function buildLearningAdvicePrompt(poem, title, author) {
  return `
    你是一位中学语文老师，现在需要为学生提供学习以下古诗词的建议：
    
    古诗词信息：
    标题：${title || '未知'}
    作者：${author || '未知'}
    内容：${poem}
    
    建议内容：
    1. 指出诗中的重点句子和考试常考句
    2. 提供背诵和理解的建议
    3. 推荐相关的学习资源或方法
    
    回答规则：
    1. 只能讨论这首诗，不允许跑题
    2. 以教学风格回答，简洁明了，不超过150字
    3. 引用具体诗句支持你的建议
    4. 用解释语气，有结构，不学术论文口吻，不闲聊口吻
    5. 直接回答，不要使用任何引言或开场白
    `;
}

// 构建简化解释提示词
function buildSimplifiedExplanationPrompt(poem, title, author, originalExplanation) {
  return `
    你是一位中学语文老师，现在需要将以下古诗词的解释简化，用更简单的语言表达：
    
    古诗词信息：
    标题：${title || '未知'}
    作者：${author || '未知'}
    内容：${poem}
    
    原解释：
    ${originalExplanation}
    
    简化要求：
    1. 使用更简单、更口语化的语言
    2. 保持原解释的核心内容和情感
    3. 回答长度控制在150字以内
    4. 直接回答，不要使用任何引言或开场白
    `;
}

// 调用AI API获取改写后的诗意
async function getAIrewritePoem(poem, title, author) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error('缺少SILICONFLOW_API_KEY环境变量');
      return {
        rewrite: `这首诗《${title || '未知'}》由${author || '未知作者'}所作，通过简洁的语言表达了深刻的情感。诗句结构紧凑，意境深远，展现了诗人对生活的独特感悟。`
      };
    }
    
    // 构建API请求数据
    const requestData = {
      model: config.ai.model,
      messages: [
        {
          role: "system",
          content: "你是一位精通中国古典文学的专家，擅长将古诗词转化为通俗易懂的现代白话文，保持原意的同时让读者更容易理解。"
        },
        {
          role: "user",
          content: buildRewritePrompt(poem, title, author)
        }
      ],
      temperature: 0.3,
      max_tokens: 250,
      top_p: 0.7,
      stream: false
    };
    
    // 发送API请求
    const response = await fetch(config.ai.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestData),
      timeout: config.ai.timeout
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    const rewrite = responseData.choices[0].message.content;
    
    return {
      rewrite: rewrite.trim()
    };
  } catch (error) {
    console.error('获取AI改写诗意失败:', error);
    return {
      rewrite: `这首诗《${title || '未知'}》由${author || '未知作者'}所作，通过简洁的语言表达了深刻的情感。诗句结构紧凑，意境深远，展现了诗人对生活的独特感悟。`
    };
  }
}

// 调用AI API获取按维度解释
async function getDimensionExplanation(poem, title, author, dimension) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error('缺少SILICONFLOW_API_KEY环境变量');
      return {
        explanation: `从${dimension}角度分析，这首诗《${title || '未知'}》由${author || '未知作者'}所作，具有独特的艺术价值。`
      };
    }
    
    // 构建API请求数据
    const requestData = {
      model: config.ai.model,
      messages: [
        {
          role: "system",
          content: "你是一位中学语文老师，擅长从不同维度分析中国古典诗词，以教学风格回答，简洁明了，引用具体诗句支持分析。"
        },
        {
          role: "user",
          content: buildDimensionPrompt(poem, title, author, dimension)
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
      top_p: 0.7,
      stream: false
    };
    
    // 发送API请求
    const response = await fetch(config.ai.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestData),
      timeout: config.ai.timeout
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    let explanation = responseData.choices[0].message.content;
    
    // 确保回答不超过150字
    if (explanation.length > 150) {
      explanation = explanation.substring(0, 147) + '...';
    }
    
    return {
      explanation: explanation.trim()
    };
  } catch (error) {
    console.error('获取按维度解释失败:', error);
    return {
      explanation: `从${dimension}角度分析，这首诗《${title || '未知'}》由${author || '未知作者'}所作，具有独特的艺术价值。`
    };
  }
}

// 调用AI API获取学习建议
async function getLearningAdvice(poem, title, author) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error('缺少SILICONFLOW_API_KEY环境变量');
      return {
        advice: `学习《${title || '未知'}》时，建议重点理解诗的意境和情感，多读多背，感受诗歌的美感。`
      };
    }
    
    // 构建API请求数据
    const requestData = {
      model: config.ai.model,
      messages: [
        {
          role: "system",
          content: "你是一位中学语文老师，擅长为学生提供中国古典诗词的学习建议，实用具体，引用具体诗句。"
        },
        {
          role: "user",
          content: buildLearningAdvicePrompt(poem, title, author)
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
      top_p: 0.7,
      stream: false
    };
    
    // 发送API请求
    const response = await fetch(config.ai.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestData),
      timeout: config.ai.timeout
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    let advice = responseData.choices[0].message.content;
    
    // 确保回答不超过150字
    if (advice.length > 150) {
      advice = advice.substring(0, 147) + '...';
    }
    
    return {
      advice: advice.trim()
    };
  } catch (error) {
    console.error('获取学习建议失败:', error);
    return {
      advice: `学习《${title || '未知'}》时，建议重点理解诗的意境和情感，多读多背，感受诗歌的美感。`
    };
  }
}

// 调用AI API获取简化解释
async function getSimplifiedExplanation(poem, title, author, originalExplanation) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error('缺少SILICONFLOW_API_KEY环境变量');
      return {
        simplified: `《${title || '未知'}》是一首表达情感的诗，通过描写具体场景，让读者感受到诗人的内心世界。`
      };
    }
    
    // 构建API请求数据
    const requestData = {
      model: config.ai.model,
      messages: [
        {
          role: "system",
          content: "你是一位中学语文老师，擅长用简单易懂的语言解释中国古典诗词，保持原意的同时让学生更容易理解。"
        },
        {
          role: "user",
          content: buildSimplifiedExplanationPrompt(poem, title, author, originalExplanation)
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
      top_p: 0.7,
      stream: false
    };
    
    // 发送API请求
    const response = await fetch(config.ai.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestData),
      timeout: config.ai.timeout
    });
    
    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    const responseData = await response.json();
    let simplified = responseData.choices[0].message.content;
    
    // 确保回答不超过150字
    if (simplified.length > 150) {
      simplified = simplified.substring(0, 147) + '...';
    }
    
    return {
      simplified: simplified.trim()
    };
  } catch (error) {
    console.error('获取简化解释失败:', error);
    return {
      simplified: `《${title || '未知'}》是一首表达情感的诗，通过描写具体场景，让读者感受到诗人的内心世界。`
    };
  }
}

// 调用AI API获取字符信息
async function getCharInfo(prompt) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error('缺少SILICONFLOW_API_KEY环境变量');
      return JSON.stringify({ phonetic: '未知', meaning: '暂无注释' });
    }
    
    // 构建API请求数据
    const requestData = {
      model: config.ai.model,
      messages: [
        {
          role: "system",
          content: "你是一位中学语文老师，擅长分析汉字的读音和释义，特别是在古诗词中的用法。请根据用户提供的prompt，准确返回汉字的读音和在该语境中的释义。请严格按照JSON格式返回结果，不要添加任何额外内容。"
        },
        {
          role: "user",
          content: `请分析以下prompt中指定汉字的读音和释义：\n${prompt}\n\n要求：\n1. 明确给出汉字的标准读音\n2. 解释该汉字在该诗句中的具体含义\n3. 语言简洁明了\n4. 请严格按照以下JSON格式返回结果：\n{"phonetic": "[拼音]", "meaning": "[解释]"}`
        }
      ],
      temperature: 0.1, // 降低温度，减少随机性
      max_tokens: 50, // 减少最大token数，提高速度
      top_p: 0.5, // 减少top_p值，提高速度
      stream: false,
      response_format: { type: "json_object" } // 要求返回JSON格式
    };
    
    // 发送API请求（添加超时控制和重试机制）
    let response;
    let retries = 1;
    
    while (retries > 0) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      try {
        response = await fetch(config.ai.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestData),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        break;
      } catch (error) {
        clearTimeout(timeoutId);
        if (retries > 0 && (error.name === 'AbortError' || error.message.includes('timeout'))) {
          retries--;
          console.log('AI请求超时，重试中...');
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          throw error;
        }
      }
    }
    
    if (!response || !response.ok) {
      throw new Error(`API请求失败: ${response?.status || '未知错误'} ${response?.statusText || ''}`);
    }
    
    const responseData = await response.json();
    const content = responseData.choices[0].message.content;
    
    return content.trim();
  } catch (error) {
    console.error('获取字符信息失败:', error);
    return JSON.stringify({ phonetic: '未知', meaning: '暂无注释' });
  }
}

/**
 * 生成诗词闯关题目
 * @param {number} level - 关卡数
 * @param {string} difficulty - 难度梯度
 * @param {string} questionType - 题型
 * @param {number} userId - 用户ID
 * @returns {Promise<object|null>} 成功返回题目对象，失败返回null
 */
async function generateChallengeQuestion(level, difficulty, questionType, userId) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.log('[aiService] 缺少SILICONFLOW_API_KEY环境变量，返回null');
      return null;
    }

    // 构建AI提示词
    const prompt = `
      为诗词闯关模块生成第 ${level} 关的题目（共300关），难度为 ${difficulty}，题型为 ${questionType}，要求：
      1. 题目对应的诗词需符合该难度梯度（入门/基础/进阶/提升/精通）
      2. 避免使用该用户（ID：${userId}）历史闯关记录中已出现的诗词
      3. 题目格式要求：
         - 上下句接句题：必须严格按照以下格式：给出上句说下句或者下句说上句，例如：
           * 上句：床前明月光，下句是什么？
           * 下句：疑是地上霜，上句是什么？
           注意：
           - 必须确保上下句的关系正确，上下句必须是相邻的句子
           - 必须确保给出的是真正的上句或下句，例如：
             * "山重水复疑无路"是上句，"柳暗花明又一村"是下句，所以题目应该是：上句：山重水复疑无路，下句是什么？
             * 绝对不可以出现：下句：山重水复疑无路，上句是什么？这样的错误题目
           - 正确的上下句示例：
             * "白日依山尽"的下一句是"黄河入海流"
             * "黄河入海流"的下一句是"欲穷千里目"
             * "欲穷千里目"的下一句是"更上一层楼"
             * "空山新雨后"的下一句是"天气晚来秋"
             * "天气晚来秋"的下一句是"明月松间照"
             * "明月松间照"的下一句是"清泉石上流"
           - 不要跳过句子，必须是直接相邻的上下句关系
         - 诗人/朝代匹配题：改为选择题，提供四个选项，其中一个正确答案
         - 意境理解题：改为选择题，提供四个选项，其中一个正确答案
         - 字词释义题：改为选择题，提供四个选项，其中一个正确答案
      4. 附带正确答案、解析、难度系数
      5. 确保题目唯一性，不同用户/重闯同关时诗词不同但难度一致
      6. 生成题目时就确定答案，确保答案的准确性
      
      请严格按照以下JSON格式返回，不要添加任何其他文字：
      {
        "question": "题目内容",
        "correctAnswer": "正确答案",
        "options": ["选项1", "选项2", "选项3", "选项4"],
        "explanation": "题目解析",
        "difficulty": 难度系数（1-5）,
        "poemTitle": "诗词标题",
        "poemAuthor": "诗词作者",
        "poemContent": "完整诗词内容"
      }
    `;

    const systemContent = "你是一位精通中国古典诗词的专家，擅长设计各种难度和类型的诗词题目。";

    // 调用AI服务
    const result = await callAIGenerateJSON(prompt, systemContent, { temperature: 0.7, max_tokens: 1000 });
    return result;
  } catch (error) {
    console.error('[aiService] 生成闯关题目失败:', error);
    return null;
  }
}

/**
 * 验证闯关答题答案
 * @param {string} question - 题目内容
 * @param {string} userAnswer - 用户答案
 * @param {string} correctAnswer - 正确答案
 * @param {string} difficulty - 难度梯度
 * @returns {Promise<object|null>} 成功返回验证结果，失败返回null
 */
async function verifyChallengeAnswer(question, userAnswer, correctAnswer, difficulty) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.log('[aiService] 缺少SILICONFLOW_API_KEY环境变量，返回null');
      return null;
    }

    // 构建AI提示词
    const prompt = `
      校验以下诗词闯关题目答案是否正确：
      题目：${question}
      用户答案：${userAnswer}
      正确答案：${correctAnswer}
      
      要求：
      1. 判断是否正确，若为近似正确（如同义释义、通假字）需标注
      2. 给出简洁解析（包含诗词背景、考点说明）
      3. 解析语言通俗易懂，适配中小学生认知水平
      
      请严格按照以下JSON格式返回，不要添加任何其他文字：
      {
        "isCorrect": true/false,
        "isApproximate": true/false,
        "explanation": "解析内容",
        "score": 得分（0-100）
      }
    `;

    const systemContent = "你是一位专业的古诗词教育专家，擅长分析和评价学生的答题情况。";

    // 调用AI服务
    const result = await callAIGenerateJSON(prompt, systemContent, { temperature: 0.3, max_tokens: 500 });
    return result;
  } catch (error) {
    console.error('[aiService] 验证闯关答案失败:', error);
    return null;
  }
}

/**
 * 生成AI帮助阶梯式提示
 * @param {string} question - 题目内容
 * @param {string} difficulty - 难度梯度
 * @returns {Promise<object|null>} 成功返回提示对象，失败返回null
 */
async function generateAIHelp(question, difficulty) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.log('[aiService] 缺少SILICONFLOW_API_KEY环境变量，返回null');
      return null;
    }

    // 构建AI提示词
    const prompt = `
      为以下诗词闯关题目生成阶梯式帮助提示（非直接给出答案）：
      题目：${question}
      难度：${difficulty}
      
      要求：
      1. 分3步提示，第一步提示考点，第二步提示关键线索（拼音/偏旁/意境），第三步给出答案
      2. 提示语言简洁，引导用户思考，而非直接告知
      3. 适配中小学生认知水平
      
      请严格按照以下JSON格式返回，不要添加任何其他文字：
      {
        "step1": "第一步提示",
        "step2": "第二步提示",
        "step3": "第三步提示"
      }
    `;

    const systemContent = "你是一位耐心的古诗词老师，擅长通过引导式提示帮助学生思考和解决问题。";

    // 调用AI服务
    const result = await callAIGenerateJSON(prompt, systemContent, { temperature: 0.5, max_tokens: 500 });
    return result;
  } catch (error) {
    console.error('[aiService] 生成AI帮助提示失败:', error);
    return null;
  }
}

async function getAIGeneratedQuestions(prompt) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.log('[aiService] 缺少SILICONFLOW_API_KEY环境变量，返回null');
      return null;
    }

    const systemContent = "你是一个古诗词教育专家，擅长生成高质量的古诗词填空题。";

    const result = await callAIGenerateJSON(prompt, systemContent, { 
      temperature: 0.7, 
      max_tokens: 3000,
      timeout: 60000
    });

    if (result && Array.isArray(result)) {
      return result;
    }
    if (result && result.questions && Array.isArray(result.questions)) {
      return result.questions;
    }
    if (result && result.data && Array.isArray(result.data)) {
      return result.data;
    }
    if (result && result.items && Array.isArray(result.items)) {
      return result.items;
    }

    return null;
  } catch (error) {
    console.error('[aiService] 生成题目失败:', error);
    return null;
  }
}

/**
 * 根据诗词内容生成意境图
 * @param {string} poem - 诗词内容
 * @param {string} title - 诗词标题
 * @param {string} author - 作者
 * @returns {Promise<object|null>} 返回图片URL或null
 */
async function generatePoemImage(poem, title, author) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.log('[aiService] 缺少SILICONFLOW_API_KEY环境变量，无法生成图片');
      return null;
    }

    // 构建图片生成的提示词 - 使用中文描述更准确
    const imagePrompt = `中国传统水墨画风格，描绘诗词《${title}》的意境。${poem}。画面要体现诗中的意象和情感，淡雅古朴，意境深远，高清细腻，无文字，无水印。`;

    console.log('[aiService] 生成诗词意境图:', { title, author, promptLength: imagePrompt.length });

    // 使用硅基流动的文生图API
    const response = await fetch('https://api.siliconflow.cn/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'stabilityai/stable-diffusion-2-1',
        prompt: imagePrompt,
        image_size: '512x512',
        num_inference_steps: 20
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[aiService] 图片生成失败:', response.status, response.statusText, errorData);
      return null;
    }

    const responseData = await response.json();
    console.log('[aiService] 图片生成成功:', responseData);

    if (responseData.images && responseData.images.length > 0) {
      return {
        success: true,
        imageUrl: responseData.images[0].url,
        prompt: imagePrompt
      };
    }

    return null;
  } catch (error) {
    console.error('[aiService] 生成诗词意境图失败:', error);
    return null;
  }
}

/**
 * 飞花令AI诗句评判
 * 使用SiliconFlow Qwen3-8B模型评判诗句是否符合飞花令规则
 * @param {string} poem - 用户提交的诗句
 * @param {string} keyword - 令字
 * @param {string} difficulty - 难度: easy(入门), medium(进阶), hard(专业)
 * @param {string[]} usedPoems - 已使用的诗句列表
 * @returns {Promise<object|null>} 评判结果
 */
async function evaluateFeihuaPoem(poem, keyword, difficulty = 'medium', usedPoems = []) {
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      console.error('[aiService] 缺少SILICONFLOW_API_KEY环境变量');
      return getMockFeihuaEvaluation(poem, keyword);
    }

    const usedPoemsText = usedPoems.length > 0
      ? `以下诗句已经被对方使用过，请勿重复：\n${usedPoems.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : '暂无已用诗句';

    const difficultyRules = {
      easy: '入门难度：只要诗句中包含「' + keyword + '」字就算通过。',
      medium: '进阶难度：诗句必须包含「' + keyword + '」字，且句子完整、符合诗词格律。',
      hard: '专业难度：诗句必须包含「' + keyword + '」字，且必须是经典古诗词名句，符合平仄格律。'
    };

    const prompt = `你是一位飞花令裁判，请评判以下诗句是否符合飞花令规则：

令字：${keyword}
难度：${difficulty}
规则说明：${difficultyRules[difficulty] || difficultyRules.medium}

用户提交的诗句：${poem}

${usedPoemsText}

请严格按照以下JSON格式返回评判结果：
{
  "isValid": true或false，表示诗句是否有效
  "score": 0-100的分值，评估诗句的质量和难度
  "reason": 评判理由，说明为什么有效或无效
  "poemInfo": {
    "title": "如果能识别出诗句出处，填写诗词标题，否则填写null",
    "author": "如果能识别出诗句出处，填写作者，否则填写null"
  }
}

注意：
1. 如果诗句不包含「${keyword}」字，必须返回isValid: false
2. 如果诗句已经被使用过（在已用诗句列表中出现），必须返回isValid: false，reason中说明"诗句重复"
3. 如果诗句质量过低（如胡乱编造、不符合格律），可以返回isValid: false
4. 对于专业难度的评判，应更加严格
5. 请直接返回JSON，不要包含任何其他文字`;

    const requestData = {
      model: 'Qwen/Qwen3-8B',
      messages: [
        {
          role: "system",
          content: "你是一位严格公正的飞花令裁判。你的职责是准确评判诗句是否符合飞花令规则。你的判断必须公正、准确、严格。请始终按照JSON格式返回结果。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 800,
      top_p: 0.3,
      stream: false,
      response_format: { type: "json_object" }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[aiService] 飞花令评判API失败:', response.status, errorData);
        return getMockFeihuaEvaluation(poem, keyword);
      }

      const responseData = await response.json();
      const content = responseData.choices[0].message.content;
      console.log('[aiService] 飞花令AI评判原始输出:', content);

      let aiResult;
      try {
        aiResult = JSON.parse(content);
      } catch (parseError) {
        console.error('[aiService] 飞花令评判JSON解析失败:', parseError);
        return getMockFeihuaEvaluation(poem, keyword);
      }

      // 安全验证
      if (typeof aiResult.isValid !== 'boolean') {
        console.error('[aiService] AI评判结果格式错误:', aiResult);
        return getMockFeihuaEvaluation(poem, keyword);
      }

      return {
        isValid: aiResult.isValid,
        score: typeof aiResult.score === 'number' ? Math.max(0, Math.min(100, aiResult.score)) : 70,
        reason: aiResult.reason || '评判完成',
        poemInfo: aiResult.poemInfo || { title: null, author: null }
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('[aiService] 飞花令评判失败:', error);
    return getMockFeihuaEvaluation(poem, keyword);
  }
}

/**
 * 获取模拟的飞花令评判结果（作为API不可用时的fallback）
 */
function getMockFeihuaEvaluation(poem, keyword) {
  const normalizedPoem = poem.replace(/[，。！？、；：""''（）【】《》\s]/g, '');
  const hasKeyword = normalizedPoem.includes(keyword);

  if (!hasKeyword) {
    return {
      isValid: false,
      score: 0,
      reason: `诗句中未包含令字「${keyword}」`,
      poemInfo: { title: null, author: null }
    };
  }

  return {
    isValid: true,
    score: 75,
    reason: '诗句有效，符合飞花令规则',
    poemInfo: { title: null, author: null }
  };
}

/**
 * 半句归一化（用于匹配题干与偶句）
 */
function normalizeHalfRaw(s) {
  if (!s) return '';
  return String(s)
    .replace(/\s/g, '')
    .replace(/[。！？…；、""''（）《》\s]/g, '');
}

/**
 * 将全文按句读切分后，提取所有「左半，右半」相邻偶句（同一小节内逗号衔接）。
 */
function extractCommaCouplets(fullPoem) {
  const poem = String(fullPoem || '').replace(/\s/g, '');
  const chunks = poem.split(/[。！？；]+/).filter(Boolean);
  const pairs = [];
  for (const chunk of chunks) {
    const parts = chunk.split(/[，]/);
    for (let i = 0; i < parts.length - 1; i++) {
      const left = parts[i].trim();
      const right = parts[i + 1].trim();
      if (left && right) pairs.push({ left, right });
    }
  }
  return pairs;
}

/**
 * 从 full_poem 的偶句结构推导空缺处唯一正确答案。
 * - 「____，乙」→ 在诗中找到「某，乙」偶句，答案为「某」；若无（如乙为某句首半）则无效。
 * - 「甲，____」→ 找到「甲，某」，答案为「某」。
 */
function deriveAdjacentAnswerFromPoem(question, fullPoem) {
  const pairs = extractCommaCouplets(fullPoem);
  if (!pairs.length) return { ok: false, answer: null };

  const qStr = String(question || '').replace(/\s/g, '');
  const blankPat = '(?:_{3,}|＿{3,}|…{2,}|……)';

  const mBlankFirst = qStr.match(new RegExp(blankPat + '\\s*，\\s*([^，_' + '…' + ']+?)(?:[。！？…；]|$)'));
  if (mBlankFirst) {
    const anchorRaw = mBlankFirst[1].replace(/[。！？…；]+$/g, '').trim();
    if (!anchorRaw || /^_+$/.test(anchorRaw)) return { ok: false, answer: null };
    const na = normalizeHalfRaw(anchorRaw);
    const hit = pairs.find((p) => normalizeHalfRaw(p.right) === na);
    if (hit) return { ok: true, answer: hit.left };
    return { ok: false, answer: null };
  }

  const mBlankSecond = qStr.match(new RegExp('^(.+?)，\\s*' + blankPat + '(?:[。！？…；]|$)'));
  if (mBlankSecond) {
    const anchorRaw = mBlankSecond[1].replace(/^[。！？…，；]+/g, '').replace(/[。！？…；]+$/g, '').trim();
    if (!anchorRaw || anchorRaw.includes('_') || /^…+$/.test(anchorRaw)) return { ok: false, answer: null };
    const na = normalizeHalfRaw(anchorRaw);
    const hit = pairs.find((p) => normalizeHalfRaw(p.left) === na);
    if (hit) return { ok: true, answer: hit.right };
    return { ok: false, answer: null };
  }

  return { ok: false, answer: null };
}

/**
 * 根据 full_poem 的偶句表校验并覆盖 answer；无法对齐则返回 null（须丢弃该题并重试 AI）。
 */
function repairDuelQuestionFromFullPoem(item) {
  if (!item || !item.question || !item.full_poem) return null;
  const { ok, answer } = deriveAdjacentAnswerFromPoem(item.question, item.full_poem);
  if (!ok || !answer) {
    console.warn('[aiService] 接句题与全文偶句无法对齐，已丢弃:', {
      title: item.title,
      question: item.question,
      aiAnswer: item.answer
    });
    return null;
  }
  const prev = normalizeHalfRaw(item.answer);
  const next = normalizeHalfRaw(answer);
  if (prev !== next) {
    console.warn('[aiService] 接句题答案已按偶句表修正:', {
      title: item.title,
      question: item.question,
      was: item.answer,
      now: answer
    });
  }
  return { ...item, answer };
}

/**
 * 闯关对战AI出题
 * 生成一道不重复的诗词接句题目（给出上句填下句，或给出下句填上句）
 * @param {number} count - 题目数量
 * @param {string[]} excludeTitles - 要排除的诗词标题列表（确保不重复）
 * @returns {Promise<object|null>}
 */
async function generateDuelQuestions(count = 1, excludeTitles = [], attempt = 0) {
  const MAX_API_ATTEMPTS = 4;
  try {
    const apiKey = process.env.SILICONFLOW_API_KEY;
    if (!apiKey) {
      return pickValidDuelQuestionsFromPool(count, excludeTitles);
    }

    const excludeText = excludeTitles.length > 0
      ? `\n以下诗词的标题不要使用（已被使用过）：\n${excludeTitles.map(t => `- ${t}`).join('\n')}`
      : '';

    const batchSize = Math.min(14, Math.max(count + 8, 6));

    const prompt = `你是一个古诗词教育专家，请生成高质量的诗词接句题目，供双人闯关对战使用。

硬性规则（违反任意一条视为废题）：
1. full_poem 必须是该诗词完整正文，句读齐全；从中按逗号拆成的相邻两半句必须真实相邻。
2. 题型只能是二选一：
   - 上句填下句：题干为「甲，____。」其中「甲」必须是 full_poem 里某半句，answer 必须是同一逗号偶句里紧接在「甲，」后面的那半句。
   - 下句填上句：题干为「____，乙。」其中「乙」必须是 full_poem 里某半句，且「乙」前面在同一句读小节内必须有逗号前的那半句；answer 必须是「乙」前面紧邻的那半句。禁止「乙」为全诗第一个半句（否则没有上句可填）。
3. question、answer、full_poem 三者必须自洽；answer 不得取自其它逗号偶句。
4. 生成 ${batchSize} 道（多生成几道以便筛选），标题不重复，不使用：${excludeTitles.length > 0 ? excludeTitles.join('、') : '无'}${excludeText}

请严格按照以下JSON格式返回（不要包含任何其他文字）：
{
  "questions": [
    {
      "question": "床前明月光，____。",
      "answer": "疑是地上霜",
      "full_poem": "床前明月光，疑是地上霜。举头望明月，低头思故乡。",
      "title": "静夜思",
      "author": "李白",
      "type": "上句填下句",
      "analysis": "此句出自李白《静夜思》，描写了诗人在寂静夜晚对故乡的思念"
    }
  ]
}`;

    const requestData = {
      model: 'Qwen/Qwen3-8B',
      messages: [
        {
          role: "system",
          content: "你是一位严格专业的古诗词专家，只返回JSON格式的题目，不返回任何其他文字。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.82,
      max_tokens: 2800,
      top_p: 0.55,
      stream: false,
      response_format: { type: "json_object" }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('[aiService] 闯关对战出题API失败:', response.status);
        if (attempt + 1 < MAX_API_ATTEMPTS) {
          return generateDuelQuestions(count, excludeTitles, attempt + 1);
        }
        return pickValidDuelQuestionsFromPool(count, excludeTitles);
      }

      const responseData = await response.json();
      const content = responseData.choices[0].message.content;
      console.log('[aiService] 闯关对战AI出题原始输出:', content);

      let aiResult;
      try {
        aiResult = JSON.parse(content);
      } catch (parseError) {
        console.error('[aiService] 闯关对战出题JSON解析失败:', parseError);
        if (attempt + 1 < MAX_API_ATTEMPTS) {
          return generateDuelQuestions(count, excludeTitles, attempt + 1);
        }
        return pickValidDuelQuestionsFromPool(count, excludeTitles);
      }

      if (!aiResult.questions || !Array.isArray(aiResult.questions)) {
        if (attempt + 1 < MAX_API_ATTEMPTS) {
          return generateDuelQuestions(count, excludeTitles, attempt + 1);
        }
        return pickValidDuelQuestionsFromPool(count, excludeTitles);
      }

      const excludeSet = new Set(excludeTitles || []);
      const repaired = aiResult.questions
        .map(repairDuelQuestionFromFullPoem)
        .filter(Boolean)
        .filter((q) => q.title && !excludeSet.has(q.title));

      if (repaired.length >= count) {
        return { questions: repaired.slice(0, count) };
      }
      if (attempt + 1 < MAX_API_ATTEMPTS) {
        console.warn('[aiService] 对战有效题不足，重试出题:', { need: count, got: repaired.length, attempt });
        return generateDuelQuestions(count, excludeTitles, attempt + 1);
      }
      const merged = [...repaired, ...pickValidDuelQuestionsFromPool(count - repaired.length, [...excludeTitles, ...repaired.map((r) => r.title)]).questions];
      return { questions: merged.slice(0, count) };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('[aiService] 闯关对战出题失败:', error);
    if (attempt + 1 < MAX_API_ATTEMPTS) {
      return generateDuelQuestions(count, excludeTitles, attempt + 1);
    }
    return pickValidDuelQuestionsFromPool(count, excludeTitles);
  }
}

/** 从内置池取够 count 道且通过偶句校验的题目（作兜底） */
function pickValidDuelQuestionsFromPool(count, excludeTitles = []) {
  const excludeSet = new Set(excludeTitles || []);
  const out = [];
  let round = 0;
  while (out.length < count && round < 20) {
    round++;
    const batch = getMockDuelQuestions(Math.max(count * 2, 8), excludeTitles);
    for (const q of batch.questions || []) {
      const fixed = repairDuelQuestionFromFullPoem(q);
      if (fixed && !excludeSet.has(fixed.title)) {
        excludeSet.add(fixed.title);
        out.push(fixed);
        if (out.length >= count) break;
      }
    }
  }
  return { questions: out.slice(0, count) };
}

function getMockDuelQuestions(count, excludeTitles = []) {
  const excludeSet = new Set(excludeTitles || []);
  const pool = [
    {
      question: "床前明月光，____。",
      answer: "疑是地上霜",
      full_poem: "床前明月光，疑是地上霜。举头望明月，低头思故乡。",
      title: "静夜思",
      author: "李白",
      type: "上句填下句",
      analysis: "此句出自李白《静夜思》，描写诗人客居他乡、望月思亲的情景"
    },
    {
      question: "____，疑是地上霜。",
      answer: "床前明月光",
      full_poem: "床前明月光，疑是地上霜。举头望明月，低头思故乡。",
      title: "静夜思",
      author: "李白",
      type: "下句填上句",
      analysis: "此句出自李白《静夜思》，以月光起兴，引发思乡之情"
    },
    {
      question: "春眠不觉晓，____。",
      answer: "处处闻啼鸟",
      full_poem: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。",
      title: "春晓",
      author: "孟浩然",
      type: "上句填下句",
      analysis: "此句出自孟浩然《春晓》，描绘春日清晨的盎然生机"
    },
    {
      question: "____，处处闻啼鸟。",
      answer: "春眠不觉晓",
      full_poem: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。",
      title: "春晓",
      author: "孟浩然",
      type: "下句填上句",
      analysis: "此句出自孟浩然《春晓》，以声写春，表达诗人对春天的喜爱"
    },
    {
      question: "白日依山尽，____。",
      answer: "黄河入海流",
      full_poem: "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。",
      title: "登鹳雀楼",
      author: "王之涣",
      type: "上句填下句",
      analysis: "此句出自王之涣《登鹳雀楼》，写黄河奔腾入海的壮阔景象"
    },
    {
      question: "____，黄河入海流。",
      answer: "白日依山尽",
      full_poem: "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。",
      title: "登鹳雀楼",
      author: "王之涣",
      type: "下句填上句",
      analysis: "此句出自王之涣《登鹳雀楼》，写景抒怀，意境开阔"
    },
    {
      question: "千山鸟飞绝，____。",
      answer: "万径人踪灭",
      full_poem: "千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。",
      title: "江雪",
      author: "柳宗元",
      type: "上句填下句",
      analysis: "此句出自柳宗元《江雪》，以极端的寂静衬托渔翁的孤高"
    },
    {
      question: "____，万径人踪灭。",
      answer: "千山鸟飞绝",
      full_poem: "千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。",
      title: "江雪",
      author: "柳宗元",
      type: "下句填上句",
      analysis: "此句出自柳宗元《江雪》，以鸟尽人灭写雪景之严寒"
    },
    {
      question: "红豆生南国，____。",
      answer: "春来发几枝",
      full_poem: "红豆生南国，春来发几枝。愿君多采撷，此物最相思。",
      title: "相思",
      author: "王维",
      type: "上句填下句",
      analysis: "此句出自王维《相思》，以红豆寄托相思之情"
    },
    {
      question: "____，春来发几枝。",
      answer: "红豆生南国",
      full_poem: "红豆生南国，春来发几枝。愿君多采撷，此物最相思。",
      title: "相思",
      author: "王维",
      type: "下句填上句",
      analysis: "此句出自王维《相思》，以红豆起兴，语浅情深"
    }
  ];

  let available = pool.filter(q => !excludeSet.has(q.title));
  if (available.length === 0) available = [...pool];
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return { questions: shuffled.slice(0, count) };
}

module.exports = {
  getAIExplanation,
  getMockExplanation,
  checkRecitation,
  handleAIExplanation,
  getAIResponse,
  getAIrewritePoem,
  getDimensionExplanation,
  getLearningAdvice,
  getSimplifiedExplanation,
  getAIRecitationCheck,
  getCharInfo,
  callAIGenerateJSON,
  generateChallengeQuestion,
  verifyChallengeAnswer,
  generateAIHelp,
  getAIGeneratedQuestions,
  generatePoemImage,
  evaluateFeihuaPoem,
  generateDuelQuestions,
  repairDuelQuestionFromFullPoem,
  generatePoemSceneImage,
  spawn
};

/**
 * 阿里云百炼文生图 - 为选中的诗句生成意境画面 (使用qwen-image-2.0模型)
 * @param {string} poemLine - 选中的诗句
 * @param {string} poemTitle - 诗题
 * @param {string} poemAuthor - 作者
 * @returns {Promise<object|null>} 包含图片URL的结果
 */
async function generatePoemSceneImage(poemLine, poemTitle, poemAuthor, lineNumber = null, totalLines = null) {
  try {
    const apiKey = process.env.ALIYUN_BAILIAN_API_KEY;
    if (!apiKey) {
      console.error('[aiService] 缺少ALIYUN_BAILIAN_API_KEY环境变量');
      return getMockSceneImage(poemLine);
    }

    const lineHint =
      lineNumber != null && totalLines != null && totalLines > 0
        ? `全诗共${totalLines}句，当前要画的是其中第${lineNumber}句。`
        : '';

    const prompt = `你正在为古诗《${poemTitle}》（作者：${poemAuthor}）生成一幅「单句诗意图」配图。${lineHint}
【必须表现的诗句】「${poemLine}」

画面要求（请严格遵守）：
1. 紧扣这一句诗里出现的具体意象（如烟霞、香炉峰、飞瀑、明月、孤舟、杨柳等），画出中国古典诗词应有的意境美与诗意氛围，避免空洞、无关或现代场景。
2. 采用中国传统审美：水墨晕染、青绿山水、工笔意境或淡彩写意均可，整体典雅含蓄、留白有度、富有诗意。
3. 不要出现现代建筑、轮船铁塔、公路汽车、西方油画照片写实风等与古诗意境不符的元素。
4. 高清、构图疏朗、光影柔和，画面中不要出现任何文字、水印、logo、题款。`;

    console.log('[aiService] 阿里云百炼文生图请求:', { title: poemTitle, promptLength: prompt.length });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const createResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "X-DashScope-Async": "enable"
        },
        body: JSON.stringify({
          model: "wanx2.1-t2i-turbo",
          input: {
            prompt: prompt
          },
          parameters: {
            style: "<chinese painting>",
            size: "1024*1024",
            n: 1
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        console.error('[aiService] 阿里云百炼创建任务失败:', createResponse.status, errorData);
        return getMockSceneImage(poemLine);
      }

      const createData = await createResponse.json();
      const taskId = createData.output?.task_id;

      if (!taskId) {
        console.error('[aiService] 未获取到任务ID:', createData);
        return getMockSceneImage(poemLine);
      }

      console.log('[aiService] 任务已创建，task_id:', taskId);

      const maxRetries = 30;
      const pollInterval = 2000;

      for (let i = 0; i < maxRetries; i++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const pollController = new AbortController();
        const pollTimeoutId = setTimeout(() => pollController.abort(), 10000);

        try {
          const pollResponse = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`
            },
            signal: pollController.signal
          });

          clearTimeout(pollTimeoutId);

          if (!pollResponse.ok) {
            console.error('[aiService] 轮询任务失败:', pollResponse.status);
            continue;
          }

          const pollData = await pollResponse.json();
          const taskStatus = pollData.output?.task_status;

          console.log(`[aiService] 任务状态 (${i + 1}/${maxRetries}):`, taskStatus);

          if (taskStatus === 'SUCCEEDED') {
            const imageUrl = pollData.output?.results?.[0]?.url;
            if (imageUrl) {
              console.log('[aiService] 阿里云百炼文生图成功:', imageUrl);
              return {
                success: true,
                url: imageUrl,
                model: 'wanx2.1-t2i-turbo (阿里云百炼)'
              };
            }
          } else if (taskStatus === 'FAILED') {
            console.error('[aiService] 任务执行失败:', pollData);
            return getMockSceneImage(poemLine);
          } else if (taskStatus === 'CANCELED') {
            console.error('[aiService] 任务被取消');
            return getMockSceneImage(poemLine);
          }
        } catch (pollError) {
          clearTimeout(pollTimeoutId);
          console.error('[aiService] 轮询请求错误:', pollError.message);
        }
      }

      console.error('[aiService] 任务超时');
      return getMockSceneImage(poemLine);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error('[aiService] 阿里云百炼文生图失败:', error);
    return getMockSceneImage(poemLine);
  }
}

function getMockSceneImage(poemLine) {
  const encoded = encodeURIComponent(poemLine);
  return {
    success: false,
    url: null,
    message: `暂时无法生成"${poemLine}"的意境图，请稍后再试`
  };
}
