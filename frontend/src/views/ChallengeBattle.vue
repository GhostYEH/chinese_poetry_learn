<template>
  <div class="challenge-battle">
    <!-- 未登录提示 -->
    <div v-if="!isLoggedIn" class="login-prompt">
      <div class="glass-card">
        <h3>请先登录</h3>
        <p>登录后才能参与闯关对战！</p>
        <button class="glass-button" @click="goLogin">立即登录</button>
      </div>
    </div>

    <!-- 大厅：选择对手 -->
    <div v-else-if="!gameStarted" class="lobby">
      <div class="lobby-header">
        <h1 class="lobby-title">闯关对战</h1>
        <div class="lobby-actions">
          <button class="glass-nav-button" @click="goBack">返回闯关</button>
          <button class="glass-nav-button" @click="loadOnlineUsers">
            {{ refreshing ? '刷新中...' : '刷新在线用户' }}
          </button>
        </div>
      </div>

      <div class="lobby-content">
        <div class="users-panel glass-card">
          <h3 class="panel-title">在线用户</h3>
          <p class="panel-tip">选择一位在线用户发起对战邀请</p>

          <div v-if="loadingUsers" class="loading-users">
            <div v-for="i in 4" :key="i" class="skeleton-user">
              <div class="skeleton-avatar"></div>
              <div class="skeleton-info">
                <div class="skeleton-line skeleton-name"></div>
                <div class="skeleton-line skeleton-status"></div>
              </div>
            </div>
          </div>

          <div v-else-if="onlineUsers.length === 0" class="no-users">
            <p>暂无可用对手，请稍后再试</p>
            <p class="tip">提示：一台电脑打开两个浏览器登录不同账号，可以看到在线用户</p>
          </div>

          <div v-else class="user-list">
            <div
              v-for="user in onlineUsers"
              :key="user.userId"
              :class="['user-item', { 'in-game': user.inGame, 'self': user.userId === myUserId }]"
            >
              <div class="user-avatar">
                {{ user.username.charAt(0).toUpperCase() }}
              </div>
              <div class="user-info">
                <span class="username">{{ user.username }}</span>
                <span class="status-text">{{ user.inGame ? '对战中' : '空闲' }}</span>
              </div>
              <button
                v-if="!user.inGame && user.userId !== myUserId"
                class="invite-btn"
                @click="sendInvite(user)"
                :disabled="invitingUserId === user.userId"
              >
                {{ invitingUserId === user.userId ? '发送中...' : '邀请对战' }}
              </button>
              <span v-else-if="user.inGame" class="in-game-badge">对战中</span>
              <span v-else-if="user.userId === myUserId" class="self-badge">我自己</span>
            </div>
          </div>
        </div>

        <div class="rules-panel glass-card">
          <h3 class="panel-title">对战规则</h3>
          <div class="rule-list">
            <div class="rule-item">
              <span class="rule-icon">1</span>
              <span class="rule-text">双方交替回答AI出的诗词题目</span>
            </div>
            <div class="rule-item">
              <span class="rule-icon">2</span>
              <span class="rule-text">题目包含上句填下句、下句填上句</span>
            </div>
            <div class="rule-item">
              <span class="rule-icon">3</span>
              <span class="rule-text">每题限时45秒，超时视为失败</span>
            </div>
            <div class="rule-item">
              <span class="rule-icon">4</span>
              <span class="rule-text">答错或超时的一方输掉本局</span>
            </div>
            <div class="rule-item">
              <span class="rule-icon">5</span>
              <span class="rule-text">每局诗词不重复，由AI智能出题</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏中 -->
    <div v-else class="game-room">
      <div class="game-header">
        <h1 class="game-title">闯关对战</h1>
        <div class="game-info-bar">
          <span class="round-badge">第 {{ currentRound }} 轮</span>
          <span class="vs-text">VS</span>
          <div class="players-mini">
            <span class="player-name">{{ players[0]?.username }}</span>
            <span class="vs-sep">-</span>
            <span class="player-name">{{ players[1]?.username }}</span>
          </div>
        </div>
      </div>

      <!-- 验证中遮罩 -->
      <div v-if="validating" class="validating-overlay">
        <div class="validating-content glass-card">
          <div class="validating-icon">&#9835;</div>
          <p>AI评判中...</p>
        </div>
      </div>

      <!-- 计分板 -->
      <div class="scoreboard glass-card">
        <div
          v-for="(player, idx) in players"
          :key="idx"
          :class="['player-card', {
            'active': idx === currentTurn,
            'winner-card': gameEnded && winner && String(winner.id) === String(player.id),
            'loser-card': gameEnded && loser && String(loser.id) === String(player.id)
          }]"
        >
          <div class="player-avatar">
            {{ player.username.charAt(0).toUpperCase() }}
          </div>
          <div class="player-details">
            <span class="player-name">{{ player.username }}</span>
            <div class="player-stats">
              <span class="stat correct">答对 {{ player.correct || 0 }}</span>
              <span class="stat wrong">答错 {{ player.wrong || 0 }}</span>
            </div>
          </div>
          <div v-if="idx === currentTurn && !gameEnded" class="turn-indicator">
            <div class="turn-arrow"></div>
            <span>答题中</span>
          </div>
          <div v-if="player.disconnected && !gameEnded" class="disconnected-badge">已断线</div>
        </div>
      </div>

      <!-- 计时器 -->
      <div class="timer-section">
        <div :class="['timer-ring', { 'warning': remainingTime <= 10 }]">
          <svg class="timer-svg" viewBox="0 0 100 100">
            <circle class="timer-bg" cx="50" cy="50" r="45" />
            <circle
              class="timer-progress"
              cx="50" cy="50" r="45"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="timerOffset"
            />
          </svg>
          <div class="timer-text">
            <span class="timer-number">{{ remainingTime }}</span>
            <span class="timer-label">秒</span>
          </div>
        </div>
      </div>

      <!-- 题目区域 -->
      <div v-if="currentQuestion && !gameEnded" class="question-section glass-card">
        <div class="question-meta">
          <span class="question-type">{{ currentQuestion.type || '诗词接句' }}</span>
          <span class="question-poem-info">{{ currentQuestion.title }} - {{ currentQuestion.author }}</span>
        </div>
        <div class="question-text">
          {{ currentQuestion.question }}
        </div>
        <div v-if="myTurn && !validating" class="answer-area">
          <input
            v-model="userAnswer"
            type="text"
            class="answer-input"
            placeholder="请输入答案"
            @keyup.enter="submitAnswer"
            :disabled="validating"
          />
          <button class="glass-button submit-btn" @click="submitAnswer" :disabled="validating || !userAnswer.trim()">
            提交答案
          </button>
        </div>
        <div v-else-if="!myTurn && !validating" class="waiting-area">
          <p>等待对方答题...</p>
        </div>
      </div>

      <!-- 等待区域 -->
      <div v-if="!currentQuestion && !gameEnded" class="waiting-area">
        <p>等待题目加载...</p>
      </div>
    </div>

    <!-- 邀请弹窗 -->
    <div v-if="incomingInvite" class="modal-overlay" @click.self="rejectInvite">
      <div class="modal-content glass-card invite-modal">
        <h3 class="modal-title">对战邀请</h3>
        <p class="modal-text">
          <strong>{{ incomingInvite.from.username }}</strong> 向你发起了闯关对战邀请！
        </p>
        <div class="modal-actions">
          <button class="glass-button accept-btn" @click="acceptInvite">接受挑战</button>
          <button class="glass-button reject-btn" @click="rejectInvite">婉拒</button>
        </div>
      </div>
    </div>

    <!-- 等待对方接受 -->
    <div v-if="waitingAccept" class="modal-overlay">
      <div class="modal-content glass-card waiting-modal">
        <h3 class="modal-title">等待回应</h3>
        <p class="modal-text">正在等待 <strong>{{ waitingAcceptTarget }}</strong> 接受邀请...</p>
        <button class="glass-button cancel-btn" @click="cancelInvite">取消邀请</button>
      </div>
    </div>

    <!-- 游戏结果 -->
    <div v-if="gameEnded" class="modal-overlay">
      <div class="modal-content glass-card result-modal">
        <h3 class="modal-title">
          {{ winner && String(winner.id) === String(myUserId) ? '恭喜获胜！' : (winner ? '对手获胜' : '对战结束') }}
        </h3>
        <div class="result-scores">
          <div
            v-for="(player, idx) in resultPlayers"
            :key="idx"
            :class="['result-player', {
              'result-winner': winner && String(winner.id) === String(player.id),
              'result-loser': loser && String(loser.id) === String(player.id)
            }]"
          >
            <span class="result-name">{{ player.username }}</span>
            <span class="result-correct">{{ player.correct || 0 }} 正确</span>
            <span class="result-wrong">{{ player.wrong || 0 }} 错误</span>
          </div>
        </div>
        <p class="result-reason">{{ getEndReasonText() }}</p>
        <p class="result-total">共 {{ resultTotal || 0 }} 轮</p>
        <div class="result-history">
          <h4>对战回顾</h4>
          <div class="history-list">
            <div v-for="(q, idx) in resultQuestions" :key="idx" class="history-item">
              <span class="history-round">第{{ idx + 1 }}轮</span>
              <span class="history-question">{{ q.question }}</span>
              <span class="history-answer">{{ q.answer }}</span>
            </div>
          </div>
        </div>
        <button class="glass-button return-btn" @click="returnToLobby">返回大厅</button>
      </div>
    </div>

    <!-- Toast通知 -->
    <div v-if="toast.show" :class="['toast', toast.type]">
      {{ toast.message }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

export default {
  name: 'ChallengeBattle',
  setup() {
    const router = useRouter();
    const socket = ref(null);

    // 登录状态
    const isLoggedIn = ref(false);
    const myUserId = ref(null);
    const myUsername = ref('');

    // 大厅状态
    const onlineUsers = ref([]);
    const loadingUsers = ref(true);
    const refreshing = ref(false);
    const invitingUserId = ref(null);
    const waitingAccept = ref(false);
    const waitingAcceptTarget = ref('');
    const incomingInvite = ref(null);

    // 游戏状态
    const gameStarted = ref(false);
    const roomId = ref(null);
    const players = ref([]);
    const currentTurn = ref(0);
    const currentRound = ref(1);
    const currentQuestion = ref(null);
    const remainingTime = ref(45);
    const totalTime = 45;
    const validating = ref(false);
    const userAnswer = ref('');
    const gameEnded = ref(false);
    const winner = ref(null);
    const loser = ref(null);
    const endReason = ref('');
    const resultTotal = ref(0);
    const resultQuestions = ref([]);
    const resultPlayers = ref([]);

    // Toast
    const toast = ref({ show: false, message: '', type: 'info' });

    // Timer refs
    let timerInterval = null;

    const circumference = 2 * Math.PI * 45;
    const timerOffset = computed(() => {
      const progress = remainingTime.value / totalTime;
      return circumference * (1 - progress);
    });

    const myTurn = computed(() => {
      if (!players.value.length || myUserId.value == null || myUserId.value === '') return false;
      const turnIdx = currentTurn.value;
      if (turnIdx == null || turnIdx < 0 || turnIdx >= players.value.length) return false;
      const active = players.value[turnIdx];
      if (!active) return false;
      return String(active.id) === String(myUserId.value);
    });

    const showToast = (message, type = 'info', duration = 3000) => {
      toast.value = { show: true, message, type };
      setTimeout(() => {
        toast.value.show = false;
      }, duration);
    };

    const goLogin = () => {
      localStorage.setItem('redirectPath', '/challenge/battle');
      router.push('/login');
    };

    const goBack = () => {
      router.push('/challenge');
    };

    const initSocket = () => {
      socket.value = io(SOCKET_URL, {
        transports: ['websocket', 'polling']
      });

      socket.value.on('connect', () => {
        console.log('[ChallengeBattle] Socket已连接');
        const token = localStorage.getItem('token');
        if (token) {
          socket.value.emit('challenge-auth', { token });
        }
      });

      socket.value.on('challenge-authenticated', (data) => {
        console.log('[ChallengeBattle] 认证成功:', data);
        myUserId.value = data.userId;
        myUsername.value = data.username;
        isLoggedIn.value = true;
      });

      socket.value.on('challenge-online-users', (users) => {
        console.log('[ChallengeBattle] 收到在线用户:', users);
        onlineUsers.value = users;
        loadingUsers.value = false;
        refreshing.value = false;
      });

      socket.value.on('challenge-start', (data) => {
        console.log('[ChallengeBattle] 游戏开始:', data);
        startGame(data.room);
      });

      socket.value.on('challenge-receive-invite', (data) => {
        console.log('[ChallengeBattle] 收到邀请:', data);
        incomingInvite.value = data;
      });

      socket.value.on('challenge-invite-rejected', () => {
        showToast('对方拒绝了邀请', 'error');
        waitingAccept.value = false;
        invitingUserId.value = null;
      });

      socket.value.on('challenge-invite-sent', () => {
        showToast('邀请已发送，等待对方回应', 'success');
      });

      socket.value.on('challenge-validating', (data) => {
        validating.value = true;
      });

      socket.value.on('challenge-next', (data) => {
        validating.value = false;
        updateGameState(data);
      });

      socket.value.on('challenge-timer-tick', (data) => {
        remainingTime.value = data.remaining;
        if (data.currentRound != null) currentRound.value = data.currentRound;
        if (data.currentTurn != null) currentTurn.value = data.currentTurn;
        if (data.players && Array.isArray(data.players) && data.players.length) {
          players.value = data.players.map((p) => {
            const prev = players.value.find(op => String(op.id) === String(p.id));
            return {
              ...(prev || {}),
              id: p.id,
              username: p.username,
              correct: p.correct ?? 0,
              wrong: p.wrong ?? 0,
              disconnected: prev?.disconnected ?? false
            };
          });
        }
      });

      socket.value.on('challenge-result', (data) => {
        validating.value = false;
        endGame(data);
      });

      socket.value.on('error', (data) => {
        console.error('[ChallengeBattle] Socket错误:', data);
        showToast(data.error || '发生错误', 'error');
        validating.value = false;
      });

      socket.value.on('disconnect', () => {
        console.log('[ChallengeBattle] Socket断开连接');
      });
    };

    const loadOnlineUsers = () => {
      if (!socket.value?.connected) return;
      refreshing.value = true;
      socket.value.emit('challenge-get-users');
    };

    const sendInvite = (user) => {
      if (!socket.value?.connected) return;
      invitingUserId.value = user.userId;
      waitingAcceptTarget.value = user.username;
      waitingAccept.value = true;
      socket.value.emit('challenge-invite', { targetUserId: user.userId });
    };

    const cancelInvite = () => {
      waitingAccept.value = false;
      invitingUserId.value = null;
      waitingAcceptTarget.value = '';
    };

    const acceptInvite = () => {
      if (!socket.value?.connected || !incomingInvite.value) return;
      socket.value.emit('challenge-accept', {
        inviteId: incomingInvite.value.inviteId,
        inviterId: incomingInvite.value.from.userId
      });
      incomingInvite.value = null;
    };

    const rejectInvite = () => {
      if (!socket.value?.connected || !incomingInvite.value) return;
      socket.value.emit('challenge-reject', {
        inviteId: incomingInvite.value.inviteId,
        inviterId: incomingInvite.value.from.userId
      });
      incomingInvite.value = null;
    };

    const startGame = (roomData) => {
      roomId.value = roomData.id;
      players.value = roomData.players.map(p => ({
        ...p,
        correct: 0,
        wrong: 0
      }));
      currentTurn.value = roomData.currentTurn;
      currentRound.value = roomData.currentRound || 1;
      currentQuestion.value = roomData.currentQuestion;
      remainingTime.value = roomData.turnTimeLimit || 45;
      gameStarted.value = true;
      gameEnded.value = false;
      userAnswer.value = '';
      validating.value = false;
      waitingAccept.value = false;
      invitingUserId.value = null;
      incomingInvite.value = null;
      winner.value = null;
      loser.value = null;
      endReason.value = '';
      resultTotal.value = 0;
      resultQuestions.value = [];
      resultPlayers.value = [];
      startTimer();
    };

    const updateGameState = (data) => {
      currentQuestion.value = data.currentQuestion;
      currentRound.value = data.currentRound;
      currentTurn.value = data.currentTurn;
      players.value = data.players.map(p => ({
        ...players.value.find(op => op.id === p.id) || {},
        ...p
      }));
      remainingTime.value = totalTime;
      userAnswer.value = '';
      validating.value = false;
    };

    const submitAnswer = () => {
      if (!userAnswer.value.trim() || !socket.value?.connected || !roomId.value) return;
      socket.value.emit('challenge-answer', {
        roomId: roomId.value,
        answer: userAnswer.value.trim()
      });
    };

    const startTimer = () => {
      stopTimer();
      timerInterval = setInterval(() => {
        if (remainingTime.value > 0) {
          remainingTime.value--;
        }
      }, 1000);
    };

    const stopTimer = () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };

    const endGame = (data) => {
      stopTimer();
      gameEnded.value = true;
      winner.value = data.winner;
      loser.value = data.loser;
      endReason.value = data.reason;
      resultTotal.value = data.totalQuestions;
      resultQuestions.value = data.questions || [];
      resultPlayers.value = data.players || [];
      validating.value = false;
    };

    const getEndReasonText = () => {
      const map = {
        'wrong_answer': '答错告负',
        'timeout': '超时告负',
        'disconnected': '对手断线获胜',
        'disconnect_timeout': '对手超时离线',
        'max_rounds': '达到最大回合数'
      };
      return map[endReason.value] || '游戏结束';
    };

    const returnToLobby = () => {
      gameStarted.value = false;
      roomId.value = null;
      players.value = [];
      currentQuestion.value = null;
      gameEnded.value = false;
      winner.value = null;
      loser.value = null;
      userAnswer.value = '';
      if (socket.value?.connected) {
        socket.value.emit('challenge-get-users');
      }
    };

    const checkLogin = () => {
      const token = localStorage.getItem('token');
      isLoggedIn.value = !!token;
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          myUserId.value = payload.userId?.toString();
          myUsername.value = payload.username || '';
        } catch {
          isLoggedIn.value = false;
        }
      }
    };

    onMounted(() => {
      checkLogin();
      if (isLoggedIn.value) {
        initSocket();
      }
    });

    onUnmounted(() => {
      stopTimer();
      if (socket.value) {
        socket.value.disconnect();
        socket.value = null;
      }
    });

    return {
      isLoggedIn,
      myUserId,
      onlineUsers,
      loadingUsers,
      refreshing,
      invitingUserId,
      waitingAccept,
      waitingAcceptTarget,
      incomingInvite,
      gameStarted,
      players,
      currentTurn,
      currentRound,
      currentQuestion,
      remainingTime,
      totalTime,
      circumference,
      timerOffset,
      validating,
      userAnswer,
      myTurn,
      gameEnded,
      winner,
      loser,
      endReason,
      resultTotal,
      resultQuestions,
      resultPlayers,
      toast,
      goLogin,
      goBack,
      loadOnlineUsers,
      sendInvite,
      cancelInvite,
      acceptInvite,
      rejectInvite,
      submitAnswer,
      returnToLobby,
      getEndReasonText
    };
  }
};
</script>

