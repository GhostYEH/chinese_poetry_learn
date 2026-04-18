/**
 * 诗词编辑器组件
 * Step 3: 创作编辑 - 核心编辑器，支持逐行输入和AI辅助
 */
<template>
  <div class="poem-editor">
    <!-- 面板标题 -->
    <div class="panel-header">
      <div class="header-icon">✒️</div>
      <div class="header-text">
        <h2>诗词编辑器</h2>
        <p>逐行创作，AI实时辅助</p>
      </div>
    </div>

    <!-- 标题输入区 -->
    <div class="title-section">
      <input
        type="text"
        v-model="localTitle"
        placeholder="输入诗词标题（选填）"
        class="title-input"
        @input="$emit('update:title', localTitle)"
      />
    </div>

    <!-- 编辑器主体 -->
    <div class="editor-main">
      <!-- 诗句输入区 -->
      <div class="lines-editor">
        <!-- 头部提示 -->
        <div class="editor-hint">
          <div class="hint-left">
            <span class="hint-icon">💡</span>
            <span class="hint-text">每句一行，输入时AI会给出续写建议</span>
          </div>
          <div class="ai-toggle">
            <input
              type="checkbox"
              id="aiToggle"
              v-model="aiAssistanceEnabled"
            />
            <label for="aiToggle" class="toggle-label">
              <span class="toggle-switch"></span>
              <span>AI续写建议</span>
            </label>
          </div>
        </div>

        <!-- 诗句行 -->
        <div class="lines-container">
          <div
            v-for="(line, index) in localLines"
            :key="index"
            :class="['line-row', { active: activeLineIndex === index, completed: line.trim() }]"
          >
            <div class="line-indicator">
              <span class="line-number">{{ index + 1 }}</span>
              <span class="line-role" v-if="structureRoles[index]">
                {{ structureRoles[index] }}
              </span>
            </div>

            <div class="line-input-wrapper">
              <textarea
                v-model="localLines[index]"
                :placeholder="getPlaceholder(index)"
                class="line-input"
                rows="1"
                @input="handleLineInput($event, index)"
                @focus="activeLineIndex = index"
                @blur="requestLineRecommendation(index)"
                ref="lineInputs"
              ></textarea>

              <!-- 字数提示 -->
              <div class="char-count" :class="{ warning: getLineCharCount(index) !== expectedChars }">
                {{ getLineCharCount(index) }}/{{ expectedChars }}
              </div>
            </div>

            <!-- 删除按钮 -->
            <button
              class="delete-line-btn"
              @click="removeLine(index)"
              v-if="localLines.length > 1"
            >
              ×
            </button>
          </div>

          <!-- AI推荐面板 -->
          <transition name="slide-down">
            <div v-if="showRecommendations && recommendations.length > 0" class="recommendations-panel">
              <div class="recommendations-header">
                <span class="rec-icon">✦</span>
                <span>AI续写推荐</span>
                <button class="close-rec-btn" @click="showRecommendations = false">×</button>
              </div>
              <div class="recommendations-list">
                <div
                  v-for="(rec, recIndex) in recommendations"
                  :key="recIndex"
                  class="recommendation-item"
                  @click="applyRecommendation(rec.line, recIndex)"
                >
                  <div class="rec-line">{{ rec.line }}</div>
                  <div class="rec-reason">
                    <span class="reason-icon">📝</span>
                    {{ rec.reason }}
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- 底部操作区 -->
        <div class="editor-footer">
          <button class="add-line-btn" @click="addLine" v-if="canAddLine">
            <span>+</span> 添加诗句
          </button>
        </div>
      </div>

      <!-- AI辅助面板（右侧） -->
      <div class="ai-assistant-panel" v-if="aiAssistanceEnabled">
        <div class="assistant-header">
          <span class="assistant-icon">🤖</span>
          <h3>AI助手</h3>
        </div>

        <!-- 当前状态 -->
        <div class="assistant-status">
          <div class="status-label">创作状态</div>
          <div class="status-value">
            <span class="status-badge" :class="currentStatus">
              {{ statusText }}
            </span>
          </div>
        </div>

        <!-- 实时提示 -->
        <div class="realtime-tips" v-if="currentTips.length > 0">
          <div class="tips-label">✎ 创作提示</div>
          <div class="tips-list">
            <div v-for="(tip, i) in currentTips" :key="i" class="tip-item">
              {{ tip }}
            </div>
          </div>
        </div>

        <!-- 韵律检查 -->
        <div class="rhyme-check" v-if="rhymeAnalysis">
          <div class="check-label">🎵 韵律检查</div>
          <div class="check-result">
            <div class="check-item">
              <span class="check-icon" :class="{ pass: rhymeAnalysis.rhymeOk }">
                {{ rhymeAnalysis.rhymeOk ? '✓' : '!' }}
              </span>
              <span>押韵：{{ rhymeAnalysis.rhymeStatus }}</span>
            </div>
            <div class="check-item">
              <span class="check-icon" :class="{ pass: rhymeAnalysis.structureOk }">
                {{ rhymeAnalysis.structureOk ? '✓' : '!' }}
              </span>
              <span>结构：{{ rhymeAnalysis.structureStatus }}</span>
            </div>
          </div>
        </div>

        <!-- 快捷操作 -->
        <div class="quick-actions">
          <div class="actions-label">⚡ 快捷操作</div>
          <button class="action-btn" @click="$emit('polish')" :disabled="!hasContent">
            <span class="action-icon">✨</span>
            <span>AI优化诗句</span>
          </button>
          <button class="action-btn" @click="$emit('score')" :disabled="!hasContent">
            <span class="action-icon">⭐</span>
            <span>评分作品</span>
          </button>
          <button class="action-btn" @click="clearAll" :disabled="!hasContent">
            <span class="action-icon">🗑️</span>
            <span>清空重写</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="bottom-actions">
      <button class="back-btn" @click="$emit('back')">
        <span>←</span>
        <span>返回结构</span>
      </button>
      <div class="action-group">
        <button class="score-btn" @click="$emit('score')" :disabled="!hasContent">
          <span>✧</span>
          <span>评分作品</span>
        </button>
        <button class="save-btn" @click="$emit('save')" :disabled="!hasContent">
          <span>✓</span>
          <span>保存作品</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, watch, nextTick } from 'vue';

