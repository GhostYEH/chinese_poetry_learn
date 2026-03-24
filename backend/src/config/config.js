// 配置文件
require('dotenv').config();

module.exports = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key', // 优先使用环境变量
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  
  // 认证配置
  auth: {
    defaultUserId: 1 // 无token/无效token时使用的默认用户ID，仅用于演示/开发环境
  },
  
  // AI模型配置
  ai: {
    model: 'Qwen/Qwen3-8B',
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    timeout: 30000,
    defaultTemperature: 0.7,
    defaultMaxTokens: 500,
    defaultTopP: 0.7
  },
  
  // 缓存配置
  cache: {
    directory: './cache'
  },
  
  // 数据加载配置
  data: {
    loaderScript: '../loader/load_poems.py'
  },
  
  // 创作模块默认数据
  creation: {
    defaultData: {
      // 新手引导诗默认数据
      noviceGenerate: (theme, genre) => {
        // 根据主题和体裁返回不同的模拟数据
        if (theme.includes('春') && genre.includes('五言')) {
          return {
            prompt_poem: '春眠不觉晓，处处闻啼鸟。夜来___声，花落知多少。',
            reference_poem: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。',
            explanation: '这是一首描写春天的诗，空缺处应填入描述夜晚声音的词语，如"风雨"、"鸟鸣"等。'
          };
        } else if (theme.includes('秋') && genre.includes('七言')) {
          return {
            prompt_poem: '月落乌啼霜满天，江枫渔火对___眠。姑苏城外寒山寺，夜半钟声到客船。',
            reference_poem: '月落乌啼霜满天，江枫渔火对愁眠。姑苏城外寒山寺，夜半钟声到客船。',
            explanation: '这是一首描写秋天的诗，空缺处应填入表达情感的词语，如"愁"、"孤"等。'
          };
        } else {
          // 通用模拟数据
          return {
            prompt_poem: '床前明月光，疑是地上霜。举头望___月，低头思故乡。',
            reference_poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。',
            explanation: '这是一首思乡诗，空缺处应填入描述月亮的词语，如"明"、"圆"等。'
          };
        }
      },
      
      // 参考诗词默认数据
      assistGenerateReference: (theme, genre) => {
        if (theme.includes('春') && genre.includes('五言')) {
          return {
            poem: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。',
            analysis: '这是一首描写春天的诗，通过对春天早晨景象的描绘，表达了诗人对春天的喜爱之情。'
          };
        } else if (theme.includes('秋') && genre.includes('七言')) {
          return {
            poem: '月落乌啼霜满天，江枫渔火对愁眠。姑苏城外寒山寺，夜半钟声到客船。',
            analysis: '这是一首描写秋天的诗，通过对秋夜景色的描绘，表达了诗人的羁旅之愁。'
          };
        } else {
          return {
            poem: '床前明月光，疑是地上霜。举头望明月，低头思故乡。',
            analysis: '这是一首思乡诗，通过对明月的描写，表达了诗人对故乡的思念之情。'
          };
        }
      },
      
      // 评分默认数据
      assistScore: {
        total: 85,
        dimensions: {
          content: 80,
          rhythm: 90,
          mood: 85,
          language: 88,
          creativity: 82
        },
        suggestions: '整体不错，个别词语可以更贴合主题，韵律方面可以进一步优化。'
      },
      
      // 新手校验默认数据
      noviceCheck: {
        score: 85,
        analysis: {
          content: 80,
          rhythm: 90,
          意境: 85
        },
        suggestions: '整体不错，个别词语可以更贴合主题。'
      }
    }
  }
};
