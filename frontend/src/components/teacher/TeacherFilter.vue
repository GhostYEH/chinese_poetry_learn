<template>
  <div class="teacher-filter-container">
    <div class="filter-section">
      <h3 class="filter-title">{{ title }}</h3>
      <div class="filter-options">
        <button
          v-for="option in options"
          :key="option.value"
          :class="['filter-btn', { active: selectedValue === option.value }]"
          @click="handleSelect(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
    
    <!-- 自定义日期范围选择器 -->
    <div v-if="showDatePicker" class="date-picker-section">
      <div class="date-inputs">
        <div class="date-input-group">
          <label>开始日期</label>
          <input type="date" v-model="startDate" @change="handleDateChange" />
        </div>
        <div class="date-input-group">
          <label>结束日期</label>
          <input type="date" v-model="endDate" @change="handleDateChange" />
        </div>
        <button class="apply-date-btn" @click="applyDateRange">
          应用
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: '时间筛选'
  },
  options: {
    type: Array,
    default: () => [
      { label: '今日', value: 'today' },
      { label: '本周', value: 'week' },
      { label: '本月', value: 'month' },
      { label: '自定义', value: 'custom' }
    ]
  },
  modelValue: {
    type: String,
    default: 'today'
  }
})

const emit = defineEmits(['update:modelValue', 'filterChange'])

const selectedValue = ref(props.modelValue)
const showDatePicker = ref(false)
const startDate = ref('')
const endDate = ref('')

const handleSelect = (value) => {
  selectedValue.value = value
  emit('update:modelValue', value)
  
  if (value === 'custom') {
    showDatePicker.value = true
  } else {
    showDatePicker.value = false
    emit('filterChange', { type: value })
  }
}

const handleDateChange = () => {
  // 可以在这里添加日期验证
}

const applyDateRange = () => {
  if (startDate.value && endDate.value) {
    emit('filterChange', {
      type: 'custom',
      startDate: startDate.value,
      endDate: endDate.value
    })
  }
}

watch(() => props.modelValue, (newValue) => {
  selectedValue.value = newValue
  showDatePicker.value = newValue === 'custom'
})
</script>

<style scoped>
.teacher-filter-container {
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  padding: 20px;
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 16px;
  margin-bottom: 20px;
  box-shadow: 0 8px 32px rgba(139, 69, 19, 0.15);
  transition: all 0.3s ease;
}

.teacher-filter-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(139, 69, 19, 0.2);
  border-color: rgba(205, 133, 63, 0.3);
}

.filter-section {
  margin-bottom: 15px;
}

.filter-title {
  margin: 0 0 15px 0;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
  position: relative;
}

.filter-title::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 2px;
  background: linear-gradient(90deg, #cd853f, #8b4513);
  border-radius: 2px;
}

.filter-options {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.filter-btn {
  padding: 8px 16px;
  background: rgba(205, 133, 63, 0.1);
  color: #8b4513;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'SimSun', 'STSong', serif;
}

.filter-btn:hover {
  background: rgba(205, 133, 63, 0.2);
  border-color: rgba(205, 133, 63, 0.5);
  transform: translateY(-2px);
}

.filter-btn.active {
  background: rgba(139, 69, 19, 0.8);
  color: #fff;
  border-color: #8b4513;
}

.date-picker-section {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid rgba(205, 133, 63, 0.2);
}

.date-inputs {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  flex-wrap: wrap;
  justify-content: center;
}

.date-input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.date-input-group label {
  font-size: 14px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.date-input-group input {
  padding: 8px 12px;
  border: 1px solid rgba(205, 133, 63, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.8);
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.apply-date-btn {
  padding: 8px 16px;
  background: rgba(139, 69, 19, 0.8);
  color: #fff;
  border: 1px solid #8b4513;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'SimSun', 'STSong', serif;
  height: 36px;
}

.apply-date-btn:hover {
  background: rgba(139, 69, 19, 1);
  transform: translateY(-2px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .teacher-filter-container {
    padding: 15px;
  }
  
  .filter-options {
    flex-direction: column;
    align-items: center;
  }
  
  .filter-btn {
    width: 100%;
    max-width: 200px;
  }
  
  .date-inputs {
    flex-direction: column;
    align-items: center;
  }
  
  .date-input-group {
    width: 100%;
    max-width: 200px;
  }
  
  .apply-date-btn {
    width: 100%;
    max-width: 200px;
  }
}

@media (max-width: 480px) {
  .teacher-filter-container {
    padding: 10px;
  }
  
  .filter-title {
    font-size: 14px;
  }
  
  .filter-btn {
    padding: 6px 12px;
    font-size: 12px;
  }
}
</style>