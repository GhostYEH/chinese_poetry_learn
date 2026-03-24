<template>
  <div class="teacher-layout">
    <main class="teacher-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const teacherName = ref('教师')

const handleLogout = () => {
  localStorage.removeItem('teacherToken')
  localStorage.removeItem('teacher')
  localStorage.removeItem('teacherInfo')
  router.push('/teacher/login')
}

onMounted(() => {
  const teacher = localStorage.getItem('teacher')
  if (teacher) {
    try {
      const teacherData = JSON.parse(teacher)
      teacherName.value = teacherData.username || '教师'
    } catch (e) {
      console.error('解析教师信息失败', e)
    }
  }
})
</script>

<style scoped>
.teacher-layout {
  min-height: 100vh;
  background: linear-gradient(135deg, rgba(205,133,63,0.05) 0%, rgba(139,69,19,0.1) 100%);
}

.teacher-main {
  padding-top: 100px;
  padding-bottom: 30px;
  min-height: 100vh;
}
</style>