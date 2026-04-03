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

    <!-- 开始界面 -->
    <div v-else-if="!gameStarted" class="start-panel">
      <div class="start-header">
        <h1 class="start-title">闯关对战</h1>
        <button class="glass-nav-button" @click="goBack">返回闯关</button>
      </div>

      <div class="start-content">
        <div class="glass-card start-card">
          <div class="start-icon">剑</div>
          <h2 class="start-heading">单人练习模式</h2>
          <p class="start-desc">
            本地快速出题，无需等待对手。<br/>
            系统从诗词库中随机抽取题目，答错自动收录至错题本。
          </p>

          <div class="rule-list">
            <div class="rule-item">
              <span class="rule-icon">1</span>
              <span class="rule-text">题目包含上句填下句、下句填上句</span>
            </div>
            <div class="rule-item">
              <span class="rule-icon">2</span>
              <span class="rule-text">每题限时30秒，超时视为答错</span>
            </div>
            <div class="rule-item">
              <span class="rule-icon">3</span>
              <span class="rule-text">答错自动收录至错题本，可随时复习</span>
            </div>
            <div class="rule-item">
              <span class="rule-icon">4</span>
              <span class="rule-text">共30题，答题正确越多成绩越好</span>
            </div>
          </div>

          <button class="glass-button start-btn" @click="startGame" :disabled="starting">
            {{ starting ? '准备中...' : '开始挑战' }}
          </button>
        </div>

        <!-- 历史战绩 -->
        <div class="glass-card history-card">
          <h3 class="panel-title">历史战绩</h3>
          <div v-if="historyLoading" class="loading-mini">
            <div class="spinner"></div>
            <span>加载中...</span>
          </div>
          <div v-else-if="history.length === 0" class="no-history">
            <p>暂无历史记录</p>
            <p class="tip">开始挑战即可查看战绩</p>
          </div>
          <div v-else class="history-list">
            <div v-for="(h, idx) in history.slice(0, 5)" :key="idx" class="history-item">
              <div class="history-info">
                <span class="history-date">{{ formatDate(h.ended_at) }}</span>
                <span class="history-score">
                  正确 {{ h.player1_correct }} / 共 {{ h.total_questions }} 题
                </span>
              </div>
              <div class="history-bar-wrap">
                <div
                  class="history-bar"
                  :style="{ width: Math.round((h.player1_correct / h.total_questions) * 100) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏中 - 全屏布局 -->
    <div v-else class="game-room-fullscreen">
      <!-- 顶部状态栏 -->
      <div class="game-hud-full">
        <div class="hud-left">
          <h1 class="game-title">闯关对战</h1>
          <span class="round-badge">第 {{ currentRound }} / 30轮</span>
        </div>
        <div class="hud-center">
          <div class="score-display">
            <span class="score-correct">{{ correctCount }} 正确</span>
            <span class="score-sep">|</span>
            <span class="score-wrong">{{ wrongCount }} 错误</span>
          </div>
        </div>
        <div class="hud-right">
          <button class="quit-game-btn" @click="confirmQuit">结束挑战</button>
        </div>
      </div>

      <!-- 主游戏区域 -->
      <div class="game-main-area">
        <!-- 左侧计时器 -->
        <div class="timer-section">
          <div :class="['timer-ring', { 'warning': remainingTime <= 10, 'danger': remainingTime <= 5 }]">
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

        <!-- 中央题目区域 -->
        <div class="question-area">
          <div v-if="currentQuestion" class="question-card">
            <div class="question-meta">
              <span class="question-type">{{ currentQuestion.type || '诗词接句' }}</span>
              <span class="question-poem-info">{{ currentQuestion.title }} - {{ currentQuestion.author }}</span>
            </div>
            <div class="question-text">
              {{ currentQuestion.question }}
            </div>
          </div>

          <!-- 答题输入 -->
          <div class="answer-section">
            <input
              v-model="userAnswer"
              type="text"
              class="answer-input"
              placeholder="请输入答案"
              @keyup.enter="submitAnswer"
              ref="answerInput"
              :disabled="answerFeedback !== null"
            />
            <button class="submit-btn" @click="submitAnswer" :disabled="!userAnswer.trim() || submitting || answerFeedback !== null">
              {{ submitting ? '判定中...' : '提交答案' }}
            </button>
          </div>
        </div>

        <!-- 右侧进度指示 -->
        <div class="progress-section">
          <div class="progress-card">
            <div class="progress-title">答题进度</div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: ((currentRound - 1) / 30 * 100) + '%' }"></div>
            </div>
            <div class="progress-text">{{ currentRound - 1 }} / 30</div>
          </div>
          <div class="accuracy-card">
            <div class="accuracy-title">正确率</div>
            <div class="accuracy-value">{{ currentRound > 1 ? Math.round((correctCount / (currentRound - 1)) * 100) : 0 }}%</div>
          </div>
        </div>
      </div>

      <!-- 答题反馈浮层 -->
      <transition name="feedback-fade">
        <div v-if="answerFeedback" class="feedback-overlay">
          <div :class="['feedback-card', answerFeedback.isCorrect ? 'feedback-correct' : 'feedback-wrong']">
            <div class="feedback-icon">{{ answerFeedback.isCorrect ? '✓' : '✗' }}</div>
            <div class="feedback-text">
              <p class="feedback-title">{{ answerFeedback.isCorrect ? '回答正确！' : '回答错误' }}</p>
              <p v-if="!answerFeedback.isCorrect" class="feedback-answer">
                正确答案：<strong>{{ answerFeedback.correctAnswer }}</strong>
              </p>
            </div>
            <p class="feedback-analysis" v-if="currentQuestion?.analysis">
              {{ currentQuestion.analysis }}
            </p>
          </div>
        </div>
      </transition>
    </div>

    <!-- 游戏结束 -->
    <div v-if="gameEnded" class="modal-overlay">
      <div class="modal-content glass-card result-modal">
        <h3 class="modal-title">挑战结束</h3>

        <div class="result-score-big">
          <span class="score-num">{{ finalCorrect }}</span>
          <span class="score-denom">/ {{ finalTotal }} 题正确</span>
        </div>

        <div class="result-accuracy">
          正确率 {{ Math.round((finalCorrect / finalTotal) * 100) }}%
        </div>

        <div class="result-summary">
          <div class="summary-item correct-item">
            <span class="summary-num">{{ finalCorrect }}</span>
            <span class="summary-label">正确</span>
          </div>
          <div class="summary-item wrong-item">
            <span class="summary-num">{{ finalWrong }}</span>
            <span class="summary-label">错误</span>
          </div>
        </div>

        <!-- 错题列表 -->
        <div v-if="wrongQuestions.length > 0" class="wrong-questions-section">
          <h4 class="wrong-title">
            <span class="wrong-icon">✗</span>
            错题收录 ({{ wrongQuestions.length }}题)
          </h4>
          <div class="wrong-list">
            <div v-for="(wq, idx) in wrongQuestions" :key="idx" class="wrong-item">
              <div class="wrong-q">{{ wq.question }}</div>
              <div class="wrong-a">
                <span class="wrong-yours">你的答案：{{ wq.userAnswer }}</span>
                <span class="wrong-correct">正确答案：{{ wq.answer }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-wrong">
          <p>太棒了！本次挑战全部答对！</p>
        </div>

        <div class="result-actions">
          <button class="glass-button review-btn" @click="goToReview">
            查看错题本
          </button>
          <button class="glass-button retry-btn" @click="retryGame">
            再来一局
          </button>
          <button class="glass-button return-btn" @click="returnToStart">
            返回大厅
          </button>
        </div>
      </div>
    </div>

    <!-- Toast通知 -->
    <div v-if="toast.show" :class="['toast', toast.type]">
      {{ toast.message }}
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
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

    // 开始界面
    const starting = ref(false);
    const history = ref([]);
    const historyLoading = ref(false);

    // 游戏状态
    const gameStarted = ref(false);
    const roomId = ref(null);
    const currentRound = ref(1);
    const currentQuestion = ref(null);
    const remainingTime = ref(30);
    const totalTime = 30;
    const userAnswer = ref('');
    const submitting = ref(false);
    const answerFeedback = ref(null);
    const correctCount = ref(0);
    const wrongCount = ref(0);

    // 结束状态
    const gameEnded = ref(false);
    const finalCorrect = ref(0);
    const finalWrong = ref(0);
    const finalTotal = ref(0);
    const wrongQuestions = ref([]);

    // Toast
    const toast = ref({ show: false, message: '', type: 'info' });

    // Timer
    let timerInterval = null;
    const answerInput = ref(null);

    const circumference = 2 * Math.PI * 45;
    const timerOffset = computed(() => {
      const progress = remainingTime.value / totalTime;
      return circumference * (1 - progress);
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
          socket.value.emit('authenticate', { token });
        }
      });

      socket.value.on('authenticated', (data) => {
        myUserId.value = data.userId;
        myUsername.value = data.username;
        loadHistory();
      });

      // 开始游戏
      socket.value.on('challenge-started', (data) => {
        starting.value = false;
        roomId.value = data.roomId;
        currentQuestion.value = data.currentQuestion;
        currentRound.value = data.currentRound;
        correctCount.value = 0;
        wrongCount.value = 0;
        userAnswer.value = '';
        answerFeedback.value = null;
        gameStarted.value = true;
        gameEnded.value = false;
        remainingTime.value = totalTime;
        startTimer();
        setTimeout(() => {
          answerInput.value?.focus();
        }, 100);
      });

      // 答题结果
      socket.value.on('challenge-answer-result', (data) => {
        submitting.value = false;
        const isCorrect = data.isCorrect;
        if (isCorrect) {
          correctCount.value++;
        } else {
          wrongCount.value++;
        }
        answerFeedback.value = {
          isCorrect,
          correctAnswer: data.correctAnswer,
          submittedAnswer: data.submittedAnswer
        };

        // 2秒后自动下一题
        setTimeout(() => {
          answerFeedback.value = null;
          userAnswer.value = '';
        }, 1500);
      });

      // 下一题
      socket.value.on('challenge-next', (data) => {
        currentQuestion.value = data.question;
        currentRound.value = data.currentRound;
        correctCount.value = data.correctCount;
        wrongCount.value = data.wrongCount;
        userAnswer.value = '';
        answerFeedback.value = null;
        remainingTime.value = totalTime;
        startTimer();
        setTimeout(() => {
          answerInput.value?.focus();
        }, 100);
      });

      // 超时反馈
      socket.value.on('challenge-timeouted', (data) => {
        answerFeedback.value = {
          isCorrect: false,
          correctAnswer: data.correctAnswer,
          submittedAnswer: '(超时)'
        };
        setTimeout(() => {
          answerFeedback.value = null;
        }, 1500);
      });

      // 游戏结束
      socket.value.on('challenge-finished', (data) => {
        stopTimer();
        gameEnded.value = true;
        finalCorrect.value = data.correctCount;
        finalWrong.value = data.wrongCount;
        finalTotal.value = data.totalQuestions;
        wrongQuestions.value = data.wrongQuestions || [];
      });

      socket.value.on('error', (data) => {
        console.error('[ChallengeBattle] Socket错误:', data);
        showToast(data.error || '发生错误', 'error');
        submitting.value = false;
      });

      socket.value.on('disconnect', () => {
        console.log('[ChallengeBattle] Socket断开连接');
      });
    };

    const startGame = () => {
      if (!socket.value?.connected) {
        showToast('网络未连接', 'error');
        return;
      }
      starting.value = true;
      socket.value.emit('challenge-start', {
        userId: myUserId.value,
        username: myUsername.value
      });
    };

    const submitAnswer = () => {
      if (!userAnswer.value.trim() || submitting.value) return;
      submitting.value = true;
      stopTimer();
      socket.value.emit('challenge-answer', {
        roomId: roomId.value,
        answer: userAnswer.value.trim()
      });
    };

    const startTimer = () => {
      stopTimer();
      remainingTime.value = totalTime;
      timerInterval = setInterval(() => {
        if (remainingTime.value > 0) {
          remainingTime.value--;
        } else {
          stopTimer();
          // 超时视为答错
          socket.value.emit('challenge-timeout', {
            roomId: roomId.value
          });
        }
      }, 1000);
    };

    const stopTimer = () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };

    const retryGame = () => {
      gameEnded.value = false;
      gameStarted.value = false;
      roomId.value = null;
      currentQuestion.value = null;
      answerFeedback.value = null;
      userAnswer.value = '';
      starting.value = false;
      startGame();
    };

    const confirmQuit = () => {
      if (confirm('确定要结束挑战吗？')) {
        stopTimer();
        socket.value?.emit('challenge-timeout', { roomId: roomId.value });
      }
    };

    const returnToStart = () => {
      gameEnded.value = false;
      gameStarted.value = false;
      roomId.value = null;
      currentQuestion.value = null;
      answerFeedback.value = null;
      userAnswer.value = '';
      loadHistory();
    };

    const goToReview = () => {
      router.push('/challenge/error-book');
    };

    const loadHistory = () => {
      if (!socket.value?.connected || !myUserId.value) return;
      historyLoading.value = true;
      socket.value.emit('challenge-history', { userId: myUserId.value });
      socket.value.once('challenge-history-result', (data) => {
        history.value = data.history || [];
        historyLoading.value = false;
      });
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
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
      starting,
      history,
      historyLoading,
      gameStarted,
      currentRound,
      currentQuestion,
      remainingTime,
      totalTime,
      circumference,
      timerOffset,
      userAnswer,
      submitting,
      answerFeedback,
      correctCount,
      wrongCount,
      gameEnded,
      finalCorrect,
      finalWrong,
      finalTotal,
      wrongQuestions,
      toast,
      answerInput,
      goLogin,
      goBack,
      startGame,
      submitAnswer,
      retryGame,
      returnToStart,
      goToReview,
      confirmQuit,
      formatDate
    };
  }
};
</script>

