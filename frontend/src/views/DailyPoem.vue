<template>
  <div class="daily-page">
    <div class="daily-header">
      <h1>☀️ 每日一诗</h1>
      <p class="date-display">{{ todayStr }}</p>
    </div>

    <!-- 今日推荐诗词卡片 -->
    <div class="poem-card" v-if="dailyPoem">
      <div class="poem-theme" v-if="dailyPoem.theme">
        主题：{{ dailyPoem.theme }}
      </div>
      <h2 class="poem-title">{{ dailyPoem.poem?.title }}</h2>
      <p class="poem-author">{{ dailyPoem.poem?.author }} · {{ dailyPoem.poem?.dynasty }}</p>
      <div class="poem-content">
        <p v-for="(line, i) in poemLines" :key="i">{{ line }}</p>
      </div>
      <div class="poem-tags" v-if="dailyPoem.poem?.tags">
        <span class="tag" v-for="tag in tags" :key="tag">#{{ tag }}</span>
      </div>
      <div class="poem-actions">
        <button class="btn-view" @click="viewPoem">查看详情</button>
        <button
          class="btn-checkin"
          :class="{ checked: checkinStatus.todayChecked }"
          @click="handleCheckin"
          :disabled="checkinStatus.todayChecked"
        >
          {{ checkinStatus.todayChecked ? '✓ 已打卡' : '📝 打卡学习' }}
        </button>
      </div>
    </div>

    <!-- 打卡状态 -->
    <div class="checkin-status">
      <div class="streak-card">
        <div class="streak-icon">🔥</div>
        <div class="streak-info">
          <span class="streak-count">{{ checkinStatus.streak }}</span>
          <span class="streak-label">连续打卡天数</span>
        </div>
      </div>
      <div class="total-card">
        <div class="total-icon">📅</div>
        <div class="total-info">
          <span class="total-count">{{ checkinStatus.totalDays }}</span>
          <span class="total-label">累计打卡</span>
        </div>
      </div>
    </div>

    <!-- 打卡日历 -->
    <div class="calendar-section">
      <h2>📅 本周打卡</h2>
      <div class="calendar-grid">
        <div
          v-for="day in weekDays"
          :key="day.date"
          class="calendar-day"
          :class="{ checked: isChecked(day.date), today: day.isToday }"
        >
          <span class="day-name">{{ day.dayName }}</span>
          <span class="day-date">{{ day.dayNum }}</span>
          <span class="day-status" v-if="isChecked(day.date)">✓</span>
        </div>
      </div>
    </div>

    <!-- 打卡统计 -->
    <div class="stats-section">
      <h2>📊 本月进度</h2>
      <div class="progress-card">
        <div class="progress-info">
          <span class="progress-current">{{ checkinStatus.monthlyProgress?.current || 0 }}</span>
          <span class="progress-sep">/</span>
          <span class="progress-target">{{ checkinStatus.monthlyProgress?.target || 30 }}天</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: (checkinStatus.monthlyProgress?.percentage || 0) + '%' }"
          ></div>
        </div>
        <p class="progress-tip">
          {{ checkinStatus.monthlyProgress?.remaining || 0 }}天剩余，继续加油！
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const dailyPoem = ref(null)
const checkinStatus = ref({
  streak: 0,
  totalDays: 0,
  todayChecked: false,
  monthlyProgress: { current: 0, target: 30, percentage: 0, remaining: 30 },
  recentCheckins: []
})

const today = new Date()
const todayStr = computed(() => {
  const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }
  return today.toLocaleDateString('zh-CN', options)
})

const poemLines = computed(() => {
  if (!dailyPoem.value?.poem?.content) return []
  return dailyPoem.value.poem.content.split(/[，,。.]/).filter(l => l.trim())
})

const tags = computed(() => {
  if (!dailyPoem.value?.poem?.tags) return []
  return dailyPoem.value.poem.tags.split(',').filter(t => t.trim())
})

const weekDays = computed(() => {
  const days = []
  const dayNames = ['日', '一', '二', '三', '四', '五', '六']
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    days.push({
      date: d.toISOString().split('T')[0],
      dayName: dayNames[d.getDay()],
      dayNum: d.getDate(),
      isToday: i === 0
    })
  }
  return days
})

const isChecked = (date) => {
  return checkinStatus.value.recentCheckins?.some(c => c.date === date)
}

