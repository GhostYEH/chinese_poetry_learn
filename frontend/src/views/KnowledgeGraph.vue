<template>
  <div class="knowledge-graph-page">
    <div class="graph-header">
      <h1>🗺️ 诗词知识图谱</h1>
      <div class="controls">
        <select v-model="selectedType" @change="loadGraphData">
          <option value="author">按作者</option>
          <option value="theme">按主题</option>
          <option value="dynasty">按朝代</option>
        </select>
      </div>
    </div>
    <div ref="graphContainerRef" class="graph-container"></div>
    <div class="graph-legend">
      <div class="legend-item" v-for="item in legend" :key="item.name">
        <span class="legend-color" :style="{ background: item.color }"></span>
        <span class="legend-name">{{ item.name }}</span>
      </div>
    </div>
    <!-- 节点详情弹窗 -->
    <div class="node-detail-modal" v-if="selectedNode" @click.self="selectedNode = null">
      <div class="modal-content">
        <button class="modal-close" @click="selectedNode = null">×</button>
        <h2>{{ selectedNode.name }}</h2>
        <div class="modal-body">
          <p v-if="selectedNode.author"><strong>作者：</strong>{{ selectedNode.author }}</p>
          <p v-if="selectedNode.dynasty"><strong>朝代：</strong>{{ selectedNode.dynasty }}</p>
          <p v-if="selectedNode.tags"><strong>主题：</strong>{{ selectedNode.tags }}</p>
          <p v-if="selectedNode.relatedCount" class="related-count">
            相关诗词：{{ selectedNode.relatedCount }}首
          </p>
        </div>
        <button class="btn-explore" @click="exploreNode">探索相关诗词 →</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import api from '../services/api'

const router = useRouter()
const graphContainerRef = ref(null)
const selectedType = ref('author')
const selectedNode = ref(null)
let chart = null

const legend = [
  { name: '作者', color: '#e74c3c' },
  { name: '主题', color: '#3498db' },
  { name: '朝代', color: '#27ae60' },
  { name: '诗词', color: '#f39c12' }
]

// 模拟知识图谱数据
const generateGraphData = (type) => {
  const nodes = []
  const links = []
  const categories = [
    { name: '作者', color: '#e74c3c' },
    { name: '主题', color: '#3498db' },
    { name: '朝代', color: '#27ae60' },
    { name: '诗词', color: '#f39c12' }
  ]

  if (type === 'author') {
    // 作者节点
    const authors = [
      { name: '李白', dynasty: '唐', poems: 30, color: '#e74c3c' },
      { name: '杜甫', dynasty: '唐', poems: 25, color: '#e74c3c' },
      { name: '白居易', dynasty: '唐', poems: 20, color: '#e74c3c' },
      { name: '王维', dynasty: '唐', poems: 18, color: '#e74c3c' },
      { name: '苏轼', dynasty: '宋', poems: 22, color: '#e74c3c' },
      { name: '辛弃疾', dynasty: '宋', poems: 15, color: '#e74c3c' }
    ]
    const themes = [
      { name: '山水', poems: 10, color: '#3498db' },
      { name: '思乡', poems: 8, color: '#3498db' },
      { name: '友情', poems: 7, color: '#3498db' },
      { name: '爱国', poems: 5, color: '#3498db' },
      { name: '春天', poems: 9, color: '#3498db' }
    ]
    const dynasties = [
      { name: '唐', count: 5, color: '#27ae60' },
      { name: '宋', count: 2, color: '#27ae60' }
    ]

    authors.forEach((a, i) => {
      nodes.push({
        name: a.name,
        value: a.poems,
        category: 0,
        author: a.author,
        dynasty: a.dynasty,
        itemStyle: { color: a.color },
        symbolSize: Math.max(30, a.poems * 1.5)
      })
      links.push({ source: a.dynasty, target: a.name, value: a.poems * 2 })
    })

    themes.forEach((t, i) => {
      nodes.push({
        name: t.name,
        value: t.poems,
        category: 1,
        tags: t.name,
        itemStyle: { color: t.color },
        symbolSize: Math.max(25, t.poems * 2.5)
      })
    })

    dynasties.forEach(d => {
      nodes.push({
        name: d.name,
        value: d.count * 10,
        category: 2,
        itemStyle: { color: d.color },
        symbolSize: 50
      })
    })

    // 连接作者与主题
    links.push({ source: '李白', target: '山水', value: 5 })
    links.push({ source: '李白', target: '思乡', value: 3 })
    links.push({ source: '杜甫', target: '爱国', value: 8 })
    links.push({ source: '杜甫', target: '思乡', value: 5 })
    links.push({ source: '王维', target: '山水', value: 10 })
    links.push({ source: '白居易', target: '友情', value: 6 })
    links.push({ source: '苏轼', target: '山水', value: 4 })
    links.push({ source: '苏轼', target: '思乡', value: 6 })
    links.push({ source: '辛弃疾', target: '爱国', value: 10 })

  } else if (type === 'theme') {
    const themes = [
      { name: '山水', count: 25, color: '#3498db' },
      { name: '思乡', count: 20, color: '#3498db' },
      { name: '友情', count: 18, color: '#3498db' },
      { name: '爱国', count: 15, color: '#3498db' },
      { name: '春天', count: 22, color: '#3498db' },
      { name: '秋天', count: 16, color: '#3498db' }
    ]

    themes.forEach(t => {
      nodes.push({
        name: t.name,
        value: t.count,
        category: 1,
        tags: t.name,
        itemStyle: { color: t.color },
        symbolSize: Math.max(35, t.count * 2)
      })
    })

    // 主题间的关联
    links.push({ source: '春天', target: '山水', value: 5 })
    links.push({ source: '秋天', target: '思乡', value: 8 })
    links.push({ source: '山水', target: '友情', value: 3 })

  } else {
    const dynasties = [
      { name: '唐', count: 50, color: '#27ae60' },
      { name: '宋', count: 40, color: '#27ae60' },
      { name: '诗经', count: 15, color: '#27ae60' },
      { name: '楚辞', count: 10, color: '#27ae60' }
    ]

    dynasties.forEach(d => {
      nodes.push({
        name: d.name,
        value: d.count,
        category: 2,
        itemStyle: { color: d.color },
        symbolSize: Math.max(40, d.count * 0.8)
      })
    })
  }

  return { nodes, links, categories }
}

