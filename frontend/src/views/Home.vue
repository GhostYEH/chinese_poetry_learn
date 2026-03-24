<template>
  <div class="home">
    <!-- 一言 -->
    <div class="hitokoto-container">
      <p class="hitokoto-text">{{ hitokotoText }}</p>
      <p class="hitokoto-from" v-if="hitokotoFrom">— 出自 {{ hitokotoFrom }}</p>
    </div>
    <h1 class="page-title">古诗词学习系统</h1>
    
    <!-- 每日一诗 -->
    <div class="daily-poem-card" v-if="dailyPoem" @click="navigateToDetail(dailyPoem.id)">
      <div class="daily-header">
        <span class="daily-label">📅 每日一诗</span>
        <span class="daily-date">{{ currentDate }}</span>
      </div>
      <h2 class="daily-title">{{ dailyPoem.title }}</h2>
      <p class="daily-author">{{ dailyPoem.author }} · {{ dailyPoem.dynasty }}</p>
      <p class="daily-content">{{ getShortContent(dailyPoem.content) }}</p>
      <button 
        v-if="speechSynthesisSupported"
        class="read-btn"
        @click.stop="toggleRead(dailyPoem)"
      >
        {{ isReading && readingPoemId === dailyPoem.id ? '⏹ 停止' : '🔊 朗读' }}
      </button>
    </div>

    <!-- 搜索框 -->
    <div class="search-container">
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="搜索诗词..."
        class="search-input"
        @keyup.enter="handleSearch"
      />
      <button class="search-btn" @click="handleSearch">搜索</button>
    </div>
    
    <!-- 筛选功能 -->
    <div class="filter-container">
      <div class="filter-item">
        <label for="dynasty-filter">朝代：</label>
        <select 
          id="dynasty-filter"
          v-model="dynastyFilter" 
          @change="filterPoems"
          class="filter-select"
        >
          <option value="">全部朝代</option>
          <option value="唐">唐朝</option>
          <option value="宋">宋朝</option>
          <option value="元">元朝</option>
        </select>
      </div>
      <div class="filter-item">
        <label for="author-filter">作者：</label>
        <select 
          id="author-filter"
          v-model="authorFilter" 
          @change="filterPoems"
          class="filter-select"
        >
          <option value="">全部作者</option>
          <option v-for="author in authors" :key="author" :value="author">{{ author }}</option>
        </select>
      </div>
      <button class="reset-btn" @click="resetFilters">重置筛选</button>
    </div>
    
    <!-- 精选诗句 -->
    <h2 class="section-title">精选诗句</h2>
    
    <!-- 诗词列表 -->
    <div class="poem-list">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="filteredPoems.length === 0" class="empty">暂无诗词</div>
      <div 
        v-for="poem in filteredPoems" 
        v-else
        :key="poem.id" 
        class="poem-item"
        @click="navigateToDetail(poem.id)"
      >
        <p class="poem-content">{{ getShortContent(poem.content) }}</p>
        <p class="poem-author">{{ poem.author }} 《{{ poem.title }}》</p>
        <button 
          v-if="speechSynthesisSupported"
          class="read-btn"
          @click.stop="toggleRead(poem)"
        >
          {{ isReading && readingPoemId === poem.id ? '⏹ 停止' : '🔊 朗读' }}
        </button>
      </div>
    </div>
    
    <!-- 加载更多 -->
    <div v-if="filteredPoems.length > 0" class="load-more">
      <button 
        type="button"
        class="load-more-btn"
        @click="loadMore"
        :disabled="loadingMore"
      >
        <span v-if="loadingMore" class="loading-spinner"></span>
        {{ loadingMore ? '加载中...' : '加载更多' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Home',
  data() {
    return {
      poems: [],
      filteredPoems: [],
      dailyPoem: null,
      currentDate: new Date().toLocaleDateString('zh-CN'),
      loading: true,
      loadingMore: false,
      error: '',
      searchQuery: '',
      dynastyFilter: '',
      authorFilter: '',
      authors: [],
      page: 1,
      pageSize: 30,
      savedScrollTop: 0,
      speechSynthesisSupported: 'speechSynthesis' in window,
      isReading: false,
      readingPoemId: null,
      speechUtterance: null,
      hitokotoText: '获取中...',
      hitokotoFrom: ''
    }
  },
  // 路由离开前保存滚动位置
  beforeRouteLeave(to, from, next) {
    this.savedScrollTop = window.pageYOffset || document.documentElement.scrollTop
    next()
  },
  // 组件被激活时（从缓存恢复）
  activated() {
    if (this.savedScrollTop > 0) {
      // 稍微延迟以确保 DOM 已渲染
      setTimeout(() => {
        window.scrollTo({ top: this.savedScrollTop, behavior: 'auto' })
      }, 100)
    }
  },
  mounted() {
    this.fetchPoems()
    this.fetchDailyPoem()
    this.fetchHitokoto()
  },
  methods: {
    async fetchDailyPoem() {
      try {
        const response = await fetch('/api/daily-poem')
        if (response.ok) {
          this.dailyPoem = await response.json()
        }
      } catch (e) {
        console.error('获取每日一诗失败', e)
      }
    },
    async fetchHitokoto() {
      try {
        console.log('开始获取一言...');
        // 获取积极向上的语句 (类别: l - 积极向上)
        const response = await fetch('https://v1.hitokoto.cn/?c=l')
        console.log('一言API响应状态:', response.status);
        if (response.ok) {
          const data = await response.json()
          console.log('一言API响应数据:', data);
          if (data.hitokoto) {
            this.hitokotoText = data.hitokoto
            // 获取出处信息
            if (data.from) {
              this.hitokotoFrom = data.from
            } else if (data.from_who) {
              this.hitokotoFrom = data.from_who
            } else {
              this.hitokotoFrom = ''
            }
          } else {
            console.error('一言API响应格式错误，缺少hitokoto字段');
            this.hitokotoText = '心有猛虎，细嗅蔷薇';
            this.hitokotoFrom = '余光中';
          }
        } else {
          console.error('一言API请求失败:', response.statusText);
          this.hitokotoText = '海纳百川，有容乃大';
          this.hitokotoFrom = '林则徐';
        }
      } catch (e) {
        console.error('获取一言失败:', e);
        this.hitokotoText = '胸有丘壑，眼存山河';
        this.hitokotoFrom = '';
      }
    },
    async fetchPoems() {
      try {
        if (this.page === 1) {
          this.loading = true
        }
        this.error = ''
        
        // 保存当前滚动位置
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop
        
        // 构建查询参数
        let url = `/api/poems?page=${this.page}&pageSize=${this.pageSize}&_=${Date.now()}`
        
        // 如果没有筛选条件，启用随机模式
        if (!this.searchQuery && !this.dynastyFilter && !this.authorFilter) {
          url += '&random=true'
        }
        
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('获取诗词列表失败')
        }
        
        const data = await response.json()
        
        if (this.page === 1) {
          this.poems = data
          // 提取所有作者
          this.extractAuthors()
          // 初始化筛选
          this.filterPoems()
          // 预加载热门诗词的AI讲解缓存
          this.preloadAICache(data.slice(0, 3)) // 预加载前3首诗词
        } else {
          this.poems = [...this.poems, ...data]
          // 提取新作者
          this.extractAuthors()
          // 重新筛选
          this.filterPoems()
        }
      } catch (err) {
        this.error = err.message
        console.error('获取诗词列表失败:', err)
      } finally {
        this.loading = false
        this.loadingMore = false
      }
    },
    
    // 预加载AI讲解缓存
    async preloadAICache(poems) {
      try {
        for (const poem of poems) {
          // 发送预加载请求
          const requestData = {
            poem: poem.content,
            title: poem.title,
            author: poem.author
          }
          
          console.log('开始预加载AI讲解缓存:', poem.title);
          
          // 使用批量API端点，设置超时
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
          
          try {
            const response = await fetch('/api/ai/explainPoem/batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(requestData),
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              console.log(`已预加载诗词AI讲解缓存: ${poem.title} - ${poem.author}`);
            } else {
              console.warn(`预加载AI讲解缓存失败 (${response.status}): ${poem.title}`);
            }
          } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              console.warn(`预加载AI讲解缓存超时: ${poem.title}`);
            } else {
              console.warn(`预加载AI讲解缓存失败: ${poem.title}`, error.message);
            }
          }
        }
      } catch (error) {
        console.error('预加载AI讲解缓存失败:', error)
        // 预加载失败不影响用户体验，静默处理
      }
    },
    loadMore() {
      if (this.loadingMore) return
      
      this.loadingMore = true
      this.page++
      this.fetchPoems()
    },
    handleSearch() {
      if (this.searchQuery.trim()) {
        this.$router.push({ 
          path: '/search', 
          query: { q: this.searchQuery } 
        })
      }
    },
    navigateToDetail(id) {
      this.$router.push(`/poem/${id}`)
    },
    getShortContent(content) {
      if (!content) return ''
      const cleanContent = content.replace(/\s+/g, ' ').trim()
      return cleanContent.length > 50 ? cleanContent.substring(0, 50) + '...' : cleanContent
    },
    // 提取所有作者
    extractAuthors() {
      const authorSet = new Set()
      this.poems.forEach(poem => {
        if (poem.author) {
          authorSet.add(poem.author)
        }
      })
      this.authors = Array.from(authorSet).sort()
    },
    // 筛选诗词
    filterPoems() {
      let filtered = [...this.poems]
      
      // 朝代筛选
      if (this.dynastyFilter) {
        filtered = filtered.filter(poem => poem.dynasty === this.dynastyFilter)
      }
      
      // 作者筛选
      if (this.authorFilter) {
        filtered = filtered.filter(poem => poem.author === this.authorFilter)
      }
      
      this.filteredPoems = filtered
    },
    // 重置筛选
    resetFilters() {
      this.dynastyFilter = ''
      this.authorFilter = ''
      this.filterPoems()
    },
    // 切换朗读状态
    toggleRead(poem) {
      if (!this.speechSynthesisSupported) {
        alert('您的浏览器不支持语音朗读功能');
        return;
      }
      
      // 如果正在朗读，直接停止
      if (this.isReading) {
        speechSynthesis.cancel();
        this.isReading = false;
        this.readingPoemId = null;
        return;
      }
      
      // 开始朗读
      this.startReading(poem);
    },
    // 开始朗读
    startReading(poem) {
      if (!poem || !poem.content) return;
      
      // 取消之前的朗读
      speechSynthesis.cancel();
      
      let text = poem.content;
      // 预处理：规范化标点，确保每句有停顿
      text = text.replace(/([。！？；])\s*/g, '$1，').replace(/\n/g, '。');
      
      // 分割成句子数组（按。！？；, 分）
      const sentences = text.split(/(?<=[。！？；，])/).filter(s => s.trim());
      
      let queue = [...sentences]; // 队列朗读
      
      const speakNext = () => {
        if (queue.length === 0) {
          this.isReading = false;
          this.readingPoemId = null;
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
      this.readingPoemId = poem.id;
      speakNext();
    }
  }
}
</script>

