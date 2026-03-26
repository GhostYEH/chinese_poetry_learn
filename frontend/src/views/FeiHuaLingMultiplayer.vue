<template>
  <div class="feihualing-multiplayer">
    <div class="multiplayer-header">
      <h1 class="page-title">飞花令 - 联机对战</h1>
      <router-link to="/feihualing/single" class="back-link">← 单人模式</router-link>
    </div>

    <div v-if="!currentRoom" class="lobby">
      <div class="online-users-section">
        <h2 class="section-title">在线玩家</h2>
        <div v-if="loading" class="loading-state">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
        <div v-else-if="onlineUsers.length === 0" class="empty-users">
          <p>暂无在线玩家</p>
          <p class="hint">邀请好友一起来玩吧！</p>
        </div>
        <div v-else class="users-list">
          <div 
            v-for="user in onlineUsers" 
            :key="user.userId"
            class="user-item"
            :class="{ 'in-game': user.inGame }"
            @click="inviteUser(user)"
          >
            <span class="user-avatar">{{ user.username.charAt(0).toUpperCase() }}</span>
            <span class="user-name">{{ user.username }}</span>
            <span v-if="user.inGame" class="in-game-badge">游戏中</span>
          </div>
        </div>
      </div>

      <div class="game-history-section">
        <h2 class="section-title">最近战绩</h2>
        <div v-if="historyLoading" class="loading-state">
          <div class="loading-spinner small"></div>
        </div>
        <div v-else-if="gameHistory.length === 0" class="empty-history">
          <p>暂无对战记录</p>
        </div>
        <div v-else class="history-list">
          <div v-for="record in gameHistory" :key="record.id" class="history-item">
            <span class="history-players">{{ record.player1 }} VS {{ record.player2 }}</span>
            <span class="history-result" :class="getResultClass(record)">
              {{ record.winner ? (record.winner === currentUsername ? '胜利' : '失败') : '平局' }}
            </span>
            <span class="history-date">{{ formatDate(record.date) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="game-room">
      <div class="room-header">
        <div class="room-info">
          <span class="keyword-badge">{{ currentRoom.keyword }}</span>
          <span class="room-rounds">第 {{ displayRound }} 回合</span>
        </div>
        <div class="timer-display" :class="{ 'warning': remainingTime <= 10, 'danger': remainingTime <= 5 }">
          <span class="timer-icon">⏱️</span>
          <span class="timer-value">{{ remainingTime }}秒</span>
        </div>
        <button class="leave-btn" @click="leaveGame" :disabled="isSubmitting">离开</button>
      </div>

      <div class="players-display">
        <div 
          v-for="(player, index) in currentRoom.players" 
          :key="playerId(player) || index"
          class="player-card"
          :class="{ 
            'current-turn': index === currentRoom.currentTurn,
            'is-me': playerId(player) === currentUserId,
            'disconnected': player.disconnected
          }"
        >
          <div class="player-avatar">{{ player.username.charAt(0).toUpperCase() }}</div>
          <div class="player-name">{{ player.username }}</div>
          <div v-if="player.disconnected" class="disconnect-indicator">
            <span class="disconnect-icon">⚠️</span>
            断线中...
          </div>
          <div v-else-if="index === currentRoom.currentTurn" class="turn-indicator">
            <span class="pulse-dot"></span>
            思考中
          </div>
        </div>
      </div>

      <div class="used-poems">
        <h3>已用诗句 ({{ currentRoom.usedPoems.length }})</h3>
        <div class="poems-scroll">
          <span 
            v-for="(poem, index) in currentRoom.usedPoems" 
            :key="index"
            class="used-poem"
          >
            {{ formatUsedPoem(poem) }}
          </span>
          <span v-if="currentRoom.usedPoems.length === 0" class="no-poems">暂无诗句</span>
        </div>
      </div>

      <div v-if="isValidating" class="validating-overlay">
        <div class="validating-content">
          <div class="validating-spinner"></div>
          <p>正在验证诗句...</p>
        </div>
      </div>

      <div v-else-if="isMyTurn" class="answer-input-area">
        <input
          v-model="answerInput"
          type="text"
          class="answer-input"
          :placeholder="`请输入包含「${currentRoom.keyword}」字的诗句...`"
          @keyup.enter="submitAnswer"
          :disabled="isSubmitting"
          ref="answerInputRef"
        />
        <button 
          class="submit-btn"
          @click="submitAnswer"
          :disabled="isSubmitting || !answerInput.trim()"
        >
          <span v-if="isSubmitting" class="btn-loading"></span>
          {{ isSubmitting ? '提交中...' : '提交' }}
        </button>
      </div>
      <div v-else class="waiting-area">
        <p>等待对方回答...</p>
        <p class="waiting-hint">请准备好你的诗句</p>
      </div>
    </div>

    <div v-if="showInvitationModal" class="modal-overlay" @click.self="closeInvitationModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>🎮 游戏邀请</h3>
        </div>
        <div class="modal-body">
          <p><strong>{{ invitationFrom?.username }}</strong> 邀请你进行飞花令对战</p>
          <p class="invitation-hint">准备好接受挑战了吗？</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn decline-btn" @click="declineInvitation">拒绝</button>
          <button class="modal-btn accept-btn" @click="acceptInvitation">接受挑战</button>
        </div>
      </div>
    </div>

    <div v-if="showGameEndModal" class="modal-overlay" @click.self="closeGameEndModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>游戏结束</h3>
        </div>
        <div class="modal-body">
          <div class="game-result" :class="{ 'win': isWinnerMe }">
            <div class="result-icon">{{ isWinnerMe ? '🎉' : '😢' }}</div>
            <p class="result-text">{{ isWinnerMe ? '恭喜你赢了！' : '对方获胜' }}</p>
            <p v-if="gameEndReason" class="result-reason">{{ gameEndReason }}</p>
          </div>
          <div class="used-poems-summary">
            <h4>精彩回顾</h4>
            <div class="poems-list">
              <span v-for="(poem, index) in currentRoom?.usedPoems" :key="index" class="poem-item">
                {{ poem }}
              </span>
              <span v-if="!currentRoom?.usedPoems?.length" class="no-poems">本局无诗句</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn primary" @click="backToLobby">返回大厅</button>
        </div>
      </div>
    </div>

    <div v-if="showWaitingModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h3>等待对方响应</h3>
        </div>
        <div class="modal-body">
          <div class="waiting-animation">
            <div class="waiting-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
          <p>邀请已发送，等待对方接受...</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn" @click="cancelInvitation">取消邀请</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { io } from 'socket.io-client';

export default {
  name: 'FeiHuaLingMultiplayer',
  setup() {
    const router = useRouter();
    const socket = ref(null);
    const onlineUsers = ref([]);
    const gameHistory = ref([]);
    const currentRoom = ref(null);
    const answerInput = ref('');
    const isSubmitting = ref(false);
    const isValidating = ref(false);
    const showInvitationModal = ref(false);
    const showGameEndModal = ref(false);
    const showWaitingModal = ref(false);
    const invitationFrom = ref(null);
    const gameWinner = ref(null);
    const gameEndReason = ref('');
    const loading = ref(true);
    const historyLoading = ref(false);
    const remainingTime = ref(30);
    const answerInputRef = ref(null);

    const currentUser = ref(JSON.parse(localStorage.getItem('user') || '{}'));
    const currentUserId = ref(currentUser.value?.id?.toString());
    const currentUsername = ref(currentUser.value?.username);

    /** 兼容服务端下发的 id / userId */
    const playerId = (p) => (p && (p.id ?? p.userId) != null ? String(p.id ?? p.userId) : '');

    const displayRound = computed(() => {
      const r = currentRoom.value;
      if (!r) return 1;
      // usedPoems.length 就是当前已完成的回合数
      // game-start 时: usedPoems=[], 显示 1
      // 第1句诗后: usedPoems=[{...}], 显示 1
      // 第2句诗后: usedPoems=[{...},{...}], 显示 2
      const used = r.usedPoems?.length ?? 0;
      return Math.max(1, used + 1);
    });

    const formatUsedPoem = (poem) => {
      if (typeof poem === 'string') return poem;
      if (poem && typeof poem === 'object') {
        return poem.original || poem.normalized || '';
      }
      return '';
    };

    const isWinnerMe = computed(() => {
      const w = gameWinner.value;
      if (!w) return false;
      const wid = (w.id ?? w.userId)?.toString();
      return wid === currentUserId.value;
    });

    const isMyTurn = computed(() => {
      if (!currentRoom.value) return false;
      const myIndex = currentRoom.value.players.findIndex(p => playerId(p) === currentUserId.value);
      return myIndex === currentRoom.value.currentTurn;
    });

    watch(isMyTurn, async (newVal) => {
      if (newVal && answerInputRef.value) {
        await nextTick();
        answerInputRef.value.focus();
      }
    });

    const connectSocket = () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      socket.value = io('http://localhost:3000', {
        transports: ['websocket', 'polling']
      });

      socket.value.on('connect', () => {
        console.log('Socket连接成功');
        socket.value.emit('authenticate', { token });
      });

      socket.value.on('authenticated', () => {
        socket.value.emit('feihualing:get-online-users');
      });

      socket.value.on('online-users', (users) => {
        onlineUsers.value = users.filter(u => u.userId !== currentUserId.value);
        loading.value = false;
      });

      socket.value.on('receive-invitation', (data) => {
        invitationFrom.value = data.from;
        showInvitationModal.value = true;
      });

      socket.value.on('invitation-sent', () => {
        showWaitingModal.value = true;
      });

      socket.value.on('invitation-rejected', () => {
        showWaitingModal.value = false;
        alert('对方拒绝了你的邀请');
      });

      socket.value.on('game-start', (data) => {
        showWaitingModal.value = false;
        showInvitationModal.value = false;
        currentRoom.value = data.room;
        remainingTime.value = data.room.turnTimeLimit || 30;
      });

      socket.value.on('validating', () => {
        isValidating.value = true;
      });

      socket.value.on('poem-submitted', (data) => {
        isValidating.value = false;
        isSubmitting.value = false;
        answerInput.value = '';
        if (!currentRoom.value) return;
        if (data.players) {
          currentRoom.value.players = data.players;
        }
        if (typeof data.currentTurn === 'number') {
          currentRoom.value.currentTurn = data.currentTurn;
        }
        if (typeof data.currentRound === 'number') {
          currentRoom.value.currentRound = data.currentRound;
        }
        if (Array.isArray(data.usedPoems)) {
          currentRoom.value.usedPoems = data.usedPoems;
        }
        remainingTime.value = currentRoom.value.turnTimeLimit || 30;
      });

      socket.value.on('timer-tick', (data) => {
        remainingTime.value = data.remaining;
        if (currentRoom.value) {
          // data.currentTurn 是数字索引，直接使用
          if (typeof data.currentTurn === 'number') {
            currentRoom.value.currentTurn = data.currentTurn;
          }
          if (Array.isArray(data.players)) {
            currentRoom.value.players = data.players;
          }
        }
      });

      socket.value.on('question-thrown', (data) => {
        if (!currentRoom.value) return;
        if (Array.isArray(data.players)) {
          currentRoom.value.players = data.players;
        }
        if (typeof data.currentTurn === 'number') {
          currentRoom.value.currentTurn = data.currentTurn;
        }
        if (data.remainingThrows != null && currentRoom.value.players) {
          const me = currentRoom.value.players.find(p => playerId(p) === currentUserId.value);
          if (me) me.remainingThrows = data.remainingThrows;
        }
        remainingTime.value = currentRoom.value.turnTimeLimit || 30;
      });

      socket.value.on('invitation-cancelled', () => {
        showWaitingModal.value = false;
      });

      socket.value.on('game-result', (data) => {
        gameWinner.value = data.winner;
        gameEndReason.value = data.reason || '';
        showGameEndModal.value = true;
        // 同步完整 room 状态，避免 game-start 缓存残留
        if (currentRoom.value) {
          currentRoom.value.currentRound = data.currentRound ?? currentRoom.value.currentRound;
          currentRoom.value.currentTurn = -1;
          currentRoom.value.usedPoems = data.usedPoems ?? currentRoom.value.usedPoems;
        }
        // 等模态框动画结束后再清理
        setTimeout(() => {
          currentRoom.value = null;
        }, 100);
      });

      socket.value.on('opponent-disconnected', (data) => {
        gameWinner.value = data.winner;
        gameEndReason.value = data.message || '对手离开了游戏';
        showGameEndModal.value = true;
        if (currentRoom.value) {
          currentRoom.value.currentRound = data.currentRound ?? currentRoom.value.currentRound;
          currentRoom.value.currentTurn = -1;
        }
        setTimeout(() => {
          currentRoom.value = null;
        }, 100);
      });

      socket.value.on('error', (data) => {
        isValidating.value = false;
        isSubmitting.value = false;
        const errorMsg = data.isDuplicate ? '这句诗已经用过了，请换一句！' : (data.error || '提交失败');
        alert(errorMsg);
      });

      socket.value.on('disconnect', () => {
        console.log('Socket断开连接');
        loading.value = true;
      });
    };

    const inviteUser = (user) => {
      if (user.inGame) {
        alert('对方正在游戏中');
        return;
      }
      if (socket.value) {
        socket.value.emit('send-invitation', { targetUserId: user.userId });
      }
    };

    const acceptInvitation = () => {
      if (socket.value && invitationFrom.value) {
        socket.value.emit('accept-invitation', {
          inviteId: 'invite-' + Date.now(),
          inviterId: invitationFrom.value.userId
        });
        showInvitationModal.value = false;
      }
    };

    const declineInvitation = () => {
      if (socket.value && invitationFrom.value) {
        socket.value.emit('reject-invitation', {
          inviteId: 'invite-' + Date.now(),
          inviterId: invitationFrom.value.userId
        });
        showInvitationModal.value = false;
      }
    };

    const cancelInvitation = () => {
      if (socket.value) {
        socket.value.emit('cancel-invitation');
      }
      showWaitingModal.value = false;
    };

    const submitAnswer = () => {
      if (!answerInput.value.trim() || isSubmitting.value || !socket.value) return;
      isSubmitting.value = true;
      socket.value.emit('submit-poem', {
        roomId: currentRoom.value.id,
        poem: answerInput.value.trim()
      });
      // 等后端 poem-submitted / error 到达后再清空
    };

    const leaveGame = () => {
      if (confirm('确定要离开游戏吗？离开将判负！')) {
        if (socket.value && currentRoom.value) {
          const opponent = currentRoom.value.players.find(p => playerId(p) !== currentUserId.value);
          if (!opponent) {
            currentRoom.value = null;
            return;
          }
          const opponentId = playerId(opponent);
          socket.value.emit('game-over', {
            roomId: currentRoom.value.id,
            winnerId: opponentId,
            loserId: currentUserId.value,
            reason: '主动离开'
          });
        }
      }
    };

    const backToLobby = () => {
      currentRoom.value = null;
      showGameEndModal.value = false;
      if (socket.value) {
        socket.value.emit('feihualing:get-online-users');
      }
    };

    const closeInvitationModal = () => {
      showInvitationModal.value = false;
    };

    const closeGameEndModal = () => {
      showGameEndModal.value = false;
    };

    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const getResultClass = (record) => {
      return record.winner === currentUsername.value ? 'win' : 'lose';
    };

    const loadGameHistory = async () => {
      historyLoading.value = true;
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/feihua/fight-history', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          gameHistory.value = result.data || [];
        }
      } catch (error) {
        console.error('加载对战历史失败:', error);
      } finally {
        historyLoading.value = false;
      }
    };

    onMounted(() => {
      connectSocket();
      loadGameHistory();
    });

    onUnmounted(() => {
      if (socket.value) {
        socket.value.disconnect();
        socket.value = null;
      }
    });

    return {
      onlineUsers,
      gameHistory,
      currentRoom,
      answerInput,
      isSubmitting,
      isValidating,
      showInvitationModal,
      showGameEndModal,
      showWaitingModal,
      invitationFrom,
      gameWinner,
      gameEndReason,
      currentUserId,
      currentUsername,
      playerId,
      displayRound,
      formatUsedPoem,
      isWinnerMe,
      isMyTurn,
      loading,
      historyLoading,
      remainingTime,
      answerInputRef,
      inviteUser,
      acceptInvitation,
      declineInvitation,
      cancelInvitation,
      submitAnswer,
      leaveGame,
      backToLobby,
      closeInvitationModal,
      closeGameEndModal,
      formatDate,
      getResultClass
    };
  }
};
</script>

