<template>
  <div class="flying-tiger-container">
    <h1 class="game-title">飞虎令</h1>
    
    <!-- 游戏规则 -->
    <div class="game-rules">
      <h2>游戏规则</h2>
      <ul>
        <li>1. 游戏开始时，系统会随机选择一个关键字</li>
        <li>2. 玩家需要说出包含该关键字的古诗词</li>
        <li>3. 每轮玩家有10秒钟的思考时间</li>
        <li>4. 答对得分，答错或超时则游戏结束</li>
        <li>5. 连续答对可获得额外分数</li>
      </ul>
    </div>
    
    <!-- 游戏区域 -->
    <div class="game-area">
      <div v-if="!gameStarted" class="start-screen">
        <h2>准备开始</h2>
        <p>点击开始按钮开始游戏</p>
        <button class="start-btn" @click="startGame">开始游戏</button>
      </div>
      
      <div v-else-if="gameOver" class="game-over-screen">
        <h2>游戏结束</h2>
        <p class="score">最终得分: {{ score }}</p>
        <p class="correct-count">答对题数: {{ correctCount }}</p>
        <button class="restart-btn" @click="restartGame">重新开始</button>
      </div>
      
      <div v-else class="game-play-screen">
        <!-- 关键字显示 -->
        <div class="keyword-container">
          <h3>关键字: <span class="keyword">{{ currentKeyword }}</span></h3>
        </div>
        
        <!-- 倒计时 -->
        <div class="timer-container">
          <div class="timer" :class="{ 'warning': timeLeft <= 3 }">
            {{ timeLeft }}s
          </div>
        </div>
        
        <!-- 输入区域 -->
        <div class="input-container">
          <input 
            type="text" 
            v-model="userInput" 
            placeholder="请输入包含关键字的古诗词..."
            class="user-input"
            @keyup.enter="submitAnswer"
            ref="userInput"
          >
          <button class="submit-btn" @click="submitAnswer" :disabled="!userInput.trim()">
            提交
          </button>
        </div>
        
        <!-- 历史记录 -->
        <div class="history-container">
          <h3>历史记录</h3>
          <ul class="history-list">
            <li v-for="(item, index) in history" :key="index" :class="item.correct ? 'correct' : 'incorrect'">
              {{ item.poem }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FlyingTiger',
  data() {
    return {
      gameStarted: false,
      gameOver: false,
      score: 0,
      correctCount: 0,
      currentKeyword: '',
      timeLeft: 10,
      userInput: '',
      timer: null,
      history: [],
      // 关键字库
      keywords: ['春', '夏', '秋', '冬', '风', '花', '雪', '月', '山', '水', '云', '雨', '日', '夜', '天', '地', '人', '心', '情', '意'],
      // 诗词库
      poems: [
        { keyword: '春', content: '春眠不觉晓，处处闻啼鸟。' },
        { keyword: '春', content: '等闲识得东风面，万紫千红总是春。' },
        { keyword: '夏', content: '力尽不知热，但惜夏日长。' },
        { keyword: '夏', content: '接天莲叶无穷碧，映日荷花别样红。' },
        { keyword: '秋', content: '空山新雨后，天气晚来秋。' },
        { keyword: '秋', content: '停车坐爱枫林晚，霜叶红于二月花。' },
        { keyword: '冬', content: '孤舟蓑笠翁，独钓寒江雪。' },
        { keyword: '冬', content: '忽如一夜春风来，千树万树梨花开。' },
        { keyword: '风', content: '随风潜入夜，润物细无声。' },
        { keyword: '风', content: '大风起兮云飞扬，威加海内兮归故乡。' },
        { keyword: '花', content: '人间四月芳菲尽，山寺桃花始盛开。' },
        { keyword: '花', content: '落红不是无情物，化作春泥更护花。' },
        { keyword: '雪', content: '窗含西岭千秋雪，门泊东吴万里船。' },
        { keyword: '雪', content: '梅须逊雪三分白，雪却输梅一段香。' },
        { keyword: '月', content: '床前明月光，疑是地上霜。' },
        { keyword: '月', content: '小时不识月，呼作白玉盘。' },
        { keyword: '山', content: '会当凌绝顶，一览众山小。' },
        { keyword: '山', content: '不识庐山真面目，只缘身在此山中。' },
        { keyword: '水', content: '水光潋滟晴方好，山色空蒙雨亦奇。' },
        { keyword: '水', content: '抽刀断水水更流，举杯消愁愁更愁。' },
        { keyword: '云', content: '朝辞白帝彩云间，千里江陵一日还。' },
        { keyword: '云', content: '黄河远上白云间，一片孤城万仞山。' },
        { keyword: '雨', content: '好雨知时节，当春乃发生。' },
        { keyword: '雨', content: '清明时节雨纷纷，路上行人欲断魂。' },
        { keyword: '日', content: '白日依山尽，黄河入海流。' },
        { keyword: '日', content: '大漠孤烟直，长河落日圆。' },
        { keyword: '夜', content: '野旷天低树，江清月近人。' },
        { keyword: '夜', content: '随风潜入夜，润物细无声。' },
        { keyword: '天', content: '天门中断楚江开，碧水东流至此回。' },
        { keyword: '天', content: '飞流直下三千尺，疑是银河落九天。' },
        { keyword: '地', content: '锄禾日当午，汗滴禾下土。' },
        { keyword: '地', content: '野火烧不尽，春风吹又生。' },
        { keyword: '人', content: '人生得意须尽欢，莫使金樽空对月。' },
        { keyword: '人', content: '人生自古谁无死，留取丹心照汗青。' },
        { keyword: '心', content: '洛阳亲友如相问，一片冰心在玉壶。' },
        { keyword: '心', content: '问君能有几多愁，恰似一江春水向东流。' },
        { keyword: '情', content: '桃花潭水深千尺，不及汪伦送我情。' },
        { keyword: '情', content: '两情若是久长时，又岂在朝朝暮暮。' },
        { keyword: '意', content: '洛阳亲友如相问，一片冰心在玉壶。' },
        { keyword: '意', content: '醉翁之意不在酒，在乎山水之间也。' }
      ]
    }
  },
  methods: {
    startGame() {
      this.gameStarted = true
      this.gameOver = false
      this.score = 0
      this.correctCount = 0
      this.history = []
      this.nextRound()
    },
    restartGame() {
      this.startGame()
    },
    nextRound() {
      // 随机选择关键字
      this.currentKeyword = this.keywords[Math.floor(Math.random() * this.keywords.length)]
      this.userInput = ''
      this.timeLeft = 10
      
      // 清除之前的定时器
      if (this.timer) {
        clearInterval(this.timer)
      }
      
      // 开始倒计时
      this.timer = setInterval(() => {
        this.timeLeft--
        if (this.timeLeft <= 0) {
          this.endGame()
        }
      }, 1000)
      
      // 聚焦输入框
      this.$nextTick(() => {
        if (this.$refs.userInput) {
          this.$refs.userInput.focus()
        }
      })
    },
    submitAnswer() {
      if (!this.userInput.trim()) return
      
      const userAnswer = this.userInput.trim()
      const isCorrect = this.checkAnswer(userAnswer, this.currentKeyword)
      
      this.history.push({
        poem: userAnswer,
        correct: isCorrect
      })
      
      if (isCorrect) {
        this.correctCount++
        this.score += 10 + (this.correctCount - 1) * 2 // 连续答对加分
        this.nextRound()
      } else {
        this.endGame()
      }
    },
    checkAnswer(answer, keyword) {
      // 检查答案是否包含关键字
      if (!answer.includes(keyword)) {
        return false
      }
      
      // 检查答案是否是有效的古诗词（简单检查）
      // 这里可以添加更复杂的验证逻辑
      return true
    },
    endGame() {
      clearInterval(this.timer)
      this.gameOver = true
    }
  },
  beforeUnmount() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }
}
</script>

