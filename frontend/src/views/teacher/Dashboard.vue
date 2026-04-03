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
      <!-- ===== 核心指标卡片 ===== -->
      <div class="section-header">
        <h2 class="section-title">📊 教学概况总览</h2>
        <span class="section-desc">数据截至 {{ todayDate }}</span>
      </div>

      <div class="kpi-cards">
        <div class="kpi-card highlight">
          <div class="kpi-icon">👥</div>
          <div class="kpi-info">
            <h3>学生总数</h3>
            <p class="kpi-value">{{ overview.totalStudents || 0 }}</p>
            <p class="kpi-sub">全部时间学习过诗词的学生</p>
          </div>
        </div>
        <div class="kpi-card highlight-green">
          <div class="kpi-icon">🔥</div>
          <div class="kpi-info">
            <h3>今日活跃</h3>
            <p class="kpi-value">{{ overview.todayActive || 0 }} <span class="kpi-unit">人</span></p>
            <p class="kpi-sub">今日有学习记录的学生</p>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">📚</div>
          <div class="kpi-info">
            <h3>本周活跃</h3>
            <p class="kpi-value">{{ overview.weekActive || 0 }} <span class="kpi-unit">人</span></p>
            <p class="kpi-sub">近7天有学习记录的学生</p>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">🏆</div>
          <div class="kpi-info">
            <h3>平均闯关</h3>
            <p class="kpi-value">{{ overview.avgLevel || 0 }} <span class="kpi-unit">关</span></p>
            <p class="kpi-sub">学生平均最高关卡</p>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">📝</div>
          <div class="kpi-info">
            <h3>闯关答题</h3>
            <p class="kpi-value">{{ overview.totalChallengeAnswers || 0 }}</p>
            <p class="kpi-sub">全部学生答题总次数</p>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">🎮</div>
          <div class="kpi-info">
            <h3>飞花令对战</h3>
            <p class="kpi-value">{{ overview.totalFeihuaBattles || 0 }} <span class="kpi-unit">场</span></p>
            <p class="kpi-sub">全部学生对战总场数</p>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">❌</div>
          <div class="kpi-info">
            <h3>错题总数</h3>
            <p class="kpi-value">{{ overview.totalErrors || 0 }}</p>
            <p class="kpi-sub">错题本收录总条数</p>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon">❤️</div>
          <div class="kpi-info">
            <h3>收藏记录</h3>
            <p class="kpi-value">{{ overview.totalCollections || 0 }}</p>
            <p class="kpi-sub">学生收藏诗词总条数</p>
          </div>
        </div>
      </div>

      <!-- ===== 学习趋势图表 ===== -->
      <div class="section-header" style="margin-top: 40px;">
        <h2 class="section-title">📈 学习趋势分析</h2>
        <span class="section-desc">展示近14天学习人数、答题次数的增减变化</span>
      </div>

      <div class="charts-grid">
        <div class="chart-card full-width">
          <div class="chart-title-area">
            <h2>📊 学习趋势（近14天）</h2>
            <p class="chart-desc">三条线分别代表：活跃学习人数（蓝色）、答题次数（橙色）、总操作量（棕色）</p>
          </div>
          <div ref="trendChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card full-width">
          <div class="chart-title-area">
            <h2>📚 诗词学习动态（近14天每日记录条数）</h2>
            <p class="chart-desc">每天学生浏览诗词、查看讲解的记录次数，周末略低符合学习规律</p>
          </div>
          <div ref="studyChartRef" class="chart-container"></div>
        </div>

        <!-- ===== 统计分析图表 ===== -->
        <div class="section-header" style="margin-top: 20px; grid-column: span 2;">
          <h2 class="section-title">📉 统计分析</h2>
          <span class="section-desc">各维度数据分布与对比</span>
        </div>

        <div class="chart-card half-width">
          <div class="chart-title-area">
            <h2>🎯 关卡分布</h2>
            <p class="chart-desc">学生最高闯关关卡的人数分布</p>
          </div>
          <div ref="levelChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <div class="chart-title-area">
            <h2>❌ 错题TOP10</h2>
            <p class="chart-desc">被答错次数最多的题目（易错题）</p>
          </div>
          <div ref="wrongChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <div class="chart-title-area">
            <h2>🏫 班级人数分布</h2>
            <p class="chart-desc">各班学生人数占比</p>
          </div>
          <div ref="classChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <div class="chart-title-area">
            <h2>⏰ 闯关答题时段（0–23时）</h2>
            <p class="chart-desc">学生最活跃的答题时间段分布</p>
          </div>
          <div ref="hourChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <div class="chart-title-area">
            <h2>✅ 答题正确率 vs 错误率</h2>
            <p class="chart-desc">全部学生答题的正确与错误比例</p>
          </div>
          <div ref="rateChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <div class="chart-title-area">
            <h2>🤖 闯关 AI 辅助使用</h2>
            <p class="chart-desc">学生使用/未使用AI提示的次数对比</p>
          </div>
          <div ref="aiChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <div class="chart-title-area">
            <h2>✍️ 学生创作类型</h2>
            <p class="chart-desc">各类型诗词创作的数量分布</p>
          </div>
          <div ref="creationChartRef" class="chart-container"></div>
        </div>

        <div class="chart-card half-width">
          <div class="chart-title-area">
            <h2>🏅 闯关排行榜 TOP20</h2>
            <p class="chart-desc">按最高闯关关卡排序，数字越大排名越靠前</p>
          </div>
          <div class="ranking-table">
            <div v-for="(item, index) in ranking" :key="index" class="ranking-row">
              <span class="rank-number">{{ index < 3 ? ['🥇', '🥈', '🥉'][index] : (index + 1) }}</span>
              <span class="rank-username">{{ item.username }}</span>
              <span class="rank-level">第 {{ item.level }} 关</span>
            </div>
            <div v-if="ranking.length === 0" class="ranking-empty">暂无数据</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
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

