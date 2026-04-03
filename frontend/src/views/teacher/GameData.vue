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
      <!-- 核心指标卡片 -->
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

      <!-- 趋势图区域 -->
      <div class="chart-card full-width">
        <div class="chart-header">
          <div>
            <h2>📊 对战趋势</h2>
            <p class="chart-desc">展示每日对战场数、参与人数、平均回合数的变化趋势</p>
          </div>
          <div class="chart-tabs">
            <button
              v-for="tab in trendTabs"
              :key="tab.key"
              :class="['tab-btn', { active: activeTab === tab.key }]"
              @click="switchTab(tab.key)"
            >{{ tab.label }}</button>
          </div>
        </div>
        <div class="chart-wrapper">
          <div ref="trendChartRef" class="chart-container"></div>
          <div v-if="noData" class="chart-empty">
            <span>📭</span>
            <p>所选时段内暂无对战数据</p>
          </div>
        </div>
        <!-- 趋势摘要 -->
        <div v-if="!noData" class="trend-summary">
          <div class="summary-item">
            <span class="summary-label">总计</span>
            <span class="summary-value highlight">{{ totalBattles }} 场</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">日均</span>
            <span class="summary-value">{{ avgBattles }} 场</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">峰值</span>
            <span class="summary-value peak">{{ maxBattles }} 场</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">参与总人次</span>
            <span class="summary-value">{{ totalPlayers }} 人次</span>
          </div>
        </div>
      </div>

      <div class="charts-grid two-col">
        <!-- 胜率排行 -->
        <div class="chart-card">
          <h2>🏅 胜率排行榜</h2>
          <div v-if="topPlayers.length > 0" class="ranking-list">
            <div
              v-for="(player, index) in topPlayers"
              :key="player.player"
              class="ranking-item"
            >
              <span class="rank">{{ index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1 }}</span>
              <div class="player-info">
                <span class="player-name">{{ player.player }}</span>
                <div class="win-bar-wrap">
                  <div class="win-bar">
                    <div
                      class="bar-fill"
                      :style="{ width: player.winRate + '%', background: getWinRateColor(player.winRate) }"
                    ></div>
                  </div>
                  <span class="win-rate" :style="{ color: getWinRateColor(player.winRate) }">
                    {{ player.winRate }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">暂无胜率数据</div>
        </div>

        <!-- 热门对战字 -->
        <div class="chart-card">
          <h2>🔥 热门对战字</h2>
          <div v-if="hotWords.length > 0" class="hot-words">
            <div
              v-for="(word, idx) in hotWords"
              :key="(word.word || word.keyword || '') + '-' + idx"
              class="word-item"
            >
              <div class="word-left">
                <span class="word-tag" :class="'tag-' + ((idx % 4) + 1)">{{ word.word || word.keyword || '—' }}</span>
                <span class="count">{{ word.count }}次</span>
              </div>
              <div class="word-bar-wrap">
                <div class="word-bar">
                  <div class="bar-fill" :style="{ width: word.percentage + '%' }"></div>
                </div>
                <span class="pct">{{ word.percentage }}%</span>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">暂无对战字数据</div>
        </div>
      </div>

      <!-- 最近对战记录 -->
      <div class="chart-card full-width">
        <h2>📋 最近对战记录</h2>
        <div v-if="recentGames.length > 0" class="table-wrapper">
          <table class="game-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>玩家1</th>
                <th>玩家2</th>
                <th>胜者</th>
                <th>对战字</th>
                <th>回合数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="game in recentGames" :key="game.id">
                <td class="td-date">{{ formatDate(game.date) }}</td>
                <td>{{ game.player1 }}</td>
                <td>{{ game.player2 }}</td>
                <td class="winner">{{ game.winner || '平局' }}</td>
                <td><span class="keyword-tag">{{ game.keyword || '—' }}</span></td>
                <td>{{ game.rounds || '-' }} 轮</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="empty-state">暂无对战记录</div>
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
const trendData = ref([])

// 趋势摘要数据
const noData = ref(false)
const totalBattles = ref(0)
const avgBattles = ref(0)
const maxBattles = ref(0)
const totalPlayers = ref(0)

// 图表Tab切换
const activeTab = ref('battle')
const trendTabs = [
  { key: 'battle', label: '对战场数' },
  { key: 'player', label: '参与人数' },
  { key: 'rounds', label: '平均回合' },
  { key: 'all', label: '综合对比' }
]

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
    trendData.value = result.trend || []

    // 计算趋势摘要
    const validTrend = trendData.value.filter(t => t.count > 0 || t.playerCount > 0)
    noData.value = validTrend.length === 0
    totalBattles.value = trendData.value.reduce((sum, t) => sum + (t.count || 0), 0)
    maxBattles.value = Math.max(...trendData.value.map(t => t.count || 0), 0)
    totalPlayers.value = trendData.value.reduce((sum, t) => sum + (t.playerCount || 0), 0)
    avgBattles.value = validTrend.length > 0 ? Math.round(totalBattles.value / validTrend.length) : 0

    await nextTick()
    initTrendChart()
    requestAnimationFrame(() => trendChart?.resize())
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
    { id: 1, date: new Date().toISOString(), player1: '李白粉丝', player2: '诗词达人', winner: '李白粉丝', rounds: 8, keyword: '月' },
    { id: 2, date: new Date(Date.now() - 3600000).toISOString(), player1: '古韵清风', player2: '墨香书生', winner: '古韵清风', rounds: 6, keyword: '花' },
    { id: 3, date: new Date(Date.now() - 7200000).toISOString(), player1: '诗情画意', player2: '李白粉丝', winner: '李白粉丝', rounds: 10, keyword: '春' }
  ]

  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().split('T')[0])
  }

  trendData.value = days.map((date, i) => ({
    date,
    count: [15, 22, 18, 25, 30, 28, 20][i],
    avgRounds: [8.2, 9.1, 7.5, 10.3, 11.2, 9.8, 8.7][i],
    playerCount: [20, 28, 24, 32, 36, 30, 25][i]
  }))

  noData.value = false
  totalBattles.value = 158
  maxBattles.value = 30
  totalPlayers.value = 195
  avgBattles.value = 22

  nextTick(() => {
    initTrendChart()
    requestAnimationFrame(() => trendChart?.resize())
  })
}

