<template>
  <div class="profile">
    <h1 class="page-title">个人中心</h1>
    
    <div class="profile-container">
      <!-- 用户信息 -->
      <div class="user-info">
        <div class="avatar">
          <img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=ancient%20chinese%20poetry%20scholar%20avatar%2C%20traditional%20chinese%20style%2C%20gentle%20expression%2C%20ink%20painting%20style&image_size=square" alt="用户头像" class="avatar-img">
        </div>
        <div class="user-details">
          <h2 class="user-name">{{ user.username }}</h2>
          <p class="user-email">{{ user.email }}</p>
        </div>
        <div class="logout-btn">
          <button @click="handleLogout" class="btn-logout">退出登录</button>
        </div>
      </div>
      
      <!-- 学习记录 -->
      <div class="learning-records">
        <h3 class="section-title">学习记录</h3>
        
        <!-- 标签切换 -->
        <div class="tab-container">
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'collected' }"
            @click="activeTab = 'collected'; loadCollectedPoems()"
          >
            已收藏诗词
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'learned' }"
            @click="activeTab = 'learned'; loadLearnedPoems()"
          >
            已学诗词
          </button>
        </div>
        
        <!-- 内容区域 -->
        <div class="tab-content">
          <!-- 已收藏诗词 -->
          <div v-if="activeTab === 'collected'" class="poem-list">
            <div v-if="loading" class="loading">加载中...</div>
            <div v-else-if="error" class="error">{{ error }}</div>
            <div v-else-if="collectedPoems.length === 0" class="empty">暂无收藏诗词</div>
            <div v-else>
              <div 
                v-for="poem in collectedPoems" 
                :key="poem.id" 
                class="poem-item"
                @click="navigateToDetail(poem.poem_id)"
              >
                <h4 class="poem-title">{{ poem.poem_title }}</h4>
                <p class="poem-author">{{ poem.poem_author }}</p>
                <p class="poem-content">{{ getShortContent(poem.poem_content) }}</p>
                <div class="poem-meta">
                  <span class="collected-time">{{ formatTime(poem.created_at) }}</span>
                  <button @click.stop="removeCollection(poem.poem_id)" class="btn-remove">取消收藏</button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 已学诗词 -->
          <div v-if="activeTab === 'learned'" class="poem-list">
            <div v-if="loading" class="loading">加载中...</div>
            <div v-else-if="error" class="error">{{ error }}</div>
            <div v-else-if="learnedPoems.length === 0" class="empty">暂无学习记录</div>
            <div v-else>
              <div 
                v-for="poem in learnedPoems" 
                :key="poem.poem_id" 
                class="poem-item"
                @click="navigateToDetail(poem.poem_id)"
              >
                <h4 class="poem-title">{{ poem.poem_title }}</h4>
                <p class="poem-author">{{ poem.poem_author }}</p>
                <p class="poem-content">{{ getShortContent(poem.content) }}</p>
                <div class="poem-meta">
                  <span class="learned-time">{{ formatTime(poem.last_view_time) }}</span>
                  <span class="best-score">最高得分: {{ poem.best_score }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 系统信息 -->
      <div class="system-info">
        <div class="cache-control">
          <button @click="clearAvatarCache" class="btn-clear-cache">清除诗人头像缓存</button>
        </div>
        <p class="app-version">古诗词学习系统 v1.0.0</p>
        <p class="copyright">© 2026 古诗词学习系统. 保留所有权利.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()
const user = ref({
  username: '诗词爱好者',
  email: ''
})
const activeTab = ref('collected')
const collectedPoems = ref([])
const learnedPoems = ref([])
const loading = ref(false)
const error = ref('')

// 加载用户信息
const loadUserInfo = () => {
  const userData = localStorage.getItem('user')
  if (userData) {
    user.value = JSON.parse(userData)
  }
}

// 加载已收藏诗词
const loadCollectedPoems = async () => {
  try {
    loading.value = true
    error.value = ''
    const response = await api.collections.getAll()
    collectedPoems.value = response.data
  } catch (err) {
    error.value = '获取收藏失败'
    console.error('获取收藏失败:', err)
  } finally {
    loading.value = false
  }
}

// 加载已学诗词
const loadLearnedPoems = async () => {
  try {
    loading.value = true
    error.value = ''
    const response = await api.learn.stats()
    learnedPoems.value = response.data
  } catch (err) {
    error.value = '获取学习记录失败'
    console.error('获取学习记录失败:', err)
  } finally {
    loading.value = false
  }
}

// 取消收藏
const removeCollection = async (poemId) => {
  try {
    await api.collections.remove(poemId)
    // 重新加载收藏列表
    loadCollectedPoems()
  } catch (err) {
    error.value = '取消收藏失败'
    console.error('取消收藏失败:', err)
  }
}

// 退出登录
const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  router.push('/login')
}

// 导航到诗词详情页
const navigateToDetail = (id) => {
  router.push(`/poem/${id}`)
}

// 获取诗词内容的简短版本
const getShortContent = (content) => {
  if (!content) return ''
  const cleanContent = content.replace(/\s+/g, ' ').trim()
  return cleanContent.length > 50 ? cleanContent.substring(0, 50) + '...' : cleanContent
}

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 清除诗人头像缓存
const clearAvatarCache = () => {
  try {
    // 遍历localStorage，清除所有诗人头像缓存
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('author_avatar_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    alert('诗人头像缓存已清除');
  } catch (error) {
    console.error('清除缓存失败:', error);
    alert('清除缓存失败，请重试');
  }
}

// 初始化
onMounted(() => {
  loadUserInfo()
  loadCollectedPoems()
})
</script>

<style scoped>
.profile {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.page-title {
  font-size: 28px;
  color: #333;
  text-align: center;
  margin-bottom: 30px;
  font-weight: bold;
}

/* 毛玻璃效果通用样式 */
.glass-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), inset 0 0 20px rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.glass-card:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2), inset 0 0 25px rgba(255, 255, 255, 0.08);
}

