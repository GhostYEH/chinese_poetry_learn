<template>
  <div class="feihua-online">
    <!-- 顶部导航 -->
    <div class="nav-header">
      <h1 class="page-title">飞花令 - 在线对战</h1>
      <div class="nav-links">
        <router-link to="/feihualing/single" class="nav-link">单人模式</router-link>
      </div>
    </div>

    <!-- 未开始游戏时显示 -->
    <div v-if="!inGame" class="lobby">
      <!-- 难度选择 -->
      <div v-if="!selectedDifficulty" class="difficulty-select">
        <h2>选择难度</h2>
        <div class="difficulty-options">
          <div 
            v-for="diff in difficulties" 
            :key="diff.level"
            class="difficulty-card"
            @click="selectDifficulty(diff.level)"
          >
            <h3>{{ diff.name }}</h3>
            <p>{{ diff.description }}</p>
            <p class="time-limit">时限：{{ diff.timeLimit }}秒</p>
          </div>
        </div>
      </div>

      <!-- 令字选择 -->
      <div v-else-if="!selectedKeyword" class="keyword-select">
        <h2>选择令字</h2>
        <div class="keyword-options">
          <button 
            v-for="keyword in recommendedKeywords" 
            :key="keyword"
            class="keyword-btn"
            @click="selectKeyword(keyword)"
          >
            {{ keyword }}
          </button>
        </div>
        <div class="custom-keyword">
          <input 
            v-model="customKeyword" 
            placeholder="自定义令字"
            maxlength="1"
          />
          <button @click="selectKeyword(customKeyword)" :disabled="!customKeyword">
            确定
          </button>
        </div>
        <button class="back-btn" @click="selectedDifficulty = null">返回</button>
      </div>

      <!-- 在线用户列表 -->
      <div v-else class="online-users-section">
        <div class="current-setting">
          <p>难度：{{ getDifficultyName(selectedDifficulty) }}</p>
          <p>令字：<span class="keyword-badge">{{ selectedKeyword }}</span></p>
          <button class="change-btn" @click="resetSelection">重新选择</button>
        </div>

        <h2>在线玩家</h2>
        <div v-if="onlineUsers.length === 0" class="empty-users">
          <p>暂无在线玩家</p>
          <p class="tip">邀请好友一起来玩吧！</p>
        </div>
        <div v-else class="users-list">
          <div 
            v-for="user in onlineUsers" 
            :key="user.userId"
            class="user-card"
            :class="{ 'in-game': user.inGame, 'is-me': user.userId === currentUserId }"
          >
            <div class="user-info">
              <div class="user-avatar">{{ user.username.charAt(0).toUpperCase() }}</div>
              <div class="user-details">
                <span class="user-name">{{ user.username }}</span>
                <span class="user-class">班级：{{ user.classId || '未设置' }}</span>
                <span class="user-record">最高记录：{{ user.maxRounds || 0 }}轮</span>
              </div>
            </div>
            <button 
              v-if="user.userId !== currentUserId"
              class="invite-btn"
              @click="inviteUser(user)"
              :disabled="user.inGame"
            >
              {{ user.inGame ? '游戏中' : '邀请' }}
            </button>
            <span v-else class="me-badge">我</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 邀请弹窗 -->
    <div v-if="showInvitation" class="invitation-modal">
      <div class="modal-content">
        <h3>收到对战邀请</h3>
        <div class="inviter-info">
          <p><strong>{{ invitation.inviterName }}</strong> 邀请你进行飞花令对战</p>
          <p>班级：{{ invitation.inviterClassId || '未设置' }}</p>
          <p>最高记录：{{ invitation.inviterMaxRounds || 0 }}轮</p>
          <p>令字：<span class="keyword-badge">{{ invitation.keyword }}</span></p>
          <p>难度：{{ getDifficultyName(invitation.difficulty) }}</p>
        </div>
        <div class="modal-actions">
          <button class="accept-btn" @click="acceptInvitation">接受</button>
          <button class="reject-btn" @click="rejectInvitation">拒绝</button>
        </div>
      </div>
    </div>

    <!-- 游戏房间 -->
    <div v-if="inGame" class="game-room">
      <!-- 游戏信息 -->
      <div class="game-header">
        <div class="game-info">
          <span class="keyword-badge">令字：{{ gameData.keyword }}</span>
          <span class="round-info">第 {{ gameData.currentRound }} 回合</span>
          <span class="time-info">剩余时间：{{ timeLeft }}秒</span>
        </div>
        <button class="leave-btn" @click="leaveGame">离开</button>
      </div>

      <!-- 玩家信息 -->
      <div class="players-section">
        <div 
          v-for="(player, index) in gameData.players" 
          :key="player.userId"
          class="player-card"
          :class="{ 
            'current-turn': index === gameData.currentTurn,
            'is-me': player.userId === currentUserId
          }"
        >
          <div class="player-avatar">{{ player.username.charAt(0).toUpperCase() }}</div>
          <div class="player-details">
            <span class="player-name">{{ player.username }}</span>
            <span class="player-score">得分：{{ player.score }}</span>
            <span class="player-throws">扔题次数：{{ player.throwCount }}</span>
          </div>
          <div v-if="index === gameData.currentTurn" class="turn-indicator">
            <span class="pulse-dot"></span>
            思考中
          </div>
        </div>
      </div>

      <!-- 已用诗句 -->
      <div class="used-poems-section">
        <h3>已用诗句</h3>
        <div v-if="gameData.usedPoems.length === 0" class="empty-poems">
          <p>暂无诗句</p>
        </div>
        <div v-else class="poems-list">
          <div 
            v-for="(poem, index) in gameData.usedPoems" 
            :key="index"
            class="poem-item"
          >
            <span class="poem-index">{{ index + 1 }}.</span>
            <span class="poem-text">{{ poem }}</span>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div v-if="isMyTurn" class="input-section">
        <input
          v-model="answerInput"
          type="text"
          class="answer-input"
          :placeholder="`请输入包含「${gameData.keyword}」字的诗句...`"
          @keyup.enter="submitPoem"
          :disabled="answerSubmitting"
        />
        <div class="input-actions">
          <button 
            class="submit-btn"
            @click="submitPoem"
            :disabled="answerSubmitting || !answerInput.trim()"
          >
            提交
          </button>
          <button 
            class="throw-btn"
            @click="throwQuestion"
            :disabled="myThrowCount <= 0"
          >
            扔题 ({{ myThrowCount }})
          </button>
        </div>
      </div>
      <div v-else class="waiting-message">
        <p>等待对方回答...</p>
      </div>
    </div>

    <!-- 游戏结果弹窗 -->
    <div v-if="showResult" class="result-modal">
      <div class="modal-content">
        <h3>{{ gameResult.isWinner ? '恭喜获胜！' : '很遗憾，你输了' }}</h3>
        <div class="result-info">
          <p>总回合数：{{ gameResult.totalRounds }}</p>
          <p v-if="gameResult.reason === 'timeout'">原因：对方超时</p>
          <p v-else-if="gameResult.reason === 'disconnect'">原因：对方断线</p>
        </div>
        <button class="confirm-btn" @click="closeResult">确定</button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-toast">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import feihualingSocket from '@/services/feihualingSocket'

