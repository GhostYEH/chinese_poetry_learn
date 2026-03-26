<template>
  <div class="workbench-container">
    <!-- 背景装饰 -->
    <div class="ink-background">
      <div class="ink-blob" v-for="i in 5" :key="i" :class="`blob-${i}`"></div>
    </div>

    <!-- 页面标题 -->
    <div class="title-section">
      <div class="brush-stroke left"></div>
      <h1 class="main-title">
        <span class="title-char" v-for="(char, i) in 'AI诗词创作工作台'" :key="i" :style="{ animationDelay: `${i * 0.1}s` }">{{ char }}</span>
      </h1>
      <div class="brush-stroke right"></div>
    </div>

    <!-- 创作模式选择 -->
    <div class="mode-selector">
      <div class="mode-card" 
           v-for="mode in modes" 
           :key="mode.id"
           :class="{ active: currentMode === mode.id }"
           @click="switchMode(mode.id)">
        <div class="mode-icon" v-html="mode.icon"></div>
        <div class="mode-info">
          <h3>{{ mode.title }}</h3>
          <p>{{ mode.desc }}</p>
        </div>
        <div class="mode-badge" v-if="mode.badge">{{ mode.badge }}</div>
      </div>
    </div>

    <!-- 主工作区域 -->
    <div class="workspace">
      <!-- 引导模式：三步创作流程 -->
      <div v-if="currentMode === 'guided'" class="guided-workspace">
        <!-- 步骤指示器 -->
        <div class="step-indicator">
          <div class="step" 
               v-for="(step, index) in steps" 
               :key="index"
               :class="{ active: currentStep === index + 1, completed: currentStep > index + 1 }">
            <div class="step-number">{{ index + 1 }}</div>
            <div class="step-label">{{ step.label }}</div>
            <div class="step-connector" v-if="index < steps.length - 1"></div>
          </div>
        </div>

        <!-- 步骤1：灵感生成 -->
        <transition name="slide-fade">
          <div v-if="currentStep === 1" class="step-panel" key="step1">
            <div class="panel-header">
              <h2>第一步：灵感生成</h2>
              <p>输入创作主题，让AI为你发散创意</p>
            </div>
            
            <div class="inspiration-form">
              <div class="input-group">
                <label>创作主题</label>
                <input type="text" 
                       v-model="inspirationForm.theme" 
                       placeholder="如：思乡、春日、离别..."
                       class="ink-input"
                       @input="onThemeInput">
              </div>
              
              <div class="input-group">
                <label>选择体裁</label>
                <div class="genre-selector">
                  <button v-for="g in genres" 
                          :key="g"
                          :class="['genre-btn', { active: inspirationForm.genre === g }]"
                          @click="inspirationForm.genre = g">
                    {{ g }}
                  </button>
                </div>
              </div>

              <button class="generate-btn" @click="generateInspiration" :disabled="isLoading || !inspirationForm.theme">
                <span class="btn-icon">✦</span>
                <span class="btn-text">{{ isLoading ? 'AI构思中...' : '生成灵感' }}</span>
                <div class="btn-glow" v-if="isLoading"></div>
              </button>
            </div>

            <!-- 关键词展示 -->
            <transition name="fade-up">
              <div v-if="inspirationResult" class="inspiration-result">
                <div class="result-card">
                  <h3>创意关键词</h3>
                  <div class="keywords-cloud">
                    <span v-for="kw in inspirationResult.keywords" 
                          :key="kw" 
                          class="keyword-tag"
                          @click="selectKeyword(kw)">
                      {{ kw }}
                    </span>
                  </div>
                </div>

                <div class="result-card">
                  <h3>主题诗意化表达</h3>
                  <p class="thematic-expression">{{ inspirationResult.theme }}</p>
                </div>

                <div class="result-card">
                  <h3>情感基调</h3>
                  <p class="mood-tag">{{ inspirationResult.mood }}</p>
                </div>

                <div class="result-card" v-if="inspirationResult.openingIdeas && inspirationResult.openingIdeas.length">
                  <h3>开篇切入角度</h3>
                  <ul class="opening-list">
                    <li v-for="(o, i) in inspirationResult.openingIdeas" :key="'o'+i">{{ o }}</li>
                  </ul>
                </div>

                <div class="result-card avoid-card" v-if="inspirationResult.avoid && inspirationResult.avoid.length">
                  <h3>建议避开的俗套</h3>
                  <ul>
                    <li v-for="(a, i) in inspirationResult.avoid" :key="'a'+i">{{ a }}</li>
                  </ul>
                </div>

                <div class="result-card suggestions">
                  <h3>创作建议</h3>
                  <ul>
                    <li v-for="(s, i) in inspirationResult.suggestions" :key="i">{{ s }}</li>
                  </ul>
                </div>

                <button class="next-step-btn" @click="enterStep2">
                  <span>进入结构引导</span>
                  <span class="arrow">→</span>
                </button>
              </div>
            </transition>
          </div>
        </transition>

        <!-- 步骤2：结构引导 -->
        <transition name="slide-fade">
          <div v-if="currentStep === 2" class="step-panel" key="step2">
            <div class="panel-header">
              <h2>第二步：结构引导</h2>
              <p>根据体裁获取写作结构提示</p>
            </div>

            <div class="structure-guide" v-if="structureGuide">
              <div class="structure-card">
                <div class="structure-header">
                  <h3>{{ structureGuide.name }}</h3>
                  <span class="structure-meta">
                    {{ structureGuide.lines }}句 × {{ structureGuide.charactersPerLine }}字
                  </span>
                </div>

                <div class="structure-flow">
                  <div v-for="(s, i) in structureGuide.structure" 
                       :key="i" 
                       class="structure-item">
                    <div class="structure-icon" :class="`role-${s.role}`">{{ s.role }}</div>
                    <div class="structure-content">
                      <h4>{{ s.position }}</h4>
                      <p>{{ s.description }}</p>
                      <div class="structure-example">
                        <span class="example-label">范例：</span>
                        <span class="example-text">"{{ s.example }}"</span>
                      </div>
                    </div>
                    <div class="structure-arrow" v-if="i < structureGuide.structure.length - 1">↓</div>
                  </div>
                </div>

                <div class="tips-section">
                  <h4>✎ 写作技巧</h4>
                  <div class="tips-list">
                    <span v-for="(tip, i) in structureGuide.tips" :key="i" class="tip-item">{{ tip }}</span>
                  </div>
                </div>
              </div>

              <div class="action-buttons">
                <button class="back-btn" @click="currentStep = 1">← 返回灵感</button>
                <button class="next-step-btn" @click="currentStep = 3">
                  <span>开始创作</span>
                  <span class="arrow">→</span>
                </button>
              </div>
            </div>

            <div v-else class="load-structure">
              <button class="generate-btn" @click="loadStructureGuide" :disabled="isLoading">
                <span class="btn-icon">☯</span>
                <span>{{ isLoading ? '加载中...' : '获取结构引导' }}</span>
              </button>
            </div>
          </div>
        </transition>

        <!-- 步骤3：生成与编辑 -->
        <transition name="slide-fade">
          <div v-if="currentStep === 3" class="step-panel" key="step3">
            <div class="panel-header">
              <h2>第三步：生成与编辑</h2>
              <p>AI辅助创作，你可以修改任意内容</p>
            </div>

            <div class="editor-area">
              <!-- 标题输入 -->
              <div class="title-input-section">
                <input type="text" 
                       v-model="poemForm.title" 
                       placeholder="输入诗词标题"
                       class="title-input">
              </div>

              <!-- 诗词编辑器 -->
              <div class="poem-editor">
                <div class="editor-hint">
                  <span>每句一行，输入时AI会给出续写建议</span>
                  <label class="ai-toggle">
                    <input type="checkbox" v-model="aiAssistanceEnabled">
                    <span class="toggle-label">AI续写建议</span>
                  </label>
                </div>

                <div class="lines-container">
                  <div v-for="(line, index) in poemForm.lines" 
                       :key="index" 
                       class="line-row">
                    <span class="line-number">{{ index + 1 }}</span>
                    <textarea v-model="poemForm.lines[index]" 
                              :placeholder="`第${index + 1}句...`"
                              class="line-input"
                              rows="1"
                              @input="autoResize($event)"
                              @blur="getLineRecommendation(index)">
                    </textarea>
                    <button class="delete-line" @click="removeLine(index)" v-if="poemForm.lines.length > 1">×</button>
                  </div>

                  <!-- AI推荐区域 -->
                  <transition name="fade-up">
                    <div v-if="currentRecommendations.length > 0 && showRecommendations" class="recommendations-panel">
                      <div class="recommendations-header">
                        <span>✦ AI续写推荐</span>
                        <button class="close-recommendations" @click="showRecommendations = false">×</button>
                      </div>
                      <div class="recommendations-list">
                        <div v-for="(rec, i) in currentRecommendations" 
                             :key="i" 
                             class="recommendation-item"
                             @click="applyRecommendation(rec.line)">
                          <div class="rec-line">{{ rec.line }}</div>
                          <div class="rec-reason">{{ rec.reason }}</div>
                        </div>
                      </div>
                    </div>
                  </transition>
                </div>

                <div class="add-line-section">
                  <button class="add-line-btn" @click="addLine">
                    <span>+</span> 添加诗句
                  </button>
                  <button class="generate-full-btn" @click="generateFullPoem" :disabled="isLoading">
                    <span class="btn-icon">☀</span>
                    <span>{{ isLoading ? 'AI创作中...' : 'AI续写整首' }}</span>
                  </button>
                </div>
              </div>

              <!-- AI实时提示 -->
              <transition name="fade">
                <div v-if="realtimeTips.length > 0" class="realtime-tips">
                  <div class="tips-icon">💡</div>
                  <div class="tips-content">
                    <span v-for="(tip, i) in realtimeTips" :key="i">{{ tip }}</span>
                  </div>
                </div>
              </transition>

              <!-- 操作按钮 -->
              <div class="editor-actions">
                <button class="back-btn" @click="currentStep = 2">← 返回结构</button>
                <button class="score-btn" @click="scorePoem" :disabled="isLoading || !hasContent">
                  <span>✧</span>
                  <span>评分作品</span>
                </button>
                <button class="save-btn" @click="saveWork" :disabled="!hasContent">
                  <span>✓</span>
                  <span>保存作品</span>
                </button>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- 飞花令创作模式 -->
      <div v-if="currentMode === 'feihua'" class="feihua-workspace">
        <div class="panel-header">
          <h2>飞花令创作模式</h2>
          <p>选择一个关键字，创作包含该字的诗词</p>
        </div>

        <div class="feihua-setup">
          <div class="keyword-section">
            <div class="keyword-display">
              <span class="keyword-char" :key="currentKeyword">{{ currentKeyword || '?' }}</span>
            </div>
            
            <div class="difficulty-selector">
              <button v-for="d in difficulties" 
                      :key="d.value"
                      :class="['diff-btn', { active: selectedDifficulty === d.value }]"
                      @click="selectedDifficulty = d.value">
                {{ d.label }}
              </button>
            </div>

            <button class="random-keyword-btn" @click="getRandomKeyword">
              <span>🎲</span> 随机关键字
            </button>
          </div>

          <div class="feihua-editor">
            <input type="text" 
                   v-model="feihuaForm.title" 
                   placeholder="诗词标题"
                   class="title-input">
            
            <textarea v-model="feihuaForm.content" 
                      placeholder="在此创作你的飞花令诗词..."
                      class="feihua-textarea"
                      rows="8">
            </textarea>

            <div class="keyword-counter">
              <span class="counter-label">关键字出现次数：</span>
              <span class="counter-value" :class="{ highlight: keywordCount > 0 }">{{ keywordCount }}</span>
            </div>

            <div class="related-words" v-if="relatedWords.length > 0">
              <span class="related-label">相关意象：</span>
              <span v-for="w in relatedWords" :key="w" class="related-tag">{{ w }}</span>
            </div>
          </div>

          <div class="feihua-actions">
            <button class="generate-btn" @click="scoreFeihuaPoem" :disabled="isLoading || !feihuaForm.content">
              <span>{{ isLoading ? '评分中...' : '提交评分' }}</span>
            </button>
          </div>

          <!-- 评分结果 -->
          <transition name="fade-up">
            <div v-if="feihuaScore" class="score-panel">
              <PoemScorer :score="feihuaScore" @close="feihuaScore = null"/>
            </div>
          </transition>
        </div>
      </div>

      <!-- 接龙创作模式 -->
      <div v-if="currentMode === 'chain'" class="chain-workspace">
        <div class="panel-header">
          <h2>接龙创作模式</h2>
          <p>与AI轮流创作，句句相扣</p>
        </div>

        <div class="chain-setup" v-if="!chainStarted">
          <div class="input-group">
            <label>选择体裁</label>
            <div class="genre-selector">
              <button v-for="g in genres.slice(0, 4)" 
                      :key="g"
                      :class="['genre-btn', { active: chainForm.genre === g }]"
                      @click="chainForm.genre = g">
                {{ g }}
              </button>
            </div>
          </div>

          <div class="input-group">
            <label>创作主题</label>
            <input type="text" 
                   v-model="chainForm.theme" 
                   placeholder="如：思乡、离别、山水..."
                   class="ink-input">
          </div>

          <div class="chain-mode-selector">
            <label class="mode-option">
              <input type="radio" v-model="chainForm.startMode" value="ai">
              <span>AI先写</span>
            </label>
            <label class="mode-option">
              <input type="radio" v-model="chainForm.startMode" value="user">
              <span>你先写</span>
            </label>
          </div>

          <button class="start-chain-btn" @click="startChain" :disabled="isLoading || !chainForm.theme">
            <span>{{ isLoading ? '启动中...' : '开始接龙' }}</span>
          </button>
        </div>

        <!-- 接龙进行中 -->
        <div class="chain-active" v-else>
          <div class="chain-info">
            <span class="turn-indicator">
              {{ isUserTurn ? '✍ 你的回合' : '🤖 AI回合' }}
            </span>
            <span class="line-counter">第 {{ currentLineNumber }} 句</span>
          </div>

          <div class="chain-lines">
            <div v-for="(line, i) in chainLines" 
                 :key="i"
                 :class="['chain-line', line.from]">
              <span class="line-author">{{ line.from === 'user' ? '你' : 'AI' }}</span>
              <span class="line-text">{{ line.text }}</span>
            </div>
          </div>

          <!-- 用户输入区域 -->
          <div v-if="isUserTurn" class="chain-input-area">
            <textarea v-model="userChainInput" 
                      :placeholder="`输入第 ${currentLineNumber} 句...`"
                      class="chain-input"
                      rows="2"
                      @keydown.enter.ctrl="submitUserLine">
            </textarea>
            <div class="input-hints">
              <span>{{ lineLength }}字/句</span>
              <span v-if="rhymeHint">押韵提示：{{ rhymeHint }}</span>
            </div>
            <button class="submit-chain-btn" @click="submitUserLine" :disabled="!userChainInput.trim()">
              提交 → 
            </button>
          </div>

          <!-- AI思考动画 -->
          <div v-else class="ai-thinking">
            <div class="thinking-dots">
              <span></span><span></span><span></span>
            </div>
            <span>AI正在构思...</span>
          </div>

          <div class="chain-controls">
            <button class="end-chain-btn" @click="endChain">结束创作</button>
          </div>
        </div>
      </div>

      <!-- 评分结果展示 -->
      <transition name="fade-up">
        <div v-if="showScorePanel" class="score-overlay" @click.self="showScorePanel = false">
          <div class="score-modal">
            <button class="close-modal" @click="showScorePanel = false">×</button>
            <PoemScorer :score="currentScore" @close="showScorePanel = false" @save="saveWork"/>
          </div>
        </div>
      </transition>
    </div>

    <!-- 打字机效果容器 -->
    <div class="typewriter-overlay" v-if="showTypewriter">
      <div class="typewriter-text">{{ typewriterText }}</div>
    </div>
  </div>
