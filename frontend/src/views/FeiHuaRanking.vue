<template>
  <div class="ranking-page" :class="{ 'bg-loaded': bgLoaded }">
    <!-- 背景效果 -->
    <div class="ranking-bg">
      <div class="bg-gradient"></div>
      <div class="bg-particles">
        <span v-for="n in 25" :key="n" class="particle" :style="getParticleStyle(n)"></span>
      </div>
      <div class="floating-petals">
        <span v-for="i in 12" :key="i" class="petal" :style="getPetalStyle(i)">🌸</span>
      </div>
      <div class="floating-chars">
        <span v-for="(char, i) in floatingChars" :key="i" class="float-char" :style="char.style">{{ char.text }}</span>
      </div>
    </div>

    <!-- 主容器 -->
    <div class="ranking-container">

      <!-- ===== 顶部标题区 ===== -->
      <div class="hero-section">
        <div class="hero-badge">
          <span class="badge-star">✦</span>
          <span class="badge-text">飞花令</span>
          <span class="badge-star">✦</span>
        </div>
        <h1 class="hero-title">
          <span class="title-cn">排位赛</span>
          <span class="title-en">RANKED MATCH</span>
        </h1>
        <p class="hero-subtitle">以诗会友，飞花传韵，段位证实力</p>
      </div>

      <!-- ===== 加载状态 ===== -->
      <div v-if="loading" class="loading-section">
        <div class="loading-spinner-large"></div>
        <p>加载排位数据中...</p>
      </div>

      <!-- ===== 主内容区 ===== -->
      <div v-else class="main-content">

        <!-- 左侧：个人排位信息 -->
        <div class="left-column">

          <!-- 段位卡片 -->
          <div class="rank-card ios26-card" v-if="myRank">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="card-content">
              <!-- 段位图标区 -->
              <div class="rank-emblem">
                <div class="emblem-ring" :style="{ borderColor: myRank.rank_level_info?.color }">
                  <span class="emblem-icon">{{ myRank.rank_level_info?.icon || '🥉' }}</span>
                </div>
                <div class="emblem-glow" :style="{ background: `radial-gradient(circle, ${myRank.rank_level_info?.color}33, transparent 70%)` }"></div>
              </div>

              <!-- 段位名称 -->
              <div class="rank-title-wrap">
                <h2 class="rank-title" :style="{ color: myRank.rank_level_info?.color }">
                  {{ myRank.rank_level }}
                </h2>
                <div class="rank-tier-badge">
                  <span class="tier-icon">{{ getTierIcon(myRank.rank_level) }}</span>
                  <span>{{ getTierName(myRank.rank_level) }}</span>
                </div>
              </div>

              <!-- 积分信息 -->
              <div class="rating-section">
                <div class="rating-display">
                  <span class="rating-value">{{ myRank.rating ?? 0 }}</span>
                  <span class="rating-label">排位积分</span>
                </div>
                <div class="rating-bar-wrap">
                  <div class="rating-bar-bg">
                    <div
                      class="rating-bar-fill"
                      :style="{ width: getProgressPercent() + '%', background: getProgressGradient() }"
                    ></div>
                  </div>
                  <div class="rating-bar-labels">
                    <span>{{ myRank.rating ?? 0 }} 分</span>
                    <span>{{ getNextLevelMin() }} 分升阶</span>
                  </div>
                </div>
              </div>

              <!-- 战绩统计 -->
              <div class="stats-grid">
                <div class="stat-card win">
                  <span class="stat-icon">✓</span>
                  <span class="stat-num">{{ myRank.wins ?? 0 }}</span>
                  <span class="stat-lbl">胜场</span>
                </div>
                <div class="stat-card lose">
                  <span class="stat-icon">✗</span>
                  <span class="stat-num">{{ myRank.losses ?? 0 }}</span>
                  <span class="stat-lbl">负场</span>
                </div>
                <div class="stat-card streak">
                  <span class="stat-icon">🔥</span>
                  <span class="stat-num">{{ myRank.current_streak ?? 0 }}</span>
                  <span class="stat-lbl">连胜</span>
                </div>
                <div class="stat-card rank">
                  <span class="stat-icon">🏆</span>
                  <span class="stat-num">{{ myRank.rank ?? '--' }}</span>
                  <span class="stat-lbl">全服排名</span>
                </div>
              </div>

              <!-- 段位保护提示 -->
              <div class="protection-hint" v-if="isAtRisk()">
                <span class="hint-icon">⚠️</span>
                <span>积分过低，失败将降段！</span>
              </div>
            </div>
          </div>

          <!-- 未开始排位的提示 -->
          <div v-else class="no-rank-card ios26-card">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="card-content">
              <div class="no-rank-icon">🌱</div>
              <h3>尚未开始排位</h3>
              <p>开始你的第一场排位赛，踏上诗词高手之路！</p>
            </div>
          </div>

          <!-- 开始排位按钮 -->
          <button class="btn-start-ranking ios26-btn primary-btn" @click="startRanking">
            <span class="btn-icon">⚔️</span>
            <span>开始排位赛</span>
          </button>

          <!-- 说明提示 -->
          <div class="info-tips">
            <div class="tip-item">
              <span class="tip-icon">📌</span>
              <span><strong>计分规则：</strong>仅排位赛计入积分，普通对战不计入</span>
            </div>
            <div class="tip-item">
              <span class="tip-icon">🏆</span>
              <span><strong>连胜加成：</strong>连胜3场额外+10分，5场+20分</span>
            </div>
          </div>
        </div>

        <!-- 右侧：段位一览 + 排行榜 -->
        <div class="right-column">

          <!-- 段位阶梯展示 -->
          <div class="levels-card ios26-card">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="card-content">
              <div class="section-header">
                <span class="section-icon">📜</span>
                <h3 class="section-title">段位一览</h3>
              </div>
              <div class="levels-list">
                <div
                  v-for="(level, index) in RANK_LEVELS"
                  :key="level.name"
                  class="level-item"
                  :class="{
                    'current': isCurrentLevel(level.name),
                    'passed': isPassedLevel(level.name),
                    'next': isNextLevel(level.name)
                  }"
                  :style="{ '--level-color': level.color }"
                >
                  <div class="level-connector" v-if="index > 0"></div>
                  <div class="level-icon-wrap">
                    <span class="level-icon">{{ level.icon }}</span>
                    <div class="level-glow"></div>
                  </div>
                  <div class="level-info">
                    <span class="level-name">{{ level.name }}</span>
                    <span class="level-range">{{ level.min }}+</span>
                  </div>
                  <div class="level-status" v-if="isCurrentLevel(level.name)">
                    <span class="status-tag current-tag">当前</span>
                  </div>
                  <div class="level-status" v-else-if="isPassedLevel(level.name)">
                    <span class="status-tag passed-tag">已达成</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 排行榜 -->
          <div class="leaderboard-card ios26-card">
            <div class="card-liquid-border"></div>
            <div class="card-liquid-shine"></div>
            <div class="card-content">
              <div class="section-header">
                <span class="section-icon">🏆</span>
                <h3 class="section-title">排行榜</h3>
                <div class="leaderboard-tabs">
                  <button
                    :class="{ active: activeTab === 'all' }"
                    @click="activeTab = 'all'"
                  >全部</button>
                  <button
                    :class="{ active: activeTab === 'same' }"
                    @click="activeTab = 'same'"
                  >同段位</button>
                </div>
              </div>

              <!-- 排行榜列表 -->
              <div class="leaderboard-list" v-if="filteredLeaderboard.length > 0">
                <div
                  v-for="(item, index) in filteredLeaderboard"
                  :key="item.user_id || index"
                  class="leaderboard-item"
                  :class="{
                    'top-3': index < 3,
                    'me': item.user_id === myRank?.user_id
                  }"
                  :style="{ '--item-color': item.rank_level_info?.color }"
                >
                  <span class="rank-position">
                    <span v-if="index === 0" class="medal gold">🥇</span>
                    <span v-else-if="index === 1" class="medal silver">🥈</span>
                    <span v-else-if="index === 2" class="medal bronze">🥉</span>
                    <span v-else class="rank-num">{{ index + 1 }}</span>
                  </span>
                  <div class="player-avatar" :style="{ background: getAvatarGradient(item) }">
                    {{ (item.username || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="player-info">
                    <span class="player-name">
                      {{ item.username }}
                      <span v-if="item.user_id === myRank?.user_id" class="me-tag">我</span>
                    </span>
                    <span class="player-level" :style="{ color: item.rank_level_info?.color }">
                      {{ item.rank_level || '青铜' }}
                    </span>
                  </div>
                  <div class="player-rating">
                    <span class="rating-num">{{ item.rating ?? 0 }}</span>
                    <span class="rating-unit">分</span>
                  </div>
                </div>
              </div>

              <!-- 空状态 -->
              <div class="empty-leaderboard" v-else>
                <span class="empty-icon">📭</span>
                <p>暂无排行数据</p>
                <p class="empty-hint">快去参加比赛吧！</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast通知 -->
      <transition name="toast-slide">
        <div v-if="toast.show" class="toast" :class="toast.type">
          <span class="toast-icon">{{ toastIcon }}</span>
          <span class="toast-text">{{ toast.message }}</span>
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

export default {
  name: 'FeiHuaRanking',
  setup() {
    const router = useRouter()
    const myRank = ref(null)
    const leaderboard = ref([])
    const loading = ref(true)
    const activeTab = ref('all')
    const bgLoaded = ref(false)

    const RANK_LEVELS = [
      { name: '青铜', min: 0, color: '#cd7f32', icon: '🥉' },
      { name: '白银', min: 1100, color: '#c0c0c0', icon: '🥈' },
      { name: '黄金', min: 1300, color: '#ffd700', icon: '🥇' },
      { name: '铂金', min: 1500, color: '#e5e4e2', icon: '💎' },
      { name: '钻石', min: 1700, color: '#b9f2ff', icon: '💠' },
      { name: '大师', min: 1900, color: '#9932cc', icon: '🏆' },
      { name: '宗师', min: 2100, color: '#ff4500', icon: '👑' },
      { name: '王者', min: 2300, color: '#ff0000', icon: '🌟' }
    ]

    // Toast
    const toast = ref({ show: false, message: '', type: 'info' })
    let toastTimer = null
    const showToast = (message, type = 'info') => {
      toast.value = { show: true, message, type }
      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => { toast.value.show = false }, 3000)
    }
    const toastIcon = computed(() => {
      const icons = { success: '✓', error: '✗', info: '💡', warning: '⚠' }
      return icons[toast.value.type] || icons.info
    })

    const filteredLeaderboard = computed(() => {
      if (activeTab.value === 'all') return leaderboard.value
      if (!myRank.value?.rank_level) return leaderboard.value
      return leaderboard.value.filter(item => item.rank_level === myRank.value.rank_level)
    })

    // 计算当前段位在列表中的索引
    const currentLevelIndex = computed(() => {
      if (!myRank.value?.rank_level) return -1
      return RANK_LEVELS.findIndex(l => l.name === myRank.value.rank_level)
    })

    const isCurrentLevel = (levelName) => myRank.value?.rank_level === levelName
    const isPassedLevel = (levelName) => {
      const idx = RANK_LEVELS.findIndex(l => l.name === levelName)
      return idx < currentLevelIndex.value
    }
    const isNextLevel = (levelName) => {
      const idx = RANK_LEVELS.findIndex(l => l.name === levelName)
      return idx === currentLevelIndex.value + 1
    }

    const getNextLevelMin = () => {
      const idx = RANK_LEVELS.findIndex(l => l.name === myRank.value?.rank_level)
      if (idx < 0 || idx >= RANK_LEVELS.length - 1) return '已满级'
      return RANK_LEVELS[idx + 1].min
    }

    const getProgressPercent = () => {
      const idx = RANK_LEVELS.findIndex(l => l.name === myRank.value?.rank_level)
      if (idx < 0) return 0
      const currentMin = RANK_LEVELS[idx].min
      const nextMin = idx < RANK_LEVELS.length - 1 ? RANK_LEVELS[idx + 1].min : currentMin + 1000
      const rating = myRank.value?.rating ?? 0
      if (rating >= nextMin) return 100
      return Math.min(100, Math.max(0, ((rating - currentMin) / (nextMin - currentMin)) * 100))
    }

    const getProgressGradient = () => {
      const level = myRank.value?.rank_level_info
      return level ? `linear-gradient(90deg, ${level.color}88, ${level.color})` : 'linear-gradient(90deg, #ffd70088, #ffd700)'
    }

    const isAtRisk = () => {
      if (!myRank.value?.rank_level) return false
      const rating = myRank.value?.rating ?? 0
      const currentMin = RANK_LEVELS.find(l => l.name === myRank.value.rank_level)?.min ?? 0
      return rating - currentMin < 50
    }

    const getTierIcon = (level) => {
      const icons = {
        '青铜': '🌱', '白银': '✨', '黄金': '🌟', '铂金': '💎',
        '钻石': '💠', '大师': '🏆', '宗师': '👑', '王者': '🌟'
      }
      return icons[level] || '🌱'
    }

    const getTierName = (level) => {
      const names = {
        '青铜': '初出茅庐', '白银': '小有名气', '黄金': '崭露头角',
        '铂金': '身手不凡', '钻石': '诗词高手', '大师': '诗词大师',
        '宗师': '一代宗师', '王者': '诗坛王者'
      }
      return names[level] || ''
    }

    const getAvatarGradient = (item) => {
      const color = item.rank_level_info?.color || '#a855f7'
      return `linear-gradient(135deg, ${color}, ${color}88)`
    }

    // 背景装饰
    const floatingChars = ref([])
    const chars = ['诗', '词', '风', '月', '云', '山', '水', '花', '春', '秋', '雨', '雪', '鸟', '酒', '鹤', '松']

    const getPetalStyle = (i) => ({
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 10}s`,
      animationDuration: `${8 + Math.random() * 8}s`,
      fontSize: `${10 + Math.random() * 12}px`,
      opacity: 0.15 + Math.random() * 0.25
    })

    const getParticleStyle = (n) => {
      const random = (min, max) => Math.random() * (max - min) + min
      return {
        left: random(0, 100) + '%',
        top: random(0, 100) + '%',
        animationDelay: random(0, 8) + 's',
        animationDuration: random(6, 16) + 's',
        width: random(3, 8) + 'px',
        height: random(3, 8) + 'px',
        opacity: random(0.08, 0.35),
      }
    }

    const initFloatingChars = () => {
      for (let i = 0; i < 12; i++) {
        floatingChars.value.push({
          text: chars[Math.floor(Math.random() * chars.length)],
          style: {
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            fontSize: `${12 + Math.random() * 16}px`,
            opacity: 0.03 + Math.random() * 0.05,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${15 + Math.random() * 15}s`
          }
        })
      }
    }

    // 卡片悬浮效果
    const handleCardMouseMove = (e) => {
      const card = e.currentTarget
      if (!card) return
      const rect = card.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      card.style.setProperty('--mouse-x', `${x}%`)
      card.style.setProperty('--mouse-y', `${y}%`)
    }

    const setupCardHover = () => {
      document.querySelectorAll('.ios26-card').forEach(card => {
        card.addEventListener('mousemove', handleCardMouseMove)
      })
    }

    const cleanupCardHover = () => {
      document.querySelectorAll('.ios26-card').forEach(card => {
        card.removeEventListener('mousemove', handleCardMouseMove)
      })
    }

    const loadData = async () => {
      loading.value = true
      try {
        const [rankRes, leaderboardRes] = await Promise.all([
          api.feihuaRanking.getMe().catch(() => null),
          api.feihuaRanking.getLeaderboard(50).catch(() => null)
        ])

        if (rankRes?.data) {
          myRank.value = {
            ...rankRes.data,
            rank_level_info: RANK_LEVELS.find(l => l.name === rankRes.data.rank_level) || RANK_LEVELS[0]
          }
        }

        if (leaderboardRes?.data) {
          leaderboard.value = (Array.isArray(leaderboardRes.data) ? leaderboardRes.data : []).map(item => ({
            ...item,
            rank_level_info: RANK_LEVELS.find(l => l.name === item.rank_level) || RANK_LEVELS[0]
          }))
        }
      } catch (error) {
        console.error('加载排位数据失败:', error)
        showToast('加载失败，请刷新重试', 'error')
      } finally {
        loading.value = false
        setTimeout(() => setupCardHover(), 100)
      }
    }

    const startRanking = () => {
      sessionStorage.setItem('feihua_ranking_mode', 'true')
      router.push('/feihualing/online')
    }

    onMounted(() => {
      bgLoaded.value = true
      initFloatingChars()
      loadData()
    })

    onUnmounted(() => {
      cleanupCardHover()
      if (toastTimer) clearTimeout(toastTimer)
    })

    return {
      bgLoaded,
      myRank,
      leaderboard,
      loading,
      RANK_LEVELS,
      activeTab,
      filteredLeaderboard,
      toast,
      toastIcon,
      floatingChars,
      getPetalStyle,
      getParticleStyle,
      isCurrentLevel,
      isPassedLevel,
      isNextLevel,
      getNextLevelMin,
      getProgressPercent,
      getProgressGradient,
      isAtRisk,
      getTierIcon,
      getTierName,
      getAvatarGradient,
      startRanking
    }
  }
}
</script>

