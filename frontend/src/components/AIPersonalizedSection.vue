<template>
  <section class="ai-personalized-section">
    <div class="section-header">
      <h2 class="section-title">
        <span class="title-deco">✦</span>
        AI 个性化推荐
        <span class="title-deco">✦</span>
      </h2>
      <p class="section-subtitle">基于您的学习记录，智能推荐适合您的诗词</p>
    </div>

    <div v-if="userStore.loading" class="loading-container">
      <div class="loading-spinner large"></div>
      <p>正在验证登录状态...</p>
    </div>

    <div v-else-if="!userStore.isLoggedIn" class="not-logged-in">
      <div class="login-prompt">
        <div class="prompt-icon">🔐</div>
        <h3>登录解锁个性化推荐</h3>
        <p>登录后即可获得基于您学习记录的智能推荐</p>
        <button class="login-btn" @click="$router.push('/login')">
          立即登录
        </button>
      </div>
    </div>

    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <p>{{ error }}</p>
      <p v-if="errorHint" class="error-hint">{{ errorHint }}</p>
      <button class="retry-btn" @click="fetchDataParallel">重新加载</button>
    </div>

    <div v-else class="personalized-content">
      <div class="recommendations-row">
        <div class="recommend-card review-card" :style="{ animationDelay: '0s' }">
          <div class="card-header">
            <div class="card-icon">📚</div>
            <div class="card-title-group">
              <h3 class="card-title">复习推荐</h3>
              <p class="card-subtitle">巩固已学知识</p>
            </div>
          </div>
          <div v-if="reviewLoading" class="card-loading">
            <div class="mini-spinner"></div>
            <span>AI 正在分析复习需求...</span>
          </div>
          <div v-else class="card-content">
            <div v-if="reviewItems.length === 0" class="empty-tip">
              <span class="empty-icon">✨</span>
              <p>暂无复习内容，继续加油！</p>
            </div>
            <div 
              v-for="(item, index) in reviewItems" 
              :key="item.poem_id || index"
              class="recommend-item"
              :style="{ animationDelay: `${index * 0.1}s` }"
              @click="navigateToDetail(item.poem_id)"
            >
              <div class="item-header">
                <span class="item-tag" :class="getTagClass(item.tag)">{{ item.tag }}</span>
                <span class="item-difficulty">{{ item.difficulty || '中等' }}</span>
              </div>
              <h4 class="item-title">{{ item.title }}</h4>
              <p class="item-author">{{ item.author }}</p>
              <p class="item-reason">{{ item.reason }}</p>
            </div>
          </div>
        </div>

        <div class="recommend-card learn-card" :style="{ animationDelay: '0.1s' }">
          <div class="card-header">
            <div class="card-icon">🎯</div>
            <div class="card-title-group">
              <h3 class="card-title">学习推荐</h3>
              <p class="card-subtitle">探索新知识</p>
            </div>
          </div>
          <div v-if="learnLoading" class="card-loading">
            <div class="mini-spinner"></div>
            <span>AI 正在为您精选诗词...</span>
          </div>
          <div v-else class="card-content">
            <div v-if="learnItems.length === 0" class="empty-tip">
              <span class="empty-icon">🚀</span>
              <p>开始您的诗词之旅吧！</p>
            </div>
            <div 
              v-for="(item, index) in learnItems" 
              :key="item.poem_id || index"
              class="recommend-item"
              :style="{ animationDelay: `${index * 0.1}s` }"
              @click="item.poem_id && navigateToDetail(item.poem_id)"
            >
              <div class="item-header">
                <span class="item-tag" :class="getTagClass(item.tag)">{{ item.tag }}</span>
                <span v-if="item.score" class="item-score">{{ item.score }}分</span>
              </div>
              <h4 class="item-title">{{ item.title }}</h4>
              <p class="item-author" v-if="item.author">{{ item.author }}</p>
              <p class="item-reason">{{ item.reason }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="analysis-card" :style="{ animationDelay: '0.2s' }">
        <div class="analysis-header">
          <div class="analysis-icon">
            <span class="ai-avatar">🧙</span>
          </div>
          <div class="analysis-title-group">
            <h3 class="analysis-title">AI 学习分析报告</h3>
            <p class="analysis-subtitle" v-if="!isNewUser">
              <span v-if="usingCache" class="cache-badge">已缓存</span>
              <span v-else>基于您的专属学习数据生成</span>
            </p>
            <p class="analysis-subtitle" v-else>新用户专属推荐分析</p>
          </div>
          <div class="analysis-refresh" v-if="analysis && !analysisLoading" @click="refreshAnalysis" title="重新生成报告">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <!-- 用户数据摘要卡片 -->
        <div class="user-data-summary" v-if="analysisLoading">
          <div class="summary-header">
            <span class="summary-icon">📊</span>
            <span>正在分析您的学习数据...</span>
          </div>
          <div class="summary-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: loadingProgress + '%' }"></div>
            </div>
            <div class="progress-steps">
              <span :class="{ active: loadingStep >= 1, done: loadingStep > 1 }">📚 读取学习记录</span>
              <span :class="{ active: loadingStep >= 2, done: loadingStep > 2 }">🔍 分析错题数据</span>
              <span :class="{ active: loadingStep >= 3, done: loadingStep > 3 }">🤖 生成个性化报告</span>
            </div>
          </div>
        </div>

        <div class="analysis-content" v-if="analysis && !analysisLoading">
          <!-- 个性化摘要 -->
          <div class="personal-summary-card">
            <div class="personal-summary-header">
              <span class="greeting-icon">{{ getGreetingIcon() }}</span>
              <span class="greeting-text">{{ getGreetingText() }}</span>
            </div>
            <p class="personal-summary-text">{{ analysis.summary }}</p>
          </div>

          <!-- 数据概览 -->
          <div class="data-overview" v-if="analysis.stats">
            <div class="overview-item" v-for="(item, index) in getDataOverviewItems()" :key="index">
              <span class="overview-icon">{{ item.icon }}</span>
              <span class="overview-value">{{ item.value }}</span>
              <span class="overview-label">{{ item.label }}</span>
            </div>
          </div>

          <!-- 详细分析三栏 -->
          <div class="analysis-sections">
            <div class="analysis-section strength">
              <h4 class="section-label">
                <span class="label-icon">💪</span>
                学习优势
                <span class="section-badge success">{{ (analysis.strength || []).length }}项</span>
              </h4>
              <ul class="section-list">
                <li v-for="(item, index) in (analysis.strength || [])" :key="index">
                  <span class="strength-highlight">{{ getHighlightText(item) }}</span>
                  <span class="strength-detail">{{ getDetailText(item) }}</span>
                </li>
              </ul>
            </div>
            <div class="analysis-section weakness">
              <h4 class="section-label">
                <span class="label-icon">📈</span>
                待提升
                <span class="section-badge warning">{{ (analysis.weakness || []).length }}项</span>
              </h4>
              <ul class="section-list">
                <li v-for="(item, index) in (analysis.weakness || [])" :key="index">
                  <span class="weakness-point">{{ getWeaknessPoint(item) }}</span>
                  <span class="weakness-detail">{{ getWeaknessDetail(item) }}</span>
                </li>
              </ul>
            </div>
            <div class="analysis-section suggestion">
              <h4 class="section-label">
                <span class="label-icon">💡</span>
                学习建议
                <span class="section-badge primary">{{ (analysis.suggestion || []).length }}条</span>
              </h4>
              <ul class="section-list">
                <li v-for="(item, index) in (analysis.suggestion || [])" :key="index">
                  <span class="suggestion-action">{{ getSuggestionAction(item) }}</span>
                  <span class="suggestion-reason">{{ getSuggestionReason(item) }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- 学习小贴士 -->
          <div class="learning-tip" v-if="getPersonalTip()">
            <span class="tip-icon">🌟</span>
            <span class="tip-text">{{ getPersonalTip() }}</span>
          </div>
        </div>

        <!-- 增强版加载动画 -->
        <div class="analysis-loading" v-else-if="analysisLoading">
          <div class="loading-animation-container">
            <div class="ai-brain">
              <div class="brain-circle"></div>
              <div class="brain-particles">
                <span v-for="n in 8" :key="n" class="particle" :style="{ animationDelay: (n * 0.1) + 's' }"></span>
              </div>
              <div class="brain-core">
                <span class="core-icon">🤖</span>
              </div>
            </div>
            <div class="loading-text-container">
              <p class="loading-main-text">{{ loadingText }}</p>
              <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
          <div class="loading-data-preview">
            <div class="data-preview-item" v-for="(item, index) in loadingDataPreview" :key="index" :style="{ animationDelay: (index * 0.2) + 's' }">
              <span class="preview-icon">{{ item.icon }}</span>
              <span class="preview-label">{{ item.label }}</span>
              <span class="preview-value" v-if="item.value">{{ item.value }}</span>
            </div>
          </div>
        </div>

        <!-- 无数据提示 -->
        <div class="no-data-tip" v-if="!analysis && !analysisLoading && isNewUser">
          <div class="no-data-icon">🚀</div>
          <p class="no-data-title">开启您的诗词学习之旅</p>
          <p class="no-data-desc">开始学习诗词后，我们将为您生成专属的学习分析报告</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import api from '@/services/api'
import { getCachedAnalysis, setCachedAnalysis } from '@/utils/analysisCache'

export default {
  name: 'AIPersonalizedSection',
  setup() {
    const router = useRouter()
    const userStore = useUserStore()

    const error = ref('')
    const errorHint = ref('')
    const reviewItems = ref([])
    const learnItems = ref([])
    const analysis = ref(null)

    const reviewLoading = ref(false)
    const learnLoading = ref(false)
    const analysisLoading = ref(false)
    const usingCache = ref(false) // 是否使用缓存数据

    // 新增：加载动画相关状态
    const loadingProgress = ref(0)
    const loadingStep = ref(0)
    const loadingText = ref('正在连接智能分析引擎...')
    const isNewUser = ref(false)
    let loadingTimer = null
    let loadingStepTimer = null

    const loadingDataPreview = ref([
      { icon: '📚', label: '已学习诗词', value: '' },
      { icon: '✅', label: '背诵正确率', value: '' },
      { icon: '📝', label: '错题数量', value: '' },
      { icon: '⏱️', label: '学习时长', value: '' }
    ])

    const loadingTexts = [
      '正在连接智能分析引擎...',
      '正在读取您的学习记录...',
      '正在分析您的错题数据...',
      '正在评估诗词掌握程度...',
      '正在生成个性化建议...',
      '报告即将呈现...'
    ]

    // 启动加载动画
    const startLoadingAnimation = () => {
      loadingProgress.value = 0
      loadingStep.value = 0
      let textIndex = 0
      loadingText.value = loadingTexts[0]

      // 进度条动画
      loadingTimer = setInterval(() => {
        loadingProgress.value += Math.random() * 15
        if (loadingProgress.value > 95) {
          loadingProgress.value = 95
        }
      }, 400)

      // 步骤切换
      loadingStepTimer = setInterval(() => {
        loadingStep.value++
        textIndex = (textIndex + 1) % loadingTexts.length
        loadingText.value = loadingTexts[textIndex]
      }, 1800)
    }

    // 停止加载动画
    const stopLoadingAnimation = () => {
      if (loadingTimer) {
        clearInterval(loadingTimer)
        loadingTimer = null
      }
      if (loadingStepTimer) {
        clearInterval(loadingStepTimer)
        loadingStepTimer = null
      }
      loadingProgress.value = 100
      loadingStep.value = 4
    }

    // 获取问候语图标
    const getGreetingIcon = () => {
      const hour = new Date().getHours()
      if (hour < 6) return '🌙'
      if (hour < 12) return '🌞'
      if (hour < 18) return '☀️'
      return '🌙'
    }

    // 获取问候语
    const getGreetingText = () => {
      const hour = new Date().getHours()
      if (hour < 6) return '夜深了，诗人'
      if (hour < 9) return '早起的诗友'
      if (hour < 12) return '上午好，诗人'
      if (hour < 14) return '午安，诗人'
      if (hour < 18) return '下午好，诗人'
      if (hour < 21) return '傍晚好，诗人'
      return '夜晚安好，诗人'
    }

    // 获取数据概览项
    const getDataOverviewItems = () => {
      if (!analysis.value?.stats) return []
      const stats = analysis.value.stats
      const hour = new Date().getHours()
      const period = hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
      return [
        { icon: '📚', value: stats.total_learned || 0, label: '已学诗词' },
        { icon: '📊', value: stats.average_score || 0, label: '平均得分' },
        { icon: '🎯', value: (stats.mastery_rate || 0) + '%', label: '掌握率' },
        { icon: '⚡', value: stats.total_recite_attempts || 0, label: '练习次数' }
      ]
    }

    // 解析优势文本
    const getHighlightText = (item) => {
      if (!item) return ''
      const match = item.match(/^([^，,。.]+)/)
      return match ? match[1] : item.substring(0, 15)
    }

    const getDetailText = (item) => {
      if (!item) return ''
      const parts = item.split(/[，,]/).slice(1)
      return parts.length > 0 ? parts.join('，') : ''
    }

    // 解析待提升文本
    const getWeaknessPoint = (item) => {
      if (!item) return ''
      const match = item.match(/^(.{3,15})/)
      return match ? match[1] : item.substring(0, 10)
    }

    const getWeaknessDetail = (item) => {
      if (!item) return ''
      const parts = item.split(/[，,]/).slice(1)
      return parts.length > 0 ? '，' + parts.join('，') : ''
    }

    // 解析建议文本
    const getSuggestionAction = (item) => {
      if (!item) return ''
      const match = item.match(/^(建议|推荐|可以|试着|尝试)/)
      return match ? match[0] : '建议'
    }

    const getSuggestionReason = (item) => {
      if (!item) return ''
      const parts = item.split(/[，,]/).slice(1)
      return parts.length > 0 ? parts.join('，') : ''
    }

    // 获取个性化学习小贴士
    const getPersonalTip = () => {
      if (!analysis.value?.stats) return ''
      const stats = analysis.value.stats
      const { total_learned, average_score, mastery_rate } = stats

      if (total_learned === 0) {
        return '今天开始学习一首新诗词吧，迈出您的诗词学习第一步！'
      }
      if (average_score < 60) {
        return '坚持每天朗读背诵，您一定能够看到进步！'
      }
      if (mastery_rate < 50) {
        return '温故而知新，建议复习之前学过的诗词加深记忆。'
      }
      if (mastery_rate > 80) {
        return '太棒了！您对诗词的掌握程度非常高，可以尝试挑战更高难度的内容！'
      }
      return '保持学习热情，诗词之路虽然漫长，但每一步都是成长！'
    }

    // 刷新分析报告（强制重新获取，绕过缓存）
    const refreshAnalysis = async () => {
      analysisLoading.value = true
      startLoadingAnimation()
      analysis.value = null
      usingCache.value = false
      try {
        const result = await api.personalized.getAIAnalysis(true) // 传入true强制刷新
        if (result?.success) {
          analysis.value = result.data || null
          // 更新缓存
          setCachedAnalysis({
            review: reviewItems.value,
            learn: learnItems.value,
            analysis: analysis.value
          })
        }
      } catch (err) {
        console.warn('AI分析刷新失败:', err)
      } finally {
        analysisLoading.value = false
        stopLoadingAnimation()
      }
    }

    // 内存中的缓存，避免同一次加载中重复请求
    let cachedData = null

    const getCachedData = () => {
      // 直接使用内存缓存，每次刷新/重新打开页面都会重新请求
      return cachedData
    }

    const setCachedData = (data) => {
      // 仅缓存在内存中
      cachedData = data
    }

    const clearCache = () => {
      cachedData = null
    }

    // 并行加载所有推荐数据，每个模块独立加载状态，内容按序渐进显示
    const fetchDataParallel = async () => {
      if (!userStore.isLoggedIn) return
      
      // 检查是否有缓存数据
      const cachedData = getCachedAnalysis()
      if (cachedData) {
        console.log('[AIPersonalizedSection] 使用缓存数据')
        reviewItems.value = cachedData.review || []
        learnItems.value = cachedData.learn || []
        analysis.value = cachedData.analysis || null
        usingCache.value = true
        // 异步更新数据（不阻塞显示）
        fetchDataInBackground()
        return
      }
      
      error.value = ''
      errorHint.value = ''
      usingCache.value = false
      
      // 并行触发三个独立加载任务，互不等待
      fetchReviewSection()
      fetchLearnSection()
      fetchAnalysisSection()
    }
    
    // 后台异步更新数据（缓存有效时静默刷新）
    const fetchDataInBackground = async () => {
      try {
        const [reviewResult, learnResult, analysisResult] = await Promise.all([
          api.personalized.getReviewRecommendations().catch(() => null),
          api.personalized.getLearnRecommendations().catch(() => null),
          api.personalized.getAIAnalysis().catch(() => null)
        ])
        
        if (reviewResult?.success) {
          reviewItems.value = reviewResult.data || []
        }
        if (learnResult?.success) {
          learnItems.value = learnResult.data || []
        }
        if (analysisResult?.success) {
          analysis.value = analysisResult.data || null
          // 更新缓存
          setCachedAnalysis({
            review: reviewItems.value,
            learn: learnItems.value,
            analysis: analysis.value
          })
        }
        console.log('[AIPersonalizedSection] 后台数据更新完成')
      } catch (err) {
        console.warn('[AIPersonalizedSection] 后台数据更新失败:', err)
      }
    }
    
    // 独立加载复习推荐模块
    const fetchReviewSection = async () => {
      reviewLoading.value = true
      reviewItems.value = []
      try {
        const result = await api.personalized.getReviewRecommendations()
        if (result?.success) {
          reviewItems.value = result.data || []
        }
      } catch (err) {
        console.warn('复习推荐获取失败:', err)
      } finally {
        reviewLoading.value = false
      }
    }
    
    // 独立加载学习推荐模块
    const fetchLearnSection = async () => {
      learnLoading.value = true
      learnItems.value = []
      try {
        const result = await api.personalized.getLearnRecommendations()
        if (result?.success) {
          learnItems.value = result.data || []
        }
      } catch (err) {
        console.warn('学习推荐获取失败:', err)
      } finally {
        learnLoading.value = false
      }
    }
    
    // 独立加载AI分析报告模块
    const fetchAnalysisSection = async () => {
      analysisLoading.value = true
      analysis.value = null
      startLoadingAnimation()
      try {
        const result = await api.personalized.getAIAnalysis()
        console.log('[AIPersonalizedSection] AI分析API返回:', result)
        if (result?.success) {
          analysis.value = result.data || null
          // 检查是否是新用户（无数据）
          isNewUser.value = !analysis.value || (analysis.value.stats?.total_learned === 0)
          console.log('[AIPersonalizedSection] AI分析数据已设置:', analysis.value)
          // 保存到缓存
          setCachedAnalysis({
            review: reviewItems.value,
            learn: learnItems.value,
            analysis: analysis.value
          })
        } else {
          console.warn('[AIPersonalizedSection] AI分析返回失败:', result)
          isNewUser.value = true
        }
      } catch (err) {
        console.warn('AI分析获取失败:', err)
        isNewUser.value = true
      } finally {
        analysisLoading.value = false
        stopLoadingAnimation()
        console.log('[AIPersonalizedSection] analysisLoading设置为false')
      }
    }

    const navigateToDetail = (poemId) => {
      if (poemId) {
        router.push(`/poem/${poemId}`)
      }
    }

    const getTagClass = (tag) => {
      const tagMap = {
        '错题本': 'tag-error',
        '闯关记录': 'tag-challenge',
        '薄弱加强': 'tag-weak',
        '专题学习': 'tag-topic',
        '对战建议': 'tag-battle',
        '探索发现': 'tag-discover'
      }
      return tagMap[tag] || 'tag-default'
    }

    onMounted(async () => {
      await userStore.initUser()
      if (userStore.isLoggedIn) {
        // 使用并行请求方式
        fetchDataParallel()
      }
    })

    onUnmounted(() => {
      if (loadingTimer) {
        clearInterval(loadingTimer)
        loadingTimer = null
      }
      if (loadingStepTimer) {
        clearInterval(loadingStepTimer)
        loadingStepTimer = null
      }
    })

    watch(() => userStore.isLoggedIn, (newVal) => {
      if (newVal) {
        fetchDataParallel()
      } else {
        reviewItems.value = []
        learnItems.value = []
        analysis.value = null
        clearCache()
      }
    })

    return {
      userStore,
      error,
      errorHint,
      reviewItems,
      learnItems,
      analysis,
      reviewLoading,
      learnLoading,
      analysisLoading,
      usingCache,
      fetchDataParallel,
      navigateToDetail,
      getTagClass,
      // 新增导出
      loadingProgress,
      loadingStep,
      loadingText,
      isNewUser,
      loadingDataPreview,
      getGreetingIcon,
      getGreetingText,
      getDataOverviewItems,
      getHighlightText,
      getDetailText,
      getWeaknessPoint,
      getWeaknessDetail,
      getSuggestionAction,
      getSuggestionReason,
      getPersonalTip,
      refreshAnalysis
    }
  }
}
</script>

<style scoped>
.ai-personalized-section {
  padding: 80px 24px;
  background: linear-gradient(180deg, rgba(102, 126, 234, 0.04) 0%, rgba(244, 114, 208, 0.02) 100%);
}

.section-header {
  text-align: center;
  margin-bottom: 48px;
}

.section-title {
  font-size: 28px;
  font-weight: 700;
  color: #8b4513;
  font-family: 'Noto Serif SC', 'SimSun', 'STSong', serif;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.title-deco {
  color: #cd853f;
  font-size: 18px;
}

.section-subtitle {
  font-size: 15px;
  color: #888;
  font-family: 'Noto Sans SC', sans-serif;
}

.loading-container {
  text-align: center;
  padding: 60px 20px;
  color: #888;
  font-family: 'Noto Sans SC', sans-serif;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(205, 133, 63, 0.2);
  border-top-color: #cd853f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

.loading-spinner.large {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.not-logged-in {
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}

.login-prompt {
  text-align: center;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 24px;
  max-width: 400px;
  animation: fadeInUp 0.6s ease-out;
}

.prompt-icon {
  font-size: 56px;
  margin-bottom: 20px;
}

.login-prompt h3 {
  font-size: 22px;
  color: #333;
  margin: 0 0 12px;
  font-family: 'Noto Serif SC', serif;
}

.login-prompt p {
  font-size: 14px;
  color: #888;
  margin: 0 0 24px;
  font-family: 'Noto Sans SC', sans-serif;
}

.login-btn {
  padding: 12px 40px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 50px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Sans SC', sans-serif;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.35);
}

.error-container {
  text-align: center;
  padding: 60px 20px;
  color: #e57373;
  font-family: 'Noto Sans SC', sans-serif;
}

.error-hint {
  color: #999;
  font-size: 13px;
  margin-top: 8px;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.retry-btn {
  margin-top: 16px;
  padding: 10px 28px;
  background: rgba(205, 133, 63, 0.1);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 50px;
  color: #8b4513;
  cursor: pointer;
  font-family: 'Noto Sans SC', sans-serif;
  transition: all 0.3s ease;
}

.retry-btn:hover {
  background: rgba(205, 133, 63, 0.2);
}

.ai-loading-tip {
  text-align: center;
  color: #aaa;
  font-size: 14px;
  margin-top: 16px;
  font-family: 'Noto Sans SC', sans-serif;
}

.personalized-content {
  max-width: 1200px;
  margin: 0 auto;
}

.recommendations-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.recommend-card {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(205, 133, 63, 0.1);
  border-radius: 24px;
  padding: 28px;
  animation: fadeInUp 0.6s ease-out both;
  transition: all 0.3s ease;
}

.recommend-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(139, 69, 19, 0.12);
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.1);
}

.card-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  border-radius: 16px;
}

.card-title-group {
  flex: 1;
}

.card-title {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0 0 4px;
  font-family: 'Noto Serif SC', serif;
}

.card-subtitle {
  font-size: 13px;
  color: #999;
  margin: 0;
  font-family: 'Noto Sans SC', sans-serif;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-tip {
  text-align: center;
  padding: 32px 16px;
  color: #bbb;
  font-family: 'Noto Sans SC', sans-serif;
}

.card-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  gap: 12px;
  color: #bbb;
  font-size: 13px;
  font-family: 'Noto Sans SC', sans-serif;
}

.mini-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(205, 133, 63, 0.15);
  border-top-color: #cd853f;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.empty-icon {
  font-size: 36px;
  display: block;
  margin-bottom: 12px;
}

.recommend-item {
  background: rgba(255, 252, 240, 0.6);
  border: 1px solid rgba(205, 133, 63, 0.15);
  border-radius: 16px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  animation: fadeInUp 0.5s ease-out both;
}

.recommend-item:hover {
  background: rgba(255, 252, 240, 0.9);
  border-color: rgba(205, 133, 63, 0.3);
  transform: translateX(4px);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-tag {
  padding: 3px 10px;
  border-radius: 50px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'Noto Sans SC', sans-serif;
}

.tag-error {
  background: rgba(229, 115, 115, 0.15);
  color: #e57373;
}

.tag-challenge {
  background: rgba(255, 183, 77, 0.15);
  color: #f57c00;
}

.tag-weak {
  background: rgba(255, 138, 101, 0.15);
  color: #ff7043;
}

.tag-topic {
  background: rgba(102, 126, 234, 0.15);
  color: #667eea;
}

.tag-battle {
  background: rgba(156, 39, 176, 0.15);
  color: #9c27b0;
}

.tag-discover {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
}

.tag-default {
  background: rgba(158, 158, 158, 0.15);
  color: #757575;
}

.item-difficulty {
  font-size: 11px;
  color: #bbb;
  font-family: 'Noto Sans SC', sans-serif;
}

.item-score {
  font-size: 12px;
  color: #ff7043;
  font-weight: 600;
  font-family: 'Noto Sans SC', sans-serif;
}

.item-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0 0 4px;
  font-family: 'Noto Serif SC', serif;
}

.item-author {
  font-size: 12px;
  color: #999;
  margin: 0 0 8px;
  font-family: 'Noto Sans SC', sans-serif;
}

.item-reason {
  font-size: 13px;
  color: #666;
  margin: 0;
  line-height: 1.5;
  font-family: 'Noto Sans SC', sans-serif;
}

.analysis-card {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.05));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 24px;
  padding: 32px;
  animation: fadeInUp 0.6s ease-out both;
}

