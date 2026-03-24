<template>
  <div class="student-management">
    <div class="page-header">
      <h1>学生管理</h1>
      <div class="header-actions">
        <select v-model="selectedClass" class="class-select" @change="loadStudents">
          <option value="">全部班级</option>
          <option v-for="cls in classes" :key="cls.class_id" :value="cls.class_id">
            {{ cls.class_name || `班级 ${cls.class_id}` }}
          </option>
        </select>
        <button class="btn-primary" @click="showAddModal = true">
          <span>➕</span> 添加学生
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>数据加载中...</p>
    </div>

    <div v-else class="students-section">
      <div class="stats-overview">
        <div class="stat-card">
          <span class="stat-icon">👥</span>
          <div class="stat-info">
            <span class="stat-value">{{ students.length }}</span>
            <span class="stat-label">学生总数</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📚</span>
          <div class="stat-info">
            <span class="stat-value">{{ totalPoems }}</span>
            <span class="stat-label">学习诗词总数</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">⏱️</span>
          <div class="stat-info">
            <span class="stat-value">{{ Math.round(totalStudyTime / 60) }}</span>
            <span class="stat-label">总学习时长(小时)</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🏆</span>
          <div class="stat-info">
            <span class="stat-value">{{ avgLevel }}</span>
            <span class="stat-label">平均闯关关卡</span>
          </div>
        </div>
      </div>

      <div class="students-table-container">
        <table class="students-table">
          <thead>
            <tr>
              <th>学生</th>
              <th>班级</th>
              <th>学习诗词</th>
              <th>学习时长</th>
              <th>闯关关卡</th>
              <th>错题数</th>
              <th>最近学习</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in students" :key="student.id">
              <td>
                <div class="student-info">
                  <div class="student-avatar">{{ (student.username || '学')[0] }}</div>
                  <div>
                    <div class="student-name">{{ student.username }}</div>
                    <div class="student-email">{{ student.email }}</div>
                  </div>
                </div>
              </td>
              <td>{{ getClassName(student.class_id) }}</td>
              <td>{{ student.poem_count || 0 }}首</td>
              <td>{{ Math.round((student.total_study_time || 0) / 60) }}分钟</td>
              <td>第{{ student.highest_level || 0 }}关</td>
              <td>{{ student.error_count || 0 }}</td>
              <td>{{ formatDate(student.last_study_time) }}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn-small" @click="viewStudentDetail(student.id)">详情</button>
                  <button class="btn-small secondary" @click="viewStudentChallenge(student.id)">闯关</button>
                  <button class="btn-small warning" @click="openPasswordModal(student)">改密</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="students.length === 0" class="empty-state">
          <p>暂无学生数据</p>
        </div>
      </div>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <h2>添加学生</h2>
        <div class="form-group">
          <label>用户名</label>
          <input v-model="newStudent.username" type="text" placeholder="请输入用户名" />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="newStudent.email" type="email" placeholder="请输入邮箱" />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="newStudent.password" type="password" placeholder="请输入密码" />
        </div>
        <div class="form-group">
          <label>班级</label>
          <select v-model="newStudent.class_id">
            <option value="">请选择班级</option>
            <option v-for="cls in classes" :key="cls.class_id" :value="cls.class_id">
              {{ cls.class_name || `班级 ${cls.class_id}` }}
            </option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showAddModal = false">取消</button>
          <button class="btn-primary" @click="addStudent">确认添加</button>
        </div>
      </div>
    </div>

    <div v-if="showPasswordModal" class="modal-overlay" @click.self="showPasswordModal = false">
      <div class="modal-content">
        <h2>修改学生密码</h2>
        <p class="modal-subtitle">学生：{{ passwordStudent?.username }}</p>
        <div class="form-group">
          <label>新密码</label>
          <input v-model="newPassword" type="password" placeholder="请输入新密码（至少6位）" />
        </div>
        <div class="form-group">
          <label>确认密码</label>
          <input v-model="confirmPassword" type="password" placeholder="请再次输入新密码" />
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" @click="showPasswordModal = false">取消</button>
          <button class="btn-primary" @click="updatePassword">确认修改</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const loading = ref(true)
const students = ref([])
const classes = ref([])
const selectedClass = ref('')
const showAddModal = ref(false)
const newStudent = ref({
  username: '',
  email: '',
  password: '',
  class_id: ''
})
const showPasswordModal = ref(false)
const passwordStudent = ref(null)
const newPassword = ref('')
const confirmPassword = ref('')

const totalPoems = computed(() => {
  return students.value.reduce((sum, s) => sum + (s.poem_count || 0), 0)
})

const totalStudyTime = computed(() => {
  return students.value.reduce((sum, s) => sum + (s.total_study_time || 0), 0)
})

