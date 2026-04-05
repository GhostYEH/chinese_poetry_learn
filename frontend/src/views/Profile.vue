<template>
  <div class="profile-page" :class="{ 'bg-loaded': bgLoaded }">

    <!-- 背景图 -->
    <div class="profile-background" :style="bgStyleInline">

      <!-- 背景骨架：直接用CSS背景，立即显示 -->
      <div class="bg-skeleton"></div>

      <!-- 完整背景图：加载完成后淡入 -->
      <img
        v-if="backgroundUrl"
        :src="backgroundUrl"
        class="bg-image"
        :class="{ 'bg-image-visible': bgLoaded }"
        @load="onBgLoad"
        @error="onBgError"
        alt="个人中心背景"
      />
      <div class="bg-overlay"></div>
      <div class="bg-particle" v-for="n in 30" :key="n" :style="getParticleStyle(n)"></div>
    </div>

    <!-- 主内容 -->
    <div class="profile-container">

      <!-- ========== 1. 用户信息卡片（iOS 26液态玻璃） ========== -->
      <section class="section section-user">
        <div class="ios26-card user-card" :style="{ animationDelay: '0.1s' }">
          <div class="card-liquid-border"></div>
          <div class="card-liquid-shine"></div>
          <div class="user-card-inner">
            <div class="avatar-wrap">
              <div class="avatar-ring"></div>
              <img
                src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ancient%20chinese%20poetry%20scholar%20avatar%2C%20traditional%20chinese%20style%2C%20gentle%20expression%2C%20ink%20painting%20style&image_size=square"
                alt="用户头像"
                class="avatar-img"
              />
              <div class="avatar-glow"></div>
              <div class="avatar-level-badge" v-if="statsData.overview">
                Lv.{{ calculateLevel(statsData.overview.poemsStudied) }}
              </div>
            </div>
            <div class="user-info-text">
              <h1 class="username">{{ user.username }}</h1>
              <p class="useremail">{{ user.email || '诗词爱好者' }}</p>
              <div class="user-tags">
                <span class="user-tag" v-for="tag in userTags" :key="tag.text">
                  <span class="tag-icon">{{ tag.icon }}</span>
                  {{ tag.text }}
                </span>
              </div>
            </div>
            <button class="logout-btn ios26-btn" @click="handleLogout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              退出登录
            </button>
          </div>
        </div>
      </section>

      <!-- ========== 2. 数据总览卡片组 ========== -->
      <section class="section section-overview">
        <div class="overview-grid">
          <div
            v-for="(stat, index) in overviewCards"
            :key="stat.label"
            class="ios26-card stat-card"
            :style="{ animationDelay: `${0.2 + index * 0.08}s`, '--accent': stat.color }"
          >
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="stat-icon-wrap">
              <span class="stat-icon">{{ stat.icon }}</span>
              <div class="stat-icon-glow"></div>
            </div>
            <div class="stat-info">
              <div class="stat-value" :style="{ color: stat.color }">
                <span class="stat-number" ref="statNumbers">{{ displayValues[index] }}</span>
                <span class="stat-unit">{{ stat.unit }}</span>
              </div>
              <div class="stat-label">{{ stat.label }}</div>
              <div class="stat-bar">
                <div class="stat-bar-fill" :style="{ width: stat.percentage + '%', background: stat.color }"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ========== 3. 多维数据可视化 ========== -->
      <section class="section section-charts">
        <div class="charts-grid">

          <!-- 3a. 学习趋势图（折线图） -->
          <div class="ios26-card chart-card chart-card--wide">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="chart-header">
              <h3 class="chart-title">
                <span class="chart-title-icon">📈</span>
                学习趋势
              </h3>
              <div class="chart-legend">
                <span class="legend-dot" style="background:#667eea"></span> 学习次数
                <span class="legend-dot" style="background:#f093fb; margin-left:8px"></span> 闯关次数
              </div>
            </div>
            <div class="chart-body" ref="trendChartRef">
              <svg class="trend-svg" :viewBox="`0 0 ${trendWidth} 160`" preserveAspectRatio="xMidYMid meet">
                <!-- 网格线 -->
                <line v-for="i in 4" :key="'grid'+i" :x1="0" :y1="i*40" :x2="trendWidth" :y2="i*40" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4,4"/>
                <!-- 学习次数折线 -->
                <polyline
                  :points="trendPoints.learning"
                  fill="none"
                  stroke="#667eea"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="chart-line"
                />
                <!-- 闯关次数折线 -->
                <polyline
                  :points="trendPoints.challenge"
                  fill="none"
                  stroke="#f093fb"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="chart-line"
                />
                <!-- 数据点 -->
                <circle v-for="(p, i) in trendDots.learning" :key="'ld'+i" :cx="p.x" :cy="p.y" r="3.5" fill="#667eea" class="chart-dot"/>
                <circle v-for="(p, i) in trendDots.challenge" :key="'cd'+i" :cx="p.x" :cy="p.y" r="3.5" fill="#f093fb" class="chart-dot"/>
                <!-- X轴标签 -->
                <text v-for="(label, i) in trendLabels" :key="'tl'+i" :x="i * (trendWidth / Math.max(trendLabels.length - 1, 1))" y="175" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="10">{{ label }}</text>
              </svg>
            </div>
          </div>

          <!-- 3b. 朝代分布（饼图/环形图） -->
          <div class="ios26-card chart-card">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="chart-header">
              <h3 class="chart-title">
                <span class="chart-title-icon">🏛</span>
                朝代分布
              </h3>
            </div>
            <div class="chart-body donut-body">
              <svg class="donut-svg" viewBox="0 0 200 200">
                <circle v-for="(seg, i) in donutSegments" :key="'seg'+i"
                  cx="100" cy="100" r="70"
                  fill="none"
                  :stroke="seg.color"
                  stroke-width="20"
                  :stroke-dasharray="`${seg.dash} ${circumference - seg.dash}`"
                  :stroke-dashoffset="seg.offset"
                  stroke-linecap="round"
                  class="donut-segment"
                  :style="{ animationDelay: `${i * 0.1}s` }"
                />
                <text x="100" y="95" text-anchor="middle" fill="rgba(255,255,255,0.9)" font-size="22" font-weight="700" font-family="Noto Serif SC, serif">
                  {{ totalDynastyCount }}
                </text>
                <text x="100" y="115" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="11">首诗词</text>
              </svg>
              <div class="donut-legend">
                <div v-for="(item, i) in dynastyLegend" :key="item.dynasty" class="donut-legend-item">
                  <span class="donut-legend-dot" :style="{ background: item.color }"></span>
                  <span class="donut-legend-text">{{ item.dynasty || '其他' }}</span>
                  <span class="donut-legend-pct">{{ item.percent }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3c. 能力雷达图 -->
          <div class="ios26-card chart-card">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="chart-header">
              <h3 class="chart-title">
                <span class="chart-title-icon">🧭</span>
                能力雷达
              </h3>
              <span class="chart-subtitle">综合能力评估</span>
            </div>
            <div class="chart-body radar-body">
              <svg class="radar-svg" viewBox="0 0 240 240">
                <!-- 背景网格 -->
                <polygon v-for="i in 5" :key="'rg'+i"
                  :points="getRadarPolygon(i * 0.2, 120, 120, 80)"
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  stroke-width="1"
                />
                <!-- 网格刻度值 -->
                <text v-for="i in 5" :key="'gv'+i"
                  x="8" :y="125 - i * 16"
                  fill="rgba(255,255,255,0.25)"
                  font-size="8"
                >{{ i * 20 }}</text>
                <!-- 轴线 -->
                <line v-for="(axis, i) in radarAxesComputed" :key="'ax'+i"
                  :x1="120" :y1="120"
                  :x2="axis.x2" :y2="axis.y2"
                  stroke="rgba(255,255,255,0.08)"
                  stroke-width="1"
                />
                <!-- 能力区域填充 -->
                <polygon
                  :points="radarPoints"
                  fill="url(#radarGradient)"
                  stroke="url(#radarStrokeGradient)"
                  stroke-width="2.5"
                  stroke-linejoin="round"
                  class="radar-area"
                />
                <!-- 渐变定义 -->
                <defs>
                  <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:rgba(102,126,234,0.4)" />
                    <stop offset="100%" style="stop-color:rgba(240,147,251,0.3)" />
                  </linearGradient>
                  <linearGradient id="radarStrokeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#667eea" />
                    <stop offset="100%" style="stop-color:#f093fb" />
                  </linearGradient>
                </defs>
                <!-- 数据点 -->
                <circle v-for="(point, i) in radarDataPoints" :key="'rd'+i"
                  :cx="point.x" :cy="point.y" r="5"
                  fill="#fff"
                  :stroke="point.color"
                  stroke-width="2"
                  class="radar-dot"
                />
                <!-- 数据点发光效果 -->
                <circle v-for="(point, i) in radarDataPoints" :key="'rdg'+i"
                  :cx="point.x" :cy="point.y" r="8"
                  fill="none"
                  :stroke="point.color"
                  stroke-width="1"
                  opacity="0.3"
                  class="radar-glow"
                />
                <!-- 标签和数值 -->
                <text v-for="(axis, i) in radarAxesComputed" :key="'al'+i"
                  :x="axis.labelX" :y="axis.labelY - 8"
                  text-anchor="middle" dominant-baseline="middle"
                  fill="rgba(255,255,255,0.85)" font-size="12" font-weight="600" font-family="Noto Sans SC, sans-serif"
                >{{ axis.label }}</text>
                <text v-for="(axis, i) in radarAxesComputed" :key="'av'+i"
                  :x="axis.labelX" :y="axis.labelY + 8"
                  text-anchor="middle" dominant-baseline="middle"
                  :fill="radarDataPoints[i]?.color || '#667eea'"
                  font-size="11" font-weight="700" font-family="Noto Sans SC, sans-serif"
                >{{ radarValues[i] }}</text>
              </svg>
            </div>
          </div>

          <!-- 3d. 学习日历热力图 -->
          <div class="ios26-card chart-card chart-card--wide">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="chart-header">
              <h3 class="chart-title">
                <span class="chart-title-icon">📅</span>
                学习日历
              </h3>
              <div class="heatmap-stats">
                <span class="heatmap-stat-item">
                  <span class="heatmap-stat-value">{{ totalLearningDays }}</span>
                  <span class="heatmap-stat-label">天学习</span>
                </span>
                <span class="heatmap-stat-item">
                  <span class="heatmap-stat-value">{{ currentStreak }}</span>
                  <span class="heatmap-stat-label">天连续</span>
                </span>
              </div>
            </div>
            <div class="chart-body heatmap-body">
              <div class="heatmap-month-labels">
                <span v-for="month in heatmapMonthLabels" :key="month" class="heatmap-month">{{ month }}</span>
              </div>
              <div class="heatmap-container">
                <div class="heatmap-weekdays">
                  <span v-for="d in ['日','一','二','三','四','五','六']" :key="d" class="heatmap-weekday">{{ d }}</span>
                </div>
                <div class="heatmap-grid">
                  <div
                    v-for="(cell, i) in heatmapCells"
                    :key="i"
                    class="heatmap-cell"
                    :class="{ 'heatmap-cell-today': cell.isToday }"
                    :style="{ background: cell.color, animationDelay: `${i * 8}ms` }"
                    :title="`${cell.dateFormatted}: ${cell.count}次学习`"
                  >
                    <span v-if="cell.count > 0" class="heatmap-count">{{ cell.count }}</span>
                  </div>
                </div>
              </div>
              <div class="heatmap-legend">
                <span class="heatmap-legend-label">学习次数</span>
                <div class="heatmap-scale">
                  <div class="scale-item" style="background:rgba(102,126,234,0.1)"></div>
                  <div class="scale-item" style="background:rgba(102,126,234,0.3)"></div>
                  <div class="scale-item" style="background:rgba(102,126,234,0.5)"></div>
                  <div class="scale-item" style="background:rgba(102,126,234,0.75)"></div>
                  <div class="scale-item" style="background:#667eea"></div>
                </div>
                <div class="heatmap-scale-labels">
                  <span>0</span>
                  <span>1-2</span>
                  <span>3-4</span>
                  <span>5-6</span>
                  <span>7+</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      <section class="section section-records">
        <div class="records-grid">
          <!-- 已收藏诗词 -->
          <div class="ios26-card records-card">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="chart-header">
              <h3 class="chart-title">
                <span class="chart-title-icon">⭐</span>
                已收藏诗词
              </h3>
              <span class="records-count" v-if="collectedPoems.length > 0">{{ collectedPoems.length }}首</span>
            </div>
            <div class="record-list">
              <div v-if="collectedPoems.length === 0" class="record-empty">
                <span class="empty-icon">⭐</span>
                <p>暂无收藏诗词</p>
              </div>
              <div
                v-for="(poem, i) in collectedPoems"
                :key="poem.poem_id"
                class="record-item ios26-card record-poem-card"
                :style="{ animationDelay: `${0.4 + i * 0.06}s` }"
                @click="navigateToDetail(poem.poem_id)"
              >
                <div class="record-liquid-shine"></div>
                <div class="poem-card-header">
                  <h4 class="poem-card-title">{{ poem.poem_title || poem.title || '无题' }}</h4>
                  <span class="poem-card-author">{{ poem.poem_author || poem.author || '未知' }}</span>
                </div>
                <p class="poem-card-content">{{ getShortContent(poem.poem_content || poem.content) }}</p>
                <div class="poem-card-footer">
                  <span class="poem-card-time">{{ formatTime(poem.collected_at) }}</span>
                  <button class="poem-card-remove" @click.stop="removeCollection(poem.poem_id)">取消收藏</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 最近学习 -->
          <div class="ios26-card records-card">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="chart-header">
              <h3 class="chart-title">
                <span class="chart-title-icon">📚</span>
                最近学习
              </h3>
              <span class="records-count" v-if="learnedPoems.length > 0">{{ learnedPoems.length }}首</span>
            </div>
            <div class="record-list">
              <div v-if="learnedPoems.length === 0" class="record-empty">
                <span class="empty-icon">📚</span>
                <p>暂无学习记录</p>
              </div>
              <div
                v-for="(poem, i) in learnedPoems"
                :key="poem.poem_id"
                class="record-item ios26-card record-poem-card"
                :style="{ animationDelay: `${0.4 + i * 0.06}s` }"
                @click="navigateToDetail(poem.poem_id)"
              >
                <div class="record-liquid-shine"></div>
                <div class="poem-card-header">
                  <h4 class="poem-card-title">{{ poem.poem_title || poem.title || '无题' }}</h4>
                  <span class="poem-card-author">{{ poem.poem_author || poem.author || '未知' }}</span>
                </div>
                <p class="poem-card-content">{{ getShortContent(poem.content) }}</p>
                <div class="poem-card-footer">
                  <span class="poem-card-time">{{ formatTime(poem.last_view_time) }}</span>
                  <span class="poem-card-score" v-if="poem.best_score">
                    最高分: <strong>{{ poem.best_score }}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()

// ===== 数据状态 =====
const user = ref({ username: '诗词爱好者', email: '' })
const statsData = ref({ overview: null, activityData: null, achievements: null })
const collectedPoems = ref([])
const learnedPoems = ref([])
const activityData = ref({ learningActivity: [], challengeActivity: [], dynastyDistribution: [], authorDistribution: [] })
const loading = ref(true)
const error = ref('')

// ===== 背景图状态 =====
const backgroundUrl = ref('')
const bgLoaded = ref(false)

// ===== 图表尺寸 =====
const trendChartRef = ref(null)
const trendWidth = ref(600)
const circumference = 2 * Math.PI * 70

// ===== 用户标签 =====
const userTags = computed(() => {
  const tags = []
  if (statsData.value.overview) {
    const o = statsData.value.overview
    if (o.poemsStudied >= 50) tags.push({ icon: '📚', text: '资深学者' })
    else if (o.poemsStudied >= 10) tags.push({ icon: '📖', text: '诗词爱好者' })
    else tags.push({ icon: '🌱', text: '初学者' })
    if (o.weeklyCheckins >= 5) tags.push({ icon: '🔥', text: '坚持打卡' })
    if (o.challengeLevel >= 10) tags.push({ icon: '⚔️', text: '闯关达人' })
    if (o.creations >= 3) tags.push({ icon: '✍️', text: '创作者' })
  }
  return tags.slice(0, 3)
})

// ===== 数值动画 =====
const displayValues = ref([0, 0, 0, 0, 0, 0, 0, 0])

const overviewCards = computed(() => {
  const o = statsData.value.overview || {}
  return [
    { icon: '📚', label: '已学诗词', value: o.poemsStudied || 0, unit: '首', color: '#667eea', percentage: Math.min((o.poemsStudied || 0) / 100 * 100, 100) },
    { icon: '⭐', label: '收藏诗词', value: o.collections || 0, unit: '首', color: '#f093fb', percentage: Math.min((o.collections || 0) / 50 * 100, 100) },
    { icon: '✍️', label: '创作作品', value: o.creations || 0, unit: '首', color: '#a8edea', percentage: Math.min((o.creations || 0) / 20 * 100, 100) },
    { icon: '🏰', label: '闯关关卡', value: o.challengeLevel || 0, unit: '关', color: '#fee140', percentage: Math.min((o.challengeLevel || 0) / 50 * 100, 100) },
    { icon: '🌸', label: '飞花令积分', value: o.feihuaRating || 1000, unit: '分', color: '#f5576c', percentage: Math.min(((o.feihuaRating || 1000) - 800) / 1200 * 100, 100) },
    { icon: '📝', label: '错题本', value: o.wrongQuestions || 0, unit: '题', color: '#ff9a9e', percentage: Math.min((o.wrongQuestions || 0) / 30 * 100, 100) },
    { icon: '🔥', label: '本周打卡', value: o.weeklyCheckins || 0, unit: '天', color: '#ffecd2', percentage: Math.min((o.weeklyCheckins || 0) / 7 * 100, 100) },
    { icon: '⏱', label: '学习时长', value: o.totalStudyTime || 0, unit: '分钟', color: '#84fab0', percentage: Math.min((o.totalStudyTime || 0) / 1000 * 100, 100) },
  ]
})

// ===== 折线图数据 =====
const trendLabels = computed(() => {
  const data = activityData.value.learningActivity || []
  if (data.length === 0) return ['第1天','第7天','第14天','第21天','第30天']
  const labels = data.map(d => {
    const date = new Date(d.date)
    return `${date.getMonth() + 1}/${date.getDate()}`
  })
  if (labels.length <= 5) return labels
  return [labels[0], labels[Math.floor(labels.length * 0.25)], labels[Math.floor(labels.length * 0.5)], labels[Math.floor(labels.length * 0.75)], labels[labels.length - 1]]
})

const trendPoints = computed(() => {
  const learnData = activityData.value.learningActivity || []
  const chalData = activityData.value.challengeActivity || []
  const maxLearn = Math.max(...learnData.map(d => d.count ?? 0), 1)
  const maxChal = Math.max(...chalData.map(d => d.count ?? 0), 1)
  const w = trendWidth.value
  const h = 140

  const makePoints = (data, maxVal, field = 'count') => {
    if (!data || data.length === 0) return ''
    const pts = data.map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * w
      const val = d[field] ?? 0
      const y = h - (val / maxVal) * (h - 20)
      return `${x},${y}`
    })
    return pts.join(' ')
  }

  return {
    learning: makePoints(learnData, maxLearn),
    challenge: makePoints(chalData, maxChal)
  }
})

