<template>
  <div class="game-data">
    <div class="page-header">
      <h1>对战数据分析</h1>
      <div class="header-actions">
        <select v-model="selectedPeriod" @change="loadData">
          <option value="week">最近一周</option>
          <option value="month">最近一月</option>
          <option value="all">全部时间</option>
        </select>
        <button class="btn-primary" @click="exportData">
          <span>📥</span> 导出数据
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>数据加载中...</p>
    </div>

    <div v-else class="data-section">
      <div class="stats-overview">
        <div class="stat-card">
          <span class="stat-icon">🎮</span>
          <div class="stat-info">
            <span class="stat-value">{{ gameStats.totalGames }}</span>
            <span class="stat-label">对战总数</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">👥</span>
          <div class="stat-info">
            <span class="stat-value">{{ gameStats.activePlayers }}</span>
            <span class="stat-label">参与人数</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">⏱️</span>
          <div class="stat-info">
            <span class="stat-value">{{ gameStats.avgDuration }}</span>
            <span class="stat-label">平均时长(秒)</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🏆</span>
          <div class="stat-info">
            <span class="stat-value">{{ gameStats.mostWins }}</span>
            <span class="stat-label">最高胜场</span>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card full-width">
          <h2>对战趋势</h2>
          <div ref="trendChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card">
          <h2>胜率排行</h2>
          <div class="ranking-list">
            <div v-for="(player, index) in topPlayers" :key="player.player" class="ranking-item">
              <span class="rank">{{ index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1 }}</span>
              <span class="player-name">{{ player.player }}</span>
              <span class="win-rate">{{ player.winRate }}%</span>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <h2>热门对战词</h2>
          <div class="hot-words">
            <div v-for="word in hotWords" :key="word.word" class="word-item">
              <span class="word">{{ word.word }}</span>
              <div class="word-bar">
                <div class="bar-fill" :style="{ width: word.percentage + '%' }"></div>
              </div>
              <span class="count">{{ word.count }}次</span>
            </div>
          </div>
        </div>

        <div class="chart-card full-width">
          <h2>最近对战记录</h2>
          <table class="game-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>玩家1</th>
                <th>玩家2</th>
                <th>胜者</th>
                <th>回合数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="game in recentGames" :key="game.id">
                <td>{{ formatDate(game.date) }}</td>
                <td>{{ game.player1 }}</td>
                <td>{{ game.player2 }}</td>
                <td class="winner">{{ game.winner }}</td>
                <td>{{ game.rounds || '-' }}</td>
              </tr>
            </tbody>
          </table>
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
const selectedPeriod = ref('week')
const trendChartRef = ref(null)
let trendChart = null

const gameStats = ref({
  totalGames: 0,
  activePlayers: 0,
  avgDuration: 0,
  mostWins: 0
})

const topPlayers = ref([])
const hotWords = ref([])
const recentGames = ref([])