export default {
  name: 'PoemEditor',
  props: {
    title: {
      type: String,
      default: ''
    },
    lines: {
      type: Array,
      default: () => ['', '', '', '']
    },
    genre: {
      type: String,
      default: '五言绝句'
    },
    theme: {
      type: String,
      default: ''
    },
    keywords: {
      type: Array,
      default: () => []
    },
    isPolishing: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:title', 'update:lines', 'recommend', 'polish', 'score', 'save', 'back'],
  setup(props, { emit }) {
    const localTitle = ref(props.title);
    const localLines = ref([...props.lines]);
    const activeLineIndex = ref(0);
    const aiAssistanceEnabled = ref(true);
    const recommendations = ref([]);
    const showRecommendations = ref(false);
    const isRequestingRecommendation = ref(false);
    const currentTips = ref([]);
    const rhymeAnalysis = ref(null);
    const lineInputs = ref([]);

    // 计算属性
    const expectedChars = computed(() => {
      return props.genre.includes('七') ? 7 : 5;
    });

    const expectedLines = computed(() => {
      if (props.genre === '宋词') return 0;
      return props.genre.includes('律诗') ? 8 : 4;
    });

    const canAddLine = computed(() => {
      return expectedLines.value === 0 || localLines.value.length < expectedLines.value;
    });

    const hasContent = computed(() => {
      return localLines.value.some(l => l.trim()) || localTitle.value.trim();
    });

    const structureRoles = computed(() => {
      const roles = ['起', '承', '转', '合'];
      if (expectedLines.value === 8) {
        return ['起', '承', '承', '转', '转', '合', '合', '合'];
      }
      return roles.slice(0, localLines.value.length);
    });

    const currentStatus = computed(() => {
      const filledLines = localLines.value.filter(l => l.trim()).length;
      if (filledLines === 0) return 'empty';
      if (filledLines < localLines.value.length) return 'writing';
      return 'completed';
    });

    const statusText = computed(() => {
      const statusMap = {
        'empty': '等待创作',
        'writing': '创作中',
        'completed': '已完成'
      };
      return statusMap[currentStatus.value];
    });

    // 方法
    const getPlaceholder = (index) => {
      const placeholders = {
        0: '第一句（起）：点明题意...',
        1: '第二句（承）：承接延续...',
        2: '第三句（转）：转折变化...',
        3: '第四句（合）：总结收束...'
      };
      if (props.genre.includes('律诗')) {
        if (index === 0) return '首联（起）：点明题意...';
        if (index === 1) return '颔联（承）：对仗工整...';
        if (index === 2) return '颈联（转）：转折变化...';
        if (index === 3) return '颈联续：对仗工整...';
        if (index === 4) return '颔联续：对仗工整...';
        if (index === 5) return '颈联续：对仗工整...';
        if (index === 6) return '尾联（合）：总结收束...';
        if (index === 7) return '尾联续：点明主旨...';
      }
      return placeholders[index] || `第${index + 1}句...`;
    };

    const getLineCharCount = (index) => {
      return localLines.value[index].replace(/\s/g, '').length;
    };

    const handleLineInput = (event, index) => {
      // 自动调整高度
      const textarea = event.target;
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';

      // 实时字数显示
      const charCount = getLineCharCount(index);

      // 更新韵律检查
      updateRhymeAnalysis();

      // 发送更新
      emit('update:lines', [...localLines.value]);

      // 更新提示
      updateCurrentTips(index);
    };

    const requestLineRecommendation = (index) => {
      if (!aiAssistanceEnabled.value) return;

      const currentLine = localLines.value[index];
      if (!currentLine.trim()) return;

      // 获取当前所有非空行
      const currentLines = localLines.value.slice(0, index + 1).filter(l => l.trim());

      emit('recommend', {
        currentLines: currentLines.join('\n'),
        genre: props.genre,
        theme: props.theme,
        lineNumber: index + 1,
        maxLength: expectedChars.value
      });

      showRecommendations.value = true;
    };

    const applyRecommendation = (line, index) => {
      // 找到下一个空行
      const emptyIndex = localLines.value.findIndex(l => !l.trim());
      if (emptyIndex !== -1) {
        localLines.value[emptyIndex] = line;
      } else if (canAddLine.value) {
        localLines.value.push(line);
      }

      recommendations.value.splice(index, 1);
      if (recommendations.value.length === 0) {
        showRecommendations.value = false;
      }

      emit('update:lines', [...localLines.value]);

      // 聚焦到应用的那一行
      nextTick(() => {
        if (lineInputs.value[emptyIndex]) {
          lineInputs.value[emptyIndex].focus();
        }
      });
    };

    const addLine = () => {
      if (canAddLine.value) {
        localLines.value.push('');
        emit('update:lines', [...localLines.value]);

        nextTick(() => {
          const lastIndex = localLines.value.length - 1;
          if (lineInputs.value[lastIndex]) {
            lineInputs.value[lastIndex].focus();
          }
        });
      }
    };

    const removeLine = (index) => {
      if (localLines.value.length > 1) {
        localLines.value.splice(index, 1);
        emit('update:lines', [...localLines.value]);
      }
    };

    const updateRhymeAnalysis = () => {
      const filledLines = localLines.value.filter(l => l.trim());
      if (filledLines.length < 2) {
        rhymeAnalysis.value = null;
        return;
      }

      const currentGenre = props.genre;
      const lastLineText = filledLines[filledLines.length - 1];
      const lastCharOfCurrent = lastLineText.slice(-1);

      let rhymeOk = true;
      let rhymeStatus = '良好';

      // 律诗和绝句的押韵规则
      if (currentGenre.includes('绝句') || currentGenre.includes('律诗')) {
        const rhymingLines = [];
        if (currentGenre.includes('绝句')) { // 绝句二四句押韵
          if (filledLines.length >= 2) rhymingLines.push(filledLines[1]);
          if (filledLines.length >= 4) rhymingLines.push(filledLines[3]);
        } else { // 律诗偶数句押韵，首句可入韵
          if (filledLines.length >= 1 && currentGenre.includes('律诗')) rhymingLines.push(filledLines[0]); // 首句可入韵
          if (filledLines.length >= 2) rhymingLines.push(filledLines[1]);
          if (filledLines.length >= 4) rhymingLines.push(filledLines[3]);
          if (filledLines.length >= 6) rhymingLines.push(filledLines[5]);
          if (filledLines.length >= 8) rhymingLines.push(filledLines[7]);
        }

        // 检查当前行是否是押韵句，并与之前的押韵句比较
        const currentLineIndex = filledLines.length - 1;
        const isCurrentLineRhyming = (currentGenre.includes('绝句') && (currentLineIndex === 1 || currentLineIndex === 3)) ||
                                     (currentGenre.includes('律诗') && (currentLineIndex % 2 === 1 || currentLineIndex === 0));

        if (isCurrentLineRhyming && rhymingLines.length > 1) {
          const firstRhymingChar = rhymingLines[0].slice(-1);
          if (lastCharOfCurrent !== firstRhymingChar) {
            rhymeOk = false;
            rhymeStatus = '韵脚不一致，建议调整';
          }
        }
      }

      const structureOk = filledLines.length === expectedLines.value || expectedLines.value === 0;
      const structureStatus = structureOk ? '完整' : '进行中';

      rhymeAnalysis.value = {
        rhymeOk: rhymeOk,
        rhymeStatus: rhymeStatus,
        structureOk: structureOk,
        structureStatus: structureStatus
      };
    };

    const updateCurrentTips = (index) => {
      const tips = [];
      const currentLineText = localLines.value[index].trim();
      const filledLinesCount = localLines.value.filter(l => l.trim()).length;
      const isLastLine = index === localLines.value.length - 1;

      // 1. 字数检查
      const charCount = getLineCharCount(index);
      if (charCount > 0 && charCount !== expectedChars.value) {
        tips.push(`注意：当前句应为${expectedChars.value}字，您已输入${charCount}字。`);
      }

      // 2. 结构指导
      const currentRole = structureRoles.value[index];
      if (currentRole) {
        switch (currentRole) {
          case '起':
            tips.push('起句：开篇点题，或以景物烘托气氛，引人入胜。');
            break;
          case '承':
            tips.push('承句：承接起句，展开描写或叙述，深化意境。');
            break;
          case '转':
            tips.push('转句：转换角度，或引入新意，使诗意跌宕起伏。');
            break;
          case '合':
            tips.push('合句：收束全篇，点明主旨，或留下余韵。');
            break;
        }
      }

      // 3. 押韵提醒
      if (rhymeAnalysis.value && !rhymeAnalysis.value.rhymeOk) {
        tips.push(`韵律提示：${rhymeAnalysis.value.rhymeStatus}。请检查押韵字是否一致。`);
      }

      // 4. 对仗提醒 (仅律诗)
      if (props.genre.includes('律诗')) {
        if (index === 1 || index === 3 || index === 5) { // 颔联、颈联、尾联的上句
          if (localLines.value[index].trim() && !localLines.value[index + 1]?.trim()) {
            tips.push('律诗对仗：请注意本句与下一句（出句与对句）的词性、结构对仗。');
          }
        }
      }

      // 5. 关键词融入建议
      if (props.keywords && props.keywords.length > 0 && filledLinesCount < expectedLines.value) {
        const usedKeywords = props.keywords.filter(kw => currentLineText.includes(kw));
        const unusedKeywords = props.keywords.filter(kw => !usedKeywords.includes(kw));
        if (unusedKeywords.length > 0) {
          tips.push(`建议融入关键词：${unusedKeywords.slice(0, 2).join('、')}...`);
        }
      }

      // 6. 避免常见问题
      if (currentLineText.length > 0) {
        if (currentLineText.includes('很') || currentLineText.includes('非常') || currentLineText.includes('特别')) {
          tips.push('用词建议：避免口语化词汇，力求典雅。');
        }
        if (currentLineText.match(/[0-9a-zA-Z]/)) {
          tips.push('用词建议：避免现代词汇或英文。');
        }
      }

      // 7. 完成提示
      if (filledLinesCount === expectedLines.value && expectedLines.value > 0) {
        tips.push('恭喜！诗歌已完成，可以进行评分和保存。');
      }

      currentTips.value = tips;
    };

    const clearAll = () => {
      localLines.value = ['', '', '', ''];
      localTitle.value = '';
      recommendations.value = [];
      showRecommendations.value = false;
      rhymeAnalysis.value = null;
      currentTips.value = [];
      emit('update:lines', [...localLines.value]);
      emit('update:title', '');

      nextTick(() => {
        if (lineInputs.value[0]) {
          lineInputs.value[0].focus();
        }
      });
    };

    // 设置推荐
    const setRecommendations = (recs) => {
      recommendations.value = recs;
      if (recs.length > 0) {
        showRecommendations.value = true;
      }
    };

    // 设置诗句（用于AI生成）
    const setLines = (lines) => {
      localLines.value = lines;
      emit('update:lines', [...localLines.value]);
    };

    // 设置标题
    const setTitle = (title) => {
      localTitle.value = title;
      emit('update:title', title);
    };

    // 监听props变化
    watch(() => props.lines, (newLines) => {
      localLines.value = [...newLines];
    }, { deep: true });

    watch(() => props.title, (newTitle) => {
      localTitle.value = newTitle;
    });

    return {
      localTitle,
      localLines,
      activeLineIndex,
      aiAssistanceEnabled,
      recommendations,
      showRecommendations,
      currentTips,
      rhymeAnalysis,
      lineInputs,
      expectedChars,
      canAddLine,
      hasContent,
      structureRoles,
      currentStatus,
      statusText,
      getPlaceholder,
      getLineCharCount,
      handleLineInput,
      requestLineRecommendation,
      applyRecommendation,
      addLine,
      removeLine,
      clearAll,
      setRecommendations,
      setLines,
      setTitle
    };
  }
};
</script>

<style scoped>
.poem-editor {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 面板标题 */
.panel-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(139, 115, 85, 0.1);
}

.header-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(139, 115, 85, 0.1));
  border-radius: 14px;
}