const trendDots = computed(() => {
  const learnData = activityData.value.learningActivity || []
  const chalData = activityData.value.challengeActivity || []
  const maxLearn = Math.max(...learnData.map(d => d.count ?? 0), 1)
  const maxChal = Math.max(...chalData.map(d => d.count ?? 0), 1)
  const w = trendWidth.value
  const h = 140

  const makeDots = (data, maxVal) => {
    if (!data || data.length === 0) return []
    return data.map((d, i) => ({
      x: (i / Math.max(data.length - 1, 1)) * w,
      y: h - ((d.count ?? 0) / maxVal) * (h - 20)
    }))
  }

  return {
    learning: makeDots(learnData, maxLearn),
    challenge: makeDots(chalData, maxChal)
  }
})

// ===== 环形图数据 =====
const DONUT_COLORS = ['#667eea', '#f093fb', '#fee140', '#a8edea', '#84fab0', '#f5576c', '#ff9a9e', '#ffecd2']

const dynastyLegend = computed(() => {
  const dist = activityData.value.dynastyDistribution || []
  const total = dist.reduce((s, d) => s + d.count, 0) || 1
  return dist.map((d, i) => ({
    dynasty: d.dynasty || '其他',
    count: d.count,
    percent: Math.round(d.count / total * 100),
    color: DONUT_COLORS[i % DONUT_COLORS.length]
  }))
})

