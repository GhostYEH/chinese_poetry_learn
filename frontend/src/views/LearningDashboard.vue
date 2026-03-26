<template>
  <div class="learning-dashboard">
    <div class="dashboard-header">
      <h1 class="page-title">📊 学习仪表盘</h1>
      <div class="refresh-section">
        <span class="last-updated">上次更新: {{ lastUpdatedTime }}</span>
        <button class="btn btn-primary refresh-btn" @click="fetchDashboardData">
          🔄 刷新数据
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="loading">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="fetchDashboardData">重试</button>
    </div>
    
    <div v-else class="dashboard-content">
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon learned">📚</div>
          <div class="stat-content">
            <h3>已学习诗词</h3>
            <p class="stat-number">{{ dashboardData.totalLearned }}</p>
            <p class="stat-desc">首</p>
            <div class="stat-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: (dashboardData.totalLearned / 100 * 100) + '%' }"></div>
              </div>
              <span class="progress-text">{{ dashboardData.totalLearned }}/100 目标</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon score">🎯</div>
          <div class="stat-content">
            <h3>平均背诵得分</h3>
            <p class="stat-number">{{ dashboardData.averageScore }}%</p>
            <p class="stat-desc">正确率</p>
            <div class="stat-progress">
              <div class="progress-bar">
                <div class="progress-fill score" :style="{ width: dashboardData.averageScore + '%' }"></div>
              </div>
              <span class="progress-text">目标: 90%</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon mistake">❌</div>
          <div class="stat-content">
            <h3>错题数量</h3>
            <p class="stat-number">{{ dashboardData.mistakeCount }}</p>
            <p class="stat-desc">题</p>
            <div class="stat-progress">
              <div class="progress-bar">
                <div class="progress-fill mistake" :style="{ width: Math.min(dashboardData.mistakeCount * 5, 100) + '%' }"></div>
              </div>
              <span class="progress-text">目标: < 5题</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon mastery">💯</div>
          <div class="stat-content">
            <h3>掌握率</h3>
            <p class="stat-number">{{ dashboardData.masteryRate }}%</p>
            <p class="stat-desc">已掌握</p>
            <div class="stat-progress">
              <div class="progress-bar">
                <div class="progress-fill mastery" :style="{ width: dashboardData.masteryRate + '%' }"></div>
              </div>
              <span class="progress-text">目标: 80%</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon streak">🔥</div>
          <div class="stat-content">
            <h3>连续学习</h3>
            <p class="stat-number">{{ dashboardData.streakDays }}</p>
            <p class="stat-desc">天</p>
            <div class="stat-progress">
              <div class="progress-bar">
                <div class="progress-fill streak" :style="{ width: Math.min(dashboardData.streakDays * 10, 100) + '%' }"></div>
              </div>
              <span class="progress-text">目标: 7天</span>
            </div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon time">⏱️</div>
          <div class="stat-content">
            <h3>学习时长</h3>
            <p class="stat-number">{{ dashboardData.totalStudyTime }}</p>
            <p class="stat-desc">分钟</p>
            <div class="stat-progress">
              <div class="progress-bar">
                <div class="progress-fill time" :style="{ width: Math.min(dashboardData.totalStudyTime, 100) + '%' }"></div>
              </div>
              <span class="progress-text">今日目标: 30分钟</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 学习趋势 -->
      <div class="learning-trends">
        <h2 class="section-title">📈 学习趋势</h2>
        <div class="trend-card">
          <div class="trend-content">
            <div class="trend-chart" v-if="dashboardData.learningTrends.length > 0">
              <div class="chart-shell">
                <div class="chart-bg-grid" aria-hidden="true">
                  <div
                    v-for="i in 5"
                    :key="'gl-' + i"
                    class="chart-grid-line"
                    :style="{ bottom: (i * 20) + '%' }"
                  />
                </div>
                <div
                  class="chart-columns"
                  :style="{
                    gridTemplateColumns: `repeat(${dashboardData.learningTrends.length}, minmax(0, 1fr))`
                  }"
                >
                  <div
                    v-for="(trend, index) in dashboardData.learningTrends"
                    :key="'col-' + index"
                    class="chart-column"
                  >
                    <div class="chart-bar-track">
                      <div
                        class="chart-bar"
                        :class="{ 'chart-bar--empty': !trend.score }"
                        :style="{ height: barHeightPercent(trend.score) }"
                      >
                        <div class="chart-tooltip">
                          {{ trend.date }} · {{ trend.score }}%
                          <template v-if="trend.activePoems != null"> · {{ trend.activePoems }} 首活跃</template>
                        </div>
                      </div>
                    </div>
                    <div class="chart-label">{{ trend.date }}</div>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="no-trend-data">
              <p>学习数据正在分析中...</p>
              <p class="trend-tip">随着学习的进行，这里会显示您的学习进度和趋势图表。</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 学习建议（AI） -->
      <div class="learning-suggestions">
        <h2 class="section-title">💡 学习建议</h2>
        <div class="suggestion-card ai-suggestion-card">
          <div class="ai-suggestion-toolbar">
            <p class="ai-suggestion-hint">由 AI 根据您的个人学习记录生成，可多次刷新获取新角度。</p>
            <button
              type="button"
              class="btn-ai-refresh"
              :disabled="aiAdviceLoading"
              @click="fetchAiAdvice"
            >
              {{ aiAdviceLoading ? '生成中…' : (aiAdviceFull ? '重新生成' : '生成学习建议') }}
            </button>
          </div>
          <div v-if="aiAdviceLoading" class="ai-advice-loading">
            <div class="loading-spinner small"></div>
            <span>正在结合您的学习记录分析与写作…</span>
          </div>
          <div v-else-if="aiAdviceError && !aiAdviceFull" class="ai-advice-error">
            <p>{{ aiAdviceError }}</p>
            <p v-if="aiAdviceErrorCode === 'NO_API_KEY'" class="ai-advice-error-sub">
              请在服务器环境变量中配置 <code>SILICONFLOW_API_KEY</code> 后重试。
            </p>
          </div>
          <div
            v-if="aiAdviceDisplayed"
            class="ai-advice-typewriter ink-paper"
          >{{ aiAdviceDisplayed }}<span v-if="!typewriterDone" class="type-cursor" aria-hidden="true">▍</span></div>
          <div v-if="showFallbackSuggestions" class="suggestion-list fallback-suggestions">
            <p class="fallback-title">以下为系统提示（AI 暂不可用时）：</p>
            <div
              v-for="(suggestion, index) in fallbackSuggestions"
              :key="'fb-' + index"
              class="suggestion-item"
            >
              <div class="suggestion-icon">{{ suggestion.icon }}</div>
              <div class="suggestion-content">
                <h4>{{ suggestion.title }}</h4>
                <p>{{ suggestion.description }}</p>
                <button
                  v-if="suggestion.action"
                  class="suggestion-action"
                  @click="handleSuggestionAction(suggestion)"
                >
                  {{ suggestion.actionText }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 最近学习记录 -->
      <div class="recent-learnings">
        <h2 class="section-title">📅 最近学习</h2>
        <div class="recent-list">
          <div v-if="dashboardData.recentLearnings.length === 0" class="empty">
            <p>暂无学习记录</p>
          </div>
          <div 
            v-for="(learning, index) in dashboardData.recentLearnings" 
            :key="index"
            class="recent-item"
            @click="navigateToDetail(learning.poem_id)"
          >
            <div class="recent-info">
              <h4>{{ learning.poem_title }}</h4>
              <p class="recent-author">{{ learning.poem_author }}</p>
              <p class="recent-time">{{ formatDate(learning.last_view_time) }}</p>
            </div>
            <div class="recent-stats">
              <span class="stat-item">
                👁️ {{ learning.view_count }}次查看
              </span>
              <span class="stat-item">
                🤖 {{ learning.ai_explain_count }}次AI讲解
              </span>
              <span class="stat-item">
                📝 {{ learning.recite_attempts }}次背诵
              </span>
              <span class="best-score" v-if="learning.best_score > 0">
                最高分: {{ learning.best_score }}%
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 学习目标 -->
      <div class="learning-goals">
        <h2 class="section-title">🎯 学习目标</h2>
        <div class="goals-card">
          <div class="goal-item">
            <div class="goal-header">
              <h3>每日学习</h3>
              <div class="goal-status" :class="{ completed: dashboardData.dailyGoalCompleted }">{{ dashboardData.dailyGoalCompleted ? '已完成' : '进行中' }}</div>
            </div>
            <div class="goal-progress">
              <div class="progress-bar">
                <div class="progress-fill goal" :style="{ width: dashboardData.dailyGoalProgress + '%' }"></div>
              </div>
              <span class="progress-text">{{ dashboardData.dailyGoalProgress }}% 完成</span>
            </div>
            <div class="goal-details">
              <p>今日目标: 学习 3 首诗词</p>
              <p>已完成: {{ dashboardData.dailyPoemsLearned }} 首</p>
            </div>
          </div>
          <div class="goal-item">
            <div class="goal-header">
              <h3>本周目标</h3>
              <div class="goal-status" :class="{ completed: dashboardData.weeklyGoalCompleted }">{{ dashboardData.weeklyGoalCompleted ? '已完成' : '进行中' }}</div>
            </div>
            <div class="goal-progress">
              <div class="progress-bar">
                <div class="progress-fill goal" :style="{ width: dashboardData.weeklyGoalProgress + '%' }"></div>
              </div>
              <span class="progress-text">{{ dashboardData.weeklyGoalProgress }}% 完成</span>
            </div>
            <div class="goal-details">
              <p>本周目标: 学习 15 首诗词</p>
              <p>已完成: {{ dashboardData.weeklyPoemsLearned }} 首</p>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 创作成长 -->
      <div class="creation-growth">
        <h2 class="section-title">✍️ 创作成长</h2>
        <div class="creation-card">
          <div class="creation-stats-grid">
            <div class="creation-stat-tile">
              <div class="creation-stat-icon">📝</div>
              <div class="creation-stat-body">
                <span class="creation-stat-label">总创作数</span>
                <div class="creation-stat-value-row">
                  <span class="creation-stat-number">{{ creationData.total_creations }}</span>
                  <span class="creation-stat-unit">篇</span>
                </div>
              </div>
            </div>
            <div class="creation-stat-tile">
              <div class="creation-stat-icon">🏆</div>
              <div class="creation-stat-body">
                <span class="creation-stat-label">达标作品</span>
                <div class="creation-stat-value-row">
                  <span class="creation-stat-number">{{ creationData.qualified_works }}</span>
                  <span class="creation-stat-unit">篇</span>
                </div>
                <span class="creation-stat-hint">评分≥60分</span>
              </div>
            </div>
            <div class="creation-stat-tile">
              <div class="creation-stat-icon">📊</div>
              <div class="creation-stat-body">
                <span class="creation-stat-label">平均分</span>
                <div class="creation-stat-value-row">
                  <span class="creation-stat-number">{{ formatCreationAverage(creationData.average_score) }}</span>
                  <span class="creation-stat-unit">分</span>
                </div>
              </div>
            </div>
            <div class="creation-stat-tile">
              <div class="creation-stat-icon">🌟</div>
              <div class="creation-stat-body">
                <span class="creation-stat-label">最高分</span>
                <div class="creation-stat-value-row">
                  <span class="creation-stat-number">{{ creationData.highest_score }}</span>
                  <span class="creation-stat-unit">分</span>
                </div>
              </div>
            </div>
          </div>
          <p v-if="creationData.last_creation_time" class="creation-last">
            最近创作：{{ formatDate(creationData.last_creation_time) }}
          </p>
          <div class="creation-actions">
            <router-link to="/creation" class="btn btn-creation-primary">开始创作</router-link>
            <router-link to="/creation/records" class="btn btn-creation-secondary">查看作品</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const loading = ref(true)
const error = ref('')
const dashboardData = ref({
  totalLearned: 0,
  averageScore: 0,
  mistakeCount: 0,
  recentLearnings: [],
  masteryRate: 0,
  streakDays: 0,
  totalStudyTime: 0,
  learningTrends: [],
  dailyGoalCompleted: false,
  dailyGoalProgress: 0,
  dailyPoemsLearned: 0,
  weeklyGoalCompleted: false,
  weeklyGoalProgress: 0,
  weeklyPoemsLearned: 0
})

const aiAdviceLoading = ref(false)
const aiAdviceError = ref('')
const aiAdviceErrorCode = ref('')
const aiAdviceFull = ref('')
const aiAdviceDisplayed = ref('')
const typewriterDone = ref(true)
const fallbackSuggestions = ref([])
let typeTimer = null

const showFallbackSuggestions = computed(
  () => fallbackSuggestions.value.length > 0 && !aiAdviceFull.value && !aiAdviceLoading.value
)

const barHeightPercent = (score) => {
  const s = Math.max(0, Math.min(100, Number(score) || 0))
  return `${s}%`
}

const buildFallbackSuggestions = (data) => [
  {
    icon: '📚',
    title: '复习已学诗词',
    description: '建议复习最近学习的诗词，巩固记忆。',
    action: null,
    actionText: ''
  },
  {
    icon: '🎯',
    title: '提高背诵准确率',
    description: `您的平均背诵得分是${data.averageScore || 0}%，继续努力达到90%以上。`,
    action: null,
    actionText: ''
  },
  {
    icon: '🔥',
    title: '保持学习习惯',
    description: '每天坚持学习一首或复习一首，形成稳定节奏。',
    action: null,
    actionText: ''
  }
]

const runTypewriter = (text) => {
  clearInterval(typeTimer)
  typewriterDone.value = false
  aiAdviceDisplayed.value = ''
  if (!text) {
    typewriterDone.value = true
    return
  }
  let i = 0
  const chunk = 2
  const tick = 14
  typeTimer = setInterval(() => {
    if (i >= text.length) {
      clearInterval(typeTimer)
      typewriterDone.value = true
      return
    }
    aiAdviceDisplayed.value += text.slice(i, i + chunk)
    i += chunk
  }, tick)
}

const fetchAiAdvice = async () => {
  clearInterval(typeTimer)
  typeTimer = null
  aiAdviceLoading.value = true
  aiAdviceError.value = ''
  aiAdviceErrorCode.value = ''
  fallbackSuggestions.value = []
  aiAdviceFull.value = ''
  aiAdviceDisplayed.value = ''
  typewriterDone.value = true
  try {
    const res = await api.learn.aiSuggestions()
    if (res.success && res.data?.content) {
      aiAdviceFull.value = res.data.content
      runTypewriter(res.data.content)
    } else {
      throw new Error(res.message || '未返回建议内容')
    }
  } catch (e) {
    aiAdviceFull.value = ''
    aiAdviceDisplayed.value = ''
    typewriterDone.value = true
    aiAdviceError.value = e.message || '生成学习建议失败'
    aiAdviceErrorCode.value = e.code || ''
    fallbackSuggestions.value = buildFallbackSuggestions(dashboardData.value)
  } finally {
    aiAdviceLoading.value = false
  }
}

const creationData = ref({
  total_creations: 0,
  qualified_works: 0,
  average_score: 0,
  highest_score: 0,
  last_creation_time: null
})

const lastUpdatedTime = ref('')
let refreshTimer = null
const aiAdviceSeeded = ref(false)

const fetchDashboardData = async () => {
  loading.value = true
  error.value = ''
  
  try {
    // 获取学习数据
    const response = await api.learn.dashboard()
    const data = response.data
    
    // 填充数据（学习趋势由后端按最近 7 天真实记录聚合）
    dashboardData.value = {
      ...data,
      streakDays: 0, // 这里可以根据实际数据计算
      totalStudyTime: data.totalStudyTime ?? 0,
      learningTrends: Array.isArray(data.learningTrends) ? data.learningTrends : [],
      dailyGoalCompleted: data.totalLearned >= 3,
      dailyGoalProgress: Math.min((data.totalLearned / 3) * 100, 100),
      dailyPoemsLearned: data.totalLearned,
      weeklyGoalCompleted: data.totalLearned >= 15,
      weeklyGoalProgress: Math.min((data.totalLearned / 15) * 100, 100),
      weeklyPoemsLearned: data.totalLearned
    }
    
    // 获取创作成长数据（与 user_creations 一致，走统一 API 与动态端口）
    try {
      const creationResult = await api.creationWorkbench.getStats()
      if (creationResult.success && creationResult.data) {
        creationData.value = {
          total_creations: creationResult.data.total_creations ?? 0,
          qualified_works: creationResult.data.qualified_works ?? 0,
          average_score: creationResult.data.average_score ?? 0,
          highest_score: creationResult.data.highest_score ?? 0,
          last_creation_time: creationResult.data.last_creation_time ?? null
        }
      }
    } catch (creationError) {
      console.error('获取创作成长数据失败:', creationError)
      creationData.value = {
        total_creations: 0,
        qualified_works: 0,
        average_score: 0,
        highest_score: 0,
        last_creation_time: null
      }
    }

    if (!aiAdviceSeeded.value) {
      aiAdviceSeeded.value = true
      fetchAiAdvice()
    }
  } catch (err) {
    console.error('获取仪表盘数据失败:', err)
    error.value = '获取仪表盘数据失败'
    // 使用模拟数据作为备份
    useMockData()
  } finally {
    loading.value = false
    // 更新最后更新时间
    lastUpdatedTime.value = new Date().toLocaleString('zh-CN')
  }
}

const useMockData = () => {
  // 模拟数据，确保仪表盘能正常显示
  dashboardData.value = {
    totalLearned: 45,
    averageScore: 85,
    mistakeCount: 3,
    recentLearnings: [
      {
        poem_id: 1,
        poem_title: '静夜思',
        poem_author: '李白',
        last_view_time: new Date().toISOString(),
        view_count: 12,
        ai_explain_count: 3,
        recite_attempts: 5,
        best_score: 95
      },
      {
        poem_id: 2,
        poem_title: '望庐山瀑布',
        poem_author: '李白',
        last_view_time: new Date(Date.now() - 86400000).toISOString(),
        view_count: 8,
        ai_explain_count: 2,
        recite_attempts: 3,
        best_score: 88
      },
      {
        poem_id: 3,
        poem_title: '春晓',
        poem_author: '孟浩然',
        last_view_time: new Date(Date.now() - 172800000).toISOString(),
        view_count: 15,
        ai_explain_count: 4,
        recite_attempts: 6,
        best_score: 92
      }
    ],
    masteryRate: 75,
    streakDays: 5,
    totalStudyTime: 45,
    learningTrends: [
      { date: '03-19', score: 62, activePoems: 1 },
      { date: '03-20', score: 0, activePoems: 0 },
      { date: '03-21', score: 71, activePoems: 2 },
      { date: '03-22', score: 0, activePoems: 0 },
      { date: '03-23', score: 78, activePoems: 1 },
      { date: '03-24', score: 0, activePoems: 0 },
      { date: '03-25', score: 85, activePoems: 3 }
    ],
    dailyGoalCompleted: false,
    dailyGoalProgress: 66,
    dailyPoemsLearned: 2,
    weeklyGoalCompleted: false,
    weeklyGoalProgress: 60,
    weeklyPoemsLearned: 9
  }
  
  creationData.value = {
    total_creations: 0,
    qualified_works: 0,
    average_score: 0,
    highest_score: 0,
    last_creation_time: null
  }
}

const formatCreationAverage = (n) => {
  if (n == null || Number.isNaN(Number(n))) return '0.0'
  return Number(n).toFixed(1)
}

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const navigateToDetail = (poemId) => {
  router.push(`/poem/${poemId}`)
}

const handleSuggestionAction = (suggestion) => {
  if (suggestion.action && suggestion.action === 'navigateToDetail') {
    navigateToDetail(suggestion.actionParams)
  }
}

onMounted(() => {
  fetchDashboardData()
  
  // 设置定时刷新，每30秒自动刷新一次数据
  refreshTimer = setInterval(() => {
    fetchDashboardData()
  }, 30000)
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  if (typeTimer) {
    clearInterval(typeTimer)
  }
})
</script>

<style scoped>
.learning-dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  flex-wrap: wrap;
  gap: 20px;
}