.analysis-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.analysis-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 16px;
}

.analysis-title-group {
  flex: 1;
}

.analysis-title {
  font-size: 22px;
  font-weight: 700;
  color: #333;
  margin: 0 0 4px;
  font-family: 'Noto Serif SC', serif;
}

.analysis-subtitle {
  font-size: 13px;
  color: #999;
  margin: 0;
  font-family: 'Noto Sans SC', sans-serif;
}

.analysis-content {
  animation: fadeInUp 0.5s ease-out;
}

.analysis-summary {
  display: none; /* 已由 personal-summary-card 替代 */
}

.analysis-sections {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.analysis-section {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 16px;
  padding: 20px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 12px;
  font-family: 'Noto Sans SC', sans-serif;
}

.strength .section-label {
  color: #4caf50;
}

.weakness .section-label {
  color: #ff9800;
}

.suggestion .section-label {
  color: #667eea;
}

.label-icon {
  font-size: 18px;
}

.section-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.section-list li {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 8px;
  padding-left: 16px;
  position: relative;
  font-family: 'Noto Sans SC', sans-serif;
}

.section-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #cd853f;
}

.analysis-stats {
  display: flex;
  justify-content: center;
  gap: 48px;
  padding-top: 20px;
  border-top: 1px solid rgba(205, 133, 63, 0.1);
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #8b4513;
  font-family: 'Noto Serif SC', serif;
}

