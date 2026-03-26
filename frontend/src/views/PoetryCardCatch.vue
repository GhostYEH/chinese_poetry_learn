<template>
  <div ref="rootRef" class="card-catch-wrapper" @keydown.prevent @keyup.prevent>
    <!-- ===== 开始菜单 ===== -->
    <div v-if="phase === 'MENU'" class="overlay menu-overlay">
      <div class="menu-card glass-card">
        <div class="card-decor">📜</div>
        <h1 class="game-title">诗词卡片接取</h1>
        <p class="game-subtitle">穿越诗意卷轴，检验你的诗词功底</p>

        <div class="rules-box">
          <div class="rule-row"><span class="rk">A / ←</span><span>向左移动</span></div>
          <div class="rule-row"><span class="rk">D / →</span><span>向右移动</span></div>
          <div class="rule-row"><span class="rk ok">✓</span><span>接正确诗句 +1分</span></div>
          <div class="rule-row"><span class="rk err">✗</span><span>接错误诗句 失误+1</span></div>
          <div class="rule-row"><span class="rk warn">✕</span><span>漏掉正确 扣1分</span></div>
          <div class="rule-row"><span class="rk danger">❤</span><span>失误满5次 游戏结束</span></div>
        </div>

        <div class="difficulty-row">
          <span class="diff-lbl">难度：</span>
          <button
            v-for="d in DIFFICULTIES"
            :key="d.value"
            :class="['diff-btn', { active: diff === d.value }]"
            @click="diff = d.value"
          >{{ d.label }}</button>
        </div>

        <button class="primary-btn" @click="startGame">
          <span>🎮 开始接取</span>
        </button>
        <button class="secondary-btn" @click="$router.push('/')">
          返回首页
        </button>
      </div>
    </div>

    <!-- ===== 游戏 HUD ===== -->
    <div v-if="phase === 'PLAYING' || phase === 'PAUSED'" class="game-hud">
      <div class="hud-item hud-left">
        <span class="hud-label">失误</span>
        <span class="hud-val" :class="{ 'danger': wrongCount >= 3 }">
          <span v-for="i in 5" :key="i" :class="['miss-dot', { lost: i <= wrongCount }]">❤</span>
        </span>
      </div>
      <div class="hud-item hud-center">
        <div class="level-badge" :class="`level-${gameLevel}`">
          {{ levelLabel }}
        </div>
      </div>
      <div class="hud-item hud-right">
        <div class="score-block">
          <span class="score-lbl">得分</span>
          <span class="score-num" :class="{ bounce: scoreAnim }">{{ score }}</span>
        </div>
        <div class="time-block">
          <span class="time-lbl">用时</span>
          <span class="time-num">{{ formatTime(elapsed) }}</span>
        </div>
      </div>
    </div>

    <!-- ===== Canvas 游戏区 ===== -->
    <div class="canvas-wrap" ref="wrapRef" tabindex="0">
      <canvas ref="canvasRef" class="game-canvas" />
    </div>

    <!-- ===== 暂停遮罩 ===== -->
    <div v-if="phase === 'PAUSED'" class="overlay pause-overlay">
      <div class="pause-card glass-card">
        <div class="pause-title">⏸ 游戏暂停</div>
        <div class="pause-stats">
          <div class="ps"><span>当前得分</span><span class="pv">{{ score }}</span></div>
          <div class="ps"><span>已用时间</span><span class="pv">{{ formatTime(elapsed) }}</span></div>
          <div class="ps"><span>失误次数</span><span class="pv danger">{{ wrongCount }}/5</span></div>
        </div>
        <button class="primary-btn" @click="resumeGame">继续游戏</button>
        <button class="danger-btn" @click="quitGame">退出游戏</button>
      </div>
    </div>

    <!-- ===== 游戏结束遮罩 ===== -->
    <div v-if="phase === 'GAME_OVER'" class="overlay gameover-overlay">
      <div class="go-card glass-card">
        <div class="go-badge">🎯</div>
        <div class="go-title">本轮结束</div>
        <div class="go-stats">
          <div class="gs">
            <span class="gl">最终得分</span>
            <span class="gv score-val">{{ score }}</span>
          </div>
          <div class="gs">
            <span class="gl">游戏时长</span>
            <span class="gv">{{ formatTime(elapsed) }}</span>
          </div>
          <div class="gs">
            <span class="gl">接取正确</span>
            <span class="gv correct-val">{{ correctCount }}</span>
          </div>
          <div class="gs">
            <span class="gl">漏掉正确</span>
            <span class="gv miss-val">{{ missedCount }}</span>
          </div>
          <div class="gs">
            <span class="gl">失误次数</span>
            <span class="gv danger-val">{{ wrongCount }}</span>
          </div>
        </div>
        <div class="go-grade">
          <span>评级：</span>
          <span :class="['grade-chip', gradeClass]">{{ gradeText }}</span>
        </div>
        <div class="go-actions">
          <button class="primary-btn" @click="showReview">📋 查看复盘</button>
          <button class="secondary-btn" @click="restartGame">🔄 再来一局</button>
          <button class="secondary-btn" @click="quitGame">🏠 返回首页</button>
        </div>
      </div>
    </div>

    <!-- ===== 复盘界面 ===== -->
    <div v-if="phase === 'REVIEW'" class="overlay review-overlay">
      <div class="review-card glass-card">
        <div class="review-header">
          <button class="back-btn" @click="quitGame">← 返回</button>
          <h2 class="review-title">📜 复盘讲解</h2>
          <button class="secondary-btn sm" @click="restartGame">再来一局</button>
        </div>

        <!-- 加载状态 -->
        <div v-if="reviewLoading" class="review-loading">
          <div class="spinner"></div>
          <p>AI 正在生成讲解...</p>
        </div>

        <!-- 无错误 -->
        <div v-else-if="reviewErrors.length === 0" class="review-empty">
          <div class="empty-icon">🎉</div>
          <h3>太棒了！本轮没有错误！</h3>
          <p>你的诗词功底非常扎实！</p>
        </div>

        <!-- 错误列表 -->
        <div v-else class="review-list">
          <div class="review-legend">
            <span>共 <strong>{{ reviewErrors.length }}</strong> 条错误，正在加载 AI 讲解...</span>
          </div>
          <div
            v-for="(err, idx) in reviewErrors"
            :key="idx"
            class="review-item glass-card"
          >
            <div class="review-item-header">
              <span class="review-num">{{ idx + 1 }}</span>
              <span class="review-tag wrong">错误</span>
              <button
                class="add-review-btn"
                :class="{ added: err.addedToReview }"
                :disabled="err.addedToReview"
                @click="addToReview(err)"
              >
                {{ err.addedToReview ? '✓ 已添加' : '+ 错题本' }}
              </button>
            </div>

            <div class="poem-scroll">
              <div class="scroll-upper">上句：{{ err.questionText }}</div>
              <div class="scroll-sep">──────</div>
              <div class="scroll-answer">
                <div class="answer-row">
                  <span class="answer-lbl">❌ 你接的：</span>
                  <span class="answer-val wrong">{{ err.userAnswer }}</span>
                </div>
                <div class="answer-row" v-if="err.aiData">
                  <span class="answer-lbl">💡 AI分析：</span>
                  <span class="ai-tip">{{ err.aiData.reason }}</span>
                </div>
                <div class="answer-row">
                  <span class="answer-lbl">✅ 正确下句：</span>
                  <span class="answer-val correct">{{ err.correctAnswer }}</span>
                </div>
              </div>
              <div class="scroll-bottom">
                <div class="ai-section" v-if="err.aiData">
                  <div class="ai-block">
                    <div class="ai-label">📖 详细讲解</div>
                    <div class="ai-content">{{ err.aiData.explanation }}</div>
                  </div>
                  <div class="ai-block">
                    <div class="ai-label">🧠 记忆口诀</div>
                    <div class="ai-content tip">{{ err.aiData.memory_tip }}</div>
                  </div>
                </div>
                <div class="ai-loading" v-else>
                  <div class="spinner-sm"></div>
                  <span>AI 讲解生成中...</span>
                </div>
              </div>
            </div>

            <!-- 填空练习 -->
            <div class="fill-blank-section">
              <div class="fill-q">
                <span class="fill-label">✏️ 填空练习：</span>
                <span class="fill-text">{{ err.questionText.replace('_____', '【    】') }}</span>
                <span class="fill-answer">{{ err.correctAnswer }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <transition name="toast-slide">
      <div v-if="toast.show" :class="['toast', toast.type]">{{ toast.text }}</div>
    </transition>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, onActivated, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import questionsData from '@/data/poetryQuestions.json';

const API_BASE = 'http://localhost:3000/api/card-game';

// ==================== 常量 ====================
const CANVAS_W = 880;
const CANVAS_H = 520;
const PLAYER_W = 70;
const PLAYER_H = 80;
const CARD_W = 210;
const CARD_H = 96;
const CARD_SPEED_BASE = 1.22;
const MAX_WRONG = 5;
const DIFFICULTIES = [
  { value: 'easy', label: '入门', color: '#4CAF50' },
  { value: 'medium', label: '进阶', color: '#FF9800' },
  { value: 'hard', label: '挑战', color: '#f44336' }
];

export default {
  name: 'PoetryCardCatch',
  setup() {
    const router = useRouter();
    const rootRef = ref(null);
    const canvasRef = ref(null);
    const wrapRef = ref(null);

    // 游戏阶段: MENU | PLAYING | PAUSED | GAME_OVER | REVIEW
    const phase = ref('MENU');
    const diff = ref('medium');
    const score = ref(0);
    const wrongCount = ref(0);
    const correctCount = ref(0);
    const missedCount = ref(0);
    const elapsed = ref(0);
    const gameLevel = ref(1);

    let ctx = null;
    let animId = null;
    let lastTime = 0;
    let elapsedTimer = null;
    let spawnTimer = 0;
    let gameStartTime = 0;

    // 玩家
    const player = {
      x: CANVAS_W / 2 - PLAYER_W / 2,
      y: CANVAS_H - PLAYER_H - 16,
      vx: 0,
      bounce: 0,
      trail: []
    };

    // 角色移动
    const ACCEL = 1.2;
    const MAX_VX = 9;
    const FRICTION = 0.82;
    const keys = { left: false, right: false };

    // 卡片
    let cards = [];
    let cardIdCounter = 0;
    let spawnedThisRound = new Set();
    let wrongCardPool = [];
    /** 接错快照（卡片移出画布后会从 cards 删除，复盘/保存依赖此列表） */
    let wrongCaughtLog = [];

    // 粒子
    let particles = [];

    // 复盘
    const reviewErrors = ref([]);
    const reviewLoading = ref(false);
    const scoreAnim = ref(false);
    const toast = ref({ show: false, text: '', type: 'info' });
    let toastTimer = null;

    // 背景装饰
    const bgDots = [];
    const BG_CHARS = ['诗', '词', '风', '月', '云', '山', '水', '花', '春', '秋', '雨', '雪'];

    // 评级
    const gradeText = computed(() => {
      const s = score.value;
      if (s >= 30) return '诗仙';
      if (s >= 20) return '诗词达人';
      if (s >= 12) return '初露锋芒';
      if (s >= 6) return '诗海初探';
      return '还需修炼';
    });
    const gradeClass = computed(() => {
      const s = score.value;
      if (s >= 30) return 'grade-god';
      if (s >= 20) return 'grade-master';
      if (s >= 12) return 'grade-senior';
      if (s >= 6) return 'grade-junior';
      return 'grade-novice';
    });
    const levelLabel = computed(() => {
      const labels = ['入门', '进阶', '挑战', '诗词大师', '诗仙下凡'];
      return labels[Math.min(gameLevel.value - 1, labels.length - 1)];
    });

    const showToast = (text, type = 'info') => {
      if (phase.value === 'GAME_OVER') return;
      toast.value = { show: true, text, type };
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.value.show = false; }, 1600);
    };

    const formatTime = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${String(sec).padStart(2, '0')}`;
    };

    // ==================== 难度系统 ====================
    const getDifficultyParams = () => {
      const d = diff.value;
      const t = elapsed.value;
      const level = Math.min(Math.floor(t / 30) + 1, 5);
      gameLevel.value = level;
      const mult = 1 + (level - 1) * 0.12;
      const speedMap = { easy: 0.85, medium: 1.05, hard: 1.28 };
      const spawnMap = { easy: 3200, medium: 2400, hard: 1900 };
      const maxCards = { easy: 3, medium: 5, hard: 7 };
      return {
        speed: CARD_SPEED_BASE * speedMap[d] * mult,
        spawnInterval: Math.max(1100, spawnMap[d] / mult),
        maxCards: Math.min(maxCards[d] + level - 1, 9),
        level
      };
    };

    // ==================== 题目过滤（按难度） ====================
    const getQuestionsByLevel = () => {
      const level = gameLevel.value;
      if (level === 1) return questionsData.slice(0, 60);
      if (level === 2) return questionsData.slice(20, 120);
      return questionsData;
    };

    // ==================== 卡片生成 ====================
    const buildWrongPool = () => {
      const pool = [];
      questionsData.forEach((q) => {
        q.options.forEach((opt) => {
          if (opt !== q.answer) pool.push({ text: opt, poem: q });
        });
      });
      return pool;
    };

    const createCard = (forceCorrect) => {
      const params = getDifficultyParams();
      const levelQuestions = getQuestionsByLevel();
      if (levelQuestions.length === 0) return null;

      let isCorrect = forceCorrect;
      if (!isCorrect) {
        // 正确:错误 ≈ 1:1
        const activeCards = cards.filter((c) => !c.collected);
        const correctActive = activeCards.filter((c) => c.isCorrect).length;
        const wrongActive = activeCards.filter((c) => !c.isCorrect).length;
        if (correctActive > wrongActive + 1) isCorrect = false;
        else if (wrongActive > correctActive + 1) isCorrect = true;
        else isCorrect = Math.random() < 0.5;
      }

      let q, lowerText;

      if (isCorrect) {
        const available = levelQuestions.filter(
          (q) => !spawnedThisRound.has(q.question)
        );
        if (available.length === 0) {
          spawnedThisRound.clear();
          return createCard(true);
        }
        q = available[Math.floor(Math.random() * available.length)];
        spawnedThisRound.add(q.question);
        lowerText = q.answer;
      } else {
        if (wrongCardPool.length === 0) wrongCardPool = buildWrongPool();
        const shuffled = [...wrongCardPool].sort(() => Math.random() - 0.5);
        // 找和当前题目无关的干扰项，且确保不与同一首诗的正确答案重复
        const wrongOfCurrent = cards
          .filter((c) => c.isCorrect && !c.collected)
          .map((c) => c.lowerText);
        const available = shuffled.filter(
          (w) =>
            !spawnedThisRound.has(w.poem.question) &&
            !wrongOfCurrent.includes(w.text)
        );
        if (available.length === 0) return createCard(true);
        const chosen = available[0];
        lowerText = chosen.text;
        q = chosen.poem;
      }

      const x = 40 + Math.random() * (CANVAS_W - CARD_W - 80);
      const card = {
        id: cardIdCounter++,
        x,
        y: -CARD_H - 20,
        w: CARD_W,
        h: CARD_H,
        speed: params.speed * (0.9 + Math.random() * 0.3),
        upperText: q.question,
        lowerText,
        correctAnswer: q.answer,   // 始终保存正确答案，供复盘使用
        isCorrect,
        collected: false,
        passed: false,
        glow: 0,
        rot: (Math.random() - 0.5) * 0.04,
        shimmer: 0
      };
      cards.push(card);
      return card;
    };

    // ==================== 碰撞检测 ====================
    const hitTest = (px, py, pw, ph, cx, cy, cw, ch) => {
      return px < cx + cw && px + pw > cx && py < cy + ch && py + ph > cy;
    };

    // ==================== 粒子 ====================
    const spawnParticles = (x, y, color, count) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.5 + Math.random() * 3.5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd - 2,
          life: 1,
          decay: 0.022 + Math.random() * 0.02,
          size: 3 + Math.random() * 5,
          color
        });
      }
    };

    // ==================== Canvas 初始化 ====================
    const initCanvas = () => {
      const canvas = canvasRef.value;
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;

      // 圆角 polyfill
      if (!ctx.roundRect) {
        ctx.roundRect = (x, y, w, h, r) => {
          if (typeof r === 'number') r = [r, r, r, r];
          const [tl, tr, br, bl] = r;
          ctx.beginPath();
          ctx.moveTo(x + tl, y);
          ctx.lineTo(x + w - tr, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
          ctx.lineTo(x + w, y + h - br);
          ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
          ctx.lineTo(x + bl, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
          ctx.lineTo(x, y + tl);
          ctx.quadraticCurveTo(x, y, x + tl, y);
          ctx.closePath();
        };
      }

      // 背景装饰
      bgDots.length = 0;
      for (let i = 0; i < 28; i++) {
        bgDots.push({
          x: Math.random() * CANVAS_W,
          y: Math.random() * CANVAS_H,
          char: BG_CHARS[Math.floor(Math.random() * BG_CHARS.length)],
          size: 14 + Math.random() * 12,
          alpha: 0.035 + Math.random() * 0.045,
          speed: 0.18 + Math.random() * 0.28,
          rot: Math.random() * Math.PI * 2,
          rotSpd: (Math.random() - 0.5) * 0.006
        });
      }
    };

    // ==================== 绘制函数 ====================
    const drawBackground = () => {
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, '#f9f3e9');
      grad.addColorStop(0.45, '#f5eedf');
      grad.addColorStop(1, '#f0e0c8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // 仿宣纸横线
      ctx.strokeStyle = 'rgba(139, 69, 19, 0.06)';
      ctx.lineWidth = 1;
      for (let y = 0; y < CANVAS_H; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_W, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(205, 133, 63, 0.12)';
      ctx.beginPath();
      ctx.moveTo(48, 0);
      ctx.lineTo(48, CANVAS_H);
      ctx.moveTo(CANVAS_W - 48, 0);
      ctx.lineTo(CANVAS_W - 48, CANVAS_H);
      ctx.stroke();

      // 装饰字符（缓慢飘动，古风色调）
      ctx.font = `bold ${16}px 'STSong', 'SimSun', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const el of bgDots) {
        el.x += el.speed * 0.65;
        el.rot += el.rotSpd;
        if (el.x > CANVAS_W + 40) {
          el.x = -40;
          el.y = Math.random() * CANVAS_H;
        }
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.rotate(el.rot);
        ctx.globalAlpha = el.alpha;
        ctx.fillStyle = '#8b4513';
        ctx.fillText(el.char, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const drawCard = (card) => {
      const { x, y, w, h, upperText, lowerText, isCorrect, collected, glow } = card;

      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(card.rot || 0);
      ctx.translate(-(x + w / 2), -(y + h / 2));

      // 发光
      if (glow > 0 && !collected) {
        ctx.shadowColor = '#b8860b';
        ctx.shadowBlur = 18 * glow;
      }

      // 卷轴背景（正误卡外观统一，仅靠内容区分）
      const bgColor = collected
        ? 'rgba(205, 133, 63, 0.22)'
        : 'rgba(255,248,225,0.97)';
      const borderColor = '#cd853f';

      // 卷轴边缘（左边卷轴条）
      const rollW = 10;
      const rollGrad = ctx.createLinearGradient(x, y, x + rollW, y);
      rollGrad.addColorStop(0, 'rgba(139,90,43,0.5)');
      rollGrad.addColorStop(0.5, 'rgba(205,133,63,0.8)');
      rollGrad.addColorStop(1, 'rgba(139,90,43,0.5)');
      ctx.fillStyle = rollGrad;
      ctx.fillRect(x, y, rollW, h);

      // 卡片主体
      ctx.fillStyle = bgColor;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x + rollW, y, w - rollW, h, [0, 10, 10, 0]);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      // 分隔线
      const midY = y + h / 2;
      ctx.strokeStyle = 'rgba(205,133,63,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x + rollW + 10, midY);
      ctx.lineTo(x + w - 4, midY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 上句
      const fontSize = Math.min(13, Math.max(10, (w - rollW - 28) / upperText.length * 1.6));
      ctx.fillStyle = '#5d4037';
      ctx.font = `${fontSize}px 'STSong','SimSun','Noto Serif SC',serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(upperText, x + rollW + (w - rollW) / 2, y + h * 0.26, w - rollW - 20);

      // 下句（重点）
      ctx.font = `bold ${Math.min(15, Math.max(11, (w - rollW - 28) / lowerText.length * 1.8))}px 'STSong','SimSun','Noto Serif SC',serif`;
      ctx.fillStyle = '#8b4513';
      ctx.fillText(lowerText, x + rollW + (w - rollW) / 2, y + h * 0.73, w - rollW - 20);

      // 正确标记
      if (!collected) {
        ctx.fillStyle = 'rgba(205,133,63,0.08)';
        ctx.beginPath();
        ctx.roundRect(x + rollW, y, w - rollW, h, [0, 10, 10, 0]);
        ctx.fill();
      }

      ctx.restore();
    };

    const drawPlayer = () => {
      const px = player.x;
      const py = player.y;
      const pw = PLAYER_W;
      const ph = PLAYER_H;

      // 拖尾
      player.trail.unshift({ x: px + pw / 2, y: py + ph / 2, life: 1 });
      if (player.trail.length > 8) player.trail.pop();
      for (let i = player.trail.length - 1; i >= 0; i--) {
        const t = player.trail[i];
        t.life -= 0.12;
        if (t.life <= 0) { player.trail.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = t.life * 0.2;
        ctx.fillStyle = '#cd853f';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 6 * t.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);

      // 弹跳
      if (player.bounce > 0) {
        ctx.scale(1 + player.bounce * 0.06, 1 - player.bounce * 0.04);
        player.bounce -= 0.12;
        if (player.bounce < 0) player.bounce = 0;
      }

      // 身体
      const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, pw * 0.42);
      bodyGrad.addColorStop(0, '#fff8f0');
      bodyGrad.addColorStop(1, '#e8d5b5');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(0, 0, pw * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cd853f';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 衣袍
      ctx.fillStyle = 'rgba(205,133,63,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, ph * 0.18, pw * 0.32, ph * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();

      // 帽子
      ctx.fillStyle = '#8b4513';
      ctx.beginPath();
      ctx.ellipse(0, -ph * 0.26, pw * 0.28, ph * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-pw * 0.12, -ph * 0.4, pw * 0.24, ph * 0.14);
      ctx.fillStyle = '#a0522d';
      ctx.beginPath();
      ctx.arc(0, -ph * 0.4, pw * 0.1, Math.PI, 0);
      ctx.fill();

      // 脸
      ctx.fillStyle = '#5d4037';
      ctx.beginPath();
      ctx.arc(-pw * 0.12, -ph * 0.05, 3.5, 0, Math.PI * 2);
      ctx.arc(pw * 0.12, -ph * 0.05, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, ph * 0.09, 5, 0.1, Math.PI - 0.1);
      ctx.stroke();

      // 接取光晕（当有卡片在附近时）
      if (cards.some((c) => !c.collected && Math.abs(c.x + c.w / 2 - (px + pw / 2)) < pw * 1.2 && c.y + c.h > py)) {
        ctx.strokeStyle = 'rgba(255,215,0,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, ph * 0.05, pw * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawParticles = () => {
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    // ==================== 游戏主循环 ====================
    const gameLoop = (timestamp) => {
      if (phase.value !== 'PLAYING') return;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      const params = getDifficultyParams();

      // 玩家移动
      if (keys.left) player.vx -= ACCEL;
      if (keys.right) player.vx += ACCEL;
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.1) player.vx = 0;
      player.vx = Math.max(-MAX_VX, Math.min(MAX_VX, player.vx));
      player.x += player.vx;

      // 边界
      if (player.x < 0) { player.x = 0; player.vx = 0; }
      if (player.x + PLAYER_W > CANVAS_W) { player.x = CANVAS_W - PLAYER_W; player.vx = 0; }

      // 生成卡片
      spawnTimer += dt * 1000;
      if (spawnTimer >= params.spawnInterval) {
        spawnTimer = 0;
        if (cards.filter((c) => !c.collected).length < params.maxCards) {
          createCard();
        }
      }

      // 更新卡片（已接住的卡片继续下落直至移出画布，避免堆叠）
      for (let i = cards.length - 1; i >= 0; i--) {
        const card = cards[i];
        card.y += card.speed;
        card.shimmer += 0.04;
        if (card.collected && card.glow > 0) {
          card.glow *= 0.88;
          if (card.glow < 0.04) card.glow = 0;
        }

        if (!card.collected) {
          if (hitTest(player.x, player.y, PLAYER_W, PLAYER_H, card.x, card.y, card.w, card.h)) {
            card.collected = true;
            card.glow = 1;
            if (card.isCorrect) {
              score.value++;
              correctCount.value++;
              scoreAnim.value = true;
              setTimeout(() => { scoreAnim.value = false; }, 300);
              spawnParticles(card.x + card.w / 2, card.y + card.h / 2, '#FFD700', 14);
              showToast('+1 正确！', 'success');
            } else {
              wrongCount.value++;
              wrongCaughtLog.push({
                questionText: card.upperText,
                userAnswer: card.lowerText,
                correctAnswer: card.correctAnswer
              });
              spawnParticles(card.x + card.w / 2, card.y + card.h / 2, '#f44336', 10);
              if (wrongCount.value >= MAX_WRONG) {
                endGame();
                return;
              }
              showToast('错误！', 'error');
            }
          }
        }

        // 漏过检测（仅未接住的正确卡）
        if (!card.passed && !card.collected && card.y > CANVAS_H) {
          card.passed = true;
          if (card.isCorrect) {
            score.value = Math.max(0, score.value - 1);
            missedCount.value++;
            spawnParticles(card.x + card.w / 2, CANVAS_H - 10, '#FF9800', 6);
            showToast('-1 漏掉了！', 'warn');
          }
        }

        if (card.y > CANVAS_H + 80) {
          cards.splice(i, 1);
        }
      }

      // 粒子
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // 绘制
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawBackground();
      for (const card of cards) drawCard(card);
      drawParticles();
      drawPlayer();

      animId = requestAnimationFrame(gameLoop);
    };

    // ==================== 游戏控制 ====================
    const startGame = async () => {
      phase.value = 'PLAYING';
      score.value = 0;
      wrongCount.value = 0;
      correctCount.value = 0;
      missedCount.value = 0;
      elapsed.value = 0;
      gameLevel.value = 1;
      spawnTimer = 0;
      cards = [];
      particles = [];
      player.x = CANVAS_W / 2 - PLAYER_W / 2;
      player.vx = 0;
      player.bounce = 0;
      player.trail = [];
      spawnedThisRound.clear();
      wrongCardPool = buildWrongPool();
      wrongCaughtLog = [];
      reviewErrors.value = [];
      cardIdCounter = 0;

      gameStartTime = Date.now();
      elapsedTimer = setInterval(() => {
        elapsed.value = Math.floor((Date.now() - gameStartTime) / 1000);
      }, 1000);

      await nextTick();
      scrollGameIntoView();

      // 聚焦 canvas
      wrapRef.value?.focus();

      lastTime = performance.now();
      animId = requestAnimationFrame(gameLoop);
    };

    const pauseGame = () => {
      if (phase.value !== 'PLAYING') return;
      phase.value = 'PAUSED';
      cancelAnimationFrame(animId);
    };

    const resumeGame = () => {
      if (phase.value !== 'PAUSED') return;
      phase.value = 'PLAYING';
      lastTime = performance.now();
      animId = requestAnimationFrame(gameLoop);
    };

    const endGame = () => {
      phase.value = 'GAME_OVER';
      cancelAnimationFrame(animId);
      if (elapsedTimer) clearInterval(elapsedTimer);
      if (toastTimer) clearTimeout(toastTimer);
      toast.value.show = false;
      saveRecord();
    };

    const restartGame = () => {
      phase.value = 'MENU';
      cancelAnimationFrame(animId);
      wrongCaughtLog = [];
      reviewErrors.value = [];
      reviewLoading.value = false;
      ctx?.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawBackground();
    };

    const quitGame = () => {
      phase.value = 'MENU';
      cancelAnimationFrame(animId);
      if (elapsedTimer) clearInterval(elapsedTimer);
      wrongCaughtLog = [];
      reviewErrors.value = [];
      reviewLoading.value = false;
      ctx?.clearRect(0, 0, CANVAS_W, CANVAS_H);
      drawBackground();
      router.push('/');
    };

    // ==================== 复盘 ====================
    const showReview = async () => {
      phase.value = 'REVIEW';
      cancelAnimationFrame(animId);
      reviewLoading.value = true;

      const errList = wrongCaughtLog.map((e) => ({
        questionText: e.questionText,
        userAnswer: e.userAnswer,
        correctAnswer: e.correctAnswer,
        aiData: null,
        addedToReview: false
      }));

      if (errList.length === 0) {
        reviewErrors.value = [];
        reviewLoading.value = false;
        return;
      }

      reviewErrors.value = errList;

      // 调用 AI 讲解
      for (let i = 0; i < errList.length; i++) {
        try {
          const resp = await fetch(`${API_BASE}/ai-explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionText: errList[i].questionText,
              wrongAnswer: errList[i].userAnswer,
              correctAnswer: errList[i].correctAnswer
            })
          });
          const json = await resp.json();
          if (json.success && json.data) {
            errList[i].aiData = json.data;
            reviewErrors.value = [...errList];
          }
        } catch (e) {
          console.error('AI讲解请求失败', e);
        }
      }
      reviewLoading.value = false;
    };

    const addToReview = async (err) => {
      try {
        await fetch(`${API_BASE}/add-to-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionText: err.questionText,
            correctAnswer: err.correctAnswer
          })
        });
        err.addedToReview = true;
        reviewErrors.value = [...reviewErrors.value];
        showToast('已加入错题本', 'success');
      } catch (e) {
        showToast('添加失败', 'error');
      }
    };

    // ==================== 保存记录 ====================
    const saveRecord = async () => {
      const errorsPayload = wrongCaughtLog.map((e) => ({
        questionText: e.questionText,
        userAnswer: e.userAnswer,
        correctAnswer: e.correctAnswer
      }));

      try {
        await fetch(`${API_BASE}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score: score.value,
            wrongCount: wrongCount.value,
            correctCount: correctCount.value,
            missedCount: missedCount.value,
            duration: elapsed.value,
            difficultyLevel: gameLevel.value,
            errors: errorsPayload
          })
        });
      } catch (e) {
        console.error('保存记录失败', e);
      }
    };

    // ==================== 键盘事件 ====================
    const handleKeyDown = (e) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') { keys.left = true; e.preventDefault(); }
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') { keys.right = true; e.preventDefault(); }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (phase.value === 'PLAYING') pauseGame();
        else if (phase.value === 'PAUSED') resumeGame();
      }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') keys.left = false;
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.right = false;
    };

    // ==================== 生命周期 ====================
    const scrollGameIntoView = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      rootRef.value?.scrollIntoView({ block: 'start', behavior: 'auto' });
    };

    onMounted(() => {
      initCanvas();
      drawBackground();
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      wrapRef.value?.focus();
    });

    onActivated(() => {
      if (phase.value === 'PLAYING' || phase.value === 'PAUSED') {
        nextTick(() => scrollGameIntoView());
      }
    });

    onUnmounted(() => {
      cancelAnimationFrame(animId);
      if (elapsedTimer) clearInterval(elapsedTimer);
      if (toastTimer) clearTimeout(toastTimer);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    });

    return {
      rootRef, canvasRef, wrapRef,
      phase, diff, score, wrongCount, correctCount, missedCount,
      elapsed, gameLevel, gradeText, gradeClass, levelLabel,
      DIFFICULTIES,
      reviewErrors, reviewLoading,
      scoreAnim, toast,
      formatTime, showReview, addToReview,
      startGame, resumeGame, restartGame, quitGame
    };
  }
};
</script>

