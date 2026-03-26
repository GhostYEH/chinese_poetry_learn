<template>
  <div class="teacher-dashboard">
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>数据加载中...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p class="error-message">{{ error }}</p>
      <button class="btn-retry" @click="loadAllData">重试</button>
    </div>

    <div v-else class="dashboard-content">
      <div class="kpi-cards">
        <div class="kpi-card">
          <h3>学生总数</h3>
          <p class="kpi-value">{{ overview.totalStudents || 0 }}</p>
        </div>
        <div class="kpi-card">
          <h3>今日活跃</h3>
          <p class="kpi-value">{{ overview.todayActive || 0 }}</p>
        </div>
        <div class="kpi-card">
          <h3>平均关卡</h3>
          <p class="kpi-value">{{ overview.avgLevel || 0 }}</p>
        </div>
        <div class="kpi-card">
          <h3>错题总数</h3>
          <p class="kpi-value">{{ overview.totalErrors || 0 }}</p>
        </div>
        <div class="kpi-card">
          <h3>收藏记录条数</h3>
          <p class="kpi-value">{{ overview.totalCollections || 0 }}</p>
        </div>
        <div class="kpi-card">
          <h3>闯关答题次数</h3>
          <p class="kpi-value">{{ overview.totalChallengeAnswers || 0 }}</p>
        </div>
        <div class="kpi-card">
          <h3>飞花令对战局数</h3>
          <p class="kpi-value">{{ overview.totalFeihuaBattles || 0 }}</p>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card full-width">
          <h2>学习趋势</h2>
          <div ref="trendChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card full-width">
          <h2>诗词学习动态（近14天）</h2>
          <div ref="studyChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <h2>关卡分布</h2>
          <div ref="levelChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <h2>错题TOP10</h2>
          <div ref="wrongChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <h2>班级人数分布</h2>
          <div ref="classChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <h2>闯关答题时段（0–23时）</h2>
          <div ref="hourChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <h2>正确率 vs 错误率</h2>
          <div ref="rateChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <h2>闯关 AI 辅助使用</h2>
          <div ref="aiChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <h2>学生创作类型</h2>
          <div ref="creationChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <h2>排行榜</h2>
          <div class="ranking-table">
            <div v-for="(item, index) in ranking" :key="index" class="ranking-row">
              <span class="rank-number">{{ index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1 }}</span>
              <span class="rank-username">{{ item.username }}</span>
              <span class="rank-level">第 {{ item.level }} 关</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'

const router = useRouter()
const loading = ref(true)
const error = ref(null)
const overview = ref({})
const trend = ref([])
const levelDistribution = ref([])
const wrongTop = ref([])
const ranking = ref([])
const correctRate = ref({})
const dashboardMore = ref({
  poemStudyByDay: [],
  classStudentCounts: [],
  challengeByHour: [],
  aiHelpUsage: { withAi: 0, withoutAi: 0 },
  creationsByType: []
})

const trendChartRef = ref(null)
const studyChartRef = ref(null)
const levelChartRef = ref(null)
const wrongChartRef = ref(null)
const classChartRef = ref(null)
const hourChartRef = ref(null)
const rateChartRef = ref(null)
const aiChartRef = ref(null)
const creationChartRef = ref(null)

let trendChart = null
let studyChart = null
let levelChart = null
let wrongChart = null
let classChart = null
let hourChart = null
let rateChart = null
let aiChart = null
let creationChart = null

const checkAuth = () => {
  const token = localStorage.getItem('teacherToken')
  if (!token) {
    router.push('/teacher/login')
    return false
  }
  return true
}

const request = async (url) => {
  const token = localStorage.getItem('teacherToken')
  if (!token) {
    throw new Error('未找到认证令牌，请重新登录')
  }
  
  const response = await fetch(`http://localhost:3000/api/teacher${url}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (response.status === 401) {
    // 认证失败，清除token并跳转到登录页
    localStorage.removeItem('teacherToken')
    localStorage.removeItem('teacher')
    localStorage.removeItem('teacherInfo')
    router.push('/teacher/login')
    throw new Error('认证已过期，请重新登录')
  }
  
  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`)
  }
  
  const data = await response.json()
  
  // 检查返回的数据结构
  if (data.error) {
    throw new Error(data.error)
  }
  
  return data
}

