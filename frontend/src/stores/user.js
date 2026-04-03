import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 带超时的fetch包装函数
const fetchWithTimeout = (url, options = {}, timeout = 8000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`请求超时`));
    }, timeout);
    fetch(url, options)
      .then((res) => { clearTimeout(timer); resolve(res); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
};

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || null)
  const userInfo = ref(null)
  const loading = ref(false)
  const initialized = ref(false)

  const isLoggedIn = computed(() => !!token.value && !!userInfo.value)
  const userId = computed(() => userInfo.value?.id || null)
  const username = computed(() => userInfo.value?.username || '游客')

  async function initUser() {
    if (initialized.value) return
    
    const savedToken = localStorage.getItem('token')
    if (!savedToken) {
      initialized.value = true
      return
    }

    token.value = savedToken
    loading.value = true

    try {
      const response = await fetchWithTimeout('http://localhost:3000/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${savedToken}`
        }
      }, 8000);

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.user) {
          userInfo.value = data.data.user
        } else {
          await logout()
        }
      } else {
        await logout()
      }
    } catch (error) {
      console.error('验证用户信息失败:', error)
      await logout()
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  function login(tokenValue, user) {
    token.value = tokenValue
    userInfo.value = user
    localStorage.setItem('token', tokenValue)
    localStorage.setItem('user', JSON.stringify(user))
  }

  async function logout() {
    token.value = null
    userInfo.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('userInfo')
    localStorage.removeItem('studentId')
    localStorage.removeItem('userRole')
  }

  function setUserInfo(user) {
    userInfo.value = user
    localStorage.setItem('user', JSON.stringify(user))
  }

  return {
    token,
    userInfo,
    loading,
    initialized,
    isLoggedIn,
    userId,
    username,
    initUser,
    login,
    logout,
    setUserInfo
  }
})