</template>

<script>
import { api } from '../../services/api.js';

export default {
  name: 'CreationWorkbench',
  components: {
    PoemScorer: {
      props: ['score'],
      emits: ['close', 'save'],
      template: `
        <div class="poem-scorer">
          <div class="score-header">
            <h3>✧ 作品评分 ✧</h3>
          </div>

          <div class="total-score-display">
            <div class="score-circle">
              <svg viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" :stop-color="getGradeColor(score?.total)" stop-opacity="0.6"/>
                    <stop offset="100%" :stop-color="getGradeColor(score?.total)"/>
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="45" class="score-bg"/>
                <circle cx="50" cy="50" r="45"
                        class="score-progress"
                        :stroke="getGradeColor(score?.total)"
                        :style="{ strokeDasharray: Math.round(283 * (score?.total || 0) / 100) + ' 283' }"/>
              </svg>
              <div class="score-value" :style="{ color: getGradeColor(score?.total) }">{{ score?.total || 0 }}</div>
            </div>
            <div class="grade-badge" :class="getGradeClass(score?.total)">{{ getGradeLabel(score?.total) }}</div>
            <span class="score-label">综合评分</span>
          </div>

          <div class="dimensions-grid">
            <div v-for="(value, key) in displayDimensions" :key="key" class="dimension-item">
              <div class="dim-header">
                <span class="dim-name">{{ getDimensionName(key) }}</span>
                <span class="dim-value" :style="{ color: getDimColor(value) }">{{ value ?? '--' }}</span>
              </div>
              <div class="dim-bar">
                <div class="dim-fill"
                     :style="{ width: (value ?? 0) + '%', background: getDimColor(value) }">
                </div>
              </div>
              <div class="dim-desc">{{ getDimDesc(key, value) }}</div>
            </div>
          </div>

          <div class="suggestions-box" v-if="score?.suggestions">
            <h4>✎ 评价与建议</h4>
            <div class="suggestions-parsed">
              <template v-if="parsedSuggestions">
                <div v-if="parsedSuggestions.亮点" class="suggestion-section highlight">
                  <div class="suggestion-label">✨ 亮点</div>
                  <div class="suggestion-content">{{ parsedSuggestions.亮点 }}</div>
                </div>
                <div v-if="parsedSuggestions.不足" class="suggestion-section problem">
                  <div class="suggestion-label">🔍 不足</div>
                  <div class="suggestion-content">{{ parsedSuggestions.不足 }}</div>
                </div>
                <div v-if="parsedSuggestions.建议" class="suggestion-section advice">
                  <div class="suggestion-label">💡 建议</div>
                  <div class="suggestion-content">{{ parsedSuggestions.建议 }}</div>
                </div>
              </template>
              <p v-else class="suggestions-raw">{{ score.suggestions }}</p>
            </div>
          </div>

          <div class="score-actions">
            <button class="close-btn" @click="$emit('close')">关闭</button>
            <button class="save-btn" @click="$emit('save')">保存作品</button>
          </div>
        </div>
      `,
      computed: {
        displayDimensions() {
          if (!this.score?.dimensions) return {};
          return this.score.dimensions;
        },
        parsedSuggestions() {
          const raw = this.score?.suggestions;
          if (!raw) return null;
          const result = {};
          const sections = raw.split('\n').filter(s => s.trim());
          for (const section of sections) {
            if (section.startsWith('【亮点】') || section.startsWith('【亮点】')) {
              result['亮点'] = section.replace(/^【亮点】/, '').replace(/^【亮点】/, '').trim();
            } else if (section.startsWith('【不足】') || section.startsWith('【不足】')) {
              result['不足'] = section.replace(/^【不足】/, '').replace(/^【不足】/, '').trim();
            } else if (section.startsWith('【建议】') || section.startsWith('【建议】') || section.startsWith('【建议方向】') || section.startsWith('【建议方向】')) {
              result['建议'] = section.replace(/^【建议】/, '').replace(/^【建议方向】/, '').trim();
            }
          }
          return Object.keys(result).length ? result : null;
        }
      },
      methods: {
        getGradeLabel(score) {
          if (score == null) return '待评分';
          if (score >= 90) return '杰作';
          if (score >= 80) return '优秀';
          if (score >= 70) return '良好';
          if (score >= 60) return '及格';
          if (score >= 45) return '待提升';
          return '需努力';
        },
        getGradeClass(score) {
          if (score == null) return 'grade-none';
          if (score >= 90) return 'grade-masterpiece';
          if (score >= 80) return 'grade-excellent';
          if (score >= 70) return 'grade-good';
          if (score >= 60) return 'grade-pass';
          if (score >= 45) return 'grade-improve';
          return 'grade-fail';
        },
        getGradeColor(score) {
          if (score == null) return '#ccc';
          if (score >= 90) return '#c0392b';
          if (score >= 80) return '#e67e22';
          if (score >= 70) return '#f1c40f';
          if (score >= 60) return '#27ae60';
          if (score >= 45) return '#3498db';
          return '#95a5a6';
        },
        getDimColor(value) {
          if (value == null) return '#ccc';
          if (value >= 85) return '#27ae60';
          if (value >= 70) return '#f39c12';
          if (value >= 55) return '#e67e22';
          return '#e74c3c';
        },
        getDimDesc(key, value) {
          if (value == null) return '';
          const descs = {
            content: ['严重跑题', '内容偏离', '尚可', '基本契合', '高度契合'],
            rhythm: ['毫无韵律', '韵律混乱', '基本合格', '韵律工整', '行云流水'],
            mood: ['无意境', '意境浅薄', '意境尚可', '意境较好', '意境深远'],
            language: ['词不达意', '用语粗糙', '基本通顺', '语言流畅', '字字珠玑'],
            creativity: ['毫无新意', '陈词滥调', '较为常规', '有新意', '独到新颖'],
            keyword: ['未出现', '生硬', '尚可', '较合理', '巧妙融合']
          };
          const arr = descs[key] || descs.content;
          const idx = value >= 90 ? 4 : value >= 75 ? 3 : value >= 60 ? 2 : value >= 40 ? 1 : 0;
          return arr[idx];
        },
        getDimensionName(key) {
          const names = {
            content: '内容契合度',
            rhythm: '韵律美感',
            mood: '意境表达',
            language: '语言流畅度',
            creativity: '创意性',
            keyword: '关键字运用'
          };
          return names[key] || key;
        }
      }
    }
  },
  data() {
    return {
      // 当前模式
      currentMode: 'guided',
      modes: [
        {
          id: 'guided',
          title: '引导创作',
          desc: '三步走，轻松学会诗词创作',
          icon: '📜',
          badge: '推荐'
        },
        {
          id: 'feihua',
          title: '飞花令创作',
          desc: '指定关键字，创意无限',
          icon: '🌸'
        },
        {
          id: 'chain',
          title: '接龙创作',
          desc: '与AI轮流，句句相扣',
          icon: '🔗'
        }
      ],

      // 引导模式步骤
      currentStep: 1,
      steps: [
        { label: '灵感生成' },
        { label: '结构引导' },
        { label: '生成编辑' }
      ],

      // 体裁选项
      genres: ['五言绝句', '七言绝句', '五言律诗', '七言律诗', '宋词'],

      // 灵感表单
      inspirationForm: {
        theme: '',
        genre: '五言绝句'
      },
      inspirationResult: null,

      // 结构引导
      structureGuide: null,

      // 诗词表单
      poemForm: {
        title: '',
        lines: ['', '', '', '']
      },

      // AI推荐
      aiAssistanceEnabled: true,
      currentRecommendations: [],
      showRecommendations: false,
      realtimeTips: [],

      // 飞花令模式
      currentKeyword: '',
      selectedDifficulty: '中等',
      difficulties: [
        { value: '简单', label: '简单' },
        { value: '中等', label: '中等' },
        { value: '困难', label: '困难' }
      ],
      relatedWords: [],
      feihuaForm: {
        title: '',
        genre: '五言绝句',
        content: ''
      },
      feihuaScore: null,

      // 接龙模式
      chainStarted: false,
      chainForm: {
        genre: '五言绝句',
        theme: '',
        startMode: 'ai'
      },
      chainLines: [],
      isUserTurn: true,
      userChainInput: '',
      currentLineNumber: 1,
      rhymeHint: '',
      moodHint: '',

      // 评分
      currentScore: null,
      showScorePanel: false,

      // 状态
      isLoading: false,
      showTypewriter: false,
      typewriterText: ''
    };
  },
  computed: {
    hasContent() {
      return this.poemForm.lines.some(l => l.trim()) || this.poemForm.title.trim();
    },
    keywordCount() {
      if (!this.currentKeyword || !this.feihuaForm.content) return 0;
      return (this.feihuaForm.content.match(new RegExp(this.currentKeyword, 'g')) || []).length;
    },
    lineLength() {
      // 根据当前选择的体裁判断字数
      const genre = this.inspirationForm.genre || this.chainForm.genre || '五言绝句';
      return genre.includes('七') ? 7 : 5;
    },
    poemContent() {
      return this.poemForm.lines.filter(l => l.trim()).join('\n');
    }
  },
  methods: {
    /** 统一解析 api.request 返回的 { success, data, message } */
    unwrapCreationResponse(res) {
      if (res && res.success === false) {
        throw new Error(res.message || '请求失败');
      }
      if (res && res.success === true && res.data !== undefined) {
        return res.data;
      }
      return res;
    },

    enterStep2() {
      this.currentStep = 2;
      this.$nextTick(() => this.loadStructureGuide());
    },

    // 切换创作模式
    switchMode(mode) {
      this.currentMode = mode;
      this.resetState();
    },

    // 重置状态
    resetState() {
      this.currentStep = 1;
      this.inspirationResult = null;
      this.structureGuide = null;
      this.currentRecommendations = [];
      this.showRecommendations = false;
      this.realtimeTips = [];
      this.chainStarted = false;
      this.chainLines = [];
      this.feihuaScore = null;
      this.showScorePanel = false;
    },

    // 主题输入事件
    onThemeInput() {
      // 可以添加防抖处理
    },

    // 选择关键词
    selectKeyword(keyword) {
      // 高亮效果
      event.target.classList.add('selected');
      setTimeout(() => event.target.classList.remove('selected'), 500);
    },

    // 步骤1：生成灵感
    async generateInspiration() {
      if (!this.inspirationForm.theme) return;
      
      this.isLoading = true;
      this.typewriterText = '正在构思创意关键词...';
      this.showTypewriter = true;

      try {
        const raw = await api.creationWorkbench.generateInspiration(
          this.inspirationForm.theme,
          this.inspirationForm.genre
        );
        this.inspirationResult = this.unwrapCreationResponse(raw);
        this.typewriterText = '灵感生成完成 ✦';
        setTimeout(() => {
          this.showTypewriter = false;
        }, 900);
      } catch (error) {
        console.error('生成灵感失败:', error);
        this.showTypewriter = false;
        alert(error.message || '生成灵感失败，请重试');
      } finally {
        this.isLoading = false;
      }
    },

    // 步骤2：加载结构引导
    async loadStructureGuide() {
      this.isLoading = true;
      try {
        const raw = await api.creationWorkbench.getStructureGuide(
          this.inspirationForm.genre,
          this.inspirationForm.theme
        );
        this.structureGuide = this.unwrapCreationResponse(raw);
      } catch (error) {
        console.error('加载结构引导失败:', error);
        alert(error.message || '加载结构引导失败');
      } finally {
        this.isLoading = false;
      }
    },

    // 自动调整textarea高度
    autoResize(event) {
      const textarea = event.target;
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    },

    // 获取行推荐
    async getLineRecommendation(index) {
      if (!this.aiAssistanceEnabled) return;
      
      const currentLines = this.poemForm.lines.slice(0, index + 1).join('\n');
      if (!currentLines.trim()) return;

      try {
        const raw = await api.creationWorkbench.recommendNextLine({
          currentLines,
          genre: this.inspirationForm.genre,
          theme: this.inspirationForm.theme,
          maxLength: this.inspirationForm.genre.includes('七') ? 7 : 5
        });
        const data = this.unwrapCreationResponse(raw);
        this.currentRecommendations = data.suggestions || [];
        if (this.currentRecommendations.length > 0) {
          this.showRecommendations = true;
        }
      } catch (error) {
        console.error('获取推荐失败:', error);
      }
    },

    // 应用推荐
    applyRecommendation(line) {
      const emptyIndex = this.poemForm.lines.findIndex(l => !l.trim());
      if (emptyIndex !== -1) {
        this.poemForm.lines[emptyIndex] = line;
      } else {
        this.poemForm.lines.push(line);
      }
      this.showRecommendations = false;
      this.currentRecommendations = [];
    },

    // 添加行
    addLine() {
      this.poemForm.lines.push('');
    },

    // 删除行
    removeLine(index) {
      this.poemForm.lines.splice(index, 1);
    },

    // AI生成完整诗词
    async generateFullPoem() {
      this.isLoading = true;
      this.typewriterText = 'AI正在创作中...';
      this.showTypewriter = true;

      try {
        const raw = await api.creationWorkbench.generatePoem({
          theme: this.inspirationForm.theme,
          genre: this.inspirationForm.genre,
          keywords: this.inspirationResult?.keywords || [],
          structure: this.structureGuide ? JSON.stringify(this.structureGuide) : ''
        });
        const result = this.unwrapCreationResponse(raw);

        if (result && result.poem) {
          const newLines = result.poem.split('\n').filter(l => l.trim());
          
          if (!this.poemForm.title && result.title) {
            this.poemForm.title = result.title;
          }

          // 替换空行或追加
          for (let i = 0; i < newLines.length; i++) {
            if (this.poemForm.lines[i]) {
              this.poemForm.lines[i] = newLines[i];
            } else {
              this.poemForm.lines.push(newLines[i]);
            }
          }

          this.typewriterText = '创作完成 ✦';
          setTimeout(() => { this.showTypewriter = false; }, 1000);
        }
      } catch (error) {
        console.error('生成诗词失败:', error);
        alert('生成失败，请重试');
      } finally {
        this.isLoading = false;
      }
    },

    // 评分诗词
    async scorePoem() {
      if (!this.hasContent) return;

      this.isLoading = true;
      try {
        const raw = await api.creationWorkbench.scorePoem({
          poem: this.poemContent,
          title: this.poemForm.title,
          genre: this.inspirationForm.genre,
          theme: this.inspirationForm.theme
        });
        this.currentScore = this.unwrapCreationResponse(raw);
        this.showScorePanel = true;
      } catch (error) {
        console.error('评分失败:', error);
        alert(error.message || '评分失败，请重试');
      } finally {
        this.isLoading = false;
      }
    },

    // 保存作品
    async saveWork() {
      try {
        const workData = {
          title: this.poemForm.title || this.feihuaForm.title || '无题',
          content: this.poemContent || this.feihuaForm.content,
          genre: this.inspirationForm.genre || this.feihuaForm.genre || '五言绝句',
          theme: this.inspirationForm.theme || `飞花令 - ${this.currentKeyword}` || '一般主题',
          creation_mode: this.currentMode,
          score_data: JSON.stringify(this.currentScore || {}),
          modification_suggestions: this.currentScore?.suggestions || ''
        };

        await api.creationWorkbench.saveWork(workData);
        this.showScorePanel = false;
        this.resetState();
        alert('作品保存成功！');
      } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败，请重试');
      }
    },

    // ========== 飞花令相关 ==========

    // 获取随机关键字
    async getRandomKeyword() {
      this.isLoading = true;
      try {
        const raw = await api.creationWorkbench.getFeihuaKeyword(this.selectedDifficulty);
        const result = this.unwrapCreationResponse(raw);
        this.currentKeyword = result.keyword;
        this.relatedWords = result.relatedWords || [];
      } catch (error) {
        console.error('获取关键字失败:', error);
      } finally {
        this.isLoading = false;
      }
    },

    // 飞花令评分
    async scoreFeihuaPoem() {
      if (!this.feihuaForm.content) return;

      this.isLoading = true;
      try {
        const raw = await api.creationWorkbench.scoreFeihuaPoem({
          poem: this.feihuaForm.content,
          keyword: this.currentKeyword,
          genre: this.feihuaForm.genre || '五言绝句'
        });
        this.feihuaScore = this.unwrapCreationResponse(raw);
      } catch (error) {
        console.error('飞花令评分失败:', error);
        alert('评分失败，请重试');
      } finally {
        this.isLoading = false;
      }
    },

    // ========== 接龙相关 ==========

    // 开始接龙
    async startChain() {
      this.isLoading = true;
      this.chainStarted = true;
      this.chainLines = [];
      this.currentLineNumber = 1;

      if (this.chainForm.startMode === 'ai') {
        this.isUserTurn = false;
        await this.getAIChainLine();
      } else {
        this.isUserTurn = true;
      }
    },

    // 获取AI接龙
    async getAIChainLine() {
      try {
        if (this.currentLineNumber === 1) {
          const raw = await api.creationWorkbench.startChainPoem(
            this.chainForm.genre,
            this.chainForm.theme
          );
          const result = this.unwrapCreationResponse(raw);
          this.chainLines.push({
            text: result.aiLine,
            from: 'ai'
          });
          this.rhymeHint = result.rhyme;
          this.moodHint = result.mood;
        } else {
          const lastUserLine = this.chainLines[this.chainLines.length - 1]?.text || '';
          const raw = await api.creationWorkbench.getChainNextLine({
            userLine: lastUserLine,
            genre: this.chainForm.genre,
            theme: this.chainForm.theme,
            lineNumber: this.currentLineNumber
          });
          const result = this.unwrapCreationResponse(raw);
          this.chainLines.push({
            text: result.aiLine,
            from: 'ai'
          });
          this.rhymeHint = result.rhymeHint;
          this.moodHint = result.moodHint;
        }
        
        this.currentLineNumber++;
        this.isUserTurn = true;
      } catch (error) {
        console.error('AI接龙失败:', error);
        this.isUserTurn = true;
      }
    },

    // 提交用户接龙
    async submitUserLine() {
      if (!this.userChainInput.trim()) return;

      this.chainLines.push({
        text: this.userChainInput.trim(),
        from: 'user'
      });

      this.userChainInput = '';
      
      // 检查是否完成
      const totalLines = this.chainForm.genre === '五言绝句' || this.chainForm.genre === '七言绝句' ? 4 : 8;
      if (this.chainLines.length >= totalLines) {
        // 完成创作
        this.isUserTurn = false;
        await this.endChain();
        return;
      }

      this.isUserTurn = false;
      this.currentLineNumber++;
      await this.getAIChainLine();
    },

    // 结束接龙
    async endChain() {
      this.chainStarted = false;
      if (this.chainLines.length > 0) {
        this.poemForm.lines = this.chainLines.map(l => l.text);
        this.poemForm.title = '接龙作品';
        this.inspirationForm.genre = this.chainForm.genre;
        this.inspirationForm.theme = this.chainForm.theme;
        
        // 切换到引导模式并进入编辑步骤
        this.currentMode = 'guided';
        this.currentStep = 3;
        
        // 自动评分
        await this.scorePoem();
      }
    }
  }
};
</script>

