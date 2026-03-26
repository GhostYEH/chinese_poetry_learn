<template>
  <div class="voice-recitation-page">
    <div class="recitation-header">
      <h1>🎤 语音背诵</h1>
      <p class="subtitle">朗读诗词，AI智能评测你的发音和背诵</p>
    </div>

    <!-- 诗词选择 -->
    <div class="poem-select-section" v-if="!selectedPoem">
      <h2>选择要背诵的诗词</h2>
      <input
        v-model="searchKeyword"
        type="text"
        placeholder="搜索诗词..."
        class="search-input"
      />
      <div class="poem-list">
        <div
          v-for="poem in filteredPoems"
          :key="poem.id"
          class="poem-item"
          @click="selectPoem(poem)"
        >
          <h3>{{ poem.title }}</h3>
          <p>{{ poem.author }} · {{ poem.dynasty }}</p>
        </div>
      </div>
    </div>

    <!-- 背诵区域 -->
    <div class="recitation-area" v-if="selectedPoem">
      <button class="btn-back" @click="selectedPoem = null">← 返回选择</button>

      <div class="poem-display">
        <h2>{{ selectedPoem.title }}</h2>
        <p class="poem-author">{{ selectedPoem.author }} · {{ selectedPoem.dynasty }}</p>
        <div class="poem-content-display">
          <p v-for="(line, i) in poemLines" :key="i">{{ line }}</p>
        </div>
      </div>

      <!-- 录音控制 -->
      <div class="record-controls">
        <div class="record-status">
          <div
            class="record-indicator"
            :class="{ recording: isRecording, processing: isProcessing }"
          >
            <div class="pulse-ring" v-if="isRecording"></div>
            <span class="record-icon">{{ isRecording ? '🔴' : isProcessing ? '⏳' : '🎤' }}</span>
          </div>
          <p class="status-text">{{ statusText }}</p>
        </div>

        <button
          class="btn-record"
          :class="{ recording: isRecording }"
          @click="toggleRecording"
          :disabled="isProcessing"
        >
          {{ isRecording ? '⏹️ 停止' : '🎤 开始背诵' }}
        </button>

        <button
          class="btn-compare"
          @click="showCompare = true"
          v-if="transcript"
        >
          📊 查看对比结果
        </button>
      </div>

      <!-- 识别结果 -->
      <div class="transcript-result" v-if="transcript">
        <h3>识别结果</h3>
        <p class="transcript-text">{{ transcript }}</p>
        <div class="transcript-actions">
          <button @click="checkRecitation">🔍 AI评测</button>
        </div>
      </div>

      <!-- 评测结果 -->
      <div class="score-result" v-if="scoreResult">
        <div class="score-circle">
          <svg viewBox="0 0 100 100">
            <circle class="bg" cx="50" cy="50" r="45" />
            <circle
              class="progress"
              cx="50"
              cy="50"
              r="45"
              :style="{ strokeDashoffset: 283 - (283 * scoreResult.score) / 100 }"
            />
          </svg>
          <div class="score-text">
            <span class="score-num">{{ scoreResult.score }}</span>
            <span class="score-label">分</span>
          </div>
        </div>
        <div class="score-details">
          <h3>评测详情</h3>
          <div class="detail-item" v-if="scoreResult.wrongChars?.length > 0">
            <span class="detail-icon">❌</span>
            <span>错别字：{{ scoreResult.wrongChars.map(w => w.input + '→' + w.original).join('，') }}</span>
          </div>
          <div class="detail-item" v-if="scoreResult.missing?.length > 0">
            <span class="detail-icon">➖</span>
            <span>漏字：{{ scoreResult.missing.map(m => m.char).join('，') }}</span>
          </div>
          <div class="detail-item" v-if="scoreResult.extra?.length > 0">
            <span class="detail-icon">➕</span>
            <span>多字：{{ scoreResult.extra.map(e => e.char).join('，') }}</span>
          </div>
          <div class="ai-advice">
            <h4>💡 学习建议</h4>
            <p>{{ scoreResult.aiAdvice }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 对比弹窗 -->
    <div class="compare-modal" v-if="showCompare && transcript" @click.self="showCompare = false">
      <div class="compare-content">
        <button class="modal-close" @click="showCompare = false">×</button>
        <h2>原文 vs 背诵对比</h2>
        <div class="compare-grid">
          <div class="compare-original">
            <h3>原文</h3>
            <p>{{ selectedPoem.content }}</p>
          </div>
          <div class="compare-recited">
            <h3>背诵</h3>
            <p>{{ transcript }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from '../services/api'

const searchKeyword = ref('')
const selectedPoem = ref(null)
const poems = ref([])
const isRecording = ref(false)
const isProcessing = ref(false)
const transcript = ref('')
const showCompare = ref(false)
const scoreResult = ref(null)
let recognition = null
let finalTranscript = ''

const poemLines = computed(() => {
  if (!selectedPoem.value?.content) return []
  return selectedPoem.value.content.split(/[，,。.]/).filter(l => l.trim())
})

const filteredPoems = computed(() => {
  if (!searchKeyword.value) return poems.value.slice(0, 20)
  const kw = searchKeyword.value.toLowerCase()
  return poems.value.filter(p =>
    p.title.toLowerCase().includes(kw) ||
    p.author.toLowerCase().includes(kw)
  ).slice(0, 20)
})

const statusText = computed(() => {
  if (isProcessing.value) return '处理中...'
  if (isRecording.value) return '正在录制...请开始背诵'
  if (transcript.value) return '录制完成'
  return '点击按钮开始背诵'
})

const loadPoems = async () => {
  try {
    const res = await api.poems.getAll()
    poems.value = res.data || []
  } catch (error) {
    console.error('加载诗词列表失败:', error)
  }
}

const selectPoem = (poem) => {
  selectedPoem.value = poem
  transcript.value = ''
  scoreResult.value = null
}

const toggleRecording = () => {
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

const startRecording = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    alert('抱歉，您的浏览器不支持语音识别')
    return
  }

  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = true

  recognition.onstart = () => {
    isRecording.value = true
    finalTranscript = ''
  }

  recognition.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript_piece = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += transcript_piece
      } else {
        interim += transcript_piece
      }
    }
    transcript.value = finalTranscript + interim
  }

  recognition.onerror = (event) => {
    console.error('语音识别错误:', event.error)
    isRecording.value = false
  }

  recognition.onend = () => {
    isRecording.value = false
    transcript.value = finalTranscript
  }

  recognition.start()
  isRecording.value = true
}