const formatTrendLabel = (d) => {
  if (!d || typeof d !== 'string') return ''
  return d.length >= 10 ? d.slice(5) : d
}

const switchTab = (key) => {
  activeTab.value = key
  initTrendChart()
}

const getWinRateColor = (rate) => {
  if (rate >= 70) return '#32cd32'
  if (rate >= 50) return '#cd853f'
  return '#dc143c'
}

const initTrendChart = () => {
  if (!trendChartRef.value) return
  if (trendChart) trendChart.dispose()

  const list = Array.isArray(trendData.value) ? trendData.value : []
  const categories = list.map(d => formatTrendLabel(d.date))
  const noDataMode = list.every(t => t.count === 0 && t.playerCount === 0)

  trendChart = echarts.init(trendChartRef.value)

  // 根据Tab选择数据
  const buildSeries = () => {
    if (activeTab.value === 'battle') {
      return [{
        name: '对战场数',
        type: 'bar',
        data: list.map(t => t.count || 0),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#cd853f' },
            { offset: 1, color: '#8b4513' }
          ]),
          borderRadius: [4, 4, 0, 0]
        },
        barMaxWidth: list.length > 14 ? 20 : 32,
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#daa520' },
              { offset: 1, color: '#a0522d' }
            ])
          }
        }
      }]
    }

    if (activeTab.value === 'player') {
      return [{
        name: '参与人数',
        type: 'line',
        smooth: true,
        data: list.map(t => t.playerCount || 0),
        itemStyle: { color: '#6b8e23' },
        lineStyle: { width: 3, color: '#6b8e23' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(107,142,35,0.25)' },
            { offset: 1, color: 'rgba(107,142,35,0.03)' }
          ])
        },
        symbol: 'circle',
        symbolSize: 8,
        emphasis: { scale: 1.5 }
      }]
    }

    if (activeTab.value === 'rounds') {
      return [{
        name: '平均回合',
        type: 'line',
        smooth: true,
        data: list.map(t => t.avgRounds || 0),
        itemStyle: { color: '#5470c6' },
        lineStyle: { width: 3, color: '#5470c6' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(84,112,198,0.2)' },
            { offset: 1, color: 'rgba(84,112,198,0.02)' }
          ])
        },
        symbol: 'circle',
        symbolSize: 8,
        emphasis: { scale: 1.5 }
      }]
    }

    // 综合对比
    return [
      {
        name: '对战场数',
        type: 'bar',
        data: list.map(t => t.count || 0),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#cd853f' },
            { offset: 1, color: '#8b4513' }
          ]),
          borderRadius: [3, 3, 0, 0]
        },
        barMaxWidth: list.length > 14 ? 18 : 26,
        yAxisIndex: 0
      },
      {
        name: '参与人数',
        type: 'line',
        smooth: true,
        data: list.map(t => t.playerCount || 0),
        itemStyle: { color: '#6b8e23' },
        lineStyle: { width: 2.5 },
        symbol: 'circle',
        symbolSize: 7,
        yAxisIndex: 1
      },
      {
        name: '平均回合',
        type: 'line',
        smooth: true,
        data: list.map(t => t.avgRounds || 0),
        itemStyle: { color: '#5470c6' },
        lineStyle: { width: 2.5, type: 'dashed' },
        symbol: 'diamond',
        symbolSize: 7,
        yAxisIndex: 1
      }
    ]
  }

  const buildYAxis = () => {
    if (activeTab.value === 'all') {
      return [
        {
          type: 'value',
          name: '对战场数',
          axisLabel: { color: '#8b4513' },
          splitLine: { lineStyle: { color: 'rgba(139,69,19,0.08)' } }
        },
        {
          type: 'value',
          name: '人数/回合',
          axisLabel: { color: '#666' },
          splitLine: { show: false }
        }
      ]
    }
    return {
      type: 'value',
      name: activeTab.value === 'battle' ? '场数' : (activeTab.value === 'player' ? '人数' : '回合'),
      axisLabel: { color: '#8b4513' },
      splitLine: { lineStyle: { color: 'rgba(139,69,19,0.08)' } }
    }
  }

  const tooltipFormatter = (params) => {
    const date = params[0]?.name || ''
    let html = `<b>${date}</b><br/>`
    params.forEach(p => {
      const unit = p.seriesIndex === 0 ? '场' : (p.seriesIndex === 1 ? '人' : '轮')
      html += `${p.marker} ${p.seriesName}: <b>${p.value}</b> ${unit}<br/>`
    })
    return html
  }

  trendChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: 'rgba(139,69,19,0.2)',
      borderWidth: 1,
      textStyle: { color: '#5c4033', fontSize: 13 },
      formatter: tooltipFormatter
    },
    legend: activeTab.value === 'all' ? {
      data: ['对战场数', '参与人数', '平均回合'],
      bottom: 0,
      textStyle: { color: '#8b4513' }
    } : { show: false },
    grid: {
      left: '3%',
      right: activeTab.value === 'all' ? '6%' : '4%',
      bottom: activeTab.value === 'all' ? '12%' : '8%',
      top: '8%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: noDataMode ? [] : categories,
      axisLine: { lineStyle: { color: 'rgba(139,69,19,0.3)' } },
      axisLabel: { color: '#8b4513', rotate: 35, interval: 'auto' },
      axisTick: { alignWithLabel: true }
    },
    yAxis: buildYAxis(),
    graphic: noDataMode
      ? [{
          type: 'text',
          left: 'center',
          top: 'middle',
          style: {
            text: '所选时段内暂无对战数据',
            fill: '#bbb',
            fontSize: 15,
            fontFamily: 'SimSun, STSong, serif'
          }
        }]
      : [],
    series: noDataMode ? [] : buildSeries()
  }, { notMerge: false })
}