<style scoped>
/* ==================== 基础布局 ==================== */
.workbench-container {
  min-height: 100vh;
  padding: 40px 20px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #fdf6e3 0%, #fef9f3 50%, #f5efe6 100%);
}

/* ==================== 水墨背景 ==================== */
.ink-background {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.ink-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.15;
  animation: float 20s ease-in-out infinite;
}

.blob-1 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #8b7355 0%, transparent 70%);
  top: -100px;
  right: -100px;
  animation-delay: 0s;
}

.blob-2 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #a0522d 0%, transparent 70%);
  bottom: 10%;
  left: -50px;
  animation-delay: -5s;
}

.blob-3 {
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, #d2b48c 0%, transparent 70%);
  top: 40%;
  right: 10%;
  animation-delay: -10s;
}

.blob-4 {
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, #bc8f8f 0%, transparent 70%);
  bottom: 30%;
  right: 30%;
  animation-delay: -15s;
}

.blob-5 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, #deb887 0%, transparent 70%);
  top: 20%;
  left: 20%;
  animation-delay: -7s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(20px, -30px) scale(1.05); }
  50% { transform: translate(-10px, 20px) scale(0.95); }
  75% { transform: translate(30px, 10px) scale(1.02); }
}

/* ==================== 标题区域 ==================== */
.title-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 40px;
  position: relative;
  z-index: 1;
}

