<template>
  <div class="poetry-parkour-wrapper">
    <!-- 顶部题目 HUD -->
    <div class="game-hud" v-if="gameState !== 'MENU'">
      <div class="hud-left">
        <span class="lives-display">
          <span
            v-for="i in 5"
            :key="i"
            :class="['heart', { 'heart-lost': i > currentLives }]"
          >❤️</span>
        </span>
      </div>
      <div class="hud-center">
        <div class="current-question" v-if="currentQuestion">
          <span class="q-label">题目：</span>
          <span class="q-text">
            <span class="q-part">{{ currentQuestion.beforeBlank }}</span>
            <span class="blank-slot"></span>
            <span class="q-part">{{ currentQuestion.afterBlank }}</span>
          </span>
        </div>
      </div>
      <div class="hud-right">
        <span class="score-display">
          <span class="score-icon">📜</span>
          <span class="score-num">{{ score }}</span>
        </span>
      </div>
    </div>

    <!-- Canvas 游戏区 -->
    <div class="canvas-container" ref="containerRef">
      <canvas ref="canvasRef" class="game-canvas" />
    </div>

    <!-- 开始菜单 -->
    <div v-if="gameState === 'MENU'" class="overlay-screen menu-screen">
      <div class="menu-card glass-card">
        <div class="menu-badge">🎮 新模块</div>
        <h1 class="menu-title">诗词跑酷</h1>
        <p class="menu-subtitle">穿越文字方块塔，检验你的诗词功底</p>
        <div class="menu-rules">
          <div class="rule-row"><span class="rule-key">W / ↑</span><span>按住向上飞行</span></div>
          <div class="rule-row"><span class="rule-key">S / ↓</span><span>按住向下飞行</span></div>
          <div class="rule-row"><span class="rule-key">A D / ← →</span><span>按住左右移动</span></div>
          <div class="rule-row"><span class="rule-key">题目</span><span>障碍塔中心移到小人左侧时切换下一句</span></div>
          <div class="rule-row"><span class="rule-key">撞击</span><span>撞上正确单字 +1分</span></div>
          <div class="rule-row"><span class="rule-key">失误</span><span>错字 -1❤️（未撞墙不扣分）</span></div>
        </div>
        <div class="menu-difficulty">
          <span class="diff-label">难度：</span>
          <button
            v-for="d in difficulties"
            :key="d.value"
            :class="['diff-btn', { active: selectedDifficulty === d.value }]"
            @click="selectedDifficulty = d.value"
          >{{ d.label }}</button>
        </div>
        <button class="start-btn glass-btn-primary" @click="startGame">开始游戏</button>
        <button class="back-btn glass-btn-secondary" @click="goBack">返回首页</button>
      </div>
    </div>

    <!-- 暂停遮罩 -->
    <div v-if="gameState === 'PAUSED'" class="overlay-screen pause-screen">
      <div class="pause-card glass-card">
        <h2 class="pause-title">⏸ 游戏暂停</h2>
        <div class="pause-stats">
          <div class="stat-row"><span>分数</span><span class="stat-val">{{ score }}</span></div>
          <div class="stat-row"><span>剩余生命</span><span class="stat-val">{{ currentLives }} ❤️</span></div>
          <div class="stat-row"><span>已飞行</span><span class="stat-val">{{ Math.floor(distance / 60) }} 米</span></div>
        </div>
        <button class="glass-btn-primary" @click="resumeGame">继续游戏</button>
        <button class="glass-btn-danger" @click="quitGame">退出游戏</button>
      </div>
    </div>

    <!-- 游戏结束遮罩 -->
    <div v-if="gameState === 'GAME_OVER'" class="overlay-screen gameover-screen">
      <div class="gameover-card glass-card">
        <div class="gameover-badge">💀</div>
        <h2 class="gameover-title">游戏结束</h2>
        <div class="gameover-stats">
          <div class="go-row">
            <span class="go-label">最终得分</span>
            <span class="go-val score-val">{{ score }}</span>
          </div>
          <div class="go-row">
            <span class="go-label">飞行距离</span>
            <span class="go-val">{{ Math.floor(distance / 60) }} 米</span>
          </div>
          <div class="go-row">
            <span class="go-label">正确撞击</span>
            <span class="go-val correct-val">{{ correctHits }}</span>
          </div>
          <div class="go-row">
            <span class="go-label">失误次数</span>
            <span class="go-val wrong-val">{{ wrongHits }}</span>
          </div>
        </div>
        <div class="gameover-grade">
          <span>评级：</span>
          <span :class="['grade-badge', gradeClass]">{{ gradeText }}</span>
        </div>
        <button class="glass-btn-primary" @click="restartGame">再来一局</button>
        <button class="glass-btn-secondary" @click="quitGame">返回首页</button>
      </div>
    </div>

    <!-- Toast 通知 -->
    <transition name="toast-fade">
      <div v-if="toast.show" :class="['game-toast', toast.type]">{{ toast.text }}</div>
    </transition>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import questionsData from '@/data/poetryQuestions.json';