const parseBattleDate = (raw) => {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = String(raw).trim()
  if (/^\d{10,}$/.test(s)) {
    const n = Number(s)
    const ms = n < 1e12 ? n * 1000 : n
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const formatDate = (dateVal) => {
  const date = parseBattleDate(dateVal)
  if (!date) return '—'
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const exportData = async (e) => {
  try {
    const token = localStorage.getItem('teacherToken')
    if (!token) {
      router.push('/teacher/login')
      return
    }

    const btn = e?.currentTarget?.closest('.btn-primary')
    const originalText = btn.innerHTML
    btn.innerHTML = '<span class="loading-spinner small"></span> 导出中...'
    btn.disabled = true

    const exportPayload = {
      type: 'game',
      gameData: {
        stats: gameStats.value,
        topPlayers: topPlayers.value,
        recentGames: recentGames.value
      }
    }

    const response = await fetch('http://localhost:3000/api/teacher/export', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(exportPayload)
    })

    if (response.status === 401) {
      localStorage.removeItem('teacherToken')
      router.push('/teacher/login')
      return
    }

    if (response.ok) {
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `古诗词学习数据_${new Date().toISOString().split('T')[0]}.xlsx`
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (match) {
          filename = decodeURIComponent(match[1].replace(/['"]/g, ''))
        }
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      alert('数据导出成功！')
    } else {
      throw new Error('导出失败')
    }
  } catch (err) {
    console.error('导出数据失败:', err)
    alert('数据导出失败，请重试')
  } finally {
    const btn = e?.currentTarget?.closest?.('.btn-primary')
    if (btn) {
      btn.innerHTML = '<span>📥</span> 导出数据'
      btn.disabled = false
    }
  }
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
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: 100vh;
  background: linear-gradient(135deg, rgba(139,69,19,0.03) 0%, rgba(205,133,63,0.05) 100%);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  padding: 0 4px;
}

.page-header h1 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 26px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.header-actions select {
  padding: 9px 14px;
  border: 1.5px solid rgba(205,133,63,0.35);
  border-radius: 10px;
  background: white;
  color: #5c4033;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.header-actions select:focus {
  border-color: #cd853f;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  font-size: 14px;
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
  border: 4px solid rgba(139,69,19,0.15);
  border-top: 4px solid #8b4513;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 核心指标卡片 */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: rgba(255,255,255,0.96);
  border-radius: 16px;
  padding: 22px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 4px 15px rgba(139,69,19,0.08);
  border-left: 4px solid #cd853f;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 22px rgba(139,69,19,0.14);
}

.stat-card:nth-child(1) { border-left-color: #5470c6; }
.stat-card:nth-child(2) { border-left-color: #52c41a; }
.stat-card:nth-child(3) { border-left-color: #faad14; }
.stat-card:nth-child(4) { border-left-color: #f5222d; }

.stat-icon {
  font-size: 34px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 26px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  line-height: 1.1;
}

.stat-label {
  font-size: 13px;
  color: #999;
  margin-top: 2px;
}

/* 图表区域 */
.chart-card {
  background: rgba(255,255,255,0.96);
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(139,69,19,0.08);
  margin-bottom: 20px;
  transition: box-shadow 0.2s;
}

.chart-card:hover {
  box-shadow: 0 6px 28px rgba(139,69,19,0.12);
}

.chart-card.full-width {
  grid-column: span 2;
}

.chart-card h2 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 6px 0;
  font-size: 17px;
}

.chart-desc {
  margin: 0 0 16px 0;
  font-size: 12px;
  color: #bbb;
}

/* 趋势图表头部 */
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.chart-header > div:first-child h2 {
  margin-bottom: 4px;
}

.chart-header > div:first-child .chart-desc {
  margin-bottom: 0;
}

.chart-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.tab-btn {
  padding: 6px 14px;
  border: 1.5px solid rgba(205,133,63,0.25);
  border-radius: 20px;
  background: white;
  color: #8b4513;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: rgba(205,133,63,0.08);
  border-color: #cd853f;
}

.tab-btn.active {
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  border-color: transparent;
  font-weight: 600;
}

.chart-wrapper {
  position: relative;
}

.chart-container {
  width: 100%;
  height: 320px;
}

.chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.chart-empty span {
  font-size: 48px;
  opacity: 0.4;
}

.chart-empty p {
  color: #bbb;
  font-size: 14px;
  margin: 0;
}

/* 趋势摘要 */
.trend-summary {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(205,133,63,0.1);
  flex-wrap: wrap;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.summary-label {
  font-size: 11px;
  color: #bbb;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-value {
  font-size: 18px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.summary-value.highlight {
  color: #5470c6;
}

.summary-value.peak {
  color: #f5222d;
}

/* 两列布局 */
.charts-grid.two-col {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

/* 胜率排行 */
.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ranking-item {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  background: rgba(205,133,63,0.04);
  border-radius: 12px;
  transition: background 0.2s;
}

.ranking-item:hover {
  background: rgba(205,133,63,0.09);
}

.rank {
  width: 36px;
  font-size: 20px;
  text-align: center;
  flex-shrink: 0;
}

.player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-name {
  color: #5c4033;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  font-weight: 600;
}

.win-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.win-bar {
  flex: 1;
  height: 6px;
  background: rgba(205,133,63,0.12);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.win-rate {
  font-size: 14px;
  font-weight: bold;
  min-width: 42px;
  text-align: right;
}

/* 热门对战字 */
.hot-words {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.word-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.word-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 80px;
}

.word-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  font-size: 16px;
  font-weight: bold;
  font-family: 'SimSun', 'STSong', serif;
  flex-shrink: 0;
}

.word-tag.tag-1 { background: rgba(84,112,198,0.12); color: #5470c6; }
.word-tag.tag-2 { background: rgba(82,196,26,0.12); color: #52c41a; }
.word-tag.tag-3 { background: rgba(250,173,20,0.12); color: #faad14; }
.word-tag.tag-4 { background: rgba(205,133,63,0.12); color: #8b4513; }

.count {
  color: #bbb;
  font-size: 12px;
  white-space: nowrap;
}

.word-bar-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.word-bar {
  flex: 1;
  height: 8px;
  background: rgba(205,133,63,0.1);
  border-radius: 4px;
  overflow: hidden;
}

.pct {
  font-size: 12px;
  color: #bbb;
  min-width: 34px;
  text-align: right;
}

/* 表格 */
.table-wrapper {
  overflow-x: auto;
}

.game-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 580px;
}

.game-table th {
  text-align: left;
  padding: 12px 16px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
  border-bottom: 2px solid rgba(205,133,63,0.2);
  white-space: nowrap;
}

.game-table td {
  padding: 13px 16px;
  border-bottom: 1px solid rgba(205,133,63,0.08);
  color: #5c4033;
  font-size: 13px;
}

.game-table tr:hover td {
  background: rgba(205,133,63,0.04);
}

.game-table .td-date {
  color: #bbb;
  font-size: 12px;
  white-space: nowrap;
}

.winner {
  color: #52c41a;
  font-weight: bold;
}

.keyword-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(84,112,198,0.1);
  color: #5470c6;
  font-size: 12px;
  font-weight: bold;
  font-family: 'SimSun', 'STSong', serif;
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #bbb;
  font-size: 14px;
}

@media (max-width: 1100px) {
  .charts-grid.two-col {
    grid-template-columns: 1fr;
  }
  .chart-card.full-width {
    grid-column: span 1;
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
}
</style>
