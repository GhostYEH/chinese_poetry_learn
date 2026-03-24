<template>
  <div class="teacher-card" @click="handleClick" :class="{ 'clickable': clickable }">
    <div v-if="loading" class="card-loading">
      <div class="loading-spinner"></div>
    </div>
    <div v-else class="card-content">
      <h3 class="card-title">{{ title }}</h3>
      <p class="card-value">{{ value }}</p>
      <p v-if="subtext" class="card-subtext">{{ subtext }}</p>
      <div v-if="tags" class="card-tags">
        <span v-for="tag in tags" :key="tag" class="card-tag">{{ tag }}</span>
      </div>
      <div v-if="actions" class="card-actions">
        <button
          v-for="action in actions"
          :key="action.label"
          :class="['action-btn', action.type]"
          @click.stop="action.callback"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  value: {
    type: [String, Number],
    default: ''
  },
  subtext: {
    type: String,
    default: ''
  },
  tags: {
    type: Array,
    default: () => []
  },
  actions: {
    type: Array,
    default: () => []
  },
  clickable: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['click'])

const handleClick = () => {
  if (props.clickable) {
    emit('click')
  }
}
</script>

<style scoped>
.teacher-card {
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 20px;
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.teacher-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(139, 69, 19, 0.2);
  border-color: rgba(205, 133, 63, 0.3);
}

.teacher-card.clickable {
  cursor: pointer;
}

.card-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(205, 133, 63, 0.3);
  border-top: 3px solid #8b4513;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card-title {
  margin: 0;
  color: #666;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
  font-weight: 500;
}

.card-value {
  margin: 0;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 28px;
  font-weight: bold;
}

.card-subtext {
  margin: 0;
  color: #999;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 14px;
  line-height: 1.4;
}

.card-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 5px;
}

.card-tag {
  padding: 4px 12px;
  background: rgba(205, 133, 63, 0.1);
  color: #8b4513;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 12px;
  font-size: 12px;
  font-family: 'SimSun', 'STSong', serif;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.action-btn {
  padding: 6px 12px;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'SimSun', 'STSong', serif;
}

.action-btn.primary {
  background: rgba(139, 69, 19, 0.8);
  color: #fff;
  border-color: #8b4513;
}

.action-btn.primary:hover {
  background: rgba(139, 69, 19, 1);
  transform: translateY(-2px);
}

.action-btn.secondary {
  background: rgba(205, 133, 63, 0.1);
  color: #8b4513;
}

.action-btn.secondary:hover {
  background: rgba(205, 133, 63, 0.2);
  transform: translateY(-2px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .teacher-card {
    padding: 15px;
  }
  
  .card-value {
    font-size: 24px;
  }
  
  .card-title {
    font-size: 14px;
  }
  
  .card-subtext {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .teacher-card {
    padding: 12px;
  }
  
  .card-value {
    font-size: 20px;
  }
  
  .card-actions {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
  }
}
</style>