<template>
  <div class="teacher-dashboard">
    <div class="dashboard-header">
      <h1>教师管理看板</h1>
      <div class="header-actions">
        <span class="refresh-status" :class="{ refreshing }">
          {{ refreshing ? '刷新中...' : '自动刷新 30秒' }}
        </span>
        <button class="btn-refresh" @click="loadAllData" :disabled="refreshing">
          立即刷新
        </button>
        <button class="btn-logout" @click="handleLogout">退出登录</button>
      </div>
    </div>

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
          <div class="kpi-icon">👥</div>
          <div class="kpi-content">
            <h3>学生总数</h3>
            <p class="kpi-value">{{ overview.totalStudents || 0 }}</p>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">🔥</div>
          <div class="kpi-content">
            <h3>今日活跃</h3>
            <p class="kpi-value">{{ overview.todayActive || 0 }}</p>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">🎯</div>
          <div class="kpi-content">
            <h3>平均关卡</h3>
            <p class="kpi-value">{{ overview.avgLevel || 0 }}</p>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">📝</div>
          <div class="kpi-content">
            <h3>错题总数</h3>
            <p class="kpi-value">{{ overview.totalErrors || 0 }}</p>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card full-width">
          <h2>学习趋势（最近7天）</h2>
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
            <div
              v-for="(item, index) in ranking"
              :key="index"
              class="ranking-row"
              :class="{ 'top-three': index < 3 }"
            >
              <span class="rank-number" :class="`rank-${index + 1}`">
                {{ index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1 }}
              </span>
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
const refreshing = ref(false)
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

let refreshInterval = null

const checkAuth = () => {
  const token = localStorage.getItem('teacherToken')
  if (!token) {
    router.push('/teacher/login')
    return false
  }
  return true
}

const request = async (url, options = {}) => {
  const token = localStorage.getItem('teacherToken')
  const response = await fetch(`http://localhost:3000/api/teacher${url}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`)
  }

  return response.json()
}

const loadOverview = async () => {
  overview.value = await request('/overview')
}

const loadTrend = async () => {
  trend.value = await request('/trend')
}

const loadLevelDistribution = async () => {
  levelDistribution.value = await request('/level-distribution')
}

const loadWrongTop = async () => {
  wrongTop.value = await request('/wrong-top')
}

const loadRanking = async () => {
  ranking.value = await request('/ranking')
}

const loadCorrectRate = async () => {
  correctRate.value = await request('/correct-rate')
}

const loadAllData = async () => {
  if (!checkAuth()) return

  loading.value = true
  error.value = null
  refreshing.value = true

  try {
    await Promise.all([
      loadOverview(),
      loadTrend(),
      loadLevelDistribution(),
      loadWrongTop(),
      loadRanking(),
      loadCorrectRate()
    ])

    await nextTick()
    initCharts()
  } catch (err) {
    console.error('加载数据失败:', err)
    error.value = err.message || '加载数据失败，请稍后重试'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const initCharts = () => {
  initTrendChart()
  initLevelChart()
  initWrongChart()
  initRateChart()
}

const initTrendChart = () => {
  if (trendChart) {
    trendChart.dispose()
  }

  if (!trendChartRef.value) return

  trendChart = echarts.init(trendChartRef.value)

  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.value.map(item => item.date.slice(5))
    },
    yAxis: { type: 'value', name: '完成数' },
    series: [{
      name: '完成数',
      type: 'line',
      smooth: true,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(139, 69, 19, 0.5)' },
          { offset: 1, color: 'rgba(139, 69, 19, 0.1)' }
        ])
      },
      lineStyle: { color: '#8b4513', width: 3 },
      itemStyle: { color: '#8b4513' },
      data: trend.value.map(item => item.count),
      animationDuration: 1000
    }]
  }

  trendChart.setOption(option)
}

const initLevelChart = () => {
  if (levelChart) {
    levelChart.dispose()
  }