<style scoped>
.feihualing-multiplayer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px 20px;
  min-height: 100vh;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.05) 0%, rgba(139, 69, 19, 0.1) 100%);
  position: relative;
}

.multiplayer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.page-title {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0;
  font-size: 32px;
  font-weight: bold;
}

.back-link {
  padding: 10px 20px;
  background: rgba(255, 252, 240, 0.85);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 15px;
  text-decoration: none;
  transition: all 0.3s ease;
}

.back-link:hover {
  background: rgba(255, 252, 240, 0.95);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
}

.lobby {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

.online-users-section,
.game-history-section {
  background: rgba(255, 252, 240, 0.9);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 24px;
  padding: 30px;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
}

.section-title {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 24px 0;
  font-size: 24px;
  font-weight: bold;
}

.loading-state {
  text-align: center;
  padding: 40px 20px;
  color: #a0522d;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(139, 69, 19, 0.2);
  border-top: 3px solid #8b4513;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

.loading-spinner.small {
  width: 24px;
  height: 24px;
  border-width: 2px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-users, .empty-history {
  text-align: center;
  padding: 40px 20px;
  color: #a0522d;
}

.hint {
  font-size: 14px;
  opacity: 0.7;
  margin-top: 10px;
}

.users-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(205, 133, 63, 0.1);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.user-item:hover:not(.in-game) {
  background: rgba(205, 133, 63, 0.2);
  border-color: rgba(205, 133, 63, 0.4);
  transform: translateY(-2px);
}

.user-item.in-game {
  opacity: 0.6;
  cursor: not-allowed;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
}

.user-name {
  flex: 1;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
  color: #5c4033;
}

.in-game-badge {
  padding: 4px 12px;
  background: rgba(205, 133, 63, 0.2);
  color: #8b4513;
  border-radius: 12px;
  font-size: 12px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: rgba(205, 133, 63, 0.08);
  border-radius: 12px;
  border: 1px solid rgba(205, 133, 63, 0.15);
}

.history-players {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  color: #5c4033;
}

.history-result {
  padding: 4px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: bold;
}

.history-result.win {
  background: rgba(50, 205, 50, 0.2);
  color: #228b22;
}

.history-result.lose {
  background: rgba(220, 20, 60, 0.2);
  color: #dc143c;
}

.history-date {
  font-size: 12px;
  color: #a0522d;
}

.game-room {
  position: relative;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px 30px;
  background: rgba(255, 252, 240, 0.9);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
}

.room-info {
  display: flex;
  gap: 16px;
  align-items: center;
}

.keyword-badge {
  padding: 8px 24px;
  background: linear-gradient(135deg, #8b4513, #a0522d);
  color: white;
  border-radius: 24px;
  font-weight: bold;
  font-size: 20px;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.3);
}

.room-rounds {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
  color: #8b4513;
}

.timer-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(205, 133, 63, 0.15);
  border-radius: 20px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 18px;
  color: #8b4513;
  transition: all 0.3s ease;
}

.timer-display.warning {
  background: rgba(255, 165, 0, 0.2);
  color: #ff8c00;
}

.timer-display.danger {
  background: rgba(220, 20, 60, 0.2);
  color: #dc143c;
  animation: pulse-danger 0.5s ease-in-out infinite;
}

@keyframes pulse-danger {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.leave-btn {
  padding: 10px 24px;
  background: rgba(220, 20, 60, 0.2);
  color: #dc143c;
  border: 1px solid rgba(220, 20, 60, 0.3);
  border-radius: 14px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.leave-btn:hover:not(:disabled) {
  background: rgba(220, 20, 60, 0.3);
}

.leave-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.players-display {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 30px;
}

.player-card {
  background: rgba(255, 252, 240, 0.9);
  border: 2px solid rgba(205, 133, 63, 0.25);
  border-radius: 20px;
  padding: 30px;
  text-align: center;
  transition: all 0.3s ease;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
}

.player-card.current-turn {
  border-color: #cd853f;
  box-shadow: 0 8px 32px rgba(205, 133, 63, 0.3);
  animation: current-turn-pulse 2s ease-in-out infinite;
}

.player-card.is-me {
  background: linear-gradient(135deg, rgba(50, 205, 50, 0.1), rgba(255, 252, 240, 0.9));
}

.player-card.disconnected {
  opacity: 0.6;
  border-color: #dc143c;
}

@keyframes current-turn-pulse {
  0%, 100% { box-shadow: 0 8px 32px rgba(205, 133, 63, 0.3); }
  50% { box-shadow: 0 12px 48px rgba(205, 133, 63, 0.4); }
}

.player-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: bold;
  margin: 0 auto 16px;
}

.player-name {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 20px;
  color: #5c4033;
  font-weight: bold;
}

.turn-indicator, .disconnect-indicator {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
}

.turn-indicator {
  color: #cd853f;
}

.disconnect-indicator {
  color: #dc143c;
}

.pulse-dot {
  width: 10px;
  height: 10px;
  background: #cd853f;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.used-poems {
  background: rgba(255, 252, 240, 0.9);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 20px;
  padding: 24px 30px;
  margin-bottom: 30px;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
}

.used-poems h3 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 16px 0;
  font-size: 18px;
}

.poems-scroll {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  max-height: 150px;
  overflow-y: auto;
}

.used-poem {
  padding: 6px 14px;
  background: rgba(205, 133, 63, 0.15);
  color: #8b4513;
  border-radius: 16px;
  font-size: 14px;
  white-space: nowrap;
}

.no-poems {
  color: #a0522d;
  opacity: 0.6;
  font-size: 14px;
}

.validating-overlay {
  text-align: center;
  padding: 40px;
  background: rgba(255, 252, 240, 0.95);
  border-radius: 16px;
  border: 1px solid rgba(205, 133, 63, 0.25);
}

.validating-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.validating-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(139, 69, 19, 0.2);
  border-top: 3px solid #8b4513;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.answer-input-area {
  display: flex;
  gap: 12px;
}

.answer-input {
  flex: 1;
  padding: 16px 24px;
  background: rgba(255, 252, 240, 0.9);
  border: 2px solid rgba(205, 133, 63, 0.35);
  border-radius: 16px;
  font-size: 18px;
  outline: none;
  transition: all 0.3s ease;
}

.answer-input:focus {
  border-color: #cd853f;
  box-shadow: 0 0 0 3px rgba(205, 133, 63, 0.15);
}

.answer-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn {
  padding: 16px 36px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 120px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.25);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-loading {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.waiting-area {
  text-align: center;
  padding: 30px;
  background: rgba(255, 252, 240, 0.9);
  border-radius: 16px;
  color: #a0522d;
}

.waiting-hint {
  font-size: 14px;
  opacity: 0.7;
  margin-top: 8px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: rgba(255, 252, 240, 0.98);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 24px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(139, 69, 19, 0.3);
  animation: modal-appear 0.3s ease-out;
}

@keyframes modal-appear {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.modal-header {
  text-align: center;
  margin-bottom: 24px;
}

.modal-header h3 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0;
  font-size: 24px;
}

.modal-body {
  margin-bottom: 28px;
  text-align: center;
}

.modal-body p {
  font-family: 'SimSun', 'STSong', serif;
  color: #5c4033;
  font-size: 16px;
  margin: 0;
}

.invitation-hint {
  font-size: 14px;
  opacity: 0.7;
  margin-top: 10px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.modal-btn {
  padding: 12px 32px;
  border: 1px solid rgba(205, 133, 63, 0.35);
  border-radius: 14px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(205, 133, 63, 0.15);
  color: #8b4513;
}

.modal-btn:hover {
  transform: translateY(-2px);
}

.modal-btn.primary {
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  border: none;
}

.decline-btn:hover {
  background: rgba(205, 133, 63, 0.25);
}

.accept-btn {
  background: linear-gradient(135deg, rgba(50, 205, 50, 0.35), rgba(34, 139, 34, 0.3));
  color: #228b22;
  border-color: rgba(50, 205, 50, 0.4);
}

.accept-btn:hover {
  background: linear-gradient(135deg, rgba(50, 205, 50, 0.45), rgba(34, 139, 34, 0.4));
}

.game-result {
  text-align: center;
  margin-bottom: 28px;
}

.game-result.win .result-text {
  color: #32cd32;
}

.result-icon {
  font-size: 72px;
  margin-bottom: 16px;
}

.result-text {
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 8px 0;
  color: #dc143c;
}

.result-reason {
  font-size: 14px;
  color: #a0522d;
  opacity: 0.8;
}

.used-poems-summary {
  margin-bottom: 20px;
}

.used-poems-summary h4 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 16px 0;
  font-size: 18px;
  text-align: center;
}

.poems-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-height: 120px;
  overflow-y: auto;
}

.poem-item {
  padding: 4px 12px;
  background: rgba(205, 133, 63, 0.15);
  color: #8b4513;
  border-radius: 12px;
  font-size: 13px;
}

.waiting-animation {
  margin-bottom: 20px;
}

.waiting-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.waiting-dots span {
  width: 12px;
  height: 12px;
  background: #cd853f;
  border-radius: 50%;
  animation: bounce 1.4s ease-in-out infinite;
}

.waiting-dots span:nth-child(1) { animation-delay: 0s; }
.waiting-dots span:nth-child(2) { animation-delay: 0.2s; }
.waiting-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

@media (max-width: 768px) {
  .lobby { grid-template-columns: 1fr; }
  .players-display { grid-template-columns: 1fr; }
  .answer-input-area { flex-direction: column; }
  .submit-btn { width: 100%; }
}
</style>