const loadData = async () => {
  try {
    const [poemRes, checkinRes] = await Promise.all([
      api.daily.getDailyPoem().catch(() => null),
      api.daily.getCheckinStats().catch(() => null)
    ])

    if (poemRes?.data) dailyPoem.value = poemRes.data
    if (checkinRes?.data) {
      checkinStatus.value = {
        ...checkinStatus.value,
        ...checkinRes.data
      }
    }
  } catch (error) {
    console.error('加载每日数据失败:', error)
  }
}

const handleCheckin = async () => {
  try {
    const res = await api.daily.checkin(dailyPoem.value?.poem?.id)
    if (res.success) {
      checkinStatus.value.todayChecked = true
      checkinStatus.value.streak = res.data.streak
      checkinStatus.value.totalDays++
      // 刷新数据
      const statsRes = await api.daily.getCheckinStats()
      if (statsRes?.data) {
        checkinStatus.value = { ...checkinStatus.value, ...statsRes.data }
      }
    }
  } catch (error) {
    console.error('打卡失败:', error)
  }
}

const viewPoem = () => {
  if (dailyPoem.value?.poem?.id) {
    router.push(`/poem/${dailyPoem.value.poem.id}`)
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.daily-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.daily-header {
  text-align: center;
  margin-bottom: 30px;
}

.daily-header h1 {
  font-size: 32px;
  color: #8b4513;
  margin-bottom: 8px;
}

.date-display {
  color: #666;
  font-size: 16px;
}

.poem-card {
  background: linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,252,240,0.9));
  border-radius: 24px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(139,69,19,0.12);
  margin-bottom: 24px;
}

.poem-theme {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(139,69,19,0.1);
  border-radius: 20px;
  font-size: 14px;
  color: #8b4513;
  margin-bottom: 16px;
}

.poem-title {
  font-size: 36px;
  color: #2c1810;
  margin-bottom: 8px;
}

.poem-author {
  color: #666;
  font-size: 16px;
  margin-bottom: 24px;
}

.poem-content {
  margin-bottom: 24px;
}

.poem-content p {
  font-size: 22px;
  color: #333;
  line-height: 1.8;
  margin: 8px 0;
}

.poem-tags {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.tag {
  padding: 4px 12px;
  background: rgba(139,69,19,0.08);
  border-radius: 16px;
  font-size: 13px;
  color: #8b4513;
}

.poem-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.btn-view, .btn-checkin {
  padding: 12px 28px;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.btn-view {
  background: rgba(139,69,19,0.1);
  color: #8b4513;
}

.btn-view:hover { background: rgba(139,69,19,0.2); }

.btn-checkin {
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
}

.btn-checkin:hover:not(:disabled) { transform: scale(1.05); }
.btn-checkin.checked { background: #27ae60; cursor: default; }
.btn-checkin:disabled { opacity: 0.7; cursor: not-allowed; }

.checkin-status {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.streak-card, .total-card {
  background: rgba(255,255,255,0.9);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.streak-icon, .total-icon { font-size: 40px; }

.streak-info, .total-info {
  display: flex;
  flex-direction: column;
}

.streak-count, .total-count {
  font-size: 32px;
  font-weight: bold;
  color: #8b4513;
}

.streak-label, .total-label { font-size: 14px; color: #666; }

.calendar-section, .stats-section {
  background: rgba(255,255,255,0.9);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.calendar-section h2, .stats-section h2 {
  font-size: 18px;
  color: #8b4513;
  margin-bottom: 16px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
}

.calendar-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border-radius: 12px;
  background: rgba(139,69,19,0.05);
  min-height: 70px;
}

.calendar-day.checked { background: rgba(39,174,96,0.15); }
.calendar-day.today { border: 2px solid #8b4513; }

.day-name { font-size: 12px; color: #666; }
.day-date { font-size: 18px; font-weight: bold; color: #333; margin: 4px 0; }
.day-status { font-size: 16px; color: #27ae60; }

.progress-card {
  background: rgba(139,69,19,0.05);
  border-radius: 16px;
  padding: 20px;
}

.progress-info {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 12px;
}

.progress-current { font-size: 36px; font-weight: bold; color: #8b4513; }
.progress-sep { font-size: 20px; color: #999; }
.progress-target { font-size: 16px; color: #666; }

.progress-bar {
  height: 12px;
  background: rgba(139,69,19,0.15);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  border-radius: 6px;
  transition: width 0.8s ease;
}

.progress-tip { font-size: 14px; color: #666; text-align: center; margin: 0; }
</style>
