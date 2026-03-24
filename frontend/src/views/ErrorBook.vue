<template>
  <div class="error-book">
    <div class="error-book-header">
      <router-link to="/challenge" class="back-link">← 返回闯关</router-link>
      <h1 class="error-book-title">我的错题本</h1>
    </div>

    <div v-if="loading" class="skeleton-error-list">
      <div v-for="i in 3" :key="i" class="skeleton-error-item">
        <div class="skeleton-line skeleton-error-question"></div>
        <div class="skeleton-line skeleton-error-answer"></div>
        <div class="skeleton-line skeleton-error-correct"></div>
        <div class="skeleton-line skeleton-error-action"></div>
      </div>
    </div>

    <div v-else-if="errors.length === 0" class="empty-error-book glass-card">
      <div class="empty-icon">📝</div>
      <h3>暂无错题</h3>
      <p>继续加油，你是最棒的！</p>
    </div>

    <div v-else class="error-list">
      <div
        v-for="item in errors"
        :key="item.id"
        class="error-item glass-card"
      >
        <div class="error-question">
          <span class="question-label">题目：</span>
          {{ item.question_content }}
        </div>
        <div class="error-answer">
          <span class="answer-label">你的答案：</span>
          <span class="wrong-answer">{{ item.user_answer || '未作答' }}</span>
        </div>
        <div class="error-correct">
          <span class="correct-label">正确答案：</span>
          <span class="correct-answer">{{ item.correct_answer }}</span>
        </div>
        <div v-if="item.explanation" class="error-explanation">
          <span class="explanation-label">解析：</span>
          {{ item.explanation }}
        </div>
        <div class="error-actions">
          <span class="error-date">
            {{ formatDate(item.added_at) }}
          </span>
          <button
            class="glass-button delete-btn"
            @click="removeError(item.id)"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';

export default {
  name: 'ErrorBook',
  setup() {
    const router = useRouter();
    const loading = ref(true);
    const errors = ref([]);

    const loadErrors = async () => {
      try {
        loading.value = true;
        const data = await api.challenge.getErrorBook();
        errors.value = data || [];
      } catch (error) {
        console.error('加载错题本失败:', error);
      } finally {
        loading.value = false;
      }
    };

    const removeError = async (id) => {
      if (!confirm('确定要删除这道错题吗？')) return;
      try {
        await api.challenge.removeFromErrorBook(id);
        errors.value = errors.value.filter(item => item.id !== id);
      } catch (error) {
        console.error('删除错题失败:', error);
      }
    };

    const formatDate = (dateStr) => {
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return dateStr;
      }
    };

    onMounted(() => {
      loadErrors();
    });

    return {
      loading,
      errors,
      removeError,
      formatDate
    };
  }
};
</script>

<style scoped>
.error-book {
  max-width: 900px;
  margin: 0 auto;
  padding: 30px 20px;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.05) 0%, rgba(139, 69, 19, 0.1) 100%);
  min-height: 100vh;
  position: relative;
}

.error-book::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="50" font-family="SimSun" font-size="20" text-anchor="middle" fill="rgba(205, 133, 63, 0.06)">错</text></svg>') repeat;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}

.error-book-header {
  margin-bottom: 40px;
  text-align: center;
  position: relative;
  z-index: 1;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  padding: 10px 20px;
  color: #8b4513;
  text-decoration: none;
  font-size: 15px;
  font-family: 'SimSun', 'STSong', serif;
  background: rgba(255, 252, 240, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 16px rgba(139, 69, 19, 0.1);
}

.back-link:hover {
  background: rgba(255, 252, 240, 0.95);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 69, 19, 0.2);
}

.error-book-title {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0;
  font-size: 32px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(139, 69, 19, 0.1);
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: relative;
  z-index: 1;
}

.error-item {
  padding: 28px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.error-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(139, 69, 19, 0.2);
  border-color: rgba(205, 133, 63, 0.4);
}

.error-question {
  font-family: 'SimSun', 'STSong', serif;
  font-size: 19px;
  color: #8b4513;
  margin-bottom: 18px;
  line-height: 1.7;
  background: linear-gradient(135deg, rgba(255, 248, 220, 0.4), rgba(255, 252, 240, 0.2));
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid rgba(205, 133, 63, 0.2);
}

.question-label {
  font-weight: bold;
  color: #a0522d;
}

.error-answer {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.answer-label {
  font-weight: bold;
  color: #5c4033;
  font-family: 'SimSun', 'STSong', serif;
}

.wrong-answer {
  color: #dc143c;
  text-decoration: line-through;
  font-size: 16px;
  font-family: 'SimSun', 'STSong', serif;
  background: rgba(220, 20, 60, 0.1);
  padding: 4px 12px;
  border-radius: 8px;
}

.error-correct {
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.correct-label {
  font-weight: bold;
  color: #5c4033;
  font-family: 'SimSun', 'STSong', serif;
}

.correct-answer {
  color: #32cd32;
  font-weight: bold;
  font-size: 16px;
  font-family: 'SimSun', 'STSong', serif;
  background: rgba(50, 205, 50, 0.1);
  padding: 4px 12px;
  border-radius: 8px;
}

.error-explanation {
  padding: 18px 22px;
  background: linear-gradient(135deg, rgba(255, 248, 220, 0.6), rgba(255, 252, 240, 0.4));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 14px;
  margin-bottom: 18px;
  color: #a0522d;
  line-height: 1.8;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 15px;
}

.explanation-label {
  font-weight: bold;
  color: #8b4513;
}

.error-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 18px;
  border-top: 1px solid rgba(245, 222, 179, 0.7);
}

.error-date {
  color: #a0522d;
  font-size: 14px;
  font-family: 'SimSun', 'STSong', serif;
}

.glass-button {
  padding: 10px 24px;
  background: rgba(205, 133, 63, 0.2);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.35);
  border-radius: 14px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.12);
  white-space: nowrap;
}

.glass-button:hover:not(:disabled) {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 69, 19, 0.2);
}

.glass-button:active:not(:disabled) {
  transform: translateY(0);
}

.delete-btn {
  background: linear-gradient(135deg, rgba(220, 20, 60, 0.3), rgba(178, 34, 34, 0.25));
  color: #dc143c;
  border-color: rgba(220, 20, 60, 0.4);
}

.delete-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(220, 20, 60, 0.4), rgba(178, 34, 34, 0.35));
}

.empty-error-book {
  text-align: center;
  padding: 100px 30px;
  position: relative;
  z-index: 1;
}

.empty-icon {
  font-size: 72px;
  margin-bottom: 24px;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.empty-error-book h3 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: bold;
}

.empty-error-book p {
  color: #a0522d;
  margin: 0;
  font-size: 16px;
  font-family: 'SimSun', 'STSong', serif;
}

.skeleton-error-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: relative;
  z-index: 1;
}

.skeleton-error-item {
  padding: 28px;
  background: rgba(255, 252, 240, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 20px;
}

.skeleton-line {
  background: linear-gradient(90deg, rgba(240, 240, 240, 0.8) 25%, rgba(224, 224, 224, 0.8) 50%, rgba(240, 240, 240, 0.8) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
  margin-bottom: 18px;
}

.skeleton-error-question {
  height: 28px;
  width: 95%;
}

.skeleton-error-answer {
  height: 22px;
  width: 65%;
}

.skeleton-error-correct {
  height: 22px;
  width: 75%;
}

.skeleton-error-action {
  height: 40px;
  width: 90px;
  margin-bottom: 0;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