<style scoped>
.challenge-battle {
  max-width: 900px;
  margin: 0 auto;
  padding: 30px 20px;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.05) 0%, rgba(139, 69, 19, 0.1) 100%);
  min-height: 100vh;
  position: relative;
}

.challenge-battle::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="50" font-family="SimSun" font-size="20" text-anchor="middle" fill="rgba(205, 133, 63, 0.08)">诗</text></svg>') repeat;
  opacity: 0.6;
  pointer-events: none;
  z-index: 0;
}

/* 通用玻璃卡片 */
.glass-card {
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
  position: relative;
  z-index: 1;
}

.glass-card::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
  border-radius: 24px;
}

.glass-button {
  padding: 12px 28px;
  background: rgba(205, 133, 63, 0.2);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.35);
  border-radius: 16px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
}

.glass-button:hover:not(:disabled) {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.25);
}

.glass-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.glass-nav-button {
  padding: 10px 20px;
  background: rgba(255, 252, 240, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  text-decoration: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
  cursor: pointer;
}

.glass-nav-button:hover {
  background: rgba(255, 252, 240, 0.95);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
}

/* 登录提示 */
.login-prompt {
  text-align: center;
  padding: 80px 20px;
  position: relative;
  z-index: 1;
}

.login-prompt .glass-card h3 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 28px;
  margin-bottom: 16px;
}