const todayDate = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1}月${now.getDate()}日 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
})

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

    await nextTick()
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
  if (!trendChartRef.value) return
  if (trendChartRef.value.offsetWidth === 0) return

  if (trendChart) trendChart.dispose()
  trendChart = echarts.init(trendChartRef.value)

  const dates = trend.value.map(i => {
    const d = i.date ? i.date.split('-') : []
    return d.length >= 3 ? `${d[1]}/${d[2]}` : ''
  })
  const activeStudents = trend.value.map(i => i.activeStudents || 0)
  const challengeCounts = trend.value.map(i => i.challengeCount || 0)
  const totalCounts = trend.value.map(i => {
    return (i.learnCount || 0) + (i.challengeCount || 0)
  })

  trendChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const date = params[0].name
        let html = `<b>${date}</b><br/>`
        params.forEach(p => {
          html += `${p.marker} ${p.seriesName}: <b>${p.value}</b> ${p.seriesIndex === 0 ? '人' : '次'}<br/>`
        })
        return html
      }
    },
    legend: {
      data: ['活跃学习人数', '答题次数', '总操作量'],
      bottom: 0,
      textStyle: { color: '#8b4513' }
    },
    grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { rotate: 35, color: '#8b4513' },
      axisLine: { lineStyle: { color: 'rgba(139,69,19,0.3)' } }
    },
    yAxis: [
      {
        type: 'value',
        name: '人数/人次',
        axisLabel: { color: '#8b4513' },
        splitLine: { lineStyle: { color: 'rgba(139,69,19,0.08)' } }
      }
    ],
    series: [
      {
        name: '活跃学习人数',
        type: 'line',
        smooth: true,
        data: activeStudents,
        itemStyle: { color: '#5470c6' },
        areaStyle: { color: 'rgba(84,112,198,0.1)' },
        lineStyle: { width: 2.5 }
      },
      {
        name: '答题次数',
        type: 'line',
        smooth: true,
        data: challengeCounts,
        itemStyle: { color: '#ee6666' },
        areaStyle: { color: 'rgba(238,102,102,0.1)' },
        lineStyle: { width: 2.5 }
      },
      {
        name: '总操作量',
        type: 'bar',
        data: totalCounts,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#deb887' },
            { offset: 1, color: '#8b4513' }
          ])
        },
        barMaxWidth: 18
      }
    ]
  })
}

