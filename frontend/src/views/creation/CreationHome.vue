<template>
  <div class="creation-container">
    <!-- 页面标题 -->
    <div class="title-container">
      <div class="title-decoration left"></div>
      <h1 class="creation-title">诗词创作</h1>
      <div class="title-decoration right"></div>
    </div>
    
    <!-- 创作模式切换 -->
    <div class="mode-tabs">
      <button 
        v-for="mode in creationModes" 
        :key="mode.value"
        :class="['mode-tab', { active: currentMode === mode.value }]"
        @click="switchMode(mode.value)"
      >
        {{ mode.label }}
      </button>
    </div>
    
    <!-- 新手模式 -->
    <div v-if="currentMode === 'novice'" class="mode-content">
      <h2 class="mode-title">新手填词</h2>
      <div class="novice-form glass-card">
        <div class="form-group">
          <label for="novice-theme">主题</label>
          <input type="text" id="novice-theme" v-model="noviceForm.theme" placeholder="请输入创作主题" class="form-input">
        </div>
        <div class="form-group">
          <label for="novice-genre">体裁</label>
          <select id="novice-genre" v-model="noviceForm.genre" class="form-select">
            <option value="五言绝句">五言绝句</option>
            <option value="七言绝句">七言绝句</option>
            <option value="五言律诗">五言律诗</option>
            <option value="七言律诗">七言律诗</option>
            <option value="宋词">宋词</option>
          </select>
        </div>
        <button class="btn-primary" @click="generatePromptPoem" :disabled="isLoading">
          <span v-if="isLoading" class="loading-spinner"></span>
          {{ isLoading ? 'AI发力中...' : '生成引导诗' }}
        </button>
        
        <!-- 引导诗展示 -->
        <div v-if="promptPoem" class="prompt-poem glass-card">
          <h3 class="card-title">引导诗</h3>
          <pre class="poem-content">{{ promptPoem.prompt_poem }}</pre>
          <div class="explanation">{{ promptPoem.explanation }}</div>
          
          <div class="form-group">
            <label for="user-poem">请填写完整的诗词</label>
            <textarea id="user-poem" v-model="noviceForm.userPoem" placeholder="请根据引导诗填写完整的诗词" class="form-textarea"></textarea>
          </div>
          <button class="btn-primary" @click="checkPoem" :disabled="isLoading">
            <span v-if="isLoading" class="loading-spinner"></span>
            {{ isLoading ? 'AI发力中...' : '提交校验' }}
          </button>
        </div>
        
        <!-- 评分结果 -->
        <div v-if="noviceScore" class="score-result">
          <h3 class="card-title">评分结果</h3>
          <div class="score-card glass-card">
            <div class="total-score">{{ noviceScore.score }}</div>
            <div class="score-details">
              <div class="score-item">
                <span>内容契合度</span>
                <span>{{ noviceScore.analysis.content }}</span>
              </div>
              <div class="score-item">
                <span>韵律美感</span>
                <span>{{ noviceScore.analysis.rhythm }}</span>
              </div>
              <div class="score-item">
                <span>意境表达</span>
                <span>{{ noviceScore.analysis.意境 }}</span>
              </div>
            </div>
            <div class="suggestions">{{ noviceScore.suggestions }}</div>
            <button class="btn-secondary" @click="saveWork('novice')">保存作品</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 主题创作模式 -->
    <div v-if="currentMode === 'theme'" class="mode-content">
      <h2 class="mode-title">主题创作</h2>
      <div class="theme-form glass-card">
        <div class="form-group">
          <label for="theme-title">标题</label>
          <input type="text" id="theme-title" v-model="themeForm.title" placeholder="请输入诗词标题" class="form-input">
        </div>
        <div class="form-group">
          <label for="theme-theme">主题</label>
          <input type="text" id="theme-theme" v-model="themeForm.theme" placeholder="请输入创作主题" class="form-input">
        </div>
        <div class="form-group">
          <label for="theme-genre">体裁</label>
          <select id="theme-genre" v-model="themeForm.genre" class="form-select">
            <option value="五言绝句">五言绝句</option>
            <option value="七言绝句">七言绝句</option>
            <option value="五言律诗">五言律诗</option>
            <option value="七言律诗">七言律诗</option>
            <option value="宋词">宋词</option>
          </select>
        </div>
        <button class="btn-secondary" @click="generateReference" :disabled="isLoading">
          <span v-if="isLoading" class="loading-spinner"></span>
          {{ isLoading ? 'AI发力中...' : '生成参考诗词' }}
        </button>
        
        <!-- 参考诗词展示 -->
        <div v-if="referencePoem" class="reference-poem glass-card">
          <h3 class="card-title">参考诗词</h3>
          <pre class="poem-content">{{ referencePoem.poem }}</pre>
          <div class="analysis">{{ referencePoem.analysis }}</div>
        </div>
        
        <div class="form-group">
          <label for="theme-content">诗词内容</label>
          <textarea id="theme-content" v-model="themeForm.content" placeholder="请输入你的创作" class="form-textarea"></textarea>
        </div>
        <button class="btn-primary" @click="scorePoem" :disabled="isLoading">
          <span v-if="isLoading" class="loading-spinner"></span>
          {{ isLoading ? 'AI发力中...' : '提交评分' }}
        </button>
        
        <!-- 评分结果 -->
        <div v-if="themeScore" class="score-result">
          <h3 class="card-title">评分结果</h3>
          <div class="score-card glass-card">
            <div class="total-score">{{ themeScore.total }}</div>
            <div class="score-details">
              <div class="score-item">
                <span>内容契合度</span>
                <span>{{ themeScore.dimensions.content }}</span>
              </div>
              <div class="score-item">
                <span>韵律美感</span>
                <span>{{ themeScore.dimensions.rhythm }}</span>
              </div>
              <div class="score-item">
                <span>意境表达</span>
                <span>{{ themeScore.dimensions.mood }}</span>
              </div>
              <div class="score-item">
                <span>语言流畅度</span>
                <span>{{ themeScore.dimensions.language }}</span>
              </div>
              <div class="score-item">
                <span>创意性</span>
                <span>{{ themeScore.dimensions.creativity }}</span>
              </div>
            </div>
            <div class="suggestions">{{ themeScore.suggestions }}</div>
            <button class="btn-secondary" @click="saveWork('theme')">保存作品</button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 飞花令挑战模式 -->
    <div v-if="currentMode === 'feihua'" class="mode-content">
      <h2 class="mode-title">飞花令挑战</h2>
      <div class="feihua-form glass-card">
        <div class="form-group">
          <label for="feihua-keyword">关键字</label>
          <div class="keyword-input-group">
            <input type="text" id="feihua-keyword" v-model="feihuaForm.keyword" placeholder="请输入飞花令关键字" class="form-input">
            <button class="btn-secondary" @click="getRandomKeyword">随机关键字</button>
            <button class="btn-secondary" @click="getRecentKeyword">最近关键字</button>
          </div>
        </div>
        <div class="form-group">
          <label for="feihua-title">标题</label>
          <input type="text" id="feihua-title" v-model="feihuaForm.title" placeholder="请输入诗词标题" class="form-input">
        </div>
        <div class="form-group">
          <label for="feihua-genre">体裁</label>
          <select id="feihua-genre" v-model="feihuaForm.genre" class="form-select">
            <option value="五言绝句">五言绝句</option>
            <option value="七言绝句">七言绝句</option>
            <option value="五言律诗">五言律诗</option>
            <option value="七言律诗">七言律诗</option>
            <option value="宋词">宋词</option>
          </select>
        </div>
        <div class="form-group">
          <label for="feihua-content">诗词内容</label>
          <textarea id="feihua-content" v-model="feihuaForm.content" placeholder="请输入你的创作，确保包含关键字" class="form-textarea"></textarea>
        </div>
        <button class="btn-primary" @click="scoreFeihuaPoem" :disabled="isLoading">
          {{ isLoading ? '评分中...' : '提交评分' }}
        </button>
        
        <!-- 评分结果 -->
        <div v-if="feihuaScore" class="score-result">
          <h3 class="card-title">评分结果</h3>
          <div class="score-card glass-card">
            <div class="total-score">{{ feihuaScore.total }}</div>
            <div class="score-details">
              <div class="score-item">
                <span>内容契合度</span>
                <span>{{ feihuaScore.dimensions.content }}</span>
              </div>
              <div class="score-item">
                <span>韵律美感</span>
                <span>{{ feihuaScore.dimensions.rhythm }}</span>
              </div>
              <div class="score-item">
                <span>意境表达</span>
                <span>{{ feihuaScore.dimensions.mood }}</span>
              </div>
              <div class="score-item">
                <span>语言流畅度</span>
                <span>{{ feihuaScore.dimensions.language }}</span>
              </div>
              <div class="score-item">
                <span>创意性</span>
                <span>{{ feihuaScore.dimensions.creativity }}</span>
              </div>
            </div>
            <div class="suggestions">{{ feihuaScore.suggestions }}</div>
            <button class="btn-secondary" @click="saveWork('feihua')">保存作品</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CreationHome',
  data() {
    return {
      currentMode: 'novice',
      creationModes: [
        { value: 'novice', label: '新手填词' },
        { value: 'theme', label: '主题创作' },
        { value: 'feihua', label: '飞花令挑战' }
      ],
      isLoading: false,
      
      // 新手模式表单
      noviceForm: {
        theme: '',
        genre: '五言绝句',
        userPoem: ''
      },
      promptPoem: null,
      noviceScore: null,
      
      // 主题创作表单
      themeForm: {
        title: '',
        theme: '',
        genre: '五言绝句',
        content: ''
      },
      referencePoem: null,
      themeScore: null,
      
      // 飞花令挑战表单
      feihuaForm: {
        keyword: '',
        title: '',
        genre: '五言绝句',
        content: ''
      },
      feihuaScore: null
    }
  },
  methods: {
    switchMode(mode) {
      this.currentMode = mode;
    },
    
    // 新手模式 - 生成引导诗
    async generatePromptPoem() {
      if (!this.noviceForm.theme) {
        alert('请输入主题');
        return;
      }
      
      this.isLoading = true;
      try {
        const response = await fetch('http://localhost:3000/api/creation/novice/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            theme: this.noviceForm.theme,
            genre: this.noviceForm.genre
          })
        });
        
        const data = await response.json();
        this.promptPoem = data.data;
        this.noviceScore = null;
      } catch (error) {
        console.error('生成引导诗失败:', error);
        alert('生成引导诗失败，请重试');
      } finally {
        this.isLoading = false;
      }
    },
    
    // 新手模式 - 校验填词结果
    async checkPoem() {
      if (!this.noviceForm.userPoem) {
        alert('请填写完整的诗词');
        return;
      }
      
      this.isLoading = true;
      try {
        const response = await fetch('http://localhost:3000/api/creation/novice/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userPoem: this.noviceForm.userPoem,
            referencePoem: this.promptPoem.reference_poem
          })
        });
        
        const data = await response.json();
        this.noviceScore = data.data;
      } catch (error) {
        console.error('校验填词结果失败:', error);
        alert('校验填词结果失败，请重试');
      } finally {
        this.isLoading = false;
      }
    },
    
    // 主题创作 - 生成参考诗词
    async generateReference() {
      if (!this.themeForm.theme) {
        alert('请输入主题');
        return;
      }
      
      this.isLoading = true;
      try {
        const response = await fetch('http://localhost:3000/api/creation/assist/generate-reference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            theme: this.themeForm.theme,
            genre: this.themeForm.genre
          })
        });
        
        const data = await response.json();
        this.referencePoem = data.data;
      } catch (error) {
        console.error('生成参考诗词失败:', error);
        alert('生成参考诗词失败，请重试');
      } finally {
        this.isLoading = false;
      }
    },
    
    // 主题创作 - 评分
    async scorePoem() {
      if (!this.themeForm.content) {
        alert('请输入诗词内容');
        return;
      }
      
      this.isLoading = true;
      try {
        const response = await fetch('http://localhost:3000/api/creation/assist/score', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            poem: this.themeForm.content,
            title: this.themeForm.title,
            genre: this.themeForm.genre,
            theme: this.themeForm.theme
          })
        });
        
        const data = await response.json();
        this.themeScore = data.data;
      } catch (error) {
        console.error('评分失败:', error);
        alert('评分失败，请重试');
      } finally {
        this.isLoading = false;
      }
    },
    
    // 飞花令挑战 - 获取随机关键字
    getRandomKeyword() {
      const keywords = ['春', '夏', '秋', '冬', '风', '花', '雪', '月', '山', '水', '云', '霞'];
      this.feihuaForm.keyword = keywords[Math.floor(Math.random() * keywords.length)];
    },
    
    // 飞花令挑战 - 获取最近关键字
    async getRecentKeyword() {
      try {
        const response = await fetch('http://localhost:3000/api/feihua/keywords', {
          method: 'GET'
        });
        
        const data = await response.json();
        if (data.keywords && data.keywords.length > 0) {
          this.feihuaForm.keyword = data.keywords[0];
        }
      } catch (error) {
        console.error('获取最近关键字失败:', error);
        this.getRandomKeyword();
      }
    },
    
    // 飞花令挑战 - 评分
    async scoreFeihuaPoem() {
      if (!this.feihuaForm.content) {
        alert('请输入诗词内容');
        return;
      }
      
      this.isLoading = true;
      try {
        const response = await fetch('http://localhost:3000/api/creation/assist/score', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            poem: this.feihuaForm.content,
            title: this.feihuaForm.title,
            genre: this.feihuaForm.genre,
            theme: `飞花令 - ${this.feihuaForm.keyword}`
          })
        });
        
        const data = await response.json();
        this.feihuaScore = data.data;
      } catch (error) {
        console.error('评分失败:', error);
        alert('评分失败，请重试');
      } finally {
        this.isLoading = false;
      }
    },
    
    // 保存作品
    async saveWork(mode) {
      let workData;
      
      switch (mode) {
        case 'novice':
          workData = {
            title: `新手填词 - ${this.noviceForm.theme}`,
            content: this.noviceForm.userPoem,
            genre: this.noviceForm.genre,
            theme: this.noviceForm.theme,
            creation_mode: 'novice',
            ai_reference: JSON.stringify(this.promptPoem),
            score_data: JSON.stringify(this.noviceScore),
            modification_suggestions: this.noviceScore.suggestions
          };
          break;
        case 'theme':
          workData = {
            title: this.themeForm.title || `主题创作 - ${this.themeForm.theme}`,
            content: this.themeForm.content,
            genre: this.themeForm.genre,
            theme: this.themeForm.theme,
            creation_mode: 'theme',
            ai_reference: this.referencePoem ? JSON.stringify(this.referencePoem) : null,
            score_data: JSON.stringify(this.themeScore),
            modification_suggestions: this.themeScore.suggestions
          };
          break;
        case 'feihua':
          workData = {
            title: this.feihuaForm.title || `飞花令 - ${this.feihuaForm.keyword}`,
            content: this.feihuaForm.content,
            genre: this.feihuaForm.genre,
            theme: `飞花令 - ${this.feihuaForm.keyword}`,
            creation_mode: 'feihua',
            score_data: JSON.stringify(this.feihuaScore),
            modification_suggestions: this.feihuaScore.suggestions
          };
          break;
      }
      
      try {
        const response = await fetch('http://localhost:3000/api/creation/works/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(workData)
        });
        
        const data = await response.json();
        if (data.id) {
          alert('作品保存成功');
          // 重置表单
          this.resetForm(mode);
        } else {
          alert('作品保存失败，请重试');
        }
      } catch (error) {
        console.error('保存作品失败:', error);
        alert('保存作品失败，请重试');
      }
    },
    
    // 重置表单
    resetForm(mode) {
      switch (mode) {
        case 'novice':
          this.promptPoem = null;
          this.noviceScore = null;
          this.noviceForm.userPoem = '';
          break;
        case 'theme':
          this.referencePoem = null;
          this.themeScore = null;
          this.themeForm.content = '';
          break;
        case 'feihua':
          this.feihuaScore = null;
          this.feihuaForm.content = '';
          break;
      }
    }
  }
}
</script>