.login-prompt .glass-card p {
  font-family: 'SimSun', 'STSong', serif;
  color: #a0522d;
  margin-bottom: 24px;
}

/* 大厅 */
.lobby {
  position: relative;
  z-index: 1;
}

.lobby-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.lobby-title {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0;
  font-size: 32px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(139, 69, 19, 0.1);
}

.lobby-actions {
  display: flex;
  gap: 12px;
}

.lobby-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 768px) {
  .lobby-content { grid-template-columns: 1fr; }
}

.panel-title {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 8px 0;
  font-size: 22px;
  font-weight: bold;
}

.panel-tip {
  font-family: 'SimSun', 'STSong', serif;
  color: #a0522d;
  font-size: 14px;
  margin: 0 0 24px 0;
}

/* 用户列表 */
.loading-users {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-user {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px;
  background: rgba(245, 222, 179, 0.3);
  border-radius: 16px;
}

.skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(240,240,240,0.8) 25%, rgba(224,224,224,0.8) 50%, rgba(240,240,240,0.8) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  flex-shrink: 0;
}

.skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 16px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(240,240,240,0.8) 25%, rgba(224,224,224,0.8) 50%, rgba(240,240,240,0.8) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-name { width: 120px; }
.skeleton-status { width: 80px; }

@keyframes skeleton-loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.no-users {
  text-align: center;
  padding: 40px 20px;
}