.stat-label {
  font-size: 12px;
  color: #999;
  font-family: 'Noto Sans SC', sans-serif;
}

.analysis-loading {
  text-align: center;
  padding: 40px;
  color: #888;
  font-family: 'Noto Sans SC', sans-serif;
}

/* 增强版加载动画样式 */
.loading-animation-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 0;
}

.ai-brain {
  position: relative;
  width: 80px;
  height: 80px;
}

.brain-circle {
  position: absolute;
  inset: 0;
  border: 3px solid rgba(102, 126, 234, 0.2);
  border-radius: 50%;
  animation: pulse-ring 1.5s ease-out infinite;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.8);
    opacity: 1;
  }
  100% {
    transform: scale(1.3);
    opacity: 0;
  }
}

.brain-particles {
  position: absolute;
  inset: 0;
  animation: rotate-brain 3s linear infinite;
}

@keyframes rotate-brain {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.brain-particles .particle {
  position: absolute;
  width: 6px;
  height: 6px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform-origin: 0 0;
}

.brain-particles .particle:nth-child(1) { transform: rotate(0deg) translateX(35px); }
.brain-particles .particle:nth-child(2) { transform: rotate(45deg) translateX(35px); }
.brain-particles .particle:nth-child(3) { transform: rotate(90deg) translateX(35px); }
.brain-particles .particle:nth-child(4) { transform: rotate(135deg) translateX(35px); }
.brain-particles .particle:nth-child(5) { transform: rotate(180deg) translateX(35px); }
.brain-particles .particle:nth-child(6) { transform: rotate(225deg) translateX(35px); }
.brain-particles .particle:nth-child(7) { transform: rotate(270deg) translateX(35px); }
.brain-particles .particle:nth-child(8) { transform: rotate(315deg) translateX(35px); }

.brain-core {
  position: absolute;
  inset: 15px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.core-icon {
  font-size: 28px;
  animation: brain-bounce 1s ease-in-out infinite;
}

@keyframes brain-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.loading-text-container {
  text-align: center;
}

.loading-main-text {
  font-size: 15px;
  color: #667eea;
  margin: 0 0 12px;
  font-family: 'Noto Sans SC', sans-serif;
}

.typing-indicator {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  background: #667eea;
  border-radius: 50%;
  animation: typing-bounce 1.4s ease-in-out infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* 用户数据摘要 */
.user-data-summary {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.05));
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  animation: fadeInUp 0.5s ease-out;
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #667eea;
  font-family: 'Noto Sans SC', sans-serif;
}

.summary-icon {
  font-size: 18px;
}

.summary-progress {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-bar {
  height: 6px;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #999;
  font-family: 'Noto Sans SC', sans-serif;
}

.progress-steps span {
  transition: all 0.3s ease;
}

.progress-steps span.active {
  color: #667eea;
  font-weight: 500;
}

.progress-steps span.done {
  color: #4caf50;
}

/* 个性化摘要卡片 */
.personal-summary-card {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.08), rgba(255, 183, 77, 0.05));
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  animation: fadeInUp 0.5s ease-out;
}