const router = useRouter()

// 用户信息
const currentUserId = ref(null)
const currentUsername = ref('')

// 在线用户列表
const onlineUsers = ref([])

// 难度选择
const selectedDifficulty = ref(null)
const difficulties = [
  { level: 'easy', name: '入门', description: '任意位置包含令字即可', timeLimit: 60 },
  { level: 'medium', name: '进阶', description: '令字位置轮流变化', timeLimit: 45 },
  { level: 'hard', name: '专业', description: '令字位置严格限制', timeLimit: 30 }
]

// 令字选择
const selectedKeyword = ref(null)
const customKeyword = ref('')
const recommendedKeywords = ['春', '花', '月', '风', '雨', '山', '水', '云', '雪', '夜']

// 邀请相关
const showInvitation = ref(false)
const invitation = ref({})

// 游戏相关
const inGame = ref(false)
const gameData = ref({
  roomId: null,
  keyword: '',
  difficulty: '',
  players: [],
  currentTurn: 0,
  currentRound: 1,
  usedPoems: [],
  timeLimit: 60
})

// 计时器
const timeLeft = ref(60)
let timer = null

// 输入相关
const answerInput = ref('')
const answerSubmitting = ref(false)

// 结果相关
const showResult = ref(false)
const gameResult = ref({})

