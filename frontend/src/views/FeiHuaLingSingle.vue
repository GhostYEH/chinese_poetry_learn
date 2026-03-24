<template>
  <div class="feihua-game">
    <div class="container">
      <!-- 顶部导航 -->
      <div class="nav-tabs">
        <div class="tab active">
          <router-link to="/feihualing/single">单人模式</router-link>
        </div>
      </div>
      
      <h1 class="game-title">飞花令</h1>
      
      <!-- 新手规则引导 -->
      <div v-if="showNewbieGuide" class="newbie-guide-modal">
        <div class="modal-content">
          <h3>飞花令玩法</h3>
          <p>轮流说出含有指定令字的诗句，每回合需符合规则要求。</p>
          <p class="example">例如：令字为「春」，可以说「春眠不觉晓，处处闻啼鸟」</p>
          <button class="guide-btn" @click="showNewbieGuide = false">我知道了</button>
        </div>
      </div>
      
      <!-- 规则说明入口 -->
      <div class="rules-entry">
        <button class="rules-btn" @click="showRules = true">📖 规则说明</button>
      </div>
      
      <!-- 规则说明弹窗 -->
      <div v-if="showRules" class="rules-modal">
        <div class="modal-content">
          <h2>飞花令规则</h2>
          <div class="rules-content">
            <h3>核心规则</h3>
            <ul>
              <li>选择令字后，轮流说出含有该令字的诗句</li>
              <li>入门难度：任意位置包含令字</li>
              <li>进阶/专业难度：令字位置轮流变化</li>
              <li>每回合有时间限制，超时未作答则落败</li>
              <li>禁止重复使用已出现的诗句</li>
              <li>必须是正统古诗词中的完整诗句</li>
            </ul>
            <h3>令字位置规则</h3>
            <p>进阶/专业难度：首回合令字在第1位，每完成一个回合位置+1，循环往复。</p>
            <p class="example">例如：令字「春」，位置1：「春眠不觉晓」，位置2：「当春乃发生」</p>
          </div>
          <button class="close-btn" @click="showRules = false">关闭</button>
        </div>
      </div>
      
      <!-- 难度选择页面 -->
      <div class="difficulty-select" v-if="!gameStarted && !inSetup">
        <h2>选择难度</h2>
        <div class="difficulty-options">
          <div 
            v-for="diff in difficulties" 
            :key="diff.level"
            class="difficulty-card"
            :class="{ active: selectedDifficulty === diff.level }"
            @click="selectDifficulty(diff.level)"
          >
            <h3>{{ diff.name }}</h3>
            <p>{{ diff.description }}</p>
            <p class="time-limit">时限：{{ diff.timeLimit }}秒</p>
          </div>
        </div>
        <button class="next-btn" @click="goToSetup">下一步</button>
      </div>
      
      <!-- 令字选择页面 -->
      <div class="keyword-setup" v-if="inSetup && !gameStarted">
        <h2>选择令字</h2>
        <div class="keyword-options">
          <h3>推荐令字</h3>
          <div class="recommended-keywords">
            <button 
              v-for="keyword in recommendedKeywords" 
              :key="keyword"
              class="keyword-btn"
              :class="{ active: selectedKeyword === keyword }"
              @click="selectedKeyword = keyword"
            >
              {{ keyword }}
            </button>
          </div>
          <div class="custom-keyword">
            <h3>自定义令字</h3>
            <div class="keyword-input-container">
              <button class="random-keyword-btn" @click="generateRandomKeyword">随机令字</button>
              <input 
                type="text" 
                v-model="customKeyword" 
                class="custom-input"
                placeholder="输入单个中文字符"
                @input="validateCustomKeyword"
                maxlength="1"
              >
            </div>
            <p v-if="keywordError" class="error-message">{{ keywordError }}</p>
            <p v-if="keywordWarning" class="warning-message">{{ keywordWarning }}</p>
          </div>
        </div>
        <div class="setup-actions">
          <button class="back-btn" @click="backToDifficulty">上一步</button>
          <button class="start-btn" @click="confirmSetup" :disabled="!selectedKeyword && !customKeyword">开始对局</button>
        </div>
      </div>
      
      <!-- 游戏界面 -->
      <div class="game-play" v-if="gameStarted">
        <div class="game-info">
          <div class="info-item">
            <span class="label">难度：</span>
            <span class="value">{{ getDifficultyName() }}</span>
          </div>
          <div class="info-item">
            <span class="label">令字：</span>
            <span class="keyword">{{ currentKeyword }}</span>
          </div>
          <div v-if="currentPosition > 0" class="info-item">
            <span class="label">位置：</span>
            <span class="position">{{ currentPosition }}位</span>
          </div>
          <div class="info-item">
            <span class="label">得分：</span>
            <span class="score">{{ score }}</span>
          </div>
          <div class="info-item">
            <span class="label">时间：</span>
            <span class="timer" :class="{ 'time-warning': timeLeft < 10 }">
              {{ timeLeft }}s
            </span>
          </div>
        </div>
        
        <div class="poem-input-section">
          <h3>{{ currentPlayer === 'user' ? '请说出含有「' + currentKeyword + '」' : '系统思考中...' }}</h3>
          <div v-if="currentPlayer === 'user'">
            <input 
              type="text" 
              v-model="userInput" 
              class="poem-input" 
              placeholder="例如：春眠不觉晓，处处闻啼鸟" 
              @keyup.enter="submitPoem"
              ref="poemInput"
              :disabled="currentPlayer !== 'user'"
            >
            <div class="input-actions">
              <button class="submit-btn" @click="submitPoem" :disabled="!userInput.trim() || currentPlayer !== 'user'">提交</button>
              <div class="hint-buttons">
                <button 
                  v-if="canUseHint" 
                  class="hint-btn level-1" 
                  @click="useHint(1)"
                  :disabled="!canUseHint"
                >
                  作者提示 (-5分)
                </button>
                <button 
                  v-if="canUseHint" 
                  class="hint-btn level-2" 
                  @click="useHint(2)"
                  :disabled="!canUseHint"
                >
                  首字提示 (-10分)
                </button>
                <button 
                  v-if="canUseHint" 
                  class="hint-btn level-3" 
                  @click="useHint(3)"
                  :disabled="!canUseHint"
                >
                  完整示例 (-20分)
                </button>
              </div>
            </div>
          </div>
          <div v-else class="system-thinking">
            <div class="loading-spinner"></div>
            <p>系统正在思考...</p>
          </div>
        </div>
        
        <!-- 历史记录 -->
        <div class="history-section">
          <h3>历史记录</h3>
          <div class="history-list">
            <div 
              v-for="(item, index) in poemHistory" 
              :key="index"
              class="history-item"
              :class="{ 'user-poem': item.player === 'user', 'system-poem': item.player === 'system' }"
            >
              <span class="history-number">{{ index + 1 }}.</span>
              <span class="history-content">
                <template v-if="item.position > 0">
                  <span v-for="(char, charIndex) in item.poem" :key="charIndex" class="char"
                        :class="{ 'keyword': char === currentKeyword && charIndex === item.position - 1 }">
                    {{ char }}
                    <span v-if="charIndex === item.position - 1" class="position-mark">{{ item.position }}</span>
                  </span>
                </template>
                <template v-else>
                  <span v-for="(char, charIndex) in item.poem" :key="charIndex" class="char"
                        :class="{ 'keyword': char === currentKeyword }">
                    {{ char }}
                  </span>
                </template>
              </span>
              <div v-if="item.analysis" class="poem-analysis">
                <p class="analysis-author">{{ item.analysis.author }} · {{ item.analysis.dynasty }}</p>
                <p class="analysis-title">{{ item.analysis.title }}</p>
                <p class="analysis-translation">{{ item.analysis.translation }}</p>
              </div>
            </div>
          </div>
        </div>
        
        <button class="stop-btn" @click="stopGame">结束游戏</button>
      </div>
      
      <!-- 游戏结束界面 -->
      <div class="game-over" v-if="gameOver">
        <h2>{{ gameResult === 'win' ? '🎉 恭喜获胜！' : '游戏结束' }}</h2>
        <div class="game-result">
          <p>最终得分：<span class="final-score">{{ score }}</span></p>
          <p>答对回合数：{{ correctRounds }}</p>
          <p v-if="gameResult === 'win'">系统无法接出符合规则的诗句，你获胜了！</p>
          <p v-else-if="gameResult === 'timeout'">超时未作答，挑战失败</p>
          <p v-else-if="gameResult === 'invalid'">诗句不符合规则，挑战失败</p>
        </div>
        <div class="game-actions">
          <button class="action-btn restart" @click="restartGame">再来一局</button>
          <button class="action-btn change-keyword" @click="changeKeyword">更换令字</button>
          <button class="action-btn change-difficulty" @click="changeDifficulty">更换难度</button>
          <button class="action-btn back-home" @click="goBack">返回首页</button>
        </div>
        <div class="learning-section">
          <h3>学习复盘</h3>
          <div class="learning-content">
            <div v-for="(item, index) in poemHistory" :key="index" class="learning-item">
              <h4>{{ index + 1 }}. {{ item.poem }}</h4>
              <p v-if="item.analysis">
                {{ item.analysis.author }} · {{ item.analysis.dynasty }} · {{ item.analysis.title }}
              </p>
              <p v-if="item.error" class="error-analysis">{{ item.error }}</p>
              <button v-if="!item.isCollected" class="collect-btn" @click="collectPoem(item)">
                收藏到错题本
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Feihua',
  data() {
    return {
      // 游戏状态
      gameStarted: false,
      gameOver: false,
      inSetup: false,
      showRules: false,
      showNewbieGuide: true,
      
      // 难度设置
      selectedDifficulty: 'easy',
      difficulties: [
        { level: 'easy', name: '入门', description: '令字可在诗句任意位置', timeLimit: 60 },
        { level: 'medium', name: '进阶', description: '令字位置轮流变化', timeLimit: 45 },
        { level: 'hard', name: '专业', description: '令字位置轮流变化，禁止提示', timeLimit: 30 }
      ],
      
      // 令字设置
      selectedKeyword: '',
      customKeyword: '',
      recommendedKeywords: ['春', '月', '花', '山', '水', '风', '雪', '云', '酒', '愁', '江', '河', '日', '夜', '心', '人', '天', '地', '光', '影', '声', '色', '香', '年', '时', '处', '间', '客', '路', '星', '海', '竹', '梅', '柳', '草', '松', '菊', '思', '情', '爱', '别', '离', '归', '梦', '看', '望', '听', '行'],
      
      
      
      
      keywordError: '',
      keywordWarning: '',
      
      // 游戏参数
      currentKeyword: '',
      currentDifficulty: 'easy',
      timeLimit: 60,
      timeLeft: 60,
      timer: null,
      score: 0,
      correctRounds: 0,
      gameResult: '', // win, timeout, invalid
      
      // 对局状态
      currentPlayer: 'user', // user, system
      currentPosition: 0, // 0表示任意位置
      userInput: '',
      poemHistory: [],
      usedPoems: new Set(),
      
      // 提示功能
      hintCount: 0,
      maxHints: {
        easy: Infinity,
        medium: 3,
        hard: 0
      },
      
      // 诗句数据库
      poemDatabase: {
        '春': [
          { poem: '春眠不觉晓，处处闻啼鸟', author: '孟浩然', dynasty: '唐', title: '春晓' },
          { poem: '春色满园关不住，一枝红杏出墙来', author: '叶绍翁', dynasty: '宋', title: '游园不值' },
          { poem: '春潮带雨晚来急，野渡无人舟自横', author: '韦应物', dynasty: '唐', title: '滁州西涧' },
          { poem: '春江水暖鸭先知，竹外桃花三两枝', author: '苏轼', dynasty: '宋', title: '惠崇春江晚景' },
          { poem: '春风又绿江南岸，明月何时照我还', author: '王安石', dynasty: '宋', title: '泊船瓜洲' },
          { poem: '春蚕到死丝方尽，蜡炬成灰泪始干', author: '李商隐', dynasty: '唐', title: '无题' },
          { poem: '春种一粒粟，秋收万颗子', author: '李绅', dynasty: '唐', title: '悯农' },
          { poem: '春城无处不飞花，寒食东风御柳斜', author: '韩翃', dynasty: '唐', title: '寒食' },
          { poem: '春阴垂野草青青，时有幽花一树明', author: '苏舜钦', dynasty: '宋', title: '淮中晚泊犊头' },
          { poem: '春山暖日和风，阑干楼阁帘栊', author: '白朴', dynasty: '元', title: '天净沙·春' }
        ],
        '月': [
          { poem: '床前明月光，疑是地上霜', author: '李白', dynasty: '唐', title: '静夜思' },
          { poem: '举头望明月，低头思故乡', author: '李白', dynasty: '唐', title: '静夜思' },
          { poem: '小时不识月，呼作白玉盘', author: '李白', dynasty: '唐', title: '古朗月行' },
          { poem: '月落乌啼霜满天，江枫渔火对愁眠', author: '张继', dynasty: '唐', title: '枫桥夜泊' },
          { poem: '明月几时有，把酒问青天', author: '苏轼', dynasty: '宋', title: '水调歌头' },
          { poem: '海上生明月，天涯共此时', author: '张九龄', dynasty: '唐', title: '望月怀远' },
          { poem: '春风又绿江南岸，明月何时照我还', author: '王安石', dynasty: '宋', title: '泊船瓜洲' },
          { poem: '秦时明月汉时关，万里长征人未还', author: '王昌龄', dynasty: '唐', title: '出塞' },
          { poem: '举杯邀明月，对影成三人', author: '李白', dynasty: '唐', title: '月下独酌' },
          { poem: '明月松间照，清泉石上流', author: '王维', dynasty: '唐', title: '山居秋暝' }
        ],
        '花': [
          { poem: '春城无处不飞花，寒食东风御柳斜', author: '韩翃', dynasty: '唐', title: '寒食' },
          { poem: '花落知多少，夜来风雨声', author: '孟浩然', dynasty: '唐', title: '春晓' },
          { poem: '待到山花烂漫时，她在丛中笑', author: '毛泽东', dynasty: '现代', title: '卜算子·咏梅' },
          { poem: '接天莲叶无穷碧，映日荷花别样红', author: '杨万里', dynasty: '宋', title: '晓出净慈寺送林子方' },
          { poem: '人间四月芳菲尽，山寺桃花始盛开', author: '白居易', dynasty: '唐', title: '大林寺桃花' },
          { poem: '落红不是无情物，化作春泥更护花', author: '龚自珍', dynasty: '清', title: '己亥杂诗' },
          { poem: '人面不知何处去，桃花依旧笑春风', author: '崔护', dynasty: '唐', title: '题都城南庄' },
          { poem: '去年今日此门中，人面桃花相映红', author: '崔护', dynasty: '唐', title: '题都城南庄' },
          { poem: '不经一番寒彻骨，怎得梅花扑鼻香', author: '黄蘖禅师', dynasty: '唐', title: '上堂开示颂' },
          { poem: '墙角数枝梅，凌寒独自开', author: '王安石', dynasty: '宋', title: '梅花' }
        ],
        '山': [
          { poem: '不识庐山真面目，只缘身在此山中', author: '苏轼', dynasty: '宋', title: '题西林壁' },
          { poem: '相看两不厌，只有敬亭山', author: '李白', dynasty: '唐', title: '独坐敬亭山' },
          { poem: '会当凌绝顶，一览众山小', author: '杜甫', dynasty: '唐', title: '望岳' },
          { poem: '五岳归来不看山，黄山归来不看岳', author: '徐霞客', dynasty: '明', title: '漫游黄山仙境' },
          { poem: '山重水复疑无路，柳暗花明又一村', author: '陆游', dynasty: '宋', title: '游山西村' },
          { poem: '远看山有色，近听水无声', author: '王维', dynasty: '唐', title: '画' },
          { poem: '山不在高，有仙则名', author: '刘禹锡', dynasty: '唐', title: '陋室铭' },
          { poem: '白日依山尽，黄河入海流', author: '王之涣', dynasty: '唐', title: '登鹳雀楼' },
          { poem: '空山不见人，但闻人语响', author: '王维', dynasty: '唐', title: '鹿柴' },
          { poem: '种豆南山下，草盛豆苗稀', author: '陶渊明', dynasty: '晋', title: '归园田居' }
        ],
        '水': [
          { poem: '白毛浮绿水，红掌拨清波', author: '骆宾王', dynasty: '唐', title: '咏鹅' },
          { poem: '春江水暖鸭先知，竹外桃花三两枝', author: '苏轼', dynasty: '宋', title: '惠崇春江晚景' },
          { poem: '桃花潭水深千尺，不及汪伦送我情', author: '李白', dynasty: '唐', title: '赠汪伦' },
          { poem: '山重水复疑无路，柳暗花明又一村', author: '陆游', dynasty: '宋', title: '游山西村' },
          { poem: '水何澹澹，山岛竦峙', author: '曹操', dynasty: '汉', title: '观沧海' },
          { poem: '所谓伊人，在水一方', author: '佚名', dynasty: '周', title: '蒹葭' },
          { poem: '日出江花红胜火，春来江水绿如蓝', author: '白居易', dynasty: '唐', title: '忆江南' },
          { poem: '孤帆远影碧空尽，唯见长江天际流', author: '李白', dynasty: '唐', title: '黄鹤楼送孟浩然之广陵' },
          { poem: '黄河之水天上来，奔流到海不复回', author: '李白', dynasty: '唐', title: '将进酒' },
          { poem: '大江东去，浪淘尽，千古风流人物', author: '苏轼', dynasty: '宋', title: '念奴娇·赤壁怀古' }
        ],
        '风': [
          { poem: '随风潜入夜，润物细无声', author: '杜甫', dynasty: '唐', title: '春夜喜雨' },
          { poem: '夜来风雨声，花落知多少', author: '孟浩然', dynasty: '唐', title: '春晓' },
          { poem: '春风又绿江南岸，明月何时照我还', author: '王安石', dynasty: '宋', title: '泊船瓜洲' },
          { poem: '风萧萧兮易水寒，壮士一去兮不复还', author: '荆轲', dynasty: '战国', title: '易水歌' },
          { poem: '大风起兮云飞扬，威加海内兮归故乡', author: '刘邦', dynasty: '汉', title: '大风歌' },
          { poem: '相见时难别亦难，东风无力百花残', author: '李商隐', dynasty: '唐', title: '无题' },
          { poem: '长风破浪会有时，直挂云帆济沧海', author: '李白', dynasty: '唐', title: '行路难' },
          { poem: '忽如一夜春风来，千树万树梨花开', author: '岑参', dynasty: '唐', title: '白雪歌送武判官归京' },
          { poem: '沾衣欲湿杏花雨，吹面不寒杨柳风', author: '志南', dynasty: '宋', title: '绝句' },
          { poem: '等闲识得东风面，万紫千红总是春', author: '朱熹', dynasty: '宋', title: '春日' }
        ],
        '雪': [
          { poem: '孤舟蓑笠翁，独钓寒江雪', author: '柳宗元', dynasty: '唐', title: '江雪' },
          { poem: '忽如一夜春风来，千树万树梨花开', author: '岑参', dynasty: '唐', title: '白雪歌送武判官归京' },
          { poem: '梅须逊雪三分白，雪却输梅一段香', author: '卢梅坡', dynasty: '宋', title: '雪梅' },
          { poem: '柴门闻犬吠，风雪夜归人', author: '刘长卿', dynasty: '唐', title: '逢雪宿芙蓉山主人' },
          { poem: '夜深知雪重，时闻折竹声', author: '白居易', dynasty: '唐', title: '夜雪' },
          { poem: '已讶衾枕冷，复见窗户明', author: '白居易', dynasty: '唐', title: '夜雪' },
          { poem: '北国风光，千里冰封，万里雪飘', author: '毛泽东', dynasty: '现代', title: '沁园春·雪' },
          { poem: '欲渡黄河冰塞川，将登太行雪满山', author: '李白', dynasty: '唐', title: '行路难' },
          { poem: '窗含西岭千秋雪，门泊东吴万里船', author: '杜甫', dynasty: '唐', title: '绝句' },
          { poem: '寒雪梅中尽，春风柳上归', author: '李白', dynasty: '唐', title: '宫中行乐词' }
        ],
        '云': [
          { poem: '远上寒山石径斜，白云生处有人家', author: '杜牧', dynasty: '唐', title: '山行' },
          { poem: '黄河远上白云间，一片孤城万仞山', author: '王之涣', dynasty: '唐', title: '凉州词' },
          { poem: '朝辞白帝彩云间，千里江陵一日还', author: '李白', dynasty: '唐', title: '早发白帝城' },
          { poem: '不畏浮云遮望眼，自缘身在最高层', author: '王安石', dynasty: '宋', title: '登飞来峰' },
          { poem: '总为浮云能蔽日，长安不见使人愁', author: '李白', dynasty: '唐', title: '登金陵凤凰台' },
          { poem: '浮云游子意，落日故人情', author: '李白', dynasty: '唐', title: '送友人' },
          { poem: '黑云压城城欲摧，甲光向日金鳞开', author: '李贺', dynasty: '唐', title: '雁门太守行' },
          { poem: '青海长云暗雪山，孤城遥望玉门关', author: '王昌龄', dynasty: '唐', title: '从军行' },
          { poem: '孤云独去闲，相看两不厌', author: '李白', dynasty: '唐', title: '独坐敬亭山' },
          { poem: '野径云俱黑，江船火独明', author: '杜甫', dynasty: '唐', title: '春夜喜雨' }
        ],
        '酒': [
          { poem: '花间一壶酒，独酌无相亲', author: '李白', dynasty: '唐', title: '月下独酌' },
          { poem: '劝君更尽一杯酒，西出阳关无故人', author: '王维', dynasty: '唐', title: '送元二使安西' },
          { poem: '葡萄美酒夜光杯，欲饮琵琶马上催', author: '王翰', dynasty: '唐', title: '凉州词' },
          { poem: '借问酒家何处有，牧童遥指杏花村', author: '杜牧', dynasty: '唐', title: '清明' },
          { poem: '金樽清酒斗十千，玉盘珍羞直万钱', author: '李白', dynasty: '唐', title: '行路难' },
          { poem: '醉卧沙场君莫笑，古来征战几人回', author: '王翰', dynasty: '唐', title: '凉州词' },
          { poem: '浊酒一杯家万里，燕然未勒归无计', author: '范仲淹', dynasty: '宋', title: '渔家傲·秋思' },
          { poem: '今宵酒醒何处？杨柳岸，晓风残月', author: '柳永', dynasty: '宋', title: '雨霖铃' },
          { poem: '酒入愁肠，化作相思泪', author: '范仲淹', dynasty: '宋', title: '苏幕遮' },
          { poem: '对酒当歌，人生几何', author: '曹操', dynasty: '汉', title: '短歌行' }
        ],
        '愁': [
          { poem: '问君能有几多愁，恰似一江春水向东流', author: '李煜', dynasty: '南唐', title: '虞美人' },
          { poem: '抽刀断水水更流，举杯消愁愁更愁', author: '李白', dynasty: '唐', title: '宣州谢朓楼饯别校书叔云' },
          { poem: '月落乌啼霜满天，江枫渔火对愁眠', author: '张继', dynasty: '唐', title: '枫桥夜泊' },
          { poem: '剪不断，理还乱，是离愁，别是一般滋味在心头', author: '李煜', dynasty: '南唐', title: '相见欢' },
          { poem: '一种相思，两处闲愁', author: '李清照', dynasty: '宋', title: '一剪梅' },
          { poem: '薄雾浓云愁永昼，瑞脑销金兽', author: '李清照', dynasty: '宋', title: '醉花阴' },
          { poem: '却看妻子愁何在，漫卷诗书喜欲狂', author: '杜甫', dynasty: '唐', title: '闻官军收河南河北' },
          { poem: '少年不识愁滋味，爱上层楼', author: '辛弃疾', dynasty: '宋', title: '丑奴儿·书博山道中壁' },
          { poem: '日暮乡关何处是？烟波江上使人愁', author: '崔颢', dynasty: '唐', title: '黄鹤楼' },
          { poem: '总为浮云能蔽日，长安不见使人愁', author: '李白', dynasty: '唐', title: '登金陵凤凰台' }
        ]
      }
    }
  },
  computed: {
    canUseHint() {
      return this.currentDifficulty !== 'hard' && this.hintCount < this.maxHints[this.currentDifficulty]
    }
  },
  methods: {
    // 难度选择
    selectDifficulty(difficulty) {
      this.selectedDifficulty = difficulty
    },
    
    // 进入令字设置
    goToSetup() {
      this.inSetup = true
    },
    
    // 返回难度选择
    backToDifficulty() {
      this.inSetup = false
    },
    
    // 验证自定义令字
    validateCustomKeyword() {
      this.keywordError = ''
      this.keywordWarning = ''
      
      const keyword = this.customKeyword
      if (!keyword) return
      
      // 检查是否为单个中文字符
      const chineseCharRegex = /^[\u4e00-\u9fa5]$/
      if (!chineseCharRegex.test(keyword)) {
        this.keywordError = '请输入单个简体中文字符'
        return
      }
      
      // 检查诗词库覆盖率
      const poems = this.poemDatabase[keyword] || []
      if (poems.length < 10) {
        this.keywordWarning = '该令字诗词储备较少，建议更换高频令字'
      }
      
      this.selectedKeyword = keyword
    },
    
    // 生成随机令字
    generateRandomKeyword() {
      // 从推荐令字中随机选择一个
      const randomIndex = Math.floor(Math.random() * this.recommendedKeywords.length)
      const randomKeyword = this.recommendedKeywords[randomIndex]
      this.customKeyword = randomKeyword
      this.validateCustomKeyword()
    },
    
    // 确认设置并开始游戏
    confirmSetup() {
      // 检查登录状态
      const token = localStorage.getItem('token')
      if (!token) {
        localStorage.setItem('redirectPath', this.$route.fullPath)
        this.$router.push('/login')
        return
      }
      
      // 确定令字
      this.currentKeyword = this.selectedKeyword || this.customKeyword
      if (!this.currentKeyword) {
        alert('请选择或输入令字')
        return
      }
      
      // 确定难度
      this.currentDifficulty = this.selectedDifficulty
      this.timeLimit = this.difficulties.find(d => d.level === this.currentDifficulty).timeLimit
      
      // 开始游戏
      this.startGame()
    },
    
    // 开始游戏
    startGame() {
      // 重置游戏状态
      this.gameStarted = true
      this.gameOver = false
      this.inSetup = false
      this.score = 0
      this.correctRounds = 0
      this.timeLeft = this.timeLimit
      this.userInput = ''
      this.poemHistory = []
      this.usedPoems = new Set()
      this.hintCount = 0
      this.currentPlayer = 'user'
      this.currentPosition = this.currentDifficulty === 'easy' ? 0 : 1
      
      // 开始计时
      this.startTimer()
      
      // 聚焦输入框
      this.$nextTick(() => {
        if (this.$refs.poemInput) {
          this.$refs.poemInput.focus()
        }
      })
    },
    
    // 开始计时
    startTimer() {
      this.stopTimer()
      this.timer = setInterval(() => {
        this.timeLeft--
        if (this.timeLeft <= 0) {
          this.handleTimeout()
        }
      }, 1000)
    },
    
    // 停止计时
    stopTimer() {
      if (this.timer) {
        clearInterval(this.timer)
        this.timer = null
      }
    },
    
    // 处理超时
    handleTimeout() {
      this.stopTimer()
      this.gameResult = 'timeout'
      this.gameOver = true
      this.gameStarted = false
    },
    
    // 提交诗句
    submitPoem() {
      const poem = this.userInput.trim()
      if (!poem) return
      
      // 校验诗句
      const validation = this.validatePoem(poem)
      if (!validation.valid) {
        alert(validation.message)
        return
      }
      
      // 添加到历史记录
      const historyItem = {
        player: 'user',
        poem: poem,
        position: this.currentPosition,
        analysis: this.getPoemAnalysis(poem)
      }
      this.poemHistory.push(historyItem)
      this.usedPoems.add(poem)
      
      // 更新分数和回合数
      this.score += this.getScoreForRound()
      this.correctRounds++
      
      // 重置输入和时间
      this.userInput = ''
      this.timeLeft = this.timeLimit
      
      // 切换到系统回合
      this.currentPlayer = 'system'
      
      // 系统思考后生成诗句
      setTimeout(() => {
        this.generateSystemPoem()
      }, 1000)
    },
    
    // 校验诗句
    validatePoem(poem) {
      // 格式校验
      if (!/^[\u4e00-\u9fa5，。！？；]+$/.test(poem)) {
        return { valid: false, message: '请输入纯中文诗句，不含字母、数字、符号' }
      }
      
      // 长度校验 - 进一步放宽限制，允许4-20字的诗句（支持完整联句）
      const charCount = poem.replace(/[，。！？；]/g, '').length
      if (charCount < 4 || charCount > 20) {
        return { valid: false, message: '请输入完整的诗句，长度在4-20字之间' }
      }
      
      // 令字校验
      if (!poem.includes(this.currentKeyword)) {
        return { valid: false, message: `诗句中未包含本局令字【${this.currentKeyword}】` }
      }
      
      // 位置校验（进阶/专业难度）
      if (this.currentPosition > 0) {
        const charIndex = poem.indexOf(this.currentKeyword)
        if (charIndex !== this.currentPosition - 1) {
          return { valid: false, message: `当前回合要求令字【${this.currentKeyword}】在诗句的第${this.currentPosition}位` }
        }
      }
      
      // 重复校验
      if (this.usedPoems.has(poem)) {
        return { valid: false, message: '该诗句已在本局中使用过' }
      }
      
      return { valid: true, message: '诗句有效' }
    },
    
    // 检查诗句是否在数据库中
    isValidPoemInDatabase(poem) {
      // 简化版：检查是否在诗句库中
      for (const keyword in this.poemDatabase) {
        for (const item of this.poemDatabase[keyword]) {
          if (item.poem === poem) {
            return true
          }
        }
      }
      return false
    },
    
    // 获取诗句分析
    getPoemAnalysis(poem) {
      for (const keyword in this.poemDatabase) {
        for (const item of this.poemDatabase[keyword]) {
          if (item.poem === poem) {
            return {
              author: item.author,
              dynasty: item.dynasty,
              title: item.title,
              translation: this.getPoemTranslation(item.poem)
            }
          }
        }
      }
      // 如果诗句不在数据库中，返回默认分析
      return {
        author: '未知',
        dynasty: '未知',
        title: '未知',
        translation: '译文暂无'
      }
    },
    
    // 获取诗句译文（简化版）
    getPoemTranslation(poem) {
      // 这里可以根据需要扩展更详细的译文
      const translations = {
        '春眠不觉晓，处处闻啼鸟': '春天睡觉不知不觉天就亮了，到处都能听到鸟儿的叫声',
        '床前明月光，疑是地上霜': '明亮的月光洒在床前，好像地上的霜',
        '举头望明月，低头思故乡': '抬起头望着天上的明月，低下头思念自己的故乡',
        '锄禾日当午，汗滴禾下土': '农民在正午烈日下锄草，汗水滴落在禾苗生长的土地上',
        '谁知盘中餐，粒粒皆辛苦': '有谁知道盘子里的饭食，每一粒都是农民辛苦劳动得来的'
      }
      return translations[poem] || '译文暂无'
    },
    
    // 系统生成诗句
    generateSystemPoem() {
      const poems = this.poemDatabase[this.currentKeyword] || []
      if (poems.length === 0) {
        this.handleSystemDefeat()
        return
      }
      
      // 过滤掉已使用的诗句
      const availablePoems = poems.filter(item => !this.usedPoems.has(item.poem))
      
      // 过滤位置要求（进阶/专业难度）
      const filteredPoems = this.currentPosition > 0 
        ? availablePoems.filter(item => item.poem.indexOf(this.currentKeyword) === this.currentPosition - 1)
        : availablePoems
      
      if (filteredPoems.length === 0) {
        this.handleSystemDefeat()
        return
      }
      
      // 随机选择一句
      const randomIndex = Math.floor(Math.random() * filteredPoems.length)
      const selectedPoem = filteredPoems[randomIndex]
      
      // 添加到历史记录
      const historyItem = {
        player: 'system',
        poem: selectedPoem.poem,
        position: this.currentPosition,
        analysis: {
          author: selectedPoem.author,
          dynasty: selectedPoem.dynasty,
          title: selectedPoem.title,
          translation: this.getPoemTranslation(selectedPoem.poem)
        }
      }
      this.poemHistory.push(historyItem)
      this.usedPoems.add(selectedPoem.poem)
      
      // 更新位置（进阶/专业难度）
      if (this.currentPosition > 0) {
        const lineLength = selectedPoem.poem.replace(/[，。！？；]/g, '').length
        const maxPosition = lineLength === 5 ? 5 : 7
        this.currentPosition = this.currentPosition % maxPosition + 1
      }
      
      // 切换回用户回合
      this.currentPlayer = 'user'
      this.timeLeft = this.timeLimit
      
      // 聚焦输入框
      this.$nextTick(() => {
        if (this.$refs.poemInput) {
          this.$refs.poemInput.focus()
        }
      })
    },
    
    // 处理系统无法接句
    handleSystemDefeat() {
      this.stopTimer()
      this.gameResult = 'win'
      this.gameOver = true
      this.gameStarted = false
    },
    
    // 使用提示
    useHint(level) {
      if (!this.canUseHint) return
      
      this.hintCount++
      
      // 扣除积分
      const hintScores = { 1: 5, 2: 10, 3: 20 }
      this.score = Math.max(0, this.score - hintScores[level])
      
      // 生成提示
      const availablePoems = this.getAvailablePoems()
      if (availablePoems.length === 0) {
        alert('暂无可用提示')
        return
      }
      
      const hintPoem = availablePoems[Math.floor(Math.random() * availablePoems.length)]
      
      switch (level) {
        case 1:
          alert(`提示：作者是${hintPoem.author}，朝代是${hintPoem.dynasty}`)
          break
        case 2:
          alert(`提示：首字是「${hintPoem.poem.charAt(0)}」`)
          break
        case 3:
          alert(`提示：示例诗句：${hintPoem.poem}`)
          break
      }
    },
    
    // 获取可用诗句
    getAvailablePoems() {
      const poems = this.poemDatabase[this.currentKeyword] || []
      const availablePoems = poems.filter(item => !this.usedPoems.has(item.poem))
      
      if (this.currentPosition > 0) {
        return availablePoems.filter(item => item.poem.indexOf(this.currentKeyword) === this.currentPosition - 1)
      }
      return availablePoems
    },
    
    // 获取回合得分
    getScoreForRound() {
      const baseScores = { easy: 10, medium: 20, hard: 30 }
      let score = baseScores[this.currentDifficulty]
      
      // 连胜加成
      if (this.correctRounds >= 2) {
        score += 5 * (this.correctRounds - 1)
      }
      
      return score
    },
    
    // 停止游戏
    stopGame() {
      this.stopTimer()
      this.gameOver = true
      this.gameStarted = false
      this.gameResult = 'invalid'
    },
    
    // 重新开始
    restartGame() {
      this.startGame()
    },
    
    // 更换令字
    changeKeyword() {
      this.inSetup = true
      this.gameOver = false
    },
    
    // 更换难度
    changeDifficulty() {
      this.inSetup = false
      this.gameOver = false
    },
    
    // 返回首页
    goBack() {
      this.$router.push('/')
    },
    

    
    // 收藏诗句到错题本
    collectPoem(item) {
      // 这里可以实现收藏功能
      item.isCollected = true
      alert('已收藏到错题本')
    },
    
    // 获取难度名称
    getDifficultyName() {
      const difficulty = this.difficulties.find(d => d.level === this.currentDifficulty)
      return difficulty ? difficulty.name : '未知'
    }
  },
  beforeUnmount() {
    this.stopTimer()
  }
}
</script>