.personal-summary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.greeting-icon {
  font-size: 24px;
}

.greeting-text {
  font-size: 14px;
  color: #8b4513;
  font-weight: 600;
  font-family: 'Noto Sans SC', sans-serif;
}

.personal-summary-text {
  font-size: 15px;
  color: #555;
  line-height: 1.8;
  margin: 0;
  font-family: 'Noto Sans SC', sans-serif;
}

/* 数据概览 */
.data-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
  animation: fadeInUp 0.5s ease-out 0.1s both;
}

.overview-item {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  transition: all 0.3s ease;
}

.overview-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.1);
}

.overview-icon {
  display: block;
  font-size: 20px;
  margin-bottom: 8px;
}

.overview-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #8b4513;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 4px;
}

.overview-label {
  display: block;
  font-size: 11px;
  color: #999;
  font-family: 'Noto Sans SC', sans-serif;
}

/* 分析模块增强 */
.analysis-sections {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.analysis-section {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s ease;
  animation: fadeInUp 0.5s ease-out both;
}

.analysis-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(139, 69, 19, 0.1);
}

.analysis-section.strength { animation-delay: 0.1s; }
.analysis-section.weakness { animation-delay: 0.2s; }
.analysis-section.suggestion { animation-delay: 0.3s; }

.section-badge {
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
}

