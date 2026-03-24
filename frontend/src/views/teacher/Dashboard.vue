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
      </div>

      <div class="charts-grid">
        <div class="chart-card full-width">
          <h2>学习趋势</h2>
          <div ref="trendChartRef" class="chart-container"></div>
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
          <h2>正确率 vs 错误率</h2>
          <div ref="rateChartRef" class="chart-container"></div>
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

const trendChartRef = ref(null)
const levelChartRef = ref(null)
const wrongChartRef = ref(null)
const rateChartRef = ref(null)

let trendChart = null
let levelChart = null
let wrongChart = null
let rateChart = null

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
    overview.value = await request('/overview')
    trend.value = await request('/trend')
    levelDistribution.value = await request('/level-distribution')
    wrongTop.value = await request('/wrong-top')
    ranking.value = await request('/ranking')
    correctRate.value = await request('/correct-rate')
    await nextTick()
    initCharts()
  } catch (err) {
    console.error('加载数据失败:', err)
    error.value = '加载数据失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const initCharts = () => {
  initTrendChart()
  initLevelChart()
  initWrongChart()
  initRateChart()
}

const initTrendChart = () => {
  if (!trendChartRef.value) return
  if (trendChart) trendChart.dispose()
  trendChart = echarts.init(trendChartRef.value)
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: trend.value.map(i => i.date.slice(5)) },
    yAxis: { type: 'value', name: '完成数' },
    series: [{ name: '完成数', type: 'line', smooth: true, data: trend.value.map(i => i.count) }]
  })
}

const initLevelChart = () => {
  if (!levelChartRef.value) return
  if (levelChart) levelChart.dispose()
  levelChart = echarts.init(levelChartRef.value)
  levelChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: levelDistribution.value.map(i => i.range) },
    yAxis: { type: 'value', name: '人数' },
    series: [{ name: '人数', type: 'bar', data: levelDistribution.value.map(i => i.count) }]
  })
}

const initWrongChart = () => {
  if (!wrongChartRef.value) return
  if (wrongChart) wrongChart.dispose()
  wrongChart = echarts.init(wrongChartRef.value)
  wrongChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', name: '错误次数' },
    yAxis: { type: 'category', data: wrongTop.value.map(i => (i.question || '').slice(0, 10)).reverse() },
    series: [{ name: '错误次数', type: 'bar', data: wrongTop.value.map(i => i.error_count).reverse() }]
  })
}

const initRateChart = () => {
  if (!rateChartRef.value) return
  if (rateChart) rateChart.dispose()
  rateChart = echarts.init(rateChartRef.value)
  rateChart.setOption({
    tooltip: { trigger: 'item' },
    series: [{
      name: '答题情况',
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: correctRate.value.correct || 0, name: '正确' },
        { value: correctRate.value.wrong || 0, name: '错误' }
      ]
    }]
  })
}

const handleResize = () => {
  trendChart?.resize()
  levelChart?.resize()
  wrongChart?.resize()
  rateChart?.resize()
}

onMounted(() => {
  loadAllData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
  levelChart?.dispose()
  wrongChart?.dispose()
  rateChart?.dispose()
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