.brush-stroke {
  width: 100px;
  height: 8px;
  background: linear-gradient(90deg, transparent, #8b7355, transparent);
  border-radius: 4px;
  animation: brushFade 2s ease-out;
}

.brush-stroke.left {
  animation: brushFadeLeft 2s ease-out;
}

.brush-stroke.right {
  animation: brushFadeRight 2s ease-out;
}

@keyframes brushFadeLeft {
  from { transform: translateX(-50px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes brushFadeRight {
  from { transform: translateX(50px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.main-title {
  font-size: 42px;
  font-family: 'Noto Serif SC', 'SimSun', serif;
  color: #5d4e37;
  text-shadow: 2px 2px 4px rgba(93, 78, 55, 0.1);
  letter-spacing: 8px;
  position: relative;
}

.title-char {
  display: inline-block;
  animation: charFadeIn 0.5s ease-out forwards;
  opacity: 0;
}

@keyframes charFadeIn {
  from { 
    opacity: 0; 
    transform: translateY(-20px) rotate(-10deg); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0) rotate(0); 
  }
}

/* ==================== 模式选择器 ==================== */
.mode-selector {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 40px;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
}

.mode-card {
  width: 200px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(139, 115, 85, 0.2);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
  overflow: hidden;
}

.mode-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #8b7355, #d4a574);
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.mode-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(139, 115, 85, 0.15);
}

.mode-card:hover::before {
  transform: scaleX(1);
}

.mode-card.active {
  background: rgba(255, 255, 255, 0.9);
  border-color: #8b7355;
  box-shadow: 0 15px 35px rgba(139, 115, 85, 0.2);
}

.mode-card.active::before {
  transform: scaleX(1);
}

.mode-icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.mode-info h3 {
  font-size: 18px;
  color: #5d4e37;
  margin-bottom: 6px;
  font-family: 'Noto Serif SC', serif;
}

.mode-info p {
  font-size: 13px;
  color: #8b7355;
  line-height: 1.4;
}

.mode-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  font-size: 11px;
  border-radius: 20px;
}

/* ==================== 工作区 ==================== */
.workspace {
  max-width: 1000px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

/* ==================== 步骤指示器 ==================== */
.step-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 40px;
  gap: 0;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.step-number {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid #d4c4b0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  color: #8b7355;
  transition: all 0.4s ease;
  z-index: 2;
}

.step.active .step-number {
  background: linear-gradient(135deg, #8b7355, #d4a574);
  color: white;
  border-color: #8b7355;
  transform: scale(1.1);
  box-shadow: 0 8px 20px rgba(139, 115, 85, 0.3);
}

.step.completed .step-number {
  background: #d4a574;
  color: white;
  border-color: #d4a574;
}

.step-label {
  margin-top: 10px;
  font-size: 14px;
  color: #8b7355;
  font-family: 'Noto Serif SC', serif;
  transition: all 0.3s ease;
}

.step.active .step-label {
  color: #5d4e37;
  font-weight: bold;
}

.step-connector {
  width: 80px;
  height: 3px;
  background: linear-gradient(90deg, #d4c4b0, #d4c4b0);
  margin: 0 15px;
  margin-bottom: 30px;
  position: relative;
  overflow: hidden;
}

.step-connector::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 0;
  background: #d4a574;
  transition: width 0.5s ease;
}

.step.completed + .step .step-connector::after,
.step.completed .step-connector::after {
  width: 100%;
}

/* ==================== 面板通用 ==================== */
.step-panel,
.feihua-workspace,
.chain-workspace {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(139, 115, 85, 0.15);
  border-radius: 24px;
  padding: 40px;
  box-shadow: 0 20px 50px rgba(139, 115, 85, 0.1);
}

.panel-header {
  text-align: center;
  margin-bottom: 30px;
}

.panel-header h2 {
  font-size: 28px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 8px;
}

.panel-header p {
  color: #8b7355;
  font-size: 15px;
}

/* ==================== 灵感表单 ==================== */
.inspiration-form {
  max-width: 600px;
  margin: 0 auto;
}

.input-group {
  margin-bottom: 24px;
}

.input-group label {
  display: block;
  margin-bottom: 10px;
  font-size: 15px;
  color: #5d4e37;
  font-weight: 500;
  font-family: 'Noto Serif SC', serif;
}

.ink-input {
  width: 100%;
  padding: 14px 18px;
  border: 2px solid rgba(139, 115, 85, 0.2);
  border-radius: 12px;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.9);
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.ink-input:focus {
  outline: none;
  border-color: #d4a574;
  box-shadow: 0 0 0 4px rgba(212, 165, 116, 0.15);
}

.ink-input::placeholder {
  color: #b8a88a;
}

/* 体裁选择器 */
.genre-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.genre-btn {
  padding: 10px 18px;
  border: 2px solid rgba(139, 115, 85, 0.2);
  border-radius: 25px;
  background: rgba(255, 255, 255, 0.7);
  color: #8b7355;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.genre-btn:hover {
  border-color: #d4a574;
  background: rgba(212, 165, 116, 0.1);
}

.genre-btn.active {
  background: linear-gradient(135deg, #8b7355, #d4a574);
  color: white;
  border-color: #8b7355;
}

/* 生成按钮 */
.generate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 16px 24px;
  background: linear-gradient(135deg, #8b7355, #a08060);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 17px;
  cursor: pointer;
  transition: all 0.4s ease;
  position: relative;
  overflow: hidden;
  font-family: 'Noto Serif SC', serif;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(139, 115, 85, 0.35);
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 20px;
}

.btn-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    45deg,
    transparent 30%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 70%
  );
  animation: glow 1.5s infinite;
}

@keyframes glow {
  from { transform: translateX(-100%) rotate(45deg); }
  to { transform: translateX(100%) rotate(45deg); }
}

/* ==================== 灵感结果 ==================== */
.inspiration-result {
  margin-top: 30px;
  display: grid;
  gap: 20px;
}

.result-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(139, 115, 85, 0.15);
  border-radius: 16px;
  padding: 24px;
  animation: fadeInUp 0.6s ease-out;
}

.result-card h3 {
  font-size: 16px;
  color: #8b7355;
  margin-bottom: 16px;
  font-family: 'Noto Serif SC', serif;
}

.keywords-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.keyword-tag {
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(139, 115, 85, 0.1));
  border: 1px solid rgba(139, 115, 85, 0.2);
  border-radius: 20px;
  font-size: 15px;
  color: #5d4e37;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.keyword-tag:hover {
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  transform: scale(1.05);
}

.keyword-tag.selected {
  background: #d4a574;
  color: white;
}

.thematic-expression,
.mood-tag {
  font-size: 18px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  font-style: italic;
}

.suggestions ul {
  list-style: none;
  padding: 0;
}

.suggestions li {
  padding: 8px 0;
  padding-left: 20px;
  position: relative;
  color: #666;
  font-size: 14px;
  line-height: 1.6;
}

.suggestions li::before {
  content: '✦';
  position: absolute;
  left: 0;
  color: #d4a574;
}

.opening-list,
.avoid-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.opening-list li,
.avoid-card li {
  padding: 8px 0 8px 20px;
  position: relative;
  color: #555;
  font-size: 14px;
  line-height: 1.65;
}

.opening-list li::before {
  content: '◇';
  position: absolute;
  left: 0;
  color: #8b7355;
}

.avoid-card li::before {
  content: '!';
  position: absolute;
  left: 0;
  color: #c77d8e;
  font-weight: bold;
}

.next-step-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 32px;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin: 20px auto 0;
  font-family: 'Noto Serif SC', serif;
}

.next-step-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(139, 115, 85, 0.3);
}

.next-step-btn .arrow {
  transition: transform 0.3s ease;
}

.next-step-btn:hover .arrow {
  transform: translateX(5px);
}

/* ==================== 结构引导 ==================== */
.structure-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(139, 115, 85, 0.15);
  border-radius: 20px;
  padding: 30px;
  animation: fadeInUp 0.6s ease-out;
}