const FPS = 60;
const PLAYER_ACCEL = 0.32;
const PLAYER_MAX_VY = 4.5;
const PLAYER_MAX_VX = 4.5;
const PLAYER_FRICTION = 0.88;
const BASE_SPEED = 1.65;
const PLAYER_W = 40;
const PLAYER_H = 40;
/** 单字方块宽度（跑酷为单字挖空） */
const BLOCK_W_CHAR = 64;
const BLOCK_H = 56;
const BLOCK_GAP = 10;
const TOWER_MIN_BLOCKS = 3;
const TOWER_MAX_BLOCKS = 5;
const INITIAL_LIVES = 5;
const SPAWN_INTERVAL_BASE = 215;
const DIFFICULTY_SPEEDS = { easy: 0.72, medium: 0.92, hard: 1.22 };

export default {
  name: 'PoetryParkour',
  setup() {
    const router = useRouter();
    const canvasRef = ref(null);
    const containerRef = ref(null);

    // 游戏状态
    const gameState = ref('MENU'); // MENU | PLAYING | PAUSED | GAME_OVER
    const score = ref(0);
    const currentLives = ref(INITIAL_LIVES);
    const distance = ref(0);
    const correctHits = ref(0);
    const wrongHits = ref(0);
    const currentQuestion = ref(null);
    const usedQuestionIndices = ref([]);
    const selectedDifficulty = ref('medium');
    const difficulties = [
      { value: 'easy', label: '入门' },
      { value: 'medium', label: '进阶' },
      { value: 'hard', label: '专业' }
    ];

    // Canvas 上下文
    let ctx = null;
    let canvas = null;
    let containerW = 0;
    let containerH = 0;
    let animFrameId = null;
    let lastTime = 0;
    let spawnTimer = 0;
    let speedMultiplier = 1;

    // 玩家对象
    const player = {
      x: 0, y: 0, vx: 0, vy: 0,
      wingAngle: 0, wingDir: 1,
      trail: [], trailTimer: 0,
      flash: 0, flashColor: ''
    };

    // 障碍物数组
    let towers = [];
    /** 每座塔独立题目：预生成队列，避免多座塔共用同一题 */
    const QUESTION_QUEUE_MIN = 16;
    let questionQueue = [];

    // 背景装饰
    const bgElements = [];
    const BG_COLORS = ['#f9f3e9', '#f5eedf', '#fff8f0', '#f0e8d5'];
    const DECOR_CHARS = ['诗', '词', '风', '月', '云', '山', '水', '花', '春', '秋', '雨', '雪', '鸟', '酒', '茶', '琴', '棋', '书', '画'];

    // 粒子效果
    let particles = [];

    // 按键状态
    const keys = { up: false, down: false, left: false, right: false };

    // Toast
    const toast = ref({ show: false, text: '', type: 'info' });
    let toastTimer = null;

    const showToast = (text, type = 'info') => {
      toast.value = { show: true, text, type };
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.value.show = false; }, 1800);
    };

    // 评级
    const gradeText = computed(() => {
      const s = score.value;
      if (s >= 50) return '诗仙下凡';
      if (s >= 35) return '诗词达人';
      if (s >= 20) return '初露锋芒';
      if (s >= 10) return '诗海初探';
      return '还需修炼';
    });
    const gradeClass = computed(() => {
      const s = score.value;
      if (s >= 50) return 'grade-god';
      if (s >= 35) return 'grade-master';
      if (s >= 20) return 'grade-senior';
      if (s >= 10) return 'grade-junior';
      return 'grade-novice';
    });

    // ==================== 初始化 ====================

    const initCanvas = () => {
      canvas = canvasRef.value;
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      // roundRect polyfill
      if (!ctx.roundRect) {
        ctx.roundRect = function(x, y, w, h, r) {
          if (typeof r === 'number') r = [r, r, r, r];
          const [tl, tr, br, bl] = r;
          this.beginPath();
          this.moveTo(x + tl, y);
          this.lineTo(x + w - tr, y);
          this.quadraticCurveTo(x + w, y, x + w, y + tr);
          this.lineTo(x + w, y + h - br);
          this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
          this.lineTo(x + bl, y + h);
          this.quadraticCurveTo(x, y + h, x, y + h - bl);
          this.lineTo(x, y + tl);
          this.quadraticCurveTo(x, y, x + tl, y);
          this.closePath();
        };
      }
      resizeCanvas();
      initBackground();
      window.addEventListener('resize', resizeCanvas);
    };

    const resizeCanvas = () => {
      if (!containerRef.value || !canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      containerW = containerRef.value.clientWidth;
      containerH = containerRef.value.clientHeight;
      canvas.width = Math.round(containerW * dpr);
      canvas.height = Math.round(containerH * dpr);
      canvas.style.width = `${containerW}px`;
      canvas.style.height = `${containerH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      player.x = Math.round(containerW * 0.15);
      player.y = Math.round(containerH / 2);
    };

    const initBackground = () => {
      bgElements.length = 0;
      for (let i = 0; i < 30; i++) {
        bgElements.push({
          x: Math.random() * containerW,
          y: Math.random() * containerH,
          char: DECOR_CHARS[Math.floor(Math.random() * DECOR_CHARS.length)],
          size: 12 + Math.random() * 10,
          alpha: 0.04 + Math.random() * 0.06,
          speed: 0.3 + Math.random() * 0.5,
          rotate: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.01
        });
      }
    };

    // ==================== 题目系统 ====================

    const getNextQuestion = () => {
      const available = [];
      for (let i = 0; i < questionsData.length; i++) {
        if (!usedQuestionIndices.value.includes(i)) available.push(i);
      }
      if (available.length === 0) {
        usedQuestionIndices.value = [];
        for (let i = 0; i < questionsData.length; i++) available.push(i);
      }
      const idx = available[Math.floor(Math.random() * available.length)];
      usedQuestionIndices.value.push(idx);
      return questionsData[idx];
    };

    const shuffleInPlace = (a) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    /** 单字挖空：预生成塔载荷，包含题目题干拆分为前后两段及漏字 */
    const buildTowerPayload = (q) => {
      const answer = (q.answer || '').trim();
      if (!answer) return null;
      const chars = [...answer];
      const validIdx = [];
      for (let i = 0; i < chars.length; i++) {
        if (/[\u4e00-\u9fff]/.test(chars[i])) validIdx.push(i);
      }
      if (!validIdx.length) return null;
      const bi = validIdx[Math.floor(Math.random() * validIdx.length)];
      const correctChar = chars[bi];

      const wrongChars = new Set();
      for (const opt of q.options || []) {
        if (!opt || opt === q.answer) continue;
        const oChars = [...opt];
        if (oChars[bi] && /[\u4e00-\u9fff]/.test(oChars[bi]) && oChars[bi] !== correctChar) {
          wrongChars.add(oChars[bi]);
        }
        for (const ch of oChars) {
          if (/[\u4e00-\u9fff]/.test(ch) && ch !== correctChar) wrongChars.add(ch);
        }
      }
      wrongChars.delete(correctChar);
      let wrongPool = [...wrongChars];
      const FALLBACK = '山水云月花春夏秋冬风雨雪霜人天地江海河湖';
      for (let fi = 0; fi < FALLBACK.length && wrongPool.length < 8; fi++) {
        const c = FALLBACK[fi];
        if (c !== correctChar && !wrongPool.includes(c)) wrongPool.push(c);
      }
      if (!wrongPool.length) {
        wrongPool = [...FALLBACK].filter((c) => c !== correctChar);
      }
      shuffleInPlace(wrongPool);
      /** 题干展示：仅挖答案中的单字，前缀/后缀仍取自原 question 中 _____ 两侧文案 */
      const rawQ = (q.question || '');
      let prefix = '';
      let suffix = '';
      const BLANK_MARKER = '_____';
      if (rawQ.includes(BLANK_MARKER)) {
        const qp = rawQ.split(BLANK_MARKER);
        prefix = (qp[0] || '').trim();
        suffix = (qp[1] || '').trim();
      }
      const beforeBlank = prefix + chars.slice(0, bi).join('');
      const afterBlank = chars.slice(bi + 1).join('') + suffix;
      return { q, correctChar, wrongPool, beforeBlank, afterBlank };
    };

    const refillQuestionQueue = () => {
      let guard = 0;
      while (questionQueue.length < QUESTION_QUEUE_MIN && guard++ < 300) {
        const q = getNextQuestion();
        const p = buildTowerPayload(q);
        if (p) questionQueue.push(p);
      }
    };

    /** 题目切换：优先显示「塔中心已在小人中心左侧」的塔中最靠右的一座；否则显示最靠前（最左）的未决塔 */
    const syncHudQuestion = () => {
      const pending = towers.filter((t) => !t.passed && !t.scored);
      pending.sort((a, b) => a.x - b.x);
      if (!pending.length) {
        currentQuestion.value = null;
        return;
      }
      const playerCx = player.x + PLAYER_W / 2;
      const leftOfPlayer = pending.filter((t) => t.x + t.w / 2 < playerCx);
      let next;
      if (leftOfPlayer.length) {
        leftOfPlayer.sort((a, b) => b.x - a.x);
        next = leftOfPlayer[0];
      } else {
        next = pending[0];
      }
      currentQuestion.value = {
        beforeBlank: next.beforeBlank,
        afterBlank: next.afterBlank
      };
    };

    // ==================== 障碍物系统 ====================

    const createTower = () => {
      if (!containerH) return;
      refillQuestionQueue();
      const payload = questionQueue.shift();
      if (!payload) return;

      const speed = BASE_SPEED * speedMultiplier * DIFFICULTY_SPEEDS[selectedDifficulty.value];
      const numBlocks = TOWER_MIN_BLOCKS + Math.floor(Math.random() * (TOWER_MAX_BLOCKS - TOWER_MIN_BLOCKS + 1));
      const correctIdx = Math.floor(Math.random() * numBlocks);

      const blocks = [];
      for (let i = 0; i < numBlocks; i++) {
        const isCorrect = i === correctIdx;
        let text;
        if (isCorrect) {
          text = payload.correctChar;
        } else {
          const pool = payload.wrongPool;
          let w = pool[(i * 3 + correctIdx * 7) % pool.length];
          let tries = 0;
          while (w === payload.correctChar && tries++ < 24) {
            w = pool[Math.floor(Math.random() * pool.length)];
          }
          text = w;
        }
        blocks.push({
          text,
          isCorrect,
          h: BLOCK_H,
          w: BLOCK_W_CHAR,
          hit: false
        });
      }

      const totalH = blocks.reduce((s, b) => s + b.h + BLOCK_GAP, -BLOCK_GAP);
      const margin = 60;
      const minY = margin;
      const maxY = containerH - totalH - margin;
      const baseY = minY + Math.random() * Math.max(0, maxY - minY);

      let curY = baseY;
      for (const block of blocks) {
        block.x = containerW + 20;
        block.y = curY;
        curY += block.h + BLOCK_GAP;
      }

      const towerW = BLOCK_W_CHAR + 16;

      towers.push({
        blocks,
        x: containerW + 20,
        y: baseY,
        w: towerW,
        totalH,
        speed,
        passed: false,
        scored: false,
        correctChar: payload.correctChar,
        beforeBlank: payload.beforeBlank,
        afterBlank: payload.afterBlank
      });
      refillQuestionQueue();
    };

    // ==================== 碰撞检测 ====================

    const checkCollision = (px, py, pw, ph, bx, by, bw, bh) => {
      return px < bx + bw && px + pw > bx && py < by + bh && py + ph > by;
    };

    const processCollisions = () => {
      const pcx = player.x + PLAYER_W / 2; // 玩家几何中心 X
      const pcy = player.y + PLAYER_H / 2; // 玩家几何中心 Y

      for (const tower of towers) {
        for (const block of tower.blocks) {
          if (block.hit) continue;
          const bx = block.x;
          const by = block.y;
          const bw = block.w;
          const bh = block.h;

          // 用玩家几何中心点判断落在哪个 block 内
          const inside = pcx >= bx && pcx <= bx + bw && pcy >= by && pcy <= by + bh;
          if (!inside) continue;

          block.hit = true;
          if (block.isCorrect) {
            if (!tower.scored) {
              tower.scored = true;
              score.value++;
              correctHits.value++;
              player.flash = 15;
              player.flashColor = 'rgba(76, 175, 80, 0.6)';
              spawnParticles(block.x + block.w / 2, block.y + block.h / 2, '#4CAF50', 12);
              showToast('+1 正确！', 'success');
            }
          } else {
            wrongHits.value++;
            currentLives.value--;
            player.flash = 20;
            player.flashColor = 'rgba(244, 67, 54, 0.6)';
            spawnParticles(block.x + block.w / 2, block.y + block.h / 2, '#f44336', 8);
            showToast('-1 生命！', 'error');
            if (currentLives.value <= 0) {
              endGame();
            }
          }
          // 一个中心点最多只触发一个 block，退出塔内循环
          break;
        }
      }
    };

    // ==================== 粒子系统 ====================

    const spawnParticles = (x, y, color, count) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2,
          life: 1,
          decay: 0.025 + Math.random() * 0.02,
          size: 3 + Math.random() * 4,
          color
        });
      }
    };

    const updateParticles = () => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
      }
    };

    // ==================== 绘制函数 ====================

    const drawBackground = () => {
      // 渐变底色
      const grad = ctx.createLinearGradient(0, 0, 0, containerH);
      grad.addColorStop(0, '#f9f3e9');
      grad.addColorStop(1, '#f0e0c8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, containerW, containerH);

      // 古风山水纹理（横线条）
      ctx.strokeStyle = 'rgba(139, 69, 19, 0.04)';
      ctx.lineWidth = 1;
      for (let y = 0; y < containerH; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(containerW, y);
        ctx.stroke();
      }

      // 飘浮装饰字符
      ctx.font = `bold ${16}px 'STSong', 'SimSun', serif`;
      for (const el of bgElements) {
        el.x -= el.speed * speedMultiplier;
        el.rotate += el.rotSpeed;
        if (el.x < -30) {
          el.x = containerW + 30;
          el.y = Math.random() * containerH;
        }
        ctx.save();
        ctx.translate(el.x, el.y);
        ctx.rotate(el.rotate);
        ctx.globalAlpha = el.alpha;
        ctx.fillStyle = '#8b4513';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.char, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const drawPlayer = () => {
      const x = player.x;
      const y = player.y;
      const w = PLAYER_W;
      const h = PLAYER_H;

      // 拖尾
      player.trailTimer++;
      if (player.trailTimer % 3 === 0) {
        player.trail.push({ x: x + w / 2, y: y + h / 2, life: 1 });
        if (player.trail.length > 12) player.trail.shift();
      }
      for (let i = player.trail.length - 1; i >= 0; i--) {
        const t = player.trail[i];
        t.life -= 0.08;
        if (t.life <= 0) { player.trail.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = t.life * 0.25;
        const r = 8 * t.life;
        const grd = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, r);
        grd.addColorStop(0, '#cd853f');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);

      // 飞行翅膀动画
      player.wingAngle += 0.18 * player.wingDir;
      if (Math.abs(player.wingAngle) > 0.35) player.wingDir *= -1;

      // 受击闪烁
      if (player.flash > 0) {
        player.flash--;
        ctx.globalAlpha = player.flash % 4 < 2 ? 1 : 0.4;
        ctx.shadowColor = player.flashColor;
        ctx.shadowBlur = 25;
      }

      // 翅膀
      ctx.fillStyle = 'rgba(205, 133, 63, 0.7)';
      ctx.save();
      ctx.rotate(player.wingAngle);
      ctx.beginPath();
      ctx.ellipse(-w * 0.35, -h * 0.1, w * 0.38, h * 0.18, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.rotate(-player.wingAngle);
      ctx.beginPath();
      ctx.ellipse(w * 0.35, -h * 0.1, w * 0.38, h * 0.18, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 身体（圆形书生）
      const bodyGrd = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.42);
      bodyGrd.addColorStop(0, '#fff8f0');
      bodyGrd.addColorStop(1, '#e8d5b5');
      ctx.fillStyle = bodyGrd;
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cd853f';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 书生帽子
      ctx.fillStyle = '#8b4513';
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.25, w * 0.28, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-w * 0.12, -h * 0.38, w * 0.24, h * 0.14);
      ctx.fillStyle = '#a0522d';
      ctx.beginPath();
      ctx.arc(0, -h * 0.38, w * 0.1, Math.PI, 0);
      ctx.fill();

      // 脸
      ctx.fillStyle = '#5d4037';
      // 眼睛
      ctx.beginPath();
      ctx.arc(-w * 0.12, -h * 0.05, 3.5, 0, Math.PI * 2);
      ctx.arc(w * 0.12, -h * 0.05, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // 嘴
      ctx.beginPath();
      ctx.arc(0, h * 0.08, 5, 0.1, Math.PI - 0.1);
      ctx.stroke();

      ctx.restore();
    };

    const drawTower = (tower) => {
      for (const block of tower.blocks) {
        const { x, y, w, h, text, isCorrect, hit } = block;

        ctx.save();

        // 阴影
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;

        // 方块背景（正误外观统一，反馈靠粒子与生命）
        let bg;
        let border;
        if (hit) {
          bg = 'rgba(205, 133, 63, 0.28)';
          border = '#a0522d';
        } else {
          bg = 'rgba(255, 248, 220, 0.97)';
          border = '#cd853f';
        }

        ctx.fillStyle = bg;
        ctx.strokeStyle = border;
        ctx.lineWidth = 2.5;

        const radius = 10;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // 文字
        ctx.fillStyle = '#5d4037';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.min(28, Math.max(20, h * 0.52))}px 'STSong', 'SimSun', 'Noto Serif SC', serif`;
        ctx.fillText(text, x + w / 2, y + h / 2, w - 18);

        ctx.restore();
      }
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
      if (gameState.value !== 'PLAYING') return;

      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      const speed = BASE_SPEED * speedMultiplier * DIFFICULTY_SPEEDS[selectedDifficulty.value];

      // 角色速度更新（完全由按键控制，无重力）
      if (keys.up) {
        player.vy -= PLAYER_ACCEL;
      } else if (keys.down) {
        player.vy += PLAYER_ACCEL;
      } else {
        player.vy *= PLAYER_FRICTION;
      }
      player.vy = Math.max(-PLAYER_MAX_VY, Math.min(PLAYER_MAX_VY, player.vy));
      if (Math.abs(player.vy) < 0.05) player.vy = 0;
      player.y += player.vy;

      if (keys.left) {
        player.vx -= PLAYER_ACCEL;
      } else if (keys.right) {
        player.vx += PLAYER_ACCEL;
      } else {
        player.vx *= PLAYER_FRICTION;
      }
      player.vx = Math.max(-PLAYER_MAX_VX, Math.min(PLAYER_MAX_VX, player.vx));
      if (Math.abs(player.vx) < 0.05) player.vx = 0;
      player.x += player.vx;

      // 边界（软反弹）
      const margin = 8;
      if (player.y < margin) {
        player.y = margin;
        player.vy = Math.abs(player.vy) * 0.4;
      }
      if (player.y + PLAYER_H > containerH - margin) {
        player.y = containerH - PLAYER_H - margin;
        player.vy = -Math.abs(player.vy) * 0.4;
      }
      if (player.x < margin) {
        player.x = margin;
        player.vx = Math.abs(player.vx) * 0.4;
      }
      if (player.x + PLAYER_W > containerW - margin) {
        player.x = containerW - PLAYER_W - margin;
        player.vx = -Math.abs(player.vx) * 0.4;
      }

      // 更新障碍物
      spawnTimer += dt;
      const spawnInterval = SPAWN_INTERVAL_BASE / FPS / speedMultiplier;
      if (spawnTimer >= spawnInterval) {
        spawnTimer = 0;
        createTower();
      }

      for (let i = towers.length - 1; i >= 0; i--) {
        const tower = towers[i];
        tower.x -= speed;
        for (const block of tower.blocks) {
          block.x = tower.x;
        }

        if (!tower.passed && tower.x + tower.w < player.x) {
          tower.passed = true;
        }

        if (tower.x < -tower.w - 40) {
          towers.splice(i, 1);
        }
      }

      // 碰撞检测
      processCollisions();
      syncHudQuestion();

      // 粒子
      updateParticles();

      // 距离/难度递增（按真实时间，不受速度影响）
      distance.value += dt * 60;
      speedMultiplier = 1 + distance.value / 5000;
      if (speedMultiplier > 1.55) speedMultiplier = 1.55;

      // 绘制
      ctx.clearRect(0, 0, containerW, containerH);
      drawBackground();

      for (const tower of towers) drawTower(tower);

      drawParticles();
      drawPlayer();

      animFrameId = requestAnimationFrame(gameLoop);
    };

    // ==================== 游戏控制 ====================

    const startGame = () => {
      score.value = 0;
      currentLives.value = INITIAL_LIVES;
      distance.value = 0;
      correctHits.value = 0;
      wrongHits.value = 0;
      usedQuestionIndices.value = [];
      speedMultiplier = 1;
      spawnTimer = 0;
      towers = [];
      particles = [];
      questionQueue = [];
      player.trail = [];
      player.y = containerH / 2;
      player.vx = 0;
      player.vy = 0;
      player.flash = 0;
      currentQuestion.value = null;
      refillQuestionQueue();
      createTower();
      syncHudQuestion();

      gameState.value = 'PLAYING';
      lastTime = performance.now();
      animFrameId = requestAnimationFrame(gameLoop);
    };

    const pauseGame = () => {
      if (gameState.value !== 'PLAYING') return;
      gameState.value = 'PAUSED';
      cancelAnimationFrame(animFrameId);
    };

    const resumeGame = () => {
      if (gameState.value !== 'PAUSED') return;
      gameState.value = 'PLAYING';
      lastTime = performance.now();
      animFrameId = requestAnimationFrame(gameLoop);
    };

    const endGame = () => {
      gameState.value = 'GAME_OVER';
      cancelAnimationFrame(animFrameId);
      // 绘制最终画面
      ctx.clearRect(0, 0, containerW, containerH);
      drawBackground();
      for (const tower of towers) drawTower(tower);
      drawPlayer();
    };

    const restartGame = () => {
      startGame();
    };

    const quitGame = () => {
      gameState.value = 'MENU';
      cancelAnimationFrame(animFrameId);
      towers = [];
      particles = [];
      questionQueue = [];
      ctx.clearRect(0, 0, containerW, containerH);
      drawBackground();
    };

    const goBack = () => {
      cancelAnimationFrame(animFrameId);
      router.push('/');
    };

    // ==================== 键盘事件 ====================

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { keys.up = true; e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') { keys.down = true; e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (gameState.value === 'PLAYING') pauseGame();
        else if (gameState.value === 'PAUSED') resumeGame();
      }
      if ((e.key === ' ' || e.key === 'Enter') && gameState.value === 'MENU') startGame();
    };

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.up = false;
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keys.down = false;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
    };

    // ==================== 生命周期 ====================

    onMounted(() => {
      initCanvas();
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    });

    onUnmounted(() => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (toastTimer) clearTimeout(toastTimer);
    });

    return {
      canvasRef, containerRef,
      gameState, score, currentLives, currentQuestion,
      distance, correctHits, wrongHits,
      selectedDifficulty, difficulties,
      toast, gradeText, gradeClass,
      startGame, resumeGame, restartGame, quitGame, goBack
    };
  }
};
</script>