.section-badge.success {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
}

.section-badge.warning {
  background: rgba(255, 152, 0, 0.15);
  color: #ff9800;
}

.section-badge.primary {
  background: rgba(102, 126, 234, 0.15);
  color: #667eea;
}

.section-list li {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 10px;
  padding-left: 16px;
  position: relative;
  font-family: 'Noto Sans SC', sans-serif;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.section-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #cd853f;
}

.strength-highlight {
  font-weight: 600;
  color: #4caf50;
}

.strength-detail {
  color: #888;
  font-size: 12px;
}

.weakness-point {
  font-weight: 600;
  color: #ff9800;
}

.weakness-detail {
  color: #888;
  font-size: 12px;
}

.suggestion-action {
  font-weight: 600;
  color: #667eea;
}

.suggestion-reason {
  color: #888;
  font-size: 12px;
}

/* 学习小贴士 */
.learning-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 183, 77, 0.05));
  border: 1px dashed rgba(255, 215, 0, 0.3);
  border-radius: 12px;
  padding: 14px 18px;
  animation: fadeInUp 0.5s ease-out 0.4s both;
}

.tip-icon {
  font-size: 20px;
}

.tip-text {
  font-size: 13px;
  color: #8b4513;
  line-height: 1.5;
  font-family: 'Noto Sans SC', sans-serif;
}