const request = async (url) => {
  const token = localStorage.getItem('teacherToken')
  const response = await fetch(`http://localhost:3000/api/teacher${url}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  
  if (response.status === 401) {
    localStorage.removeItem('teacherToken')
    router.push('/teacher/login')
    throw new Error('认证已过期')
  }
  
  return response.json()
}

const loadData = async () => {
  loading.value = true
  try {
    const result = await request(`/game-data?period=${selectedPeriod.value}`)
    
    gameStats.value = result.stats || {
      totalGames: 0,
      activePlayers: 0,
      avgDuration: 0,
      mostWins: 0
    }
    
    topPlayers.value = result.topPlayers || []
    hotWords.value = result.hotWords || []
    recentGames.value = result.recentGames || []
    
    await nextTick()
    initTrendChart(result.trend || [])
  } catch (err) {
    console.error('加载数据失败:', err)
    loadMockData()
  } finally {
    loading.value = false
  }
}

const loadMockData = () => {
  gameStats.value = {
    totalGames: 156,
    activePlayers: 42,
    avgDuration: 180,
    mostWins: 12
  }
  
  topPlayers.value = [
    { player: '李白粉丝', winRate: 85 },
    { player: '诗词达人', winRate: 78 },
    { player: '古韵清风', winRate: 72 },
    { player: '墨香书生', winRate: 68 },
    { player: '诗情画意', winRate: 65 }
  ]
  
  hotWords.value = [
    { word: '月', count: 89, percentage: 100 },
    { word: '花', count: 76, percentage: 85 },
    { word: '春', count: 65, percentage: 73 },
    { word: '风', count: 58, percentage: 65 },
    { word: '山', count: 52, percentage: 58 }
  ]
  
  recentGames.value = [
    { id: 1, date: new Date().toISOString(), player1: '李白粉丝', player2: '诗词达人', winner: '李白粉丝', rounds: 8 },
    { id: 2, date: new Date(Date.now() - 3600000).toISOString(), player1: '古韵清风', player2: '墨香书生', winner: '古韵清风', rounds: 6 },
    { id: 3, date: new Date(Date.now() - 7200000).toISOString(), player1: '诗情画意', player2: '李白粉丝', winner: '李白粉丝', rounds: 10 }
  ]
  
  initTrendChart([
    { date: '03-18', count: 15 },
    { date: '03-19', count: 22 },
    { date: '03-20', count: 18 },
    { date: '03-21', count: 25 },
    { date: '03-22', count: 30 },
    { date: '03-23', count: 28 },
    { date: '03-24', count: 20 }
  ])
}

const initTrendChart = (data) => {
  if (!trendChartRef.value) return
  if (trendChart) trendChart.dispose()
  
  trendChart = echarts.init(trendChartRef.value)
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date),
      axisLine: { lineStyle: { color: 'rgba(139,69,19,0.3)' } },
      axisLabel: { color: '#8b4513' }
    },
    yAxis: {
      type: 'value',
      name: '对战数',
      axisLine: { lineStyle: { color: 'rgba(139,69,19,0.3)' } },
      axisLabel: { color: '#8b4513' }
    },
    series: [{
      name: '对战数',
      type: 'line',
      smooth: true,
      data: data.map(d => d.count),
      itemStyle: { color: '#cd853f' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(205,133,63,0.3)' },
          { offset: 1, color: 'rgba(205,133,63,0.05)' }
        ])
      }
    }]
  })
}

const formatDate = (dateStr) => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

const exportData = () => {
  alert('数据导出功能开发中...')
}

const handleResize = () => {
  trendChart?.resize()
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  trendChart?.dispose()
})
</script>

<style scoped>
.game-data {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.page-header h1 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 28px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 15px;
  align-items: center;
}

.header-actions select {
  padding: 10px 15px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 10px;
  background: white;
  color: #5c4033;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139,69,19,0.3);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
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

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: rgba(255,255,255,0.95);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: 0 4px 15px rgba(139,69,19,0.1);
}

.stat-icon {
  font-size: 32px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  background: rgba(255,255,255,0.95);
  border-radius: 20px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(139,69,19,0.1);
}

.chart-card.full-width {
  grid-column: span 2;
}

.chart-card h2 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 20px 0;
  font-size: 18px;
}

.chart-container {
  width: 100%;
  height: 300px;
}

.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  background: rgba(205,133,63,0.05);
  border-radius: 10px;
}

.rank {
  width: 40px;
  font-size: 20px;
  text-align: center;
}

.player-name {
  flex: 1;
  color: #5c4033;
  font-family: 'SimSun', 'STSong', serif;
}

.win-rate {
  font-weight: bold;
  color: #8b4513;
}

.hot-words {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.word-item {
  display: flex;
  align-items: center;
  gap: 15px;
}

.word {
  width: 30px;
  font-size: 18px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
}

.word-bar {
  flex: 1;
  height: 8px;
  background: rgba(205,133,63,0.1);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.count {
  width: 50px;
  text-align: right;
  color: #999;
  font-size: 13px;
}

.game-table {
  width: 100%;
  border-collapse: collapse;
}

.game-table th {
  text-align: left;
  padding: 12px 15px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  border-bottom: 2px solid rgba(205,133,63,0.2);
}

.game-table td {
  padding: 12px 15px;
  border-bottom: 1px solid rgba(205,133,63,0.1);
  color: #5c4033;
  font-size: 14px;
}

.game-table tr:hover {
  background: rgba(205,133,63,0.05);
}

.winner {
  color: #228b22;
  font-weight: bold;
}

@media (max-width: 1000px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
  
  .chart-card.full-width {
    grid-column: span 1;
  }
}
</style>