const stopRecording = () => {
  if (recognition) {
    recognition.stop()
  }
  isRecording.value = false
}

const checkRecitation = async () => {
  if (!transcript.value || !selectedPoem.value) return

  isProcessing.value = true
  try {
    const res = await api.ai.reciteCheck({
      original: selectedPoem.value.content,
      input: transcript.value,
      poem_id: selectedPoem.value.id,
      poem_title: selectedPoem.value.title,
      poem_author: selectedPoem.value.author
    })
    scoreResult.value = res
  } catch (error) {
    console.error('评测失败:', error)
    alert('评测失败，请重试')
  } finally {
    isProcessing.value = false
  }
}

onMounted(() => {
  loadPoems()
})

onUnmounted(() => {
  if (recognition) {
    recognition.abort()
  }
})
</script>

<style scoped>
.voice-recitation-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.recitation-header {
  text-align: center;
  margin-bottom: 30px;
}

.recitation-header h1 { font-size: 32px; color: #8b4513; margin-bottom: 8px; }
.subtitle { color: #666; }

.poem-select-section h2 {
  font-size: 18px;
  color: #8b4513;
  margin-bottom: 16px;
  text-align: center;
}

.search-input {
  width: 100%;
  padding: 12px 20px;
  border: 2px solid rgba(139,69,19,0.2);
  border-radius: 12px;
  font-size: 16px;
  margin-bottom: 20px;
  box-sizing: border-box;
}

.poem-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
}

.poem-item {
  background: rgba(255,255,255,0.9);
  border: 1px solid rgba(139,69,19,0.15);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.poem-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(139,69,19,0.15);
}

.poem-item h3 { font-size: 16px; color: #8b4513; margin-bottom: 4px; }
.poem-item p { font-size: 13px; color: #666; margin: 0; }

.recitation-area {
  background: rgba(255,255,255,0.95);
  border-radius: 24px;
  padding: 30px;
}

.btn-back {
  padding: 8px 16px;
  background: rgba(139,69,19,0.1);
  border: none;
  border-radius: 8px;
  color: #8b4513;
  cursor: pointer;
  margin-bottom: 20px;
}

.poem-display {
  background: rgba(139,69,19,0.05);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  margin-bottom: 24px;
}

.poem-display h2 { font-size: 24px; color: #8b4513; margin-bottom: 4px; }
.poem-author { font-size: 14px; color: #666; margin-bottom: 16px; }
.poem-content-display p { font-size: 20px; color: #333; line-height: 2; margin: 4px 0; }

.record-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.record-status { text-align: center; }

.record-indicator {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(139,69,19,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  position: relative;
}

.record-indicator.recording { background: rgba(231,76,60,0.15); }
.record-indicator.processing { background: rgba(241,196,15,0.15); }

.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid #e74c3c;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.3); opacity: 0; }
}

.record-icon { font-size: 32px; }
.status-text { font-size: 14px; color: #666; }

.btn-record {
  padding: 16px 48px;
  background: linear-gradient(135deg, #cd853f, #8b4513);
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.2s;
}

.btn-record:hover:not(:disabled) { transform: scale(1.05); }
.btn-record.recording { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.btn-record:disabled { opacity: 0.7; cursor: not-allowed; }

.btn-compare {
  padding: 10px 24px;
  background: rgba(139,69,19,0.1);
  border: none;
  border-radius: 10px;
  color: #8b4513;
  cursor: pointer;
  font-size: 14px;
}

.transcript-result {
  background: rgba(139,69,19,0.05);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
}

.transcript-result h3 { font-size: 16px; color: #8b4513; margin-bottom: 12px; }
.transcript-text { font-size: 18px; color: #333; margin-bottom: 16px; line-height: 1.8; }
.transcript-actions { display: flex; gap: 12px; }
.transcript-actions button {
  padding: 10px 20px;
  background: #8b4513;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.score-result {
  display: flex;
  gap: 30px;
  align-items: flex-start;
  background: rgba(139,69,19,0.05);
  border-radius: 16px;
  padding: 24px;
}

.score-circle {
  position: relative;
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}

.score-circle svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.score-circle circle.bg {
  fill: none;
  stroke: rgba(139,69,19,0.1);
  stroke-width: 8;
}

.score-circle circle.progress {
  fill: none;
  stroke: #8b4513;
  stroke-width: 8;
  stroke-dasharray: 283;
  stroke-dashoffset: 283;
  transition: stroke-dashoffset 1s ease;
}

.score-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.score-num { font-size: 36px; font-weight: bold; color: #8b4513; display: block; }
.score-label { font-size: 12px; color: #666; }

.score-details { flex: 1; }
.score-details h3 { font-size: 16px; color: #8b4513; margin-bottom: 12px; }

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.detail-icon { font-size: 16px; }

.ai-advice {
  margin-top: 16px;
  padding: 16px;
  background: rgba(139,69,19,0.08);
  border-radius: 12px;
}

.ai-advice h4 { font-size: 14px; color: #8b4513; margin-bottom: 8px; }
.ai-advice p { font-size: 14px; color: #666; line-height: 1.8; margin: 0; }

.compare-modal {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.compare-content {
  background: white;
  border-radius: 20px;
  padding: 30px;
  width: 90%;
  max-width: 700px;
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

.compare-content h2 { font-size: 20px; color: #8b4513; margin-bottom: 20px; }

.compare-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.compare-original, .compare-recited {
  background: rgba(139,69,19,0.05);
  border-radius: 12px;
  padding: 16px;
}

.compare-original h3, .compare-recited h3 {
  font-size: 14px;
  color: #8b4513;
  margin-bottom: 12px;
}

.compare-original p, .compare-recited p {
  font-size: 16px;
  color: #333;
  line-height: 1.8;
  margin: 0;
}
</style>