<style scoped>
/* ===== iOS26 液态玻璃核心样式 ===== */
:root {
  --glass-bg: rgba(255, 255, 255, 0.08);
  --glass-bg-hover: rgba(255, 255, 255, 0.13);
  --glass-border: rgba(255, 255, 255, 0.15);
  --glass-border-hover: rgba(255, 255, 255, 0.28);
  --glass-blur: 24px;
  --glass-shadow: 0 8px 40px rgba(0, 0, 0, 0.25), 0 2px 12px rgba(0, 0, 0, 0.15);
  --glass-shadow-hover: 0 16px 60px rgba(0, 0, 0, 0.35), 0 4px 20px rgba(0, 0, 0, 0.2);
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
  background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, transparent 100%);
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
  background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    rgba(255,255,255,0.35) 0%,
    rgba(255,255,255,0.15) 15%,
    rgba(168,85,247,0.1) 25%,
    transparent 35%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
  z-index: 4;
  mix-blend-mode: overlay;
}

.ios26-card:hover {
  transform: translateY(-8px) scale(1.02);
  background: var(--glass-bg-hover);
  box-shadow: var(--glass-shadow-hover), 0 0 40px rgba(168,85,247,0.15);
  border-color: var(--glass-border-hover);
}

.ios26-card:hover::before { opacity: 1; }
.ios26-card:hover::after { opacity: 1; }
.ios26-card:hover .card-liquid-shine { animation-duration: 3s; }

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
  background: conic-gradient(from 0deg at 50% 50%,
    transparent 0deg, rgba(255,255,255,0.04) 60deg,
    transparent 120deg, rgba(255,255,255,0.03) 180deg,
    transparent 240deg, rgba(255,255,255,0.04) 300deg,
    transparent 360deg);
  animation: liquidShimmer 8s linear infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes liquidShimmer {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== 通用按钮 ===== */
.ios26-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 28px;
  border-radius: 50px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  backdrop-filter: blur(12px);
  font-family: 'Noto Serif SC', serif;
  overflow: hidden;
}

