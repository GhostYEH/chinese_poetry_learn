/**
 * 诗词评分与润色组件
 * 提供评分展示和AI润色功能
 */
<template>
  <div class="poem-scorer">
    <!-- 关闭按钮 -->
    <button class="close-btn" @click="$emit('close')" v-if="showClose">
      ×
    </button>

    <!-- 评分头部 -->
    <div class="score-header">
      <div class="header-decoration">
        <span class="deco-left">✦</span>
        <span class="header-title">作品评分</span>
        <span class="deco-right">✦</span>
      </div>
    </div>

    <!-- 总分展示 -->
    <div class="total-score-section" v-if="score">
      <div class="score-circle-container">
        <svg class="score-circle" viewBox="0 0 120 120">
          <defs>
            <linearGradient id="scoreGradientMain" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" :stop-color="getScoreColor(score.total)" />
              <stop offset="100%" :stop-color="getScoreColor(score.total, true)" />
            </linearGradient>
          </defs>
          <circle
            cx="60"
            cy="60"
            r="52"
            class="circle-bg"
          />
          <circle
            cx="60"
            cy="60"
            r="52"
            class="circle-progress"
            :style="{
              strokeDasharray: circleProgress,
              stroke: 'url(#scoreGradientMain)'
            }"
          />
        </svg>
        <div class="score-value">
          <span class="score-number">{{ score.total || 0 }}</span>
          <span class="score-max">/100</span>
        </div>
      </div>
      <div class="score-grade" :style="{ background: getGradeColor(score.total) }">
        {{ getGradeText(score.total) }}
      </div>
    </div>

    <!-- 评分维度 -->
    <div class="dimensions-section" v-if="score && score.dimensions">
      <h3 class="section-title">评分维度</h3>
      <div class="dimensions-grid">
        <div
          v-for="(value, key) in score.dimensions"
          :key="key"
          class="dimension-card"
        >
          <div class="dim-header">
            <span class="dim-icon">{{ getDimensionIcon(key) }}</span>
            <span class="dim-name">{{ getDimensionName(key) }}</span>
          </div>
          <div class="dim-bar-wrapper">
            <div class="dim-bar">
              <div
                class="dim-fill"
                :style="{
                  width: value + '%',
                  background: getDimensionColor(value)
                }"
              ></div>
            </div>
          </div>
          <div class="dim-value">
            <span class="value-number">{{ value }}</span>
            <span class="value-label">分</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 评分详情分析 -->
    <div class="analysis-section" v-if="score && score.analysis">
      <h3 class="section-title">详细分析</h3>
      <div class="analysis-cards">
        <div class="analysis-card" v-if="score.analysis.rhyme">
          <div class="analysis-icon">🎵</div>
          <div class="analysis-content">
            <h4>韵律分析</h4>
            <p>{{ score.analysis.rhyme }}</p>
          </div>
          <div class="analysis-status" :class="{ pass: score.analysis.rhymeOk }">
            {{ score.analysis.rhymeOk ? '✓ 良好' : '! 需改进' }}
          </div>
        </div>

        <div class="analysis-card" v-if="score.analysis.structure">
          <div class="analysis-icon">🏛️</div>
          <div class="analysis-content">
            <h4>结构分析</h4>
            <p>{{ score.analysis.structure }}</p>
          </div>
          <div class="analysis-status" :class="{ pass: score.analysis.structureOk }">
            {{ score.analysis.structureOk ? '✓ 良好' : '! 需改进' }}
          </div>
        </div>

        <div class="analysis-card" v-if="score.analysis.meaning">
          <div class="analysis-icon">💭</div>
          <div class="analysis-content">
            <h4>意境分析</h4>
            <p>{{ score.analysis.meaning }}</p>
          </div>
          <div class="analysis-status" :class="{ pass: score.analysis.meaningOk }">
            {{ score.analysis.meaningOk ? '✓ 良好' : '! 需改进' }}
          </div>
        </div>

        <div class="analysis-card" v-if="score.analysis.language">
          <div class="analysis-icon">✍️</div>
          <div class="analysis-content">
            <h4>语言分析</h4>
            <p>{{ score.analysis.language }}</p>
          </div>
          <div class="analysis-status" :class="{ pass: score.analysis.languageOk }">
            {{ score.analysis.languageOk ? '✓ 良好' : '! 需改进' }}
          </div>
        </div>
      </div>
    </div>

    <!-- 改进建议 -->
    <div class="suggestions-section" v-if="score && score.suggestions">
      <h3 class="section-title">
        <span class="title-icon">💡</span>
        改进建议
      </h3>
      <div class="suggestions-box">
        <p class="suggestion-text">{{ score.suggestions }}</p>
      </div>
    </div>

    <!-- 润色功能 -->
    <div class="polish-section" v-if="showPolish">
      <h3 class="section-title">
        <span class="title-icon">✨</span>
        AI润色
      </h3>
      <div class="polish-options">
        <div class="polish-description">
          <p>AI将帮你：</p>
          <ul>
            <li>优化词汇选择</li>
            <li>调整韵律节奏</li>
            <li>保持原有意境</li>
          </ul>
        </div>
        <div class="polish-actions">
          <button
            class="polish-btn"
            @click="$emit('polish', 'optimize')"
            :disabled="isPolishing"
          >
            <span v-if="isPolishing" class="loading-spinner-small"></span>
            <span v-else>✨</span>
            <span>{{ isPolishing ? '润色中...' : '优化诗句' }}</span>
          </button>
          <button
            class="polish-btn secondary"
            @click="$emit('polish', 'rewrite')"
            :disabled="isPolishing"
          >
            <span v-if="isPolishing" class="loading-spinner-small"></span>
            <span v-else>🔄</span>
            <span>{{ isPolishing ? '重写中...' : '重新生成' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 润色结果 -->
    <transition name="fade-up">
      <div class="polish-result" v-if="polishResult">
        <div class="result-header">
          <h4>润色结果</h4>
          <button class="compare-btn" @click="showCompare = !showCompare">
            {{ showCompare ? '收起对比' : '查看对比' }}
          </button>
        </div>

        <div class="polished-poem">
          <pre class="poem-text">{{ polishResult.poem }}</pre>
        </div>

        <div class="polish-explanation" v-if="polishResult.explanation">
          <h5>润色说明：</h5>
          <p>{{ polishResult.explanation }}</p>
        </div>

        <!-- 对比视图 -->
        <transition name="slide-down">
          <div class="compare-view" v-if="showCompare && polishResult.original">
            <div class="compare-column original">
              <h5>原文</h5>
              <pre>{{ polishResult.original }}</pre>
            </div>
            <div class="compare-column polished">
              <h5>润色后</h5>
              <pre>{{ polishResult.poem }}</pre>
            </div>
          </div>
        </transition>

        <div class="result-actions">
          <button class="apply-btn" @click="applyPolishResult">
            <span>✓</span>
            <span>应用润色</span>
          </button>
          <button class="discard-btn" @click="discardPolishResult">
            <span>×</span>
            <span>保留原文</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- 操作按钮 -->
    <div class="score-actions" v-if="showActions">
      <button class="close-action-btn" @click="$emit('close')">
        关闭
      </button>
      <button class="save-action-btn" @click="$emit('save')">
        <span>✓</span>
        <span>保存作品</span>
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';

export default {
  name: 'PoemScorer',
  props: {
    score: {
      type: Object,
      default: null
    },
    showClose: {
      type: Boolean,
      default: true
    },
    showPolish: {
      type: Boolean,
      default: true
    },
    showActions: {
      type: Boolean,
      default: true
    },
    isPolishing: {
      type: Boolean,
      default: false
    },
    polishResult: {
      type: Object,
      default: null
    }
  },
  emits: ['close', 'save', 'polish', 'apply'],
  setup(props, { emit }) {
    const showCompare = ref(false);

    // 计算圆环进度
    const circleProgress = computed(() => {
      if (!props.score) return '0 327';
      const progress = (props.score.total || 0) / 100;
      const circumference = 2 * Math.PI * 52; // r=52
      return `${circumference * progress} ${circumference}`;
    });

    // 获取分数颜色
    const getScoreColor = (score, isEnd = false) => {
      if (score >= 90) return isEnd ? '#4caf50' : '#81c784';
      if (score >= 75) return isEnd ? '#ff9800' : '#ffb74d';
      if (score >= 60) return isEnd ? '#ff5722' : '#ff8a65';
      return isEnd ? '#f44336' : '#e57373';
    };

    // 获取等级文字
    const getGradeText = (score) => {
      if (score >= 90) return '卓越';
      if (score >= 80) return '优秀';
      if (score >= 70) return '良好';
      if (score >= 60) return '及格';
      return '待提升';
    };

    // 获取等级颜色
    const getGradeColor = (score) => {
      if (score >= 90) return 'linear-gradient(135deg, #81c784, #4caf50)';
      if (score >= 80) return 'linear-gradient(135deg, #ffb74d, #ff9800)';
      if (score >= 70) return 'linear-gradient(135deg, #ff8a65, #ff5722)';
      if (score >= 60) return 'linear-gradient(135deg, #fff176, #ffee58)';
      return 'linear-gradient(135deg, #e57373, #f44336)';
    };

    // 获取维度名称
    const getDimensionName = (key) => {
      const names = {
        content: '内容契合',
        rhythm: '韵律美感',
        mood: '意境表达',
        language: '语言流畅',
        creativity: '创意性',
        keyword: '关键字'
      };
      return names[key] || key;
    };

    // 获取维度图标
    const getDimensionIcon = (key) => {
      const icons = {
        content: '📝',
        rhythm: '🎵',
        mood: '🎭',
        language: '✍️',
        creativity: '💡',
        keyword: '🔑'
      };
      return icons[key] || '📊';
    };

    // 获取维度颜色
    const getDimensionColor = (value) => {
      if (value >= 85) return 'linear-gradient(90deg, #81c784, #4caf50)';
      if (value >= 70) return 'linear-gradient(90deg, #ffb74d, #ff9800)';
      if (value >= 55) return 'linear-gradient(90deg, #ff8a65, #ff5722)';
      return 'linear-gradient(90deg, #e57373, #f44336)';
    };

    // 应用润色结果
    const applyPolishResult = () => {
      emit('apply', props.polishResult);
    };

    // 放弃润色结果
    const discardPolishResult = () => {
      emit('close');
    };

    return {
      showCompare,
      circleProgress,
      getScoreColor,
      getGradeText,
      getGradeColor,
      getDimensionName,
      getDimensionIcon,
      getDimensionColor,
      applyPolishResult,
      discardPolishResult
    };
  }
};
</script>

<style scoped>
.poem-scorer {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24px;
  padding: 32px;
  position: relative;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 60px rgba(139, 115, 85, 0.2);
}

/* 关闭按钮 */
.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(139, 115, 85, 0.1);
  border: none;
  color: #8b7355;
  font-size: 22px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: #8b7355;
  color: white;
}

/* 评分头部 */
.score-header {
  text-align: center;
  margin-bottom: 28px;
}

.header-decoration {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.deco-left,
.deco-right {
  color: #d4a574;
  font-size: 14px;
}

.header-title {
  font-size: 26px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  font-weight: bold;
}

/* 总分展示 */
.total-score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.score-circle-container {
  position: relative;
  width: 140px;
  height: 140px;
}

.score-circle {
  transform: rotate(-90deg);
  width: 140px;
  height: 140px;
}

.circle-bg {
  fill: none;
  stroke: rgba(139, 115, 85, 0.1);
  stroke-width: 10;
}

.circle-progress {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dasharray 1.5s ease-out;
}

.score-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.score-number {
  display: block;
  font-size: 42px;
  font-weight: bold;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  line-height: 1;
}

.score-max {
  font-size: 14px;
  color: #8b7355;
}

.score-grade {
  padding: 8px 24px;
  border-radius: 20px;
  color: white;
  font-size: 15px;
  font-weight: 500;
  font-family: 'Noto Serif SC', serif;
}

/* 评分维度 */
.dimensions-section {
  margin-bottom: 28px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  color: #5d4e37;
  margin: 0 0 16px 0;
  font-family: 'Noto Serif SC', serif;
}

.title-icon {
  font-size: 18px;
}

.dimensions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.dimension-card {
  background: rgba(139, 115, 85, 0.05);
  border-radius: 14px;
  padding: 14px;
}

.dim-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.dim-icon {
  font-size: 16px;
}

.dim-name {
  font-size: 13px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
}

.dim-bar-wrapper {
  margin-bottom: 8px;
}

.dim-bar {
  height: 8px;
  background: rgba(139, 115, 85, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.dim-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 1s ease-out;
}

.dim-value {
  text-align: right;
}

.value-number {
  font-size: 18px;
  font-weight: bold;
  color: #5d4e37;
}

.value-label {
  font-size: 12px;
  color: #8b7355;
}

/* 分析详情 */
.analysis-section {
  margin-bottom: 28px;
}

.analysis-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.analysis-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  border: 1px solid rgba(139, 115, 85, 0.1);
}

.analysis-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.analysis-content {
  flex: 1;
}

.analysis-content h4 {
  font-size: 14px;
  color: #5d4e37;
  margin: 0 0 4px 0;
  font-family: 'Noto Serif SC', serif;
}

.analysis-content p {
  font-size: 13px;
  color: #666;
  margin: 0;
  line-height: 1.5;
}

.analysis-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 10px;
  background: rgba(229, 115, 115, 0.15);
  color: #e57373;
  flex-shrink: 0;
}

.analysis-status.pass {
  background: rgba(129, 199, 132, 0.15);
  color: #81c784;
}

/* 改进建议 */
.suggestions-section {
  margin-bottom: 28px;
}

.suggestions-box {
  background: linear-gradient(135deg, rgba(212, 165, 116, 0.08), rgba(139, 115, 85, 0.05));
  border-radius: 14px;
  padding: 16px;
  border-left: 4px solid #d4a574;
}

.suggestion-text {
  font-size: 14px;
  color: #666;
  line-height: 1.7;
  margin: 0;
}

/* 润色区域 */
.polish-section {
  margin-bottom: 24px;
}

.polish-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.polish-description {
  background: rgba(139, 115, 85, 0.05);
  border-radius: 12px;
  padding: 14px;
}

.polish-description p {
  font-size: 13px;
  color: #5d4e37;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.polish-description ul {
  margin: 0;
  padding-left: 20px;
  list-style: none;
}

.polish-description li {
  font-size: 13px;
  color: #666;
  padding: 4px 0;
  position: relative;
}

.polish-description li::before {
  content: '•';
  color: #d4a574;
  position: absolute;
  left: -12px;
}

.polish-actions {
  display: flex;
  gap: 12px;
}

.polish-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  background: linear-gradient(135deg, #8b7355, #a08060);
  color: white;
  font-family: 'Noto Serif SC', serif;
}

.polish-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 115, 85, 0.25);
}

