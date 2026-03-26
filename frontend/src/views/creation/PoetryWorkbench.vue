<template>
  <div class="poetry-workbench">
    <!-- 水墨背景装饰 -->
    <div class="ink-background">
      <div class="ink-blob" v-for="i in 6" :key="i" :class="`blob-${i}`"></div>
    </div>

    <!-- 页面标题 -->
    <div class="title-section">
      <div class="brush-stroke left"></div>
      <h1 class="main-title">
        <span class="title-char" v-for="(char, i) in 'AI诗词创作工作台'" :key="i" :style="{ animationDelay: `${i * 0.08}s` }">
          {{ char }}
        </span>
      </h1>
      <div class="brush-stroke right"></div>
    </div>

    <!-- 创作模式选择 -->
    <div class="mode-selector">
      <div
        v-for="mode in modes"
        :key="mode.id"
        :class="['mode-card', { active: currentMode === mode.id }]"
        @click="switchMode(mode.id)"
      >
        <div class="mode-icon">{{ mode.icon }}</div>
        <div class="mode-info">
          <h3>{{ mode.title }}</h3>
          <p>{{ mode.desc }}</p>
        </div>
        <div class="mode-badge" v-if="mode.badge">{{ mode.badge }}</div>
      </div>
    </div>

    <!-- 主工作区域 -->
    <div class="workspace">
      <!-- 引导创作模式 -->
      <transition name="slide-fade" mode="out-in">
        <div v-if="currentMode === 'guided'" class="guided-workspace" key="guided">
          <!-- 步骤指示器 -->
          <div class="step-indicator">
            <div
              v-for="(step, index) in steps"
              :key="index"
              :class="['step', { active: currentStep === index + 1, completed: currentStep > index + 1 }]"
            >
              <div class="step-number">{{ index + 1 }}</div>
              <div class="step-label">{{ step.label }}</div>
              <div class="step-connector" v-if="index < steps.length - 1"></div>
            </div>
          </div>

          <!-- 步骤内容 -->
          <div class="step-content">
            <!-- 步骤1：灵感生成 -->
            <InspirationPanel
              v-if="currentStep === 1"
              ref="inspirationPanel"
              :theme="poemDraft.theme"
              :genre="poemDraft.genre"
              :is-loading="isLoading"
              @update:theme="poemDraft.theme = $event"
              @update:genre="poemDraft.genre = $event"
              @generate="handleGenerateInspiration"
              @next="handleInspirationNext"
            />

            <!-- 步骤2：结构引导 -->
            <StructureGuide
              v-else-if="currentStep === 2"
              :genre="poemDraft.genre"
              :theme="poemDraft.theme"
              :is-loading="isLoading"
              @load="handleLoadStructure"
              @back="currentStep = 1"
              @start="currentStep = 3"
            />

            <!-- 步骤3：创作编辑 -->
            <PoemEditor
              v-else-if="currentStep === 3"
              ref="poemEditor"
              :title="poemDraft.title"
              :lines="poemDraft.lines"
              :genre="poemDraft.genre"
              :theme="poemDraft.theme"
              :keywords="poemDraft.keywords"
              :is-generating="isGenerating"
              :is-polishing="isPolishing"
              @update:title="poemDraft.title = $event"
              @update:lines="poemDraft.lines = $event"
              @recommend="handleRecommend"
              @generate="handleGeneratePoem"
              @polish="handlePolish"
              @score="handleScore"
              @save="handleSave"
              @back="currentStep = 2"
            />
          </div>
        </div>

        <!-- 飞花令创作模式 -->
        <div v-else-if="currentMode === 'feihua'" class="mode-workspace" key="feihua">
          <FeihuaMode
            ref="feihuaMode"
            :is-loading="isLoading"
            :score="currentScore"
            :keyword="feihuaDraft.keyword"
            @update:title="feihuaDraft.title = $event"
            @update:content="feihuaDraft.content = $event"
            @score="handleFeihuaScore"
            @change:keyword="feihuaDraft.keyword = $event"
          />
        </div>

        <!-- 接龙创作模式 -->
        <div v-else-if="currentMode === 'chain'" class="mode-workspace" key="chain">
          <ChainMode
            ref="chainMode"
            :is-loading="isLoading"
            @start="handleChainStart"
            @submit="handleChainSubmit"
            @end="handleChainEnd"
          />
        </div>
      </transition>
    </div>

    <!-- 评分弹窗 -->
    <transition name="fade">
      <div class="score-overlay" v-if="showScorePanel" @click.self="showScorePanel = false">
        <div class="score-modal">
          <PoemScorer
            :score="currentScore"
            :show-polish="true"
            :is-polishing="isPolishing"
            :polish-result="polishResult"
            @close="showScorePanel = false"
            @save="handleSave"
            @polish="handlePolish"
            @apply="handleApplyPolish"
          />
        </div>
      </div>
    </transition>

    <!-- 打字机效果 -->
    <transition name="fade">
      <div class="typewriter-overlay" v-if="showTypewriter">
        <div class="typewriter-content">
          <div class="typewriter-icon">🖌️</div>
          <div class="typewriter-text">{{ typewriterText }}</div>
          <div class="typewriter-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, reactive, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import InspirationPanel from './components/InspirationPanel.vue';