// 错误提示
const errorMessage = ref('')
let errorTimer = null

// 计算属性
const isMyTurn = computed(() => {
  if (!gameData.value.players.length) return false
  return gameData.value.players[gameData.value.currentTurn]?.userId === currentUserId.value
})

const myThrowCount = computed(() => {
  const myPlayer = gameData.value.players.find(p => p.userId === currentUserId.value)
  return myPlayer?.throwCount || 0
})

// 方法
const getDifficultyName = (level) => {
  const diff = difficulties.find(d => d.level === level)
  return diff ? diff.name : level
}

const selectDifficulty = (level) => {
  selectedDifficulty.value = level
}

const selectKeyword = (keyword) => {
  if (!keyword || keyword.trim().length !== 1) {
    showError('请输入单个汉字')
    return
  }
  selectedKeyword.value = keyword.trim()
}

const resetSelection = () => {
  selectedDifficulty.value = null
  selectedKeyword.value = null
  customKeyword.value = ''
}

const inviteUser = (user) => {
  if (!selectedKeyword.value) {
    showError('请先选择令字')
    return
  }
  
  feihualingSocket.sendInvitation(
    user.userId,
    selectedKeyword.value,
    selectedDifficulty.value
  )
  
  showError(`已向 ${user.username} 发送邀请`)
}

const acceptInvitation = () => {
  feihualingSocket.acceptInvitation(
    invitation.value.inviteId,
    invitation.value.inviterId,
    invitation.value.keyword,
    invitation.value.difficulty
  )
  showInvitation.value = false
}

const rejectInvitation = () => {
  feihualingSocket.rejectInvitation(
    invitation.value.inviteId,
    invitation.value.inviterId
  )
  showInvitation.value = false
}

const submitPoem = () => {
  if (!answerInput.value.trim()) return
  
  answerSubmitting.value = true
  feihualingSocket.submitPoem(gameData.value.roomId, answerInput.value.trim())
  
  setTimeout(() => {
    answerSubmitting.value = false
  }, 1000)
}

const throwQuestion = () => {
  if (myThrowCount.value <= 0) {
    showError('扔题次数已用完')
    return
  }
  
  feihualingSocket.throwQuestion(gameData.value.roomId)
}

const leaveGame = () => {
  if (confirm('确定要离开游戏吗？离开将判负。')) {
    const myIndex = gameData.value.players.findIndex(p => p.userId === currentUserId.value)
    const otherIndex = myIndex === 0 ? 1 : 0
    
    feihualingSocket.gameOver(
      gameData.value.roomId,
      gameData.value.players[otherIndex].userId,
      currentUserId.value,
      'leave'
    )
    
    inGame.value = false
    resetSelection()
  }
}

const closeResult = () => {
  showResult.value = false
  inGame.value = false
  resetSelection()
}

const showError = (message) => {
  errorMessage.value = message
  if (errorTimer) clearTimeout(errorTimer)
  errorTimer = setTimeout(() => {
    errorMessage.value = ''
  }, 3000)
}

const startTimer = () => {
  if (timer) clearInterval(timer)
  
  timeLeft.value = gameData.value.timeLimit
  
  timer = setInterval(() => {
    timeLeft.value--
    
    if (timeLeft.value <= 0) {
      clearInterval(timer)
      feihualingSocket.timeout(gameData.value.roomId)
    }
  }, 1000)
}

const stopTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// Socket事件处理
const setupSocketListeners = () => {
  // 认证成功
  feihualingSocket.on('authenticated', (data) => {
    currentUserId.value = data.userId
    currentUsername.value = data.username
  })

  // 在线用户列表更新
  feihualingSocket.on('online-users', (users) => {
    onlineUsers.value = users
  })

  // 接收邀请
  feihualingSocket.on('receive-invitation', (data) => {
    invitation.value = data
    showInvitation.value = true
  })

  // 邀请被拒绝
  feihualingSocket.on('invitation-rejected', (data) => {
    showError('对方拒绝了你的邀请')
  })

  // 游戏开始
  feihualingSocket.on('game-start', (data) => {
    gameData.value = {
      ...data,
      usedPoems: []
    }
    inGame.value = true
    showInvitation.value = false
    startTimer()
  })

  // 诗句提交成功
  feihualingSocket.on('poem-submitted', (data) => {
    gameData.value.currentTurn = data.currentTurn
    gameData.value.currentRound = data.currentRound
    gameData.value.usedPoems = data.usedPoems
    gameData.value.players = data.players
    answerInput.value = ''
    
    // 重新开始计时
    startTimer()
  })

  // 扔题成功
  feihualingSocket.on('question-thrown', (data) => {
    gameData.value.currentTurn = data.currentTurn
    gameData.value.players = data.players
    showError(`${data.playerName} 使用了扔题特权`)
    
    // 重新开始计时
    startTimer()
  })

  // 游戏结果
  feihualingSocket.on('game-result', (data) => {
    stopTimer()
    
    gameResult.value = {
      isWinner: data.winnerId === currentUserId.value,
      totalRounds: data.totalRounds,
      reason: data.reason
    }
    showResult.value = true
  })

  // 对手断线
  feihualingSocket.on('opponent-disconnected', (data) => {
    stopTimer()
    
    gameResult.value = {
      isWinner: true,
      totalRounds: gameData.value.currentRound,
      reason: 'disconnect'
    }
    showResult.value = true
  })

  // 错误处理
  feihualingSocket.on('error', (error) => {
    showError(error.message || '发生错误')
  })

  // 断线处理
  feihualingSocket.on('disconnected', () => {
    showError('连接已断开，请重新登录')
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  })
}

// 生命周期
onMounted(() => {
  const token = localStorage.getItem('token')
  if (!token) {
    router.push('/login')
    return
  }

  feihualingSocket.connect(token)
  setupSocketListeners()
})

onUnmounted(() => {
  stopTimer()
  if (errorTimer) clearTimeout(errorTimer)
  feihualingSocket.disconnect()
})
</script>

<style scoped>
.feihua-online {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.nav-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.page-title {
  margin: 0;
  color: #333;
  font-size: 24px;
}

.nav-links {
  display: flex;
  gap: 15px;
}

.nav-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

.nav-link:hover {
  color: #764ba2;
}

/* 难度选择 */
.difficulty-select, .keyword-select, .online-users-section {
  background: rgba(255, 255, 255, 0.95);
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.difficulty-select h2, .keyword-select h2, .online-users-section h2 {
  margin: 0 0 20px 0;
  color: #333;
  text-align: center;
}

.difficulty-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}

.difficulty-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
}

.difficulty-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
}

.difficulty-card h3 {
  margin: 0 0 10px 0;
}

.difficulty-card p {
  margin: 5px 0;
  font-size: 14px;
}

.time-limit {
  font-weight: bold;
  color: #ffd700;
}

/* 令字选择 */
.keyword-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-bottom: 20px;
}

.keyword-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid #667eea;
  background: white;
  color: #667eea;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.keyword-btn:hover {
  background: #667eea;
  color: white;
  transform: scale(1.1);
}

.custom-keyword {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 20px;
}

.custom-keyword input {
  padding: 10px;
  border: 2px solid #667eea;
  border-radius: 5px;
  font-size: 16px;
  width: 100px;
  text-align: center;
}

.custom-keyword button {
  padding: 10px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.3s;
}

.custom-keyword button:hover {
  background: #764ba2;
}

.back-btn, .change-btn {
  padding: 10px 20px;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.3s;
}

.back-btn:hover, .change-btn:hover {
  background: #e0e0e0;
}

/* 当前设置 */
.current-setting {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 10px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.current-setting p {
  margin: 0;
  color: #333;
}

.keyword-badge {
  display: inline-block;
  padding: 5px 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 20px;
  font-weight: bold;
}

/* 在线用户列表 */
.empty-users {
  text-align: center;
  padding: 40px;
  color: #666;
}

.tip {
  color: #999;
  font-size: 14px;
}

.users-list {
  display: grid;
  gap: 15px;
}

.user-card {
  background: white;
  padding: 15px;
  border-radius: 10px;
  border: 2px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s;
}

.user-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.2);
}

.user-card.in-game {
  opacity: 0.6;
}

.user-card.is-me {
  border-color: #764ba2;
  background: #f8f9fa;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.user-name {
  font-weight: bold;
  color: #333;
  font-size: 16px;
}

.user-class, .user-record {
  font-size: 12px;
  color: #666;
}

.invite-btn {
  padding: 10px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.3s;
}

.invite-btn:hover:not(:disabled) {
  background: #764ba2;
}