const totalDynastyCount = computed(() => {
  return activityData.value.dynastyDistribution?.reduce((s, d) => s + d.count, 0) || 0
})

const donutSegments = computed(() => {
  const dist = activityData.value.dynastyDistribution || []
  const total = dist.reduce((s, d) => s + d.count, 0) || 1
  let cumulative = 0
  return dist.map((d, i) => {
    const dash = (d.count / total) * circumference
    const offset = -cumulative + circumference * 0.25
    cumulative += dash
    return {
      color: DONUT_COLORS[i % DONUT_COLORS.length],
      dash,
      offset
    }
  })
})

// ===== 雷达图数据 =====
const RADAR_COLORS = ['#667eea', '#f093fb', '#a8edea', '#fee140']

const radarAxes = [
  { label: '记忆', angle: -90, key: 'memory' },
  { label: '理解', angle: 0, key: 'understanding' },
  { label: '应用', angle: 90, key: 'application' },
  { label: '创作', angle: 180, key: 'creativity' },
]

const radarAxesComputed = computed(() => {
  const cx = 120, cy = 120, r = 80
  return radarAxes.map(axis => {
    const rad = (axis.angle * Math.PI) / 180
    const x2 = cx + r * Math.cos(rad)
    const y2 = cy + r * Math.sin(rad)
    const lr = r + 28
    const labelX = cx + lr * Math.cos(rad)
    const labelY = cy + lr * Math.sin(rad)
    return { ...axis, x2, y2, labelX, labelY }
  })
})

