<template>
  <div class="teacher-chart-container">
    <div v-if="loading" class="chart-loading">
      <div class="loading-spinner"></div>
      <p>数据加载中...</p>
    </div>
    <div v-else ref="chartRef" class="chart-wrapper" :style="{ height: height }">
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  type: {
    type: String,
    default: 'line'
  },
  data: {
    type: Object,
    default: () => ({})
  },
  height: {
    type: String,
    default: '400px'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const chartRef = ref(null)
let chart = null

const initChart = () => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    updateChart()
  }
}

const updateChart = () => {
  if (!chart) return
  
  const options = {
    color: ['#8b4513', '#cd853f', '#d2b48c', '#deb887', '#f5deb3', '#ffe4b5'],
    backgroundColor: 'rgba(255, 252, 240, 0.8)',
    borderColor: 'rgba(205, 133, 63, 0.2)',
    borderWidth: 1,
    borderRadius: 16,
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 252, 240, 0.95)',
      borderColor: 'rgba(205, 133, 63, 0.3)',
      textStyle: {
        color: '#8b4513',
        fontFamily: 'SimSun, STSong, serif'
      }
    },
    legend: {
      textStyle: {
        color: '#8b4513',
        fontFamily: 'SimSun, STSong, serif'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      axisLabel: {
        color: '#8b4513',
        fontFamily: 'SimSun, STSong, serif'
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(205, 133, 63, 0.3)'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#8b4513',
        fontFamily: 'SimSun, STSong, serif'
      },
      axisLine: {
        lineStyle: {
          color: 'rgba(205, 133, 63, 0.3)'
        }
      },
      splitLine: {
        lineStyle: {
          color: 'rgba(205, 133, 63, 0.1)'
        }
      }
    },
    ...props.data
  }
  
  chart.setOption(options)
}

const handleResize = () => {
  chart?.resize()
}

watch(() => props.data, () => {
  nextTick(() => {
    updateChart()
  })
}, { deep: true })

watch(() => props.loading, () => {
  nextTick(() => {
    if (!props.loading) {
      updateChart()
    }
  })
})

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

// 暴露方法
defineExpose({
  update: updateChart,
  resize: handleResize
})
</script>

<style scoped>
.teacher-chart-container {
  position: relative;
  border: 1px solid rgba(205, 133, 63, 0.2);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 252, 240, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.chart-wrapper {
  width: 100%;
  transition: all 0.3s ease;
}

.chart-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: #8b4513;
  font-family: 'SimSun', 'STSong', serif;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(205, 133, 63, 0.3);
  border-top: 4px solid #8b4513;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chart-wrapper {
    height: 300px !important;
  }
}

@media (max-width: 480px) {
  .chart-wrapper {
    height: 250px !important;
  }
}
</style>