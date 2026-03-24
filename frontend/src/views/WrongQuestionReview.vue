<template>
  <div class="wrong-question-review">
    <div class="review-header">
      <router-link to="/challenge" class="back-link">← 返回闯关</router-link>
      <h1 class="review-title">错题复习</h1>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="questions.length === 0" class="empty-review glass-card">
      <div class="empty-icon">🎉</div>
      <h3>暂无错题需要复习</h3>
      <p>太棒了！继续保持！</p>
      <router-link to="/challenge" class="start-challenge-btn">
        去闯关
      </router-link>
    </div>

    <div v-else class="review-container">
      <div class="stats-bar glass-card">
        <div class="stat-item">
          <span class="stat-value">{{ stats.pending }}</span>
          <span class="stat-label">今日待复习</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.mastered }}</span>
          <span class="stat-label">已掌握</span>
        </div>
      </div>

      <div class="question-card glass-card">
        <div class="question-header">
          <span class="question-index">{{ currentIndex + 1 }} / {{ questions.length }}</span>
          <span class="wrong-count">
            错 {{ currentQuestion?.wrong_count || 0 }} 次
          </span>
        </div>

        <div class="poem-info">
          <span class="poem-title">{{ currentQuestion?.title }}</span>
          <span class="poem-author">{{ currentQuestion?.author }}</span>
        </div>

        <div class="question-text">{{ currentQuestion?.question }}</div>

        <div v-if="answerResult" class="answer-result" :class="{ correct: answerResult.correct, wrong: !answerResult.correct }">
          <span v-if="answerResult.correct" class="result-icon">✓</span>
          <span v-else class="result-icon">✗</span>
          <div class="result-text">
            <p v-if="answerResult.correct">回答正确！</p>
            <p v-else>回答错误</p>
            <p class="correct-answer">正确答案: {{ answerResult.correctAnswer }}</p>
            <p v-if="answerResult.mastered" class="mastered-text">🎉 已掌握此题！</p>
          </div>
        </div>

        <div v-if="hints.length > 0" class="hints-container">
          <div 
            v-for="(hint, index) in hints" 
            :key="index"
            class="hint-item"
            :class="{ visible: hintVisible[index] }"
            @click="showHint(index)"
          >
            <span class="hint-label">提示 {{ index + 1 }}</span>
            <span class="hint-text">{{ hint }}</span>
          </div>
        </div>

        <div v-if="!answerResult" class="answer-input-area">
          <input
            v-model="answerInput"
            type="text"
            class="answer-input"
            placeholder="请输入答案..."
            @keyup.enter="submitAnswer"
            :disabled="answerSubmitting"
          />
          <div class="action-buttons">
            <button 
              class="submit-btn"
              @click="submitAnswer"
              :disabled="answerSubmitting || !answerInput.trim()"
            >
              {{ answerSubmitting ? '提交中...' : '提交答案' }}
            </button>
            <button 
              class="hint-btn"
              @click="getHints"
              :disabled="hints.length > 0"
            >
              查看提示
            </button>
          </div>
        </div>

        <div v-else class="result-buttons">
          <button 
            class="master-btn"
            @click="markAsMastered"
            v-if="!answerResult.mastered && !alreadyMastered"
          >
            标记已掌握
          </button>
          <button 
            class="delete-btn"
            @click="deleteQuestion"
          >
            删除错题
          </button>
          <button 
            class="next-btn"
            @click="nextQuestion"
          >
            下一题
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';