.polish-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.polish-btn.secondary {
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(139, 115, 85, 0.2);
  color: #8b7355;
}

.polish-btn.secondary:hover:not(:disabled) {
  border-color: #8b7355;
  background: rgba(139, 115, 85, 0.05);
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 润色结果 */
.polish-result {
  background: rgba(139, 115, 85, 0.05);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.result-header h4 {
  font-size: 16px;
  color: #5d4e37;
  margin: 0;
  font-family: 'Noto Serif SC', serif;
}

.compare-btn {
  font-size: 13px;
  color: #8b7355;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.compare-btn:hover {
  color: #5d4e37;
}

.polished-poem {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.poem-text {
  font-size: 17px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.8;
  margin: 0;
  white-space: pre-wrap;
}

.polish-explanation {
  margin-bottom: 16px;
}

.polish-explanation h5 {
  font-size: 13px;
  color: #8b7355;
  margin: 0 0 6px 0;
}

.polish-explanation p {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
  margin: 0;
}

.compare-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 16px 0;
}

.compare-column {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10px;
  padding: 12px;
}

.compare-column h5 {
  font-size: 12px;
  color: #8b7355;
  margin: 0 0 8px 0;
  text-align: center;
}

.compare-column pre {
  font-size: 14px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  text-align: center;
}

.result-actions {
  display: flex;
  gap: 12px;
}

.apply-btn,
.discard-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.apply-btn {
  background: linear-gradient(135deg, #81c784, #4caf50);
  border: none;
  color: white;
}

.apply-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(76, 175, 80, 0.25);
}

.discard-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(139, 115, 85, 0.2);
  color: #8b7355;
}

.discard-btn:hover {
  background: rgba(139, 115, 85, 0.05);
}

/* 操作按钮 */
.score-actions {
  display: flex;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid rgba(139, 115, 85, 0.1);
}

.close-action-btn,
.save-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.close-action-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(139, 115, 85, 0.2);
  color: #8b7355;
}

.close-action-btn:hover {
  background: rgba(139, 115, 85, 0.05);
  border-color: #8b7355;
}

.save-action-btn {
  background: linear-gradient(135deg, #d4a574, #8b7355);
  border: none;
  color: white;
}

.save-action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(139, 115, 85, 0.3);
}

/* 动画 */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.4s ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
}

/* 响应式 */
@media (max-width: 600px) {
  .poem-scorer {
    padding: 24px;
    border-radius: 20px;
  }

  .dimensions-grid {
    grid-template-columns: 1fr;
  }

  .compare-view {
    grid-template-columns: 1fr;
  }

  .polish-actions {
    flex-direction: column;
  }
}
</style>