.ios26-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.ios26-btn:hover::before { opacity: 1; }
.ios26-btn:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3); }

.ios26-btn.primary-btn {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.6), rgba(139, 92, 246, 0.6));
  border-color: rgba(168, 85, 247, 0.5);
  color: white;
  box-shadow: 0 4px 20px rgba(168, 85, 247, 0.3);
}
.ios26-btn.primary-btn:hover {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(139, 92, 246, 0.8));
  box-shadow: 0 8px 30px rgba(168, 85, 247, 0.5);
}

.btn-icon { font-size: 18px; z-index: 1; }

/* ===== 页面基础 ===== */
.ranking-page {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100vw;
  min-width: 100vw;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-x: hidden;
  overflow-y: auto;
  background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2a 50%, #0a1a2a 100%);
  z-index: 999;
}

/* ===== 背景效果 ===== */
.ranking-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(ellipse at 20% 20%, rgba(168, 85, 247, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(236, 72, 153, 0.08) 0%, transparent 60%);
}

.bg-particles {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.particle {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(200,180,255,0.4), transparent);
  animation: floatParticle linear infinite;
}

@keyframes floatParticle {
  0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
  10% { opacity: 1; }
  50% { transform: translateY(-30vh) translateX(15vw) scale(1.3); opacity: 0.6; }
  90% { opacity: 0.3; }
  100% { transform: translateY(-60vh) translateX(-10vw) scale(0.8); opacity: 0; }
}