const loadAllData = async () => {
  if (!checkAuth()) return
  loading.value = true
  error.value = null
  try {
    // 并行加载所有数据
    const [overviewData, trendData, levelData, wrongData, rankingData, rateData, moreData] = await Promise.all([
      request('/overview').catch(() => ({})),
      request('/trend').catch(() => []),
      request('/level-distribution').catch(() => []),
      request('/wrong-top').catch(() => []),
      request('/ranking').catch(() => []),
      request('/correct-rate').catch(() => ({})),
      request('/dashboard-more').catch(() => ({
        poemStudyByDay: [],
        classStudentCounts: [],
        challengeByHour: [],
        aiHelpUsage: { withAi: 0, withoutAi: 0 },
        creationsByType: []
      }))
    ])

    overview.value = overviewData
    trend.value = trendData
    levelDistribution.value = levelData
    wrongTop.value = wrongData
    ranking.value = rankingData
    correctRate.value = rateData
    dashboardMore.value = moreData
    
    // 等待DOM更新
    await nextTick()
    
    // 延迟初始化图表，确保DOM已完全渲染
    setTimeout(() => {
      initCharts()
    }, 100)
  } catch (err) {
    console.error('加载数据失败:', err)
    error.value = '加载数据失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const initCharts = () => {
  initTrendChart()
  initStudyChart()
  initLevelChart()
  initWrongChart()
  initClassChart()
  initHourChart()
  initRateChart()
  initAiChart()
  initCreationChart()
}

const initTrendChart = () => {
  if (!trendChartRef.value) {
    return
  }
  
  // 检查容器尺寸
  const width = trendChartRef.value.offsetWidth
  const height = trendChartRef.value.offsetHeight
  
  if (width === 0 || height === 0) {
    return
  }

  if (trendChart) trendChart.dispose()
  
  trendChart = echarts.init(trendChartRef.value)
  
  const option = {
    tooltip: { trigger: 'axis' },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: { 
      type: 'category', 
      data: trend.value.map(i => i.date ? i.date.slice(5) : ''),
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: { type: 'value', name: '完成数' },
    series: [{ 
      name: '完成数', 
      type: 'line', 
      smooth: true, 
      data: trend.value.map(i => i.count || 0),
      itemStyle: {
        color: '#8b4513'
      },
      areaStyle: {
        color: 'rgba(139, 69, 19, 0.1)'
      }
    }]
  }
  
  trendChart.setOption(option)
}

const initStudyChart = () => {
  if (!studyChartRef.value) return
  const width = studyChartRef.value.offsetWidth
  const height = studyChartRef.value.offsetHeight
  if (width === 0 || height === 0) return

  if (studyChart) studyChart.dispose()
  studyChart = echarts.init(studyChartRef.value)
  const days = dashboardMore.value.poemStudyByDay || []
  studyChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: days.map((i) => (i.date && i.date.length >= 10 ? i.date.slice(5) : i.date)),
      axisLabel: { rotate: 35, color: '#8b4513' },
      axisLine: { lineStyle: { color: 'rgba(139,69,19,0.3)' } }
    },
    yAxis: {
      type: 'value',
      name: '学习记录条数',
      axisLabel: { color: '#8b4513' },
      splitLine: { lineStyle: { color: 'rgba(139,69,19,0.08)' } }
    },
    series: [{
      name: '记录数',
      type: 'bar',
      data: days.map((i) => i.count || 0),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#deb887' },
          { offset: 1, color: '#8b4513' }
        ])
      },
      barMaxWidth: 28
    }]
  })
}

const initLevelChart = () => {
  if (!levelChartRef.value) return
  
  const width = levelChartRef.value.offsetWidth
  const height = levelChartRef.value.offsetHeight
  if (width === 0 || height === 0) return
  
  if (levelChart) levelChart.dispose()
  levelChart = echarts.init(levelChartRef.value)
  levelChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: { type: 'category', data: levelDistribution.value.map(i => i.range || '') },
    yAxis: { type: 'value', name: '人数' },
    series: [{ 
      name: '人数', 
      type: 'bar', 
      data: levelDistribution.value.map(i => i.count || 0),
      itemStyle: {
        color: '#cd853f'
      }
    }]
  })
}