const initStudyChart = () => {
  if (!studyChartRef.value) return
  if (studyChartRef.value.offsetWidth === 0) return

  if (studyChart) studyChart.dispose()
  studyChart = echarts.init(studyChartRef.value)
  const days = dashboardMore.value.poemStudyByDay || []
  const dates = days.map((i) => {
    const d = i.date ? i.date.split('-') : []
    return d.length >= 3 ? `${d[1]}/${d[2]}` : (i.date || '')
  })
  const counts = days.map((i) => i.count || 0)

  studyChart.setOption({
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const p = params[0]
        const dayOfWeek = ['', '一', '二', '三', '四', '五', '六', '日']
        const dateParts = (p.name || '').split('/')
        const d = new Date(2026, parseInt(dateParts[0]) - 1, parseInt(dateParts[1]))
        const weekday = dayOfWeek[d.getDay()]
        return `<b>${p.name} (周${weekday})</b><br/>${p.marker} 学习记录: <b>${p.value}</b> 条`
      }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { rotate: 35, color: '#8b4513' },
      axisLine: { lineStyle: { color: 'rgba(139,69,19,0.3)' } }
    },
    yAxis: {
      type: 'value',
      name: '记录条数',
      axisLabel: { color: '#8b4513' },
      splitLine: { lineStyle: { color: 'rgba(139,69,19,0.08)' } }
    },
    series: [{
      name: '学习记录',
      type: 'bar',
      data: counts,
      itemStyle: {
        color: (params) => {
          const dateParts = params.name.split('/')
          const d = new Date(2026, parseInt(dateParts[0]) - 1, parseInt(dateParts[1]))
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          return isWeekend
            ? new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#b0c4de' },
                { offset: 1, color: '#6a9bd1' }
              ])
            : new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#deb887' },
                { offset: 1, color: '#8b4513' }
              ])
        }
      },
      barMaxWidth: 28
    }]
  })
}

const initLevelChart = () => {
  if (!levelChartRef.value) return
  if (levelChartRef.value.offsetWidth === 0) return

  if (levelChart) levelChart.dispose()
  levelChart = echarts.init(levelChartRef.value)
  levelChart.setOption({
    tooltip: { trigger: 'axis', formatter: '{b}: <b>{c}</b> 人' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: levelDistribution.value.map(i => i.range || '') },
    yAxis: { type: 'value', name: '人数' },
    series: [{
      name: '人数',
      type: 'bar',
      data: levelDistribution.value.map(i => i.count || 0),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#cd853f' },
          { offset: 1, color: '#8b4513' }
        ])
      }
    }]
  })
}

const initWrongChart = () => {
  if (!wrongChartRef.value) return
  if (wrongChartRef.value.offsetWidth === 0) return

  if (wrongChart) wrongChart.dispose()
  wrongChart = echarts.init(wrongChartRef.value)
  wrongChart.setOption({
    tooltip: { trigger: 'axis', formatter: (params) => `${params[0].name}<br/>被答错 <b>${params[0].value}</b> 次` },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: '错误次数', axisLabel: { color: '#8b4513' } },
    yAxis: {
      type: 'category',
      data: wrongTop.value.map(i => (i.question || '').slice(0, 12) + (i.question && i.question.length > 12 ? '…' : '')).reverse()
    },
    series: [{
      name: '错误次数',
      type: 'bar',
      data: wrongTop.value.map(i => i.error_count || 0).reverse(),
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
          { offset: 0, color: '#ee6666' },
          { offset: 1, color: '#dc143c' }
        ])
      }
    }]
  })
}

const initClassChart = () => {
  if (!classChartRef.value) return
  if (classChartRef.value.offsetWidth === 0) return

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
  if (hourChartRef.value.offsetWidth === 0) return

  if (hourChart) hourChart.dispose()
  hourChart = echarts.init(hourChartRef.value)
  const hours = dashboardMore.value.challengeByHour || []
  hourChart.setOption({
    tooltip: { trigger: 'axis', formatter: (params) => `${params[0].name}<br/>答题 <b>${params[0].value}</b> 次` },
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
  if (rateChartRef.value.offsetWidth === 0) return

  if (rateChart) rateChart.dispose()
  rateChart = echarts.init(rateChartRef.value)
  const correct = correctRate.value.correct || 0
  const wrong = correctRate.value.wrong || 0
  const total = correct + wrong
  const correctPct = total > 0 ? Math.round((correct / total) * 100) : 0
  const wrongPct = total > 0 ? Math.round((wrong / total) * 100) : 0
  rateChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (params) => `${params.name}<br/>${params.marker} <b>${params.value}</b> 次 (${params.percent}%)`
    },
    legend: { bottom: 0, textStyle: { color: '#5c4033' } },
    series: [{
      name: '答题情况',
      type: 'pie',
      radius: ['40%', '70%'],
      data: [
        { value: correct, name: `正确 ${correctPct}%`, itemStyle: { color: '#32cd32' } },
        { value: wrong, name: `错误 ${wrongPct}%`, itemStyle: { color: '#dc143c' } }
      ],
      label: { color: '#5c4033' }
    }]
  })
}