.header-text h2 {
  font-size: 20px;
  color: #5d4e37;
  margin: 0 0 4px 0;
  font-family: 'Noto Serif SC', serif;
}

.header-text p {
  font-size: 13px;
  color: #8b7355;
  margin: 0;
}

/* 标题输入 */
.title-section {
  margin-bottom: 8px;
}

.title-input {
  width: 100%;
  padding: 14px 18px;
  border: 2px solid rgba(139, 115, 85, 0.15);
  border-radius: 12px;
  font-size: 20px;
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
  font-family: 'Noto Serif SC', serif;
  color: #5d4e37;
  transition: all 0.3s ease;
}

.title-input:focus {
  outline: none;
  border-color: #d4a574;
  box-shadow: 0 0 0 3px rgba(212, 165, 116, 0.1);
}

.title-input::placeholder {
  color: #b8a88a;
  font-style: italic;
}

/* 编辑器主体 */
.editor-main {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
}

/* 诗句编辑器 */
.lines-editor {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(139, 115, 85, 0.12);
}

/* 编辑器提示 */
.editor-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px dashed rgba(139, 115, 85, 0.15);
}

.hint-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint-icon {
  font-size: 16px;
}

.hint-text {
  font-size: 13px;
  color: #8b7355;
}

/* AI开关 */
.ai-toggle {
  display: flex;
  align-items: center;
}