const initWrongChart = () => {
  if (!wrongChartRef.value) return
  
  const width = wrongChartRef.value.offsetWidth
  const height = wrongChartRef.value.offsetHeight
  if (width === 0 || height === 0) return
  
  if (wrongChart) wrongChart.dispose()
  wrongChart = echarts.init(wrongChartRef.value)
  wrongChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: { type: 'value', name: '错误次数' },
    yAxis: { type: 'category', data: wrongTop.value.map(i => (i.question || '').slice(0, 10)).reverse() },
    series: [{ 
      name: '错误次数', 
      type: 'bar', 
      data: wrongTop.value.map(i => i.error_count || 0).reverse(),
      itemStyle: {
        color: '#dc143c'
      }
    }]
  })
}

const initClassChart = () => {
  if (!classChartRef.value) return
  const width = classChartRef.value.offsetWidth
  const height = classChartRef.value.offsetHeight
  if (width === 0 || height === 0) return

  if (classChart) classChart.dispose()
  classChart = echarts.init(classChartRef.value)
  const rows = dashboardMore.value.classStudentCounts || []
  const data = rows.map((r) => ({ value: r.count || 0, name: r.label || '—' }))
  classChart.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
    legend: { bottom: 0, type: 'scroll', textStyle: { color: '#5c4033' } },
    series: [{
      name: '人数',
      type: 'pie',
      radius: ['34%', '62%'],
      center: ['50%', '46%'],
      data: data.length ? data : [{ value: 1, name: '暂无数据', itemStyle: { color: '#e8e0d5' } }],
      label: { color: '#5c4033' },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(139,69,19,0.25)' } }
    }]
  })
}

const initHourChart = () => {
  if (!hourChartRef.value) return
  const width = hourChartRef.value.offsetWidth
  const height = hourChartRef.value.offsetHeight
  if (width === 0 || height === 0) return

  if (hourChart) hourChart.dispose()
  hourChart = echarts.init(hourChartRef.value)
  const hours = dashboardMore.value.challengeByHour || []
  hourChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '3%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: hours.map((h) => `${h.hour}时`),
      axisLabel: { color: '#8b4513', interval: 1, rotate: 45 },
      axisLine: { lineStyle: { color: 'rgba(139,69,19,0.3)' } }
    },
    yAxis: {
      type: 'value',
      name: '答题次数',
      axisLabel: { color: '#8b4513' },
      splitLine: { lineStyle: { color: 'rgba(139,69,19,0.08)' } }
    },
    series: [{
      name: '答题',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      data: hours.map((h) => h.count || 0),
      lineStyle: { color: '#a0522d', width: 2 },
      areaStyle: { color: 'rgba(160,82,45,0.12)' },
      itemStyle: { color: '#cd853f' }
    }]
  })
}

const initRateChart = () => {
  if (!rateChartRef.value) return
  
  const width = rateChartRef.value.offsetWidth
  const height = rateChartRef.value.offsetHeight
  if (width === 0 || height === 0) return
  
  if (rateChart) rateChart.dispose()
  rateChart = echarts.init(rateChartRef.value)
  rateChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      name: '答题情况',
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: correctRate.value.correct || 0, name: '正确', itemStyle: { color: '#32cd32' } },
        { value: correctRate.value.wrong || 0, name: '错误', itemStyle: { color: '#dc143c' } }
      ],
      label: {
        show: true,
        formatter: '{b}: {c} ({d}%)'
      }
    }]
  })
}

