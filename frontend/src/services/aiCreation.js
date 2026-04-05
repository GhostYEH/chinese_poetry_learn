/**
 * AI诗词创作服务封装
 * 统一管理所有创作相关的AI接口调用
 */

const API_BASE_URL = 'http://localhost:3000/api';

const getToken = () => localStorage.getItem('token');

const request = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  const timeout = options.timeout || 60000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('请求过于频繁，请稍后重试');
      }
      throw new Error(data.message || '请求失败');
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
};

export const aiCreationService = {
  generateInspiration: async (theme, genre) => {
    const result = await request('/creation/inspiration/generate', {
      method: 'POST',
      body: JSON.stringify({ theme, genre }),
      timeout: 120000 // AI生成需要约60秒，设置120秒确保足够
    });
    return result.data;
  },

  getStructureGuide: async (genre, theme) => {
    const result = await request('/creation/structure/guide', {
      method: 'POST',
      body: JSON.stringify({ genre, theme }),
      timeout: 120000
    });
    return result.data;
  },

  generatePoem: async ({ theme, genre, keywords, structure }) => {
    const result = await request('/creation/generate', {
      method: 'POST',
      body: JSON.stringify({ theme, genre, keywords, structure }),
      timeout: 120000
    });
    return result.data;
  },

  recommendNextLine: async ({ currentLines, genre, theme, maxLength = 7 }) => {
    const result = await request('/creation/recommend/next-line', {
      method: 'POST',
      body: JSON.stringify({ currentLines, genre, theme, maxLength }),
      timeout: 120000
    });
    return result.data;
  },

  getRealtimeTips: async (partialLine, genre) => {
    const result = await request('/creation/realtime/tips', {
      method: 'POST',
      body: JSON.stringify({ partialLine, genre }),
      timeout: 60000
    });
    return result.data;
  },

  scorePoem: async ({ poem, title, genre, theme }) => {
    const result = await request('/creation/assist/score', {
      method: 'POST',
      body: JSON.stringify({ poem, title, genre, theme }),
      timeout: 120000
    });
    return result.data;
  },

  generatePromptPoem: async (theme, genre) => {
    const result = await request('/creation/novice/generate', {
      method: 'POST',
      body: JSON.stringify({ theme, genre }),
      timeout: 120000
    });
    return result.data;
  },

  checkPoem: async (userPoem, referencePoem) => {
    const result = await request('/creation/novice/check', {
      method: 'POST',
      body: JSON.stringify({ userPoem, referencePoem }),
      timeout: 120000
    });
    return result.data;
  },

  getFeihuaKeyword: async (difficulty = '中等') => {
    const result = await request('/creation/feihua/keyword', {
      method: 'POST',
      body: JSON.stringify({ difficulty }),
      timeout: 60000
    });
    return result.data;
  },

  scoreFeihuaPoem: async ({ poem, keyword, genre }) => {
    const result = await request('/creation/feihua/score', {
      method: 'POST',
      body: JSON.stringify({ poem, keyword, genre }),
      timeout: 120000
    });
    return result.data;
  },

  getChainNextLine: async ({ userLine, genre, theme, lineNumber }) => {
    const result = await request('/creation/chain/next', {
      method: 'POST',
      body: JSON.stringify({ userLine, genre, theme, lineNumber }),
      timeout: 120000
    });
    return result.data;
  },

  startChainPoem: async (genre, theme) => {
    const result = await request('/creation/chain/start', {
      method: 'POST',
      body: JSON.stringify({ genre, theme }),
      timeout: 120000
    });
    return result.data;
  },

  generateImage: async ({ poem, title }) => {
    const result = await request('/creation/assist/generate-image', {
      method: 'POST',
      body: JSON.stringify({ poem, title }),
      timeout: 90000
    });
    return result.data;
  },

  saveWork: async (workData) => {
    const result = await request('/creation/works/save', {
      method: 'POST',
      body: JSON.stringify(workData)
    });
    return result.data;
  },

  getWorks: async (page = 1, pageSize = 10) => {
    const result = await request(`/creation/works/list?page=${page}&pageSize=${pageSize}`);
    return result.data;
  },

  deleteWork: async (id) => {
    await request(`/creation/works/${id}`, { method: 'DELETE' });
  }
};

export default aiCreationService;