.glass-tag {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), inset 0 0 10px rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.glass-tag:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15), inset 0 0 15px rgba(255, 255, 255, 0.08);
}

.glass-poem-item {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), inset 0 0 20px rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.glass-poem-item:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2), inset 0 0 25px rgba(255, 255, 255, 0.08);
}

.glass-footer {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), inset 0 0 10px rgba(255, 255, 255, 0.03);
  transition: all 0.3s ease;
}

/* 主容器 */
.profile-container {
  border-radius: 20px;
  overflow: hidden;
  background: transparent;
  box-shadow: none;
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), inset 0 0 20px rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  margin-bottom: 20px;
}

.user-info:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2), inset 0 0 25px rgba(255, 255, 255, 0.08);
}

.avatar {
  margin-right: 20px;
}

.avatar-img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #4CAF50;
  transition: all 0.3s ease;
}

.avatar-img:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(76, 175, 80, 0.4);
}

.user-details h2 {
  font-size: 20px;
  color: #333;
  margin-bottom: 8px;
  font-weight: bold;
}

.user-details p {
  font-size: 14px;
  color: #666;
}

.logout-btn {
  margin-left: auto;
}

.btn-logout {
  padding: 8px 16px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

.btn-logout:hover {
  background: #d32f2f;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
}

/* 学习记录样式 */
.learning-records {
  padding: 20px 30px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), inset 0 0 20px rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  margin-bottom: 20px;
}

.learning-records:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2), inset 0 0 25px rgba(255, 255, 255, 0.08);
}

.section-title {
  font-size: 18px;
  color: #333;
  margin-bottom: 20px;
  font-weight: bold;
}

/* 标签切换样式 */
.tab-container {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab-btn {
  padding: 10px 20px;
  font-size: 16px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #666;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), inset 0 0 10px rgba(255, 255, 255, 0.05);
}

.tab-btn:hover {
  color: #4CAF50;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15), inset 0 0 15px rgba(255, 255, 255, 0.08);
}

.tab-btn.active {
  color: #4CAF50;
  border-bottom-color: #4CAF50;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

/* 诗词列表样式 */
.poem-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.poem-item {
  padding: 16px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  z-index: 1;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), inset 0 0 20px rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}

.poem-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #4CAF50, #2E7D32);
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
  transform: translateY(-4px);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2), inset 0 0 25px rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.3);
}

.poem-item:hover::before {
  transform: scaleX(1);
}

.poem-title {
  font-size: 16px;
  color: #333;
  margin-bottom: 4px;
  font-weight: bold;
}

.poem-author {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.poem-content {
  font-size: 13px;
  color: #555;
  line-height: 1.5;
  margin-bottom: 12px;
  height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.poem-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #999;
}

.collected-time,
.learned-time {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.best-score {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid rgba(255, 215, 0, 0.3);
  color: #ff9800;
}

.btn-remove {
  padding: 4px 12px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s ease;
}

.btn-remove:hover {
  background: #d32f2f;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(244, 67, 54, 0.3);
}

/* 加载和错误状态 */
.loading, .error, .empty {
  text-align: center;
  padding: 40px;
  color: #666;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), inset 0 0 10px rgba(255, 255, 255, 0.03);
}

.error {
  color: #f44336;
}

.empty {
  color: #999;
}

/* 系统信息 */
.system-info {
  padding: 30px;
  text-align: center;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), inset 0 0 10px rgba(255, 255, 255, 0.03);
  transition: all 0.3s ease;
}

.system-info:hover {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15), inset 0 0 15px rgba(255, 255, 255, 0.05);
}

.cache-control {
  margin-bottom: 16px;
  text-align: center;
}

.btn-clear-cache {
  padding: 10px 20px;
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.2), rgba(255, 152, 0, 0.1));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #ff9800;
  border: 1px solid rgba(255, 152, 0, 0.3);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
  box-shadow: 0 4px 16px rgba(255, 152, 0, 0.15), inset 0 0 10px rgba(255, 255, 255, 0.05);
}

.btn-clear-cache:hover {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.3), rgba(255, 152, 0, 0.2));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 152, 0, 0.25), inset 0 0 15px rgba(255, 255, 255, 0.08);
  color: #f57c00;
}

.app-version {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.copyright {
  font-size: 12px;
  color: #999;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .profile {
    padding: 15px;
  }
  
  .page-title {
    font-size: 24px;
  }
  
  .user-info {
    flex-direction: column;
    text-align: center;
    padding: 20px;
    margin-bottom: 16px;
  }
  
  .avatar {
    margin-right: 0;
    margin-bottom: 16px;
  }
  
  .logout-btn {
    margin-left: 0;
    margin-top: 16px;
  }
  
  .learning-records {
    padding: 16px 20px;
    margin-bottom: 16px;
  }
  
  .tab-btn {
    padding: 8px 16px;
    font-size: 14px;
  }
  
  .poem-item {
    padding: 12px;
  }
  
  .system-info {
    padding: 20px;
  }
}
</style>
