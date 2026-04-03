<template>
  <div class="login-page teacher-login-page">
    <div class="bg-layer"></div>

    <div class="floating-elements">
      <div class="float-poem" v-for="(poem, i) in floatingPoems" :key="i" :style="poem.style">
        {{ poem.char }}
      </div>
    </div>

    <div class="login-wrapper">
      <div class="left-panel">
        <div class="panel-content">
          <div class="brand-area">
            <div class="brand-icon">
              <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="40" r="38" stroke="rgba(205,133,63,0.4)" stroke-width="2"/>
                <circle cx="40" cy="40" r="30" stroke="rgba(205,133,63,0.3)" stroke-width="1.5"/>
                <path d="M25 40 Q40 20 55 40 Q40 60 25 40Z" fill="rgba(205,133,63,0.15)" stroke="#cd853f" stroke-width="1.5"/>
                <text x="40" y="45" text-anchor="middle" font-family="SimSun" font-size="14" fill="#cd853f">师</text>
              </svg>
            </div>
            <h1 class="brand-name">《智韵·灵犀》</h1>
            <p class="brand-subtitle">古诗词智能学习系统</p>
          </div>

          <div class="poem-showcase">
            <div class="poem-text">
              <p class="poem-line">{{ displayPoem.line }}</p>
              <p class="poem-author">—— {{ displayPoem.credit }}</p>
            </div>
          </div>

          <div class="features-list">
            <div class="feature-item" v-for="(f, i) in features" :key="i" :style="{ animationDelay: `${0.3 + i * 0.1}s` }">
              <span class="feature-icon">{{ f.icon }}</span>
              <span class="feature-text">{{ f.text }}</span>
            </div>
          </div>
        </div>

        <div class="brush-strokes">
          <svg class="stroke-svg" viewBox="0 0 400 20" preserveAspectRatio="none">
            <path d="M0,10 Q100,2 200,10 Q300,18 400,10" stroke="rgba(205,133,63,0.3)" stroke-width="2" fill="none"/>
          </svg>
        </div>
      </div>

      <div class="right-panel">
        <div class="login-card">
          <div class="card-top-line"></div>

          <div class="card-header">
            <h2 class="card-title">欢迎登录</h2>
            <p class="card-subtitle">开启您的诗词教学之旅</p>
          </div>

          <form @submit.prevent="handleLogin" class="login-form-inner">
            <div class="input-group" :class="{ 'has-value': form.username, 'is-focused': focusedField === 'username' }">
              <div class="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div class="input-field-wrap">
                <input
                  type="text"
                  id="username"
                  v-model="form.username"
                  required
                  placeholder="请输入教师账号"
                  @focus="focusedField = 'username'"
                  @blur="focusedField = ''"
                >
                <div class="input-underline"></div>
              </div>
            </div>

            <div class="input-group" :class="{ 'has-value': form.password, 'is-focused': focusedField === 'password' }">
              <div class="input-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div class="input-field-wrap">
                <input
                  type="password"
                  id="password"
                  v-model="form.password"
                  required
                  placeholder="请输入密码"
                  @focus="focusedField = 'password'"
                  @blur="focusedField = ''"
                >
                <div class="input-underline"></div>
              </div>
            </div>

            <transition name="error-fade">
              <div v-if="error" class="error-banner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{{ error }}</span>
              </div>
            </transition>

            <button type="submit" class="login-btn" :class="{ 'is-loading': loading }" :disabled="loading">
              <span class="btn-bg-effect"></span>
              <span class="btn-text">
                <span v-if="loading" class="btn-spinner"></span>
                {{ loading ? '登录中...' : '登 录' }}
              </span>
              <span class="btn-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </span>
            </button>

            <div class="card-links">
              <p class="link-item">
                还没有账号？ <router-link to="/teacher/register" class="link-emphasis">教师注册</router-link>
              </p>
              <p class="link-item">
                学生登录？ <a href="#" class="link-normal" @click.prevent="switchToStudentLogin">切换到学生登录</a>
              </p>
            </div>
          </form>

          <div class="card-bottom-decor">
            <span class="decor-dot"></span>
            <span class="decor-line"></span>
            <span class="decor-dot"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { LOGIN_POEMS } from '../../data/loginPoems.js'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const focusedField = ref('')