.no-users p {
  font-family: 'SimSun', 'STSong', serif;
  color: #a0522d;
  margin: 0 0 12px 0;
}

.no-users .tip {
  font-size: 13px;
  color: #cd853f;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 248, 220, 0.5);
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.user-item:hover {
  background: rgba(255, 252, 240, 0.8);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.1);
}

.user-item.in-game {
  opacity: 0.6;
}

.user-item.self {
  background: rgba(205, 133, 63, 0.1);
  border-color: rgba(205, 133, 63, 0.3);
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
  font-weight: bold;
  font-size: 20px;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.username {
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  color: #8b4513;
  font-size: 16px;
}

.status-text {
  font-size: 13px;
  color: #a0522d;
}

.in-game-badge {
  padding: 6px 14px;
  background: rgba(220, 20, 60, 0.15);
  border: 1px solid rgba(220, 20, 60, 0.3);
  border-radius: 12px;
  color: #dc143c;
  font-size: 13px;
  font-family: 'SimSun', 'STSong', serif;
}

.self-badge {
  padding: 6px 14px;
  background: rgba(205, 133, 63, 0.15);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;
  color: #8b4513;
  font-size: 13px;
  font-family: 'SimSun', 'STSong', serif;
}

.invite-btn {
  padding: 8px 18px;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.3), rgba(139, 69, 19, 0.25));
  border: 1px solid rgba(205, 133, 63, 0.4);
  border-radius: 12px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.invite-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.45), rgba(139, 69, 19, 0.4));
  transform: translateY(-1px);
}