const initAiChart = () => {
  if (!aiChartRef.value) return
  if (aiChartRef.value.offsetWidth === 0) return

  if (aiChart) aiChart.dispose()
  aiChart = echarts.init(aiChartRef.value)
  const ai = dashboardMore.value.aiHelpUsage || { withAi: 0, withoutAi: 0 }
  const withAi = ai.withAi || 0
  const withoutAi = ai.withoutAi || 0
  const total = withAi + withoutAi
  const withAiPct = total > 0 ? Math.round((withAi / total) * 100) : 0
  const withoutAiPct = total > 0 ? Math.round((withoutAi / total) * 100) : 0
  aiChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '10%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: '次数', axisLabel: { color: '#8b4513' }, splitLine: { lineStyle: { color: 'rgba(139,69,19,0.08)' } } },
    yAxis: {
      type: 'category',
      data: [`使用 AI 提示 (${withAiPct}%)`, `未使用 AI (${withoutAiPct}%)`],
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
      label: { show: true, position: 'right', color: '#5c4033', formatter: '{c} 次' }
    }]
  })
}

const initCreationChart = () => {
  if (!creationChartRef.value) return
  if (creationChartRef.value.offsetWidth === 0) return

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

/* Section Headers */
.section-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 16px;
}

.section-title {
  margin: 0;
  font-size: 20px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.section-desc {
  font-size: 13px;
  color: #999;
}

/* KPI Cards */
.kpi-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 10px;
}

.kpi-card {
  background: rgba(255,255,255,0.95);
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(139,69,19,0.08);
  display: flex;
  align-items: center;
  gap: 14px;
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid #cd853f;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(139,69,19,0.15);
}

.kpi-card.highlight {
  border-left-color: #5470c6;
  background: linear-gradient(135deg, rgba(84,112,198,0.06), rgba(255,255,255,0.95));
}

.kpi-card.highlight-green {
  border-left-color: #52c41a;
  background: linear-gradient(135deg, rgba(82,196,26,0.06), rgba(255,255,255,0.95));
}

.kpi-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.kpi-info {
  flex: 1;
  min-width: 0;
}

.kpi-info h3 {
  margin: 0 0 4px 0;
  font-size: 12px;
  color: #999;
  font-weight: normal;
  white-space: nowrap;
}

.kpi-value {
  margin: 0;
  font-size: 26px;
  font-weight: bold;
  color: #8b4513;
  line-height: 1.2;
}

.kpi-unit {
  font-size: 14px;
  font-weight: normal;
  color: #999;
}

.kpi-sub {
  margin: 3px 0 0 0;
  font-size: 11px;
  color: #bbb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  background: rgba(255,255,255,0.95);
  padding: 20px 20px 10px;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(139,69,19,0.08);
}

.chart-card.full-width {
  grid-column: span 2;
}

.chart-title-area {
  margin-bottom: 10px;
}

.chart-title-area h2 {
  margin: 0;
  font-size: 16px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.chart-desc {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #aaa;
}

.chart-container {
  width: 100%;
  height: 300px;
}

.ranking-table {
  max-height: 300px;
  overflow-y: auto;
}

.ranking-row {
  display: flex;
  align-items: center;
  padding: 12px 8px;
  border-bottom: 1px solid rgba(205,133,63,0.08);
}

.ranking-row:last-child {
  border-bottom: none;
}

.rank-number {
  width: 40px;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
  color: #8b4513;
}

.rank-username {
  flex: 1;
  font-size: 15px;
  color: #5c4033;
  font-family: 'SimSun', 'STSong', serif;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-level {
  font-size: 15px;
  font-weight: bold;
  color: #8b4513;
  white-space: nowrap;
}

.ranking-empty {
  text-align: center;
  padding: 40px;
  color: #bbb;
  font-size: 14px;
}

@media (max-width: 1200px) {
  .charts-grid { grid-template-columns: 1fr; }
  .chart-card.full-width { grid-column: span 1; }
}
</style>