.floating-petals {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.petal {
  position: absolute;
  animation: petalFall linear infinite;
}

@keyframes petalFall {
  0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
}

.floating-chars {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.float-char {
  position: absolute;
  font-family: 'SimSun', 'STSong', serif;
  color: #f0d78c;
  animation: floatChar linear infinite;
}

@keyframes floatChar {
  0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.03; }
  50% { transform: translateY(-30px) rotate(10deg); opacity: 0.06; }
}

/* ===== 主容器 ===== */
.ranking-container {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: min(96vw, 1400px);
  min-height: 100vh;
  margin: 0 auto;
  padding: calc(var(--app-sticky-nav-offset, 124px) + 20px) clamp(16px, 3vw, 40px) 60px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  box-sizing: border-box;
}

/* ===== 标题区 ===== */
.hero-section {
  text-align: center;
  padding: 20px 0;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 8px 24px;
  background: rgba(168, 85, 247, 0.2);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 50px;
  margin-bottom: 16px;
  animation: badgePulse 2s ease-in-out infinite;
}

@keyframes badgePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
  50% { box-shadow: 0 0 0 10px rgba(168, 85, 247, 0); }
}

.badge-star { color: #a855f7; font-size: 14px; }
.badge-text {
  color: #a855f7;
  font-size: 13px;
  letter-spacing: 4px;
  text-transform: uppercase;
}

.hero-title { margin: 0 0 12px; }

.title-cn {
  display: block;
  font-family: 'ZCOOL XiaoWei', 'Noto Serif SC', serif;
  font-size: 48px;
  font-weight: 700;
  background: linear-gradient(135deg, #f4d03f 0%, #fff 50%, #f4d03f 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: titleShine 3s linear infinite;
  letter-spacing: 12px;
}

@keyframes titleShine {
  to { background-position: 200% center; }
}

.title-en {
  display: block;
  font-size: 13px;
  color: rgba(168, 85, 247, 0.6);
  letter-spacing: 8px;
  margin-top: 8px;
  font-weight: 400;
}

.hero-subtitle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
  margin: 0;
}

/* ===== 加载状态 ===== */
.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px;
  gap: 20px;
  color: rgba(255, 255, 255, 0.6);
}