.page-title {
  font-size: 28px;
  color: #2c3e50;
  font-weight: bold;
  margin: 0;
}

.refresh-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.last-updated {
  font-size: 14px;
  color: #666;
  background: rgba(255, 252, 240, 0.3);
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(139, 69, 19, 0.1);
}

.refresh-btn {
  font-size: 14px;
  padding: 8px 16px;
  border-radius: 8px;
}

@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .refresh-section {
    width: 100%;
    justify-content: space-between;
  }
  
  .page-title {
    font-size: 24px;
  }
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 16px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(139, 69, 19, 0.1);
  border-top: 4px solid #8b4513;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  text-align: center;
  padding: 40px 0;
  color: #f44336;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.stat-card {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
  cursor: pointer;
}

.stat-card:hover {
  transform: translateY(-6px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.stat-icon {
  font-size: 48px;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 252, 240, 0.3);
  border-radius: 50%;
}

.stat-content {
  flex: 1;
}

.stat-content h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #666;
  font-weight: 500;
}

.stat-number {
  margin: 0 0 4px 0;
  font-size: 32px;
  font-weight: bold;
  color: #8b4513;
}

.stat-desc {
  margin: 0;
  font-size: 14px;
  color: #999;
}

.section-title {
  font-size: 20px;
  color: #333;
  margin-bottom: 20px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
}

