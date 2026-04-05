// 分析报告缓存工具
// 使用 localStorage + 内存缓存，加速 AI 学习分析报告加载

const CACHE_KEY = 'ai_analysis_cache'
const CACHE_TTL = 30 * 60 * 1000 // 30分钟缓存

// 内存缓存（单次页面生命周期内有效）
let memoryCache = null

// 获取缓存数据
export function getCachedAnalysis() {
  try {
    // 1. 优先返回内存缓存
    if (memoryCache) {
      const { data, timestamp } = memoryCache
      if (Date.now() - timestamp < CACHE_TTL) {
        console.log('[AnalysisCache] 使用内存缓存')
        return data
      }
    }

    // 2. 返回 localStorage 缓存
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < CACHE_TTL) {
          console.log('[AnalysisCache] 使用 localStorage 缓存')
          // 同步到内存缓存
          memoryCache = { data, timestamp }
          return data
        } else {
          console.log('[AnalysisCache] 缓存已过期，清除')
          clearAnalysisCache()
        }
      } catch (e) {
        console.warn('[AnalysisCache] 解析缓存失败', e)
        clearAnalysisCache()
      }
    }
  } catch (e) {
    console.warn('[AnalysisCache] 获取缓存失败', e)
  }
  return null
}

// 设置缓存数据
export function setCachedAnalysis(data) {
  if (!data) return
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    }
    // 保存到内存缓存
    memoryCache = cacheData
    // 保存到 localStorage
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
    console.log('[AnalysisCache] 缓存已保存')
  } catch (e) {
    console.warn('[AnalysisCache] 保存缓存失败', e)
  }
}

// 清除缓存
export function clearAnalysisCache() {
  try {
    memoryCache = null
    localStorage.removeItem(CACHE_KEY)
    console.log('[AnalysisCache] 缓存已清除')
  } catch (e) {
    console.warn('[AnalysisCache] 清除缓存失败', e)
  }
}

// 检查缓存是否有效
export function hasValidCache() {
  return getCachedAnalysis() !== null
}

// 获取缓存剩余有效期（毫秒）
export function getCacheRemainingTime() {
  try {
    if (memoryCache) {
      const elapsed = Date.now() - memoryCache.timestamp
      const remaining = CACHE_TTL - elapsed
      return remaining > 0 ? remaining : 0
    }
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { timestamp } = JSON.parse(cached)
      const elapsed = Date.now() - timestamp
      const remaining = CACHE_TTL - elapsed
      return remaining > 0 ? remaining : 0
    }
  } catch (e) {
    // ignore
  }
  return 0
}

export default {
  getCachedAnalysis,
  setCachedAnalysis,
  clearAnalysisCache,
  hasValidCache,
  getCacheRemainingTime
}
