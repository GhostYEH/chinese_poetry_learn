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
    <div v-else-if="!gameStarted && !matching" class="start-panel">
      <div class="start-header">
        <h1 class="start-title">闯关对战</h1>
        <button class="glass-nav-button" @click="goBack">返回闯关</button>
      </div>

      <div class="mode-cards">
        <!-- 单人模式 -->
        <div class="glass-card mode-card single-card">
          <div class="mode-icon">剑</div>
          <h2 class="mode-heading">单人练习</h2>
          <p class="mode-desc">本地快速出题，无需等待对手。系统从诗词库中随机抽取题目，答错自动收录至错题本。</p>
          <div class="rule-list">
            <div class="rule-item"><span class="rule-icon">1</span><span class="rule-text">题目包含上句填下句、下句填上句</span></div>
            <div class="rule-item"><span class="rule-icon">2</span><span class="rule-text">每题限时30秒，超时视为答错</span></div>
            <div class="rule-item"><span class="rule-icon">3</span><span class="rule-text">答错自动收录至错题本</span></div>
            <div class="rule-item"><span class="rule-icon">4</span><span class="rule-text">共30题，答题正确越多成绩越好</span></div>
          </div>
          <button class="glass-button start-btn" @click="startSingleGame" :disabled="starting">
            {{ starting ? '准备中...' : '开始挑战' }}
          </button>
        </div>

        <!-- 双人模式 -->
        <div class="glass-card mode-card dual-card">
          <div class="mode-icon dual-icon">战</div>
          <h2 class="mode-heading">双人对战</h2>
          <p class="mode-desc">实时对战，系统从诗词库随机抽题，双方同题PK。30秒内诗词绝不重复，先答先判！</p>
          <div class="rule-list">
            <div class="rule-item"><span class="rule-icon">1</span><span class="rule-text">两人同答同一道题，先答先判</span></div>
            <div class="rule-item"><span class="rule-icon">2</span><span class="rule-text">每题限时30秒，超时视为答错</span></div>
            <div class="rule-item"><span class="rule-icon">3</span><span class="rule-text">共30题，正确数多者获胜</span></div>
            <div class="rule-item"><span class="rule-icon">4</span><span class="rule-text">30秒内诗词绝不重复</span></div>
          </div>
          <button class="glass-button dual-start-btn" @click="joinDualMatch" :disabled="starting">
            {{ starting ? '匹配中...' : '快速匹配' }}
          </button>
        </div>
      </div>

      <!-- 历史战绩 -->
      <div class="glass-card history-card">
        <h3 class="panel-title">历史战绩</h3>
        <div v-if="historyLoading" class="loading-mini">
          <div class="spinner"></div><span>加载中...</span>
        </div>
        <div v-else-if="history.length === 0" class="no-history">
          <p>暂无历史记录</p><p class="tip">开始挑战即可查看战绩</p>
        </div>
        <div v-else class="history-list">
          <div v-for="(h, idx) in history.slice(0, 5)" :key="idx" class="history-item">
            <div class="history-info">
              <span class="history-date">{{ formatDate(h.ended_at) }}</span>
              <span class="history-mode-tag" :class="h.player2_id ? 'dual' : 'single'">
                {{ h.player2_id ? '双人对战' : '单人练习' }}
              </span>
            </div>
            <div class="history-detail">
              <span v-if="h.player2_id" class="history-players">
                {{ h.player1_name }} <span class="vs">vs</span> {{ h.player2_name || 'AI' }}
              </span>
              <span v-else class="history-score">
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

    <!-- 匹配等待界面 -->
    <div v-else-if="matching" class="matching-panel">
      <div class="matching-card glass-card">
        <div class="matching-spinner"></div>
        <h2 class="matching-title">匹配中...</h2>
        <p class="matching-desc">正在为您寻找对手，请稍候</p>
        <div class="matching-dots">
          <span></span><span></span><span></span>
        </div>
        <button class="glass-button cancel-btn" @click="cancelMatching">取消匹配</button>
      </div>
    </div>

    <!-- 游戏中 - 单人 -->
    <div v-else-if="gameStarted && gameMode === 'single'" class="game-room-fullscreen">
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
        <div class="timer-section">
          <div :class="['timer-ring', { 'warning': remainingTime <= 10, 'danger': remainingTime <= 5 }]">
            <svg class="timer-svg" viewBox="0 0 100 100">
              <circle class="timer-bg" cx="50" cy="50" r="45" />
              <circle class="timer-progress" cx="50" cy="50" r="45"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="timerOffset" />
            </svg>
            <div class="timer-text">
              <span class="timer-number">{{ remainingTime }}</span>
              <span class="timer-label">秒</span>
            </div>
          </div>
        </div>

        <div class="question-area">
          <div v-if="currentQuestion" class="question-card">
            <div class="question-meta">
              <span class="question-type">{{ currentQuestion.type || '诗词接句' }}</span>
              <span class="question-poem-info">{{ currentQuestion.title }} - {{ currentQuestion.author }}</span>
            </div>
            <div class="question-text">{{ currentQuestion.question }}</div>
          </div>

          <div class="answer-section">
            <input v-model="userAnswer" type="text" class="answer-input"
              placeholder="请输入答案" @keyup.enter="submitAnswer"
              ref="answerInput" :disabled="answerFeedback !== null" />
            <button class="submit-btn" @click="submitAnswer"
              :disabled="!userAnswer.trim() || submitting || answerFeedback !== null">
              {{ submitting ? '判定中...' : '提交答案' }}
            </button>
          </div>
        </div>

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

      <!-- 答题反馈 -->
      <transition name="feedback-fade">
        <div v-if="answerFeedback" class="feedback-overlay">
          <div :class="['feedback-card', answerFeedback.isCorrect ? 'feedback-correct' : 'feedback-wrong']">
            <div class="feedback-icon">{{ answerFeedback.isCorrect ? '✓' : '✗' }}</div>
            <p class="feedback-title">{{ answerFeedback.isCorrect ? '回答正确！' : '回答错误' }}</p>
            <p v-if="!answerFeedback.isCorrect" class="feedback-answer">
              正确答案：<strong>{{ answerFeedback.correctAnswer }}</strong>
            </p>
            <p class="feedback-analysis" v-if="currentQuestion?.analysis">{{ currentQuestion.analysis }}</p>
          </div>
        </div>
      </transition>
    </div>

    <!-- 游戏中 - 双人 -->
    <div v-else-if="gameStarted && gameMode === 'dual'" class="game-room-fullscreen dual-mode">
      <!-- 顶部状态栏 -->
      <div class="game-hud-full">
        <div class="hud-left">
          <h1 class="game-title">双人对战</h1>
          <span class="round-badge">第 {{ dualRound }} / 30轮</span>
        </div>
        <div class="hud-center">
          <div class="dual-scores">
            <div class="dual-player-score">
              <span class="dual-player-name">{{ myPlayer.username }}</span>
              <span class="dual-correct">{{ myPlayer.correct }} 正确</span>
            </div>
            <span class="vs-badge">VS</span>
            <div class="dual-player-score opponent">
              <span class="dual-player-name">{{ opponentPlayer?.username || '等待对手...' }}</span>
              <span class="dual-correct">{{ opponentPlayer?.correct ?? '-' }} 正确</span>
            </div>
          </div>
        </div>
        <div class="hud-right">
          <button class="quit-game-btn" @click="confirmQuit">结束对战</button>
        </div>
      </div>

      <!-- 主游戏区域 -->
      <div class="game-main-area">
        <div class="timer-section">
          <div :class="['timer-ring', { 'warning': dualRemainingTime <= 10, 'danger': dualRemainingTime <= 5 }]">
            <svg class="timer-svg" viewBox="0 0 100 100">
              <circle class="timer-bg" cx="50" cy="50" r="45" />
              <circle class="timer-progress" cx="50" cy="50" r="45"
                :stroke-dasharray="circumference"
                :stroke-dashoffset="dualTimerOffset" />
            </svg>
            <div class="timer-text">
              <span class="timer-number">{{ dualRemainingTime }}</span>
              <span class="timer-label">秒</span>
            </div>
          </div>
        </div>

        <div class="question-area">
          <div v-if="dualQuestion" class="question-card">
            <div class="question-meta">
              <span class="question-type">{{ dualQuestion.type || '诗词接句' }}</span>
              <span class="question-poem-info">{{ dualQuestion.title }} - {{ dualQuestion.author }}</span>
            </div>
            <div class="question-text">{{ dualQuestion.question }}</div>
          </div>

          <div class="answer-section">
            <input v-model="dualAnswer" type="text" class="answer-input"
              placeholder="请输入答案" @keyup.enter="submitDualAnswer"
              ref="dualAnswerInput" :disabled="dualAnswerFeedback !== null" />
            <button class="submit-btn" @click="submitDualAnswer"
              :disabled="!dualAnswer.trim() || dualSubmitting || dualAnswerFeedback !== null">
              {{ dualSubmitting ? '判定中...' : '提交答案' }}
            </button>
          </div>

          <!-- 双人答题状态 -->
          <div v-if="dualAnswerFeedback" class="dual-answer-status">
            <div class="dual-status-item my-status" :class="dualAnswerFeedback.myCorrect ? 'correct' : 'wrong'">
              <span class="status-name">{{ myPlayer.username }}</span>
              <span class="status-result">{{ dualAnswerFeedback.myCorrect ? '✓ 正确' : '✗ 错误' }}</span>
            </div>
            <div class="dual-status-item opponent-status" :class="dualAnswerFeedback.opponentCorrect === null ? 'pending' : (dualAnswerFeedback.opponentCorrect ? 'correct' : 'wrong')">
              <span class="status-name">{{ opponentPlayer?.username || '对手' }}</span>
              <span class="status-result">
                <template v-if="dualAnswerFeedback.opponentCorrect === null">等待中...</template>
                <template v-else>{{ dualAnswerFeedback.opponentCorrect ? '✓ 正确' : '✗ 错误' }}</template>
              </span>
            </div>
          </div>
        </div>

        <div class="progress-section">
          <div class="progress-card">
            <div class="progress-title">答题进度</div>
            <div class="progress-bar">
              <div class="progress-fill dual-fill" :style="{ width: ((dualRound - 1) / 30 * 100) + '%' }"></div>
            </div>
            <div class="progress-text">{{ dualRound - 1 }} / 30</div>
          </div>
          <div class="dual-accuracy-card">
            <div class="accuracy-title">当前领先</div>
            <div class="accuracy-value">
              {{ myPlayer.correct > (opponentPlayer?.correct || 0) ? '我方领先' : (myPlayer.correct < (opponentPlayer?.correct || 0) ? '对方领先' : '平局') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 游戏结束 -->
    <div v-if="gameEnded" class="modal-overlay">
      <div class="modal-content glass-card result-modal">
        <!-- 单人结束 -->
        <template v-if="gameMode === 'single'">
          <h3 class="modal-title">挑战结束</h3>
          <div class="result-score-big">
            <span class="score-num">{{ finalCorrect }}</span>
            <span class="score-denom">/ {{ finalTotal }} 题正确</span>
          </div>
          <div class="result-accuracy">正确率 {{ Math.round((finalCorrect / finalTotal) * 100) }}%</div>
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
          <div v-if="wrongQuestions.length > 0" class="wrong-questions-section">
            <h4 class="wrong-title"><span class="wrong-icon">✗</span>错题收录 ({{ wrongQuestions.length }}题)</h4>
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
          <div v-else class="no-wrong"><p>太棒了！本次挑战全部答对！</p></div>
        </template>

        <!-- 双人结束 -->
        <template v-if="gameMode === 'dual'">
          <h3 class="modal-title">{{ dualResult?.winner?.tie ? '平局！' : (dualResult?.winner?.id === myUserId ? '你赢了！' : '你输了') }}</h3>
          <div class="dual-result-scores">
            <div class="dual-result-player" :class="dualResult?.winner?.id === myUserId ? 'winner' : ''">
              <div class="result-player-name">{{ myPlayer.username }}</div>
              <div class="result-player-score">{{ myPlayer.correct }} 正确</div>
            </div>
            <div class="dual-result-vs">VS</div>
            <div class="dual-result-player" :class="dualResult?.winner?.id !== myUserId && !dualResult?.winner?.tie ? 'winner' : ''">
              <div class="result-player-name">{{ opponentPlayer?.username || '对手' }}</div>
              <div class="result-player-score">{{ opponentPlayer?.correct || 0 }} 正确</div>
            </div>
          </div>
          <div class="result-accuracy">
            共 {{ dualResult?.totalRounds || 30 }} 轮
          </div>
        </template>

        <div class="result-actions">
          <button v-if="gameMode === 'single'" class="glass-button review-btn" @click="goToReview">查看错题本</button>
          <button class="glass-button retry-btn" @click="retryGame">再来一局</button>
          <button class="glass-button return-btn" @click="returnToStart">返回大厅</button>
        </div>
      </div>
    </div>

    <!-- Toast通知 -->
    <div v-if="toast.show" :class="['toast', toast.type]">{{ toast.message }}</div>
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

    // 匹配
    const matching = ref(false);

    // 游戏状态
    const gameStarted = ref(false);
    const gameMode = ref('single'); // 'single' | 'dual'
    const roomId = ref(null);

    // 单人模式状态
    const currentRound = ref(1);
    const currentQuestion = ref(null);
    const remainingTime = ref(30);
    const totalTime = 30;
    const userAnswer = ref('');
    const submitting = ref(false);
    const answerFeedback = ref(null);
    const correctCount = ref(0);
    const wrongCount = ref(0);

    // 双人模式状态
    const dualRound = ref(1);
    const dualQuestion = ref(null);
    const dualRemainingTime = ref(30);
    const dualAnswer = ref('');
    const dualSubmitting = ref(false);
    const dualAnswerFeedback = ref(null);
    const dualRoomId = ref(null);
    const myPlayer = ref({ id: null, username: '', correct: 0 });
    const opponentPlayer = ref(null);

    // 结束状态
    const gameEnded = ref(false);
    const finalCorrect = ref(0);
    const finalWrong = ref(0);
    const finalTotal = ref(0);
    const wrongQuestions = ref([]);
    const dualResult = ref(null);

    // Toast
    const toast = ref({ show: false, message: '', type: 'info' });
    let timerInterval = null;
    let dualTimerInterval = null;
    const answerInput = ref(null);
    const dualAnswerInput = ref(null);

    const circumference = 2 * Math.PI * 45;
    const timerOffset = computed(() => circumference * (1 - remainingTime.value / totalTime));
    const dualTimerOffset = computed(() => circumference * (1 - dualRemainingTime.value / totalTime));

    const showToast = (message, type = 'info', duration = 3000) => {
      toast.value = { show: true, message, type };
      setTimeout(() => { toast.value.show = false; }, duration);
    };

    const goLogin = () => {
      localStorage.setItem('redirectPath', '/challenge/battle');
      router.push('/login');
    };
    const goBack = () => router.push('/challenge');
    const goToReview = () => router.push('/challenge/error-book');

    const initSocket = () => {
      socket.value = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

      socket.value.on('connect', () => {
        console.log('[ChallengeBattle] Socket已连接');
        const token = localStorage.getItem('token');
        if (token) socket.value.emit('authenticate', { token });
        socket.value.emit('challenge-match-count');
      });

      socket.value.on('authenticated', (data) => {
        myUserId.value = data.userId;
        myUsername.value = data.username;
        myPlayer.value = { id: data.userId, username: data.username, correct: 0 };
        loadHistory();
      });

      // ========== 单人模式 ==========
      socket.value.on('challenge-started', (data) => {
        starting.value = false;
        roomId.value = data.roomId;
        gameMode.value = 'single';
        currentQuestion.value = data.currentQuestion;
        currentRound.value = data.currentRound;
        correctCount.value = 0;
        wrongCount.value = 0;
        userAnswer.value = '';
        answerFeedback.value = null;
        gameStarted.value = true;
        gameEnded.value = false;
        remainingTime.value = totalTime;
        wrongQuestions.value = [];
        startSingleTimer();
        setTimeout(() => answerInput.value?.focus(), 100);
      });

      socket.value.on('challenge-answer-result', (data) => {
        submitting.value = false;
        if (data.isCorrect) correctCount.value++;
        else wrongCount.value++;
        answerFeedback.value = {
          isCorrect: data.isCorrect,
          correctAnswer: data.correctAnswer
        };
        setTimeout(() => {
          answerFeedback.value = null;
          userAnswer.value = '';
        }, 1500);
      });

      socket.value.on('challenge-next', (data) => {
        currentQuestion.value = data.question;
        currentRound.value = data.currentRound;
        correctCount.value = data.correctCount;
        wrongCount.value = data.wrongCount;
        userAnswer.value = '';
        answerFeedback.value = null;
        remainingTime.value = totalTime;
        startSingleTimer();
        setTimeout(() => answerInput.value?.focus(), 100);
      });

      socket.value.on('challenge-timeouted', (data) => {
        wrongCount.value++;
        answerFeedback.value = {
          isCorrect: false,
          correctAnswer: data.correctAnswer
        };
        currentQuestion.value = data.question;
        currentRound.value = data.currentRound;
        correctCount.value = data.correctCount;
        wrongCount.value = data.wrongCount;
        remainingTime.value = totalTime;
        startSingleTimer();
        setTimeout(() => {
          answerFeedback.value = null;
          userAnswer.value = '';
        }, 1500);
      });

      socket.value.on('challenge-finished', (data) => {
        stopSingleTimer();
        gameEnded.value = true;
        finalCorrect.value = data.correctCount;
        finalWrong.value = data.wrongCount;
        finalTotal.value = data.totalQuestions;
        wrongQuestions.value = data.wrongQuestions || [];
      });

      // ========== 双人模式 ==========
      socket.value.on('challenge-matchmaking-waiting', (data) => {
        matching.value = true;
        starting.value = true;
      });

      socket.value.on('challenge-matchmaking-count', (data) => {
        // 可用这个数字更新UI显示等待人数
      });

      socket.value.on('challenge-dual-started', (data) => {
        matching.value = false;
        starting.value = false;
        gameMode.value = 'dual';
        gameStarted.value = true;
        gameEnded.value = false;
        dualRoomId.value = data.id;
        dualRound.value = data.currentRound;
        dualQuestion.value = data.currentQuestion;
        dualAnswerFeedback.value = null;
        dualAnswer.value = '';

        // 初始化双方玩家
        const me = data.players.find(p => p.id === myUserId.value);
        const other = data.players.find(p => p.id !== myUserId.value);
        if (me) myPlayer.value = { ...me };
        if (other) opponentPlayer.value = { ...other };

        dualRemainingTime.value = totalTime;
        startDualTimer();
        setTimeout(() => dualAnswerInput.value?.focus(), 100);
      });

      socket.value.on('challenge-dual-answer-update', (data) => {
        if (data.playerId === myUserId.value) {
          if (data.isCorrect) myPlayer.value.correct++;
          // 更新对手状态显示
          dualAnswerFeedback.value = {
            myCorrect: data.isCorrect,
            opponentCorrect: null,
            isTimeout: data.isTimeout
          };
          dualSubmitting.value = false;
        } else {
          if (data.isCorrect) opponentPlayer.value.correct++;
          if (dualAnswerFeedback.value) {
            dualAnswerFeedback.value.opponentCorrect = data.isCorrect;
          }
        }
      });

      socket.value.on('challenge-dual-next', (data) => {
        dualQuestion.value = data.question;
        dualRound.value = data.currentRound;
        // 更新双方正确数
        const me = data.players.find(p => p.id === myUserId.value);
        const other = data.players.find(p => p.id !== myUserId.value);
        if (me) myPlayer.value.correct = me.correct;
        if (other) opponentPlayer.value = other;
        dualAnswerFeedback.value = null;
        dualAnswer.value = '';
        dualRemainingTime.value = totalTime;
        startDualTimer();
        setTimeout(() => dualAnswerInput.value?.focus(), 100);
      });

      socket.value.on('challenge-dual-finished', (data) => {
        stopDualTimer();
        gameEnded.value = true;
        dualResult.value = data;
        // 更新最终正确数
        const me = data.players.find(p => p.id === myUserId.value);
        const other = data.players.find(p => p.id !== myUserId.value);
        if (me) myPlayer.value.correct = me.correct;
        if (other) opponentPlayer.value = other;
      });

      socket.value.on('challenge-matchmaking-cancelled', () => {
        matching.value = false;
        starting.value = false;
      });

      socket.value.on('error', (data) => {
        console.error('[ChallengeBattle] Socket错误:', data);
        showToast(data.error || '发生错误', 'error');
        starting.value = false;
        submitting.value = false;
        dualSubmitting.value = false;
      });

      socket.value.on('disconnect', () => {
        console.log('[ChallengeBattle] Socket断开连接');
        if (matching.value) cancelMatching();
      });
    };

    // ========== 单人模式方法 ==========
    const startSingleGame = () => {
      if (!socket.value?.connected) { showToast('网络未连接', 'error'); return; }
      starting.value = true;
      socket.value.emit('challenge-start', { userId: myUserId.value, username: myUsername.value });
    };

    const submitAnswer = () => {
      if (!userAnswer.value.trim() || submitting.value) return;
      submitting.value = true;
      stopSingleTimer();
      socket.value.emit('challenge-answer', { roomId: roomId.value, answer: userAnswer.value.trim() });
    };

    const startSingleTimer = () => {
      stopSingleTimer();
      remainingTime.value = totalTime;
      timerInterval = setInterval(() => {
        if (remainingTime.value > 0) remainingTime.value--;
        else {
          stopSingleTimer();
          socket.value.emit('challenge-timeout', { roomId: roomId.value });
        }
      }, 1000);
    };

    const stopSingleTimer = () => {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    };

    // ========== 双人模式方法 ==========
    const joinDualMatch = () => {
      if (!socket.value?.connected) { showToast('网络未连接', 'error'); return; }
      starting.value = true;
      socket.value.emit('challenge-match-start', { userId: myUserId.value, username: myUsername.value });
    };

    const cancelMatching = () => {
      socket.value?.emit('challenge-match-cancel');
      matching.value = false;
      starting.value = false;
    };

    const submitDualAnswer = () => {
      if (!dualAnswer.value.trim() || dualSubmitting.value) return;
      dualSubmitting.value = true;
      stopDualTimer();
      socket.value.emit('challenge-dual-answer', { roomId: dualRoomId.value, answer: dualAnswer.value.trim() });
    };

    const startDualTimer = () => {
      stopDualTimer();
      dualRemainingTime.value = totalTime;
      dualTimerInterval = setInterval(() => {
        if (dualRemainingTime.value > 0) dualRemainingTime.value--;
        else {
          stopDualTimer();
          socket.value.emit('challenge-dual-timeout', { roomId: dualRoomId.value });
        }
      }, 1000);
    };

    const stopDualTimer = () => {
      if (dualTimerInterval) { clearInterval(dualTimerInterval); dualTimerInterval = null; }
    };

    // ========== 通用 ==========
    const retryGame = () => {
      gameEnded.value = false;
      gameStarted.value = false;
      roomId.value = null;
      dualRoomId.value = null;
      currentQuestion.value = null;
      dualQuestion.value = null;
      answerFeedback.value = null;
      dualAnswerFeedback.value = null;
      userAnswer.value = '';
      dualAnswer.value = '';
      myPlayer.value = { id: myUserId.value, username: myUsername.value, correct: 0 };
      opponentPlayer.value = null;
      dualResult.value = null;
      if (gameMode.value === 'single') startSingleGame();
      else joinDualMatch();
    };

    const confirmQuit = () => {
      if (confirm('确定要结束吗？')) {
        if (gameMode.value === 'single') {
          stopSingleTimer();
          socket.value?.emit('challenge-timeout', { roomId: roomId.value });
        } else {
          stopDualTimer();
          // 双人退出需要通知对方，这里简化处理直接返回
          returnToStart();
        }
      }
    };

    const returnToStart = () => {
      stopSingleTimer();
      stopDualTimer();
      gameEnded.value = false;
      gameStarted.value = false;
      matching.value = false;
      roomId.value = null;
      dualRoomId.value = null;
      currentQuestion.value = null;
      dualQuestion.value = null;
      answerFeedback.value = null;
      dualAnswerFeedback.value = null;
      userAnswer.value = '';
      dualAnswer.value = '';
      myPlayer.value = { id: myUserId.value, username: myUsername.value, correct: 0 };
      opponentPlayer.value = null;
      dualResult.value = null;
      loadHistory();
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
      if (isLoggedIn.value) initSocket();
    });

    onUnmounted(() => {
      stopSingleTimer();
      stopDualTimer();
      if (socket.value) {
        socket.value.disconnect();
        socket.value = null;
      }
    });

    return {
      isLoggedIn, starting, history, historyLoading,
      matching, gameStarted, gameMode,
      currentRound, currentQuestion, remainingTime, totalTime,
      circumference, timerOffset, dualTimerOffset,
      userAnswer, submitting, answerFeedback, correctCount, wrongCount,
      dualRound, dualQuestion, dualRemainingTime, dualAnswer,
      dualSubmitting, dualAnswerFeedback, myPlayer, opponentPlayer,
      gameEnded, finalCorrect, finalWrong, finalTotal,
      wrongQuestions, dualResult,
      toast, answerInput, dualAnswerInput,
      goLogin, goBack, goToReview,
      startSingleGame, submitAnswer, joinDualMatch, cancelMatching,
      submitDualAnswer, retryGame, confirmQuit, returnToStart, formatDate
    };
  }
};
</script>