<style scoped>
/* 全屏布局基础 */
.challenge-battle {
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  position: relative;
  overflow: hidden;
}

.challenge-battle::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="50" font-family="SimSun" font-size="20" text-anchor="middle" fill="rgba(255,255,255,0.03)">诗</text></svg>') repeat;
  pointer-events: none;
  z-index: 0;
}

.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.4), rgba(118, 75, 162, 0.4));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(102, 126, 234, 0.5);
  border-radius: 16px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
}

.glass-button:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.6), rgba(118, 75, 162, 0.6));
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.glass-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.glass-nav-button {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  text-decoration: none;
  transition: all 0.3s ease;
  cursor: pointer;
}

.glass-nav-button:hover {
  background: rgba(255, 255, 255, 0.2);
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
  font-family: 'Noto Serif SC', serif;
  color: #fff;
  font-size: 28px;
  margin-bottom: 16px;
}

.login-prompt .glass-card p {
  font-family: 'Noto Serif SC', serif;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 24px;
}

/* 开始界面 */
.start-panel {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding: 40px;
  display: flex;
  flex-direction: column;
}

.start-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
}

.start-title {
  font-family: 'Noto Serif SC', serif;
  color: #fff;
  margin: 0;
  font-size: 36px;
  font-weight: bold;
}

