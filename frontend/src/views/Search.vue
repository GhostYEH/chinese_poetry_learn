<template>
  <div class="search">
    <h1 class="page-title">搜索诗词</h1>
    
    <!-- 搜索框 -->
    <div class="search-container">
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="输入诗词标题、作者或内容..."
        class="search-input"
        @keyup.enter="performSearch"
      />
      <button class="search-btn" @click="performSearch">搜索</button>
    </div>
    
    <!-- 搜索结果 -->
    <div class="search-results">
      <div v-if="loading" class="loading">搜索中...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else-if="results.length === 0 && hasSearched" class="empty">未找到相关诗词</div>
      <div v-else-if="results.length > 0">
        <div class="results-count">找到 {{ results.length }} 首诗词</div>
        <div class="poem-list">
          <div 
            v-for="poem in results" 
            :key="poem.id" 
            class="poem-item"
            @click="navigateToDetail(poem.id)"
          >
            <h3 class="poem-title">{{ poem.title }}</h3>
            <p class="poem-author">{{ poem.author }} · {{ poem.dynasty }}</p>
            <p class="poem-content">{{ getShortContent(poem.content) }}</p>
          </div>
        </div>
      </div>
      <div v-else class="initial-state">
        <p>请输入关键词搜索诗词</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Search',
  data() {
    return {
      searchQuery: '',
      results: [],
      loading: false,
      error: '',
      hasSearched: false
    }
  },
  mounted() {
    // 从路由参数中获取搜索词
    const query = this.$route.query.q
    if (query) {
      this.searchQuery = query
      this.performSearch()
    }
  },
  methods: {
    async performSearch() {
      if (!this.searchQuery.trim()) {
        this.error = '请输入搜索关键词'
        return
      }
      
      try {
        this.loading = true
        this.error = ''
        this.hasSearched = true
        
        // 这里简化处理，实际项目中应该调用后端搜索API
        // 暂时使用模拟数据或从诗词列表中过滤
        const response = await fetch(`/api/poems`)
        if (!response.ok) {
          throw new Error('获取诗词数据失败')
        }
        
        const allPoems = await response.json()
        
        // 简单的前端过滤
        this.results = allPoems.filter(poem => {
          const searchLower = this.searchQuery.toLowerCase()
          return (
            poem.title.toLowerCase().includes(searchLower) ||
            poem.author.toLowerCase().includes(searchLower) ||
            poem.content.toLowerCase().includes(searchLower) ||
            poem.dynasty.toLowerCase().includes(searchLower)
          )
        })
      } catch (err) {
        this.error = err.message
        console.error('搜索失败:', err)
      } finally {
        this.loading = false
      }
    },
    navigateToDetail(id) {
      this.$router.push(`/poem/${id}`)
    },
    getShortContent(content) {
      if (!content) return ''
      const cleanContent = content.replace(/\s+/g, ' ').trim()
      return cleanContent.length > 50 ? cleanContent.substring(0, 50) + '...' : cleanContent
    }
  }
}
</script>

<style scoped>
.search {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
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
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  font-size: 16px;
  border: 1px solid #ddd;
  border-radius: 8px 0 0 8px;
  outline: none;
  transition: border-color 0.3s;
}

.search-input:focus {
  border-color: #4CAF50;
}

.search-btn {
  padding: 12px 24px;
  font-size: 16px;
  background: rgba(76, 175, 80, 0.2);
  color: var(--primary-color);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 0 12px 12px 0;
  cursor: pointer;
  transition: var(--transition);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(76, 175, 80, 0.15);
}

.search-btn:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(76, 175, 80, 0.25);
}

.search-results {
  margin-top: 20px;
}

.results-count {
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
  padding-left: 8px;
}

.poem-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.poem-item {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 20px;
  cursor: pointer;
  transition: var(--transition);
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
  background: linear-gradient(90deg, var(--primary-color), var(--secondary-color));
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
  color: var(--accent-color);
  transform: scale(1.02) translateY(-4px);
  background: rgba(255, 252, 240, 0.9);
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.2);
  border-color: rgba(255, 152, 0, 0.3);
}

.poem-item:hover::before {
  transform: scaleX(1);
}

.poem-title {
  font-size: 20px;
  color: #333;
  margin-bottom: 8px;
  font-weight: bold;
}

.poem-author {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.poem-content {
  font-size: 14px;
  color: #555;
  line-height: 1.6;
  margin-bottom: 16px;
  height: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.loading, .error, .empty, .initial-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.error {
  color: #f44336;
}

.initial-state {
  font-size: 16px;
  color: #999;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .search {
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
  }
}
</style>