export default {
  name: 'WrongQuestionReview',
  setup() {
    const router = useRouter();
    const loading = ref(true);
    const questions = ref([]);
    const currentIndex = ref(0);
    const stats = ref({ pending: 0, mastered: 0, total: 0 });
    const answerInput = ref('');
    const answerSubmitting = ref(false);
    const answerResult = ref(null);
    const hints = ref([]);
    const hintVisible = ref([]);
    const alreadyMastered = ref(false);

    const currentQuestion = computed(() => questions.value[currentIndex.value] || null);

    const loadStats = async () => {
      try {
        stats.value = await api.wrongQuestions.getStats();
      } catch (error) {
        console.error('加载统计失败:', error);
      }
    };

    const loadQuestions = async () => {
      try {
        questions.value = await api.wrongQuestions.getQuestions(20);
      } catch (error) {
        console.error('加载错题失败:', error);
      } finally {
        loading.value = false;
      }
    };

    const submitAnswer = async () => {
      if (!answerInput.value.trim() || !currentQuestion.value) return;

      answerSubmitting.value = true;
      try {
        const result = await api.wrongQuestions.submitAnswer(
          currentQuestion.value.id,
          answerInput.value
        );
        answerResult.value = result;
        alreadyMastered.value = currentQuestion.value.mastered === 1;
        await loadStats();
      } catch (error) {
        console.error('提交答案失败:', error);
        alert('提交答案失败');
      } finally {
        answerSubmitting.value = false;
      }
    };

    const getHints = async () => {
      if (!currentQuestion.value) return;

      try {
        const result = await api.wrongQuestions.getHints({
          question: currentQuestion.value.question,
          answer: currentQuestion.value.answer,
          full_poem: currentQuestion.value.full_poem,
          author: currentQuestion.value.author,
          title: currentQuestion.value.title
        });
        hints.value = [result.hint1, result.hint2, result.hint3];
        hintVisible.value = [false, false, false];
      } catch (error) {
        console.error('获取提示失败:', error);
      }
    };

    const showHint = (index) => {
      hintVisible.value[index] = true;
    };

    const markAsMastered = async () => {
      if (!currentQuestion.value) return;

      try {
        await api.wrongQuestions.markAsMastered(currentQuestion.value.id);
        alreadyMastered.value = true;
        await loadStats();
      } catch (error) {
        console.error('标记已掌握失败:', error);
      }
    };

    const deleteQuestion = async () => {
      if (!currentQuestion.value || !confirm('确定要删除这道错题吗？')) return;

      try {
        await api.wrongQuestions.delete(currentQuestion.value.id);
        questions.value.splice(currentIndex.value, 1);
        if (currentIndex.value >= questions.value.length && questions.value.length > 0) {
          currentIndex.value = questions.value.length - 1;
        }
        resetState();
        await loadStats();
      } catch (error) {
        console.error('删除错题失败:', error);
      }
    };

    const nextQuestion = () => {
      if (currentIndex.value < questions.value.length - 1) {
        currentIndex.value++;
        resetState();
      } else {
        if (confirm('已完成所有错题复习！')) {
          router.push('/challenge');
        }
      }
    };

    const resetState = () => {
      answerInput.value = '';
      answerResult.value = null;
      hints.value = [];
      hintVisible.value = [];
      alreadyMastered.value = false;
    };

    onMounted(() => {
      Promise.all([loadStats(), loadQuestions()]);
    });

    return {
      loading,
      questions,
      currentIndex,
      stats,
      answerInput,
      answerSubmitting,
      answerResult,
      hints,
      hintVisible,
      currentQuestion,
      submitAnswer,
      getHints,
      showHint,
      markAsMastered,
      deleteQuestion,
      nextQuestion
    };
  }
};
</script>

<style scoped>
.wrong-question-review {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px 20px;
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.05) 0%, rgba(139, 69, 19, 0.1) 100%);
  min-height: 100vh;
  position: relative;
}

.wrong-question-review::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="50" y="50" font-family="SimSun" font-size="20" text-anchor="middle" fill="rgba(205, 133, 63, 0.06)">习</text></svg>') repeat;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}

.review-header {
  margin-bottom: 30px;
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

.review-title {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0;
  font-size: 32px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(139, 69, 19, 0.1);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
  position: relative;
  z-index: 1;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(205, 133, 63, 0.2);
  border-top-color: #cd853f;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-container p {
  color: #8b4513;
  margin-top: 20px;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
}

.empty-review {
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

.empty-review h3 {
  font-family: 'SimSun', 'STSong', serif;
  color: #8b4513;
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: bold;
}

.empty-review p {
  color: #a0522d;
  margin: 0;
  font-size: 16px;
  font-family: 'SimSun', 'STSong', serif;
  margin-bottom: 30px;
}

.start-challenge-btn {
  display: inline-block;
  padding: 14px 40px;
  font-size: 16px;
  font-weight: 500;
  color: #8b4513;
  background: rgba(205, 133, 63, 0.2);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.35);
  border-radius: 20px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.12);
  font-family: 'SimSun', 'STSong', serif;
}

.start-challenge-btn:hover {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 69, 19, 0.2);
}

.review-container {
  position: relative;
  z-index: 1;
}

.stats-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
  margin-bottom: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.stat-label {
  font-size: 14px;
  color: #a0522d;
  font-family: 'SimSun', 'STSong', serif;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: linear-gradient(to bottom, transparent, rgba(205, 133, 63, 0.3), transparent);
}