.structure-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid rgba(139, 115, 85, 0.1);
}

.structure-header h3 {
  font-size: 22px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
}

.structure-meta {
  padding: 6px 14px;
  background: rgba(212, 165, 116, 0.15);
  border-radius: 20px;
  font-size: 13px;
  color: #8b7355;
}

.structure-flow {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.structure-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  position: relative;
}

.structure-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  color: white;
  flex-shrink: 0;
}

.structure-icon.role-起 { background: linear-gradient(135deg, #e6a857, #d4914a); }
.structure-icon.role-承 { background: linear-gradient(135deg, #6b9e78, #5a8a66); }
.structure-icon.role-转 { background: linear-gradient(135deg, #7a9ec7, #6589b5); }
.structure-icon.role-合 { background: linear-gradient(135deg, #c77d8e, #b36b7a); }

.structure-content {
  flex: 1;
}

.structure-content h4 {
  font-size: 16px;
  color: #5d4e37;
  margin-bottom: 4px;
  font-family: 'Noto Serif SC', serif;
}

.structure-content p {
  font-size: 13px;
  color: #8b7355;
  margin-bottom: 8px;
}

.structure-example {
  background: rgba(245, 239, 230, 0.8);
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 3px solid #d4a574;
}

.example-label {
  font-size: 12px;
  color: #b8a88a;
}

.example-text {
  font-size: 14px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  font-style: italic;
}

.structure-arrow {
  position: absolute;
  left: 22px;
  bottom: -24px;
  color: #d4c4b0;
  font-size: 18px;
}

.tips-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px dashed rgba(139, 115, 85, 0.2);
}

.tips-section h4 {
  font-size: 15px;
  color: #5d4e37;
  margin-bottom: 12px;
  font-family: 'Noto Serif SC', serif;
}

.tips-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tip-item {
  padding: 8px 14px;
  background: rgba(212, 165, 116, 0.1);
  border-radius: 8px;
  font-size: 13px;
  color: #666;
}

.action-buttons {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
}

.back-btn,
.end-chain-btn {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid rgba(139, 115, 85, 0.2);
  border-radius: 10px;
  color: #8b7355;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.back-btn:hover,
.end-chain-btn:hover {
  background: rgba(139, 115, 85, 0.1);
  border-color: #8b7355;
}

/* ==================== 诗词编辑器 ==================== */
.editor-area {
  animation: fadeInUp 0.6s ease-out;
}

.title-input-section {
  margin-bottom: 20px;
}

.title-input {
  width: 100%;
  padding: 14px 18px;
  border: 2px solid rgba(139, 115, 85, 0.2);
  border-radius: 12px;
  font-size: 20px;
  text-align: center;
  background: rgba(255, 255, 255, 0.9);
  font-family: 'Noto Serif SC', serif;
  color: #5d4e37;
}

.title-input:focus {
  outline: none;
  border-color: #d4a574;
}

.title-input::placeholder {
  color: #b8a88a;
  font-style: italic;
}

.poem-editor {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(139, 115, 85, 0.15);
  border-radius: 16px;
  padding: 24px;
}

.editor-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 13px;
  color: #8b7355;
}

.ai-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.ai-toggle input {
  width: 18px;
  height: 18px;
  accent-color: #d4a574;
}

.toggle-label {
  font-size: 13px;
}

.lines-container {
  position: relative;
}

.line-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.line-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(139, 115, 85, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #8b7355;
  flex-shrink: 0;
  margin-top: 10px;
}

.line-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid rgba(139, 115, 85, 0.2);
  border-radius: 10px;
  font-size: 18px;
  background: rgba(255, 255, 255, 0.9);
  font-family: 'Noto Serif SC', serif;
  resize: none;
  line-height: 1.6;
  color: #5d4e37;
  overflow: hidden;
}

.line-input:focus {
  outline: none;
  border-color: #d4a574;
  box-shadow: 0 0 0 3px rgba(212, 165, 116, 0.1);
}

.delete-line {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(180, 80, 80, 0.1);
  border: none;
  color: #b45050;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  margin-top: 10px;
}

.delete-line:hover {
  background: #b45050;
  color: white;
}

/* 推荐面板 */
.recommendations-panel {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(212, 165, 116, 0.3);
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  box-shadow: 0 8px 24px rgba(139, 115, 85, 0.1);
}

.recommendations-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: #8b7355;
  font-weight: 500;
}

.close-recommendations {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(139, 115, 85, 0.1);
  border: none;
  cursor: pointer;
  color: #8b7355;
  transition: all 0.3s ease;
}

.close-recommendations:hover {
  background: #8b7355;
  color: white;
}

.recommendations-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recommendation-item {
  padding: 12px 16px;
  background: rgba(212, 165, 116, 0.08);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.recommendation-item:hover {
  background: rgba(212, 165, 116, 0.15);
  border-color: #d4a574;
  transform: translateX(5px);
}

.rec-line {
  font-size: 17px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 4px;
}

.rec-reason {
  font-size: 12px;
  color: #8b7355;
}

.add-line-section {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.add-line-btn,
.generate-full-btn {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: 'Noto Serif SC', serif;
}

.add-line-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 2px dashed rgba(139, 115, 85, 0.3);
  color: #8b7355;
}

.add-line-btn:hover {
  border-color: #8b7355;
  background: rgba(139, 115, 85, 0.05);
}

.generate-full-btn {
  background: linear-gradient(135deg, #8b7355, #a08060);
  color: white;
  border: none;
}

.generate-full-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 115, 85, 0.25);
}

.generate-full-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 实时提示 */
.realtime-tips {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: rgba(212, 165, 116, 0.1);
  border-radius: 12px;
  margin-top: 16px;
}

.tips-icon {
  font-size: 20px;
}

.tips-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #666;
}

/* 编辑器操作按钮 */
.editor-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  gap: 16px;
}

.score-btn,
.save-btn {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
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
  color: white;
  border: none;
}

.save-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(139, 115, 85, 0.3);
}

/* ==================== 飞花令模式 ==================== */
.feihua-setup {
  animation: fadeInUp 0.6s ease-out;
}

.keyword-section {
  text-align: center;
  margin-bottom: 30px;
}

.keyword-display {
  margin-bottom: 20px;
}

.keyword-char {
  display: inline-block;
  font-size: 80px;
  font-family: 'Noto Serif SC', serif;
  color: #5d4e37;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.1);
  animation: keywordPulse 2s ease-in-out infinite;
}

@keyframes keywordPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.difficulty-selector {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.diff-btn {
  padding: 8px 20px;
  border: 2px solid rgba(139, 115, 85, 0.2);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.7);
  color: #8b7355;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.diff-btn.active {
  background: #8b7355;
  color: white;
  border-color: #8b7355;
}

.random-keyword-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  border: none;
  border-radius: 25px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.random-keyword-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 115, 85, 0.3);
}