const avgLevel = computed(() => {
  if (students.value.length === 0) return 0
  const total = students.value.reduce((sum, s) => sum + (s.highest_level || 0), 0)
  return Math.round(total / students.value.length)
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

const loadClasses = async () => {
  try {
    const result = await request('/classes')
    classes.value = result.data || []
  } catch (err) {
    console.error('加载班级失败:', err)
  }
}

const loadStudents = async () => {
  loading.value = true
  try {
    const classId = selectedClass.value || route.query.classId || ''
    let url = '/rankings/overall'
    if (classId) {
      url = `/rankings/class/${classId}`
    }
    
    const result = await request(url)
    let studentList = result.data || []
    
    const progressResult = await request('/challenge/rankings?limit=1000')
    const progressMap = new Map()
    ;(progressResult.data || []).forEach(p => {
      progressMap.set(p.id, p)
    })
    
    students.value = studentList.map(s => ({
      ...s,
      highest_level: progressMap.get(s.id)?.highest_level || 0,
      error_count: progressMap.get(s.id)?.error_count || 0
    }))
  } catch (err) {
    console.error('加载学生失败:', err)
  } finally {
    loading.value = false
  }
}

const addStudent = async () => {
  if (!newStudent.value.username || !newStudent.value.email || !newStudent.value.password) {
    alert('请填写完整信息')
    return
  }
  
  try {
    await request('/students/add', {
      method: 'POST',
      body: JSON.stringify(newStudent.value)
    })
    showAddModal.value = false
    newStudent.value = { username: '', email: '', password: '', class_id: '' }
    loadStudents()
  } catch (err) {
    console.error('添加学生失败:', err)
    alert('添加学生失败')
  }
}

const openPasswordModal = (student) => {
  passwordStudent.value = student
  newPassword.value = ''
  confirmPassword.value = ''
  showPasswordModal.value = true
}

const updatePassword = async () => {
  if (!newPassword.value || newPassword.value.length < 6) {
    alert('密码长度不能少于6位')
    return
  }
  
  if (newPassword.value !== confirmPassword.value) {
    alert('两次输入的密码不一致')
    return
  }
  
  try {
    await request(`/students/${passwordStudent.value.id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword: newPassword.value })
    })
    alert('密码修改成功')
    showPasswordModal.value = false
    passwordStudent.value = null
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    console.error('修改密码失败:', err)
    alert('修改密码失败')
  }
}

const getClassName = (classId) => {
  if (!classId) return '未分配'
  const cls = classes.value.find(c => c.class_id === classId)
  return cls ? (cls.class_name || `班级 ${classId}`) : `班级 ${classId}`
}

const formatDate = (dateStr) => {
  if (!dateStr) return '暂无'
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
}

const viewStudentDetail = (id) => {
  router.push(`/teacher/student/${id}/detail`)
}

const viewStudentChallenge = (id) => {
  router.push(`/teacher/student/${id}/detail?tab=challenge`)
}

onMounted(async () => {
  if (route.query.classId) {
    selectedClass.value = route.query.classId
  }
  await loadClasses()
  await loadStudents()
})
</script>

<style scoped>
.student-management {
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

.class-select {
  padding: 10px 15px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 10px;
  background: white;
  color: #5c4033;
  font-size: 14px;
  cursor: pointer;
  min-width: 150px;
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

.students-table-container {
  background: rgba(255,255,255,0.95);
  border-radius: 20px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(139,69,19,0.1);
  overflow-x: auto;
}

.students-table {
  width: 100%;
  border-collapse: collapse;
}

.students-table th {
  text-align: left;
  padding: 15px 12px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  border-bottom: 2px solid rgba(205,133,63,0.2);
}

.students-table td {
  padding: 15px 12px;
  border-bottom: 1px solid rgba(205,133,63,0.1);
  color: #5c4033;
  font-size: 14px;
}

.students-table tr:hover {
  background: rgba(205,133,63,0.05);
}

.student-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.student-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
}

.student-name {
  font-weight: 500;
  color: #5c4033;
}

.student-email {
  font-size: 12px;
  color: #999;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-small {
  padding: 6px 12px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 6px;
  background: rgba(255,255,255,0.9);
  color: #8b4513;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-small:hover {
  background: linear-gradient(135deg, rgba(205,133,63,0.2), rgba(139,69,19,0.15));
}

.btn-small.secondary {
  background: rgba(205,133,63,0.1);
}

.btn-small.warning {
  background: rgba(220, 53, 69, 0.1);
  border-color: rgba(220, 53, 69, 0.3);
  color: #dc3545;
}

.btn-small.warning:hover {
  background: rgba(220, 53, 69, 0.2);
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

.modal-content h2 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 10px 0;
}

.modal-subtitle {
  color: #666;
  font-size: 14px;
  margin: 0 0 20px 0;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(205,133,63,0.2);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #5c4033;
  font-size: 14px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  transition: all 0.3s ease;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #cd853f;
  box-shadow: 0 0 0 3px rgba(205,133,63,0.1);
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
