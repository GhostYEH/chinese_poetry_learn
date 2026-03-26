<template>
  <div class="demo-mode-page">
    <div class="demo-overlay" v-if="active">
      <div class="demo-controls">
      </div>

      <!-- 演示步骤 -->
      <div class="demo-step" v-if="currentStep < steps.length">
        <div class="step-indicator">
          <span class="step-badge">{{ currentStep + 1 }} / {{ steps.length }}</span>
          <span class="step-title">{{ steps[currentStep].title }}</span>
        </div>
        <div class="step-description">
          {{ steps[currentStep].description }}
        </div>
        <div class="step-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: ((currentStep + 1) / steps.length * 100) + '%' }"></div>
          </div>
        </div>
        <div class="step-actions">
          <button class="btn-skip" @click="exitDemo">跳过演示</button>
          <button class="btn-next" @click="nextStep">继续 →</button>
        </div>
      </div>

      <!-- 演示完成 -->
      <div class="demo-complete" v-else>
        <h2>🎉 演示完成</h2>
        <p>感谢观看！以下是系统主要功能入口：</p>
        <div class="feature-grid">
          <div class="feature-card" @click="goTo('/learning-path')">
            <span class="feature-icon">📚</span>
            <span class="feature-name">学习路径</span>
          </div>
          <div class="feature-card" @click="goTo('/daily')">
            <span class="feature-icon">☀️</span>
            <span class="feature-name">每日一诗</span>
          </div>
          <div class="feature-card" @click="goTo('/feihualing/online')">
            <span class="feature-icon">⚔️</span>
            <span class="feature-name">飞花令对战</span>
          </div>
          <div class="feature-card" @click="goTo('/poetry-challenge')">
            <span class="feature-icon">🎨</span>
            <span class="feature-name">诗词创作</span>
          </div>
          <div class="feature-card" @click="goTo('/knowledge-graph')">
            <span class="feature-icon">🗺️</span>
            <span class="feature-name">知识图谱</span>
          </div>
          <div class="feature-card" @click="goTo('/voice-recitation')">
            <span class="feature-icon">🎤</span>
            <span class="feature-name">语音背诵</span>
          </div>
          <div class="feature-card" @click="goTo('/challenge')">
            <span class="feature-icon">🏆</span>
            <span class="feature-name">诗词闯关</span>
          </div>
          <div class="feature-card" @click="goTo('/dashboard')">
            <span class="feature-icon">📊</span>
            <span class="feature-name">学习仪表盘</span>
          </div>
        </div>
        <button class="btn-exit" @click="exitDemo">退出演示</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const active = ref(false)
const currentStep = ref(0)

const steps = [
  {
    title: '个性化学习路径',
    description: '系统根据你的学习数据，自动评估你的诗词水平，并生成专属学习路径。包括AI能力模型雷达图，直观展示你的记忆、理解、应用、创作四大能力。'
  },
  {
    title: 'AI学习讲解',
    description: '答错题目时，AI自动生成详细讲解：诗句含义、关键词解读、记忆技巧。让你知其然更知其所以然。'
  },
  {
    title: '每日一诗 + 打卡',
    description: '每天推荐一首精选诗词，一键打卡记录学习。连续打卡激励养成学习习惯，还有周历视图直观展示学习轨迹。'
  },
  {
    title: '飞花令排位赛',
    description: '在线实时对战飞花令，系统自动计算ELO积分和段位。从青铜到王者，证明你的诗词实力！'
  },
  {
    title: '智能错题复习',
    description: '基于艾宾浩斯遗忘曲线，智能安排复习计划。错题自动分类（记忆/理解/应用），针对性强化训练。'
  },
  {
    title: '诗词创作挑战',
    description: '选择主题，AI为你创作诗词。你来评分！在趣味互动中感受诗词创作魅力，激发学习兴趣。'
  },
  {
    title: '语音背诵检测',
    description: '对着麦克风背诵诗词，AI实时语音识别并评测。错别字、漏字一目了然，还有个性化学习建议。'
  },
  {
    title: '诗词知识图谱',
    description: '可视化展示诗人、主题、朝代之间的关系。点击任意节点，探索诗词世界的关联之美。'
  }
]

const nextStep = () => {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  } else {
    currentStep.value = steps.length
  }
}

const exitDemo = () => {
  active.value = false
  router.push('/')
}

const goTo = (path) => {
  active.value = false
  router.push(path)
}

const startDemo = () => {
  active.value = true
  currentStep.value = 0
}

onMounted(() => {
  // 演示模式由URL参数控制
  const params = new URLSearchParams(window.location.search)
  if (params.get('demo') === 'true') {
    startDemo()
  }
})

// 暴露给外部调用
defineExpose({ startDemo })
</script>

<style scoped>
.demo-mode-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  pointer-events: none;
}

.demo-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
}

.demo-step {
  background: white;
  border-radius: 24px;
  padding: 40px;
  width: 90%;
  max-width: 600px;
  text-align: center;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.step-badge {
  padding: 6px 16px;
  background: rgba(139,69,19,0.1);
  color: #8b4513;
  border-radius: 20px;
  font-size: 14px;
  font-weight: bold;
}

.step-title {
  font-size: 24px;
  color: #8b4513;
  font-weight: bold;
}

.step-description {
  font-size: 16px;
  color: #666;
  line-height: 1.8;
  margin-bottom: 24px;
  min-height: 80px;
}

.step-progress {
  margin-bottom: 24px;
}

.progress-bar {
  height: 6px;
  background: rgba(139,69,19,0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.step-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.btn-skip, .btn-next {
  padding: 12px 32px;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  border: none;
  transition: transform 0.2s;
}

.btn-skip {
  background: rgba(139,69,19,0.1);
  color: #8b4513;
}

.btn-next {
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
}

.btn-skip:hover, .btn-next:hover { transform: scale(1.05); }

.demo-complete {
  background: white;
  border-radius: 24px;
  padding: 40px;
  width: 90%;
  max-width: 700px;
  text-align: center;
}

.demo-complete h2 {
  font-size: 28px;
  color: #8b4513;
  margin-bottom: 12px;
}

.demo-complete p {
  color: #666;
  margin-bottom: 24px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.feature-card {
  background: rgba(139,69,19,0.05);
  border-radius: 12px;
  padding: 16px 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.feature-card:hover {
  background: rgba(139,69,19,0.15);
  transform: translateY(-2px);
}

.feature-icon { font-size: 28px; }
.feature-name { font-size: 12px; color: #8b4513; }

.btn-exit {
  padding: 14px 40px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-exit:hover { transform: scale(1.05); }

@media (max-width: 600px) {
  .feature-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