<style scoped>
.flying-tiger-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
}

.game-title {
  font-size: 36px;
  color: #333;
  margin-bottom: 30px;
  font-weight: bold;
}

.game-rules {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 20px;
  margin-bottom: 30px;
  text-align: left;
}

.game-rules h2 {
  font-size: 20px;
  color: #333;
  margin-bottom: 15px;
}

.game-rules ul {
  list-style-type: disc;
  padding-left: 20px;
}

.game-rules li {
  margin-bottom: 8px;
  color: #555;
}

.game-area {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 30px;
  min-height: 400px;
}

.start-screen,
.game-over-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
}

.start-btn,
.restart-btn {
  padding: 15px 30px;
  font-size: 18px;
  background: rgba(76, 175, 80, 0.2);
  color: var(--primary-color);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: 25px;
  cursor: pointer;
  transition: var(--transition);
  margin-top: 20px;
}

.start-btn:hover,
.restart-btn:hover {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.5);
  transform: translateY(-2px);
}

.game-play-screen {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.keyword-container {
  margin-bottom: 20px;
}

.keyword {
  font-size: 24px;
  font-weight: bold;
  color: #e91e63;
  margin-left: 10px;
}

.timer-container {
  margin: 20px 0;
}

.timer {
  font-size: 36px;
  font-weight: bold;
  color: #333;
  transition: color 0.3s ease;
}

.timer.warning {
  color: #f44336;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.input-container {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.user-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  font-size: 16px;
  background: rgba(255, 252, 240, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.user-input:focus {
  outline: none;
  border-color: rgba(76, 175, 80, 0.5);
  box-shadow: 0 8px 16px rgba(76, 175, 80, 0.15);
}

.submit-btn {
  padding: 12px 24px;
  background: rgba(76, 175, 80, 0.2);
  color: var(--primary-color);
  border: 1px solid rgba(76, 175, 80, 0.3);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: var(--transition);
}

.submit-btn:hover:not(:disabled) {
  background: rgba(76, 175, 80, 0.3);
  border-color: rgba(76, 175, 80, 0.5);
  transform: translateY(-2px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.history-container {
  margin-top: 30px;
  text-align: left;
}

.history-list {
  list-style-type: none;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}

.history-list li {
  padding: 10px;
  margin-bottom: 5px;
  border-radius: 8px;
  font-size: 14px;
}

.history-list li.correct {
  background: rgba(76, 175, 80, 0.1);
  border-left: 4px solid #4CAF50;
}

.history-list li.incorrect {
  background: rgba(244, 67, 54,