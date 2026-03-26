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

    <div v-else-if="loading" class="loading-container">
      <div class="skeleton-layout">
        <div class="skeleton-card skeleton-left">
          <div class="skeleton-header"></div>
          <div class="skeleton-item" v-for="n in 3" :key="n"></div>
        </div>
        <div class="skeleton-card skeleton-right">
          <div class="skeleton-header"></div>
          <div class="skeleton-item" v-for="n in 3" :key="n"></div>
        </div>
      </div>
      <div class="skeleton-analysis">
        <div class="skeleton-header"></div>
        <div class="skeleton-content"></div>
      </div>
    </div>

    <div v-else-if="error" class="error-container">
      <div class="error-icon">⚠️</div>
      <p>{{ error }}</p>
      <button class="retry-btn" @click="fetchData">重新加载</button>
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
          <div class="card-content">
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
          <div class="card-content">
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
          <div class="analysis-icon">🤖</div>
          <div class="analysis-title-group">
            <h3 class="analysis-title">AI 学习分析报告</h3>
            <p class="analysis-subtitle">智能分析您的学习情况</p>
          </div>
        </div>
        <div class="analysis-content" v-if="analysis">
          <div class="analysis-summary">{{ analysis.summary }}</div>
          <div class="analysis-sections">
            <div class="analysis-section strength">
              <h4 class="section-label">
                <span class="label-icon">💪</span>
                学习优势
              </h4>
              <ul class="section-list">
                <li v-for="(item, index) in analysis.strength" :key="index">{{ item }}</li>
              </ul>
            </div>
            <div class="analysis-section weakness">
              <h4 class="section-label">
                <span class="label-icon">📈</span>
                待提升
              </h4>
              <ul class="section-list">
                <li v-for="(item, index) in analysis.weakness" :key="index">{{ item }}</li>
              </ul>
            </div>
            <div class="analysis-section suggestion">
              <h4 class="section-label">
                <span class="label-icon">💡</span>
                学习建议
              </h4>
              <ul class="section-list">
                <li v-for="(item, index) in analysis.suggestion" :key="index">{{ item }}</li>
              </ul>
            </div>
          </div>
          <div class="analysis-stats" v-if="analysis.stats">
            <div class="stat-item">
              <span class="stat-value">{{ analysis.stats.total_learned || 0 }}</span>
              <span class="stat-label">已学习</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ analysis.stats.average_score || 0 }}</span>
              <span class="stat-label">平均分</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{{ analysis.stats.mastery_rate || 0 }}%</span>
              <span class="stat-label">掌握率</span>
            </div>
          </div>
        </div>
        <div class="analysis-loading" v-else>
          <div class="loading-spinner"></div>
          <p>AI 正在分析您的学习数据...</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import api from '@/services/api'

export default {
  name: 'AIPersonalizedSection',
  setup() {
    const router = useRouter()
    const userStore = useUserStore()
    
    const loading = ref(false)
    const error = ref('')
    const reviewItems = ref([])
    const learnItems = ref([])
    const analysis = ref(null)

    const fetchData = async () => {
      if (!userStore.isLoggedIn) return
      
      loading.value = true
      error.value = ''
      
      try {
        const data = await api.personalized.getData()
        reviewItems.value = data.review || []
        learnItems.value = data.learn || []
        analysis.value = data.analysis || null
      } catch (err) {
        console.error('获取个性化推荐失败:', err)
        error.value = err.message || '获取推荐数据失败，请稍后重试'
      } finally {
        loading.value = false
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
        fetchData()
      }
    })

    watch(() => userStore.isLoggedIn, (newVal) => {
      if (newVal) {
        fetchData()
      } else {
        reviewItems.value = []
        learnItems.value = []
        analysis.value = null
      }
    })

    return {
      userStore,
      loading,
      error,
      reviewItems,
      learnItems,
      analysis,
      fetchData,
      navigateToDetail,
      getTagClass
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

.skeleton-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.skeleton-card {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  padding: 24px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-header {
  height: 24px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 20px;
  width: 40%;
}

.skeleton-item {
  height: 80px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 12px;
  margin-bottom: 12px;
}

.skeleton-analysis {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 20px;
  padding: 24px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-analysis .skeleton-content {
  height: 200px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  border-radius: 12px;
  margin-top: 20px;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(205, 133, 63, 0.15);
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
  backdrop-filter: blur(16px);
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
  font-size: 15px;
  color: #555;
  line-height: 1.8;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  font-family: 'Noto Sans SC', sans-serif;
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
