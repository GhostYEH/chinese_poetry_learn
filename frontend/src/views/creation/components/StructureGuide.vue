/**
 * 结构引导面板组件
 * Step 2: 结构引导 - 展示诗词结构提示，帮助用户理解写作框架
 */
<template>
  <div class="structure-guide">
    <!-- 面板标题 -->
    <div class="panel-header">
      <div class="header-icon">🗺️</div>
      <div class="header-text">
        <h2>结构引导</h2>
        <p>根据体裁获取写作结构提示，掌握诗词章法</p>
      </div>
    </div>

    <!-- 结构信息卡片 -->
    <div class="structure-info" v-if="structure">
      <div class="structure-header-card">
        <div class="structure-title">
          <h3>{{ structure.name }}</h3>
          <span class="structure-badge">{{ structure.lines }}句 × {{ structure.charactersPerLine }}字</span>
        </div>
        <p class="structure-intro">{{ structure.introduction }}</p>
      </div>

      <!-- 结构流程图 -->
      <div class="structure-flow">
        <div
          v-for="(item, index) in structure.structure"
          :key="index"
          class="structure-item"
        >
          <div class="structure-node">
            <div class="node-number">{{ index + 1 }}</div>
            <div class="node-content">
              <div class="node-role-badge" :class="`role-${item.role}`">
                {{ item.role }}
              </div>
              <h4 class="node-title">{{ item.position }}</h4>
              <p class="node-desc">{{ item.description }}</p>
              <div class="node-example">
                <span class="example-label">范例：</span>
                <span class="example-text">"{{ item.example }}"</span>
              </div>
            </div>
          </div>
          <div class="structure-connector" v-if="index < structure.structure.length - 1">
            <svg width="24" height="40" viewBox="0 0 24 40">
              <path d="M12 0 L12 35 M6 28 L12 35 L18 28" stroke="#d4c4b0" stroke-width="2" fill="none"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- 写作技巧 -->
      <div class="tips-section">
        <div class="tips-header">
          <span class="tips-icon">✎</span>
          <h3>写作技巧</h3>
        </div>
        <div class="tips-grid">
          <div
            v-for="(tip, index) in structure.tips"
            :key="index"
            class="tip-card"
          >
            <span class="tip-number">{{ index + 1 }}</span>
            <span class="tip-text">{{ tip }}</span>
          </div>
        </div>
      </div>

      <!-- 韵律提示 -->
      <div class="rhyme-section" v-if="structure.rhyme">
        <div class="rhyme-header">
          <span class="rhyme-icon">🎵</span>
          <h3>韵律要求</h3>
        </div>
        <div class="rhyme-content">
          <p>{{ structure.rhyme }}</p>
          <div class="rhyme-examples">
            <span
              v-for="rhyme in structure.rhymeExamples"
              :key="rhyme"
              class="rhyme-tag"
            >
              {{ rhyme }}
            </span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button class="back-btn" @click="$emit('back')">
          <span>←</span>
          <span>返回灵感</span>
        </button>
        <button class="start-btn" @click="$emit('start')">
          <span>开始创作</span>
          <span class="arrow">→</span>
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="loading-state" v-else-if="isLoading">
      <div class="loading-spinner-large"></div>
      <p>正在加载结构引导...</p>
    </div>

    <!-- 默认状态 - 加载结构 -->
    <div class="load-prompt" v-else>
      <div class="prompt-icon">📖</div>
      <h3>了解诗词结构</h3>
      <p>掌握起承转合的章法，让你的创作更有条理</p>
      <button class="load-btn" @click="$emit('load')" :disabled="isLoading">
        <span v-if="isLoading" class="loading-spinner"></span>
        <span v-else>☯</span>
        <span>{{ isLoading ? '加载中...' : '获取结构引导' }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';

export default {
  name: 'StructureGuide',
  props: {
    genre: {
      type: String,
      required: true
    },
    theme: {
      type: String,
      default: ''
    },
    isLoading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['load', 'back', 'start'],
  setup(props) {
    // 根据体裁返回预设的结构引导数据
    const getStructureData = (genre, theme) => {
      const structures = {
        '五言绝句': {
          name: '五言绝句',
          lines: 4,
          charactersPerLine: 5,
          introduction: '五言绝句是古典诗歌中最精炼的形式，四句二十字，却能蕴含无穷意境。讲究言简意赅、以少胜多。',
          structure: [
            {
              role: '起',
              position: '第一句（起）',
              description: '点明题意，引出主题。描景或叙事，奠定全诗基调。',
              example: '白日依山尽，黄河入海流'
            },
            {
              role: '承',
              position: '第二句（承）',
              description: '承接首句，延续意境。可以继续写景或深化情感。',
              example: '欲穷千里目，更上一层楼'
            },
            {
              role: '转',
              position: '第三句（转）',
              description: '转折变化，打破前两句的平静。常用转折词引入新的情感或思考。',
              example: '海内存知己，天涯若比邻'
            },
            {
              role: '合',
              position: '第四句（合）',
              description: '总结全诗，点明主旨。情感升华或意境定格。',
              example: '夕阳无限好，只是近黄昏'
            }
          ],
          tips: [
            '每句五字，字字珠玑，要言不繁',
            '注意平仄协调，读来朗朗上口',
            '起句要新颖，吸引读者注意',
            '转句是诗眼，需有新意',
            '合句要有力，余韵悠长'
          ],
          rhyme: '二、四句押韵（同韵部），首句可押可不押',
          rhymeExamples: ['ang韵：江、长、强、苍', 'ou韵：流、楼、头、舟']
        },
        '七言绝句': {
          name: '七言绝句',
          lines: 4,
          charactersPerLine: 7,
          introduction: '七言绝句比五言多两个字，表达空间更充裕，适合描写更复杂的场景和情感。',
          structure: [
            {
              role: '起',
              position: '第一句（起）',
              description: '开篇点题，交代时间、地点或背景。',
              example: '故人西辞黄鹤楼，烟花三月下扬州'
            },
            {
              role: '承',
              position: '第二句（承）',
              description: '承接首句，展开描写或叙事。',
              example: '孤帆远影碧空尽，唯见长江天际流'
            },
            {
              role: '转',
              position: '第三句（转）',
              description: '转折变化，常用虚写或感慨。',
              example: '桃花潭水深千尺，不及汪伦送我情'
            },
            {
              role: '合',
              position: '第四句（合）',
              description: '情感高潮或意境定格。',
              example: '春眠不觉晓，处处闻啼鸟'
            }
          ],
          tips: [
            '每句七字，注意节奏感（二二三或二二一二）',
            '首联对仗可增加整饬之美',
            '转句常用设问、反问或感叹',
            '注意情景交融，景中含情',
            '结句要有留白，余味无穷'
          ],
          rhyme: '二、四句必须押韵，三句不押韵（仄收）',
          rhymeExamples: ['ou韵：楼、州、流、舟', 'iang韵：长、阳、香、墙']
        },
        '五言律诗': {
          name: '五言律诗',
          lines: 8,
          charactersPerLine: 5,
          introduction: '五言律诗共八句四十字，比绝句多了四句，更适合铺陈叙事和深入抒情。中间两联必须对仗。',
          structure: [
            {
              role: '起',
              position: '首联（起）',
              description: '起笔破题，点明题意。可写景叙事，奠定基调。',
              example: '山居秋暝'
            },
            {
              role: '承',
              position: '颔联（承）',
              description: '承接首联，继续铺陈。要求对仗工整。',
              example: '空山新雨后，天气晚来秋'
            },
            {
              role: '转',
              position: '颈联（转）',
              description: '转折变化，从写景转向抒情或议论。必须对仗。',
              example: '明月松间照，清泉石上流'
            },
            {
              role: '合',
              position: '尾联（合）',
              description: '收束全诗，点明主旨。情感升华或意境定格。',
              example: '随意春芳歇，王孙自可留'
            }
          ],
          tips: [
            '首联决定全诗基调，要新颖醒目',
            '颔联、颈联必须对仗，工整为佳',
            '注意起承转合的层次感',
            '颈联是全诗最精彩的部分',
            '尾联要呼应首联，首尾圆合'
          ],
          rhyme: '二、四、六、八句押韵，首句可押可不押',
          rhymeExamples: ['ou韵：秋、流、留、舟', 'an韵：山、间、泉、前']
        },
        '七言律诗': {
          name: '七言律诗',
          lines: 8,
          charactersPerLine: 7,
          introduction: '七言律诗共八句五十六字，形式庄重，适合表达复杂情感和重大题材。中间两联必须对仗。',
          structure: [
            {
              role: '起',
              position: '首联（起）',
              description: '起笔破题，气势要足。可用对仗增加厚重感。',
              example: '风急天高猿啸哀，渚清沙白鸟飞回'
            },
            {
              role: '承',
              position: '颔联（承）',
              description: '承接首联，展开描写。必须对仗。',
              example: '无边落木萧萧下，不尽长江滚滚来'
            },
            {
              role: '转',
              position: '颈联（转）',
              description: '转折变化，抒发感慨。必须对仗。',
              example: '万里悲秋常作客，百年多病独登台'
            },
            {
              role: '合',
              position: '尾联（合）',
              description: '收束全诗，情感升华。',
              example: '艰难苦恨繁霜鬓，潦倒新停浊酒杯'
            }
          ],
          tips: [
            '七言比五言更要注意节奏，朗读时要有顿挫',
            '首联若用对仗，能增加整首诗的庄重感',
            '颔联和颈联是精华所在，要精心锤炼',
            '注意意境的统一和情感的层次',
            '尾联要有力，点明主旨'
          ],
          rhyme: '二、四、六、八句押韵，首句可押可不押',
          rhymeExamples: ['ai韵：哀、回、来、台', 'ei韵：病、登、恨、停']
        },
        '宋词': {
          name: '宋词',
          lines: 0,
          charactersPerLine: 0,
          introduction: '宋词分为小令、中调、长调，每种词牌都有固定的格律要求。选好词牌后，要严格遵守平仄和押韵规则。',
          structure: [
            {
              role: '起',
              position: '起拍（前几句）',
              description: '交代背景，引出主题。通常写景或叙事。',
              example: '大江东去，浪淘尽，千古风流人物'
            },
            {
              role: '承',
              position: '过片（中间部分）',
              description: '铺陈描写，层层推进。注意上下阙的衔接。',
              example: '乱石穿空，惊涛拍岸，卷起千堆雪'
            },
            {
              role: '转',
              position: '高潮（转折处）',
              description: '情感爆发或哲理升华，是词眼所在。',
              example: '人生如梦，一尊还酹江月'
            },
            {
              role: '合',
              position: '结尾（煞尾）',
              description: '收束全词，余韵悠长。常用情景交融的手法。',
              example: '故国神游，多情应笑我，早生华发'
            }
          ],
          tips: [
            '选择词牌时要考虑内容的容量和情感基调',
            '严格遵守词牌的平仄要求',
            '注意领字的使用（一、渐、那等）',
            '上下阙之间要有过渡，不能割裂',
            '结句要有力，回味无穷'
          ],
          rhyme: '根据词牌规定，分段押韵',
          rhymeExamples: ['词韵比诗韵更宽泛，相近韵部可通押']
        }
      };

      return structures[genre] || structures['五言绝句'];
    };

    const structure = computed(() => getStructureData(props.genre, props.theme));

    return {
      structure
    };
  }
};
</script>

<style scoped>
.structure-guide {
  padding: 24px;
}

/* 面板标题 */
.panel-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 2px solid rgba(139, 115, 85, 0.1);
}

.header-icon {
  font-size: 32px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(212, 165, 116, 0.15), rgba(139, 115, 85, 0.1));
  border-radius: 16px;
}

