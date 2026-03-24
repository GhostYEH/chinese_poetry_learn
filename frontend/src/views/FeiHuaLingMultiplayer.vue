<template>
  <div class="feihualing-multiplayer">
    <div class="multiplayer-header">
      <h1 class="page-title">飞花令 - 联机对战</h1>
      <router-link to="/feihualing/single" class="back-link">← 单人模式</router-link>
    </div>

    <div v-if="!currentRoom" class="lobby">
      <div class="online-users-section">
        <h2 class="section-title">在线玩家</h2>
        <div v-if="onlineUsers.length === 0" class="empty-users">
          <p>暂无在线玩家</p>
        </div>
        <div v-else class="users-list">
          <div 
            v-for="user in onlineUsers" 
            :key="user.id"
            class="user-item"
            :class="{ 'in-game': user.inRoom }"
            @click="inviteUser(user)"
          >
            <span class="user-avatar">{{ user.username.charAt(0).toUpperCase() }}</span>
            <span class="user-name">{{ user.username }}</span>
            <span v-if="user.inRoom" class="in-game-badge">游戏中</span>
          </div>
        </div>
      </div>

      <div class="game-history-section">
        <h2 class="section-title">最近战绩</h2>
        <div v-if="gameHistory.length === 0" class="empty-history">
          <p>暂无对战记录</p>
        </div>
        <div v-else class="history-list">
          <div v-for="record in gameHistory" :key="record.id" class="history-item">
            <span class="history-players">{{ record.player1 }} VS {{ record.player2 }}</span>
            <span class="history-result">
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
          <span class="room-rounds">第 {{ currentRoom.rounds + 1 }} 回合</span>
        </div>
        <button class="leave-btn" @click="leaveGame">离开</button>
      </div>

      <div class="players-display">
        <div 
          v-for="(player, index) in currentRoom.players" 
          :key="player.id"
          class="player-card"
          :class="{ 
            'current-turn': index === currentRoom.currentTurn,
            'is-me': player.id === currentUserId
          }"
        >
          <div class="player-avatar">{{ player.username.charAt(0).toUpperCase() }}</div>
          <div class="player-name">{{ player.username }}</div>
          <div v-if="index === currentRoom.currentTurn" class="turn-indicator">
            <span class="pulse-dot"></span>
            思考中
          </div>
        </div>
      </div>

      <div class="used-poems">
        <h3>已用诗句</h3>
        <div class="poems-scroll">
          <span 
            v-for="(poem, index) in currentRoom.usedPoems" 
            :key="index"
            class="used-poem"
          >
            {{ poem }}
          </span>
        </div>
      </div>

      <div v-if="isMyTurn" class="answer-input-area">
        <input
          v-model="answerInput"
          type="text"
          class="answer-input"
          placeholder="请输入包含「{{ currentRoom.keyword }}」字的诗句..."
          @keyup.enter="submitAnswer"
          :disabled="answerSubmitting"
        />
        <button 
          class="submit-btn"
          @click="submitAnswer"
          :disabled="answerSubmitting || !answerInput.trim()"
        >
          {{ answerSubmitting ? '提交中...' : '提交' }}
        </button>
      </div>
      <div v-else class="waiting-area">
        <p>等待对方回答...</p>
      </div>
    </div>

    <div v-if="showInvitationModal" class="modal-overlay" @click.self="closeInvitationModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>游戏邀请</h3>
        </div>
        <div class="modal-body">
          <p>{{ invitationFrom?.username }} 邀请你进行飞花令对战</p>
        </div>
        <div class="modal-footer">
          <button class="modal-btn decline-btn" @click="declineInvitation">拒绝</button>
          <button class="modal-btn accept-btn" @click="acceptInvitation">接受</button>
        </div>
      </div>
    </div>

    <div v-if="showGameEndModal" class="modal-overlay" @click.self="closeGameEndModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>游戏结束</h3>
        </div>
        <div class="modal-body">
          <div class="game-result" :class="{ 'win': gameWinner?.id === currentUserId }">
            <div class="result-icon">{{ gameWinner?.id === currentUserId ? '🎉' : '😢' }}</div>
            <p class="result-text">{{ gameWinner?.id === currentUserId ? '你赢了！' : '对方获胜' }}</p>
          </div>
          <div class="used-poems-summary">
            <h4>精彩回顾</h4>
            <div class="poems-list">
              <span v-for="(poem, index) in currentRoom?.usedPoems" :key="index" class="poem-item">
                {{ poem }}
              </span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-btn" @click="backToLobby">返回大厅</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import feihualingSocket from '../services/feihualingSocket';

