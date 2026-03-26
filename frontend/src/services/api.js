// API服务层，统一处理API请求和认证

// 动态获取 API 基础 URL（支持 Electron 环境）
const getApiBaseUrl = async () => {
  // 检测是否在 Electron 环境中
  if (window.electronAPI) {
    const port = await window.electronAPI.getBackendPort();
    return `http://localhost:${port}/api`;
  }
  // 浏览器环境使用默认端口
  return 'http://localhost:3000/api';
};

// 同步获取 API 基础 URL（用于不需要等待的场景）
const API_BASE_URL = 'http://localhost:3000/api';

// 存储动态获取的 API URL
let dynamicApiBaseUrl = null;

// 初始化动态 API URL
const initApiUrl = async () => {
  if (!dynamicApiBaseUrl) {
    dynamicApiBaseUrl = await getApiBaseUrl();
  }
  return dynamicApiBaseUrl;
};

// 公共 fetch 辅助函数（用于不需要认证的请求）
const publicFetch = async (url) => {
  const baseUrl = await initApiUrl();
  const response = await fetch(`${baseUrl}${url}`);
  return response.json();
};

// 获取token
const getToken = () => {
  return localStorage.getItem('token');
};

// 构建请求头
const getHeaders = (includeAuth = true) => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
};

// 通用请求方法
const request = async (url, options = {}) => {
  try {
    // 使用动态 API URL
    const baseUrl = await initApiUrl();
    const response = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: {
        ...getHeaders(options.includeAuth !== false),
        ...options.headers
      }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // 处理认证错误
      if (response.status === 401) {
        // 清除无效的token
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // 跳转到登录页面
        window.location.href = '/login';
        throw new Error('认证令牌已过期，请重新登录');
      }
      const err = new Error(data.message || '请求失败');
      if (data.code) err.code = data.code;
      err.status = response.status;
      throw err;
    }
    
    return data;
  } catch (error) {
    console.error('API请求失败:', error);
    throw error;
  }
};