.invite-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 规则面板 */
.rule-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.rule-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  flex-shrink: 0;
}

.rule-text {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 15px;
  line-height: 1.5;
}

/* 游戏房间 */
.game-room {
  position: relative;
  z-index: 1;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.game-title {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0;
  font-size: 28px;
  font-weight: bold;
}

.game-info-bar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.round-badge {
  padding: 8px 20px;
  background: linear-gradient(135deg, #8b4513, #a0522d);
  color: white;
  border-radius: 20px;
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  font-size: 14px;
}

.vs-text {
  font-family: 'SimSun', 'STSong', serif;
  color: #cd853f;
  font-weight: bold;
  font-size: 20px;
}

.players-mini {
  display: flex;
  align-items: center;
  gap: 8px;
}

.players-mini .player-name {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 15px;
  font-weight: bold;
}

.vs-sep {
  color: #cd853f;
}

/* 验证遮罩 */
.validating-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.validating-content {
  text-align: center;
  padding: 40px;
}

.validating-icon {
  font-size: 48px;
  margin-bottom: 16px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.validating-content p {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 18px;
  margin: 0;
}

/* 计分板 */
.scoreboard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

@media (max-width: 600px) {
  .scoreboard { grid-template-columns: 1fr; }
}

.player-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: rgba(255, 248, 220, 0.5);
  border: 2px solid rgba(205, 133, 63, 0.2);
  border-radius: 20px;
  transition: all 0.3s ease;
  position: relative;
}

.player-card.active {
  background: rgba(255, 248, 220, 0.9);
  border-color: rgba(205, 133, 63, 0.5);
  box-shadow: 0 4px 20px rgba(205, 133, 63, 0.2);
}

.player-card.winner-card {
  background: linear-gradient(135deg, rgba(144, 238, 144, 0.4), rgba(255, 252, 240, 0.9));
  border-color: rgba(50, 205, 50, 0.5);
}

.player-card.loser-card {
  background: linear-gradient(135deg, rgba(255, 160, 122, 0.3), rgba(255, 252, 240, 0.9));
  border-color: rgba(220, 20, 60, 0.3);
}

.player-card .player-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 24px;
  flex-shrink: 0;
}

.player-card .player-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-card .player-name {
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  color: #8b4513;
  font-size: 17px;
}

.player-stats {
  display: flex;
  gap: 12px;
}

.stat {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
}

.stat.correct { color: #228b22; }
.stat.wrong { color: #dc143c; }

.turn-indicator {
  position: absolute;
  top: -10px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.turn-arrow {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 10px solid #cd853f;
}

.turn-indicator span {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 12px;
  color: #cd853f;
  font-weight: bold;
}

.disconnected-badge {
  padding: 4px 12px;
  background: rgba(220, 20, 60, 0.2);
  border: 1px solid rgba(220, 20, 60, 0.4);
  border-radius: 10px;
  color: #dc143c;
  font-size: 12px;
  font-family: 'SimSun', 'STSong', serif;
}

/* 计时器 */
.timer-section {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.timer-ring {
  width: 120px;
  height: 120px;
  position: relative;
}

.timer-ring.warning .timer-number {
  color: #dc143c;
  animation: pulse 0.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.timer-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.timer-bg {
  fill: none;
  stroke: rgba(205, 133, 63, 0.2);
  stroke-width: 8;
}

.timer-progress {
  fill: none;
  stroke: #cd853f;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}

.timer-ring.warning .timer-progress {
  stroke: #dc143c;
}

.timer-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.timer-number {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 32px;
  font-weight: bold;
  color: #8b4513;
  transition: color 0.3s;
}

.timer-label {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 12px;
  color: #a0522d;
}

/* 题目区域 */
.question-section {
  margin-bottom: 24px;
}

.question-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.question-type {
  padding: 6px 16px;
  background: linear-gradient(135deg, rgba(100, 149, 237, 0.2), rgba(65, 105, 225, 0.15));
  border: 1px solid rgba(100, 149, 237, 0.3);
  border-radius: 12px;
  color: #4169e1;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
  font-weight: bold;
}

.question-poem-info {
  padding: 6px 16px;
  background: rgba(245, 222, 179, 0.4);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
}

.question-text {
  font-size: 28px;
  font-family: 'SimSun', 'STSong', serif;
  text-align: center;
  color: #8b4513;
  padding: 32px 24px;
  background: linear-gradient(135deg, rgba(255, 248, 220, 0.6), rgba(255, 252, 240, 0.4));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  margin-bottom: 20px;
  line-height: 1.8;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.1);
}

.answer-area {
  display: flex;
  gap: 12px;
}

.answer-input {
  flex: 1;
  padding: 14px 18px;
  border: 2px solid rgba(205, 133, 63, 0.35);
  border-radius: 16px;
  font-size: 18px;
  font-family: 'SimSun', 'STSong', serif;
  background: rgba(255, 252, 240, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 0.3s ease;
  outline: none;
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.1);
}

.answer-input:focus {
  border-color: #cd853f;
  box-shadow: 0 0 0 3px rgba(205, 133, 63, 0.15), 0 8px 24px rgba(139, 69, 19, 0.15);
}

.answer-input:disabled {
  opacity: 0.6;
}

.submit-btn {
  white-space: nowrap;
  background: linear-gradient(135deg, rgba(50, 205, 50, 0.3), rgba(34, 139, 34, 0.25));
  color: #228b22;
  border-color: rgba(50, 205, 50, 0.4);
  font-weight: bold;
}

.waiting-area {
  text-align: center;
  padding: 32px;
}

.waiting-area p {
  font-family: 'SimSun', 'STSong', serif;
  color: #a0522d;
  font-size: 18px;
  margin: 0;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
}

.modal-content {
  max-width: 500px;
  width: 100%;
  text-align: center;
  padding: 36px;
}

.modal-title {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 26px;
  font-weight: bold;
  margin: 0 0 16px 0;
}

.modal-text {
  font-family: 'SimSun', 'STSong', serif;
  color: #a0522d;
  font-size: 16px;
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.modal-text strong {
  color: #8b4513;
}

.modal-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.accept-btn {
  background: linear-gradient(135deg, rgba(50, 205, 50, 0.3), rgba(34, 139, 34, 0.25));
  color: #228b22;
  border-color: rgba(50, 205, 50, 0.4);
  font-weight: bold;
}

.reject-btn {
  background: rgba(220, 20, 60, 0.15);
  color: #dc143c;
  border-color: rgba(220, 20, 60, 0.3);
}

.cancel-btn {
  background: rgba(220, 20, 60, 0.15);
  color: #dc143c;
  border-color: rgba(220, 20, 60, 0.3);
}

/* 结果弹窗 */
.result-modal {
  max-width: 560px;
}

.result-scores {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-bottom: 20px;
}

.result-player {
  flex: 1;
  padding: 20px;
  background: rgba(255, 248, 220, 0.5);
  border: 2px solid rgba(205, 133, 63, 0.2);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-player.result-winner {
  background: linear-gradient(135deg, rgba(144, 238, 144, 0.3), rgba(255, 252, 240, 0.9));
  border-color: rgba(50, 205, 50, 0.5);
}

.result-player.result-loser {
  background: linear-gradient(135deg, rgba(255, 160, 122, 0.25), rgba(255, 252, 240, 0.9));
  border-color: rgba(220, 20, 60, 0.3);
}

.result-name {
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  color: #8b4513;
  font-size: 18px;
}

.result-correct {
  font-family: 'SimSun', 'STSong', serif;
  color: #228b22;
  font-size: 15px;
}

.result-wrong {
  font-family: 'SimSun', 'STSong', serif;
  color: #dc143c;
  font-size: 15px;
}

.result-reason {
  font-family: 'SimSun', 'STSong', serif;
  color: #a0522d;
  font-size: 15px;
  margin: 0 0 8px 0;
}

.result-total {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 14px;
  margin: 0 0 20px 0;
}

.result-history {
  text-align: left;
  margin-bottom: 24px;
}

.result-history h4 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 16px;
  margin: 0 0 12px 0;
}

.history-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(245, 222, 179, 0.3);
  border-radius: 12px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
}

.history-round {
  color: #cd853f;
  font-weight: bold;
  min-width: 40px;
}

.history-question {
  flex: 1;
  color: #8b4513;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-answer {
  color: #228b22;
  font-weight: bold;
  min-width: 80px;
  text-align: right;
}

.return-btn {
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.3), rgba(139, 69, 19, 0.25));
  font-weight: bold;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 28px;
  border-radius: 16px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 15px;
  z-index: 300;
  animation: toast-in 0.3s ease;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.toast.info {
  background: rgba(139, 69, 19, 0.95);
  color: white;
}

.toast.success {
  background: rgba(34, 139, 34, 0.95);
  color: white;
}

.toast.error {
  background: rgba(220, 20, 60, 0.95);
  color: white;
}

@keyframes toast-in {
  0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