.question-card {
  padding: 32px;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.question-index {
  font-size: 14px;
  color: #a0522d;
  font-family: 'SimSun', 'STSong', serif;
  background: rgba(205, 133, 63, 0.15);
  padding: 6px 16px;
  border-radius: 20px;
}

.wrong-count {
  font-size: 14px;
  color: #dc143c;
  font-family: 'SimSun', 'STSong', serif;
  background: rgba(220, 20, 60, 0.1);
  padding: 6px 16px;
  border-radius: 20px;
}

.poem-info {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(205, 133, 63, 0.2);
}

.poem-title {
  font-size: 18px;
  font-weight: bold;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.poem-author {
  font-size: 16px;
  color: #a0522d;
  font-family: 'SimSun', 'STSong', serif;
}

.question-text {
  font-size: 24px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  line-height: 1.8;
  text-align: center;
  padding: 30px 20px;
  background: linear-gradient(135deg, rgba(255, 248, 220, 0.4), rgba(255, 252, 240, 0.2));
  border-radius: 16px;
  margin-bottom: 24px;
}

.answer-result {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  margin-bottom: 24px;
}

.answer-result.correct {
  background: rgba(50, 205, 50, 0.1);
  border: 1px solid rgba(50, 205, 50, 0.3);
}

.answer-result.wrong {
  background: rgba(220, 20, 60, 0.1);
  border: 1px solid rgba(220, 20, 60, 0.3);
}

.result-icon {
  font-size: 32px;
  font-weight: bold;
}

.answer-result.correct .result-icon {
  color: #32cd32;
}

.answer-result.wrong .result-icon {
  color: #dc143c;
}

.result-text {
  flex: 1;
}

.result-text p {
  margin: 6px 0;
  font-family: 'SimSun', 'STSong', serif;
}

.correct-answer {
  color: #32cd32;
  font-weight: bold;
}

.mastered-text {
  color: #ffd700;
  font-weight: bold;
}

.hints-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.hint-item {
  padding: 16px;
  background: rgba(255, 248, 220, 0.6);
  border: 1px solid rgba(205, 133, 63, 0.25);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.hint-item:hover {
  background: rgba(255, 248, 220, 0.8);
}

.hint-label {
  font-size: 14px;
  color: #a0522d;
  font-family: 'SimSun', 'STSong', serif;
  font-weight: bold;
  margin-right: 12px;
}

.hint-text {
  font-size: 15px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.hint-item.visible .hint-text {
  opacity: 1;
}

.answer-input-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.answer-input {
  width: 100%;
  padding: 16px 20px;
  font-size: 18px;
  border: 2px solid rgba(205, 133, 63, 0.3);
  border-radius: 16px;
  outline: none;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  transition: all 0.3s ease;
}

.answer-input:focus {
  border-color: #cd853f;
  box-shadow: 0 0 0 3px rgba(205, 133, 63, 0.1);
}

.answer-input::placeholder {
  color: rgba(139, 69, 19, 0.4);
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.submit-btn,
.hint-btn,
.master-btn,
.delete-btn,
.next-btn {
  flex: 1;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 500;
  color: #8b4513;
  background: rgba(205, 133, 63, 0.2);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.35);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(139, 69, 19, 0.12);
  font-family: 'SimSun', 'STSong', serif;
}

.submit-btn:hover:not(:disabled),
.hint-btn:hover:not(:disabled),
.master-btn:hover:not(:disabled),
.delete-btn:hover:not(:disabled),
.next-btn:hover:not(:disabled) {
  background: rgba(205, 133, 63, 0.3);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(139, 69, 19, 0.2);
}

.submit-btn:disabled,
.hint-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.submit-btn {
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.3), rgba(139, 69, 19, 0.2));
  color: #fff;
  border-color: rgba(205, 133, 63, 0.5);
}

.submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(205, 133, 63, 0.4), rgba(139, 69, 19, 0.3));
}

.delete-btn {
  background: linear-gradient(135deg, rgba(220, 20, 60, 0.2), rgba(178, 34, 34, 0.15));
  color: #dc143c;
  border-color: rgba(220, 20, 60, 0.4);
}

.delete-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(220, 20, 60, 0.3), rgba(178, 34, 34, 0.25));
}

.result-buttons {
  display: flex;
  gap: 12px;
}

.glass-card {
  background: rgba(255, 252, 240, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
  position: relative;
  overflow: hidden;
}

.glass-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
}

@media (max-width: 768px) {
  .question-card {
    padding: 20px;
  }
  
  .question-text {
    font-size: 20px;
    padding: 20px 16px;
  }
  
  .action-buttons,
  .result-buttons {
    flex-direction: column;
  }
  
  .stat-value {
    font-size: 28px;
  }
}
</style>