<style scoped>
.card-catch-wrapper {
  /* 导航栏 sticky + main 上下 padding，避免整页 100vh 顶出视口导致 HUD 被滚到看不见 */
  --catch-chrome: max(108px, calc(env(safe-area-inset-top, 0px) + 92px));
  width: 100%;
  min-height: calc(100vh - var(--catch-chrome));
  max-height: calc(100vh - var(--catch-chrome));
  height: calc(100vh - var(--catch-chrome));
  min-height: calc(100dvh - var(--catch-chrome));
  max-height: calc(100dvh - var(--catch-chrome));
  height: calc(100dvh - var(--catch-chrome));
  background: #f9f3e9;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  position: relative;
  font-family: 'SimSun', 'STSong', 'Noto Serif SC', serif;
  outline: none;
}

/* ===== HUD（与全站诗词卷轴风一致） ===== */
.game-hud {
  position: relative;
  z-index: 20;
  flex-shrink: 0;
  width: 100%;
  max-width: 920px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: rgba(249, 243, 233, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(205, 133, 63, 0.22);
  box-shadow: 0 2px 12px rgba(139, 69, 19, 0.06);
  box-sizing: border-box;
}
.hud-item { display: flex; align-items: center; gap: 8px; }
.hud-left { flex: 0 0 auto; }
.hud-center { flex: 1; justify-content: center; display: flex; }
.hud-right { flex: 0 0 auto; gap: 16px; }
.hud-label { font-size: 12px; color: rgba(139, 69, 19, 0.65); }
.hud-val { font-size: 16px; display: flex; gap: 2px; }
.miss-dot { font-size: 16px; transition: all 0.3s; }
.miss-dot.lost { opacity: 0.2; transform: scale(0.8); }

.level-badge {
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: bold;
  background: rgba(255, 248, 220, 0.85);
  border: 1px solid rgba(205, 133, 63, 0.35);
  color: #8b4513;
}
.score-block, .time-block { display: flex; flex-direction: column; align-items: flex-end; }
.score-lbl, .time-lbl { font-size: 11px; color: rgba(93, 64, 55, 0.55); }
.score-num { font-size: 26px; font-weight: bold; color: #b8860b; }
.score-num.bounce { animation: scoreBounce 0.3s; }
.time-num { font-size: 18px; color: #5d4037; }
.danger .hud-val { color: #c62828; }

@keyframes scoreBounce {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* ===== Canvas ===== */
.canvas-wrap {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  max-width: 920px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  outline: none;
  min-height: 280px;
}
.game-canvas {
  border-radius: 12px;
  border: 1px solid rgba(205, 133, 63, 0.25);
  box-shadow: 0 4px 24px rgba(139, 69, 19, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: default;
  max-width: 100%;
}

/* ===== 通用玻璃卡片 ===== */
.glass-card {
  background: rgba(13, 27, 42, 0.95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 24px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
}
.primary-btn {
  display: block;
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  border: none;
  border-radius: 16px;
  color: white;
  font-family: inherit;
  font-size: 17px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 16px rgba(205, 133, 63, 0.3);
  margin-bottom: 10px;
}
.primary-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(205,133,63,0.4); }
.secondary-btn {
  display: block;
  width: 100%;
  padding: 12px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  color: rgba(255,255,255,0.7);
  font-family: inherit;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.25s;
  margin-bottom: 10px;
}
.secondary-btn:hover { background: rgba(255,255,255,0.1); color: white; }
.secondary-btn.sm { padding: 8px 16px; font-size: 13px; }
.danger-btn {
  display: block;
  width: 100%;
  padding: 12px;
  background: rgba(244, 67, 54, 0.15);
  border: 1px solid rgba(244,67,54,0.3);
  border-radius: 16px;
  color: #f44336;
  font-family: inherit;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.25s;
  margin-bottom: 10px;
}
.danger-btn:hover { background: rgba(244,67,54,0.25); }

/* ===== 遮罩 ===== */
.overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  padding: 20px;
  box-sizing: border-box;
}

/* ===== 开始菜单 ===== */
.menu-card {
  padding: 40px 48px;
  max-width: 460px;
  width: 100%;
  text-align: center;
}
.card-decor { font-size: 52px; margin-bottom: 8px; }
.game-title {
  font-size: 40px;
  color: #cd853f;
  margin: 0 0 6px;
  text-shadow: 2px 2px 6px rgba(0,0,0,0.4);
  font-weight: bold;
}
.game-subtitle { color: rgba(255,255,255,0.55); font-size: 14px; margin: 0 0 28px; }
.rules-box {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 22px;
  text-align: left;
}
.rule-row { display: flex; align-items: center; gap: 10px; margin-bottom: 9px; font-size: 13px; color: rgba(255,255,255,0.7); }
.rule-row:last-child { margin-bottom: 0; }
.rk {
  min-width: 72px; padding: 3px 8px;
  border-radius: 6px; font-size: 12px; font-weight: bold;
  text-align: center; display: inline-block;
}
.rk.ok { background: rgba(76,175,80,0.2); color: #4CAF50; }
.rk.err { background: rgba(244,67,54,0.2); color: #f44336; }
.rk.warn { background: rgba(255,152,0,0.2); color: #FF9800; }
.rk.danger { background: rgba(244,67,54,0.2); color: #f44336; }
.difficulty-row { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 22px; }
.diff-lbl { color: rgba(255,255,255,0.6); font-size: 14px; font-weight: bold; }
.diff-btn {
  padding: 8px 18px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 12px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.25s;
}
.diff-btn.active { background: linear-gradient(135deg, #cd853f, #8b4513); color: white; border-color: transparent; }

/* ===== 暂停 ===== */
.pause-card { padding: 36px 44px; max-width: 360px; width: 100%; text-align: center; }
.pause-title { font-size: 28px; color: #cd853f; margin: 0 0 20px; }
.pause-stats { background: rgba(255,255,255,0.04); border-radius: 12px; padding: 14px; margin-bottom: 20px; }
.ps { display: flex; justify-content: space-between; padding: 7px 0; font-size: 14px; color: rgba(255,255,255,0.6); border-bottom: 1px solid rgba(255,255,255,0.06); }
.ps:last-child { border-bottom: none; }
.pv { font-weight: bold; color: #FFD700; }
.pv.danger { color: #f44336; }

/* ===== 游戏结束 ===== */
.go-card { padding: 36px 44px; max-width: 400px; width: 100%; text-align: center; }
.go-badge { font-size: 48px; margin-bottom: 4px; }
.go-title { font-size: 28px; color: #cd853f; margin: 0 0 20px; }
.go-stats { background: rgba(255,255,255,0.04); border-radius: 14px; padding: 14px; margin-bottom: 18px; }
.gs { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: rgba(255,255,255,0.6); border-bottom: 1px solid rgba(255,255,255,0.06); }
.gs:last-child { border-bottom: none; }
.gv { font-weight: bold; }
.score-val { color: #FFD700; font-size: 22px; }
.correct-val { color: #4CAF50; }
.miss-val { color: #FF9800; }
.danger-val { color: #f44336; }
.go-grade { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 20px; font-size: 15px; color: rgba(255,255,255,0.7); }
.grade-chip { padding: 4px 16px; border-radius: 14px; font-weight: bold; font-size: 14px; }
.grade-god { background: linear-gradient(135deg, #ffd700, #ff8c00); color: white; }
.grade-master { background: linear-gradient(135deg, #cd853f, #8b4513); color: white; }
.grade-senior { background: rgba(76,175,80,0.2); color: #4CAF50; border: 1px solid rgba(76,175,80,0.3); }
.grade-junior { background: rgba(33,150,243,0.15); color: #2196F3; border: 1px solid rgba(33,150,243,0.3); }
.grade-novice { background: rgba(158,158,158,0.15); color: #9e9e9e; border: 1px solid rgba(158,158,158,0.3); }
.go-actions { display: flex; flex-direction: column; }

/* ===== 复盘 ===== */
.review-overlay { align-items: flex-start; overflow-y: auto; padding: 20px; }
.review-card {
  padding: 28px 32px;
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
}
.review-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.back-btn {
  padding: 8px 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; color: rgba(255,255,255,0.7); font-family: inherit; font-size: 14px;
  cursor: pointer; transition: all 0.25s;
}
.back-btn:hover { background: rgba(255,255,255,0.1); color: white; }
.review-title { font-size: 24px; color: #cd853f; margin: 0; font-weight: bold; }

.review-loading { text-align: center; padding: 40px; color: rgba(255,255,255,0.6); }
.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(205,133,63,0.2);
  border-top-color: #cd853f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
.spinner-sm {
  width: 18px; height: 18px;
  border: 2px solid rgba(205,133,63,0.2);
  border-top-color: #cd853f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  margin-right: 8px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.review-empty { text-align: center; padding: 40px; }
.empty-icon { font-size: 52px; margin-bottom: 12px; }
.review-empty h3 { color: #4CAF50; margin: 0 0 8px; }
.review-empty p { color: rgba(255,255,255,0.5); }

.review-legend { font-size: 13px; color: rgba(255,255,255,0.5); margin-bottom: 16px; }
.review-list { display: flex; flex-direction: column; gap: 18px; }

.review-item {
  padding: 20px;
  background: rgba(255,255,255,0.03);
}
.review-item-header { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.review-num {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(205,133,63,0.2); color: #cd853f;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: bold; flex-shrink: 0;
}
.review-tag { padding: 3px 10px; border-radius: 8px; font-size: 12px; font-weight: bold; }
.review-tag.wrong { background: rgba(244,67,54,0.2); color: #f44336; }
.add-review-btn {
  margin-left: auto;
  padding: 5px 12px;
  border: 1px solid rgba(76,175,80,0.4);
  border-radius: 8px;
  background: rgba(76,175,80,0.1);
  color: #4CAF50;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.add-review-btn:hover:not(:disabled) { background: rgba(76,175,80,0.2); }
.add-review-btn.added { border-color: rgba(76,175,80,0.6); color: #4CAF50; cursor: default; }
.add-review-btn:disabled { opacity: 0.7; cursor: default; }

/* 卷轴 */
.poem-scroll {
  background: rgba(255,248,225,0.05);
  border: 1px solid rgba(205,133,63,0.25);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.scroll-upper { color: #8b6914; font-size: 13px; margin-bottom: 6px; font-family: 'STSong','SimSun',serif; }
.scroll-sep { color: rgba(205,133,63,0.3); font-size: 12px; margin-bottom: 6px; letter-spacing: 2px; }
.scroll-answer { display: flex; flex-direction: column; gap: 6px; }
.answer-row { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; }
.answer-lbl { flex-shrink: 0; color: rgba(255,255,255,0.45); font-size: 12px; width: 70px; }
.answer-val { font-weight: bold; font-family: 'STSong','SimSun',serif; }
.answer-val.wrong { color: #f44336; }
.answer-val.correct { color: #4CAF50; }
.ai-tip { color: #FF9800; font-size: 12px; }

.scroll-bottom { margin-top: 10px; }
.ai-section { display: flex; flex-direction: column; gap: 8px; }
.ai-block {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 10px 12px;
}
.ai-label { font-size: 11px; color: #cd853f; margin-bottom: 4px; font-weight: bold; }
.ai-content { font-size: 13px; color: rgba(255,255,255,0.75); line-height: 1.6; }
.ai-content.tip { color: #FF9800; font-style: italic; }
.ai-loading { display: flex; align-items: center; padding: 10px; color: rgba(255,255,255,0.4); font-size: 12px; }

/* 填空练习 */
.fill-blank-section { border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 10px; }
.fill-q { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 13px; }
.fill-label { color: #2196F3; font-weight: bold; }
.fill-text { color: rgba(255,255,255,0.6); font-family: 'STSong','SimSun',serif; }
.fill-blank { color: #cd853f; font-weight: bold; min-width: 60px; border-bottom: 2px solid rgba(205,133,63,0.4); }
.fill-answer { color: #4CAF50; font-weight: bold; font-family: 'STSong','SimSun',serif; }

/* ===== Toast（须高于全站导航 z-index:1000，且 top 避开导航栏） ===== */
.toast {
  position: fixed;
  top: calc(10px + var(--catch-chrome, 108px));
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 28px;
  border-radius: 20px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 15px; font-weight: bold;
  z-index: 10050;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
}
.toast.success { background: rgba(76,175,80,0.92); color: white; }
.toast.error { background: rgba(244,67,54,0.92); color: white; }
.toast.warn { background: rgba(255,152,0,0.92); color: white; }
.toast.info { background: rgba(139,69,19,0.88); color: white; }
.toast-slide-enter-active, .toast-slide-leave-active { transition: all 0.3s; }
.toast-slide-enter-from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
.toast-slide-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
</style>