.recent-learnings {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.recent-item {
  background: rgba(255, 252, 240, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.recent-item:hover {
  transform: translateY(-4px);
  background: rgba(255, 252, 240, 0.3);
  box-shadow: 0 8px 16px rgba(31, 38, 135, 0.1);
}

.recent-info {
  flex: 1;
}

.recent-info h4 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: #8b4513;
}

.recent-author {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
}

.recent-time {
  margin: 0;
  font-size: 12px;
  color: #999;
}

.recent-stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.stat-item {
  font-size: 12px;
  color: #666;
  background: rgba(255, 252, 240, 0.3);
  padding: 4px 8px;
  border-radius: 12px;
}

.best-score {
  font-size: 14px;
  font-weight: bold;
  color: #4CAF50;
  margin-top: 8px;
}

.learning-trends {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
}

.trend-card {
  background: rgba(255, 252, 240, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 40px;
  text-align: center;
}

.trend-content p {
  margin: 0 0 16px 0;
  color: #666;
}

.trend-tip {
  font-style: italic;
  color: #999;
  font-size: 14px;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}

.stat-progress {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(139, 69, 19, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
  background: #8b4513;
}

.progress-fill.score {
  background: #4CAF50;
}

.progress-fill.mistake {
  background: #f44336;
}

.progress-fill.mastery {
  background: #2196F3;
}

.progress-fill.streak {
  background: #FF9800;
}

.progress-fill.time {
  background: #9C27B0;
}

.progress-fill.goal {
  background: #00BCD4;
}

.progress-text {
  font-size: 12px;
  color: #666;
  text-align: right;
}

.chart-shell {
  position: relative;
  width: 100%;
  height: 300px;
  box-sizing: border-box;
  overflow: hidden;
}

.chart-bg-grid {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 36px;
  top: 12px;
  z-index: 1;
  pointer-events: none;
}

.chart-grid-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(139, 69, 19, 0.12);
}

.chart-columns {
  position: relative;
  z-index: 2;
  display: grid;
  height: 100%;
  align-items: stretch;
  gap: 4px;
  padding: 12px 8px 4px;
  box-sizing: border-box;
}

.chart-column {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  height: 100%;
}

.chart-bar-track {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  border-bottom: 1px solid rgba(139, 69, 19, 0.18);
  padding: 0 2px 0;
}

.chart-bar {
  width: min(52%, 32px);
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(180deg, #a0522d 0%, #8b4513 100%);
  transition: height 0.35s ease;
  cursor: pointer;
  position: relative;
  box-shadow: 0 2px 8px rgba(139, 69, 19, 0.15);
}

.chart-bar--empty {
  min-height: 0;
  height: 0 !important;
  box-shadow: none;
  pointer-events: none;
}

.chart-bar:not(.chart-bar--empty) {
  min-height: 4px;
}

.chart-bar:hover {
  filter: brightness(1.06);
}

.chart-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-6px);
  background: rgba(44, 36, 28, 0.92);
  color: #fff8f0;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.25s ease;
  z-index: 10;
  pointer-events: none;
  max-width: 200px;
}

.chart-bar:not(.chart-bar--empty):hover .chart-tooltip {
  opacity: 1;
}

.chart-label {
  flex-shrink: 0;
  margin-top: 8px;
  font-size: 11px;
  color: #666;
  text-align: center;
  line-height: 1.2;
  word-break: keep-all;
}

.ai-suggestion-card {
  text-align: left;
}

.ai-suggestion-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.ai-suggestion-hint {
  margin: 0;
  font-size: 13px;
  color: #777;
  flex: 1;
  min-width: 200px;
}

.btn-ai-refresh {
  background: linear-gradient(135deg, #8b4513 0%, #6d3710 100%);
  color: #fff;
  border: none;
  padding: 8px 18px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition, transform 0.2s ease, box-shadow 0.2s ease);
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.2);
}

.btn-ai-refresh:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(139, 69, 19, 0.28);
}