.ai-toggle input {
  display: none;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #8b7355;
}

.toggle-switch {
  width: 36px;
  height: 20px;
  background: rgba(139, 115, 85, 0.2);
  border-radius: 10px;
  position: relative;
  transition: all 0.3s ease;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: all 0.3s ease;
}

.ai-toggle input:checked + .toggle-label .toggle-switch {
  background: linear-gradient(135deg, #d4a574, #8b7355);
}

.ai-toggle input:checked + .toggle-label .toggle-switch::after {
  left: 18px;
}

/* 诗句行 */
.lines-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.line-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.line-row.active {
  background: rgba(212, 165, 116, 0.08);
  border-color: rgba(212, 165, 116, 0.3);
}

.line-row.completed {
  background: rgba(139, 115, 85, 0.05);
}

.line-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 32px;
}

.line-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 115, 85, 0.1);
  color: #8b7355;
  border-radius: 50%;
  font-size: 13px;
  font-weight: bold;
}

.line-role {
  font-size: 10px;
  color: #8b7355;
  padding: 2px 6px;
  background: rgba(212, 165, 116, 0.15);
  border-radius: 8px;
}

.line-input-wrapper {
  flex: 1;
  position: relative;
}

.line-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid rgba(139, 115, 85, 0.15);
  border-radius: 10px;
  font-size: 18px;
  background: rgba(255, 255, 255, 0.9);
  font-family: 'Noto Serif SC', serif;
  color: #5d4e37;
  resize: none;
  overflow: hidden;
  line-height: 1.6;
  transition: all 0.3s ease;
}