<style scoped>
.challenge-battle {
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow-x: hidden;
}
.challenge-battle::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  z-index: -2;
  pointer-events: none;
}
.challenge-battle::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="50" font-family="SimSun" font-size="20" text-anchor="middle" fill="rgba(255,255,255,0.03)">诗</text></svg>') repeat;
  pointer-events: none;
  z-index: -1;
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
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
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
.glass-button:disabled { opacity: 0.6; cursor: not-allowed; }
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
.glass-nav-button:hover { background: rgba(255,255,255,0.2); transform: translateY(-2px); }

/* 登录提示 */
.login-prompt { text-align: center; padding: 80px 20px; position: relative; z-index: 1; }
.login-prompt .glass-card h3 { font-family: 'Noto Serif SC', serif; color: #fff; font-size: 28px; margin-bottom: 16px; }
.login-prompt .glass-card p { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.7); margin-bottom: 24px; }

/* 开始界面 */
.start-panel { position: relative; z-index: 1; min-height: 100vh; padding: 40px; display: flex; flex-direction: column; }
.start-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
.start-title { font-family: 'Noto Serif SC', serif; color: #fff; margin: 0; font-size: 36px; font-weight: bold; }
.mode-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; max-width: 1000px; margin: 0 auto 40px; width: 100%; }
@media (max-width: 700px) { .mode-cards { grid-template-columns: 1fr; } }
.mode-card { text-align: center; }
.mode-icon {
  width: 90px; height: 90px; margin: 0 auto 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 42px; color: white; font-family: 'Noto Serif SC', serif;
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.4);
}
.dual-icon { background: linear-gradient(135deg, #f093fb, #f5576c); box-shadow: 0 8px 32px rgba(245, 87, 108, 0.4); }
.mode-heading { font-family: 'Noto Serif SC', serif; color: #fff; font-size: 24px; margin: 0 0 12px 0; }
.mode-desc { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.7); font-size: 14px; line-height: 1.7; margin: 0 0 24px 0; }
.rule-list { text-align: left; margin-bottom: 28px; }
.rule-item { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.rule-icon { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); color: white; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; flex-shrink: 0; }
.rule-text { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.8); font-size: 14px; }
.start-btn { padding: 14px 48px; font-size: 18px; background: linear-gradient(135deg, rgba(102,126,234,0.5), rgba(118,75,162,0.5)); font-weight: bold; }
.dual-start-btn { padding: 14px 48px; font-size: 18px; background: linear-gradient(135deg, rgba(245,87,108,0.5), rgba(240,147,251,0.5)); font-weight: bold; }

/* 历史战绩 */
.history-card { max-width: 1000px; margin: 0 auto; width: 100%; }
.history-card .panel-title { font-family: 'Noto Serif SC', serif; color: #fff; margin: 0 0 20px 0; font-size: 18px; font-weight: bold; }
.loading-mini { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 24px; color: rgba(255,255,255,0.7); font-family: 'Noto Serif SC', serif; }
.spinner { width: 24px; height: 24px; border: 2px solid rgba(102,126,234,0.3); border-top-color: #667eea; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.no-history { text-align: center; padding: 24px; }
.no-history p { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.6); margin: 0 0 8px 0; }
.no-history .tip { font-size: 13px; color: rgba(255,255,255,0.4); }
.history-list { display: flex; flex-direction: column; gap: 12px; }
.history-item { padding: 14px 18px; background: rgba(255,255,255,0.05); border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); }
.history-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.history-date { font-family: 'Noto Serif SC', serif; font-size: 13px; color: rgba(255,255,255,0.6); }
.history-mode-tag { padding: 3px 10px; border-radius: 10px; font-size: 12px; font-family: 'Noto Serif SC', serif; }
.history-mode-tag.single { background: rgba(102,126,234,0.3); color: #a5b4fc; }
.history-mode-tag.dual { background: rgba(245,87,108,0.3); color: #fda4af; }
.history-detail { margin-bottom: 10px; }
.history-players, .history-score { font-family: 'Noto Serif SC', serif; font-size: 14px; color: rgba(255,255,255,0.85); }
.vs { color: rgba(255,255,255,0.4); margin: 0 8px; }
.history-bar-wrap { height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
.history-bar { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 3px; transition: width 0.5s ease; }

/* 匹配界面 */
.matching-panel { position: relative; z-index: 1; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.matching-card { text-align: center; max-width: 400px; width: 90%; }
.matching-spinner { width: 64px; height: 64px; border: 4px solid rgba(102,126,234,0.3); border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 24px; }
.matching-title { font-family: 'Noto Serif SC', serif; color: #fff; font-size: 28px; margin: 0 0 12px 0; }
.matching-desc { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.6); font-size: 15px; margin: 0 0 24px 0; }
.matching-dots { display: flex; gap: 8px; justify-content: center; margin-bottom: 28px; }
.matching-dots span { width: 10px; height: 10px; background: #667eea; border-radius: 50%; animation: dot-bounce 1.4s ease-in-out infinite; }
.matching-dots span:nth-child(2) { animation-delay: 0.2s; }
.matching-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-bounce { 0%, 80%, 100% { transform: scale(1); opacity: 0.5; } 40% { transform: scale(1.3); opacity: 1; } }
.cancel-btn { background: rgba(239,68,68,0.3); border-color: rgba(239,68,68,0.4); }

/* ========== 全屏游戏界面 ========== */
.game-room-fullscreen { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; }
.dual-mode { background: linear-gradient(135deg, #1a1a2e 0%, #1f1035 50%, #0f3460 100%); }
.game-hud-full { display: flex; justify-content: space-between; align-items: center; padding: 24px 48px; background: rgba(0,0,0,0.3); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.1); }
.hud-left { display: flex; align-items: center; gap: 24px; }
.game-title { font-family: 'Noto Serif SC', serif; color: #fff; margin: 0; font-size: 28px; font-weight: bold; }
.round-badge { padding: 10px 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 24px; font-family: 'Noto Serif SC', serif; font-weight: bold; font-size: 15px; }
.hud-center { display: flex; align-items: center; }
.score-display { font-family: 'Noto Serif SC', serif; font-size: 18px; display: flex; align-items: center; gap: 12px; }
.score-correct { color: #4ade80; font-weight: bold; }
.score-wrong { color: #f87171; font-weight: bold; }
.score-sep { color: rgba(255,255,255,0.4); }

/* 双人分数 */
.dual-scores { display: flex; align-items: center; gap: 20px; }
.dual-player-score { text-align: center; }
.dual-player-name { display: block; font-family: 'Noto Serif SC', serif; color: #fff; font-size: 16px; font-weight: bold; }
.dual-correct { display: block; font-family: 'Noto Serif SC', serif; color: #4ade80; font-size: 20px; font-weight: bold; }
.dual-player-score.opponent .dual-player-name { color: rgba(255,255,255,0.7); }
.dual-player-score.opponent .dual-correct { color: #a5b4fc; }
.vs-badge { padding: 6px 16px; background: rgba(245,87,108,0.2); border: 1px solid rgba(245,87,108,0.3); border-radius: 12px; color: #fda4af; font-family: 'Noto Serif SC', serif; font-size: 14px; font-weight: bold; }

.hud-right { display: flex; align-items: center; }
.quit-game-btn { padding: 10px 24px; background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; font-size: 14px; cursor: pointer; transition: all 0.3s ease; font-family: 'Noto Serif SC', serif; }
.quit-game-btn:hover { background: rgba(239,68,68,0.3); }

/* 主游戏区域 */
.game-main-area { flex: 1; display: grid; grid-template-columns: 200px 1fr 240px; gap: 40px; padding: 40px 48px; align-items: start; }
@media (max-width: 900px) { .game-main-area { grid-template-columns: 1fr; gap: 24px; padding: 24px; } .timer-section, .progress-section { position: static !important; flex-direction: row; justify-content: center; } }

/* 计时器 */
.timer-section { position: sticky; top: 40px; }
.timer-ring { width: 160px; height: 160px; position: relative; background: rgba(255,255,255,0.05); border-radius: 50%; padding: 16px; box-sizing: border-box; }
.timer-ring.warning .timer-number { color: #fbbf24; animation: pulse 0.5s ease-in-out infinite; }
.timer-ring.danger .timer-number { color: #f87171; animation: pulse 0.3s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
.timer-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.timer-bg { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 8; }
.timer-progress { fill: none; stroke: #667eea; stroke-width: 8; stroke-linecap: round; transition: stroke-dashoffset 1s linear; }
.timer-ring.warning .timer-progress { stroke: #fbbf24; }
.timer-ring.danger .timer-progress { stroke: #f87171; }
.timer-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 4px; }
.timer-number { font-family: 'Noto Serif SC', serif; font-size: 42px; font-weight: bold; color: #fff; transition: color 0.3s; }
.timer-label { font-family: 'Noto Serif SC', serif; font-size: 14px; color: rgba(255,255,255,0.6); }

/* 中央题目区域 */
.question-area { display: flex; flex-direction: column; gap: 28px; }
.question-card { background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15); border-radius: 24px; padding: 36px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
.question-meta { display: flex; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.question-type { padding: 8px 18px; background: rgba(102,126,234,0.2); border: 1px solid rgba(102,126,234,0.3); border-radius: 12px; color: #a5b4fc; font-family: 'Noto Serif SC', serif; font-size: 14px; font-weight: bold; }
.question-poem-info { padding: 8px 18px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: rgba(255,255,255,0.7); font-family: 'Noto Serif SC', serif; font-size: 14px; }
.question-text { font-size: 34px; font-family: 'Noto Serif SC', serif; text-align: center; color: #fff; padding: 36px; background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1)); border: 1px solid rgba(102,126,234,0.2); border-radius: 18px; line-height: 1.5; letter-spacing: 4px; }

/* 答题区 */
.answer-section { display: flex; gap: 14px; background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 22px; }
.answer-input { flex: 1; padding: 16px 22px; background: rgba(0,0,0,0.3); border: 2px solid rgba(102,126,234,0.3); border-radius: 14px; font-size: 20px; font-family: 'Noto Serif SC', serif; color: #fff; outline: none; transition: all 0.3s ease; }
.answer-input:focus { border-color: #667eea; box-shadow: 0 0 20px rgba(102,126,234,0.3); }
.answer-input::placeholder { color: rgba(255,255,255,0.4); }
.submit-btn { padding: 16px 36px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 14px; font-size: 17px; font-weight: bold; cursor: pointer; transition: all 0.3s ease; font-family: 'Noto Serif SC', serif; white-space: nowrap; }
.submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(102,126,234,0.4); }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* 双人答题状态 */
.dual-answer-status { display: flex; gap: 16px; }
.dual-status-item { flex: 1; padding: 16px 20px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.my-status { background: rgba(102,126,234,0.15); border: 1px solid rgba(102,126,234,0.3); }
.my-status.correct { background: rgba(74,222,128,0.15); border-color: rgba(74,222,128,0.3); }
.my-status.wrong { background: rgba(248,113,113,0.15); border-color: rgba(248,113,113,0.3); }
.opponent-status { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
.opponent-status.pending { opacity: 0.7; }
.opponent-status.correct { background: rgba(74,222,128,0.15); border-color: rgba(74,222,128,0.3); }
.opponent-status.wrong { background: rgba(248,113,113,0.15); border-color: rgba(248,113,113,0.3); }
.status-name { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.8); font-size: 14px; }
.status-result { font-family: 'Noto Serif SC', serif; font-size: 16px; font-weight: bold; }
.my-status.correct .status-result { color: #4ade80; }
.my-status.wrong .status-result { color: #f87171; }
.opponent-status.correct .status-result { color: #4ade80; }
.opponent-status.wrong .status-result { color: #f87171; }

/* 右侧进度 */
.progress-section { position: sticky; top: 40px; display: flex; flex-direction: column; gap: 20px; }
.progress-card, .accuracy-card { background: rgba(255,255,255,0.08); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.15); border-radius: 18px; padding: 22px; }
.progress-title, .accuracy-title { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 14px; }
.progress-bar { height: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; overflow: hidden; margin-bottom: 10px; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 5px; transition: width 0.5s ease; }
.progress-fill.dual-fill { background: linear-gradient(90deg, #f093fb, #f5576c); }
.progress-text { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.9); font-size: 20px; font-weight: bold; text-align: center; }
.accuracy-value { font-family: 'Noto Serif SC', serif; color: #a5b4fc; font-size: 32px; font-weight: bold; text-align: center; }
.dual-accuracy-card .accuracy-value { font-size: 18px; }

/* 答题反馈 */
.feedback-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; }
.feedback-card { text-align: center; padding: 44px; max-width: 460px; width: 90%; border-radius: 24px; }
.feedback-correct { border: 1px solid rgba(74,222,128,0.5); background: linear-gradient(135deg, rgba(74,222,128,0.2), rgba(255,255,255,0.1)); }
.feedback-wrong { border: 1px solid rgba(248,113,113,0.4); background: linear-gradient(135deg, rgba(248,113,113,0.2), rgba(255,255,255,0.1)); }
.feedback-icon { font-size: 68px; margin-bottom: 18px; }
.feedback-correct .feedback-icon { color: #4ade80; }
.feedback-wrong .feedback-icon { color: #f87171; }
.feedback-title { font-family: 'Noto Serif SC', serif; font-size: 24px; font-weight: bold; margin: 0 0 10px 0; }
.feedback-correct .feedback-title { color: #4ade80; }
.feedback-wrong .feedback-title { color: #f87171; }
.feedback-answer { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.8); font-size: 17px; margin: 0; }
.feedback-answer strong { color: #4ade80; }
.feedback-analysis { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.6); font-size: 14px; margin: 18px 0 0 0; line-height: 1.6; }
.feedback-fade-enter-active, .feedback-fade-leave-active { transition: opacity 0.3s ease; }
.feedback-fade-enter-from, .feedback-fade-leave-to { opacity: 0; }

/* 结果弹窗 */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
.modal-content { max-width: 520px; width: 100%; text-align: center; padding: 40px; max-height: 85vh; overflow-y: auto; }
.modal-title { font-family: 'Noto Serif SC', serif; color: #fff; font-size: 28px; font-weight: bold; margin: 0 0 20px 0; }
.result-score-big { margin-bottom: 10px; }
.score-num { font-family: 'Noto Serif SC', serif; font-size: 68px; font-weight: bold; color: #4ade80; line-height: 1; }
.score-denom { font-family: 'Noto Serif SC', serif; font-size: 20px; color: rgba(255,255,255,0.7); }
.result-accuracy { font-family: 'Noto Serif SC', serif; color: #a5b4fc; font-size: 17px; margin-bottom: 24px; }
.result-summary { display: flex; gap: 28px; justify-content: center; margin-bottom: 24px; }
.summary-item { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.summary-num { font-family: 'Noto Serif SC', serif; font-size: 34px; font-weight: bold; }
.correct-item .summary-num { color: #4ade80; }
.wrong-item .summary-num { color: #f87171; }
.summary-label { font-family: 'Noto Serif SC', serif; font-size: 14px; color: rgba(255,255,255,0.6); }

/* 双人结果 */
.dual-result-scores { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 20px; }
.dual-result-player { padding: 20px 28px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; text-align: center; }
.dual-result-player.winner { background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,165,0,0.1)); border-color: rgba(255,215,0,0.4); }
.result-player-name { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.8); font-size: 15px; margin-bottom: 6px; }
.result-player-score { font-family: 'Noto Serif SC', serif; color: #4ade80; font-size: 22px; font-weight: bold; }
.dual-result-vs { font-family: 'Noto Serif SC', serif; font-size: 20px; color: rgba(255,255,255,0.4); font-weight: bold; }

/* 错题列表 */
.wrong-questions-section { text-align: left; margin-bottom: 24px; max-height: 220px; overflow-y: auto; }
.wrong-title { font-family: 'Noto Serif SC', serif; color: #f87171; font-size: 15px; margin: 0 0 14px 0; display: flex; align-items: center; gap: 8px; }
.wrong-icon { font-size: 16px; }
.wrong-list { display: flex; flex-direction: column; gap: 10px; }
.wrong-item { padding: 12px 16px; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.2); border-radius: 12px; }
.wrong-q { font-family: 'Noto Serif SC', serif; color: rgba(255,255,255,0.85); font-size: 14px; margin-bottom: 6px; }
.wrong-a { display: flex; flex-direction: column; gap: 3px; }
.wrong-yours { font-family: 'Noto Serif SC', serif; font-size: 12px; color: #f87171; }
.wrong-correct { font-family: 'Noto Serif SC', serif; font-size: 12px; color: #4ade80; }
.no-wrong { padding: 22px; text-align: center; }
.no-wrong p { font-family: 'Noto Serif SC', serif; color: #4ade80; font-size: 15px; margin: 0; }

.result-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.review-btn { background: linear-gradient(135deg, rgba(248,113,113,0.4), rgba(220,38,38,0.4)); color: #fca5a5; border-color: rgba(248,113,113,0.5); }
.retry-btn { background: linear-gradient(135deg, rgba(74,222,128,0.4), rgba(22,163,74,0.4)); color: #86efac; border-color: rgba(74,222,128,0.5); font-weight: bold; }
.return-btn { background: linear-gradient(135deg, rgba(102,126,234,0.4), rgba(118,75,162,0.4)); font-weight: bold; }

/* Toast */
.toast { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); padding: 14px 30px; border-radius: 14px; font-family: 'Noto Serif SC', serif; font-size: 15px; z-index: 300; animation: toast-in 0.3s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
.toast.info { background: rgba(102,126,234,0.95); color: white; }
.toast.success { background: rgba(74,222,128,0.95); color: white; }
.toast.error { background: rgba(248,113,113,0.95); color: white; }
@keyframes toast-in { 0% { opacity: 0; transform: translateX(-50%) translateY(20px); } 100% { opacity: 1; transform: translateX(-50%) translateY(0); } }
</style>