const radarValues = computed(() => {
  const ability = statsData.value.abilityModel || {}
  return [
    ability.memory || 0,
    ability.understanding || 0,
    ability.application || 0,
    ability.creativity || 0,
  ]
})

const radarPoints = computed(() => {
  const cx = 120, cy = 120, r = 80
  return radarAxes.map((axis, i) => {
    const rad = (axis.angle * Math.PI) / 180
    const v = (radarValues.value[i] || 0) / 100
    return `${cx + r * v * Math.cos(rad)},${cy + r * v * Math.sin(rad)}`
  }).join(' ')
})

const radarDataPoints = computed(() => {
  const cx = 120, cy = 120, r = 80
  return radarAxes.map((axis, i) => {
    const rad = (axis.angle * Math.PI) / 180
    const v = (radarValues.value[i] || 0) / 100
    return {
      x: cx + r * v * Math.cos(rad),
      y: cy + r * v * Math.sin(rad),
      color: RADAR_COLORS[i]
    }
  })
})

const getRadarPolygon = (scale, cx = 120, cy = 120, r = 80) => {
  return radarAxes.map(axis => {
    const rad = (axis.angle * Math.PI) / 180
    return `${cx + r * scale * Math.cos(rad)},${cy + r * scale * Math.sin(rad)}`
  }).join(' ')
}