<style scoped>
.poetry-parkour-wrapper {
  width: 100%;
  min-height: 100vh;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f9f3e9;
  position: relative;
  overflow: hidden;
  font-family: 'SimSun', 'STSong', 'Noto Serif SC', serif;
  box-sizing: border-box;
}

/* ===== HUD ===== */
.game-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: rgba(249, 243, 233, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);
  box-shadow: 0 4px 20px rgba(139, 69, 19, 0.08);
}

.hud-left { flex: 0 0 auto; }
.lives-display { display: flex; gap: 4px; align-items: center; }
.heart { font-size: 22px; transition: all 0.3s; }
.heart-lost { opacity: 0.2; transform: scale(0.8); }

.hud-center { flex: 1; text-align: center; padding: 0 16px; }
.current-question {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 248, 220, 0.9);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;
  padding: 8px 20px;
  max-width: 600px;
}
.q-label {
  color: #cd853f;
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
}
.q-text {
  color: #5d4037;
  font-size: 15px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.q-part {
  color: #5d4037;
  font-size: 15px;
}
.blank-slot {
  display: inline-block;
  vertical-align: bottom;
  /* 单字挖空：约一字宽 */
  width: 1.1em;
  min-width: 1.1em;
  border-bottom: 3px solid rgba(244, 67, 54, 0.85);
  margin: 0 1px;
  animation: blank-pulse 1.4s ease-in-out infinite;
  height: calc(15px + 4px); /* 文字高度 + border宽度 */
  box-sizing: border-box;
}
@keyframes blank-pulse {
  0%, 100% { border-bottom-color: rgba(244, 67, 54, 0.6); }
  50% { border-bottom-color: rgba(244, 67, 54, 1); box-shadow: 0 2px 6px rgba(244, 67, 54, 0.3); }
}

.hud-right { flex: 0 0 auto; }
.score-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 20px;
  font-weight: bold;
  color: #8b4513;
}
.score-num { font-size: 26px; }