// API方法
export const api = {
  // 认证相关
  auth: {
    login: (credentials) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      includeAuth: false
    }),
    register: (userData) => request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
      includeAuth: false
    }),
    verify: () => request('/auth/verify')
  },
  
  // 诗词相关
  poems: {
    getAll: () => request('/poems'),
    getById: (id) => request(`/poems/${id}`),
    search: (keyword) => request(`/poems/search?keyword=${encodeURIComponent(keyword)}`)
  },
  
  // 学习记录相关
  learn: {
    record: (data) => request('/learn/record', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    stats: () => request('/learn/stats'),
    getRecord: (poemId) => request(`/learn/record/${poemId}`),
    dashboard: () => request('/learn/dashboard'),
    aiSuggestions: () =>
      request('/learn/ai-suggestions', {
        method: 'POST',
        body: JSON.stringify({})
      })
  },
  
  // 错题相关
  mistakes: {
    getAll: () => request('/mistakes'),
    delete: (id) => request(`/mistakes/${id}`, {
      method: 'DELETE'
    })
  },
  
  // 收藏相关
  collections: {
    add: (poemId) => request('/collections', {
      method: 'POST',
      body: JSON.stringify({ poem_id: poemId })
    }),
    remove: (poemId) => request(`/collections/${poemId}`, {
      method: 'DELETE'
    }),
    getAll: () => request('/collections'),
    check: (poemId) => request(`/collections/check/${poemId}`)
  },
  
  // 推荐相关
  recommend: {
    getRecommended: () => request('/recommend')
  },
  
  // AI相关
  ai: {
    explain: (data) => request('/ai/explain', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    reciteCheck: (data) => request('/ai/recite-check', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  
  // 闯关相关
  challenge: {
    getProgress: () => request('/challenge/progress'),
    updateProgress: (level) => request('/challenge/progress/update', {
      method: 'POST',
      body: JSON.stringify({ level })
    }),
    generateQuestions: (startLevel, count = 20) => request('/challenge/questions/generate', {
      method: 'POST',
      body: JSON.stringify({ startLevel, count })
    }),
    submitAnswer: (data) => request('/challenge/answer/submit', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    addToErrorBook: (data) => request('/challenge/error-book/add', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getErrorBook: () => request('/challenge/error-book'),
    removeFromErrorBook: (id) => request(`/challenge/error-book/${id}`, {
      method: 'DELETE'
    }),
    getLeaderboard: () => request('/challenge/leaderboard', { includeAuth: false })
  },

  // 错题复习相关
  wrongQuestions: {
    getStats: () => request('/wrong-questions/stats'),
    getQuestions: (limit = 20) => request(`/wrong-questions/questions?limit=${limit}`),
    add: (data) => request('/wrong-questions/add', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    submitAnswer: (questionId, userAnswer) => request('/wrong-questions/answer', {
      method: 'POST',
      body: JSON.stringify({ questionId, userAnswer })
    }),
    markAsMastered: (id) => request(`/wrong-questions/master/${id}`, {
      method: 'POST'
    }),
    delete: (id) => request(`/wrong-questions/${id}`, {
      method: 'DELETE'
    }),
    getHints: (data) => request('/wrong-questions/hints', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // 学习路径相关
  learning: {
    getPath: () => request('/learning/path'),
    regeneratePath: () => request('/learning/regenerate', { method: 'POST' }),
    getAbility: () => request('/learning/ability'),
    refreshAbility: () => request('/learning/ability/refresh', { method: 'POST' }),
    getAssessment: () => request('/learning/assessment')
  },

  // 每日打卡相关
  daily: {
    getDailyPoem: () => request('/daily/daily-poem'),
    getDailyPoemPublic: () => publicFetch('/daily/daily-poem/public'),
    checkin: (poemId) => request('/daily/checkin', {
      method: 'POST',
      body: JSON.stringify({ poemId })
    }),
    getCheckinStatus: () => request('/daily/checkin/status'),
    getCheckinStats: () => request('/daily/checkin/stats'),
    getActivity: (days = 30) => request(`/daily/activity?days=${days}`)
  },

  // 复习计划相关
  review: {
    getTodayTasks: () => request('/review/today'),
    getStats: () => request('/review/stats'),
    getPlan: (days = 7) => request(`/review/plan?days=${days}`),
    complete: (poemId, correct) => request('/review/complete', {
      method: 'POST',
      body: JSON.stringify({ poemId, correct })
    }),
    categorize: (questionId, category) => request('/review/categorize', {
      method: 'POST',
      body: JSON.stringify({ questionId, category })
    }),
    getCategories: () => request('/review/categories')
  },

  // 飞花令排位相关
  feihuaRanking: {
    getMe: () => request('/feihua-ranking/me'),
    getLeaderboard: (limit = 50, page = 1) => publicFetch(`/feihua-ranking/leaderboard?limit=${limit}&page=${page}`),
    getStats: () => publicFetch('/feihua-ranking/stats'),
    getLevels: () => publicFetch('/feihua-ranking/levels')
  },

  // 诗词创作挑战相关
  poetryChallenge: {
    getThemes: () => publicFetch('/poetry-challenge/themes'),
    generate: (theme, keyword) => request('/poetry-challenge/generate', {
      method: 'POST',
      body: JSON.stringify({ theme, keyword })
    }),
    rate: (challengeId, score) => request('/poetry-challenge/rate', {
      method: 'POST',
      body: JSON.stringify({ challengeId, score })
    }),
    getHistory: (limit = 20) => request(`/poetry-challenge/history?limit=${limit}`),
    getStats: () => request('/poetry-challenge/stats')
  },

  // 诗词创作工作台相关
  creationWorkbench: {
    // 灵感生成 - 生成关键词
    generateInspiration: (theme, genre) => request('/creation/inspiration/generate', {
      method: 'POST',
      body: JSON.stringify({ theme, genre })
    }),
    // 结构引导 - 获取写作结构提示
    getStructureGuide: (genre, theme) => request('/creation/structure/guide', {
      method: 'POST',
      body: JSON.stringify({ genre, theme })
    }),
    // AI生成完整诗词
    generatePoem: (params) => request('/creation/generate', {
      method: 'POST',
      body: JSON.stringify(params)
    }),
    // AI续写推荐
    recommendNextLine: (params) => request('/creation/recommend/next-line', {
      method: 'POST',
      body: JSON.stringify(params)
    }),
    // 实时续写提示
    getRealtimeTips: (partialLine, genre) => request('/creation/realtime/tips', {
      method: 'POST',
      body: JSON.stringify({ partialLine, genre })
    }),
    // 接龙创作 - 开始
    startChainPoem: (genre, theme) => request('/creation/chain/start', {
      method: 'POST',
      body: JSON.stringify({ genre, theme })
    }),
    // 接龙创作 - 下一句
    getChainNextLine: (params) => request('/creation/chain/next', {
      method: 'POST',
      body: JSON.stringify(params)
    }),
    // 飞花令 - 获取关键字
    getFeihuaKeyword: (difficulty) => request('/creation/feihua/keyword', {
      method: 'POST',
      body: JSON.stringify({ difficulty })
    }),
    // 飞花令评分
    scoreFeihuaPoem: (params) => request('/creation/feihua/score', {
      method: 'POST',
      body: JSON.stringify(params)
    }),
    // 核心评分接口
    scorePoem: (params) => request('/creation/assist/score', {
      method: 'POST',
      body: JSON.stringify(params)
    }),
    // 保存作品
    saveWork: (workData) => request('/creation/works/save', {
      method: 'POST',
      body: JSON.stringify(workData)
    }),
    // 创作成长统计（学习仪表盘）
    getStats: () => request('/creation/stats'),
    // 生成意境图
    generateImage: (params) => request('/creation/assist/generate-image', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  // 教师分析相关
  analytics: {
    getWeakPoints: (classId) => request(`/analytics/class/${classId}/weak-points`),
    getAlerts: (classId) => request(`/analytics/class/${classId}/alerts`),
    createTask: (data) => request('/analytics/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getTasks: (classId) => request(`/analytics/class/${classId}/tasks`),
    getTrend: (classId, days = 30) => request(`/analytics/class/${classId}/trend?days=${days}`),
    getMastery: (classId) => request(`/analytics/class/${classId}/mastery`),
    getClassOverview: (classId) => request(`/analytics/class/${classId}/overview`)
  },

  // 首页相关
  home: {
    getLeaderboard: (tab) => publicFetch(`/home/leaderboard/${tab}`),
    getLearningStats: () => request('/home/learning-stats')
  },

  // 个性化推荐相关
  personalized: {
    getData: () => request('/personalized'),
    getReviewRecommendations: () => request('/personalized/review'),
    getLearnRecommendations: () => request('/personalized/learn'),
    getAIAnalysis: () => request('/personalized/analysis')
  }
};

export default api;