.btn-ai-refresh:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.ai-advice-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  color: #666;
  font-size: 14px;
}

.loading-spinner.small {
  width: 22px;
  height: 22px;
  border-width: 3px;
}

.ai-advice-error {
  padding: 16px;
  background: rgba(244, 67, 54, 0.06);
  border: 1px solid rgba(244, 67, 54, 0.2);
  border-radius: 10px;
  color: #c62828;
  font-size: 14px;
}

.ai-advice-error-sub {
  margin: 8px 0 0;
  font-size: 13px;
  color: #666;
}

.ai-advice-error-sub code {
  font-size: 12px;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
}

.ai-advice-typewriter.ink-paper {
  margin-top: 8px;
  padding: 20px 22px;
  min-height: 120px;
  background: linear-gradient(180deg, rgba(255, 252, 240, 0.95) 0%, rgba(250, 245, 235, 0.9) 100%);
  border: 1px solid rgba(139, 69, 19, 0.15);
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.75;
  color: #3e3428;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'Georgia', 'Noto Serif SC', 'Songti SC', serif;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.type-cursor {
  display: inline-block;
  margin-left: 2px;
  color: #8b4513;
  animation: ink-blink 1s step-end infinite;
  font-weight: 300;
}

@keyframes ink-blink {
  50% {
    opacity: 0;
  }
}