.header-text h2 {
  font-size: 22px;
  color: #5d4e37;
  margin: 0 0 4px 0;
  font-family: 'Noto Serif SC', serif;
}

.header-text p {
  font-size: 14px;
  color: #8b7355;
  margin: 0;
}

/* 结构信息 */
.structure-info {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.structure-header-card {
  background: linear-gradient(135deg, rgba(139, 115, 85, 0.08), rgba(212, 165, 116, 0.12));
  border-radius: 16px;
  padding: 24px;
  text-align: center;
}

.structure-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 12px;
}

.structure-title h3 {
  font-size: 24px;
  color: #5d4e37;
  margin: 0;
  font-family: 'Noto Serif SC', serif;
}

.structure-badge {
  padding: 6px 14px;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  border-radius: 20px;
  font-size: 13px;
}

.structure-intro {
  font-size: 14px;
  color: #666;
  line-height: 1.7;
  margin: 0;
}

/* 结构流程 */
.structure-flow {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.structure-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.structure-node {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
  padding: 20px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  border: 1px solid rgba(139, 115, 85, 0.12);
  animation: fadeInUp 0.6s ease-out;
}

.node-number {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  border-radius: 50%;
  font-size: 16px;
  font-weight: bold;
  flex-shrink: 0;
}

.node-content {
  flex: 1;
}

.node-role-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  color: white;
  margin-bottom: 8px;
}