.start-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  align-items: start;
}

@media (max-width: 800px) {
  .start-content { grid-template-columns: 1fr; }
  .start-panel { padding: 20px; }
}

.start-card {
  text-align: center;
}

.start-icon {
  width: 100px;
  height: 100px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: white;
  font-family: 'Noto Serif SC', serif;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
}

.start-heading {
  font-family: 'Noto Serif SC', serif;
  color: #fff;
  font-size: 26px;
  margin: 0 0 16px 0;
}

.start-desc {
  font-family: 'Noto Serif SC', serif;
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;
  line-height: 1.8;
  margin: 0 0 28px 0;
}

.rule-list {
  text-align: left;
  margin-bottom: 32px;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.rule-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  flex-shrink: 0;
}

.rule-text {
  font-family: 'Noto Serif SC', serif;
  color: rgba(255, 255, 255, 0.85);
  font-size: 15px;
}

.start-btn {
  padding: 16px 56px;
  font-size: 20px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.5), rgba(118, 75, 162, 0.5));
  font-weight: bold;
}

/* 历史战绩 */
.history-card .panel-title {
  font-family: 'Noto Serif SC', serif;
  color: #fff;
  margin: 0 0 24px 0;
  font-size: 20px;
  font-weight: bold;
}

.loading-mini {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  padding: 24px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Noto Serif SC', serif;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(102, 126, 234, 0.3);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.no-history {
  text-align: center;
  padding: 24px;
}

