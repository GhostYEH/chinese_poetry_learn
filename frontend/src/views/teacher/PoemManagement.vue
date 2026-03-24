<template>
  <div class="poem-management">
    <div class="page-header">
      <h1>诗词库管理</h1>
      <div class="header-actions">
        <input 
          v-model="searchKeyword" 
          type="text" 
          placeholder="搜索诗词..." 
          class="search-input"
          @keyup.enter="searchPoems"
        />
        <button class="btn-primary" @click="showAddModal = true">
          <span>➕</span> 添加诗词
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>数据加载中...</p>
    </div>

    <div v-else class="poems-section">
      <div class="stats-overview">
        <div class="stat-card">
          <span class="stat-icon">📚</span>
          <div class="stat-info">
            <span class="stat-value">{{ poems.length }}</span>
            <span class="stat-label">诗词总数</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">👤</span>
          <div class="stat-info">
            <span class="stat-value">{{ authorCount }}</span>
            <span class="stat-label">作者数量</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📖</span>
          <div class="stat-info">
            <span class="stat-value">{{ dynastyCount }}</span>
            <span class="stat-label">朝代数量</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🔥</span>
          <div class="stat-info">
            <span class="stat-value">{{ topDynasty }}</span>
            <span class="stat-label">热门朝代</span>
          </div>
        </div>
      </div>

      <div class="filter-bar">
        <select v-model="selectedDynasty" @change="filterPoems">
          <option value="">全部朝代</option>
          <option v-for="d in dynasties" :key="d" :value="d">{{ d }}</option>
        </select>
        <select v-model="selectedAuthor" @change="filterPoems">
          <option value="">全部作者</option>
          <option v-for="a in authors" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>

      <div class="poems-grid">
        <div v-for="poem in filteredPoems" :key="poem.id" class="poem-card">
          <div class="poem-header">
            <h3>{{ poem.title }}</h3>
            <span class="poem-dynasty">{{ poem.dynasty }}</span>
          </div>
          <p class="poem-author">{{ poem.author }}</p>
          <p class="poem-content">{{ poem.content.slice(0, 60) }}{{ poem.content.length > 60 ? '...' : '' }}</p>
          <div class="poem-tags">
            <span v-for="tag in (poem.tags || '').split(',').slice(0, 3)" :key="tag" class="tag">
              {{ tag }}
            </span>
          </div>
          <div class="poem-actions">
            <button class="btn-small" @click="viewPoem(poem)">查看</button>
            <button class="btn-small secondary" @click="editPoem(poem)">编辑</button>
            <button class="btn-small danger" @click="deletePoem(poem.id)">删除</button>
          </div>
        </div>
      </div>

      <div v-if="filteredPoems.length === 0" class="empty-state">
        <p>暂无诗词数据</p>
      </div>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content modal-large">
        <h2>{{ editingPoem ? '编辑诗词' : '添加诗词' }}</h2>
        <div class="form-group">
          <label>标题</label>
          <input v-model="poemForm.title" type="text" placeholder="请输入诗词标题" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>作者</label>
            <input v-model="poemForm.author" type="text" placeholder="请输入作者" />
          </div>
          <div class="form-group">
            <label>朝代</label>
            <select v-model="poemForm.dynasty">
              <option value="">请选择</option>
              <option v-for="d in dynasties" :key="d" :value="d">{{ d }}</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>内容</label>
          <textarea v-model="poemForm.content" rows="5" placeholder="请输入诗词内容"></textarea>
        </div>
        <div class="form-group">
          <label>标签（用逗号分隔）</label>
          <input v-model="poemForm.tags" type="text" placeholder="如：思乡,月亮" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="closeModal">取消</button>
          <button class="btn-primary" @click="savePoem">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showViewModal" class="modal-overlay" @click.self="showViewModal = false">
      <div class="modal-content modal-large">
        <h2>{{ viewingPoem?.title }}</h2>
        <p class="view-author">{{ viewingPoem?.dynasty }} · {{ viewingPoem?.author }}</p>
        <p class="view-content">{{ viewingPoem?.content }}</p>
        <div class="view-tags">
          <span v-for="tag in (viewingPoem?.tags || '').split(',')" :key="tag" class="tag">
            {{ tag }}
          </span>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showViewModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const poems = ref([])
const searchKeyword = ref('')
const selectedDynasty = ref('')
const selectedAuthor = ref('')
const showAddModal = ref(false)
const showViewModal = ref(false)
const editingPoem = ref(null)
const viewingPoem = ref(null)
const poemForm = ref({
  title: '',
  author: '',
  dynasty: '',
  content: '',
  tags: ''
})

const dynasties = computed(() => {
  const set = new Set(poems.value.map(p => p.dynasty).filter(Boolean))
  return Array.from(set).sort()
})

const authors = computed(() => {
  const set = new Set(poems.value.map(p => p.author).filter(Boolean))
  return Array.from(set).sort()
})