.loading-spinner-large {
  width: 56px;
  height: 56px;
  border: 4px solid rgba(168, 85, 247, 0.2);
  border-top-color: #a855f7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ===== 主内容布局 ===== */
.main-content {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 28px;
  align-items: start;
}

@media (max-width: 1024px) {
  .main-content { grid-template-columns: 1fr; }
}

/* ===== 左侧栏 ===== */
.left-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 段位卡片 */
.rank-card { padding: 32px 28px; }
.rank-card .card-content { position: relative; z-index: 2; }

.rank-emblem {
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto 20px;
}

.emblem-ring {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 4px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.3);
  animation: emblemPulse 2s ease-in-out infinite;
}

@keyframes emblemPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(168,85,247,0.3); }
  50% { box-shadow: 0 0 40px rgba(168,85,247,0.5); }
}

.emblem-icon { font-size: 44px; }

.emblem-glow {
  position: absolute;
  inset: -16px;
  border-radius: 50%;
  pointer-events: none;
}

.rank-title-wrap {
  text-align: center;
  margin-bottom: 24px;
}

.rank-title {
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 6px;
  text-shadow: 0 0 20px currentColor;
}

.rank-tier-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 16px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 20px;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
}

.tier-icon { font-size: 14px; }

/* 积分条 */
.rating-section { margin-bottom: 24px; }