const form = ref({
  username: '',
  password: ''
})

const floatingPoems = ref([])

const displayPoem = ref({
  line: LOGIN_POEMS[0].line,
  credit: LOGIN_POEMS[0].credit,
})

function pickRandomPoem() {
  const i = Math.floor(Math.random() * LOGIN_POEMS.length)
  displayPoem.value = LOGIN_POEMS[i]
}

const features = [
  { icon: '📊', text: '管理看板：班级与学生学情一览' },
  { icon: '👥', text: '班级 / 学生档案与进度跟踪' },
  { icon: '📖', text: '诗词库维护与教学内容统一' },
  { icon: '⚔️', text: '对战与闯关数据汇总分析' },
]

const poemChars = ['春', '夏', '秋', '冬', '风', '花', '雪', '月', '山', '水', '云', '教', '学', '师', '生', '课', '诗', '书', '德', '育', '心', '远', '天', '地', '文', '墨']

onMounted(() => {
  pickRandomPoem()
  for (let i = 0; i < 15; i++) {
    floatingPoems.value.push({
      char: poemChars[Math.floor(Math.random() * poemChars.length)],
      style: {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 10}s`,
        animationDuration: `${15 + Math.random() * 20}s`,
        fontSize: `${12 + Math.random() * 10}px`,
        opacity: 0.08 + Math.random() * 0.08,
      }
    })
  }
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
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('userInfo')
      localStorage.removeItem('studentId')
      localStorage.removeItem('userRole')

      localStorage.setItem('teacherToken', data.token)
      localStorage.setItem('teacher', JSON.stringify(data.teacher))
      localStorage.setItem('teacherInfo', JSON.stringify(data.teacher))
      localStorage.setItem('currentLoginType', 'teacher')

      router.push('/teacher/dashboard').then(() => {
        window.location.reload()
      })
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
  localStorage.setItem('currentLoginType', 'student')
  router.push('/login')
}
</script>

<style scoped>
/* 与学生端 Login.vue 布局一致；position:fixed 完全脱离 App.vue 布局，不再产生双滚动 */
.login-page {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #1a0f05 0%, #2d1810 40%, #1a0f05 100%);
}

.bg-layer {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 50%, rgba(205,133,63,0.12) 0%, transparent 70%),
    radial-gradient(ellipse 60% 80% at 80% 20%, rgba(139,69,19,0.1) 0%, transparent 60%),
    radial-gradient(ellipse 50% 50% at 50% 80%, rgba(205,133,63,0.08) 0%, transparent 50%);
  animation: bgPulse 12s ease-in-out infinite;
}

@keyframes bgPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

.floating-elements {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.float-poem {
  position: absolute;
  font-family: 'SimSun', 'STSong', serif;
  color: #cd853f;
  animation: floatUp linear infinite;
  user-select: none;
}

@keyframes floatUp {
  0% {
    transform: translateY(100vh) rotate(0deg);
    opacity: 0;
  }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% {
    transform: translateY(-100px) rotate(360deg);
    opacity: 0;
  }
}

.login-wrapper {
  position: relative;
  z-index: 1;
  display: flex;
  width: 920px;
  max-width: min(920px, 92vw);
  height: auto;
  max-height: min(86vh, 640px);
  border-radius: 20px;
  overflow-x: hidden;
  overflow-y: auto;
  box-shadow:
    0 25px 80px rgba(0, 0, 0, 0.6),
    0 8px 30px rgba(0, 0, 0, 0.4),
    inset 0 0 0 1px rgba(205, 133, 63, 0.2);
  animation: wrapperIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes wrapperIn {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.left-panel {
  flex: 1;
  min-width: 0;
  background: linear-gradient(160deg, rgba(45, 24, 16, 0.95), rgba(26, 15, 5, 0.98));
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px 28px;
  position: relative;
  border-right: 1px solid rgba(205, 133, 63, 0.15);
  overflow: hidden;
}

.left-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><text x="30" y="35" font-family="SimSun" font-size="20" text-anchor="middle" fill="rgba(205,133,63,0.06)">诗</text></svg>') repeat;
  pointer-events: none;
}

.panel-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.brand-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  width: 56px;
  height: 56px;
  animation: iconRotate 20s linear infinite;
}

@keyframes iconRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.brand-icon svg {
  width: 100%;
  height: 100%;
}

.brand-name {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 24px;
  font-weight: bold;
  color: #cd853f;
  letter-spacing: 6px;
  text-shadow: 0 2px 10px rgba(205, 133, 63, 0.3);
  margin: 0;
}

.brand-subtitle {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  color: rgba(205, 133, 63, 0.6);
  letter-spacing: 4px;
  margin: 0;
}

.poem-showcase {
  text-align: center;
  padding: 14px 16px;
  background: rgba(205, 133, 63, 0.05);
  border: 1px solid rgba(205, 133, 63, 0.1);
  border-radius: 12px;
  position: relative;
}

.poem-showcase::before,
.poem-showcase::after {
  content: '"';
  position: absolute;
  font-family: Georgia, serif;
  font-size: 32px;
  color: rgba(205, 133, 63, 0.2);
  line-height: 1;
}

.poem-showcase::before { top: 2px; left: 10px; }
.poem-showcase::after { bottom: -6px; right: 10px; }

.poem-line {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
  color: rgba(255, 240, 210, 0.9);
  letter-spacing: 2px;
  margin: 0 0 6px 0;
  line-height: 1.55;
}

.poem-author {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
  color: rgba(205, 133, 63, 0.5);
  letter-spacing: 2px;
  margin: 0;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
  color: rgba(205, 133, 63, 0.7);
  opacity: 0;
  animation: featureIn 0.6s ease forwards;
}

@keyframes featureIn {
  from { opacity: 0; transform: translateX(-16px); }
  to { opacity: 1; transform: translateX(0); }
}

.feature-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.feature-text {
  letter-spacing: 1px;
}

.brush-strokes {
  position: absolute;
  bottom: 14px;
  left: 0;
  right: 0;
  padding: 0 32px;
  opacity: 0.5;
}

.stroke-svg {
  width: 100%;
  height: 14px;
}

.right-panel {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px 22px;
  background: linear-gradient(180deg, rgba(255, 252, 240, 0.98), rgba(255, 248, 235, 0.98));
  position: relative;
  overflow-y: auto;
}

.login-card {
  width: 100%;
  max-width: 296px;
  margin: 0 auto;
  position: relative;
}

.card-top-line {
  height: 3px;
  background: linear-gradient(90deg, transparent, #cd853f, #8b4513, #cd853f, transparent);
  border-radius: 2px;
  margin-bottom: 18px;
  animation: lineShimmer 3s ease-in-out infinite;
}

@keyframes lineShimmer {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.card-header {
  text-align: center;
  margin-bottom: 18px;
}

.card-title {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 24px;
  font-weight: bold;
  color: #5a2d0c;
  letter-spacing: 4px;
  margin: 0 0 6px 0;
}

.card-subtitle {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
  color: rgba(139, 69, 19, 0.5);
  letter-spacing: 3px;
  margin: 0;
}

.login-form-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
  border-bottom: 1.5px solid rgba(205, 133, 63, 0.15);
  transition: border-color 0.3s ease;
}

.input-group.is-focused {
  border-bottom-color: rgba(205, 133, 63, 0.4);
}

.input-icon {
  width: 20px;
  height: 20px;
  color: rgba(139, 69, 19, 0.4);
  flex-shrink: 0;
  transition: color 0.3s ease;
}

.input-group.is-focused .input-icon {
  color: #cd853f;
}

.input-icon svg {
  width: 100%;
  height: 100%;
}

.input-field-wrap {
  flex: 1;
  position: relative;
}

.input-field-wrap input {
  width: 100%;
  padding: 8px 4px;
  font-size: 16px;
  border: none;
  background: transparent;
  font-family: 'SimSun', 'STSong', serif;
  color: #3a1d0a;
  letter-spacing: 1px;
  outline: none;
}

.input-field-wrap input::placeholder {
  color: rgba(139, 69, 19, 0.3);
}

.input-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.3s ease;
  border-radius: 1px;
}

.input-group.is-focused .input-underline {
  transform: scaleX(1);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(200, 60, 60, 0.08);
  border: 1px solid rgba(200, 60, 60, 0.15);
  border-radius: 10px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
  color: #c0392b;
}

.error-banner svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.error-fade-enter-active { transition: all 0.3s ease; }
.error-fade-enter-from { opacity: 0; transform: translateY(-6px); }
.error-fade-leave-active { transition: all 0.2s ease; }
.error-fade-leave-to { opacity: 0; transform: translateY(-6px); }

.login-btn {
  position: relative;
  width: 100%;
  padding: 11px 14px;
  background: linear-gradient(135deg, #8b4513, #cd853f, #a0522d);
  color: #fff8f0;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  font-weight: 600;
  font-family: 'SimSun', 'STSong', serif;
  letter-spacing: 6px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow:
    0 4px 16px rgba(139, 69, 19, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.1) inset;
  margin-top: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    0 8px 24px rgba(139, 69, 19, 0.4),
    0 1px 0 rgba(255, 255, 255, 0.15) inset;
  background: linear-gradient(135deg, #a0522d, #cd853f, #b87333);
}

.login-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow:
    0 2px 8px rgba(139, 69, 19, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.1) inset;
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-bg-effect {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
  pointer-events: none;
}

.btn-text {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.btn-arrow {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.login-btn:hover:not(:disabled) .btn-arrow {
  transform: translateX(4px);
}

.btn-arrow svg {
  width: 100%;
  height: 100%;
}

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.card-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.link-item {
  text-align: center;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 13px;
  color: rgba(139, 69, 19, 0.5);
  margin: 0;
}

.link-emphasis {
  color: #cd853f;
  text-decoration: none;
  font-weight: bold;
  transition: color 0.2s ease;
  border-bottom: 1px solid transparent;
}

.link-emphasis:hover {
  color: #8b4513;
  border-bottom-color: #8b4513;
}

.link-normal {
  color: #8b4513;
  text-decoration: none;
  transition: color 0.2s ease;
}

.link-normal:hover {
  color: #cd853f;
}

.card-bottom-decor {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 14px;
}

.decor-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(205, 133, 63, 0.3);
}

.decor-line {
  width: 60px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(205,133,63,0.3), transparent);
}

@media (max-width: 768px) {
  .login-wrapper {
    flex-direction: column;
    width: 100%;
    max-width: 100vw;
    height: auto;
    min-height: 100vh;
    border-radius: 0;
    box-shadow: none;
    overflow-y: auto;
  }

  .login-page {
    overflow-y: auto;
  }

  .left-panel {
    padding: 40px 24px;
    border-right: none;
    border-bottom: 1px solid rgba(205, 133, 63, 0.15);
    min-height: auto;
  }

  .features-list {
    display: none;
  }

  .poem-showcase {
    padding: 16px;
  }

  .poem-line {
    font-size: 15px;
  }

  .right-panel {
    width: 100%;
    padding: 32px 24px;
    overflow-y: visible;
  }

  .brand-name {
    font-size: 22px;
  }

  .card-title {
    font-size: 22px;
  }
}
</style>