export default {
  name: 'FeiHuaLingMultiplayer',
  setup() {
    const onlineUsers = ref([]);
    const gameHistory = ref([]);
    const currentRoom = ref(null);
    const answerInput = ref('');
    const answerSubmitting = ref(false);
    const showInvitationModal = ref(false);
    const showGameEndModal = ref(false);
    const invitationFrom = ref(null);
    const gameWinner = ref(null);

    const currentUser = ref(JSON.parse(localStorage.getItem('user') || '{}'));
    const currentUserId = ref(currentUser.value?.id?.toString());
    const currentUsername = ref(currentUser.value?.username);

    const isMyTurn = computed(() => {
      if (!currentRoom.value) return false;
      const myIndex = currentRoom.value.players.findIndex(p => p.id === currentUserId.value);
      return myIndex === currentRoom.value.currentTurn;
    });

    const handleOnlineUsers = (users) => {
      onlineUsers.value = users.filter(u => u.id !== currentUserId.value);
    };

    const handleUserJoined = (user) => {
      if (user.id !== currentUserId.value) {
        onlineUsers.value.push(user);
      }
    };

    const handleUserLeft = (userId) => {
      onlineUsers.value = onlineUsers.value.filter(u => u.id !== userId);
    };

    const handleInvitationReceived = (data) => {
      invitationFrom.value = data.from;
      showInvitationModal.value = true;
    };

    const handleGameStarted = (room) => {
      currentRoom.value = room;
    };

    const handleAnswerResult = (data) => {
      if (data.room) {
        currentRoom.value = data.room;
      }
    };

    const handleGameEnded = (data) => {
      gameWinner.value = data.winner;
      showGameEndModal.value = true;
    };

    const handleOpponentLeft = (data) => {
      gameWinner.value = data.winner;
      showGameEndModal.value = true;
    };

    const handleError = (error) => {
      alert(error);
    };

    const inviteUser = (user) => {
      if (user.inRoom) {
        alert('对方正在游戏中');
        return;
      }
      feihualingSocket.sendInvitation(user.id);
    };

    const acceptInvitation = () => {
      feihualingSocket.acceptInvitation();
      showInvitationModal.value = false;
    };

    const declineInvitation = () => {
      feihualingSocket.declineInvitation();
      showInvitationModal.value = false;
    };

    const submitAnswer = () => {
      if (!answerInput.value.trim() || answerSubmitting.value) return;
      
      answerSubmitting.value = true;
      feihualingSocket.submitAnswer(currentRoom.value.id, answerInput.value.trim());
      
      setTimeout(() => {
        answerSubmitting.value = false;
        answerInput.value = '';
      }, 500);
    };

    const leaveGame = () => {
      if (confirm('确定要离开游戏吗？')) {
        feihualingSocket.leaveGame(currentRoom.value.id);
        currentRoom.value = null;
      }
    };

    const backToLobby = () => {
      currentRoom.value = null;
      showGameEndModal.value = false;
      feihualingSocket.getOnlineUsers();
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

    onMounted(() => {
      feihualingSocket.connect();
      feihualingSocket.on('online-users', handleOnlineUsers);
      feihualingSocket.on('user-joined', handleUserJoined);
      feihualingSocket.on('user-left', handleUserLeft);
      feihualingSocket.on('invitation-received', handleInvitationReceived);
      feihualingSocket.on('game-started', handleGameStarted);
      feihualingSocket.on('answer-result', handleAnswerResult);
      feihualingSocket.on('game-ended', handleGameEnded);
      feihualingSocket.on('opponent-left', handleOpponentLeft);
      feihualingSocket.on('error', handleError);
    });

    onUnmounted(() => {
      feihualingSocket.off('online-users', handleOnlineUsers);
      feihualingSocket.off('user-joined', handleUserJoined);
      feihualingSocket.off('user-left', handleUserLeft);
      feihualingSocket.off('invitation-received', handleInvitationReceived);
      feihualingSocket.off('game-started', handleGameStarted);
      feihualingSocket.off('answer-result', handleAnswerResult);
      feihualingSocket.off('game-ended', handleGameEnded);
      feihualingSocket.off('opponent-left', handleOpponentLeft);
      feihualingSocket.off('error', handleError);
    });

    return {
      onlineUsers,
      gameHistory,
      currentRoom,
      answerInput,
      answerSubmitting,
      showInvitationModal,
      showGameEndModal,
      invitationFrom,
      gameWinner,
      currentUserId,
      currentUsername,
      isMyTurn,
      inviteUser,
      acceptInvitation,
      declineInvitation,
      submitAnswer,
      leaveGame,
      backToLobby,
      closeInvitationModal,
      closeGameEndModal,
      formatDate
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

.feihualing-multiplayer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="50" font-family="SimSun" font-size="20" text-anchor="middle" fill="rgba(205, 133, 63, 0.06)">令</text></svg>') repeat;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}

.multiplayer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  position: relative;
  z-index: 1;
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
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 15px;
  text-decoration: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.1);
}

.back-link:hover {
  background: rgba(255, 252, 240, 0.95);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.2);
}

.lobby {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  position: relative;
  z-index: 1;
}

.online-users-section,
.game-history-section {
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
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

.empty-users,
.empty-history {
  text-align: center;
  padding: 60px 20px;
  color: #a0522d;
  font-family: 'SimSun', 'STSong', serif;
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
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.15);
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
  font-family: 'SimSun', 'STSong', serif;
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
  font-family: 'SimSun', 'STSong', serif;
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
  font-size: 15px;
  color: #5c4033;
}

.history-result {
  padding: 4px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: bold;
  font-family: 'SimSun', 'STSong', serif;
}

.history-date {
  font-size: 13px;
  color: #a0522d;
  font-family: 'SimSun', 'STSong', serif;
}

.game-room {
  position: relative;
  z-index: 1;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding: 20px 30px;
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
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
  font-family: 'SimSun', 'STSong', serif;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.3);
}