import StructureGuide from './components/StructureGuide.vue';
import PoemEditor from './components/PoemEditor.vue';
import PoemScorer from './components/PoemScorer.vue';
import FeihuaMode from './components/FeihuaMode.vue';
import ChainMode from './components/ChainMode.vue';
import { api } from '../../services/api.js';

export default {
  name: 'PoetryWorkbench',
  components: {
    InspirationPanel,
    StructureGuide,
    PoemEditor,
    PoemScorer,
    FeihuaMode,
    ChainMode
  },
  setup() {
    const router = useRouter();

    // 创作模式
    const currentMode = ref('guided');
    const modes = [
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
    ];

    // 步骤
    const currentStep = ref(1);
    const steps = [
      { label: '灵感生成' },
      { label: '结构引导' },
      { label: '生成编辑' }
    ];

    // 诗词草稿数据
    const poemDraft = reactive({
      title: '',
      theme: '',
      genre: '五言绝句',
      lines: ['', '', '', ''],
      keywords: [],
      mood: '',
      suggestions: []
    });

    // 飞花令数据
    const feihuaDraft = reactive({
      keyword: '',
      title: '',
      content: ''
    });

    // 状态
    const isLoading = ref(false);
    const isGenerating = ref(false);
    const isPolishing = ref(false);
    const showTypewriter = ref(false);
    const typewriterText = ref('');
    const showScorePanel = ref(false);
    const currentScore = ref(null);
    const polishResult = ref(null);

    // 组件引用
    const inspirationPanel = ref(null);
    const poemEditor = ref(null);
    const feihuaMode = ref(null);
    const chainMode = ref(null);

    // 切换模式
    const switchMode = (mode) => {
      currentMode.value = mode;
      currentStep.value = 1;
      resetDraft();
    };

    // 重置草稿
    const resetDraft = () => {
      poemDraft.title = '';
      poemDraft.theme = '';
      poemDraft.genre = '五言绝句';
      poemDraft.lines = ['', '', '', ''];
      poemDraft.keywords = [];
      poemDraft.mood = '';
      poemDraft.suggestions = [];
      feihuaDraft.keyword = '';
      feihuaDraft.title = '';
      feihuaDraft.content = '';
      currentScore.value = null;
      polishResult.value = null;
    };

    // 显示打字机效果
    const showTypewriterEffect = (text) => {
      typewriterText.value = text;
      showTypewriter.value = true;
    };

    // 隐藏打字机效果
    const hideTypewriterEffect = () => {
      showTypewriter.value = false;
    };

    // 步骤1：生成灵感
    const handleGenerateInspiration = async ({ theme, genre }) => {
      isLoading.value = true;
      showTypewriterEffect('正在构思创意关键词...');

      try {
        const result = await api.creationWorkbench.generateInspiration(theme, genre);

        if (result && inspirationPanel.value) {
          inspirationPanel.value.setResult(result);
          poemDraft.keywords = result.keywords || [];
          poemDraft.mood = result.mood || '';
          poemDraft.suggestions = result.suggestions || [];
        }

        hideTypewriterEffect();
      } catch (error) {
        console.error('生成灵感失败:', error);
        // 模拟数据用于演示
        if (inspirationPanel.value) {
          const mockResult = {
            keywords: ['春风', '杨柳', '桃花', '燕子', '细雨'],
            theme: '春日迟迟，卉木萋萋',
            mood: '清新',
            suggestions: [
              '起句要点明季节特征',
              '注意动静结合，写出春的生机',
              '转句可以引入人事，增强层次感'
            ]
          };
          inspirationPanel.value.setResult(mockResult);
          poemDraft.keywords = mockResult.keywords;
          poemDraft.mood = mockResult.mood;
          poemDraft.suggestions = mockResult.suggestions;
        }
        hideTypewriterEffect();
      } finally {
        isLoading.value = false;
      }
    };

    // 灵感生成后下一步
    const handleInspirationNext = (data) => {
      poemDraft.theme = data.theme;
      poemDraft.genre = data.genre;
      poemDraft.keywords = data.keywords;
      poemDraft.mood = data.mood;
      currentStep.value = 2;
    };

    // 步骤2：加载结构引导
    const handleLoadStructure = async () => {
      isLoading.value = true;
      try {
        // API调用已在StructureGuide组件内处理
      } catch (error) {
        console.error('加载结构引导失败:', error);
      } finally {
        isLoading.value = false;
      }
    };

    // 获取行推荐
    const handleRecommend = async ({ currentLines, genre, theme, lineNumber, maxLength }) => {
      if (poemEditor.value) {
        try {
          const result = await api.creationWorkbench.recommendNextLine({
            currentLines,
            genre,
            theme,
            maxLength
          });

          if (result && result.suggestions) {
            const recs = result.suggestions.map((line, i) => ({
              line,
              reason: result.reasons?.[i] || 'AI推荐'
            }));
            poemEditor.value.setRecommendations(recs);
          }
        } catch (error) {
          // 模拟推荐数据
          if (poemEditor.value) {
            const mockRecs = [
              { line: '春风又绿江南岸', reason: '与上句形成对仗' },
              { line: '明月何时照我还', reason: '意境呼应' }
            ];
            poemEditor.value.setRecommendations(mockRecs);
          }
        }
      }
    };

    // AI生成完整诗词
    const handleGeneratePoem = async ({ theme, genre, keywords, existingLines }) => {
      isGenerating.value = true;
      showTypewriterEffect('AI正在创作中...');

      try {
        const result = await api.creationWorkbench.generatePoem({
          theme,
          genre,
          keywords,
          structure: ''
        });

        if (result && result.poem) {
          const newLines = result.poem.split('\n').filter(l => l.trim());
          if (poemEditor.value) {
            poemEditor.value.setLines(newLines);
          }
          if (result.title) {
            poemDraft.title = result.title;
            if (poemEditor.value) {
              poemEditor.value.setTitle(result.title);
            }
          }
        }
      } catch (error) {
        console.error('生成诗词失败:', error);
        // 模拟生成数据
        const mockPoem = '春风拂面柳丝长\n桃花映日笑春光\n燕子归来寻旧垒\n碧水青山入梦乡';
        if (poemEditor.value) {
          poemEditor.value.setLines(mockPoem.split('\n'));
        }
      } finally {
        isGenerating.value = false;
        hideTypewriterEffect();
      }
    };

    // AI润色
    const handlePolish = async (type) => {
      isPolishing.value = true;
      showTypewriterEffect('AI正在润色中...');

      try {
        // 模拟润色API调用
        await new Promise(resolve => setTimeout(resolve, 1500));

        const original = poemDraft.lines.join('\n');
        const polished = original.replace(/春风/g, '东风')
          .replace(/长/g, '柔')
          .replace(/光/g, '晖');

        polishResult.value = {
          poem: polished,
          original,
          explanation: '已优化用词，增强韵律美感'
        };
      } catch (error) {
        console.error('润色失败:', error);
      } finally {
        isPolishing.value = false;
        hideTypewriterEffect();
      }
    };

    // 应用润色结果
    const handleApplyPolish = (result) => {
      if (result && result.poem) {
        poemDraft.lines = result.poem.split('\n').filter(l => l.trim());
        if (poemEditor.value) {
          poemEditor.value.setLines(poemDraft.lines);
        }
      }
      polishResult.value = null;
    };

    // 评分
    const handleScore = async () => {
      showTypewriterEffect('正在分析作品...');

      try {
        const poemContent = poemDraft.lines.filter(l => l.trim()).join('\n');
        const result = await api.creationWorkbench.scorePoem({
          poem: poemContent,
          title: poemDraft.title,
          genre: poemDraft.genre,
          theme: poemDraft.theme
        });

        currentScore.value = result;
        showScorePanel.value = true;
      } catch (error) {
        console.error('评分失败:', error);
        // 模拟评分数据
        currentScore.value = {
          total: 85,
          dimensions: {
            content: 88,
            rhythm: 82,
            mood: 85,
            language: 80,
            creativity: 75
          },
          analysis: {
            rhyme: '押韵良好，平仄协调',
            rhymeOk: true,
            structure: '起承转合分明，结构完整',
            structureOk: true,
            meaning: '意境清晰，情景交融',
            meaningOk: true,
            language: '语言流畅，用词恰当',
            languageOk: true
          },
          suggestions: '整体作品优秀，第三句可再斟酌，增加情感深度'
        };
        showScorePanel.value = true;
      }

      hideTypewriterEffect();
    };

    // 飞花令评分
    const handleFeihuaScore = async () => {
      if (!feihuaDraft.content) return;

      isLoading.value = true;
      showTypewriterEffect('正在评分...');

      try {
        const result = await api.creationWorkbench.scoreFeihuaPoem({
          poem: feihuaDraft.content,
          keyword: feihuaDraft.keyword,
          genre: '五言绝句'
        });

        currentScore.value = result;
        showScorePanel.value = true;
      } catch (error) {
        console.error('飞花令评分失败:', error);
        // 模拟评分
        currentScore.value = {
          total: 78,
          dimensions: {
            content: 80,
            rhythm: 75,
            mood: 78,
            language: 72,
            creativity: 70,
            keyword: 95
          },
          analysis: {
            rhyme: '关键字使用恰当',
            rhymeOk: true,
            structure: '结构基本完整',
            structureOk: true,
            meaning: '意境表达尚可',
            meaningOk: true
          },
          suggestions: '关键字使用出色，可进一步提升韵律美感'
        };
        showScorePanel.value = true;
      }

      isLoading.value = false;
      hideTypewriterEffect();
    };

    // 接龙开始
    const handleChainStart = ({ theme, genre, startMode }) => {
      poemDraft.theme = theme;
      poemDraft.genre = genre;
    };

    // 接龙提交
    const handleChainSubmit = async ({ userLine, genre, theme, lineNumber }) => {
      isLoading.value = true;

      try {
        if (lineNumber === 1) {
          const result = await api.creationWorkbench.startChainPoem(genre, theme);
          if (chainMode.value) {
            chainMode.value.setAILine(result.aiLine);
          }
        } else {
          const result = await api.creationWorkbench.getChainNextLine({
            userLine,
            genre,
            theme,
            lineNumber
          });
          if (chainMode.value) {
            chainMode.value.setAILine(result.aiLine);
          }
        }
      } catch (error) {
        console.error('接龙失败:', error);
        // 模拟AI接龙
        const aiLines = ['明月松间照', '清泉石上流', '竹喧归浣女', '莲动下渔舟'];
        if (chainMode.value) {
          chainMode.value.setAILine(aiLines[Math.floor(Math.random() * aiLines.length)]);
        }
      }

      isLoading.value = false;
    };

    // 接龙结束
    const handleChainEnd = ({ lines, title, genre, theme, goToEdit }) => {
      if (lines && lines.length > 0) {
        poemDraft.lines = lines;
        poemDraft.title = title;
        poemDraft.genre = genre;
        poemDraft.theme = theme;

        if (goToEdit) {
          currentMode.value = 'guided';
          currentStep.value = 3;
        }
      }
    };

    // 保存作品
    const handleSave = async () => {
      try {
        const workData = {
          title: poemDraft.title || feihuaDraft.title || '无题',
          content: poemDraft.lines.filter(l => l.trim()).join('\n') || feihuaDraft.content,
          genre: poemDraft.genre || '五言绝句',
          theme: poemDraft.theme || `飞花令 - ${feihuaDraft.keyword}`,
          creation_mode: currentMode.value,
          score_data: JSON.stringify(currentScore.value || {}),
          modification_suggestions: currentScore.value?.suggestions || ''
        };

        await api.creationWorkbench.saveWork(workData);

        showScorePanel.value = false;
        alert('作品保存成功！');

        // 重置状态
        resetDraft();
        currentStep.value = 1;

        // 跳转到记录页
        router.push('/creation/records');
      } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败，请重试');
      }
    };

    return {
      // 模式
      currentMode,
      modes,
      currentStep,
      steps,

      // 数据
      poemDraft,
      feihuaDraft,

      // 状态
      isLoading,
      isGenerating,
      isPolishing,
      showTypewriter,
      typewriterText,
      showScorePanel,
      currentScore,
      polishResult,

      // 组件引用
      inspirationPanel,
      poemEditor,
      feihuaMode,
      chainMode,

      // 方法
      switchMode,
      handleGenerateInspiration,
      handleInspirationNext,
      handleLoadStructure,
      handleRecommend,
      handleGeneratePoem,
      handlePolish,
      handleApplyPolish,
      handleScore,
      handleFeihuaScore,
      handleChainStart,
      handleChainSubmit,
      handleChainEnd,
      handleSave
    };
  }
};
</script>