.feihua-editor {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 20px;
}

.feihua-textarea {
  width: 100%;
  padding: 16px;
  border: 2px solid rgba(139, 115, 85, 0.2);
  border-radius: 12px;
  font-size: 18px;
  font-family: 'Noto Serif SC', serif;
  resize: vertical;
  min-height: 200px;
  line-height: 1.8;
  color: #5d4e37;
  background: rgba(255, 255, 255, 0.9);
}

.feihua-textarea:focus {
  outline: none;
  border-color: #d4a574;
}

.keyword-counter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 14px;
  color: #8b7355;
}

.counter-value {
  padding: 4px 12px;
  background: rgba(139, 115, 85, 0.1);
  border-radius: 12px;
  font-weight: bold;
}

.counter-value.highlight {
  background: rgba(212, 165, 116, 0.2);
  color: #8b7355;
}

.related-words {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
}

.related-label {
  font-size: 13px;
  color: #8b7355;
}

.related-tag {
  padding: 4px 10px;
  background: rgba(212, 165, 116, 0.1);
  border-radius: 12px;
  font-size: 12px;
  color: #666;
}

.feihua-actions {
  display: flex;
  justify-content: center;
}

/* ==================== 接龙模式 ==================== */
.chain-setup {
  max-width: 500px;
  margin: 0 auto;
  animation: fadeInUp 0.6s ease-out;
}

