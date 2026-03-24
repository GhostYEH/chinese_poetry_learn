// API服务层，统一处理API请求和认证

const API_BASE_URL = 'http://localhost:3000/api';

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
    const response = await fetch(`${API_BASE_URL}${url}`, {
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
      throw new Error(data.message || '请求失败');
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
    dashboard: () => request('/learn/dashboard')
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
  }
};

export default api;