<style scoped>
/* 整体容器 */
.creation-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
  position: relative;
}

/* 页面标题 */
.title-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 40px;
  position: relative;
}

.title-decoration {
  width: 80px;
  height: 40px;
  background: linear-gradient(45deg, #cd853f, #8b4513);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
  opacity: 0.8;
}

.title-decoration.right {
  transform: scaleX(-1);
}

.creation-title {
  font-size: 32px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  margin: 0 20px;
  text-align: center;
  position: relative;
  display: block;
  animation: none;
}

.creation-title::after {
  content: '✦';
  position: absolute;
  right: -30px;
  top: 50%;
  transform: translateY(-50%);
  color: #cd853f;
  font-size: 20px;
}

.creation-title::before {
  content: '✦';
  position: absolute;
  left: -30px;
  top: 50%;
  transform: translateY(-50%);
  color: #cd853f;
  font-size: 20px;
}

/* 创作模式切换 */
.mode-tabs {
  display: flex;
  justify-content: center;
  margin-bottom: 40px;
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 8px;
  box-shadow: var(--glass-shadow);
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.mode-tab {
  padding: 12px 24px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: #666;
  border-radius: 8px;
  transition: all 0.3s ease;
  font-family: 'SimSun', 'STSong', serif;
  position: relative;
}

.mode-tab:hover {
  color: #8b4513;
  background: rgba(205, 133, 63, 0.1);
  transform: translateY(-2px);
}

.mode-tab.active {
  color: #8b4513;
  background: rgba(205, 133, 63, 0.2);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
  border: 1px solid rgba(205, 133, 63, 0.3);
}

/* 模式内容 */
.mode-content {
  margin-bottom: 40px;
}

.mode-title {
  font-size: 24px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  margin-bottom: 20px;
  text-align: center;
  position: relative;
}

.mode-title::after {
  content: '';
  display: block;
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  margin: 10px auto 0;
  border-radius: 1px;
}

/* 毛玻璃卡片 */
.glass-card {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 30px;
  box-shadow: var(--glass-shadow);
  margin-bottom: 30px;
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.glass-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
  z-index: -1;
}

/* 表单组 */
.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 8px;
  font-size: 16px;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #cd853f;
  box-shadow: 0 0 0 2px rgba(205, 133, 63, 0.1);
}

.form-textarea {
  height: 180px;
  resize: vertical;
  font-family: 'SimSun', 'STSong', serif;
  line-height: 1.6;
}

/* 按钮样式 */
.btn-primary {
  background: rgba(205, 133, 63, 0.2);
  color: #8b4513;
  border: 1px solid rgba(205, 133, 63, 0.3);
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
  font-family: 'SimSun', 'STSong', serif;
}

.btn-primary:hover:not(:disabled) {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.25);
}