const initAiChart = () => {
  if (!aiChartRef.value) return
  const width = aiChartRef.value.offsetWidth
  const height = aiChartRef.value.offsetHeight
  if (width === 0 || height === 0) return

  if (aiChart) aiChart.dispose()
  aiChart = echarts.init(aiChartRef.value)
  const ai = dashboardMore.value.aiHelpUsage || { withAi: 0, withoutAi: 0 }
  const withAi = ai.withAi || 0
  const withoutAi = ai.withoutAi || 0
  aiChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '8%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: '#8b4513' }, splitLine: { lineStyle: { color: 'rgba(139,69,19,0.08)' } } },
    yAxis: {
      type: 'category',
      data: ['使用 AI 提示', '未使用 AI'],
      axisLabel: { color: '#5c4033' },
      axisLine: { lineStyle: { color: 'rgba(139,69,19,0.3)' } }
    },
    series: [{
      name: '次数',
      type: 'bar',
      data: [
        { value: withAi, itemStyle: { color: '#6b8e23' } },
        { value: withoutAi, itemStyle: { color: '#d2b48c' } }
      ],
      barMaxWidth: 36,
      label: { show: true, position: 'right', color: '#5c4033' }
    }]
  })
}

const initCreationChart = () => {
  if (!creationChartRef.value) return
  const width = creationChartRef.value.offsetWidth
  const height = creationChartRef.value.offsetHeight
  if (width === 0 || height === 0) return

  if (creationChart) creationChart.dispose()
  creationChart = echarts.init(creationChartRef.value)
  const rows = dashboardMore.value.creationsByType || []
  creationChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '6%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: '篇数', axisLabel: { color: '#8b4513' }, splitLine: { lineStyle: { color: 'rgba(139,69,19,0.08)' } } },
    yAxis: {
      type: 'category',
      data: rows.length ? rows.map((r) => (r.type || '').slice(0, 14)) : ['暂无'],
      axisLabel: { color: '#5c4033' }
    },
    series: [{
      name: '创作数',
      type: 'bar',
      data: rows.length ? rows.map((r) => r.count || 0) : [0],
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#8b4513' },
          { offset: 1, color: '#daa520' }
        ])
      },
      barMaxWidth: 22
    }]
  })
}

const handleResize = () => {
  trendChart?.resize()
  studyChart?.resize()
  levelChart?.resize()
  wrongChart?.resize()
  classChart?.resize()
  hourChart?.resize()
  rateChart?.resize()
  aiChart?.resize()
  creationChart?.resize()
}

onMounted(() => {
  loadAllData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  studyChart?.dispose()
  levelChart?.dispose()
  wrongChart?.dispose()
  classChart?.dispose()
  hourChart?.dispose()
  rateChart?.dispose()
  aiChart?.dispose()
  creationChart?.dispose()
})
</script>

<style scoped>
.teacher-dashboard {
  min-height: 100vh;
  padding: 20px;
}

.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 20px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(139,69,19,0.2);
  border-top: 4px solid #8b4513;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.error-message {
  color: #dc143c;
  font-size: 16px;
  margin: 0;
}

.btn-retry {
  padding: 10px 20px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
}

.kpi-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.kpi-card {
  background: rgba(255,255,255,0.95);
  padding: 25px;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(139,69,19,0.1);
}

.kpi-card h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #666;
  font-family: 'SimSun', 'STSong', serif;
}

.kpi-value {
  margin: 0;
  font-size: 32px;
  font-weight: bold;
  color: #8b4513;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  background: rgba(255,255,255,0.95);
  padding: 25px;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(139,69,19,0.1);
}

.chart-card.full-width {
  grid-column: span 2;
}

.chart-card h2 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  text-align: center;
}

.chart-container {
  width: 100%;
  height: 350px;
}

.ranking-table {
  max-height: 350px;
  overflow-y: auto;
}

.ranking-row {
  display: flex;
  align-items: center;
  padding: 15px;
  border-bottom: 1px solid rgba(205,133,63,0.1);
}

.rank-number {
  width: 50px;
  font-size: 20px;
  font-weight: bold;
  text-align: center;
}

.rank-username {
  flex: 1;
  font-size: 16px;
  color: #5c4033;
  font-family: 'SimSun', 'STSong', serif;
}

.rank-level {
  font-size: 16px;
  font-weight: bold;
  color: #8b4513;
}

@media (max-width: 1200px) {
  .charts-grid { grid-template-columns: 1fr; }
  .chart-card.full-width { grid-column: span 1; }
}
</style>
