/**
 * AI诗词创作服务封装
 * 统一管理所有创作相关的AI接口调用
 */

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * 获取认证Token
 */
const getToken = () => localStorage.getItem('token');

/**
 * 通用请求方法
 */
const request = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('请求过于频繁，请稍后重试');
    }
    throw new Error(data.message || '请求失败');
  }

  return data;
};

/**
 * AI创作服务
 */
export const aiCreationService = {
  /**
   * 步骤1：灵感生成 - 生成关键词
   * @param {string} theme - 创作主题
   * @param {string} genre - 体裁
   * @returns {Promise<{keywords: string[], theme: string, mood: string}>}
   */
  generateInspiration: async (theme, genre) => {
    const result = await request('/creation/inspiration/generate', {
      method: 'POST',
      body: JSON.stringify({ theme, genre })
    });
    return result.data;
  },

  /**
   * 步骤2：结构引导 - 获取写作结构提示
   * @param {string} genre - 体裁
   * @param {string} theme - 主题
   * @returns {Promise<{structure: object, examples: string[]}>}
   */
  getStructureGuide: async (genre, theme) => {
    const result = await request('/creation/structure/guide', {
      method: 'POST',
      body: JSON.stringify({ genre, theme })
    });
    return result.data;
  },

  /**
   * 步骤3：AI生成完整诗词
   * @param {object} params - 生成参数
   * @param {string} params.theme - 主题
   * @param {string} params.genre - 体裁
   * @param {string[]} params.keywords - 关键词
   * @param {string} params.structure - 结构提示
   * @returns {Promise<{poem: string, title: string, explanation: string}>}
   */
  generatePoem: async ({ theme, genre, keywords, structure }) => {
    const result = await request('/creation/generate', {
      method: 'POST',
      body: JSON.stringify({ theme, genre, keywords, structure })
    });
    return result.data;
  },

  /**
   * AI续写推荐 - 用户输入一句，AI推荐下一句
   * @param {object} params - 续写参数
   * @param {string} params.currentLines - 当前已有的诗句（用换行分隔）
   * @param {string} params.genre - 体裁
   * @param {string} params.theme - 主题
   * @param {number} params.maxLength - 最大字数（默认7或5）
   * @returns {Promise<{suggestions: string[], reasons: string[]}>}
   */
  recommendNextLine: async ({ currentLines, genre, theme, maxLength = 7 }) => {
    const result = await request('/creation/recommend/next-line', {
      method: 'POST',
      body: JSON.stringify({ currentLines, genre, theme, maxLength })
    });
    return result.data;
  },

  /**
   * 实时续写提示（轻量级）
   * @param {string} partialLine - 用户当前输入的部分诗句
   * @param {string} genre - 体裁
   * @returns {Promise<{tips: string[]}>}
   */
  getRealtimeTips: async (partialLine, genre) => {
    const result = await request('/creation/realtime/tips', {
      method: 'POST',
      body: JSON.stringify({ partialLine, genre })
    });
    return result.data;
  },

  /**
   * 核心评分接口
   * @param {object} params - 评分参数
   * @param {string} params.poem - 诗词内容
   * @param {string} params.title - 标题
   * @param {string} params.genre - 体裁
   * @param {string} params.theme - 主题
   * @returns {Promise<{total: number, dimensions: object, suggestions: string, image: string}>}
   */
  scorePoem: async ({ poem, title, genre, theme }) => {
    const result = await request('/creation/assist/score', {
      method: 'POST',
      body: JSON.stringify({ poem, title, genre, theme })
    });
    return result.data;
  },

  /**
   * 新手模式 - 生成引导诗
   * @param {string} theme - 主题
   * @param {string} genre - 体裁
   * @returns {Promise<{prompt_poem: string, reference_poem: string, explanation: string}>}
   */
  generatePromptPoem: async (theme, genre) => {
    const result = await request('/creation/novice/generate', {
      method: 'POST',
      body: JSON.stringify({ theme, genre })
    });
    return result.data;
  },

  /**
   * 新手模式 - 校验填词结果
   * @param {string} userPoem - 用户填词
   * @param {string} referencePoem - 参考诗词
   * @returns {Promise<{score: number, analysis: object, suggestions: string}>}
   */
  checkPoem: async (userPoem, referencePoem) => {
    const result = await request('/creation/novice/check', {
      method: 'POST',
      body: JSON.stringify({ userPoem, referencePoem })
    });
    return result.data;
  },

  /**
   * 飞花令创作模式 - 获取随机关键字
   * @param {string} difficulty - 难度 (简单/中等/困难)
   * @returns {Promise<{keyword: string, relatedWords: string[]}>}
   */
  getFeihuaKeyword: async (difficulty = '中等') => {
    const result = await request('/creation/feihua/keyword', {
      method: 'POST',
      body: JSON.stringify({ difficulty })
    });
    return result.data;
  },

  /**
   * 飞花令评分
   * @param {string} poem - 诗词内容
   * @param {string} keyword - 关键字
   * @param {string} genre - 体裁
   * @returns {Promise<{total: number, dimensions: object, suggestions: string}>}
   */
  scoreFeihuaPoem: async ({ poem, keyword, genre }) => {
    const result = await request('/creation/feihua/score', {
      method: 'POST',
      body: JSON.stringify({ poem, keyword, genre })
    });
    return result.data;
  },

  /**
   * 接龙创作 - 获取AI下一句
   * @param {string} userLine - 用户上一句
   * @param {string} genre - 体裁
   * @param {string} theme - 主题
   * @param {number} lineNumber - 当前是第几句
   * @returns {Promise<{aiLine: string, rhymeHint: string, moodHint: string}>}
   */
  getChainNextLine: async ({ userLine, genre, theme, lineNumber }) => {
    const result = await request('/creation/chain/next', {
      method: 'POST',
      body: JSON.stringify({ userLine, genre, theme, lineNumber })
    });
    return result.data;
  },

  /**
   * 接龙创作 - 获取AI第一句（启动）
   * @param {string} genre - 体裁
   * @param {string} theme - 主题
   * @returns {Promise<{aiLine: string, mood: string}>}
   */
  startChainPoem: async (genre, theme) => {
    const result = await request('/creation/chain/start', {
      method: 'POST',
      body: JSON.stringify({ genre, theme })
    });
    return result.data;
  },

  /**
   * 生成意境图
   * @param {string} poem - 诗词内容
   * @param {string} title - 标题
   * @returns {Promise<{imageUrl: string}>}
   */
  generateImage: async ({ poem, title }) => {
    const result = await request('/creation/assist/generate-image', {
      method: 'POST',
      body: JSON.stringify({ poem, title })
    });
    return result.data;
  },

  /**
   * 保存作品
   * @param {object} workData - 作品数据
   * @returns {Promise<{id: number}>}
   */
  saveWork: async (workData) => {
    const result = await request('/creation/works/save', {
      method: 'POST',
      body: JSON.stringify(workData)
    });
    return result.data;
  },

  /**
   * 获取作品列表
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   * @returns {Promise<{works: array, pagination: object}>}
   */
  getWorks: async (page = 1, pageSize = 10) => {
    const result = await request(`/creation/works/list?page=${page}&pageSize=${pageSize}`);
    return result.data;
  },

  /**
   * 删除作品
   * @param {number} id - 作品ID
   * @returns {Promise<void>}
   */
  deleteWork: async (id) => {
    await request(`/creation/works/${id}`, { method: 'DELETE' });
  }
};

export default aiCreationService;
