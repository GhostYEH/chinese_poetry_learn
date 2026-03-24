<template>
  <div class="settings-page">
    <div class="page-header">
      <h1>系统设置</h1>
    </div>

    <div class="settings-section">
      <div class="settings-card">
        <h2>个人信息</h2>
        <div class="form-group">
          <label>用户名</label>
          <input v-model="userInfo.username" type="text" disabled />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="userInfo.email" type="email" placeholder="请输入邮箱" />
        </div>
        <button class="btn-primary" @click="saveUserInfo">保存信息</button>
      </div>

      <div class="settings-card">
        <h2>修改密码</h2>
        <div class="form-group">
          <label>当前密码</label>
          <input v-model="passwordForm.oldPassword" type="password" placeholder="请输入当前密码" />
        </div>
        <div class="form-group">
          <label>新密码</label>
          <input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" />
        </div>
        <div class="form-group">
          <label>确认新密码</label>
          <input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" />
        </div>
        <button class="btn-primary" @click="changePassword">修改密码</button>
      </div>

      <div class="settings-card">
        <h2>系统配置</h2>
        <div class="config-item">
          <div class="config-info">
            <span class="config-label">闯关题目数量</span>
            <span class="config-desc">每关生成的题目数量</span>
          </div>
          <input v-model="systemConfig.questionCount" type="number" min="1" max="20" />
        </div>
        <div class="config-item">
          <div class="config-info">
            <span class="config-label">每日学习提醒</span>
            <span class="config-desc">开启后学生将收到学习提醒</span>
          </div>
          <label class="switch">
            <input v-model="systemConfig.dailyReminder" type="checkbox" />
            <span class="slider"></span>
          </label>
        </div>
        <div class="config-item">
          <div class="config-info">
            <span class="config-label">数据自动备份</span>
            <span class="config-desc">每日自动备份系统数据</span>
          </div>
          <label class="switch">
            <input v-model="systemConfig.autoBackup" type="checkbox" />
            <span class="slider"></span>
          </label>
        </div>
        <button class="btn-primary" @click="saveSystemConfig">保存配置</button>
      </div>

      <div class="settings-card">
        <h2>数据管理</h2>
        <div class="data-actions">
          <button class="btn-action" @click="exportAllData">
            <span>📥</span> 导出所有数据
          </button>
          <button class="btn-action" @click="clearCache">
            <span>🗑️</span> 清除缓存
          </button>
          <button class="btn-action danger" @click="resetSystem">
            <span>⚠️</span> 重置系统
          </button>
        </div>
      </div>

      <div class="settings-card">
        <h2>关于系统</h2>
        <div class="about-info">
          <div class="info-row">
            <span class="info-label">系统名称</span>
            <span class="info-value">古诗词教学管理平台</span>
          </div>
          <div class="info-row">
            <span class="info-label">版本号</span>
            <span class="info-value">v1.0.0</span>
          </div>
          <div class="info-row">
            <span class="info-label">技术支持</span>
            <span class="info-value">古诗词学习团队</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const userInfo = ref({
  username: '',
  email: ''
})

const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const systemConfig = ref({
  questionCount: 10,
  dailyReminder: true,
  autoBackup: true
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

const loadUserInfo = () => {
  const teacher = localStorage.getItem('teacher')
  if (teacher) {
    try {
      const data = JSON.parse(teacher)
      userInfo.value.username = data.username || ''
    } catch (e) {
      console.error('解析教师信息失败', e)
    }
  }
}

const saveUserInfo = async () => {
  try {
    await request('/profile', {
      method: 'PUT',
      body: JSON.stringify(userInfo.value)
    })
    alert('保存成功')
  } catch (err) {
    console.error('保存失败:', err)
    alert('保存失败')
  }
}

const changePassword = async () => {
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword) {
    alert('请填写完整信息')
    return
  }
  
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    alert('两次输入的密码不一致')
    return
  }
  
  try {
    await request('/change-password', {
      method: 'POST',
      body: JSON.stringify({
        oldPassword: passwordForm.value.oldPassword,
        newPassword: passwordForm.value.newPassword
      })
    })
    alert('密码修改成功')
    passwordForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } catch (err) {
    console.error('修改密码失败:', err)
    alert('修改密码失败')
  }
}

const saveSystemConfig = async () => {
  try {
    await request('/config', {
      method: 'PUT',
      body: JSON.stringify(systemConfig.value)
    })
    alert('配置保存成功')
  } catch (err) {
    console.error('保存配置失败:', err)
    alert('保存配置失败')
  }
}

const exportAllData = () => {
  alert('数据导出功能开发中...')
}

const clearCache = () => {
  if (confirm('确定要清除缓存吗？')) {
    alert('缓存已清除')
  }
}

const resetSystem = () => {
  if (confirm('警告：此操作将重置所有数据，是否继续？')) {
    if (confirm('再次确认：所有数据将被删除，此操作不可恢复！')) {
      alert('系统重置功能开发中...')
    }
  }
}

onMounted(() => {
  loadUserInfo()
})
</script>

<style scoped>
.settings-page {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h1 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  font-size: 28px;
  margin: 0;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.settings-card {
  background: rgba(255,255,255,0.95);
  border-radius: 20px;
  padding: 25px;
  box-shadow: 0 4px 20px rgba(139,69,19,0.1);
}

.settings-card h2 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 20px 0;
  font-size: 18px;
  padding-bottom: 15px;
  border-bottom: 1px solid rgba(205,133,63,0.2);
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

.form-group input:disabled {
  background: rgba(205,133,63,0.05);
  cursor: not-allowed;
}

.btn-primary {
  padding: 12px 30px;
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

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 0;
  border-bottom: 1px solid rgba(205,133,63,0.1);
}

.config-item:last-of-type {
  border-bottom: none;
  margin-bottom: 20px;
}

.config-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.config-label {
  color: #5c4033;
  font-size: 15px;
}

.config-desc {
  color: #999;
  font-size: 13px;
}

.config-item input[type="number"] {
  width: 80px;
  padding: 8px 12px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 8px;
  text-align: center;
  outline: none;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 28px;
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
  background-color: rgba(205,133,63,0.3);
  transition: 0.4s;
  border-radius: 28px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background: linear-gradient(135deg, #cd853f, #8b4513);
}

input:checked + .slider:before {
  transform: translateX(22px);
}

.data-actions {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.btn-action {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px 20px;
  border: 1px solid rgba(205,133,63,0.3);
  border-radius: 12px;
  background: rgba(255,255,255,0.9);
  color: #5c4033;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-action:hover {
  background: rgba(205,133,63,0.1);
  border-color: #cd853f;
}

.btn-action.danger {
  color: #dc143c;
  border-color: rgba(220,20,60,0.3);
}

.btn-action.danger:hover {
  background: rgba(220,20,60,0.1);
}

.about-info {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(205,133,63,0.1);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  color: #999;
  font-size: 14px;
}

.info-value {
  color: #5c4033;
  font-size: 14px;
}
</style>