.fallback-suggestions {
  margin-top: 20px;
}

.fallback-title {
  margin: 0 0 12px;
  font-size: 13px;
  color: #888;
}

.learning-suggestions {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
}

.suggestion-card {
  background: rgba(255, 252, 240, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 24px;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.suggestion-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  transition: var(--transition);
}

.suggestion-item:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.suggestion-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 69, 19, 0.1);
  border-radius: 50%;
  flex-shrink: 0;
}

.suggestion-content {
  flex: 1;
}

.suggestion-content h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #8b4513;
}

.suggestion-content p {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #666;
}

.suggestion-action {
  background: #8b4513;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: var(--transition);
}

.suggestion-action:hover {
  background: #a0522d;
  transform: translateY(-2px);
}

.learning-goals {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
}

.goals-card {
  background: rgba(255, 252, 240, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 24px;
}

.goal-item {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(139, 69, 19, 0.1);
}

.goal-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.goal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.goal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #8b4513;
}

.goal-status {
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 12px;
  background: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
}

.goal-status.completed {
  background: rgba(76, 175, 80, 0.2);
  font-weight: bold;
}

.goal-progress {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.goal-details {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #666;
}

.creation-growth {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
}

.creation-card {
  background: rgba(255, 252, 240, 0.25);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 20px 20px 16px;
}

.creation-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.creation-stat-tile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(139, 69, 19, 0.12);
  border-radius: 12px;
  min-height: 88px;
  transition: var(--transition);
}