.chain-mode-selector {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin: 20px 0;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid rgba(139, 115, 85, 0.2);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.mode-option:hover {
  border-color: #d4a574;
}

.mode-option:has(input:checked) {
  background: rgba(212, 165, 116, 0.15);
  border-color: #d4a574;
}

.mode-option input {
  width: 18px;
  height: 18px;
  accent-color: #d4a574;
}

.start-chain-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #8b7355, #a08060);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 17px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
  margin-top: 20px;
}

.start-chain-btn:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(139, 115, 85, 0.35);
}

.start-chain-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 接龙进行中 */
.chain-active {
  animation: fadeInUp 0.6s ease-out;
}

.chain-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(212, 165, 116, 0.1);
  border-radius: 12px;
}

.turn-indicator {
  font-size: 18px;
  font-weight: bold;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
}

.line-counter {
  font-size: 14px;
  color: #8b7355;
}

.chain-lines {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.chain-line {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  animation: lineSlideIn 0.4s ease-out;
}

@keyframes lineSlideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.chain-line.user {
  background: rgba(212, 165, 116, 0.1);
  margin-left: 20px;
}

.chain-line.ai {
  background: rgba(139, 115, 85, 0.1);
  margin-right: 20px;
}

.line-author {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
  flex-shrink: 0;
}

.chain-line.user .line-author {
  background: #d4a574;
}

.chain-line.ai .line-author {
  background: #8b7355;
}

.line-text {
  flex: 1;
  font-size: 18px;
  font-family: 'Noto Serif SC', serif;
  color: #5d4e37;
  line-height: 1.6;
}

.chain-input-area {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 20px;
}

.chain-input {
  width: 100%;
  padding: 14px;
  border: 2px solid rgba(139, 115, 85, 0.2);
  border-radius: 12px;
  font-size: 18px;
  font-family: 'Noto Serif SC', serif;
  resize: none;
  line-height: 1.6;
  color: #5d4e37;
}

.chain-input:focus {
  outline: none;
  border-color: #d4a574;
}

.input-hints {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  color: #8b7355;
}

.submit-chain-btn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 12px;
  font-family: 'Noto Serif SC', serif;
}