// ===== 热力图数据 =====
const HEATMAP_COLORS = [
  'rgba(102,126,234,0.08)',
  'rgba(102,126,234,0.25)',
  'rgba(102,126,234,0.45)',
  'rgba(102,126,234,0.7)',
  '#667eea'
]

const heatmapCells = computed(() => {
  const learnData = activityData.value.learningActivity || []
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  
  const cells = []
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 27)
  startDate.setHours(0, 0, 0, 0)
  
  const dayOfWeek = startDate.getDay()
  for (let i = 0; i < dayOfWeek; i++) {
    cells.push({
      date: '',
      dateFormatted: '',
      count: 0,
      color: 'transparent',
      isEmpty: true,
      isToday: false
    })
  }
  
  for (let i = 0; i < 28; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]
    const record = learnData.find(d => d.date === dateStr)
    const count = record ? record.count : 0
    
    let colorIndex = 0
    if (count === 0) colorIndex = 0
    else if (count <= 2) colorIndex = 1
    else if (count <= 4) colorIndex = 2
    else if (count <= 6) colorIndex = 3
    else colorIndex = 4
    
    cells.push({
      date: dateStr,
      dateFormatted: `${date.getMonth() + 1}月${date.getDate()}日`,
      count,
      color: HEATMAP_COLORS[colorIndex],
      isEmpty: false,
      isToday: dateStr === todayStr
    })
  }
  
  return cells
})

const heatmapMonthLabels = computed(() => {
  const today = new Date()
  const months = []
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 27)
  
  let lastMonth = -1
  for (let i = 0; i < 28; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const month = date.getMonth()
    if (month !== lastMonth) {
      months.push(`${date.getMonth() + 1}月`)
      lastMonth = month
    }
  }
  return months
})

const totalLearningDays = computed(() => {
  const learnData = activityData.value.learningActivity || []
  return learnData.filter(d => d.count > 0).length
})

const currentStreak = computed(() => {
  const learnData = activityData.value.learningActivity || []
  const dataMap = new Map(learnData.map(d => [d.date, d.count]))
  
  let streak = 0
  const today = new Date()
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    
    if (dataMap.get(dateStr) > 0) {
      streak++
    } else if (i > 0) {
      break
    }
  }
  
  return streak
})

// ===== 诗人统计 =====

// ===== 等级计算 =====
const calculateLevel = (poemsStudied) => {
  if (poemsStudied < 10) return 1
  if (poemsStudied < 30) return 2
  if (poemsStudied < 60) return 3
  if (poemsStudied < 100) return 4
  return 5
}

// ===== 背景粒子 =====
const getParticleStyle = (n) => {
  const random = (min, max) => Math.random() * (max - min) + min
  return {
    left: random(0, 100) + '%',
    top: random(0, 100) + '%',
    animationDelay: random(0, 8) + 's',
    animationDuration: random(6, 16) + 's',
    width: random(3, 8) + 'px',
    height: random(3, 8) + 'px',
    opacity: random(0.1, 0.4),
  }
}

// ===== 背景图处理 =====
// 预加载已由 router.beforeEach 在导航前完成，这里直接使用
const PROFILE_BACKGROUNDS = [
  './profile-bg/1.jpg',
  './profile-bg/2.jpg',
  './profile-bg/3.jpg',
  './profile-bg/4.jpg',
]

// 同步的inline style，避免Vue异步render造成的时间差
const bgStyleInline = ref({})

