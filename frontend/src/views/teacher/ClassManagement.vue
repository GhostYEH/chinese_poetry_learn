<template>
  <div class="class-management">
    <div class="page-header">
      <h1>班级管理</h1>
      <button class="btn-primary" @click="showAddModal = true">
        <span>➕</span> 添加班级
      </button>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>数据加载中...</p>
    </div>

    <div v-else class="classes-grid">
      <div v-for="cls in classes" :key="cls.class_id" class="class-card">
        <div class="class-header">
          <h3>{{ cls.class_name || `班级 ${cls.class_id}` }}</h3>
          <span class="class-id">ID: {{ cls.class_id }}</span>
        </div>
        <div class="class-stats">
          <div class="stat-item">
            <span class="stat-label">学生人数</span>
            <span class="stat-value">{{ cls.total_students || 0 }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">学习诗词</span>
            <span class="stat-value">{{ cls.total_poems_studied || 0 }}首</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均学习时长</span>
            <span class="stat-value">{{ Math.round(cls.avg_study_time || 0) }}分钟</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">平均完成率</span>
            <span class="stat-value">{{ Math.round((cls.avg_completion_rate || 0) * 100) }}%</span>
          </div>
        </div>
        <div class="class-actions">
          <button class="btn-action" @click="viewClassDetail(cls.class_id)">查看详情</button>
          <button class="btn-action secondary" @click="viewClassStudents(cls.class_id)">学生列表</button>
        </div>
      </div>

      <div v-if="classes.length === 0" class="empty-state">
        <p>暂无班级数据</p>
        <p class="hint">点击上方"添加班级"按钮创建新班级</p>
      </div>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <h2>添加班级</h2>
        <div class="form-group">
          <label>班级名称</label>
          <input v-model="newClassName" type="text" placeholder="请输入班级名称" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showAddModal = false">取消</button>
          <button class="btn-primary" @click="addClass">确认添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const classes = ref([])
const showAddModal = ref(false)
const newClassName = ref('')

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

const loadClasses = async () => {
  loading.value = true
  try {
    const result = await request('/classes')
    classes.value = result.data || []
  } catch (err) {
    console.error('加载班级失败:', err)
  } finally {
    loading.value = false
  }
}

const addClass = async () => {
  if (!newClassName.value.trim()) {
    alert('请输入班级名称')
    return
  }
  
  try {
    await request('/classes/add', {
      method: 'POST',
      body: JSON.stringify({ className: newClassName.value })
    })
    showAddModal.value = false
    newClassName.value = ''
    loadClasses()
  } catch (err) {
    console.error('添加班级失败:', err)
    alert('添加班级失败')
  }
}

const viewClassDetail = (classId) => {
  router.push(`/teacher/class/${classId}`)
}

const viewClassStudents = (classId) => {
  router.push({ path: '/teacher/students', query: { classId } })
}

onMounted(() => {
  loadClasses()
})
</script>

<style scoped>
.class-management {
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

.btn-secondary:hover {
  background: rgba(205,133,63,0.1);
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

.classes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.class-card {
  background: rgba(255,255,255,0.95);
  border-radius: 20px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(139,69,19,0.1);
  transition: all 0.3s ease;
}

.class-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(139,69,19,0.15);
}

.class-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(205,133,63,0.2);
}

.class-header h3 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0;
  font-size: 20px;
}

.class-id {
  font-size: 12px;
  color: #999;
  background: rgba(205,133,63,0.1);
  padding: 4px 10px;
  border-radius: 6px;
}

.class-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.class-actions {
  display: flex;
  gap: 10px;
}

.btn-action {
  flex: 1;
  padding: 10px 15px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 10px;
  background: rgba(255,255,255,0.9);
  color: #8b4513;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-action:hover {
  background: linear-gradient(135deg, rgba(205,133,63,0.2), rgba(139,69,19,0.15));
  border-color: #cd853f;
}

.btn-action.secondary {
  background: rgba(205,133,63,0.1);
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-state p {
  margin: 5px 0;
}

.hint {
  font-size: 14px;
  color: #bbb;
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

.modal-content h2 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 20px 0;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #5c4033;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  transition: all 0.3s ease;
}

.form-group input:focus {
  border-color: #cd853f;
  box-shadow: 0 0 0 3px rgba(205,133,63,0.1);
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