.rating-display {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
  justify-content: center;
}

.rating-value {
  font-size: 44px;
  font-weight: 800;
  color: #f4d03f;
  line-height: 1;
}

.rating-label {
  font-size: 14px;
  color: rgba(255,255,255,0.5);
}

.rating-bar-wrap { display: flex; flex-direction: column; gap: 4px; }

.rating-bar-bg {
  height: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 8px;
  overflow: hidden;
}

.rating-bar-fill {
  height: 100%;
  border-radius: 8px;
  transition: width 1s ease;
}

.rating-bar-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255,255,255,0.4);
}

/* 战绩统计 */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 10px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
}

.stat-icon { font-size: 18px; }
.stat-num { font-size: 22px; font-weight: 800; color: white; line-height: 1; }
.stat-lbl { font-size: 11px; color: rgba(255,255,255,0.4); }

.stat-card.win .stat-num { color: #4ade80; }
.stat-card.lose .stat-num { color: #f87171; }
.stat-card.streak .stat-icon { animation: fireGlow 1s ease-in-out infinite alternate; }

@keyframes fireGlow {
  from { transform: scale(1); }
  to { transform: scale(1.2); }
}

/* 段位保护提示 */
.protection-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 12px;
  font-size: 13px;
  color: #fbbf24;
}

.hint-icon { font-size: 16px; }

/* 无排位时的卡片 */
.no-rank-card { padding: 48px 32px; text-align: center; }
.no-rank-card .card-content { position: relative; z-index: 2; }
.no-rank-icon { font-size: 56px; margin-bottom: 16px; }
.no-rank-card h3 {
  font-family: 'ZCOOL XiaoWei', serif;
  font-size: 22px;
  color: white;
  margin: 0 0 12px;
}
.no-rank-card p {
  font-size: 14px;
  color: rgba(255,255,255,0.5);
  margin: 0;
  line-height: 1.6;
}

/* 开始排位按钮 */
.btn-start-ranking {
  width: 100%;
  padding: 18px;
  font-size: 18px;
  border-radius: 20px;
}

.btn-start-ranking:hover { transform: translateY(-4px) scale(1.02); }

/* 说明提示 */
.info-tips {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tip-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  line-height: 1.5;
}

.tip-icon { font-size: 16px; flex-shrink: 0; }
.tip-item strong { color: rgba(255,255,255,0.8); font-weight: 600; }

/* ===== 右侧栏 ===== */
.right-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 段位一览 */
.levels-card { padding: 28px; }
.levels-card .card-content { position: relative; z-index: 2; }

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.section-icon { font-size: 20px; }

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: rgba(255,255,255,0.9);
  margin: 0;
  font-family: 'Noto Serif SC', serif;
}