<style scoped>
/* 基础布局 */
.poetry-workbench {
  min-height: 100vh;
  padding: 40px 20px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #fdf6e3 0%, #fef9f3 50%, #f5efe6 100%);
}

/* 水墨背景 */
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
  opacity: 0.12;
  animation: float 25s ease-in-out infinite;
}

.blob-1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #8b7355 0%, transparent 70%);
  top: -150px;
  right: -100px;
  animation-delay: 0s;
}

.blob-2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #a0522d 0%, transparent 70%);
  bottom: 5%;
  left: -80px;
  animation-delay: -6s;
}

.blob-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, #d2b48c 0%, transparent 70%);
  top: 40%;
  right: 15%;
  animation-delay: -12s;
}

.blob-4 {
  width: 250px;
  height: 250px;
  background: radial-gradient(circle, #bc8f8f 0%, transparent 70%);
  bottom: 35%;
  right: 35%;
  animation-delay: -18s;
}

.blob-5 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #deb887 0%, transparent 70%);
  top: 15%;
  left: 20%;
  animation-delay: -8s;
}

.blob-6 {
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, #c4a882 0%, transparent 70%);
  top: 60%;
  left: 60%;
  animation-delay: -15s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -40px) scale(1.05); }
  50% { transform: translate(-15px, 25px) scale(0.95); }
  75% { transform: translate(40px, 15px) scale(1.02); }
}