.invite-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.me-badge {
  padding: 5px 15px;
  background: #764ba2;
  color: white;
  border-radius: 20px;
  font-size: 12px;
}

/* 邀请弹窗 */
.invitation-modal, .result-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 15px;
  max-width: 400px;
  width: 90%;
}

.modal-content h3 {
  margin: 0 0 20px 0;
  color: #333;
  text-align: center;
}

.inviter-info p {
  margin: 10px 0;
  color: #666;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.accept-btn, .reject-btn, .confirm-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
}

.accept-btn {
  background: #4caf50;
  color: white;
}

.accept-btn:hover {
  background: #45a049;
}

.reject-btn {
  background: #f44336;
  color: white;
}

.reject-btn:hover {
  background: #da190b;
}

.confirm-btn {
  background: #667eea;
  color: white;
}

.confirm-btn:hover {
  background: #764ba2;
}

/* 游戏房间 */
.game-room {
  background: rgba(255, 255, 255, 0.95);
  padding: 30px;
  border-radius: 15px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.game-info {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
}

.round-info, .time-info {
  color: #333;
  font-weight: 500;
}

.time-info {
  color: #f44336;
  font-weight: bold;
}

.leave-btn {
  padding: 10px 20px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.3s;
}

.leave-btn:hover {
  background: #da190b;
}

/* 玩家信息 */
.players-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.player-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 10px;
  border: 2px solid #e0e0e0;
  transition: all 0.3s;
}

.player-card.current-turn {
  border-color: #667eea;
  background: #e8eaf6;
}

.player-card.is-me {
  border-color: #764ba2;
}

.player-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  margin: 0 auto 15px;
}

.player-details {
  text-align: center;
  margin-bottom: 10px;
}

.player-name {
  display: block;
  font-weight: bold;
  color: #333;
  font-size: 16px;
  margin-bottom: 5px;
}

.player-score, .player-throws {
  display: block;
  font-size: 12px;
  color: #666;
  margin: 3px 0;
}

.turn-indicator {
  text-align: center;
  color: #667eea;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #667eea;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 已用诗句 */
.used-poems-section {
  margin-bottom: 30px;
}

.used-poems-section h3 {
  margin: 0 0 15px 0;
  color: #333;
}

.empty-poems {
  text-align: center;
  padding: 20px;
  color: #999;
}

.poems-list {
  max-height: 200px;
  overflow-y: auto;
  background: #f8f9fa;
  padding: 15px;
  border-radius: 10px;
}

.poem-item {
  padding: 10px;
  border-bottom: 1px solid #e0e0e0;
}

.poem-item:last-child {
  border-bottom: none;
}

.poem-index {
  color: #667eea;
  font-weight: bold;
  margin-right: 10px;
}

.poem-text {
  color: #333;
}

/* 输入区域 */
.input-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.answer-input {
  width: 100%;
  padding: 15px;
  border: 2px solid #667eea;
  border-radius: 10px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.answer-input:focus {
  outline: none;
  border-color: #764ba2;
}

.input-actions {
  display: flex;
  gap: 10px;
}

.submit-btn, .throw-btn {
  flex: 1;
  padding: 15px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s;
}

.submit-btn {
  background: #667eea;
  color: white;
}

.submit-btn:hover:not(:disabled) {
  background: #764ba2;
}

.throw-btn {
  background: #ff9800;
  color: white;
}

.throw-btn:hover:not(:disabled) {
  background: #f57c00;
}

.submit-btn:disabled, .throw-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.waiting-message {
  text-align: center;
  padding: 20px;
  color: #666;
  font-size: 16px;
}

/* 结果信息 */
.result-info {
  margin: 20px 0;
  text-align: center;
}

.result-info p {
  margin: 10px 0;
  color: #666;
}

/* 错误提示 */
.error-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #f44336;
  color: white;
  padding: 15px 30px;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  z-index: 1001;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .feihua-online {
    padding: 10px;
  }

  .nav-header {
    flex-direction: column;
    gap: 15px;
  }

  .difficulty-options {
    grid-template-columns: 1fr;
  }

  .game-info {
    flex-direction: column;
    align-items: flex-start;
  }

  .players-section {
    grid-template-columns: 1fr;
  }

  .input-actions {
    flex-direction: column;
  }
}
</style>