.levels-list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

@media (max-width: 640px) {
  .levels-list { grid-template-columns: repeat(2, 1fr); }
}

.level-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.level-item.current {
  border-color: var(--level-color);
  background: rgba(255,255,255,0.08);
  box-shadow: 0 0 20px rgba(168,85,247,0.2);
}

.level-item.passed {
  opacity: 0.7;
}

.level-connector {
  display: none;
}

.level-icon-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.level-icon { font-size: 32px; position: relative; z-index: 1; }

.level-glow {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--level-color, rgba(168,85,247,0.3)), transparent 70%);
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.level-item.current .level-glow { opacity: 1; animation: levelGlow 2s ease-in-out infinite; }

@keyframes levelGlow {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
}

.level-info { text-align: center; }
.level-name {
  display: block;
  font-size: 14px;
  font-weight: 700;
  color: white;
  margin-bottom: 2px;
}
.level-range { font-size: 11px; color: rgba(255,255,255,0.4); }

.level-status { margin-top: 4px; }

.status-tag {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.status-tag.current-tag {
  background: rgba(168,85,247,0.3);
  color: #a855f7;
  border: 1px solid rgba(168,85,247,0.4);
}

.status-tag.passed-tag {
  background: rgba(74,222,128,0.2);
  color: #4ade80;
  border: 1px solid rgba(74,222,128,0.3);
}

/* 排行榜 */
.leaderboard-card { padding: 28px; }
.leaderboard-card .card-content { position: relative; z-index: 2; }

.leaderboard-tabs {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.leaderboard-tabs button {
  padding: 6px 16px;
  border: none;
  border-radius: 20px;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.6);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Noto Serif SC', serif;
}

.leaderboard-tabs button.active {
  background: rgba(168,85,247,0.4);
  color: white;
  font-weight: 600;
}

.leaderboard-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 4px;
}