.creation-stat-tile:hover {
  background: rgba(255, 255, 255, 0.5);
  border-color: rgba(139, 69, 19, 0.2);
  transform: translateY(-2px);
}

.creation-stat-tile .creation-stat-icon {
  font-size: 28px;
  line-height: 1;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 69, 19, 0.08);
  border-radius: 12px;
  flex-shrink: 0;
}

.creation-stat-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.creation-stat-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.creation-stat-value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: nowrap;
}

.creation-stat-number {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #8b4513;
  line-height: 1.2;
}

.creation-stat-unit {
  font-size: 14px;
  color: #999;
  font-weight: 500;
}

.creation-stat-hint {
  font-size: 11px;
  color: #aaa;
  margin-top: 2px;
}

.creation-last {
  margin: 14px 0 0;
  font-size: 13px;
  color: #888;
  text-align: center;
}

.creation-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-top: 18px;
  padding-top: 4px;
}

.btn-creation-primary,
.btn-creation-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 132px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  text-decoration: none;
  transition: var(--transition);
  border: 1px solid transparent;
}

.btn-creation-primary {
  background: linear-gradient(135deg, #8b4513 0%, #a0522d 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.25);
}

.btn-creation-primary:hover {
  filter: brightness(1.05);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(139, 69, 19, 0.3);
}

.btn-creation-secondary {
  background: rgba(255, 255, 255, 0.6);
  color: #8b4513;
  border-color: rgba(139, 69, 19, 0.35);
}

.btn-creation-secondary:hover {
  background: rgba(255, 252, 240, 0.9);
  border-color: #8b4513;
  transform: translateY(-2px);
}

@media (max-width: 768px) {
  .learning-dashboard {
    padding: 15px;
  }
  
  .page-title {
    font-size: 24px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .creation-stats-grid {
    grid-template-columns: 1fr;
  }

  .creation-actions {
    flex-direction: column;
  }

  .btn-creation-primary,
  .btn-creation-secondary {
    width: 100%;
  }
  
  .stat-card {
    flex-direction: column;
    text-align: center;
  }
  
  .recent-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .recent-stats {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .chart-shell {
    height: 220px;
  }

  .chart-label {
    font-size: 10px;
  }
  
  .goal-details {
    flex-direction: column;
    gap: 4px;
  }
}
</style>
