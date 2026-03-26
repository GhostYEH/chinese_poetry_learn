<template>
  <div class="feihua-ranking-page">
    <div class="ranking-header">
      <h1>🏆 飞花令排位赛</h1>
      <p class="subtitle">在线对战，提升段位，证明实力</p>
    </div>

    <!-- 段位信息 -->
    <div class="rank-card" v-if="myRank">
      <div class="rank-badge" :style="{ borderColor: myRank.rank_level_info?.color }">
        <span class="rank-icon">{{ myRank.rank_level_info?.icon || '🥉' }}</span>
        <span class="rank-name">{{ myRank.rank_level }}</span>
      </div>
      <div class="rank-details">
        <div class="rating-info">
          <span class="rating-value">{{ myRank.rating }}</span>
          <span class="rating-label">积分</span>
        </div>
        <div class="rank-stats">
          <span>胜 {{ myRank.wins }}</span>
          <span>负 {{ myRank.losses }}</span>
          <span>连胜 {{ myRank.current_streak }}</span>
        </div>
        <div class="rank-position" v-if="myRank.rank">
          全服排名 #{{ myRank.rank }}
        </div>
      </div>
    </div>

    <!-- 段位等级展示 -->
    <div class="levels-display">
      <h2>段位一览</h2>
      <div class="levels-scroll">
        <div
          v-for="level in RANK_LEVELS"
          :key="level.name"
          class="level-item"
          :class="{ current: myRank?.rank_level === level.name }"
          :style="{ '--level-color': level.color }"
        >
          <span class="level-icon">{{ level.icon }}</span>
          <span class="level-name">{{ level.name }}</span>
          <span class="level-range">{{ level.min }}+</span>
        </div>
      </div>
    </div>

    <!-- 排行榜 -->
    <div class="leaderboard-section">
      <h2>📜 排行榜</h2>
      <div class="leaderboard-tabs">
        <button
          :class="{ active: activeTab === 'all' }"
          @click="activeTab = 'all'"
        >全部</button>
        <button
          :class="{ active: activeTab === myRank?.rank_level }"
          @click="activeTab = myRank?.rank_level || 'all'"
        >同段位</button>
      </div>
      <div class="leaderboard-list">
        <div
          v-for="(item, index) in filteredLeaderboard"
          :key="item.user_id"
          class="leaderboard-item"
          :class="{ 'top-3': index < 3, 'me': item.user_id === myRank?.user_id }"
        >
          <span class="rank-num">
            <span v-if="index === 0">🥇</span>
            <span v-else-if="index === 1">🥈</span>
            <span v-else-if="index === 2">🥉</span>
            <span v-else>{{ index + 1 }}</span>
          </span>
          <span class="rank-badge-small" :style="{ background: item.rank_level_info?.color }">
            {{ item.rank_level_info?.icon }}
          </span>
          <span class="rank-username">{{ item.username }}</span>
          <span class="rank-rating">{{ item.rating }}</span>
        </div>
        <div class="empty-list" v-if="filteredLeaderboard.length === 0">
          <p>暂无排行数据</p>
          <p class="tip">快去参加比赛吧！</p>
        </div>
      </div>
    </div>

    <!-- 去对战按钮 -->
    <button class="btn-start-match" @click="goToBattle">
      ⚔️ 开始对战
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const myRank = ref(null)
const leaderboard = ref([])
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
const activeTab = ref('all')

const filteredLeaderboard = computed(() => {
  if (activeTab.value === 'all') return leaderboard.value
  return leaderboard.value.filter(item => item.rank_level === activeTab.value)
})

const loadData = async () => {
  try {
    const [rankRes, leaderboardRes] = await Promise.all([
      api.feihuaRanking.getMe().catch(() => null),
      api.feihuaRanking.getLeaderboard(50).catch(() => null)
    ])

    if (rankRes?.data) {
      myRank.value = rankRes.data
    }

    if (leaderboardRes?.data) {
      leaderboard.value = leaderboardRes.data.map(item => ({
        ...item,
        rank_level_info: RANK_LEVELS.find(l => l.name === item.rank_level) || RANK_LEVELS[0]
      }))
    }
  } catch (error) {
    console.error('加载排位数据失败:', error)
  }
}

const goToBattle = () => {
  router.push('/feihualing/online')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.feihua-ranking-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.ranking-header {
  text-align: center;
  margin-bottom: 30px;
}

.ranking-header h1 { font-size: 32px; color: #8b4513; margin-bottom: 8px; }
.subtitle { color: #666; }

.rank-card {
  background: linear-gradient(135deg, rgba(139,69,19,0.15), rgba(205,133,63,0.1));
  border-radius: 24px;
  padding: 30px;
  display: flex;
  gap: 30px;
  align-items: center;
  margin-bottom: 24px;
}

.rank-badge {
  width: 120px;
  height: 120px;
  border: 4px solid;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.8);
}

.rank-icon { font-size: 40px; }
.rank-name { font-size: 18px; font-weight: bold; color: #8b4513; }

.rank-details { flex: 1; }

.rating-info { margin-bottom: 12px; }
.rating-value { font-size: 40px; font-weight: bold; color: #8b4513; }
.rating-label { font-size: 14px; color: #666; margin-left: 8px; }

.rank-stats {
  display: flex;
  gap: 20px;
  font-size: 16px;
  color: #666;
  margin-bottom: 8px;
}

.rank-position { font-size: 14px; color: #8b4513; font-weight: bold; }

.levels-display h2,
.leaderboard-section h2 {
  font-size: 18px;
  color: #8b4513;
  margin-bottom: 16px;
}

.levels-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 16px 0;
  margin-bottom: 24px;
}

.level-item {
  flex-shrink: 0;
  width: 80px;
  padding: 12px 8px;
  background: rgba(255,255,255,0.8);
  border-radius: 12px;
  text-align: center;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.level-item.current {
  border-color: var(--level-color);
  background: rgba(255,255,255,0.95);
}

.level-icon { font-size: 28px; display: block; }
.level-name { font-size: 13px; font-weight: bold; color: #8b4513; display: block; margin: 4px 0; }
.level-range { font-size: 11px; color: #999; }

.leaderboard-section {
  background: rgba(255,255,255,0.9);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
}

.leaderboard-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.leaderboard-tabs button {
  padding: 8px 20px;
  border: none;
  border-radius: 20px;
  background: rgba(139,69,19,0.1);
  color: #8b4513;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.leaderboard-tabs button.active {
  background: #8b4513;
  color: white;
}

.leaderboard-list { display: flex; flex-direction: column; gap: 8px; }

.leaderboard-item {
  display: grid;
  grid-template-columns: 50px 40px 1fr auto;
  align-items: center;
  padding: 12px 16px;
  background: rgba(139,69,19,0.05);
  border-radius: 12px;
  transition: background 0.2s;
}

.leaderboard-item.top-3 { background: rgba(139,69,19,0.12); }
.leaderboard-item.me { background: rgba(139,69,19,0.2); border: 2px solid #8b4513; }

.rank-num { font-size: 18px; text-align: center; }

.rank-badge-small {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.rank-username { font-size: 16px; color: #333; }
.rank-rating { font-size: 16px; font-weight: bold; color: #8b4513; }

.empty-list { text-align: center; padding: 40px; color: #666; }
.empty-list .tip { font-size: 14px; color: #999; }

.btn-start-match {
  display: block;
  width: 100%;
  padding: 18px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-start-match:hover { transform: scale(1.02); }
</style>