.btn-secondary {
  background: rgba(139, 69, 19, 0.1);
  color: #8b4513;
  border: 1px solid rgba(139, 69, 19, 0.2);
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.1);
  font-family: 'SimSun', 'STSong', serif;
  margin-right: 10px;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(139, 69, 19, 0.2);
  border-color: rgba(139, 69, 19, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.15);
}

.btn-primary:disabled,
.btn-secondary:disabled {
  background: rgba(205, 205, 205, 0.3);
  border-color: rgba(205, 205, 205, 0.5);
  color: #999;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.1);
}

/* 诗词展示 */
.prompt-poem,
.reference-poem {
  margin: 30px 0;
}

.card-title {
  font-size: 20px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  margin-top: 0;
  margin-bottom: 20px;
  position: relative;
}

.card-title::before {
  content: '◆';
  position: absolute;
  left: -20px;
  top: 0;
  color: #cd853f;
  font-size: 14px;
}

.poem-content {
  white-space: pre-wrap;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 18px;
  line-height: 1.8;
  margin: 0 0 20px;
  color: #333;
  background: rgba(255, 252, 240, 0.5);
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #cd853f;
}

.explanation,
.analysis {
  color: #666;
  font-size: 14px;
  line-height: 1.6;
  background: rgba(255, 252, 240, 0.3);
  padding: 15px;
  border-radius: 8px;
  margin-top: 10px;
}