.leaderboard-list::-webkit-scrollbar { width: 4px; }
.leaderboard-list::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 4px; }
.leaderboard-list::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.4); border-radius: 4px; }

.leaderboard-item {
  display: grid;
  grid-template-columns: 44px 40px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  transition: all 0.2s;
}

.leaderboard-item:hover {
  background: rgba(255,255,255,0.08);
}

.leaderboard-item.top-3 {
  background: rgba(255,215,0,0.06);
  border-color: rgba(255,215,0,0.15);
}

.leaderboard-item.me {
  background: rgba(168,85,247,0.12);
  border-color: rgba(168,85,247,0.3);
}

.rank-position {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.medal { font-size: 22px; }
.rank-num { font-size: 16px; color: rgba(255,255,255,0.5); font-weight: 600; }

.player-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  color: white;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.player-name {
  font-size: 15px;
  font-weight: 600;
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.me-tag {
  padding: 1px 8px;
  background: rgba(168,85,247,0.3);
  color: #c084fc;
  border-radius: 10px;
  font-size: 11px;
  flex-shrink: 0;
}

.player-level { font-size: 12px; font-weight: 600; }

.player-rating {
  display: flex;
  align-items: baseline;
  gap: 3px;
  text-align: right;
}

.rating-num { font-size: 18px; font-weight: 800; color: #f4d03f; }
.rating-unit { font-size: 11px; color: rgba(255,255,255,0.4); }

/* 空状态 */
.empty-leaderboard {
  text-align: center;
  padding: 48px;
  color: rgba(255,255,255,0.3);
}

.empty-icon { font-size: 40px; display: block; margin-bottom: 12px; }
.empty-leaderboard p { margin: 0 0 8px; font-size: 15px; }
.empty-hint { font-size: 13px; }

/* ===== Toast通知 ===== */
.toast {
  position: fixed;
  top: calc(var(--app-sticky-nav-offset, 124px) + 12px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10050;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  border-radius: 50px;
  backdrop-filter: blur(20px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  font-size: 15px;
  font-weight: 600;
  font-family: 'Noto Sans SC', sans-serif;
  animation: toastAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes toastAppear {
  from { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
  to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

.toast.success {
  background: rgba(74, 222, 128, 0.2);
  border: 1px solid rgba(74, 222, 128, 0.4);
  color: #4ade80;
}
.toast.error {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #f87171;
}
.toast.info {
  background: rgba(168, 85, 247, 0.2);
  border: 1px solid rgba(168, 85, 247, 0.4);
  color: #a855f7;
}
.toast.warning {
  background: rgba(251, 191, 36, 0.2);
  border: 1px solid rgba(251, 191, 36, 0.4);
  color: #fbbf24;
}

.toast-icon { font-size: 18px; }

.toast-slide-enter-active { animation: toastEnter 0.4s ease; }
.toast-slide-leave-active { animation: toastLeave 0.3s ease; }

@keyframes toastEnter {
  from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes toastLeave {
  from { opacity: 1; transform: translateX(-50%) translateY(0); }
  to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
}

/* ===== 响应式 ===== */
@media (max-width: 768px) {
  .title-cn { font-size: 36px; letter-spacing: 6px; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .rank-card, .levels-card, .leaderboard-card { padding: 20px; }
  .btn-start-ranking { font-size: 16px; padding: 16px; }
}

@media (max-width: 480px) {
  .title-cn { font-size: 28px; letter-spacing: 4px; }
  .title-en { letter-spacing: 4px; }
}
</style>