<style scoped>
.home {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.hitokoto-container {
  text-align: center;
  margin-bottom: 20px;
  padding: 15px;
  background: rgba(255, 252, 240, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
}

.hitokoto-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.hitokoto-label {
  font-size: 18px;
  color: #cd853f;
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  white-space: nowrap;
  margin-top: 2px;
}

.hitokoto-text {
  font-size: 16px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-style: italic;
  line-height: 1.6;
  margin: 0;
  flex: 1;
}

.hitokoto-from {
  font-size: 14px;
  color: #666;
  font-family: 'SimSun', 'STSong', serif;
  font-style: italic;
  line-height: 1.4;
  margin: 8px 0 0 28px;
  text-align: right;
}

.page-title {
  font-size: 28px;
  color: #333;
  text-align: center;
  margin-bottom: 30px;
  font-weight: bold;
}


.search-container {
  display: flex;
  margin-bottom: 30px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 10px;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.search-container::after {
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

.search-container:hover {
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  font-size: 16px;
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 8px 0 0 8px;
  outline: none;
  transition: border-color 0.3s;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.search-input:focus {
  border-color: #cd853f;
  box-shadow: 0 0 0 2px rgba(205, 133, 63, 0.1);
}

.search-btn {
  padding: 12px 24px;
  font-size: 16px;
  background: rgba(205, 133, 63, 0.2);
  color: #8b4513;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 0 12px 12px 0;
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
}

.search-btn:hover {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.25);
}

/* 筛选功能样式 */
.filter-container {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
  padding: 15px;
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
  flex-wrap: wrap;
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.filter-container::after {
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

.filter-container:hover {
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-item label {
  font-size: 14px;
  color: #666;
  white-space: nowrap;
}

.filter-select {
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 8px;
  outline: none;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  cursor: pointer;
  transition: border-color 0.3s;
}

.filter-select:focus {
  border-color: #cd853f;
  box-shadow: 0 0 0 2px rgba(205, 133, 63, 0.1);
}

.reset-btn {
  padding: 8px 16px;
  font-size: 14px;
  background: rgba(205, 133, 63, 0.2);
  color: #8b4513;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
  margin-left: auto;
}

.reset-btn:hover {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.25);
}

.poem-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 30px;
  width: 100%;
  grid-auto-rows: minmax(140px, auto);
}

.poem-item {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 28px;
  cursor: pointer;
  transition: var(--transition);
  display: flex;
  flex-direction: column;
  min-height: 160px;
  box-shadow: var(--glass-shadow);
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.poem-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  transform: scaleX(0);
  transition: transform 0.3s ease;
  z-index: -1;
}

.poem-item::after {
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

.poem-item:hover {
  transform: scale(1.02) translateY(-4px);
  background: rgba(255, 252, 240, 0.9);
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.2);
  border-color: rgba(255, 152, 0, 0.3);
}

.poem-item:hover .poem-content {
  color: #8b4513;
}

.poem-item:hover .poem-author {
  color: #6b340f;
}

.poem-item:hover::before {
  transform: scaleX(1);
}

.poem-content {
  font-size: 18px;
  color: #333;
  line-height: 1.6;
  margin-bottom: 12px;
  font-weight: 500;
  font-family: 'SimSun', 'STSong', serif;
  text-align: left;
}

.poem-author {
  font-size: 14px;
  color: #666;
  margin-top: auto;
  font-family: 'SimSun', 'STSong', serif;
  text-align: right;
}

.poem-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #999;
}

.dynasty {
  background-color: #f0f0f0;
  padding: 4px 8px;
  border-radius: 4px;
}

.loading, .error, .empty {
  text-align: center;
  padding: 40px;
  color: #666;
  grid-column: 1 / -1;
}

.error {
  color: #f44336;
}

.load-more {
  text-align: center;
  margin-bottom: 30px;
}

.load-more-btn {
  padding: 12px 32px;
  font-size: 16px;
  background: rgba(205, 133, 63, 0.2);
  color: #8b4513;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
}

.load-more-btn:hover:not(:disabled) {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.25);
}

.load-more-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  transform: none;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
}

/* 加载动画 */
.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #333;
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .home {
    max-width: 100%;
    padding: 20px;
  }
  
  .poem-list {
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .quick-actions {
    grid-template-columns: 1fr;
  }
  
  .poem-list {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .daily-poem-card {
    padding: 20px;
  }
  
  .poem-content {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .home {
    padding: 15px;
  }
  
  .page-title {
    font-size: 24px;
  }
  
  .search-container {
    flex-direction: column;
    gap: 10px;
  }
  
  .search-input {
    border-radius: 8px;
  }
  
  .search-btn {
    border-radius: 8px;
  }
  
  .poem-list {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .filter-container {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .reset-btn {
    margin-left: 0;
  }
  
  .poem-item {
    padding: 20px;
    min-height: 120px;
  }
  
  .poem-content {
    font-size: 15px;
  }
}

/* 每日一诗样式 */
.daily-poem-card {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 25px;
  margin-bottom: 40px;
  cursor: pointer;
  box-shadow: var(--glass-shadow);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
  z-index: 1;
}

.daily-poem-card::after {
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

.daily-poem-card:hover {
  transform: translateY(-6px);
  backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px));
  box-shadow: 0 12px 24px rgba(31, 38, 135, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
}

.daily-poem-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  transform: scaleX(0);
  transition: transform 0.3s ease;
  z-index: -1;
}

.daily-poem-card::after {
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

.daily-poem-card:hover {
  color: var(--accent-color);
  transform: scale(1.02) translateY(-4px);
  background: rgba(255, 252, 240, 0.9);
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.2);
  border-color: rgba(255, 152, 0, 0.3);
}

.daily-poem-card:hover::before {
  transform: scaleX(1);
}

.daily-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.daily-label {
  font-size: 14px;
  font-weight: bold;
  color: #00796b;
  background-color: rgba(0, 121, 107, 0.1);
  padding: 4px 10px;
  border-radius: 20px;
}

.daily-date {
  font-size: 14px;
  color: #666;
}

.daily-title {
  font-size: 24px;
  color: #2c3e50;
  margin-bottom: 10px;
  font-weight: bold;
}

.daily-author {
  font-size: 16px;
  color: #555;
  margin-bottom: 15px;
}

.daily-content {
  font-size: 16px;
  color: #444;
  line-height: 1.8;
  font-family: 'SimSun', 'STSong', serif;
}

/* 朗读按钮样式 */
.read-btn {
  position: absolute;
  bottom: 15px;
  right: 15px;
  padding: 8px 16px;
  font-size: 14px;
  background: rgba(255, 252, 240, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  color: #8b4513;
  cursor: pointer;
  transition: var(--transition);
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
  z-index: 2;
}

.read-btn:hover {
  background: rgba(255, 252, 240, 0.9);
  border-color: rgba(255, 152, 0, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 152, 0, 0.2);
}

.read-btn:active {
  transform: translateY(0);
}

/* 确保诗词卡片有足够的 padding 以容纳按钮 */
.poem-item {
  padding-bottom: 60px;
}

.daily-poem-card {
  padding-bottom: 60px;
}
</style>