.room-rounds {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
  color: #8b4513;
}

.leave-btn {
  padding: 10px 24px;
  background: rgba(220, 20, 60, 0.2);
  color: #dc143c;
  border: 1px solid rgba(220, 20, 60, 0.3);
  border-radius: 14px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(220, 20, 60, 0.15);
}

.leave-btn:hover {
  background: rgba(220, 20, 60, 0.3);
  border-color: rgba(220, 20, 60, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(220, 20, 60, 0.25);
}

.players-display {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 30px;
}

.player-card {
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2px solid rgba(205, 133, 63, 0.25);
  border-radius: 20px;
  padding: 30px;
  text-align: center;
  transition: all 0.3s ease;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
  position: relative;
  overflow: hidden;
}

.player-card.current-turn {
  border-color: #cd853f;
  box-shadow: 0 8px 32px rgba(205, 133, 63, 0.3);
  animation: current-turn-pulse 2s ease-in-out infinite;
}

@keyframes current-turn-pulse {
  0%, 100% {
    box-shadow: 0 8px 32px rgba(205, 133, 63, 0.3);
  }
  50% {
    box-shadow: 0 12px 48px rgba(205, 133, 63, 0.4);
  }
}

.player-card.is-me {
  background: linear-gradient(135deg, rgba(50, 205, 50, 0.1), rgba(255, 252, 240, 0.9));
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
  font-family: 'SimSun', 'STSong', serif;
  margin: 0 auto 16px;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.2);
}

.player-name {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 20px;
  color: #5c4033;
  font-weight: bold;
}

.turn-indicator {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #cd853f;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
}

.pulse-dot {
  width: 10px;
  height: 10px;
  background: #cd853f;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.used-poems {
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
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
  font-weight: bold;
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
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  white-space: nowrap;
}

.answer-input-area {
  display: flex;
  gap: 12px;
}

.answer-input {
  flex: 1;
  padding: 16px 24px;
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 2px solid rgba(205, 133, 63, 0.35);
  border-radius: 16px;
  font-size: 18px;
  font-family: 'SimSun', 'STSong', serif;
  outline: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.1);
}

.answer-input:focus {
  border-color: #cd853f;
  box-shadow: 0 0 0 3px rgba(205, 133, 63, 0.15), 0 8px 24px rgba(139, 69, 19, 0.15);
  background: rgba(255, 252, 240, 0.95);
}

.answer-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn {
  padding: 16px 36px;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.3), rgba(139, 69, 19, 0.25));
  color: #8b4513;
  border: 1px solid rgba(205, 133, 63, 0.4);
  border-radius: 16px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
  white-space: nowrap;
}

.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.4), rgba(139, 69, 19, 0.35));
  border-color: rgba(205, 133, 63, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.25);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.waiting-area {
  text-align: center;
  padding: 30px;
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 16px;
  color: #a0522d;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
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
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 24px;
  padding: 32px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(139, 69, 19, 0.3);
  animation: modal-appear 0.3s ease-out;
}

@keyframes modal-appear {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
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
  font-weight: bold;
}

.modal-body {
  margin-bottom: 28px;
}

.modal-body p {
  font-family: 'SimSun', 'STSong', serif;
  color: #5c4033;
  font-size: 16px;
  text-align: center;
  margin: 0;
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
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.12);
}

.decline-btn {
  background: rgba(205, 133, 63, 0.15);
  color: #8b4513;
}

.decline-btn:hover {
  background: rgba(205, 133, 63, 0.25);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
}

.accept-btn {
  background: linear-gradient(135deg, rgba(50, 205, 50, 0.35), rgba(34, 139, 34, 0.3));
  color: #228b22;
  border-color: rgba(50, 205, 50, 0.4);
}

.accept-btn:hover {
  background: linear-gradient(135deg, rgba(50, 205, 50, 0.45), rgba(34, 139, 34, 0.4));
  border-color: rgba(50, 205, 50, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(50, 205, 50, 0.25);
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
  font-family: 'SimSun', 'STSong', serif;
  font-size: 24px;
  font-weight: bold;
  margin: 0;
  color: #dc143c;
}

.used-poems-summary {
  margin-bottom: 28px;
}

.used-poems-summary h4 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: bold;
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
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
}

@media (max-width: 768px) {
  .lobby {
    grid-template-columns: 1fr;
  }

  .players-display {
    grid-template-columns: 1fr;
  }

  .answer-input-area {
    flex-direction: column;
  }

  .submit-btn {
    width: 100%;
  }
}
</style>