.no-history p {
  font-family: 'Noto Serif SC', serif;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 8px 0;
}

.no-history .tip {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-item {
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.history-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.history-date {
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.history-score {
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  font-weight: bold;
}

.history-bar-wrap {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.history-bar {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 3px;
  transition: width 0.5s ease;
}

/* ========== 全屏游戏界面 ========== */
.game-room-fullscreen {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.game-hud-full {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 48px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.hud-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.game-title {
  font-family: 'Noto Serif SC', serif;
  color: #fff;
  margin: 0;
  font-size: 28px;
  font-weight: bold;
}

.round-badge {
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border-radius: 24px;
  font-family: 'Noto Serif SC', serif;
  font-weight: bold;
  font-size: 15px;
}

.hud-center {
  display: flex;
  align-items: center;
}

.score-display {
  font-family: 'Noto Serif SC', serif;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.score-correct { color: #4ade80; font-weight: bold; }
.score-wrong { color: #f87171; font-weight: bold; }
.score-sep { color: rgba(255, 255, 255, 0.4); }

.hud-right { display: flex; align-items: center; }

.quit-game-btn {
  padding: 10px 24px;
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.quit-game-btn:hover {
  background: rgba(239, 68, 68, 0.3);
}

/* 主游戏区域 - 三栏布局 */
.game-main-area {
  flex: 1;
  display: grid;
  grid-template-columns: 200px 1fr 240px;
  gap: 40px;
  padding: 40px 48px;
  align-items: start;
}

/* 左侧计时器 */
.timer-section {
  position: sticky;
  top: 40px;
}

.timer-ring {
  width: 160px;
  height: 160px;
  position: relative;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  padding: 16px;
  box-sizing: border-box;
}

.timer-ring.warning .timer-number {
  color: #fbbf24;
  animation: pulse 0.5s ease-in-out infinite;
}

.timer-ring.danger .timer-number {
  color: #f87171;
  animation: pulse 0.3s ease-in-out infinite;
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
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 8;
}

.timer-progress {
  fill: none;
  stroke: #667eea;
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}

.timer-ring.warning .timer-progress { stroke: #fbbf24; }
.timer-ring.danger .timer-progress { stroke: #f87171; }

.timer-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.timer-number {
  font-family: 'Noto Serif SC', serif;
  font-size: 42px;
  font-weight: bold;
  color: #fff;
  transition: color 0.3s;
}

.timer-label {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

/* 中央题目区域 */
.question-area {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.question-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 24px;
  padding: 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.question-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.question-type {
  padding: 8px 20px;
  background: rgba(102, 126, 234, 0.2);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 12px;
  color: #a5b4fc;
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  font-weight: bold;
}

.question-poem-info {
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
}

.question-text {
  font-size: 36px;
  font-family: 'Noto Serif SC', serif;
  text-align: center;
  color: #fff;
  padding: 40px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 20px;
  line-height: 1.6;
  letter-spacing: 4px;
}

.answer-section {
  display: flex;
  gap: 16px;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 24px;
}

.answer-input {
  flex: 1;
  padding: 18px 24px;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(102, 126, 234, 0.3);
  border-radius: 16px;
  font-size: 22px;
  font-family: 'Noto Serif SC', serif;
  color: #fff;
  outline: none;
  transition: all 0.3s ease;
}

.answer-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
}

.answer-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.submit-btn {
  padding: 18px 40px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
  white-space: nowrap;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.4);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 右侧进度 */
.progress-section {
  position: sticky;
  top: 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.progress-card, .accuracy-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  padding: 24px;
}

.progress-title, .accuracy-title {
  font-family: 'Noto Serif SC', serif;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  margin-bottom: 16px;
}

.progress-bar {
  height: 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 12px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 5px;
  transition: width 0.5s ease;
}

.progress-text {
  font-family: 'Noto Serif SC', serif;
  color: rgba(255, 255, 255, 0.9);
  font-size: 20px;
  font-weight: bold;
  text-align: center;
}

.accuracy-value {
  font-family: 'Noto Serif SC', serif;
  color: #a5b4fc;
  font-size: 36px;
  font-weight: bold;
  text-align: center;
}

/* 答题反馈 */
.feedback-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.feedback-card {
  text-align: center;
  padding: 48px;
  max-width: 480px;
  width: 90%;
}

.feedback-correct {
  border-color: rgba(74, 222, 128, 0.5);
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.2), rgba(255, 255, 255, 0.1));
}

.feedback-wrong {
  border-color: rgba(248, 113, 113, 0.4);
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.2), rgba(255, 255, 255, 0.1));
}

.feedback-icon {
  font-size: 72px;
  margin-bottom: 20px;
}

.feedback-correct .feedback-icon { color: #4ade80; }
.feedback-wrong .feedback-icon { color: #f87171; }

.feedback-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 26px;
  font-weight: bold;
  margin: 0 0 12px 0;
}

.feedback-correct .feedback-title { color: #4ade80; }
.feedback-wrong .feedback-title { color: #f87171; }

.feedback-answer {
  font-family: 'Noto Serif SC', serif;
  color: rgba(255, 255, 255, 0.8);
  font-size: 18px;
  margin: 0;
}

.feedback-answer strong { color: #4ade80; }

.feedback-analysis {
  font-family: 'Noto Serif SC', serif;
  color: rgba(255, 255, 255, 0.6);
  font-size: 15px;
  margin: 20px 0 0 0;
  line-height: 1.6;
}

.feedback-fade-enter-active,
.feedback-fade-leave-active {
  transition: opacity 0.3s ease;
}
.feedback-fade-enter-from,
.feedback-fade-leave-to {
  opacity: 0;
}

/* 结果弹窗 */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
}

.modal-content {
  max-width: 560px;
  width: 100%;
  text-align: center;
  padding: 40px;
  max-height: 85vh;
  overflow-y: auto;
}

.modal-title {
  font-family: 'Noto Serif SC', serif;
  color: #fff;
  font-size: 28px;
  font-weight: bold;
  margin: 0 0 24px 0;
}

.result-score-big {
  margin-bottom: 12px;
}

.score-num {
  font-family: 'Noto Serif SC', serif;
  font-size: 72px;
  font-weight: bold;
  color: #4ade80;
  line-height: 1;
}

.score-denom {
  font-family: 'Noto Serif SC', serif;
  font-size: 22px;
  color: rgba(255, 255, 255, 0.7);
}

.result-accuracy {
  font-family: 'Noto Serif SC', serif;
  color: #a5b4fc;
  font-size: 18px;
  margin-bottom: 28px;
}

.result-summary {
  display: flex;
  gap: 32px;
  justify-content: center;
  margin-bottom: 28px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.summary-num {
  font-family: 'Noto Serif SC', serif;
  font-size: 36px;
  font-weight: bold;
}

.correct-item .summary-num { color: #4ade80; }
.wrong-item .summary-num { color: #f87171; }

.summary-label {
  font-family: 'Noto Serif SC', serif;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.6);
}

/* 错题列表 */
.wrong-questions-section {
  text-align: left;
  margin-bottom: 28px;
  max-height: 240px;
  overflow-y: auto;
}

.wrong-title {
  font-family: 'Noto Serif SC', serif;
  color: #f87171;
  font-size: 16px;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.wrong-icon {
  font-size: 18px;
}

.wrong-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wrong-item {
  padding: 14px 18px;
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.2);
  border-radius: 12px;
}

.wrong-q {
  font-family: 'Noto Serif SC', serif;
  color: rgba(255, 255, 255, 0.85);
  font-size: 15px;
  margin-bottom: 8px;
}

.wrong-a {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wrong-yours {
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: #f87171;
}

.wrong-correct {
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: #4ade80;
}

.no-wrong {
  padding: 24px;
  text-align: center;
}

.no-wrong p {
  font-family: 'Noto Serif SC', serif;
  color: #4ade80;
  font-size: 16px;
  margin: 0;
}

.result-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.review-btn {
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.4), rgba(220, 38, 38, 0.4));
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.5);
}

.retry-btn {
  background: linear-gradient(135deg, rgba(74, 222, 128, 0.4), rgba(22, 163, 74, 0.4));
  color: #86efac;
  border-color: rgba(74, 222, 128, 0.5);
  font-weight: bold;
}

.return-btn {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.4), rgba(118, 75, 162, 0.4));
  font-weight: bold;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 32px;
  border-radius: 16px;
  font-family: 'Noto Serif SC', serif;
  font-size: 15px;
  z-index: 300;
  animation: toast-in 0.3s ease;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.toast.info {
  background: rgba(102, 126, 234, 0.95);
  color: white;
}

.toast.success {
  background: rgba(74, 222, 128, 0.95);
  color: white;
}

.toast.error {
  background: rgba(248, 113, 113, 0.95);
  color: white;
}

@keyframes toast-in {
  0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
  100% { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* 响应式 */
@media (max-width: 1200px) {
  .game-main-area {
    grid-template-columns: 160px 1fr 200px;
    gap: 24px;
    padding: 32px;
  }
}

@media (max-width: 900px) {
  .game-main-area {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .timer-section {
    position: static;
    display: flex;
    justify-content: center;
  }
  .progress-section {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }
  .question-text {
    font-size: 28px;
    padding: 28px;
  }
  .answer-section {
    flex-direction: column;
  }
  .submit-btn {
    width: 100%;
  }
  .game-hud-full {
    flex-direction: column;
    gap: 16px;
    padding: 20px;
  }
  .hud-left, .hud-center, .hud-right {
    width: 100%;
    justify-content: center;
  }
}
</style>
