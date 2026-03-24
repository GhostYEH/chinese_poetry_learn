<template>
  <div class="challenge-rank">
    <div class="rank-header">
      <router-link to="/challenge" class="back-link">← 返回闯关</router-link>
      <h1 class="rank-title">闯关排行榜</h1>
    </div>

    <div v-if="loading" class="skeleton-rank">
      <div v-for="i in 10" :key="i" class="skeleton-rank-item">
        <div class="skeleton-line skeleton-rank-rank"></div>
        <div class="skeleton-line skeleton-rank-avatar"></div>
        <div class="skeleton-line skeleton-rank-name"></div>
        <div class="skeleton-line skeleton-rank-level"></div>
      </div>
    </div>

    <div v-else class="rank-list glass-card">
      <div
        v-for="(item, index) in leaderboard"
        :key="index"
        :class="['rank-item', {
          'top-three': index < 3,
          'current-user': isCurrentUser(item.username)
        }]"
      >
        <span class="rank-number">{{ index + 1 }}</span>
        <span class="rank-avatar">
          {{ item.username.charAt(0).toUpperCase() }}
        </span>
        <span class="rank-username">{{ item.username }}</span>
        <span class="rank-level">第 {{ item.highest_level }} 关</span>
      </div>

      <div v-if="leaderboard.length === 0" class="empty-rank">
        <p>暂无排行数据</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';

export default {
  name: 'ChallengeRank',
  setup() {
    const router = useRouter();
    const loading = ref(true);
    const leaderboard = ref([]);

    const loadLeaderboard = async () => {
      try {
        loading.value = true;
        const data = await api.challenge.getLeaderboard();
        leaderboard.value = data || [];
      } catch (error) {
        console.error('加载排行榜失败:', error);
      } finally {
        loading.value = false;
      }
    };

    const isCurrentUser = (username) => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.username === username;
      } catch {
        return false;
      }
    };

    onMounted(() => {
      loadLeaderboard();
    });

    return {
      loading,
      leaderboard,
      isCurrentUser
    };
  }
};
</script>

<style scoped>
.challenge-rank {
  max-width: 850px;
  margin: 0 auto;
  padding: 30px 20px;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.05) 0%, rgba(139, 69, 19, 0.1) 100%);
  min-height: 100vh;
  position: relative;
}

.challenge-rank::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="50" font-family="SimSun" font-size="20" text-anchor="middle" fill="rgba(205, 133, 63, 0.06)">榜</text></svg>') repeat;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}

.rank-header {
  margin-bottom: 40px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding: 10px 20px;
  color: #8b4513;
  text-decoration: none;
  font-size: 15px;
  font-family: 'SimSun', 'STSong', serif;
  background: rgba(255, 252, 240, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.1);
}

.back-link:hover {
  background: rgba(255, 252, 240, 0.95);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.2);
}

.rank-title {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0;
  font-size: 32px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(139, 69, 19, 0.1);
  position: relative;
}

.rank-title::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 100px;
  height: 4px;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  border-radius: 2px;
}

.rank-list {
  overflow: hidden;
  position: relative;
  z-index: 1;
  padding: 12px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(245, 222, 179, 0.7);
  transition: all 0.3s ease;
  border-radius: 16px;
  margin-bottom: 8px;
  position: relative;
  overflow: hidden;
}

.rank-item::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.rank-item:hover::after {
  opacity: 1;
}

.rank-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.rank-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(139, 69, 19, 0.2);
  background: rgba(255, 248, 220, 0.6);
}

.top-three {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 165, 0, 0.08));
  border: 1px solid rgba(255, 215, 0, 0.3);
  animation: top-glow 2s ease-in-out infinite;
}

@keyframes top-glow {
  0%, 100% {
    box-shadow: 0 4px 16px rgba(255, 215, 0, 0.15);
  }
  50% {
    box-shadow: 0 8px 32px rgba(255, 215, 0, 0.3);
  }
}

.top-three .rank-number {
  font-size: 28px;
}

.rank-item:nth-child(1) {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.08));
  border: 2px solid rgba(255, 215, 0, 0.4);
}

.rank-item:nth-child(1) .rank-number {
  color: #ffd700;
  text-shadow: 0 2px 8px rgba(255, 215, 0, 0.4);
  font-size: 32px;
}

.rank-item:nth-child(2) {
  background: linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(192, 192, 192, 0.08));
  border: 2px solid rgba(192, 192, 192, 0.4);
}

.rank-item:nth-child(2) .rank-number {
  color: #c0c0c0;
  text-shadow: 0 2px 8px rgba(192, 192, 192, 0.4);
  font-size: 28px;
}

.rank-item:nth-child(3) {
  background: linear-gradient(135deg, rgba(205, 127, 50, 0.2), rgba(205, 127, 50, 0.08));
  border: 2px solid rgba(205, 127, 50, 0.4);
}

.rank-item:nth-child(3) .rank-number {
  color: #cd7f32;
  text-shadow: 0 2px 8px rgba(205, 127, 50, 0.4);
  font-size: 26px;
}

.current-user {
  background: linear-gradient(135deg, rgba(50, 205, 50, 0.2), rgba(50, 205, 50, 0.08)) !important;
  border: 2px solid rgba(50, 205, 50, 0.5) !important;
  box-shadow: 0 8px 24px rgba(50, 205, 50, 0.25) !important;
}

.rank-number {
  width: 50px;
  font-size: 22px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  text-align: center;
}

.rank-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #deb887, #d2691e);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.2);
}

.rank-username {
  flex: 1;
  font-size: 18px;
  color: #5c4033;
  font-family: 'SimSun', 'STSong', serif;
}

.rank-level {
  font-size: 18px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  background: rgba(205, 133, 63, 0.15);
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid rgba(205, 133, 63, 0.3);
}

.empty-rank {
  text-align: center;
  padding: 100px 30px;
  color: #a0522d;
  position: relative;
  z-index: 1;
}

.empty-rank p {
  font-size: 18px;
  font-family: 'SimSun', 'STSong', serif;
}

.skeleton-rank {
  padding: 24px;
  position: relative;
  z-index: 1;
}

.skeleton-rank-item {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-bottom: 20px;
  padding: 20px 24px;
  background: rgba(255, 252, 240, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 16px;
}

.skeleton-line {
  background: linear-gradient(90deg, rgba(240, 240, 240, 0.8) 25%, rgba(224, 224, 224, 0.8) 50%, rgba(240, 240, 240, 0.8) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
}

.skeleton-rank-rank {
  width: 50px;
  height: 28px;
  border-radius: 10px;
}

.skeleton-rank-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
}

.skeleton-rank-name {
  flex: 1;
  height: 24px;
  border-radius: 10px;
}

.skeleton-rank-level {
  width: 120px;
  height: 36px;
  border-radius: 18px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