/* 无数据提示 */
.no-data-tip {
  text-align: center;
  padding: 40px 20px;
}

.no-data-icon {
  font-size: 56px;
  margin-bottom: 16px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.no-data-title {
  font-size: 18px;
  font-weight: 600;
  color: #8b4513;
  margin: 0 0 8px;
  font-family: 'Noto Serif SC', serif;
}

.no-data-desc {
  font-size: 13px;
  color: #888;
  margin: 0;
  font-family: 'Noto Sans SC', sans-serif;
}

/* 刷新按钮 */
.analysis-refresh {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 50%;
  color: #667eea;
  cursor: pointer;
  transition: all 0.3s ease;
}

.analysis-refresh:hover {
  background: rgba(102, 126, 234, 0.2);
  transform: rotate(180deg);
}

/* 缓存指示器 */
.cache-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: linear-gradient(135deg, #4caf50, #8bc34a);
  color: white;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  font-family: 'Noto Sans SC', sans-serif;
}

/* 加载数据预览 */
.loading-data-preview {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  padding: 20px 0;
}

.data-preview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 12px;
  color: #666;
  font-family: 'Noto Sans SC', sans-serif;
  animation: slideIn 0.5s ease-out both;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.data-preview-item .preview-icon {
  font-size: 16px;
}

.data-preview-item .preview-label {
  color: #999;
}

.data-preview-item .preview-value {
  font-weight: 600;
  color: #8b4513;
}

@media (max-width: 900px) {
  .recommendations-row {
    grid-template-columns: 1fr;
  }
  
  .analysis-sections {
    grid-template-columns: 1fr;
  }
  
  .analysis-stats {
    gap: 32px;
  }
}

@media (max-width: 600px) {
  .ai-personalized-section {
    padding: 60px 16px;
  }
  
  .section-title {
    font-size: 22px;
  }
  
  .recommend-card {
    padding: 20px;
  }
  
  .analysis-card {
    padding: 24px;
  }
  
  .analysis-stats {
    flex-wrap: wrap;
    gap: 24px;
  }
}
</style>