.submit-chain-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 115, 85, 0.3);
}

.submit-chain-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-thinking {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 30px;
  background: rgba(139, 115, 85, 0.05);
  border-radius: 16px;
  color: #8b7355;
  font-size: 15px;
}

.thinking-dots {
  display: flex;
  gap: 6px;
}

.thinking-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d4a574;
  animation: thinkingBounce 1.4s ease-in-out infinite;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinkingBounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.chain-controls {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

/* ==================== 评分组件 ==================== */
.score-panel {
  margin-top: 20px;
}

.poem-scorer {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 20px;
  padding: 30px;
  box-shadow: 0 20px 50px rgba(139, 115, 85, 0.2);
  border: 1px solid rgba(139, 115, 85, 0.15);
}

.score-header {
  text-align: center;
  margin-bottom: 20px;
}

.score-header h3 {
  font-size: 22px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
}

.total-score-display {
  text-align: center;
  margin-bottom: 28px;
}

.score-circle {
  position: relative;
  width: 130px;
  height: 130px;
  margin: 0 auto 10px;
}

.score-circle svg {
  transform: rotate(-90deg);
}

.score-bg {
  fill: none;
  stroke: rgba(139, 115, 85, 0.12);
  stroke-width: 10;
}

.score-progress {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
  transition: stroke-dasharray 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.score-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 38px;
  font-weight: 800;
  font-family: 'Noto Serif SC', serif;
  transition: color 0.5s ease;
}

.grade-badge {
  display: inline-block;
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 6px;
  letter-spacing: 2px;
}

.grade-badge.grade-masterpiece { background: linear-gradient(135deg, #c0392b, #e74c3c); color: white; }
.grade-badge.grade-excellent   { background: linear-gradient(135deg, #e67e22, #f39c12); color: white; }
.grade-badge.grade-good        { background: linear-gradient(135deg, #f1c40f, #f39c12); color: #5d4e37; }
.grade-badge.grade-pass        { background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; }
.grade-badge.grade-improve     { background: linear-gradient(135deg, #3498db, #2980b9); color: white; }
.grade-badge.grade-fail        { background: linear-gradient(135deg, #95a5a6, #7f8c8d); color: white; }
.grade-badge.grade-none        { background: rgba(139, 115, 85, 0.15); color: #8b7355; }

.score-label {
  font-size: 13px;
  color: #8b7355;
  letter-spacing: 1px;
}

.dimensions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.dimension-item {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(139, 115, 85, 0.12);
  border-radius: 12px;
  padding: 14px 16px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.dimension-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(139, 115, 85, 0.1);
}

.dim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dim-name {
  font-size: 13px;
  color: #8b7355;
  font-family: 'Noto Serif SC', serif;
  font-weight: 500;
}

.dim-value {
  font-size: 17px;
  font-weight: 800;
  font-family: 'Noto Serif SC', serif;
  transition: color 0.3s ease;
}

.dim-bar {
  height: 6px;
  background: rgba(139, 115, 85, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.dim-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.dim-desc {
  font-size: 11px;
  color: #aaa;
  text-align: right;
}

.suggestions-box {
  background: rgba(245, 239, 230, 0.8);
  border: 1px solid rgba(139, 115, 85, 0.15);
  border-radius: 14px;
  padding: 18px;
  margin-bottom: 20px;
}

.suggestions-box h4 {
  font-size: 15px;
  color: #5d4e37;
  margin-bottom: 14px;
  font-family: 'Noto Serif SC', serif;
  font-weight: bold;
}

.suggestions-parsed {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.suggestion-section {
  padding: 10px 14px;
  border-radius: 8px;
  border-left: 4px solid;
}

.suggestion-section.highlight {
  background: rgba(39, 174, 96, 0.08);
  border-color: #27ae60;
}

.suggestion-section.problem {
  background: rgba(231, 76, 60, 0.08);
  border-color: #e74c3c;
}

.suggestion-section.advice {
  background: rgba(52, 152, 219, 0.08);
  border-color: #3498db;
}

.suggestion-label {
  font-size: 12px;
  font-weight: bold;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 4px;
}

.highlight .suggestion-label { color: #27ae60; }
.problem .suggestion-label   { color: #e74c3c; }
.advice .suggestion-label     { color: #3498db; }

.suggestion-content {
  font-size: 13px;
  color: #555;
  line-height: 1.6;
  font-family: 'Noto Serif SC', serif;
}

.suggestions-raw {
  font-size: 13px;
  color: #555;
  line-height: 1.6;
  white-space: pre-wrap;
  margin: 0;
}

.score-actions {
  display: flex;
  gap: 12px;
}

.score-actions button {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.close-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(139, 115, 85, 0.2);
  color: #8b7355;
}

.close-btn:hover {
  background: rgba(139, 115, 85, 0.1);
}

/* 评分弹窗 */
.score-overlay {
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
  padding: 20px;
}

.score-modal {
  background: white;
  border-radius: 24px;
  padding: 30px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.close-modal {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(139, 115, 85, 0.1);
  border: none;
  cursor: pointer;
  color: #8b7355;
  font-size: 18px;
  transition: all 0.3s ease;
}

.close-modal:hover {
  background: #8b7355;
  color: white;
}

/* ==================== 打字机效果 ==================== */
.typewriter-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.95);
  padding: 30px 50px;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(139, 115, 85, 0.3);
  z-index: 1000;
  animation: typewriterFade 0.3s ease-out;
}

.typewriter-text {
  font-size: 18px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
}

/* ==================== 动画 ==================== */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.5s ease;
}

.fade-up-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.fade-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-fade-enter-active {
  transition: all 0.5s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(50px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-50px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==================== 响应式 ==================== */
@media (max-width: 768px) {
  .workbench-container {
    padding: 20px 15px;
  }

  .main-title {
    font-size: 28px;
    letter-spacing: 4px;
  }

  .brush-stroke {
    display: none;
  }

  .mode-selector {
    flex-direction: column;
    align-items: center;
  }

  .mode-card {
    width: 100%;
    max-width: 300px;
  }

  .step-indicator {
    flex-wrap: wrap;
    gap: 15px;
  }

  .step-connector {
    display: none;
  }

  .step-panel,
  .feihua-workspace,
  .chain-workspace {
    padding: 24px;
  }

  .keyword-char {
    font-size: 60px;
  }

  .editor-actions {
    flex-direction: column;
  }

  .action-buttons {
    flex-direction: column;
    gap: 12px;
  }

  .back-btn,
  .next-step-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