/* 评分结果 */
.score-result {
  margin-top: 30px;
}

.score-card {
  position: relative;
}

.total-score {
  font-size: 48px;
  font-weight: bold;
  color: #8b4513;
  text-align: center;
  margin-bottom: 30px;
  font-family: 'SimSun', 'STSong', serif;
  text-shadow: 2px 2px 4px rgba(139, 69, 19, 0.1);
}

.score-details {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 30px;
  justify-content: center;
}

.score-item {
  flex: 1;
  min-width: 120px;
  text-align: center;
  padding: 15px;
  background: rgba(255, 252, 240, 0.5);
  border-radius: 8px;
  border: 1px solid rgba(205, 133, 63, 0.2);
}

.score-item span:first-child {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  font-family: 'SimSun', 'STSong', serif;
}

.score-item span:last-child {
  display: block;
  font-size: 20px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.suggestions {
  background: rgba(255, 252, 240, 0.5);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
  color: #333;
  line-height: 1.6;
  border-left: 4px solid #cd853f;
  font-size: 14px;
}

/* 关键字输入组 */
.keyword-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.keyword-input-group input {
  flex: 1;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .creation-container {
    max-width: 100%;
    padding: 30px 20px;
  }
  
  .glass-card {
    padding: 25px;
  }
}

@media (max-width: 768px) {
  .title-container {
    flex-direction: column;
  }
  
  .title-decoration {
    display: none;
  }
  
  .page-title {
    font-size: 28px;
  }
  
  .page-title::before,
  .page-title::after {
    display: none;
  }
  
  .mode-tabs {
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }
  
  .mode-tab {
    padding: 12px 20px;
    text-align: center;
  }
  
  .mode-tab.active {
    border-left: none;
    border-bottom: 2px solid #cd853f;
  }
  
  .keyword-input-group {
    flex-direction: column;
    align-items: stretch;
  }
  
  .keyword-input-group button {
    margin-right: 0;
    margin-bottom: 10px;
  }
  
  .score-details {
    flex-direction: column;
    align-items: stretch;
  }
  
  .score-item {
    min-width: 100%;
  }
  
  .glass-card {
    padding: 20px;
  }
  
  .poem-content {
    font-size: 16px;
    padding: 15px;
  }
  
  .total-score {
    font-size: 36px;
  }
}

@media (max-width: 480px) {
  .creation-container {
    padding: 20px 15px;
  }
  
  .page-title {
    font-size: 24px;
  }
  
  .mode-title {
    font-size: 20px;
  }
  
  .glass-card {
    padding: 15px;
  }
  
  .form-input,
  .form-select,
  .form-textarea {
    padding: 10px 12px;
    font-size: 14px;
  }
  
  .btn-primary {
    padding: 10px 20px;
    font-size: 14px;
  }
  
  .btn-secondary {
    padding: 8px 16px;
    font-size: 12px;
  }
  
  .poem-content {
    font-size: 14px;
    padding: 12px;
  }
  
  .total-score {
    font-size: 32px;
  }
}
</style>