const loadBackground = () => {
  const randomIndex = Math.floor(Math.random() * PROFILE_BACKGROUNDS.length)
  const chosen = PROFILE_BACKGROUNDS[randomIndex]
  backgroundUrl.value = chosen
  // 立即设为CSS背景（同步），浏览器可直接使用预加载缓存，
  // 比 <img> 元素渲染快得多，避免出现空白/小图阶段
  bgStyleInline.value = {
    backgroundImage: `url(${chosen})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
}

const onBgLoad = () => {
  bgLoaded.value = true
}

const onBgError = () => {
  // 图片加载失败也立即显示，避免黑屏
  bgLoaded.value = true
}

// ===== 数据加载 =====
const loadUserInfo = () => {
  const userData = localStorage.getItem('user')
  if (userData) {
    user.value = JSON.parse(userData)
  }
}

const loadStats = async () => {
  try {
    const res = await api.profile.getStats()
    if (res.success && res.data) {
      statsData.value = res.data
      // 从stats API获取收藏诗词（数据库已JOIN poems表）
      collectedPoems.value = res.data.collectedPoems || []
      // 从stats API获取学习记录（数据库已JOIN poems表）
      learnedPoems.value = (res.data.recentPoems || []).map(p => ({
        ...p,
        poem_title: p.title,
        poem_author: p.author,
        poem_content: p.content
      }))
      // 动画数值
      overviewCards.value.forEach((card, i) => {
        animateCounter(i, card.value)
      })
    }
  } catch (e) {
    console.warn('获取统计数据失败', e)
  }
}

const loadActivityData = async () => {
  try {
    const res = await api.profile.getActivityData()
    if (res.success && res.data) {
      activityData.value = res.data
    }
  } catch (e) {
    console.warn('获取活动数据失败', e)
  }
}

const animateCounter = (index, targetValue) => {
  const duration = 2000
  const startTime = performance.now()
  const startValue = 0

  const animate = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const current = Math.round(startValue + (targetValue - startValue) * eased)
    displayValues.value[index] = current
    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      displayValues.value[index] = targetValue
    }
  }
  requestAnimationFrame(animate)
}

// ===== 操作方法 =====
const removeCollection = async (poemId) => {
  try {
    await api.collections.remove(poemId)
    collectedPoems.value = collectedPoems.value.filter(p => p.poem_id !== poemId)
  } catch (e) {
    console.error('取消收藏失败', e)
  }
}

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  router.push('/login')
}

const navigateToDetail = (id) => {
  router.push(`/poem/${id}`)
}

const getShortContent = (content) => {
  if (!content) return ''
  const clean = content.replace(/\s+/g, ' ').trim()
  return clean.length > 60 ? clean.substring(0, 60) + '...' : clean
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ===== 生命周期 =====
const handleCardMouseMove = (e) => {
  const card = e.currentTarget
  const rect = card.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100
  card.style.setProperty('--mouse-x', `${x}%`)
  card.style.setProperty('--mouse-y', `${y}%`)
}

const setupCardHoverEffects = () => {
  const cards = document.querySelectorAll('.ios26-card')
  cards.forEach(card => {
    card.addEventListener('mousemove', handleCardMouseMove)
  })
}

const cleanupCardHoverEffects = () => {
  const cards = document.querySelectorAll('.ios26-card')
  cards.forEach(card => {
    card.removeEventListener('mousemove', handleCardMouseMove)
  })
}

onMounted(async () => {
  loadBackground()
  loadUserInfo()

  await Promise.all([
    loadStats(),
    loadActivityData(),
  ])

  nextTick(() => {
    if (trendChartRef.value) {
      trendWidth.value = trendChartRef.value.offsetWidth || 600
    }
    setupCardHoverEffects()
  })

  window.addEventListener('resize', updateTrendWidth)
  loading.value = false
})

onUnmounted(() => {
  window.removeEventListener('resize', updateTrendWidth)
  cleanupCardHoverEffects()
})

const updateTrendWidth = () => {
  if (trendChartRef.value) {
    trendWidth.value = trendChartRef.value.offsetWidth || 600
  }
}
</script>

<style scoped>
/* ===== iOS 26 液态玻璃核心样式 ===== */
:root {
  --glass-bg: rgba(255, 255, 255, 0.08);
  --glass-bg-hover: rgba(255, 255, 255, 0.13);
  --glass-border: rgba(255, 255, 255, 0.15);
  --glass-border-hover: rgba(255, 255, 255, 0.28);
  --glass-blur: 24px;
  --glass-shadow: 0 8px 40px rgba(0, 0, 0, 0.25), 0 2px 12px rgba(0, 0, 0, 0.15);
  --glass-shadow-hover: 0 16px 60px rgba(0, 0, 0, 0.35), 0 4px 20px rgba(0, 0, 0, 0.2);
  --liquid-duration: 0.5s;
  --liquid-ease: cubic-bezier(0.4, 0, 0.2, 1);
}

.ios26-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  box-shadow: var(--glass-shadow);
  overflow: hidden;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: cardEntrance 0.8s var(--liquid-ease) both;
}

.ios26-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15) 0%,
    transparent 50%,
    transparent 100%
  );
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
  z-index: 3;
}

.ios26-card::after {
  content: '';
  position: absolute;
  top: -30%;
  left: -30%;
  width: 160%;
  height: 160%;
  background: radial-gradient(
    circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(255, 255, 255, 0.35) 0%,
    rgba(255, 255, 255, 0.15) 15%,
    rgba(102, 126, 234, 0.1) 25%,
    transparent 35%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 4;
  mix-blend-mode: overlay;
}

.ios26-card:hover {
  transform: translateY(-8px) scale(1.02);
  background: var(--glass-bg-hover);
  box-shadow: var(--glass-shadow-hover),
              0 0 40px rgba(102, 126, 234, 0.15);
  border-color: var(--glass-border-hover);
}

.ios26-card:hover::before {
  opacity: 1;
}

.ios26-card:hover::after {
  opacity: 1;
}

.ios26-card:hover .card-liquid-shine {
  animation-duration: 3s;
}

.ios26-card:hover .stat-icon {
  transform: scale(1.15) rotate(5deg);
}

.ios26-card:hover .stat-icon-glow {
  opacity: 0.6;
  transform: scale(1.3);
}

.ios26-card:hover .stat-bar-fill {
  filter: brightness(1.2);
}

@keyframes cardEntrance {
  from { opacity: 0; transform: translateY(24px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.card-liquid-border {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg,
    rgba(255,255,255,0.3) 0%,
    rgba(255,255,255,0.05) 30%,
    rgba(255,255,255,0.05) 70%,
    rgba(255,255,255,0.15) 100%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}

.card-liquid-shine {
  position: absolute;
  top: -60%;
  left: -60%;
  width: 220%;
  height: 220%;
  background: conic-gradient(
    from 0deg at 50% 50%,
    transparent 0deg,
    rgba(255,255,255,0.04) 60deg,
    transparent 120deg,
    rgba(255,255,255,0.03) 180deg,
    transparent 240deg,
    rgba(255,255,255,0.04) 300deg,
    transparent 360deg
  );
  animation: liquidShimmer 8s linear infinite;
  pointer-events: none;
  z-index: 0;
  border-radius: 50%;
}

@keyframes liquidShimmer {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== 页面整体布局 ===== */
.profile-page {
  min-height: 100vh;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.profile-container {
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section { display: flex; flex-direction: column; gap: 16px; }

/* 背景容器 */
.profile-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: linear-gradient(135deg, #0d0b1a 0%, #1a1035 30%, #0f0c2e 60%, #150d2a 100%);
}

/* 骨架背景：模糊的占位层，img加载完成后隐藏 */
.bg-skeleton {
  position: absolute;
  inset: 0;
  background: inherit;
  filter: blur(8px);
  transform: scale(1.05);
  transition: opacity 0.6s ease;
}

/* 当完整背景图可见时，隐藏骨架 */
.bg-image-visible ~ .bg-skeleton {
  opacity: 0;
}

/* 但因为CSS sibling选择器在DOM顺序上 bg-skeleton 在 bg-image 前面，
   我们用另一种方式：profile-background 有 bg-image 时骨架就隐藏 */
.profile-background:has(.bg-image-visible) .bg-skeleton {
  opacity: 0;
}

.bg-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.bg-image-visible {
  opacity: 1;
}

.bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.1) 0%,
    rgba(0, 0, 0, 0.3) 50%,
    rgba(0, 0, 0, 0.4) 100%
  );
  pointer-events: none;
  z-index: 1;
}

.bg-particle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(200,180,255,0.4), transparent);
  animation: floatParticle linear infinite;
  pointer-events: none;
  z-index: 2;
}

@keyframes floatParticle {
  0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
  10% { opacity: 1; }
  50% { transform: translateY(-30vh) translateX(15vw) scale(1.3); opacity: 0.6; }
  90% { opacity: 0.3; }
  100% { transform: translateY(-60vh) translateX(-10vw) scale(0.8); opacity: 0; }
}

/* ===== 用户信息卡片 ===== */
.user-card {
  padding: 32px;
  border-radius: 28px;
}

.user-card:hover .avatar-glow {
  animation-duration: 1.5s;
}

.user-card:hover .avatar-ring {
  border-color: rgba(102, 126, 234, 0.8);
}

.user-card:hover .user-tag {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.user-card-inner {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 28px;
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.avatar-ring {
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid rgba(102, 126, 234, 0.5);
  animation: ringPulse 3s ease-in-out infinite;
}

@keyframes ringPulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 0.2; }
}

.avatar-img {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255,255,255,0.2);
  position: relative;
  z-index: 1;
}

.avatar-glow {
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(102,126,234,0.3), transparent 70%);
  z-index: 0;
  animation: avatarGlow 3s ease-in-out infinite;
}

@keyframes avatarGlow {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}

.avatar-level-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  z-index: 2;
  border: 2px solid rgba(15,10,30,0.8);
}

.user-info-text {
  flex: 1;
  min-width: 0;
}

.username {
  font-size: 26px;
  font-weight: 700;
  font-family: 'Noto Serif SC', serif;
  background: linear-gradient(135deg, #fff, rgba(255,255,255,0.7));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 6px;
}

.useremail {
  font-size: 13px;
  color: rgba(255,255,255,0.45);
  margin-bottom: 12px;
  font-family: 'Noto Sans SC', sans-serif;
}

.user-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.user-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 50px;
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  backdrop-filter: blur(8px);
  font-family: 'Noto Sans SC', sans-serif;
  transition: background 0.3s ease, border-color 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tag-icon { font-size: 13px; }

.logout-btn {
  flex-shrink: 0;
}

/* ===== 通用iOS26按钮 ===== */
.ios26-btn {
  padding: 10px 22px;
  background: rgba(244, 67, 54, 0.15);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 50px;
  color: #ff6b6b;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s var(--liquid-ease);
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'Noto Sans SC', sans-serif;
  backdrop-filter: blur(12px);
}

.ios26-btn:hover {
  background: rgba(244, 67, 54, 0.25);
  border-color: rgba(244, 67, 54, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(244, 67, 54, 0.2);
}

/* ===== 数据总览网格 ===== */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: default;
}

.stat-icon-wrap {
  position: relative;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
}

.stat-icon {
  font-size: 24px;
  position: relative;
  z-index: 2;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: inline-block;
}

.stat-icon-glow {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent, #667eea), transparent 70%);
  opacity: 0.3;
  z-index: 1;
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.stat-info { flex: 1; min-width: 0; }

.stat-value {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-bottom: 4px;
}

.stat-number {
  font-size: 26px;
  font-weight: 800;
  font-family: 'Noto Serif SC', serif;
  line-height: 1;
}

.stat-unit {
  font-size: 12px;
  color: rgba(255,255,255,0.45);
}

.stat-label {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  font-family: 'Noto Sans SC', sans-serif;
  margin-bottom: 8px;
}

.stat-bar {
  height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  overflow: hidden;
}

.stat-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 2s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease;
  opacity: 0.8;
}

/* ===== 图表网格 ===== */
.charts-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto auto;
  gap: 16px;
}

.chart-card {
  padding: 20px;
}

.chart-card:hover .chart-title-icon {
  transform: scale(1.2) rotate(10deg);
}

.chart-title-icon {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: inline-block;
}

.chart-card--wide {
  grid-column: span 2;
}

.chart-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  font-family: 'Noto Serif SC', serif;
  margin: 0;
}

.chart-title-icon { font-size: 18px; }

.chart-subtitle {
  font-size: 11px;
  color: rgba(255,255,255,0.35);
  font-family: 'Noto Sans SC', sans-serif;
}

.chart-legend {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: rgba(255,255,255,0.45);
  font-family: 'Noto Sans SC', sans-serif;
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.chart-body {
  position: relative;
  z-index: 2;
}

.trend-svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

.chart-line {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: drawLine 2s ease forwards;
}

@keyframes drawLine {
  to { stroke-dashoffset: 0; }
}

.chart-dot {
  animation: dotAppear 0.5s ease both;
  transition: r 0.3s ease, opacity 0.3s ease;
  cursor: pointer;
}

.chart-dot:hover {
  r: 5;
  opacity: 1;
  filter: drop-shadow(0 0 6px currentColor);
}

@keyframes dotAppear {
  from { r: 0; opacity: 0; }
  to { r: 3.5; opacity: 1; }
}

/* 环形图 */
.donut-body {
  display: flex;
  align-items: center;
  gap: 20px;
}

.donut-svg {
  width: 160px;
  height: 160px;
  flex-shrink: 0;
}

.donut-segment {
  transform-origin: center;
  animation: donutAppear 1s ease both;
  transition: opacity 0.3s ease, stroke-width 0.3s ease;
}

.donut-segment:hover {
  opacity: 1;
  stroke-width: 24;
}

@keyframes donutAppear {
  from { stroke-dasharray: 0 440; opacity: 0; }
  to { opacity: 1; }
}

.donut-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.donut-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  font-family: 'Noto Sans SC', sans-serif;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: 8px;
  transition: background 0.3s ease, color 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
}

.donut-legend-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  transform: translateX(4px);
}

.donut-legend-item:hover .donut-legend-dot {
  transform: scale(1.3);
}

.donut-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.donut-legend-text { flex: 1; }

.donut-legend-pct {
  color: rgba(255,255,255,0.4);
  font-size: 11px;
}

/* 雷达图 */
.radar-body { 
  display: flex; 
  justify-content: center; 
  padding: 10px 0;
}

.radar-svg {
  width: 240px;
  height: 240px;
}

.radar-area {
  animation: radarFill 1.5s ease both;
  transform-origin: center;
}

@keyframes radarFill {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

.radar-dot {
  animation: radarDot 0.5s ease both;
  transition: r 0.3s ease;
  cursor: pointer;
}

.radar-dot:hover {
  r: 7;
}

.radar-glow {
  animation: radarGlow 2s ease-in-out infinite;
}

@keyframes radarGlow {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

/* 热力图 */
.heatmap-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.heatmap-stats {
  display: flex;
  gap: 16px;
}

.heatmap-stat-item {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.heatmap-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #667eea;
  font-family: 'Noto Sans SC', sans-serif;
}

.heatmap-stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Noto Sans SC', sans-serif;
}

.heatmap-month-labels {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.heatmap-month {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Noto Sans SC', sans-serif;
}

.heatmap-container {
  display: flex;
  gap: 8px;
}

.heatmap-weekdays {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heatmap-weekday {
  width: 16px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  font-family: 'Noto Sans SC', sans-serif;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(5, 1fr);
  gap: 4px;
  flex: 1;
}

.heatmap-cell {
  width: 100%;
  aspect-ratio: 1;
  min-width: 24px;
  max-width: 32px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
              box-shadow 0.3s ease,
              filter 0.3s ease;
  animation: cellPop 0.4s ease both;
  cursor: pointer;
  position: relative;
}

@keyframes cellPop {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.heatmap-cell:hover {
  transform: scale(1.2);
  box-shadow: 0 0 12px rgba(102,126,234,0.6);
  filter: brightness(1.2);
  z-index: 10;
}

.heatmap-cell-today {
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.5);
}

.heatmap-count {
  font-size: 9px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-family: 'Noto Sans SC', sans-serif;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
}

.heatmap-legend-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-family: 'Noto Sans SC', sans-serif;
}

.heatmap-scale {
  display: flex;
  gap: 3px;
}

.scale-item {
  width: 16px;
  height: 12px;
  border-radius: 2px;
}

.heatmap-scale-labels {
  display: flex;
  gap: 6px;
}

.heatmap-scale-labels span {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.35);
  font-family: 'Noto Sans SC', sans-serif;
  width: 16px;
  text-align: center;
}

/* ===== 已收藏 / 最近学习 ===== */
.records-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.records-count {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  font-family: 'Noto Sans SC', sans-serif;
}

.record-list {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

.record-list::-webkit-scrollbar {
  width: 4px;
}

.record-list::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
}

.record-list::-webkit-scrollbar-thumb {
  background: rgba(102,126,234,0.4);
  border-radius: 4px;
}

.record-empty {
  text-align: center;
  padding: 48px;
  color: rgba(255,255,255,0.35);
  font-family: 'Noto Sans SC', sans-serif;
}

.empty-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 12px;
  opacity: 0.5;
}

.record-poem-card {
  padding: 16px;
  cursor: pointer;
  position: relative;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              background 0.4s ease;
}

.record-poem-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.1) 0%,
    transparent 60%
  );
  opacity: 0;
  transition: opacity 0.4s ease;
  border-radius: inherit;
  pointer-events: none;
  z-index: 1;
}

.record-poem-card:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2),
              0 0 30px rgba(102, 126, 234, 0.1);
}

.record-poem-card:hover::before {
  opacity: 1;
}

.record-poem-card:hover .poem-card-title {
  color: #fff;
}

.record-poem-card:hover .poem-card-content {
  color: rgba(255, 255, 255, 0.65);
}

.record-liquid-shine {
  position: absolute;
  top: -100%;
  left: -100%;
  width: 300%;
  height: 300%;
  background: conic-gradient(from 180deg at 50% 50%,
    transparent 0deg,
    rgba(255,255,255,0.03) 60deg,
    transparent 120deg
  );
  animation: recordShine 6s linear infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes recordShine {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.record-poem-card:hover .record-liquid-shine {
  background: conic-gradient(from 180deg at 50% 50%,
    transparent 0deg,
    rgba(255,255,255,0.08) 60deg,
    transparent 120deg
  );
}

.poem-card-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.poem-card-title {
  font-size: 15px;
  font-weight: 700;
  color: rgba(255,255,255,0.95);
  font-family: 'Noto Serif SC', serif;
  margin: 0;
  transition: color 0.3s ease;
}

.poem-card-author {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  font-family: 'Noto Sans SC', sans-serif;
  flex-shrink: 0;
  transition: color 0.3s ease;
}

.record-poem-card:hover .poem-card-author {
  color: rgba(255, 255, 255, 0.6);
}

.poem-card-content {
  position: relative;
  z-index: 2;
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  line-height: 1.6;
  margin: 0 0 10px 0;
  font-family: 'SimSun', 'STSong', serif;
  transition: color 0.3s ease;
}

.poem-card-footer {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.poem-card-time {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  font-family: 'Noto Sans SC', sans-serif;
}

.poem-card-score {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  font-family: 'Noto Sans SC', sans-serif;
}

.poem-card-score strong {
  color: #667eea;
}

.poem-card-remove {
  padding: 4px 12px;
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.2);
  border-radius: 20px;
  color: #ff6b6b;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Sans SC', sans-serif;
}

.poem-card-remove:hover {
  background: rgba(244, 67, 54, 0.2);
  transform: scale(1.05);
}

/* ===== 响应式 ===== */
@media (max-width: 1200px) {
  .overview-grid { grid-template-columns: repeat(2, 1fr); }
  .charts-grid { grid-template-columns: 1fr 1fr; }
  .chart-card--wide { grid-column: span 2; }
  .records-grid { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 900px) {
  .charts-grid { grid-template-columns: 1fr; }
  .chart-card--wide { grid-column: span 1; }
  .user-card-inner { flex-wrap: wrap; }
  .logout-btn { margin-left: auto; }
}

@media (max-width: 600px) {
  .overview-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
  .stat-card { padding: 14px; }
  .stat-number { font-size: 20px; }
  .username { font-size: 20px; }
  .avatar-img { width: 68px; height: 68px; }
  .records-grid { grid-template-columns: 1fr; }
}
</style>