const authorCount = computed(() => authors.value.length)
const dynastyCount = computed(() => dynasties.value.length)
const topDynasty = computed(() => {
  const counts = {}
  poems.value.forEach(p => {
    if (p.dynasty) counts[p.dynasty] = (counts[p.dynasty] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || '-'
})

const filteredPoems = computed(() => {
  let result = poems.value
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(p => 
      p.title?.toLowerCase().includes(keyword) ||
      p.author?.toLowerCase().includes(keyword) ||
      p.content?.toLowerCase().includes(keyword)
    )
  }
  if (selectedDynasty.value) {
    result = result.filter(p => p.dynasty === selectedDynasty.value)
  }
  if (selectedAuthor.value) {
    result = result.filter(p => p.author === selectedAuthor.value)
  }
  return result
})

const request = async (url, options = {}) => {
  const token = localStorage.getItem('teacherToken')
  const response = await fetch(`http://localhost:3000/api/teacher${url}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
  
  if (response.status === 401) {
    localStorage.removeItem('teacherToken')
    router.push('/teacher/login')
    throw new Error('认证已过期')
  }
  
  return response.json()
}

const loadPoems = async () => {
  loading.value = true
  try {
    const result = await request('/poems')
    poems.value = result.data || result || []
  } catch (err) {
    console.error('加载诗词失败:', err)
    poems.value = []
  } finally {
    loading.value = false
  }
}

const searchPoems = () => {
  // 搜索逻辑已在 computed 中实现
}

const filterPoems = () => {
  // 过滤逻辑已在 computed 中实现
}

const viewPoem = (poem) => {
  viewingPoem.value = poem
  showViewModal.value = true
}

const editPoem = (poem) => {
  editingPoem.value = poem
  poemForm.value = {
    title: poem.title,
    author: poem.author,
    dynasty: poem.dynasty,
    content: poem.content,
    tags: poem.tags
  }
  showAddModal.value = true
}

const closeModal = () => {
  showAddModal.value = false
  editingPoem.value = null
  poemForm.value = { title: '', author: '', dynasty: '', content: '', tags: '' }
}

const savePoem = async () => {
  if (!poemForm.value.title || !poemForm.value.author || !poemForm.value.content) {
    alert('请填写完整信息')
    return
  }
  
  try {
    if (editingPoem.value) {
      await request(`/poems/${editingPoem.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(poemForm.value)
      })
    } else {
      await request('/poems', {
        method: 'POST',
        body: JSON.stringify(poemForm.value)
      })
    }
    closeModal()
    loadPoems()
  } catch (err) {
    console.error('保存诗词失败:', err)
    alert('保存诗词失败')
  }
}

const deletePoem = async (id) => {
  if (!confirm('确定要删除这首诗词吗？')) return
  
  try {
    await request(`/poems/${id}`, { method: 'DELETE' })
    loadPoems()
  } catch (err) {
    console.error('删除诗词失败:', err)
    alert('删除诗词失败')
  }
}

onMounted(() => {
  loadPoems()
})
</script>

<style scoped>
.poem-management {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.page-header h1 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 28px;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 15px;
  align-items: center;
}

.search-input {
  padding: 10px 15px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 10px;
  font-size: 14px;
  width: 200px;
  outline: none;
}

.search-input:focus {
  border-color: #cd853f;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139,69,19,0.3);
}

.btn-secondary {
  padding: 10px 20px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 10px;
  background: rgba(255,255,255,0.9);
  color: #8b4513;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 20px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(139,69,19,0.2);
  border-top: 4px solid #8b4513;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: rgba(255,255,255,0.95);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  box-shadow: 0 4px 15px rgba(139,69,19,0.1);
}

.stat-icon {
  font-size: 32px;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.filter-bar {
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
}

.filter-bar select {
  padding: 10px 15px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 10px;
  background: white;
  color: #5c4033;
  font-size: 14px;
  cursor: pointer;
  min-width: 150px;
}

.poems-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.poem-card {
  background: rgba(255,255,255,0.95);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(139,69,19,0.1);
  transition: all 0.3s ease;
}

.poem-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(139,69,19,0.15);
}

.poem-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.poem-header h3 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0;
  font-size: 18px;
}

.poem-dynasty {
  font-size: 12px;
  color: #999;
  background: rgba(205,133,63,0.1);
  padding: 3px 10px;
  border-radius: 6px;
}

.poem-author {
  color: #a0522d;
  margin: 0 0 10px 0;
  font-size: 14px;
}

.poem-content {
  color: #5c4033;
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.poem-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 15px;
}

.tag {
  font-size: 12px;
  color: #8b4513;
  background: rgba(205,133,63,0.1);
  padding: 3px 10px;
  border-radius: 6px;
}

.poem-actions {
  display: flex;
  gap: 8px;
}

.btn-small {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 8px;
  background: rgba(255,255,255,0.9);
  color: #8b4513;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-small:hover {
  background: linear-gradient(135deg, rgba(205,133,63,0.2), rgba(139,69,19,0.15));
}

.btn-small.secondary {
  background: rgba(205,133,63,0.1);
}

.btn-small.danger {
  color: #dc143c;
  border-color: rgba(220,20,60,0.3);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 30px;
  width: 400px;
  max-width: 90%;
}

.modal-large {
  width: 550px;
}

.modal-content h2 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 20px 0;
}

.form-group {
  margin-bottom: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #5c4033;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  transition: all 0.3s ease;
  font-family: inherit;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #cd853f;
  box-shadow: 0 0 0 3px rgba(205,133,63,0.1);
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.view-author {
  color: #a0522d;
  margin: 0 0 15px 0;
}

.view-content {
  color: #5c4033;
  font-size: 16px;
  line-height: 1.8;
  margin: 0 0 15px 0;
  white-space: pre-wrap;
}

.view-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