.line-input:focus {
  outline: none;
  border-color: #d4a574;
  box-shadow: 0 0 0 3px rgba(212, 165, 116, 0.1);
}

.line-input::placeholder {
  color: #b8a88a;
  font-style: italic;
}

.char-count {
  position: absolute;
  right: 10px;
  bottom: 8px;
  font-size: 11px;
  color: #8b7355;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  border-radius: 6px;
}

.char-count.warning {
  color: #e57373;
  background: rgba(229, 115, 115, 0.1);
}

.delete-line-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(180, 80, 80, 0.1);
  border: none;
  border-radius: 50%;
  color: #b45050;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 6px;
}

.delete-line-btn:hover {
  background: #b45050;
  color: white;
}

/* AI推荐面板 */
.recommendations-panel {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(212, 165, 116, 0.25);
  border-radius: 14px;
  padding: 16px;
  margin-top: 8px;
  box-shadow: 0 8px 24px rgba(139, 115, 85, 0.12);
}

.recommendations-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #8b7355;
  font-weight: 500;
}

.rec-icon {
  color: #d4a574;
}

.close-rec-btn {
  margin-left: auto;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 115, 85, 0.1);
  border: none;
  border-radius: 50%;
  color: #8b7355;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.close-rec-btn:hover {
  background: #8b7355;
  color: white;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recommendation-item {
  padding: 12px 14px;
  background: rgba(212, 165, 116, 0.06);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.recommendation-item:hover {
  background: rgba(212, 165, 116, 0.12);
  border-color: #d4a574;
  transform: translateX(4px);
}

.rec-line {
  font-size: 17px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 6px;
}

.rec-reason {
  font-size: 12px;
  color: #8b7355;
  display: flex;
  align-items: center;
  gap: 6px;
}

.reason-icon {
  font-size: 14px;
}

/* 编辑器底部 */
.editor-footer {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed rgba(139, 115, 85, 0.15);
}

.add-line-btn,
.ai-generate-btn {
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

.add-line-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 2px dashed rgba(139, 115, 85, 0.25);
  color: #8b7355;
}

.add-line-btn:hover {
  border-color: #8b7355;
  background: rgba(139, 115, 85, 0.05);
}

/* AI辅助面板 */
.ai-assistant-panel {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(139, 115, 85, 0.12);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.assistant-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(139, 115, 85, 0.1);
}

.assistant-icon {
  font-size: 24px;
}

.assistant-header h3 {
  font-size: 16px;
  color: #5d4e37;
  margin: 0;
  font-family: 'Noto Serif SC', serif;
}

.assistant-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-label {
  font-size: 12px;
  color: #8b7355;
}

.status-badge {
  display: inline-block;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.status-badge.empty {
  background: rgba(139, 115, 85, 0.1);
  color: #8b7355;
}

.status-badge.writing {
  background: rgba(212, 165, 116, 0.15);
  color: #8b7355;
}

.status-badge.completed {
  background: rgba(139, 115, 85, 0.15);
  color: #5d4e37;
}

/* 实时提示 */
.realtime-tips {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tips-label {
  font-size: 12px;
  color: #8b7355;
}

.tips-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tip-item {
  font-size: 13px;
  color: #666;
  padding: 10px 12px;
  background: rgba(212, 165, 116, 0.06);
  border-radius: 8px;
  border-left: 3px solid #d4a574;
}

/* 韵律检查 */
.rhyme-check {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.check-label {
  font-size: 12px;
  color: #8b7355;
}

.check-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;
}

.check-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(229, 115, 115, 0.15);
  color: #e57373;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
}

.check-icon.pass {
  background: rgba(129, 199, 132, 0.15);
  color: #81c784;
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
}

.actions-label {
  font-size: 12px;
  color: #8b7355;
  margin-bottom: 4px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(139, 115, 85, 0.15);
  border-radius: 10px;
  font-size: 14px;
  color: #5d4e37;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.action-btn:hover:not(:disabled) {
  background: rgba(212, 165, 116, 0.1);
  border-color: #d4a574;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-icon {
  font-size: 16px;
}

/* 底部操作栏 */
.bottom-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid rgba(139, 115, 85, 0.1);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(139, 115, 85, 0.2);
  border-radius: 10px;
  font-size: 14px;
  color: #8b7355;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.back-btn:hover {
  background: rgba(139, 115, 85, 0.1);
  border-color: #8b7355;
}

.action-group {
  display: flex;
  gap: 12px;
}

.score-btn,
.save-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.score-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid #d4a574;
  color: #d4a574;
}

.score-btn:hover:not(:disabled) {
  background: rgba(212, 165, 116, 0.1);
}

.score-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.save-btn {
  background: linear-gradient(135deg, #d4a574, #8b7355);
  border: none;
  color: white;
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 115, 85, 0.25);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.4s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 响应式 */
@media (max-width: 900px) {
  .editor-main {
    grid-template-columns: 1fr;
  }

  .ai-assistant-panel {
    order: -1;
  }
}

@media (max-width: 768px) {
  .poem-editor {
    padding: 16px;
  }

  .bottom-actions {
    flex-direction: column;
    gap: 12px;
  }

  .action-group {
    width: 100%;
  }

  .score-btn,
  .save-btn {
    flex: 1;
  }
}
</style>
