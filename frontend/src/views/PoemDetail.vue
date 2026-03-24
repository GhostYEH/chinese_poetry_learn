<template>
  <div class="poem-detail" :class="{ 'immersive-mode': isImmersiveMode }">
    <button class="back-btn" @click="goBack">← 返回</button>
    
    <!-- 开始学习按钮 -->
    <button v-if="!isImmersiveMode && poem" class="start-learning-btn" @click="enterImmersiveMode">
      开始学习
    </button>
    
    <!-- 沉浸式学习模式背景 -->
    <div v-if="isImmersiveMode" class="immersive-background">
      <div class="background-container">
        <img v-if="backgroundImage" :src="backgroundImage" class="background-image" />
        <div v-else-if="imageStatus === 'pending'" class="loading-overlay">
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>诗中有画，画境渐生...</p>
          </div>
        </div>
        <div v-else class="default-background">
          <!-- 默认古风背景 -->
          <div class="ancient-style-bg"></div>
        </div>
      </div>
      <button class="exit-immersive-btn" @click="exitImmersiveMode">
        退出学习
      </button>
    </div>
    
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else-if="!poem" class="empty">诗词不存在</div>
    <div v-else class="poem-layout" :class="{ 'immersive-content': isImmersiveMode }">
      <!-- 左侧栏 -->
      <div class="left-column">
        <!-- 诗词基本信息 -->
        <div class="poem-header">
          <div class="title-container">
            <h1 class="poem-title">{{ poem.title }}</h1>
            <button 
              class="collect-btn" 
              @click="toggleCollect" 
              :class="{ collected: isCollected }"
            >
              {{ isCollected ? '❤️ 已收藏' : '🤍 收藏' }}
            </button>
          </div>
          <p class="poem-author">{{ poem.author }} · {{ poem.dynasty }}</p>
        </div>
        
        <!-- 诗词正文 -->
        <div class="poem-text" :class="{ 'blurred': recitationMode }">
          <p v-for="(line, index) in poemLines" :key="index" class="poem-line">
            <template v-for="(char, charIndex) in line" :key="charIndex">
              <span 
                v-if="char >= '\u4e00' && char <= '\u9fff'"
                class="poem-char"
                @click="showCharInfo(char, charIndex, index)"
                :data-char="char"
              >
                {{ char }}
                <div v-if="selectedChar === char && selectedCharIndex === charIndex && selectedLineIndex === index" class="char-info">
                  <div v-if="charLoading && selectedChar === char" class="char-loading">
                    <div class="loading-spinner"></div>
                    <span>解析中...</span>
                  </div>
                  <div v-else>
                    <div class="char-phonetic">{{ charInfo.phonetic || '注音' }}</div>
                    <div class="char-meaning">{{ charInfo.meaning || '注释' }}</div>
                  </div>
                </div>
              </span>
              <span v-else class="poem-punctuation">{{ char }}</span>
            </template>
          </p>
          <!-- 朗读按钮 -->
          <button 
            v-if="speechSynthesisSupported"
            class="read-btn"
            @click="toggleRead"
          >
            {{ isReading ? '⏹ 停止' : '🔊 朗读' }}
          </button>
        </div>
        
        <!-- 遮挡背诵功能 -->
        <div class="recitation-section">
          <h2 class="section-title">遮挡背诵</h2>
          <div class="recitation-controls">
            <label class="switch">
              <input type="checkbox" v-model="recitationMode">
              <span class="slider"></span>
            </label>
            <span>启用遮挡背诵</span>
            <button 
              class="refresh-btn" 
              @click="refreshRecitation"
              :disabled="!recitationMode"
            >
              🔄 刷新题目
            </button>
          </div>
          <div class="recitation-content">
            <div v-if="recitationMode">
              <div v-for="(sentence, index) in splitSentences(poem.content)" :key="index" class="recitation-line">
                <div v-if="hiddenLineIndices.includes(index)" class="hidden-line">
                  <label class="sentence-label">第{{ index + 1 }}句：</label>
                  <input 
                    type="text" 
                    v-model="userInput[hiddenLineIndices.indexOf(index)]" 
                    placeholder="请输入诗句"
                    class="recitation-input"
                  >
                  <div v-if="showResult[hiddenLineIndices.indexOf(index)]" :class="isCorrect[hiddenLineIndices.indexOf(index)] ? 'correct' : 'incorrect'" class="recitation-result">
                    {{ isCorrect[hiddenLineIndices.indexOf(index)] ? '✓ 正确' : '✗ 错误，正确答案：' + sentence }}
                  </div>
                </div>
                <div v-else class="visible-line">第{{ index + 1 }}句：{{ sentence }}</div>
              </div>
            </div>
            <div v-else>
              <div v-for="(line, index) in poemLines" :key="index" class="recitation-line">
                <div class="visible-line">{{ line }}</div>
              </div>
            </div>
            <button 
              v-if="recitationMode" 
              class="submit-btn" 
              @click="checkRecitation"
            >
              📝 提交核对
            </button>
          </div>
        </div>
        
        <!-- AI背诵检测功能 -->
        <div class="recite-check-section">
          <h2 class="section-title">📝 AI背诵检测</h2>
          <div class="recite-check-content">
            <div class="form-group">
              <label for="recite-input" class="form-label">请默写全诗：</label>
              <textarea 
                id="recite-input"
                v-model="reciteInput"
                placeholder="请输入您默写的内容..."
                class="recite-input"
                rows="8"
                @focus="startRecitationMode"
                @blur="stopRecitationMode"
              ></textarea>
            </div>
            <button 
              class="btn btn-primary recite-check-btn"
              @click="checkRecite"
              :disabled="reciteLoading"
            >
              <span v-if="reciteLoading" class="loading-spinner"></span>
              {{ reciteLoading ? '检测中...' : '🎯 提交检测' }}
            </button>
            
            <!-- 检测结果 -->
            <div v-if="reciteResult" class="recite-result-section">
              <div class="recite-score">
                <h3>检测结果</h3>
                <div class="score-circle" :class="getScoreClass(reciteResult.score)">
                  <span class="score-number">{{ reciteResult.score }}%</span>
                  <span class="score-label">正确率</span>
                  <div class="score-message">{{ getScoreMessage(reciteResult.score) }}</div>
                </div>
              </div>
              
              <div class="recite-feedback">
                <div v-if="reciteResult.wrongChars.length > 0" class="feedback-item error">
                  <h4>🔴 错字 ({{ reciteResult.wrongChars.length }}个)</h4>
                  <ul class="error-list">
                    <li v-for="(error, index) in reciteResult.wrongChars" :key="index" class="error-item">
                      <span class="error-position">位置 {{ error.position }}:</span>
                      <span class="error-input">{{ error.input }}</span>
                      <span class="error-arrow">→</span>
                      <span class="error-correct">{{ error.original }}</span>
                    </li>
                  </ul>
                </div>
                
                <div v-if="reciteResult.missing.length > 0" class="feedback-item error">
                  <h4>🔵 漏字 ({{ reciteResult.missing.length }}个)</h4>
                  <ul class="error-list">
                    <li v-for="(error, index) in reciteResult.missing" :key="index" class="error-item">
                      <span class="error-position">位置 {{ error.position }}:</span>
                      <span class="error-missing">缺少 "{{ error.char }}"</span>
                    </li>
                  </ul>
                </div>
                
                <div v-if="reciteResult.extra.length > 0" class="feedback-item error">
                  <h4>🟡 多写 ({{ reciteResult.extra.length }}个)</h4>
                  <ul class="error-list">
                    <li v-for="(error, index) in reciteResult.extra" :key="index" class="error-item">
                      <span class="error-position">位置 {{ error.position }}:</span>
                      <span class="error-extra">多写 "{{ error.char }}"</span>
                    </li>
                  </ul>
                </div>
                
                <div v-if="reciteResult.aiAdvice" class="feedback-item advice">
                  <h4>🤖 AI学习建议</h4>
                  <div class="ai-advice-container">
                    <p class="ai-advice">{{ reciteResult.aiAdvice }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 右侧栏 -->
      <div class="right-column">
        <!-- AI助教聊天窗口 -->
        <div class="tutor-chat-container">
          <h2 class="section-title">💬 AI语文助教</h2>
          <div class="tutor-chat-body">
            <div class="chat-messages" ref="chatMessagesContainer">
              <div 
                v-for="(message, index) in tutorMessages" 
                :key="index"
                :class="['chat-message', message.role]"
              >
                <div class="message-content">
                  {{ message.content }}
                </div>
              </div>
              <div v-if="tutorLoading" class="chat-message bot loading">
                <div class="loading-spinner"></div>
              </div>
            </div>
            <div class="chat-input-area">
              <input 
                type="text" 
                v-model="tutorQuestion"
                placeholder="围绕这首诗提问..."
                class="tutor-input"
                @keyup.enter="sendTutorMessage"
              />
              <button 
                class="send-btn"
                @click="sendTutorMessage"
                :disabled="!tutorQuestion.trim() || tutorLoading"
              >
                发送
              </button>
            </div>
          </div>
        </div>
        
        <!-- AI赏析古诗文卡片 -->
        <div class="ai-explanation">
          <h2 class="section-title">🎨 AI赏析古诗文</h2>
          <button 
            class="ai-btn green"
            @click="getAIExplanation"
            :disabled="allAiLoading || !poem"
          >
            <span v-if="allAiLoading" class="loading-spinner"></span>
            {{ allAiLoading ? '分析中...' : '📖 生成赏析' }}
          </button>
          
          <!-- 错误信息显示 -->
          <div v-if="Object.values(aiError).some(error => error)" class="error-message">
            <p>{{ Object.values(aiError).find(error => error) }}</p>
          </div>
          
          <!-- 日常生活场景化解读 -->
          <div v-if="aiExplanations.daily_life_explanation" class="explanation-content">
            <div class="explanation-section">
              <h3>🏠 日常生活场景化解读</h3>
              <p>{{ aiExplanations.daily_life_explanation }}</p>
            </div>
          </div>
          
          <!-- 关键字词分析 -->
          <div v-if="aiExplanations.keyword_analysis" class="explanation-content">
            <div class="explanation-section">
              <h3>🔍 关键字词分析</h3>
              <p>{{ aiExplanations.keyword_analysis }}</p>
            </div>
          </div>
          
          <!-- 艺术意境解析 -->
          <div v-if="aiExplanations.artistic_conception" class="explanation-content">
            <div class="explanation-section">
              <h3>✨ 艺术意境解析</h3>
              <p>{{ aiExplanations.artistic_conception }}</p>
            </div>
          </div>
          
          <!-- 引导性思考题 -->
          <div v-if="aiExplanations.thinking_questions" class="explanation-content">
            <div class="explanation-section">
              <h3>🤔 引导性思考题</h3>
              <ul class="questions-list">
                <li 
                  v-for="(question, index) in Array.isArray(aiExplanations.thinking_questions) ? aiExplanations.thinking_questions : aiExplanations.thinking_questions.split('\n').filter(q => q.trim())" 
                  :key="index"
                  class="question-item"
                >
                  {{ question }}
                </li>
              </ul>
            </div>
          </div>
        </div>
        
        <!-- 诗人简介卡片 -->
        <div class="author-profile">
          <h2 class="section-title">👤 诗人简介</h2>
          <div class="author-content">
            <div class="author-avatar">
              <img v-if="authorAvatar" :src="authorAvatar" :alt="poem.author" class="avatar-image">
              <div v-else class="avatar-loading">加载中...</div>
            </div>
            <div class="author-info">
              <h3>{{ poem.author }}</h3>
              <p class="author-dynasty">{{ poem.dynasty }}</p>
              <p class="author-bio">{{ getAuthorBio(poem.author) }}</p>
            </div>
          </div>
        </div>
        
        <!-- 相似风格诗词卡片 -->
        <div class="similar-poems">
          <h2 class="section-title">📜 相似风格诗词</h2>
          <div class="similar-list">
            <div 
              v-for="(similarPoem, index) in similarPoems" 
              :key="index"
              class="similar-item"
              @click="navigateToPoem(similarPoem.id)"
            >
              <h4>{{ similarPoem.title }}</h4>
              <p class="similar-author">{{ similarPoem.author }} · {{ similarPoem.dynasty }}</p>
              <p class="similar-content">{{ similarPoem.content.substring(0, 50) }}...</p>
            </div>
            <div v-if="similarPoems.length === 0" class="empty">
              <p>暂无相似风格的诗词</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    

  </div>
</template>

<style scoped>
/* 沉浸式学习模式样式 */
.immersive-mode {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.start-learning-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  padding: 15px 30px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 50px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  transition: all 0.3s ease;
}

.start-learning-btn:hover {
  background-color: #45a049;
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.immersive-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.background-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.background-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: slowZoom 25s ease-in-out infinite;
}

@keyframes slowZoom {
  0% {
    transform: scale(1.0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1.0);
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-content {
  text-align: center;
  color: #333;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.default-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.ancient-style-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: 
    radial-gradient(circle at 20% 80%, rgba(255, 248, 220, 0.8) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(222, 184, 135, 0.6) 0%, transparent 50%),
    linear-gradient(135deg, #f5f5dc 0%, #e8e4c9 100%);
  background-size: 100% 100%;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.9;
}

.exit-immersive-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 10px 20px;
  background-color: rgba(255, 255, 255, 0.8);
  color: #333;
  border: none;
  border-radius: 25px;
  font-size: 14px;
  cursor: pointer;
  z-index: 1001;
  transition: all 0.3s ease;
}

.exit-immersive-btn:hover {
  background-color: rgba(255, 255, 255, 1);
  transform: translateY(-2px);
}

.immersive-content {
  position: relative;
  z-index: 10;
  background-color: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  margin: 20px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .start-learning-btn {
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    font-size: 14px;
  }
  
  .immersive-content {
    margin: 10px;
    padding: 15px;
  }
}
</style>

<script>
import io from 'socket.io-client'

export default {
  name: 'PoemDetail',
  data() {
    return {
      poem: null,
      loading: true,
      error: '',
      // 语音朗读相关状态
      speechSynthesisSupported: 'speechSynthesis' in window,
      isReading: false,
      speechUtterance: null,
      // AI讲解相关状态
      aiExplanations: {
        daily_life_explanation: null,
        keyword_analysis: null,
        artistic_conception: null,
        thinking_questions: null
      },
      aiLoading: {
        daily_life_explanation: false,
        keyword_analysis: false,
        artistic_conception: false,
        thinking_questions: false
      },
      aiError: {
        daily_life_explanation: '',
        keyword_analysis: '',
        artistic_conception: '',
        thinking_questions: ''
      },
      allAiLoading: false,
      // API请求控制器，用于取消请求
      abortController: null,
      poemAbortController: null,
      isCollected: false,
      // 遮挡背诵功能相关
      recitationMode: false,
      hiddenLineIndices: [],
      userInput: [],
      showResult: [],
      isCorrect: [],
      // 元素飞舞效果相关
      floatingElements: [],
      // 背诵检测功能相关
      reciteInput: '',
      reciteLoading: false,
      reciteResult: null,
      reciteError: '',
      // AI助教聊天相关
      showTutorChat: false,
      tutorMessages: [],
      tutorQuestion: '',
      tutorLoading: false,
      // 防止请求竞态
      currentFetchId: 0,
      // 相似诗词
      similarPoems: [],
      // 诗人头像
      authorAvatar: null,
      // 字符信息
      selectedChar: null,
      selectedCharIndex: -1,
      selectedLineIndex: -1,
      charInfo: {
        phonetic: '',
        meaning: ''
      },
      // 字符信息缓存
      charCache: {},
      // 字符加载状态
      charLoading: false,
      // 字符请求锁，防止重复请求
      charRequestLock: {},
      // 预加载状态
      preloadingChars: false,
      // 学习时长相关
      studyStartTime: null,
      studyTimer: null,
      // 图像生成相关
      imageStatus: 'idle', // idle, pending, success, fail
      backgroundImage: null,
      isImmersiveMode: false,
      isImageLoading: false,
      carouselImages: [],
      currentImageIndex: 0,
      carouselInterval: null,
      // Socket.io相关
      socket: null
    }
  },
  // 路由离开前清理资源并记录学习时长
  beforeRouteLeave(to, from, next) {
    // 计算学习时长（分钟）
    if (this.studyStartTime) {
      const endTime = Date.now()
      const studyTime = Math.round((endTime - this.studyStartTime) / 60000)
      console.log('结束学习计时:', endTime)
      console.log('学习时长:', studyTime, '分钟')
      if (studyTime > 0 && this.poem) {
        console.log('记录学习时长:', studyTime, '分钟')
        this.recordStudyTime(studyTime)
      }
    }
    
    // 如果有正在进行的AI请求，立即终止
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
      console.log('导航离开，已终止AI讲解请求')
    }

    // 如果有正在进行的诗词详情请求，立即终止
    if (this.poemAbortController) {
      this.poemAbortController.abort()
      this.poemAbortController = null
    }
    
    // 重置加载状态，确保下次进入或缓存恢复时状态正常
    this.allAiLoading = false
    Object.keys(this.aiLoading).forEach(key => {
      this.aiLoading[key] = false
    })
    
    // 重置AI助教聊天记录
    this.tutorMessages = []
    this.tutorQuestion = ''
    this.tutorLoading = false
    
    // 清理字符缓存
    this.charCache = {}
    this.selectedChar = null
    this.selectedCharIndex = -1
    this.selectedLineIndex = -1
    
    next()
  },
  watch: {
    // 当诗词变化时，重置背诵相关数据和检查收藏状态
    poem: {
      handler() {
        this.resetRecitationData()
        this.checkCollectionStatus()
      },
      deep: true
    },
    // 监听路由参数变化，当id变化时重新获取诗词数据
    $route: {
      handler() {
        this.fetchPoemDetail()
      },
      deep: true
    }
  },
  computed: {
    poemLines() {
      if (!this.poem || !this.poem.content) return []
      return this.poem.content.split('\n').filter(line => line.trim())
    }
  },
  mounted() {
    // 开始学习计时
    this.studyStartTime = Date.now()
    console.log('开始学习计时:', this.studyStartTime)
    
    this.fetchPoemDetail()
    
    // 初始化Socket.io连接
    this.initSocket()
    
    // 初始化AI助教欢迎消息
    if (this.tutorMessages.length === 0) {
      this.$nextTick(() => {
        this.tutorMessages.push({
          role: 'bot',
          content: `你好！我是你的AI语文助教，专门为你解析这首诗词。\n\n我可以帮你：\n1. 解释诗句含义和意境\n2. 分析艺术特色和写作手法\n3. 提供背诵技巧和学习建议\n4. 回答关于作者和背景的问题\n\n例如，你可以问：\n- "第一句是什么意思？"\n- "这首诗表达了什么情感？"\n- "如何更好地背诵这首诗？"\n\n请问你想了解关于这首诗的什么内容？`
        });
        // 滚动到底部
        this.scrollToBottom();
      });
    }
  },
  beforeUnmount() {
    // 清理Socket连接
    if (this.socket) {
      this.socket.disconnect()
    }
    // 清理轮播定时器
    if (this.carouselInterval) {
      clearInterval(this.carouselInterval)
    }
  },
  methods: {
    // 初始化Socket.io连接
    initSocket() {
      try {
        this.socket = io('http://localhost:3000')
        
        this.socket.on('connect', () => {
          console.log('Socket连接成功')
          // 发送认证信息
          this.socket.emit('authenticate', 'user_' + Date.now())
        })
        
        this.socket.on('disconnect', () => {
          console.log('Socket连接断开')
        })
        
        // 监听图像生成状态
        this.socket.on('image-generate-pending', (data) => {
          console.log('图像生成中:', data)
          this.imageStatus = 'pending'
        })
        
        this.socket.on('image-generate-success', (data) => {
          console.log('图像生成成功:', data)
          this.imageStatus = 'success'
          this.backgroundImage = data.url
          
          // 预加载图片
          this.preloadImage(data.url)
          
          // 如果是轮播图，添加到轮播列表
          if (data.isCarousel) {
            this.carouselImages.push(data.url)
          }
        })
        
        this.socket.on('image-generate-fail', (data) => {
          console.log('图像生成失败:', data)
          this.imageStatus = 'fail'
        })
      } catch (error) {
        console.error('Socket初始化失败:', error)
      }
    },
    // 预生成背景图
    pregenerateBackground() {
      if (!this.poem) return
      
      console.log('开始预生成背景图')
      this.imageStatus = 'pending'
      
      fetch('/api/ai/image/pregenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          poemId: this.poem.id,
          title: this.poem.title,
          author: this.poem.author,
          content: this.poem.content
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('预生成请求已发送:', data)
      })
      .catch(error => {
        console.error('预生成失败:', error)
        this.imageStatus = 'fail'
      })
    },
    // 预加载图片
    preloadImage(url) {
      const img = new Image()
      img.src = url
      img.onload = () => {
        console.log('图片预加载完成:', url)
      }
      img.onerror = () => {
        console.error('图片加载失败:', url)
        this.imageStatus = 'fail'
      }
    },
    // 进入沉浸式学习模式
    enterImmersiveMode() {
      if (this.imageStatus === 'success' && this.backgroundImage) {
        // 图片已生成，直接进入
        this.isImmersiveMode = true
        this.startCarousel()
      } else if (this.imageStatus === 'pending') {
        // 图片正在生成，显示加载态
        this.isImmersiveMode = true
        // 等待图片生成完成
      } else {
        // 图片生成失败，使用默认背景
        this.isImmersiveMode = true
      }
    },
    // 退出沉浸式学习模式
    exitImmersiveMode() {
      this.isImmersiveMode = false
      if (this.carouselInterval) {
        clearInterval(this.carouselInterval)
        this.carouselInterval = null
      }
    },
    // 开始轮播
    startCarousel() {
      // 每15-20秒生成新图
      this.carouselInterval = setInterval(() => {
        this.generateCarouselImage()
      }, Math.random() * 5000 + 15000)
    },
    // 生成轮播图
    generateCarouselImage() {
      if (!this.poem) return
      
      fetch('/api/ai/image/carousel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          poemId: this.poem.id,
          title: this.poem.title,
          author: this.poem.author,
          content: this.poem.content
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('轮播图生成请求已发送:', data)
      })
      .catch(error => {
        console.error('轮播图生成失败:', error)
      })
    },
    async fetchPoemDetail() {
      // 如果有之前的请求，先取消
      if (this.poemAbortController) {
        this.poemAbortController.abort()
      }
      this.poemAbortController = new AbortController()

      // 生成当前请求ID
      this.currentFetchId++
      const fetchId = this.currentFetchId
      
      try {
        this.loading = true
        this.error = ''
        
        // 重置所有状态
        this.poem = null
        // 重置AI讲解相关状态
        this.aiExplanations = {
          daily_life_explanation: null,
          keyword_analysis: null,
          artistic_conception: null,
          thinking_questions: null
        }
        this.aiLoading = {
          daily_life_explanation: false,
          keyword_analysis: false,
          artistic_conception: false,
          thinking_questions: false
        }
        this.aiError = {
          daily_life_explanation: '',
          keyword_analysis: '',
          artistic_conception: '',
          thinking_questions: ''
        }
        this.allAiLoading = false
        // 重置背诵相关状态
        this.recitationMode = false
        this.userInput = []
        this.showResult = []
        this.isCorrect = []
        
        let { id } = this.$route.params
        
        // 检查id是否存在，如果不存在，使用默认ID 1
        if (!id) {
          id = '1'
          console.log('诗词ID不存在，使用默认ID:', id)
        }
        
        const response = await fetch(`/api/poems/${id}`, {
          signal: this.poemAbortController.signal
        })
        
        // 如果不是最新请求，则忽略结果
        if (fetchId !== this.currentFetchId) return
        
        if (!response.ok) {
          throw new Error('获取诗词详情失败')
        }
        
        const data = await response.json()
        
        // 再次检查请求ID（因为await json()也需要时间）
        if (fetchId !== this.currentFetchId) return
        
        this.poem = data
        // 检查收藏状态
        this.checkCollectionStatus()
        // 记录学习历史
        this.recordLearning()
        // 获取相似风格诗词
        this.fetchSimilarPoems()
        // 获取诗人头像
        this.loadAuthorAvatar(data.author)
        // 预加载字符信息
        this.preloadCharInfo()
        // 预生成背景图
        this.pregenerateBackground()
      } catch (err) {
        // 忽略取消请求的错误
        if (err.name === 'AbortError') {
          return
        }

        // 如果不是最新请求，则忽略错误
        if (fetchId !== this.currentFetchId) return
        
        this.error = err.message
        console.error('获取诗词详情失败:', err)
      } finally {
        // 清理 controller
        if (this.poemAbortController && this.poemAbortController.signal.aborted) {
          this.poemAbortController = null
        }

        // 如果是最新请求，才结束加载状态
        if (fetchId === this.currentFetchId) {
          this.loading = false
        }
      }
    },
    async getAIExplanation() {
      if (!this.poem || this.allAiLoading) return
      
      try {
        // 创建新的AbortController
        this.abortController = new AbortController()
        
        // 设置所有加载状态为true
        this.allAiLoading = true
        Object.keys(this.aiLoading).forEach(key => {
          this.aiLoading[key] = true
          this.aiError[key] = ''
        })
        
        // 准备请求数据
        const requestData = {
          poem: this.poem.content,
          title: this.poem.title,
          author: this.poem.author
        }
        
        // 准备请求配置
        const requestConfig = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData),
          signal: this.abortController.signal
        }
        
        // 设置10秒超时
        const timeoutId = setTimeout(() => this.abortController.abort(), 10000);
        
        try {
          // 使用批量API端点，只发送一个请求
          const response = await fetch('/api/ai/explainPoem/batch', requestConfig)
          
          // 清除超时
          clearTimeout(timeoutId);
          
          // 检查响应是否成功
          if (!response.ok) {
            throw new Error('获取AI讲解失败')
          }
          
          // 解析响应数据
          const batchData = await response.json()
          
          // 更新AI讲解数据
          this.aiExplanations.daily_life_explanation = batchData.daily_life_explanation
          this.aiExplanations.keyword_analysis = batchData.keyword_analysis
          this.aiExplanations.artistic_conception = batchData.artistic_conception
          this.aiExplanations.thinking_questions = batchData.thinking_questions
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (err) {
        // 忽略取消请求的错误
        if (err.name === 'AbortError') {
          console.log('AI讲解请求已取消')
        } else {
          console.error('获取AI讲解失败:', err)
          // 设置所有错误状态
          Object.keys(this.aiError).forEach(key => {
            this.aiError[key] = '获取AI讲解失败'
          })
        }
      } finally {
        // 设置所有加载状态为false
        this.allAiLoading = false
        Object.keys(this.aiLoading).forEach(key => {
          this.aiLoading[key] = false
        })
      }
    },
    goBack() {
      // 取消当前的AI讲解请求
      if (this.abortController) {
        this.abortController.abort()
        this.abortController = null
      }
      this.$router.back()
    },
    async checkRecite() {
      if (!this.reciteInput.trim()) {
        alert('请输入默写内容')
        return
      }
      
      // 检查是否登录
      const token = localStorage.getItem('token')
      if (!token) {
        // 未登录，存储当前路径并跳转到登录页
        localStorage.setItem('redirectPath', this.$route.fullPath)
        this.$router.push('/login')
        return
      }
      
      try {
        this.reciteLoading = true
        this.reciteError = ''
        
        const response = await fetch('/api/ai/recite-check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            original: this.poem.content,
            input: this.reciteInput,
            poem_id: this.poem.id,
            poem_title: this.poem.title,
            poem_author: this.poem.author
          })
        })
        
        if (!response.ok) {
          throw new Error('检测失败，请稍后重试')
        }
        
        const data = await response.json()
        this.reciteResult = data
        
        // 记录背诵行为和得分
        if (data.score !== undefined) {
          await this.recordLearning('recite', data.score)
        }
      } catch (err) {
        this.reciteError = err.message
        console.error('背诵检测失败:', err)
      } finally {
        this.reciteLoading = false
      }
    },
    // 归一化文本，只保留中文字符
    normalizeText(text) {
      if (!text) return ''
      let result = ''
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        // 检查是否是中文字符
        if (char >= '\u4e00' && char <= '\u9fff') {
          result += char
        }
      }
      return result
    },
    
    // 检查背诵结果
    async checkRecitation() {
      // 检查是否登录
      const token = localStorage.getItem('token')
      if (!token) {
        // 未登录，存储当前路径并跳转到登录页
        localStorage.setItem('redirectPath', this.$route.fullPath)
        this.$router.push('/login')
        return
      }
      
      try {
        this.showResult = this.hiddenLineIndices.map(() => true)
        
        // 准备原始诗句和用户输入
        const sentences = this.splitSentences(this.poem.content)
        const original = sentences.join('，')
        const userInputText = sentences.map((sentence, index) => {
          const inputIndex = this.hiddenLineIndices.indexOf(index)
          return inputIndex !== -1 ? this.userInput[inputIndex] : sentence
        }).join('，')
        
        // 调用AI背诵检测API
        const response = await fetch('/api/ai/recite-check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            original: original,
            input: userInputText,
            poem_id: this.poem.id,
            poem_title: this.poem.title,
            poem_author: this.poem.author
          })
        })
        
        if (!response.ok) {
          throw new Error('检测失败，请稍后重试')
        }
        
        const data = await response.json()
        
        // 处理AI检测结果
        this.reciteResult = data
        
        // 标记用户输入是否正确
        this.isCorrect = this.hiddenLineIndices.map((index, i) => {
          const sentence = sentences[index]
          const userInput = this.userInput[i]
          const normalizedUserInput = this.normalizeText(userInput)
          const normalizedSentence = this.normalizeText(sentence)
          return normalizedUserInput === normalizedSentence
        })
        
        // 触发元素飞舞效果
        this.triggerFloatingElements()
      } catch (error) {
        console.error('背诵检测失败:', error)
        // 失败时使用本地检测
        this.showResult = this.hiddenLineIndices.map(() => true)
        this.isCorrect = this.hiddenLineIndices.map((index, i) => {
          const sentences = this.splitSentences(this.poem.content)
          const normalizedUserInput = this.normalizeText(this.userInput[i])
          const normalizedSentence = this.normalizeText(sentences[index])
          return normalizedUserInput === normalizedSentence
        })
        this.triggerFloatingElements()
      }
    },
    
    // 重置背诵相关数据
    resetRecitationData() {
      this.refreshRecitation()
    },
    
    // 按标点符号分割句子
    splitSentences(content) {
      // 按标点符号分割句子
      return content.split(/[，。！？；]/).filter(sentence => sentence.trim())
    },
    
    // 刷新背诵题目
    refreshRecitation() {
      if (!this.poem || !this.poem.content) {
        this.hiddenLineIndices = []
        this.userInput = []
        this.showResult = []
        this.isCorrect = []
        return
      }
      
      // 按标点符号分割句子
      const sentences = this.splitSentences(this.poem.content)
      if (sentences.length === 0) {
        this.hiddenLineIndices = []
        this.userInput = []
        this.showResult = []
        this.isCorrect = []
        return
      }
      
      // 随机选择1-2个句子进行挖空
      const hiddenCount = Math.min(2, sentences.length)
      const allIndices = Array.from({ length: sentences.length }, (_, i) => i)
      
      // 随机打乱索引并选择前hiddenCount个
      const shuffledIndices = allIndices.sort(() => Math.random() - 0.5)
      this.hiddenLineIndices = shuffledIndices.slice(0, hiddenCount)
      
      // 初始化用户输入和结果数组
      this.userInput = new Array(hiddenCount).fill('')
      this.showResult = new Array(hiddenCount).fill(false)
      this.isCorrect = new Array(hiddenCount).fill(false)
    },
    
    // 触发元素飞舞效果
    triggerFloatingElements() {
      // 清空现有元素
      this.floatingElements = []
      
      // 生成新的飞舞元素
      const elements = ['春', '夏', '秋', '冬', '风', '花', '雪', '月', '山', '水', '云', '霞', '诗', '词', '歌', '赋']
      
      for (let i = 0; i < 12; i++) {
        this.floatingElements.push({
          text: elements[Math.floor(Math.random() * elements.length)],
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: 12 + Math.random() * 16,
          duration: 10 + Math.random() * 20,
          delay: Math.random() * 5,
          opacity: 0.3 + Math.random() * 0.7
        })
      }
      
      // 10秒后清除元素
      setTimeout(() => {
        this.floatingElements = []
      }, 10000)
    },
    // 切换收藏状态
    toggleCollect() {
      // 检查是否登录
      const token = localStorage.getItem('token')
      if (!token) {
        // 未登录，存储当前路径并跳转到登录页
        localStorage.setItem('redirectPath', this.$route.fullPath)
        this.$router.push('/login')
        return
      }
      
      // 已登录，执行收藏操作
      this.isCollected = !this.isCollected
      
      // 调用收藏API
      const fetchUrl = this.isCollected ? '/api/collections' : `/api/collections/${this.poem.id}`
      const method = this.isCollected ? 'POST' : 'DELETE'
      
      fetch(fetchUrl, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: this.isCollected ? JSON.stringify({ poem_id: this.poem.id }) : undefined
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('操作失败')
        }
        return response.json()
      })
      .then(data => {
        console.log('收藏操作成功:', data)
      })
      .catch(err => {
        console.error('收藏操作失败:', err)
        // 恢复原状态
        this.isCollected = !this.isCollected
        alert('操作失败，请稍后重试')
      })
    },
    // 检查诗词是否已收藏
    checkCollectionStatus() {
      if (!this.poem) return
      
      // 检查是否登录
      const token = localStorage.getItem('token')
      if (token) {
        // 已登录，从API获取收藏状态
        fetch(`/api/collections/check/${this.poem.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        .then(response => {
          if (response.ok) {
            return response.json()
          }
          return { success: false, data: false }
        })
        .then(data => {
          this.isCollected = data.success ? data.data.is_collected : false
        })
        .catch(error => {
          console.error('检查收藏状态失败:', error)
          this.isCollected = false
        })
      } else {
        // 未登录，默认为未收藏
        this.isCollected = false
      }
    },
    
    // 记录学习时长
    recordStudyTime(studyTime) {
      if (!this.poem) {
        console.error('记录学习时长失败: 诗词信息不存在')
        return
      }
      
      // 检查是否登录
      const token = localStorage.getItem('token')
      if (token) {
        console.log('已登录，发送学习时长到后端:', studyTime, '分钟')
        // 已登录，发送学习时长到后端
        fetch('/api/learning/record', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            poem_id: this.poem.id,
            action: 'study_time',
            score: studyTime
          })
        })
        .then(response => {
          console.log('学习时长记录响应状态:', response.status)
          if (response.ok) {
            return response.json()
          }
          throw new Error('请求失败')
        })
        .then(data => {
          console.log('学习时长记录响应数据:', data)
          if (data.success) {
            console.log('学习时长记录成功:', studyTime, '分钟')
          } else {
            console.error('学习时长记录失败:', data.message)
          }
        })
        .catch(error => {
          console.error('学习时长记录失败:', error)
        })
      } else {
        console.log('未登录，不记录学习时长')
      }
    },
    // 记录学习历史
    async recordLearning(action = 'view', score = null) {
      if (!this.poem) {
        console.error('记录学习行为失败: 诗词信息不存在')
        return
      }
      
      console.log('记录学习行为:', action, score)
      
      // 检查是否登录
      const token = localStorage.getItem('token')
      if (token) {
        console.log('已登录，发送学习行为到后端')
        // 已登录，发送学习行为到后端
        try {
          const response = await fetch('/api/learn/record', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              poem_id: this.poem.id,
              action,
              score
            })
          })
          
          console.log('学习行为记录响应状态:', response.status)
          if (response.ok) {
            const data = await response.json()
            console.log('学习行为记录响应数据:', data)
            if (data.success) {
              console.log('学习行为记录成功:', action, score)
            } else {
              console.error('学习行为记录失败:', data.message)
            }
          } else {
            // 网络请求成功但返回错误状态，不抛出错误，避免影响用户体验
            console.error('学习行为记录失败: 服务器返回错误状态', response.status)
          }
        } catch (error) {
          // 网络请求失败，不抛出错误，避免影响用户体验
          console.error('学习行为记录失败:', error)
        }
      } else {
        console.log('未登录，不记录学习行为到后端')
      }
      
      // 同时保存到本地存储作为备份
      const learnedPoems = JSON.parse(localStorage.getItem('learnedPoems') || '[]')
      const alreadyLearned = learnedPoems.some(record => record.id === this.poem.id)
      
      if (!alreadyLearned) {
        learnedPoems.push({
          id: this.poem.id,
          timestamp: new Date().toISOString()
        })
        localStorage.setItem('learnedPoems', JSON.stringify(learnedPoems))
        console.log('学习行为保存到本地存储')
      }
    },
    // 根据得分获取样式类
    getScoreClass(score) {
      if (score >= 90) return 'score-excellent';
      if (score >= 70) return 'score-good';
      if (score >= 50) return 'score-average';
      return 'score-poor';
    },
    // 根据得分获取消息
    getScoreMessage(score) {
      if (score >= 90) return '🎉 太棒了！';
      if (score >= 70) return '👍 做得不错！';
      if (score >= 50) return '💪 继续努力！';
      return '📚 加油！';
    },
    // 切换朗读状态
    toggleRead() {
      if (!this.speechSynthesisSupported) {
        alert('您的浏览器不支持语音朗读功能');
        return;
      }
      
      if (this.isReading) {
        // 直接停止朗读
        speechSynthesis.cancel();
        this.isReading = false;
      } else {
        // 开始朗读
        this.startReading();
      }
    },
    // 开始朗读诗词
    startReading() {
      if (!this.poem || !this.poem.content) return;
      
      // 取消之前的朗读
      speechSynthesis.cancel();
      
      let text = this.poem.content;
      // 预处理：规范化标点，确保每句有停顿
      text = text.replace(/([。！？；])\s*/g, '$1，').replace(/\n/g, '。');
      
      // 分割成句子数组（按。！？；, 分）
      const sentences = text.split(/(?<=[。！？；，])/).filter(s => s.trim());
      
      let queue = [...sentences]; // 队列朗读
      
      const speakNext = () => {
        if (queue.length === 0) {
          this.isReading = false;
          return;
        }
        
        const utterance = new SpeechSynthesisUtterance(queue.shift());
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8;    // 稍慢，更有节奏
        utterance.pitch = 1.1;   // 略高，模拟吟诵
        utterance.volume = 1;
        
        // 优先选柔和女声（名字因系统而异）
        const voices = speechSynthesis.getVoices();
        const preferred = voices.find(v => 
          v.name.includes('Xiaoxiao') || 
          v.name.includes('Yunxi') || 
          v.name.includes('女') ||
          v.name.includes('Chinese')
        );
        if (preferred) utterance.voice = preferred;
        
        // 句末加长停顿
        utterance.onend = () => {
          setTimeout(speakNext, 600); // 每句后停0.6秒
        };
        
        speechSynthesis.speak(utterance);
      };
      
      this.isReading = true;
      speakNext();
    },

    // 滚动聊天窗口到底部
    scrollToBottom() {
      if (this.$refs.chatMessagesContainer) {
        const container = this.$refs.chatMessagesContainer;
        container.scrollTop = container.scrollHeight;
      }
    },
    // 发送AI助教消息
    async sendTutorMessage() {
      if (!this.tutorQuestion.trim() || this.tutorLoading) return;
      
      const question = this.tutorQuestion.trim();
      // 添加用户消息
      this.tutorMessages.push({
        role: 'user',
        content: question
      });
      this.tutorQuestion = '';
      this.tutorLoading = true;
      
      // 发送消息后滚动到底部
      this.$nextTick(() => {
        this.scrollToBottom();
      });
      
      try {
        // 准备历史消息
        const history = this.tutorMessages.slice(-6).map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        
        // 发送请求
        const response = await fetch('/api/ai/tutor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            poem: this.poem.content,
            title: this.poem.title,
            author: this.poem.author,
            question: question,
            history: history
          })
        });
        
        if (!response.ok) {
          throw new Error('获取AI回答失败');
        }
        
        const data = await response.json();
        // 添加AI回答，确保长度不超过100字
        let answer = data.data.answer;
        if (answer.length > 100) {
          answer = answer.substring(0, 97) + '...';
        }
        this.tutorMessages.push({
          role: 'bot',
          content: answer
        });
      } catch (error) {
        console.error('发送AI助教消息失败:', error);
        // 添加错误消息
        this.tutorMessages.push({
          role: 'bot',
          content: '抱歉，我暂时无法回答你的问题，请稍后再试。'
        });
      } finally {
        this.tutorLoading = false;
        // 接收回复后滚动到底部
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      }
    },
    
    // 开始背诵模式（输入框获得焦点时）
    startRecitationMode() {
      this.recitationMode = true;
    },
    
    // 停止背诵模式（输入框失去焦点时）
    stopRecitationMode() {
      // 只有当输入框为空时才停止背诵模式
      // 这样用户在切换到其他输入框时原诗仍然保持模糊
      if (!this.reciteInput.trim()) {
        this.recitationMode = false;
      }
    },
    
    // 获取诗人头像（暂时禁用API调用，使用默认图片）
    async getAuthorAvatar(author) {
      try {
        // 检查缓存
        const cacheKey = `author_avatar_${author}`;
        const cachedAvatar = localStorage.getItem(cacheKey);
        if (cachedAvatar) {
          return cachedAvatar;
        }
        
        // 直接使用默认头像，避免API速率限制
        const defaultAvatar = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(author + ' 中国古代诗人 肖像画 风格 水墨画')}&image_size=square`;
        
        // 缓存默认头像URL
        localStorage.setItem(cacheKey, defaultAvatar);
        
        return defaultAvatar;
      } catch (error) {
        // 网络请求失败，使用默认头像
        console.error('获取诗人头像失败:', error);
        return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(author + ' 中国古代诗人 肖像画 风格 水墨画')}&image_size=square`;
      }
    },
    
    // 获取诗人简介
    getAuthorBio(author) {
      // 这里可以根据诗人名字返回简介，实际项目中可以从API获取
      const authorBios = {
        '李白': '李白（701年—762年），字太白，号青莲居士，又号“谪仙人”，唐代伟大的浪漫主义诗人，被后人誉为“诗仙”，与杜甫并称为“李杜”。其诗风格豪放飘逸，想象丰富，语言流转自然，音律和谐多变。',
        '杜甫': '杜甫（712年—770年），字子美，自号少陵野老，唐代伟大的现实主义诗人，与李白合称“李杜”。被后人称为“诗圣”，他的诗被称为“诗史”。其诗风格沉郁顿挫，反映社会现实，关心民生疾苦。',
        '孟浩然': '孟浩然（689年—740年），字浩然，号孟山人，唐代著名的山水田园派诗人，世称“孟襄阳”。其诗风格清淡自然，多写山水田园风光和隐居生活。',
        '王维': '王维（701年—761年），字摩诘，号摩诘居士，唐代诗人、画家，以山水田园诗著称，有“诗佛”之称。其诗风格清新淡雅，意境深远，常融入禅意。',
        '杜牧': '杜牧（803年—852年），字牧之，号樊川居士，唐代杰出的诗人、散文家，与李商隐并称“小李杜”。其诗风格俊爽清丽，多写咏史、抒情之作。',
        '李商隐': '李商隐（约813年—约858年），字义山，号玉谿生，唐代著名诗人，与杜牧合称“小李杜”。其诗风格深情绵邈，意象朦胧，多写爱情、身世之感。',
        '王之涣': '王之涣（688年—742年），字季凌，唐代诗人，以边塞诗著称。其诗风格雄奇豪放，意境开阔，代表作有《登鹳雀楼》等。',
        '刘禹锡': '刘禹锡（772年—842年），字梦得，唐代文学家、哲学家，有“诗豪”之称。其诗风格雄健爽朗，多写时事、怀古之作。',
        '白居易': '白居易（772年—846年），字乐天，号香山居士，唐代现实主义诗人，与元稹共同倡导新乐府运动。其诗风格通俗晓畅，多反映民生疾苦。',
        '柳宗元': '柳宗元（773年—819年），字子厚，唐代文学家、哲学家、散文家和思想家，唐宋八大家之一。其诗风格清峭幽远，多写山水游记和寓言。',
        '高适': '高适（704年—765年），字达夫，唐代边塞诗人，与岑参并称“高岑”。其诗风格雄浑悲壮，多写边塞风光和军旅生活。',
        '王昌龄': '王昌龄（698年—757年），字少伯，唐代边塞诗人，有“七绝圣手”之称。其诗风格雄浑悲壮，多写边塞生活和闺怨。'
      };
      return authorBios[author] || `${author}是中国古代著名诗人，具体生平事迹待补充。`;
    },
    
    // 获取相似风格诗词
    async fetchSimilarPoems() {
      if (!this.poem) return;
      
      try {
        // 这里可以根据诗人或风格获取相似诗词，实际项目中可以从API获取
        // 这里使用模拟数据
        const response = await fetch('/api/poems');
        const allPoems = await response.json();
        
        // 基于风格相似性获取诗词
        // 这里简单实现：根据朝代和标签来判断风格相似性
        this.similarPoems = allPoems
          .filter(p => p.id !== this.poem.id)
          .map(poem => {
            let similarity = 0;
            
            // 朝代相同，增加相似度
            if (poem.dynasty === this.poem.dynasty) {
              similarity += 0.5;
            }
            
            // 标签相似，增加相似度
            if (poem.tags && this.poem.tags) {
              const poemTags = Array.isArray(poem.tags) ? poem.tags : poem.tags.split(',').map(tag => tag.trim());
              const currentTags = Array.isArray(this.poem.tags) ? this.poem.tags : this.poem.tags.split(',').map(tag => tag.trim());
              const commonTags = poemTags.filter(tag => currentTags.includes(tag));
              similarity += commonTags.length * 0.2;
            }
            
            return { ...poem, similarity };
          })
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 3);
      } catch (error) {
        console.error('获取相似诗词失败:', error);
        this.similarPoems = [];
      }
    },
    
    // 导航到诗词详情页
    navigateToPoem(poemId) {
      this.$router.push(`/poem/${poemId}`);
    },
    
    // 加载诗人头像
    async loadAuthorAvatar(author) {
      if (!author) return;
      this.authorAvatar = await this.getAuthorAvatar(author);
    },
    
    // 预加载字符信息
    async preloadCharInfo() {
      if (!this.poem || !this.poem.content) return;
      
      this.preloadingChars = true;
      try {
        // 提取诗词中的所有汉字
        const chars = new Set();
        for (const line of this.poemLines) {
          for (const char of line) {
            if (char >= '\u4e00' && char <= '\u9fff') {
              chars.add(char);
            }
          }
        }
        
        const charArray = Array.from(chars);
        
        // 检查是否所有字符都已在缓存中
        const allCached = charArray.every(char => {
          return this.charCache[char] || this.getCharFromLocalCache(char);
        });
        
        if (allCached) {
          // 所有字符都已缓存，无需预加载
          console.log('所有字符信息已缓存，跳过预加载');
          // 将本地缓存同步到内存缓存
          charArray.forEach(char => {
            const cachedInfo = this.getCharFromLocalCache(char);
            if (cachedInfo) {
              this.charCache[char] = cachedInfo;
            }
          });
          this.preloadingChars = false;
          return;
        }
        
        console.log('开始预加载字符信息，共', charArray.length, '个汉字');
        
        // 使用批量接口预加载所有字符信息
        try {
          const response = await fetch('/api/ai/char-info/batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              poem: this.poem.content,
              title: this.poem.title,
              author: this.poem.author
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.results) {
              // 处理批量结果
              for (const [char, content] of Object.entries(data.results)) {
                try {
                  const charInfo = JSON.parse(content);
                  // 存储到内存缓存
                  this.charCache[char] = charInfo;
                  // 存储到本地缓存
                  this.saveCharToLocalCache(char, charInfo);
                } catch (parseError) {
                  console.error('解析字符信息失败:', parseError);
                }
              }
              console.log('批量预加载字符信息完成');
            }
          } else {
            console.error('批量预加载字符信息失败:', response.status);
            // 批量接口失败时，回退到逐个预加载
            for (const char of charArray) {
              if (!this.charCache[char] && !this.getCharFromLocalCache(char)) {
                await this.fetchCharInfo(char);
              }
            }
          }
        } catch (error) {
          console.error('批量预加载字符信息失败:', error);
          // 批量接口失败时，回退到逐个预加载
          for (const char of charArray) {
            if (!this.charCache[char] && !this.getCharFromLocalCache(char)) {
              await this.fetchCharInfo(char);
            }
          }
        }
      } catch (error) {
        console.error('预加载字符信息失败:', error);
      } finally {
        this.preloadingChars = false;
      }
    },
    
    // 显示字符信息
    async showCharInfo(char, charIndex, lineIndex) {
      // 取消之前的选中状态
      if (this.selectedChar === char && this.selectedCharIndex === charIndex && this.selectedLineIndex === lineIndex) {
        this.selectedChar = null;
        this.selectedCharIndex = -1;
        this.selectedLineIndex = -1;
        return;
      }
      
      // 设置新的选中状态
      this.selectedChar = char;
      this.selectedCharIndex = charIndex;
      this.selectedLineIndex = lineIndex;
      
      // 检查本地缓存
      const cachedInfo = this.getCharFromLocalCache(char);
      if (cachedInfo) {
        this.charInfo = cachedInfo;
        this.charCache[char] = cachedInfo;
        return;
      }
      
      // 检查内存缓存
      if (this.charCache[char]) {
        this.charInfo = this.charCache[char];
        return;
      }
      
      // 获取字符信息
      await this.fetchCharInfo(char);
    },
    
    // 从本地存储获取字符信息
    getCharFromLocalCache(char) {
      try {
        const cacheKey = `char_info_${char}`;
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          // 检查是否过期（7天）
          const now = Date.now();
          if (parsedData.timestamp && (now - parsedData.timestamp) < 7 * 24 * 60 * 60 * 1000) {
            return {
              phonetic: parsedData.phonetic,
              meaning: parsedData.meaning
            };
          } else {
            // 过期，删除缓存
            localStorage.removeItem(cacheKey);
          }
        }
      } catch (error) {
        console.error('读取本地缓存失败:', error);
      }
      return null;
    },
    
    // 保存字符信息到本地存储
    saveCharToLocalCache(char, charInfo) {
      try {
        const cacheKey = `char_info_${char}`;
        const data = {
          ...charInfo,
          timestamp: Date.now()
        };
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (error) {
        console.error('保存本地缓存失败:', error);
      }
    },
    
    // 获取字符信息
    async fetchCharInfo(char) {
      // 检查请求锁，防止重复请求
      if (this.charRequestLock[char]) {
        // 等待请求完成
        while (this.charRequestLock[char]) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        // 请求完成后，从缓存获取结果
        if (this.charCache[char]) {
          this.charInfo = this.charCache[char];
        }
        return;
      }
      
      // 设置请求锁
      this.charRequestLock[char] = true;
      this.charLoading = true;
      
      try {
        // 构建 prompt 格式："xxx故事中的xxxx句中的x字的读音和释义"
        const poemTitle = this.poem?.title || '古诗';
        // 找到包含该字符的诗句
        let currentLine = '';
        for (const line of this.poemLines) {
          if (line.includes(char)) {
            currentLine = line;
            break;
          }
        }
        const prompt = `${poemTitle}中的"${currentLine}"句中的"${char}"字的读音和释义`;
        
        // 调用 API 获取字符信息
        try {
          const response = await fetch('/api/ai/char-info', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt })
          });
          
          if (response.ok) {
            const data = await response.json();
            // 解析 API 响应，提取读音和释义
            if (data.content) {
              try {
                // 尝试解析JSON格式的响应
                const charInfo = JSON.parse(data.content);
                
                // 存储到内存缓存
                this.charCache[char] = charInfo;
                // 存储到本地缓存
                this.saveCharToLocalCache(char, charInfo);
                // 更新当前显示的字符信息
                this.charInfo = charInfo;
              } catch (parseError) {
                console.error('解析字符信息失败:', parseError);
                // 解析失败，使用默认值
                const charInfo = {
                  phonetic: '未知',
                  meaning: '解析失败，请重试'
                };
                this.charCache[char] = charInfo;
                this.charInfo = charInfo;
              }
            } else {
              // API 响应格式不正确，使用默认值
              const charInfo = {
                phonetic: '未知',
                meaning: '暂无注释'
              };
              this.charCache[char] = charInfo;
              this.charInfo = charInfo;
            }
          } else {
            // API 调用失败，使用默认值
            const charInfo = {
              phonetic: '未知',
              meaning: '解析失败，请重试'
            };
            this.charCache[char] = charInfo;
            this.charInfo = charInfo;
          }
        } catch (error) {
          console.error('API调用失败:', error);
          // 网络错误，使用默认值
          const charInfo = {
            phonetic: '未知',
            meaning: '网络错误，请重试'
          };
          this.charCache[char] = charInfo;
          this.charInfo = charInfo;
        }
      } catch (error) {
        console.error('获取字符信息失败:', error);
        const charInfo = {
          phonetic: '未知',
          meaning: '获取失败，请重试'
        };
        this.charCache[char] = charInfo;
        this.charInfo = charInfo;
      } finally {
        // 释放请求锁
        this.charRequestLock[char] = false;
        this.charLoading = false;
      }
    }
  }
}
</script>

<style scoped>
.poem-detail {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

/* 双栏布局 */
.poem-layout {
  display: flex;
  gap: 40px;
  margin-top: 20px;
  align-items: flex-start;
}

.left-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.right-column {
  flex: 0 0 40%;
  min-width: 350px;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .poem-layout {
    flex-direction: column;
  }
  
  .right-column {
    flex: 1;
    min-width: 100%;
  }
}

@media (max-width: 768px) {
  .poem-detail {
    padding: 15px;
  }
  
  .poem-layout {
    gap: 20px;
  }
  
  .left-column,
  .right-column {
    gap: 20px;
  }
}

.back-btn {
  padding: 8px 16px;
  font-size: 14px;
  background: rgba(33, 150, 243, 0.2);
  color: var(--secondary-color);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 20px;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(33, 150, 243, 0.15);
}

.back-btn:hover {
  background: rgba(33, 150, 243, 0.3);
  border-color: rgba(33, 150, 243, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(33, 150, 243, 0.25);
}

.poem-header {
  margin-bottom: 30px;
}

.title-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 10px;
}

.collect-btn {
  padding: 10px 20px;
  font-size: 14px;
  background: rgba(244, 67, 54, 0.2);
  color: var(--danger-color);
  border: 1px solid rgba(244, 67, 54, 0.3);
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(244, 67, 54, 0.15);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.collect-btn:hover {
  background: rgba(244, 67, 54, 0.3);
  border-color: rgba(244, 67, 54, 0.5);
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 8px 24px rgba(244, 67, 54, 0.25);
}

.collect-btn:active {
  transform: translateY(-1px) scale(0.98);
}

.collect-btn.collected {
  background: rgba(244, 67, 54, 0.8);
  color: white;
  border-color: rgba(244, 67, 54, 0.8);
  box-shadow: 0 8px 24px rgba(244, 67, 54, 0.4);
  animation: pulse 0.6s ease-in-out;
}

.collect-btn.collected:hover {
  background: rgba(244, 67, 54, 0.9);
  border-color: rgba(244, 67, 54, 0.9);
  box-shadow: 0 10px 28px rgba(244, 67, 54, 0.5);
}

.char-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  gap: 8px;
  color: var(--secondary-color);
}

.char-loading .loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(33, 150, 243, 0.3);
  border-top: 2px solid var(--secondary-color);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

.collect-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.collect-btn:hover::before {
  width: 300px;
  height: 300px;
}

.collect-btn:active::before {
  width: 400px;
  height: 400px;
  transition: width 0.2s, height 0.2s;
}

.poem-title {
  font-size: 28px;
  color: #333;
  margin-bottom: 12px;
  font-weight: bold;
}

.poem-author {
  font-size: 16px;
  color: #666;
}

.poem-text {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 40px;
  margin-bottom: 30px;
  font-family: 'SimSun', 'STSong', serif;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}

/* 朗读按钮样式 */
.read-btn {
  position: absolute;
  bottom: 20px;
  right: 20px;
  padding: 10px 20px;
  font-size: 14px;
  background: rgba(205, 133, 63, 0.2);
  color: #8b4513;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
  white-space: nowrap;
  z-index: 10;
}

.read-btn:hover {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.25);
}

.poem-text::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.poem-text:hover::before {
  transform: scaleX(1);
}

.poem-text:hover {
  transform: translateY(-4px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.poem-text.blurred {
  filter: blur(5px);
  animation: blurIn 0.5s ease-in-out;
}

@keyframes blurIn {
  from {
    filter: blur(0px);
  }
  to {
    filter: blur(5px);
  }
}

.poem-line {
  font-size: 20px;
  color: #333;
  line-height: 2.5;
  text-align: center;
  margin: 10px 0;
  letter-spacing: 1px;
}

.poem-char {
  position: relative;
  cursor: pointer;
  padding: 0 2px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.poem-char:hover {
  background-color: rgba(255, 255, 0, 0.2);
}

.poem-punctuation {
  margin: 0 2px;
}

.char-info {
  position: absolute;
  top: -120px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--glass-background);
  backdrop-filter: blur(calc(var(--glass-blur) + 8px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 8px));
  color: #333;
  padding: 12px;
  border-radius: 12px;
  z-index: 1000;
  min-width: 160px;
  text-align: left;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  word-wrap: break-word;
  max-width: 200px;
}

.char-info::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid rgba(255, 255, 255, 0.5);
}

.char-phonetic {
  font-size: 16px;
  margin-bottom: 8px;
  color: var(--primary-color);
  font-weight: 600;
}

.char-meaning {
  font-size: 13px;
  line-height: 1.4;
  color: #555;
}

/* AI助教聊天容器样式 */
.tutor-chat-container {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: var(--transition);
}

.tutor-chat-container:hover {
  transform: translateY(-4px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.tutor-chat-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 700px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 550px;
  padding: 16px;
  background: rgba(255, 252, 240, 0.2);
  border-radius: var(--border-radius);
  border: 1px solid var(--glass-border);
}

.chat-message {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 18px;
  position: relative;
}

.chat-message.user {
  align-self: flex-end;
  background: rgba(139, 69, 19, 0.1);
  border: 1px solid rgba(139, 69, 19, 0.2);
  border-radius: 18px 18px 4px 18px;
}

.chat-message.bot {
  align-self: flex-start;
  background: rgba(255, 252, 240, 0.8);
  border: 1px solid var(--glass-border);
  border-radius: 4px 18px 18px 18px;
}

.message-content {
  font-size: 14px;
  line-height: 1.4;
  color: #333;
}

.chat-input-area {
  display: flex;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
}

.tutor-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  background: rgba(255, 252, 240, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-size: 14px;
  transition: all 0.3s ease;
}

.tutor-input:focus {
  outline: none;
  border-color: rgba(76, 175, 80, 0.5);
  box-shadow: 0 8px 16px rgba(76, 175, 80, 0.15);
  transform: translateY(-2px);
  background: rgba(255, 252, 240, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.send-btn {
  padding: 12px 20px;
  background: rgba(76, 175, 80, 0.2);
  color: var(--primary-color);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.15);
}

.send-btn:hover:not(:disabled) {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.25);
}

.send-btn:disabled {
  background: rgba(76, 175, 80, 0.1);
  color: var(--primary-color);
  border-color: rgba(76, 175, 80, 0.2);
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.1);
  opacity: 0.6;
}

/* 遮挡背诵功能样式 */
.recitation-section {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  margin-bottom: 30px;
  position: relative;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
}

.recitation-section:hover {
  transform: translateY(-4px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.recitation-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.refresh-btn {
  padding: 8px 16px;
  font-size: 14px;
  background: rgba(255, 152, 0, 0.2);
  color: var(--accent-color);
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.15);
  margin-left: auto;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(255, 152, 0, 0.3);
  border-color: rgba(255, 152, 0, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 152, 0, 0.25);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.15);
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #4CAF50;
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.recitation-content {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
}

.recitation-content:hover {
  transform: translateY(-2px);
  backdrop-filter: blur(calc(var(--glass-blur) + 2px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 2px));
  box-shadow: 0 8px 16px rgba(31, 38, 135, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.recitation-pair {
  margin-bottom: 24px;
  padding: 16px;
  background-color: #f9f9f9;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
}

.recitation-prompt {
  margin-bottom: 12px;
  padding: 12px;
  background-color: rgba(76, 175, 80, 0.1);
  border-radius: 4px;
}

.prompt-label {
  font-weight: bold;
  color: #4CAF50;
  margin-right: 8px;
}

.prompt-text {
  font-size: 16px;
  color: #333;
  font-family: 'SimSun', 'STSong', serif;
  line-height: 1.6;
}

.recitation-line {
  margin-bottom: 15px;
}

.hidden-line {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recitation-input {
  padding: 12px 16px;
  font-size: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.3s;
  font-family: 'SimSun', 'STSong', serif;
  width: 100%;
}

.recitation-input:focus {
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.recitation-result {
  font-size: 14px;
  padding: 10px 16px;
  border-radius: 6px;
  margin-top: 4px;
}

.correct {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.incorrect {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.visible-content {
  padding: 16px;
}

.visible-line {
  font-size: 16px;
  color: #333;
  line-height: 1.8;
  font-family: 'SimSun', 'STSong', serif;
  margin-bottom: 12px;
}

.submit-btn {
  padding: 12px 24px;
  font-size: 16px;
  background: rgba(76, 175, 80, 0.2);
  color: var(--primary-color);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 12px;
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.15);
  margin-top: 16px;
  width: 100%;
  max-width: 200px;
  margin-left: auto;
  font-family: 'SimSun', 'STSong', serif;
  letter-spacing: 1px;
}

.submit-btn:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.25);
}

/* 元素飞舞效果样式 */
.floating-elements {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
  overflow: hidden;
}

.floating-element {
  position: absolute;
  color: #4CAF50;
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  animation-timing-function: ease-in-out;
}

@keyframes float {
  0% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50vw + 50%), calc(-50vh + 50%)) rotate(360deg);
    opacity: 0;
  }
}

/* 诗词标题和作者样式优化 */
.poem-title {
  font-size: 32px;
  color: #2c3e50;
  margin-bottom: 16px;
  font-weight: bold;
  text-align: center;
  letter-spacing: 2px;
}

.poem-author {
  font-size: 18px;
  color: #7f8c8d;
  text-align: center;
  margin-bottom: 30px;
  letter-spacing: 1px;
}

.ai-explanation {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
}

.ai-explanation:hover {
  transform: translateY(-4px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.section-title {
  font-size: 20px;
  color: #333;
  margin-bottom: 20px;
  font-weight: bold;
}

.explanation-content {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 20px;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}

.explanation-content:hover {
  transform: translateY(-4px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.explanation-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.explanation-content:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.explanation-content:hover::before {
  transform: scaleX(1);
}

.explanation-section {
  margin-bottom: 20px;
}

.explanation-section h3 {
  font-size: 16px;
  color: #4CAF50;
  margin-bottom: 8px;
  font-weight: bold;
}

.explanation-section p {
  font-size: 14px;
  color: #555;
  line-height: 1.6;
}

/* 引导性思考题样式 */
.questions-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.question-item {
  font-size: 14px;
  color: #555;
  line-height: 1.6;
  margin-bottom: 10px;
  padding-left: 20px;
  position: relative;
}

.question-item:before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  width: 8px;
  height: 8px;
  background-color: #4CAF50;
  border-radius: 50%;
}

.ai-btn {
  padding: 12px 24px;
  font-size: 16px;
  background: rgba(76, 175, 80, 0.2);
  color: var(--primary-color);
  border: 1px solid rgba(76, 175, 80, 0.3);
}

/* 诗人简介样式 */
.author-profile {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
}

.author-profile:hover {
  transform: translateY(-4px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.author-content {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.author-avatar {
  flex: 0 0 100px;
  height: 100px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid rgba(139, 69, 19, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-loading {
  color: #666;
  font-size: 12px;
  text-align: center;
  padding: 20px;
  box-sizing: border-box;
}

.author-info {
  flex: 1;
}

.author-info h3 {
  font-size: 20px;
  color: #333;
  margin-bottom: 8px;
  font-weight: bold;
}

.author-dynasty {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.author-bio {
  font-size: 14px;
  color: #555;
  line-height: 1.6;
}

/* 相似风格诗词样式 */
.similar-poems {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
}

.similar-poems:hover {
  transform: translateY(-4px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.similar-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.similar-item {
  background: rgba(255, 252, 240, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: var(--transition);
}

.similar-item:hover {
  transform: translateY(-2px);
  background: rgba(255, 252, 240, 0.3);
  box-shadow: 0 8px 16px rgba(31, 38, 135, 0.1);
}

.similar-item h4 {
  font-size: 16px;
  color: #8b4513;
  margin-bottom: 8px;
  font-weight: bold;
}

.similar-author {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.similar-content {
  font-size: 14px;
  color: #555;
  line-height: 1.4;
  font-family: 'SimSun', 'STSong', serif;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #999;
  font-style: italic;
}

.ai-btn:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.25);
}

.ai-btn.green {
  background: rgba(76, 175, 80, 0.2);
  color: var(--primary-color);
  border: 1px solid rgba(76, 175, 80, 0.3);
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.15);
  margin-bottom: 20px;
}

.ai-btn.green:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.5);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.25);
}

.error-message {
  color: #f44336;
  padding: 10px;
  margin: 10px 0;
  border-radius: 4px;
  background-color: #ffebee;
  border-left: 4px solid #f44336;
}

/* 加载动画 */
.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;
  vertical-align: middle;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading, .error, .empty {
  text-align: center;
  padding: 40px;
  color: #666;
}

.error {
  color: #f44336;
}

/* 背诵检测功能样式 */
.recite-check-section {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 24px;
  margin-bottom: 30px;
  box-shadow: var(--glass-shadow);
  position: relative;
  overflow: hidden;
  transition: var(--transition);
}

.recite-check-section:hover {
  transform: translateY(-4px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.recite-check-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
  transform: scaleX(0);
  transition: transform 0.3s ease;
}

.recite-check-section:hover::before {
  transform: scaleX(1);
}

.recite-check-section:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.recite-check-content {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 20px;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
}

.recite-check-content:hover {
  transform: translateY(-4px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 16px;
  color: #333;
  margin-bottom: 8px;
  font-weight: bold;
}

.recite-input {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  resize: vertical;
  font-family: 'SimSun', 'STSong', serif;
  line-height: 1.5;
  transition: all 0.3s ease;
  background: rgba(255, 252, 240, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.recite-input:focus {
  border-color: rgba(76, 175, 80, 0.5);
  outline: none;
  box-shadow: 0 8px 16px rgba(76, 175, 80, 0.15);
  transform: translateY(-2px);
  background: rgba(255, 252, 240, 0.5);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.recite-check-btn {
  width: 100%;
  max-width: 300px;
  margin: 0 auto;
  display: block;
  padding: 12px 24px;
  font-size: 16px;
  background: rgba(76, 175, 80, 0.2);
  color: var(--primary-color);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 12px;
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.15);
}

.recite-check-btn:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.25);
}

.recite-check-btn:disabled {
  background: rgba(76, 175, 80, 0.1);
  color: var(--primary-color);
  border-color: rgba(76, 175, 80, 0.2);
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.1);
  opacity: 0.6;
}

.recite-result-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.recite-score {
  text-align: center;
  margin-bottom: 30px;
}

.recite-score h3 {
  font-size: 18px;
  color: #333;
  margin-bottom: 16px;
}

.score-circle {
  display: inline-block;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
}

.score-circle:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
}

.score-excellent {
  background: linear-gradient(135deg, #4CAF50, #81C784);
  color: white;
}

.score-good {
  background: linear-gradient(135deg, #2196F3, #64B5F6);
  color: white;
}

.score-average {
  background: linear-gradient(135deg, #FFC107, #FFD54F);
  color: #333;
}

.score-poor {
  background: linear-gradient(135deg, #F44336, #E57373);
  color: white;
}

.score-number {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 4px;
}

.score-label {
  font-size: 14px;
  opacity: 0.9;
}

.score-message {
  font-size: 12px;
  margin-top: 8px;
  font-weight: bold;
}

.recite-feedback {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feedback-item {
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.feedback-item h4 {
  font-size: 16px;
  margin-bottom: 12px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
}

.feedback-item.error {
  background-color: #FFF3F3;
  border-left: 4px solid #F44336;
}

.feedback-item.advice {
  background-color: #F3F8FF;
  border-left: 4px solid #2196F3;
}

.error-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.error-item {
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.error-item:last-child {
  border-bottom: none;
}

.error-position {
  font-weight: bold;
  color: #666;
  min-width: 80px;
}

.error-input {
  color: #F44336;
  font-weight: bold;
  text-decoration: line-through;
}

.error-arrow {
  color: #999;
}

.error-correct {
  color: #4CAF50;
  font-weight: bold;
}

.error-missing,
.error-extra {
  color: #F44336;
  font-weight: bold;
}

.ai-advice-container {
  background-color: white;
  padding: 16px;
  border-radius: 6px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
}

.ai-advice {
  font-size: 14px;
  line-height: 1.6;
  color: #555;
  margin: 0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .poem-detail {
    padding: 15px;
  }
  
  .poem-title {
    font-size: 24px;
  }
  
  .poem-text {
    padding: 20px;
  }
  
  .poem-line {
    font-size: 16px;
  }
  
  .ai-explanation {
    padding: 20px;
  }
  
  .recite-check-section {
    padding: 16px;
  }
  
  .recite-check-content {
    padding: 16px;
  }
  
  .score-circle {
    width: 100px;
    height: 100px;
  }
  
  .score-number {
    font-size: 20px;
  }
}
/* 古风风格增强 */
.recite-check-btn {
  font-family: 'SimSun', 'STSong', serif;
  letter-spacing: 1px;
}

.score-circle {
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.feedback-item {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  transition: all 0.3s;
  box-shadow: var(--glass-shadow);
}

.feedback-item:hover {
  box-shadow: 0 8px 16px rgba(31, 38, 135, 0.15);
  transform: translateY(-2px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  border-color: rgba(255, 255, 255, 0.4);
}

/* AI助教聊天窗口样式 */
.tutor-chat-window {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  max-height: 500px;
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  box-shadow: var(--glass-shadow);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.tutor-chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 252, 240, 0.2);
  border-radius: var(--border-radius) var(--border-radius) 0 0;
}

.tutor-chat-header h3 {
  margin: 0;
  font-size: 16px;
  color: #8b4513;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #8b4513;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: var(--transition);
}

.close-btn:hover {
  background: rgba(139, 69, 19, 0.1);
}

.tutor-chat-body {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 400px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 300px;
}

.chat-message {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 18px;
  position: relative;
}

.chat-message.user {
  align-self: flex-end;
  background: rgba(139, 69, 19, 0.1);
  border: 1px solid rgba(139, 69, 19, 0.2);
  border-radius: 18px 18px 4px 18px;
}

.chat-message.bot {
  align-self: flex-start;
  background: rgba(255, 252, 240, 0.8);
  border: 1px solid var(--glass-border);
  border-radius: 4px 18px 18px 18px;
}

.message-content {
  font-size: 14px;
  line-height: 1.4;
  color: #333;
}

.chat-input-area {
  display: flex;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--glass-border);
}

.tutor-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  font-size: 14px;
  outline: none;
  transition: var(--transition);
}

.tutor-input:focus {
  border-color: #8b4513;
  box-shadow: 0 0 0 2px rgba(139, 69, 19, 0.1);
}

.send-btn {
  padding: 12px 20px;
  border: none;
  border-radius: 20px;
  background: #8b4513;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.send-btn:hover:not(:disabled) {
  background: #6b340f;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.2);
}

.send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.ai-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.ai-btn.blue {
  background: rgba(33, 150, 243, 0.2);
  color: var(--secondary-color);
  border: 1px solid rgba(33, 150, 243, 0.3);
  box-shadow: 0 4px 16px rgba(33, 150, 243, 0.15);
}

.ai-btn.blue:hover {
  background: rgba(33, 150, 243, 0.3);
  border-color: rgba(33, 150, 243, 0.5);
  box-shadow: 0 8px 24px rgba(33, 150, 243, 0.25);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tutor-chat-window {
    width: 90%;
    right: 5%;
    left: 5%;
    bottom: 20px;
  }
  
  .ai-buttons {
    flex-direction: column;
  }
  
  .ai-btn {
    width: 100%;
  }
}
</style>