/* ===== Canvas ===== */
.canvas-container {
  flex: 1 1 auto;
  position: relative;
  margin-top: 68px;
  width: 100%;
  max-width: 1560px;
  padding: 0 12px;
  box-sizing: border-box;
  min-height: 0;
  height: clamp(400px, calc(100vh - 150px), 780px);
  max-height: 780px;
}
.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(139, 69, 19, 0.12);
}

/* ===== 通用玻璃卡片 ===== */
.glass-card {
  background: rgba(255, 252, 240, 0.95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 28px;
  box-shadow: 0 12px 48px rgba(139, 69, 19, 0.18);
}
.glass-btn-primary {
  display: block;
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #4CAF50, #388E3C);
  border: none;
  border-radius: 18px;
  color: white;
  font-family: 'SimSun', 'STSong', 'Noto Serif SC', serif;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.3);
  margin-bottom: 12px;
}
.glass-btn-primary:hover {
  background: linear-gradient(135deg, #66BB6A, #43A047);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.4);
}
.glass-btn-secondary {
  display: block;
  width: 100%;
  padding: 14px;
  background: rgba(255, 248, 220, 0.9);
  border: 2px solid rgba(205, 133, 63, 0.4);
  border-radius: 18px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', 'Noto Serif SC', serif;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 12px;
}
.glass-btn-secondary:hover {
  background: rgba(255, 248, 220, 1);
  border-color: rgba(205, 133, 63, 0.7);
  transform: translateY(-2px);
}
.glass-btn-danger {
  display: block;
  width: 100%;
  padding: 14px;
  background: rgba(244, 67, 54, 0.15);
  border: 2px solid rgba(244, 67, 54, 0.4);
  border-radius: 18px;
  color: #c62828;
  font-family: 'SimSun', 'STSong', 'Noto Serif SC', serif;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 12px;
}
.glass-btn-danger:hover {
  background: rgba(244, 67, 54, 0.25);
  transform: translateY(-2px);
}

/* ===== 遮罩层 ===== */
.overlay-screen {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 69, 19, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* ===== 开始菜单 ===== */
.menu-card {
  padding: 44px 48px;
  max-width: 460px;
  width: 90%;
  text-align: center;
}
.menu-badge {
  display: inline-block;
  padding: 5px 16px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  border-radius: 20px;
  font-size: 13px;
  margin-bottom: 16px;
}
.menu-title {
  font-size: 42px;
  color: #8b4513;
  margin: 0 0 8px;
  text-shadow: 2px 2px 4px rgba(139, 69, 19, 0.15);
  font-weight: bold;
}
.menu-subtitle {
  color: #a0522d;
  font-size: 15px;
  margin: 0 0 28px;
}
.menu-rules {
  background: rgba(255, 248, 220, 0.7);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 24px;
  text-align: left;
}
.rule-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 14px;
  color: #5d4037;
}
.rule-row:last-child { margin-bottom: 0; }
.rule-key {
  min-width: 90px;
  padding: 4px 10px;
  background: rgba(205, 133, 63, 0.2);
  border-radius: 8px;
  font-weight: bold;
  color: #8b4513;
  font-size: 13px;
}
.menu-difficulty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 24px;
}
.diff-label { color: #8b4513; font-size: 15px; font-weight: bold; }
.diff-btn {
  padding: 8px 20px;
  border: 2px solid rgba(205, 133, 63, 0.35);
  border-radius: 14px;
  background: rgba(255, 248, 220, 0.7);
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.25s;
}
.diff-btn:hover { border-color: rgba(205, 133, 63, 0.7); }
.diff-btn.active {
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  border-color: transparent;
}

/* ===== 暂停 ===== */
.pause-card {
  padding: 36px 44px;
  max-width: 380px;
  width: 90%;
  text-align: center;
}
.pause-title {
  font-size: 30px;
  color: #8b4513;
  margin: 0 0 24px;
}
.pause-stats {
  background: rgba(255, 248, 220, 0.7);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 24px;
}
.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 15px;
  color: #5d4037;
  border-bottom: 1px solid rgba(205, 133, 63, 0.15);
}
.stat-row:last-child { border-bottom: none; }
.stat-val { font-weight: bold; color: #8b4513; }

/* ===== 游戏结束 ===== */
.gameover-card {
  padding: 36px 44px;
  max-width: 420px;
  width: 90%;
  text-align: center;
}
.gameover-badge { font-size: 48px; margin-bottom: 8px; }
.gameover-title {
  font-size: 32px;
  color: #c62828;
  margin: 0 0 24px;
}
.gameover-stats {
  background: rgba(255, 248, 220, 0.7);
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 20px;
}
.go-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 0;
  font-size: 15px;
  color: #5d4037;
  border-bottom: 1px solid rgba(205, 133, 63, 0.12);
}
.go-row:last-child { border-bottom: none; }
.go-val { font-weight: bold; font-size: 17px; }
.score-val { color: #8b4513; font-size: 22px; }
.correct-val { color: #4CAF50; }
.wrong-val { color: #f44336; }
.gameover-grade {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 24px;
  font-size: 16px;
  color: #8b4513;
}
.grade-badge {
  padding: 5px 18px;
  border-radius: 14px;
  font-size: 15px;
  font-weight: bold;
}
.grade-god { background: linear-gradient(135deg, #ffd700, #ff8c00); color: white; }
.grade-master { background: linear-gradient(135deg, #cd853f, #8b4513); color: white; }
.grade-senior { background: rgba(76, 175, 80, 0.2); color: #2e7d32; border: 1px solid rgba(76,175,80,0.4); }
.grade-junior { background: rgba(33, 150, 243, 0.15); color: #1565c0; border: 1px solid rgba(33,150,243,0.3); }
.grade-novice { background: rgba(158, 158, 158, 0.15); color: #757575; border: 1px solid rgba(158,158,158,0.3); }

/* ===== Toast ===== */
.game-toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 28px;
  border-radius: 20px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 15px;
  font-weight: bold;
  z-index: 200;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
.game-toast.success { background: rgba(76, 175, 80, 0.92); color: white; }
.game-toast.error { background: rgba(244, 67, 54, 0.92); color: white; }
.game-toast.info { background: rgba(139, 69, 19, 0.88); color: white; }

.toast-fade-enter-active, .toast-fade-leave-active { transition: all 0.3s; }
.toast-fade-enter-from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
.toast-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }
</style>