/* 标题区域 */
.title-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 40px;
  position: relative;
  z-index: 1;
}

.brush-stroke {
  width: 120px;
  height: 6px;
  background: linear-gradient(90deg, transparent, #8b7355, transparent);
  border-radius: 3px;
  animation: brushFade 2s ease-out;
}

.brush-stroke.left {
  animation: brushFadeLeft 2s ease-out;
}

.brush-stroke.right {
  animation: brushFadeRight 2s ease-out;
}

@keyframes brushFadeLeft {
  from { transform: translateX(-60px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes brushFadeRight {
  from { transform: translateX(60px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.main-title {
  font-size: 38px;
  font-family: 'Noto Serif SC', 'SimSun', serif;
  color: #5d4e37;
  text-shadow: 2px 2px 4px rgba(93, 78, 55, 0.1);
  letter-spacing: 6px;
  position: relative;
  display: flex;
}

.title-char {
  display: inline-block;
  animation: charFadeIn 0.5s ease-out forwards;
  opacity: 0;
}

@keyframes charFadeIn {
  from {
    opacity: 0;
    transform: translateY(-15px) rotate(-8deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) rotate(0);
  }
}

/* 模式选择器 */
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
  width: 220px;
  padding: 28px 24px;
  background: rgba(255, 255, 255, 0.75);
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
  transform: translateY(-10px);
  box-shadow: 0 25px 50px rgba(139, 115, 85, 0.18);
}

.mode-card:hover::before {
  transform: scaleX(1);
}

.mode-card.active {
  background: rgba(255, 255, 255, 0.92);
  border-color: #8b7355;
  box-shadow: 0 20px 45px rgba(139, 115, 85, 0.22);
}

.mode-card.active::before {
  transform: scaleX(1);
}

.mode-icon {
  font-size: 40px;
  margin-bottom: 14px;
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
  top: 14px;
  right: 14px;
  padding: 5px 12px;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  font-size: 11px;
  border-radius: 20px;
}

/* 工作区 */
.workspace {
  max-width: 1100px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

/* 引导工作区 */
.guided-workspace {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(139, 115, 85, 0.15);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(139, 115, 85, 0.1);
}

.mode-workspace {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(139, 115, 85, 0.15);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 60px rgba(139, 115, 85, 0.1);
}

/* 步骤指示器 */
.step-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 28px 20px;
  background: rgba(245, 239, 230, 0.5);
  border-bottom: 1px solid rgba(139, 115, 85, 0.1);
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.step-number {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid #d4c4b0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: bold;
  color: #8b7355;
  transition: all 0.4s ease;
  z-index: 2;
}

.step.active .step-number {
  background: linear-gradient(135deg, #8b7355, #d4a574);
  color: white;
  border-color: #8b7355;
  transform: scale(1.12);
  box-shadow: 0 10px 25px rgba(139, 115, 85, 0.35);
}

.step.completed .step-number {
  background: #d4a574;
  color: white;
  border-color: #d4a574;
}

.step-label {
  margin-top: 12px;
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
  width: 100px;
  height: 3px;
  background: linear-gradient(90deg, #d4c4b0, #d4c4b0);
  margin: 0 20px;
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

/* 步骤内容 */
.step-content {
  padding: 8px;
}

/* 评分弹窗 */
.score-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.score-modal {
  max-width: 600px;
  width: 100%;
  animation: modalSlideIn 0.4s ease;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(30px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 打字机效果 */
.typewriter-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.96);
  padding: 36px 56px;
  border-radius: 20px;
  box-shadow: 0 25px 70px rgba(139, 115, 85, 0.3);
  z-index: 1000;
  animation: typewriterFade 0.3s ease-out;
}

.typewriter-content {
  text-align: center;
}

.typewriter-icon {
  font-size: 44px;
  margin-bottom: 18px;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

.typewriter-text {
  font-size: 18px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 18px;
}

.typewriter-dots {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.typewriter-dots span {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #d4a574;
  animation: typing 1.4s ease-in-out infinite;
}

.typewriter-dots span:nth-child(2) { animation-delay: 0.2s; }
.typewriter-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* 动画 */
.slide-fade-enter-active {
  transition: all 0.5s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(60px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-60px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 900px) {
  .poetry-workbench {
    padding: 24px 16px;
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
    gap: 16px;
  }

  .mode-card {
    width: 100%;
    max-width: 320px;
  }

  .step-indicator {
    padding: 20px 16px;
    gap: 0;
  }

  .step-connector {
    width: 60px;
    margin: 0 8px;
    margin-bottom: 28px;
  }
}

@media (max-width: 600px) {
  .title-section {
    margin-bottom: 28px;
  }

  .main-title {
    font-size: 24px;
    letter-spacing: 2px;
  }

  .step-number {
    width: 44px;
    height: 44px;
    font-size: 18px;
  }

  .step-label {
    font-size: 12px;
  }

  .step-connector {
    width: 40px;
  }

  .typewriter-overlay {
    padding: 28px 36px;
  }

  .typewriter-text {
    font-size: 16px;
  }
}
</style>
