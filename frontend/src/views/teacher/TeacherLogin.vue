<template>
  <div class="login-container">
    <div class="login-form">
      <h2>教师登录</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">用户名</label>
          <input 
            type="text" 
            id="username" 
            v-model="form.username" 
            required 
            placeholder="请输入教师账号"
          >
        </div>
        <div class="form-group">
          <label for="password">密码</label>
          <input 
            type="password" 
            id="password" 
            v-model="form.password" 
            required 
            placeholder="请输入密码"
          >
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="loading">
            <span v-if="loading" class="loading-spinner"></span>
            {{ loading ? '登录中...' : '登录' }}
          </button>
          <p class="register-link">
            还没有账号？ <router-link to="/teacher/register">立即注册</router-link>
          </p>
          <p class="student-link">
            学生登录？ <a href="#" @click.prevent="switchToStudentLogin">切换到学生登录</a>
          </p>
        </div>
      </form>
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const form = ref({
  username: '',
  password: ''
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await fetch('http://localhost:3000/api/teacher/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(form.value)
    })
    
    const data = await response.json()
    
    if (data.token) {
      // 清除学生相关数据
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('userInfo')
      localStorage.removeItem('studentId')
      localStorage.removeItem('userRole')
      
      // 存储教师相关数据到localStorage
      localStorage.setItem('teacherToken', data.token)
      localStorage.setItem('teacher', JSON.stringify(data.teacher))
      localStorage.setItem('teacherInfo', JSON.stringify(data.teacher))
      // 设置当前登录类型为教师
      localStorage.setItem('currentLoginType', 'teacher')
      
      // 跳转到教师看板
      router.push('/teacher/dashboard')
    } else {
      error.value = data.error || '登录失败'
    }
  } catch (err) {
    error.value = '网络错误，请稍后重试'
    console.error('登录失败:', err)
  } finally {
    loading.value = false
  }
}

const switchToStudentLogin = () => {
  // 设置当前登录类型为学生
  localStorage.setItem('currentLoginType', 'student')
  // 跳转到学生登录页
  router.push('/login')
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.1) 0%, rgba(139, 69, 19, 0.2) 100%);
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* 装饰元素 */
.login-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="50" font-family="SimSun" font-size="20" text-anchor="middle" fill="rgba(205, 133, 63, 0.1)">师</text></svg>') repeat;
  opacity: 0.5;
  z-index: 0;
}

.login-form {
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 40px;
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
  width: 100%;
  max-width: 400px;
  position: relative;
  z-index: 1;
  transition: all 0.3s ease;
}

.login-form:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(139, 69, 19, 0.2);
  border-color: rgba(205, 133, 63, 0.3);
}

.login-form h2 {
  margin-bottom: 30px;
  color: #8b4513;
  text-align: center;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 24px;
  font-weight: bold;
  position: relative;
}

.login-form h2::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  border-radius: 3px;
}

.form-group {
  margin-bottom: 20px;
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #666;
  font-weight: 500;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: all 0.3s ease;
  font-family: 'SimSun', 'STSong', serif;
  transform: translateY(0);
  position: relative;
  z-index: 1;
}

.form-group input:focus {
  outline: none;
  border-color: #cd853f;
  box-shadow: 0 0 0 2px rgba(205, 133, 63, 0.1);
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-2px);
  border-image: linear-gradient(90deg, #cd853f, #8b4513) 1;
}

.form-actions {
  margin-top: 30px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: rgba(205, 133, 63, 0.2);
  color: #8b4513;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'SimSun', 'STSong', serif;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
  position: relative;
  overflow: hidden;
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
  box-shadow: 0 2px 8px rgba(139, 69, 19, 0.2);
}

.btn-primary:hover:not(:disabled) {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.25);
}

.btn-primary:disabled {
  background: #a0a0a0;
  cursor: not-allowed;
  border-color: #a0a0a0;
  transform: none;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.15);
}

.register-link {
  margin-top: 15px;
  text-align: center;
  color: #666;
  font-size: 14px;
  font-family: 'SimSun', 'STSong', serif;
}

.student-link {
  margin-top: 10px;
  text-align: center;
  color: #666;
  font-size: 14px;
  font-family: 'SimSun', 'STSong', serif;
}

.register-link a,
.student-link a {
  color: #8b4513;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
}

.register-link a:hover,
.student-link a:hover {
  color: #cd853f;
  text-decoration: underline;
}

.error-message {
  margin-top: 15px;
  padding: 10px 16px;
  background: rgba(244, 67, 54, 0.1);
  color: #c62828;
  border: 1px solid rgba(244, 67, 54, 0.2);
  border-radius: 8px;
  font-size: 14px;
  font-family: 'SimSun', 'STSong', serif;
  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.1);
  animation: fadeInSlide 0.4s ease forwards;
  opacity: 0;
  transform: translateY(10px);
}

@keyframes fadeInSlide {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 加载动画 */
.loading-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(139, 69, 19, 0.1);
  border-radius: 50%;
  border-top-color: #8b4513;
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .login-form {
    padding: 30px;
  }
  
  .login-form h2 {
    font-size: 20px;
  }
  
  .form-group input {
    padding: 10px 14px;
  }
  
  .btn-primary {
    padding: 10px;
  }
}

@media (max-width: 480px) {
  .login-container {
    padding: 15px;
  }
  
  .login-form {
    padding: 20px;
  }
  
  .login-form h2 {
    font-size: 18px;
  }
  
  .form-group input {
    padding: 8px 12px;
  }
  
  .btn-primary {
    padding: 8px;
  }
}
</style>