.role-起 { background: linear-gradient(135deg, #e6a857, #d4914a); }
.role-承 { background: linear-gradient(135deg, #6b9e78, #5a8a66); }
.role-转 { background: linear-gradient(135deg, #7a9ec7, #6589b5); }
.role-合 { background: linear-gradient(135deg, #c77d8e, #b36b7a); }

.node-title {
  font-size: 16px;
  color: #5d4e37;
  margin: 0 0 6px 0;
  font-family: 'Noto Serif SC', serif;
}

.node-desc {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.node-example {
  background: rgba(245, 239, 230, 0.8);
  padding: 12px 16px;
  border-radius: 10px;
  border-left: 3px solid #d4a574;
}

.example-label {
  font-size: 12px;
  color: #b8a88a;
  display: block;
  margin-bottom: 4px;
}

.example-text {
  font-size: 15px;
  color: #5d4e37;
  font-family: 'Noto Serif SC', serif;
  font-style: italic;
}

.structure-connector {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

/* 写作技巧 */
.tips-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(139, 115, 85, 0.12);
}

.tips-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.tips-icon {
  font-size: 20px;
}

.tips-header h3 {
  font-size: 16px;
  color: #5d4e37;
  margin: 0;
  font-family: 'Noto Serif SC', serif;
}

.tips-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tip-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(212, 165, 116, 0.06);
  border-radius: 12px;
}

.tip-number {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.tip-text {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

/* 韵律提示 */
.rhyme-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(139, 115, 85, 0.12);
}

.rhyme-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.rhyme-icon {
  font-size: 20px;
}

.rhyme-header h3 {
  font-size: 16px;
  color: #5d4e37;
  margin: 0;
  font-family: 'Noto Serif SC', serif;
}

.rhyme-content p {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin: 0 0 14px 0;
}

.rhyme-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.rhyme-tag {
  padding: 8px 14px;
  background: rgba(212, 165, 116, 0.12);
  border-radius: 16px;
  font-size: 13px;
  color: #8b7355;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 8px;
}

.back-btn,
.start-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 28px;
  border-radius: 14px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.back-btn {
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid rgba(139, 115, 85, 0.2);
  color: #8b7355;
}

.back-btn:hover {
  background: rgba(139, 115, 85, 0.1);
  border-color: #8b7355;
}

.start-btn {
  flex: 1;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  border: none;
  color: white;
}

.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(139, 115, 85, 0.3);
}

.arrow {
  transition: transform 0.3s ease;
}

.start-btn:hover .arrow {
  transform: translateX(5px);
}

/* 加载状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  gap: 16px;
}

.loading-spinner-large {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(139, 115, 85, 0.2);
  border-top-color: #d4a574;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  font-size: 15px;
  color: #8b7355;
}

/* 默认提示 */
.load-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 20px;
  border: 2px dashed rgba(139, 115, 85, 0.2);
}

.prompt-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.load-prompt h3 {
  font-size: 20px;
  color: #5d4e37;
  margin: 0 0 8px 0;
  font-family: 'Noto Serif SC', serif;
}

.load-prompt p {
  font-size: 14px;
  color: #8b7355;
  margin: 0 0 24px 0;
}

.load-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  background: linear-gradient(135deg, #8b7355, #a08060);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Noto Serif SC', serif;
}

.load-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(139, 115, 85, 0.3);
}

.load-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式 */
@media (max-width: 768px) {
  .structure-guide {
    padding: 16px;
  }

  .action-buttons {
    flex-direction: column;
  }

  .back-btn {
    order: 2;
  }

  .start-btn {
    order: 1;
  }
}
</style>