const loadGraphData = () => {
  if (!chart) return

  const { nodes, links, categories } = generateGraphData(selectedType.value)

  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        if (params.dataType === 'edge') return ''
        return `<strong>${params.name}</strong><br/>相关数量: ${params.value || 0}`
      }
    },
    legend: {
      data: categories.map(c => c.name),
      bottom: 10
    },
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes.map(n => ({
        ...n,
        id: n.name
      })),
      links: links,
      categories: categories,
      roam: true,
      label: {
        show: true,
        formatter: '{b}',
        fontSize: 12,
        color: '#333'
      },
      lineStyle: {
        color: 'source',
        curveness: 0.3,
        width: 2
      },
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 4 }
      },
      force: {
        repulsion: 100,
        edgeLength: [60, 150],
        layoutAnimation: true
      }
    }]
  })

  // 添加点击事件
  chart.off('click')
  chart.on('click', (params) => {
    if (params.dataType === 'node') {
      const node = nodes.find(n => n.name === params.name)
      if (node) {
        selectedNode.value = {
          ...node,
          relatedCount: links.filter(l => l.source === node.name || l.target === node.name).length
        }
      }
    }
  })
}

const exploreNode = () => {
  if (!selectedNode.value) return
  const node = selectedNode.value

  if (node.category === 0) {
    // 作者
    router.push({ path: '/search', query: { author: node.name } })
  } else if (node.category === 1) {
    // 主题
    router.push({ path: '/search', query: { tag: node.name } })
  }
  selectedNode.value = null
}

const initChart = () => {
  if (!graphContainerRef.value) return
  if (chart) chart.dispose()

  chart = echarts.init(graphContainerRef.value)
  loadGraphData()

  window.addEventListener('resize', () => chart?.resize())
}

const handleResize = () => {
  chart?.resize()
}

onMounted(async () => {
  await nextTick()
  initChart()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>

<style scoped>
.knowledge-graph-page {
  height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.graph-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.graph-header h1 {
  font-size: 24px;
  color: #8b4513;
  margin: 0;
}

.controls select {
  padding: 8px 16px;
  border: 2px solid rgba(139,69,19,0.2);
  border-radius: 10px;
  font-size: 14px;
  background: white;
  color: #8b4513;
  cursor: pointer;
}

.graph-container {
  flex: 1;
  background: rgba(255,255,255,0.95);
  border-radius: 20px;
  min-height: 500px;
}

.graph-legend {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 16px;
  padding: 16px;
  background: rgba(255,255,255,0.9);
  border-radius: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: inline-block;
}

.legend-name {
  font-size: 14px;
  color: #666;
}

.node-detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 30px;
  width: 400px;
  max-width: 90%;
  position: relative;
}

.modal-close {
  position: absolute;
  top: 10px;
  right: 15px;
  font-size: 24px;
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
}

.modal-close:hover { color: #333; }

.modal-content h2 {
  font-size: 22px;
  color: #8b4513;
  margin-bottom: 16px;
  padding-right: 30px;
}

.modal-body p {
  margin: 8px 0;
  font-size: 14px;
  color: #666;
}

.modal-body strong { color: #8b4513; }

.related-count {
  margin-top: 16px;
  padding: 12px;
  background: rgba(139,69,19,0.08);
  border-radius: 10px;
  font-weight: bold;
  color: #8b4513 !important;
}

.btn-explore {
  width: 100%;
  margin-top: 20px;
  padding: 12px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-explore:hover { transform: scale(1.02); }
</style>