<style scoped>
.feihua-game {
  padding: 20px 0;
  min-height: 80vh;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 导航 tabs */
.nav-tabs {
  display: flex;
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  margin-bottom: 30px;
  overflow: hidden;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab.active {
  background: #4caf50;
}

.tab.active a {
  color: white;
}

.tab a {
  text-decoration: none;
  color: #333;
  font-size: 16px;
  font-weight: 500;
  transition: color 0.3s ease;
}

.game-title {
  text-align: center;
  font-size: 36px;
  color: #333;
  margin-bottom: 30px;
  font-weight: bold;
}

.rules-entry {
  text-align: center;
  margin-bottom: 30px;
}

.rules-btn {
  padding: 10px 20px;
  background: rgba(33, 150, 243, 0.2);
  color: var(--secondary-color);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 14px;
  transition: var(--transition);
}

.rules-btn:hover {
  background: rgba(33, 150, 243, 0.3);
  border-color: rgba(33, 150, 243, 0.5);
  transform: translateY(-2px);
}

/* 模态框 */
.newbie-guide-modal,
.rules-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: var(--border-radius);
  max-width: 600px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-content h2 {
  margin-bottom: 20px;
  color: #333;
}

.modal-content h3 {
  margin-top: 20px;
  margin-bottom: 10px;
  color: #555;
}

.modal-content ul {
  padding-left: 20px;
  margin-bottom: 20px;
}

.modal-content li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.example {
  background: #f0f0f0;
  padding: 10px;
  border-radius: 8px;
  margin: 10px 0;
  font-style: italic;
}

.close-btn,
.guide-btn {
  padding: 10px 20px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  margin-top: 20px;
}

.close-btn:hover,
.guide-btn:hover {
  background: #45a049;
}

/* 难度选择 */
.difficulty-select {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: var(--glass-shadow);
}

.difficulty-select h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.difficulty-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.difficulty-card {
  background: rgba(255, 252, 240, 0.3);
  border: 2px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 20px;
  cursor: pointer;
  transition: var(--transition);
  text-align: center;
}

.difficulty-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.difficulty-card.active {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
}

.difficulty-card h3 {
  margin-bottom: 10px;
  color: #333;
}

.difficulty-card p {
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.time-limit {
  font-weight: bold;
  color: #ff9800;
}

.next-btn {
  display: block;
  width: 100%;
  padding: 15px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 16px;
  transition: var(--transition);
}

.next-btn:hover {
  background: #45a049;
  transform: translateY(-2px);
}

/* 令字设置 */
.keyword-setup {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: var(--glass-shadow);
}

.keyword-setup h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.recommended-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 30px;
}

.keyword-btn {
  padding: 10px 20px;
  background: rgba(255, 252, 240, 0.3);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  cursor: pointer;
  transition: var(--transition);
}

.keyword-btn:hover {
  background: rgba(76, 175, 80, 0.1);
  border-color: #4caf50;
}

.keyword-btn.active {
  background: #4caf50;
  color: white;
  border-color: #4caf50;
}

.custom-keyword {
  margin-bottom: 30px;
}

.custom-keyword h3 {
  margin-bottom: 10px;
  color: #555;
}

.keyword-input-container {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.random-keyword-btn {
  padding: 12px 20px;
  background: rgba(33, 150, 243, 0.2);
  color: var(--secondary-color);
  border: 1px solid rgba(33, 150, 243, 0.3);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 14px;
  transition: var(--transition);
  white-space: nowrap;
}

.random-keyword-btn:hover {
  background: rgba(33, 150, 243, 0.3);
  border-color: rgba(33, 150, 243, 0.5);
  transform: translateY(-2px);
}

.custom-input {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  background: rgba(255, 252, 240, 0.3);
  font-size: 16px;
}

.error-message {
  color: #f44336;
  font-size: 14px;
  margin-top: 10px;
}

.warning-message {
  color: #ff9800;
  font-size: 14px;
  margin-top: 10px;
}

.setup-actions {
  display: flex;
  gap: 20px;
}

.setup-actions button {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 16px;
  transition: var(--transition);
}

.back-btn {
  background: rgba(33, 150, 243, 0.2);
  color: var(--secondary-color);
  border-color: rgba(33, 150, 243, 0.3);
}

.back-btn:hover {
  background: rgba(33, 150, 243, 0.3);
  border-color: rgba(33, 150, 243, 0.5);
}

.start-btn {
  background: #4caf50;
  color: white;
  border-color: #4caf50;
}

.start-btn:hover:not(:disabled) {
  background: #45a049;
  transform: translateY(-2px);
}

.start-btn:disabled {
  background: #cccccc;
  border-color: #cccccc;
  cursor: not-allowed;
}

/* 游戏界面 */
.game-play {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: var(--glass-shadow);
}

.game-info {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 30px;
  padding: 20px;
  background: rgba(255, 252, 240, 0.3);
  border-radius: var(--border-radius);
  border: 1px solid var(--glass-border);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-weight: bold;
  color: #555;
}

.value {
  color: #333;
}

.keyword {
  font-size: 20px;
  font-weight: bold;
  color: #e91e63;
}

.position {
  font-size: 18px;
  font-weight: bold;
  color: #2196f3;
}

.score {
  font-size: 20px;
  font-weight: bold;
  color: #4caf50;
}

.timer {
  font-size: 20px;
  font-weight: bold;
  color: #ff9800;
}

.timer.time-warning {
  color: #f44336;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.poem-input-section {
  margin-bottom: 30px;
}

.poem-input-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.poem-input {
  width: 100%;
  padding: 15px;
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  background: rgba(255, 252, 240, 0.3);
  font-size: 16px;
  margin-bottom: 15px;
}

.poem-input:focus {
  outline: none;
  border-color: #4caf50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.input-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.submit-btn {
  padding: 12px 24px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 16px;
  transition: var(--transition);
}

.submit-btn:hover:not(:disabled) {
  background: #45a049;
  transform: translateY(-2px);
}

.submit-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.hint-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.hint-btn {
  padding: 8px 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 14px;
  transition: var(--transition);
}

.hint-btn.level-1 {
  background: rgba(33, 150, 243, 0.2);
  color: var(--secondary-color);
}

.hint-btn.level-2 {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.hint-btn.level-3 {
  background: rgba(244, 67, 54, 0.2);
  color: #f44336;
}

.hint-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.hint-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.system-thinking {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
  background: rgba(255, 252, 240, 0.3);
  border-radius: var(--border-radius);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4caf50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 历史记录 */
.history-section {
  margin-bottom: 30px;
}

.history-section h3 {
  margin-bottom: 15px;
  color: #333;
}

.history-list {
  max-height: 400px;
  overflow-y: auto;
  padding: 20px;
  background: rgba(255, 252, 240, 0.3);
  border-radius: var(--border-radius);
  border: 1px solid var(--glass-border);
}

.history-item {
  margin-bottom: 20px;
  padding: 15px;
  border-radius: var(--border-radius);
  transition: var(--transition);
}

.history-item.user-poem {
  background: rgba(139, 69, 19, 0.1);
  border-left: 4px solid #8b4513;
}

.history-item.system-poem {
  background: rgba(76, 175, 80, 0.1);
  border-left: 4px solid #4caf50;
}

.history-number {
  font-weight: bold;
  margin-right: 15px;
  color: #666;
  min-width: 30px;
}

.history-content {
  flex: 1;
  line-height: 1.6;
  font-size: 16px;
}

.char {
  position: relative;
}

.char.keyword {
  color: #e91e63;
  font-weight: bold;
}

.position-mark {
  position: absolute;
  top: -12px;
  right: -12px;
  font-size: 10px;
  background: #2196f3;
  color: white;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.poem-analysis {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
  font-size: 14px;
  color: #666;
}

.analysis-author {
  font-weight: bold;
  margin-bottom: 5px;
}

.analysis-title {
  margin-bottom: 5px;
}

.analysis-translation {
  font-style: italic;
}

.stop-btn {
  padding: 12px 24px;
  background: #f44336;
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 16px;
  transition: var(--transition);
  display: block;
  margin: 0 auto;
}

.stop-btn:hover {
  background: #da190b;
  transform: translateY(-2px);
}

/* 游戏结束 */
.game-over {
  background: var(--glass-background);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  padding: 40px;
  text-align: center;
  box-shadow: var(--glass-shadow);
}

.game-over h2 {
  font-size: 32px;
  color: #333;
  margin-bottom: 30px;
  font-weight: bold;
}

.game-result {
  margin-bottom: 40px;
}

.game-result p {
  margin-bottom: 15px;
  font-size: 18px;
}

.final-score {
  font-size: 48px;
  font-weight: bold;
  color: #4caf50;
}

.game-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  justify-content: center;
  margin-bottom: 40px;
}

.action-btn {
  padding: 12px 24px;
  border: 1px solid var(--glass-border);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 16px;
  transition: var(--transition);
  min-width: 120px;
}

.action-btn.restart {
  background: #4caf50;
  color: white;
  border-color: #4caf50;
}

.action-btn.change-keyword {
  background: #2196f3;
  color: white;
  border-color: #2196f3;
}

.action-btn.change-difficulty {
  background: #ff9800;
  color: white;
  border-color: #ff9800;
}

.action-btn.back-home {
  background: #9e9e9e;
  color: white;
  border-color: #9e9e9e;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.learning-section {
  text-align: left;
  margin-top: 40px;
  padding-top: 30px;
  border-top: 1px solid var(--glass-border);
}

.learning-section h3 {
  margin-bottom: 20px;
  color: #333;
  text-align: center;
}

.learning-content {
  max-height: 400px;
  overflow-y: auto;
}

.learning-item {
  margin-bottom: 20px;
  padding: 15px;
  background: rgba(255, 252, 240, 0.3);
  border-radius: var(--border-radius);
}

.learning-item h4 {
  margin-bottom: 10px;
  color: #333;
}

.learning-item p {
  margin-bottom: 10px;
  color: #666;
  font-size: 14px;
}

.error-analysis {
  color: #f44336 !important;
  font-weight: bold;
}

.collect-btn {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 14px;
  transition: var(--transition);
}

.collect-btn:hover {
  background: #1976d2;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .game-title {
    font-size: 28px;
  }
  
  .difficulty-options {
    grid-template-columns: 1fr;
  }
  
  .game-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>