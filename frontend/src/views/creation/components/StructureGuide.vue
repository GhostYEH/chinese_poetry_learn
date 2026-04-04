/**
 * 结构引导面板组件
 * Step 2: 结构引导 - 展示诗词结构提示，帮助用户理解写作框架
 * 全面接入AI系统，提供个性化指导
 */
<template>
  <div class="structure-guide">
    <!-- 面板标题 -->
    <div class="panel-header">
      <div class="header-icon">🗺️</div>
      <div class="header-text">
        <h2>结构引导</h2>
        <p>AI为你定制专属写作框架，深度契合创作主题</p>
      </div>
    </div>

    <!-- 加载状态 -->
    <div class="loading-state" v-if="localLoading">
      <div class="loading-spinner-large"></div>
      <p>AI正在为你生成个性化结构引导...</p>
    </div>

    <!-- 结构信息卡片 -->
    <div class="structure-info" v-else-if="structure">
      <div class="structure-header-card">
        <div class="structure-title">
          <h3>{{ structure.name }}</h3>
          <span class="structure-badge" v-if="structure.lines">{{ structure.lines }}句 × {{ structure.charactersPerLine }}字</span>
          <span class="structure-badge ai-badge" v-else>AI智能引导</span>
        </div>
        <p class="structure-intro">{{ structure.introduction }}</p>
      </div>

      <!-- 结构流程图 -->
      <div class="structure-flow">
        <div class="flow-title">
          <span class="flow-icon">📐</span>
          <h3>起承转合 · 结构详解</h3>
        </div>
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
              <div class="node-theme-hint" v-if="item.themeHint">
                <span class="hint-icon">💡</span>
                <span class="hint-text">{{ item.themeHint }}</span>
              </div>
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

      <!-- 关键词使用建议 -->
      <div class="keyword-section" v-if="structure.keywordSuggestions && structure.keywordSuggestions.length">
        <div class="section-header">
          <span class="section-icon">🔑</span>
          <h3>关键词运用指南</h3>
        </div>
        <div class="keyword-suggestions">
          <div
            v-for="(kw, index) in structure.keywordSuggestions"
            :key="index"
            class="keyword-item"
          >
            <span class="keyword-tag">{{ kw.keyword }}</span>
            <span class="keyword-usage">{{ kw.usage }}</span>
          </div>
        </div>
      </div>

      <!-- 写作技巧 -->
      <div class="tips-section">
        <div class="section-header">
          <span class="section-icon">✎</span>
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
        <div class="section-header">
          <span class="section-icon">🎵</span>
          <h3>韵律要求</h3>
        </div>
        <div class="rhyme-content">
          <p>{{ structure.rhyme }}</p>
          <div class="rhyme-examples" v-if="structure.rhymeExamples">
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

      <!-- 避免的错误 -->
      <div class="avoid-section" v-if="structure.avoid && structure.avoid.length">
        <div class="section-header">
          <span class="section-icon">⚠️</span>
          <h3>避免踩坑</h3>
        </div>
        <div class="avoid-list">
          <div
            v-for="(item, index) in structure.avoid"
            :key="index"
            class="avoid-item"
          >
            <span class="avoid-icon">✕</span>
            <span class="avoid-text">{{ item }}</span>
          </div>
        </div>
      </div>

      <!-- 进阶技巧 -->
      <div class="advanced-section" v-if="structure.advancedTips && structure.advancedTips.length">
        <div class="section-header">
          <span class="section-icon">🚀</span>
          <h3>进阶技巧</h3>
        </div>
        <div class="advanced-list">
          <div
            v-for="(tip, index) in structure.advancedTips"
            :key="index"
            class="advanced-item"
          >
            <span class="advanced-number">{{ index + 1 }}</span>
            <span class="advanced-text">{{ tip }}</span>
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

    <!-- 默认状态 - 加载结构 -->
    <div class="load-prompt" v-else>
      <div class="prompt-icon">📖</div>
      <h3>了解诗词结构</h3>
      <p>AI将根据你的主题，生成个性化的写作框架</p>
      <button class="load-btn" @click="loadStructure" :disabled="localLoading">
        <span v-if="localLoading" class="loading-spinner"></span>
        <span v-else>🤖</span>
        <span>{{ localLoading ? 'AI生成中...' : '获取AI结构引导' }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { ref, watch, onMounted } from 'vue';
import { api } from '../../../services/api.js';

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
    keywords: {
      type: Array,
      default: () => []
    },
    mood: {
      type: String,
      default: ''
    }
  },
  emits: ['load', 'back', 'start'],
  setup(props, { emit }) {
    const structure = ref(null);
    const localLoading = ref(false);

    // 根据主题关键词匹配相关诗词范例和建议
    const buildThemeFallback = (theme, genre, keywords, mood) => {
      const t = theme || '';
      const kw = keywords || [];
      const kwStr = kw.join('、');
      const charCount = genre.includes('七') ? 7 : 5;
      const lineCount = genre.includes('律诗') ? 8 : 4;
      const moodLabel = mood || '含蓄内敛';

      // 主题匹配表：关键词 → 个性化数据
      const themeMap = {
        思乡: {
          intro: `${genre}写思乡，讲究以景托情、情景交融。起句常从故乡景物或旅途所见切入，承句层层铺陈离愁，转句宕开一笔写时空之隔，合句以情语收束、余韵悠长。注意${charCount}字一句的节奏。`,
          examples: [['日暮乡关何处是', '崔颢《黄鹤楼》'], ['烽火连三月', '杜甫《春望》'], ['独在异乡为异客', '王维《九月九日忆山东兄弟》'], ['春风又绿江南岸', '王安石《泊船瓜洲》']],
          tips: [`以「乡」字为情感内核，把思乡之情寄托在具体景物上，避免直接喊「我想家」`, `用空间对比强化乡愁：此处景物 vs 故乡景物，形成情感落差`, `善用听觉意象（如杜鹃声、羌笛）触发乡情，比视觉意象更能穿透距离`, `结尾可用「归」字或归期意象收束，给读者留下期待感`],
          rhyme: '思乡诗多押「an/iang」韵（关、山、还、船等），韵脚洪亮深远，契合旷远意境',
          rhymeEx: ['an韵：关、山、烟、寒、难', 'iang韵：乡、望、长、苍、茫'],
          avoid: ['直呼「想家」「思乡」等空洞情感词而不借景', '把故乡写成完美无缺的仙境，失去真实感', '首句就写思念，起得太急失去回味空间']
        },
        离别: {
          intro: `${genre}写离别，核心在于「以景写情、含而不露」。起句交代送别场景，承句铺陈离愁别绪，转句宕开写别后想象或劝慰，合句以景结情、余韵绵长。字数${charCount}字/句，节奏要稳。`,
          examples: [['海内存知己', '王勃《送杜少府之任蜀州》'], ['劝君更尽一杯酒', '王维《渭城曲》'], ['莫愁前路无知己', '高适《别董大》'], ['洛阳亲友如相问', '王昌龄《芙蓉楼送辛渐》']],
          tips: [`离别起点不是人而是景——长亭、古道、渡口、杨柳，先把空间感铺出来`, `用具体动作代替抽象情感：「执手」「泪沾巾」「回首」比「我很悲伤」更有画面`, `转句可宕开一笔写别后：或想象对方旅途，或转写天下普遍之别，扩大格局`, `合句以「山高水长」「后会有期」等意象收束，避免哭哭啼啼`],
          rhyme: '送别诗常用「i/ing」韵（西、啼、丝、期等），韵脚轻柔悠长，契合离别意境',
          rhymeEx: ['i韵：西、期、凄、迷、啼', 'ing韵：行、程、亭、声、清'],
          avoid: ['起句就哭，还没铺垫就抒情，太直白', '意象堆砌过长亭古道却无情感落点', '结尾说「再见」「保重」等口语，破坏诗意']
        },
        春日: {
          intro: `${genre}写春日，忌空洞赞春、堆砌好词。起句可从一花一草切入，承句层层展开春意，转句可写春之短暂或引出人事，合句以情收束。注意${charCount}字一句，字字精炼。`,
          examples: [['春眠不觉晓', '孟浩然《春晓》'], ['两个黄鹂鸣翠柳', '杜甫《绝句》'], ['草长莺飞二月天', '高鼎《村居》'], ['春风又绿江南岸', '王安石《泊船瓜洲》']],
          tips: [`写春不写春字：借「柳绿」「桃红」「燕归」「冰融」等具体意象让春意自己显现`, `动静结合：蜂蝶忙而人静、风吹草动而云闲，以动衬静或以静显动`, `转句可引入「春将尽」「落花」「春雨」等转折意象，增加层次`, `结尾可宕入人事：春日里的思念、孩童、耕种，增加生活气息`],
          rhyme: '咏春常用「an」韵（天、山、烟、寒等），an韵明亮开阔，契合春日气息',
          rhymeEx: ['an韵：天、山、烟、寒、斓', 'ang韵：长、香、忙、苍、妆'],
          avoid: ['开篇就是「春天真美」「春光明媚」等空洞感叹', '把所有春日意象（春风春雨春花春鸟）全塞进去，没有重点', '只有景没有情，写成春日天气预报']
        },
        山水: {
          intro: `${genre}写山水，核心是「山高水长、境随心转」。起句从山脚水边具体景观切入，承句以移步换景或仰视俯察展开，转句可借山水言志或引入飞鸟行人，合句以「无人」「独坐」等结穴，留白深远。`,
          examples: [['白日依山尽', '王之涣《登鹳雀楼》'], ['空山不见人', '王维《鹿柴》'], ['千山鸟飞绝', '柳宗元《江雪》'], ['两岸猿声啼不住', '李白《早发白帝城》']],
          tips: [`以动写静：「鸟鸣山更幽」「空谷传声」比直接说山很静更有张力`, `远近层次：近处奇石细草，远处飞鸟孤云，构建三维空间感`, `转句可引入「人」：山中行人、渔樵问答、江上渔火，以人衬山之静`, `结尾留白：不必把山水写尽，「独坐」「忘言」「不知归路」更耐读`],
          rhyme: '山水诗常用「e/ie」韵（色、壑、泽、白等），韵致幽深，契合山林气息',
          rhymeEx: ['e韵：色、壑、泽、白、鹤', 'ao韵：高、涛、皓、骚、毫'],
          avoid: ['按游记顺序罗列山名水名，写成地理介绍', '全诗只有山水没有「我」，失去诗人主体', '结尾强行升华到治国平天下，转得生硬']
        },
        怀古: {
          intro: `${genre}写怀古，贵在「借古讽今、寄意深远」。起句常从古迹或古人切入，承句回顾历史事件或古人境遇，转句宕开一笔写当下或感慨，合句以理语或情语收束，发人深省。`,
          examples: [['旧时王谢堂前燕', '刘禹锡《乌衣巷》'], ['东风不与周郎便', '杜牧《赤壁》'], ['至今思项羽', '李清照《夏日绝句》'], ['隔江犹唱后庭花', '杜牧《泊秦淮》']],
          tips: [`选好角度：不必全面评价古人，选取一个细节、一个决定、一个物件，以小见大`, `古今对比：把古人处境与当下打通，在「变与不变」中找立意`, `转句是关键：怀古诗的转句往往宕开议论，从叙事转向感慨，点明主旨`, `结尾可用反问或假设句：「如果……」「何须……」，增加思辨力量`],
          rhyme: '怀古常用「a」韵（沙、斜、花、家等），声调铿锵，契合深沉感慨',
          rhymeEx: ['a韵：沙、斜、花、家、嗟', 'ia韵：霞、遐、夸、槎'],
          avoid: ['写成历史复述，没有诗人立场和感慨', '堆砌古人古事却没有统一主题，形同史料', '结尾直接说「我们要学习古人精神」，说教味太重']
        },
        闺怨: {
          intro: `${genre}写闺怨，宜「借女子之口、写人间别情」。起句可写春日高楼、妆奁夜色等闺阁意象，承句铺陈思念，转句宕开写对方或梦境，合句以景结情或以心理描写收尾，留有余韵。`,
          examples: [['闺中少妇不知愁', '王昌龄《闺怨》'], ['独在闺中望明月', '李白《子夜吴歌》'], ['玉户帘中卷不去', '张若虚《春江花月夜》'], ['泪眼问花花不语', '欧阳修《蝶恋花》']],
          tips: [`写闺怨不要只写「想丈夫」：可通过妆扮变化（懒梳头、眉不画）、时令更替（花开花落）来暗示`, `转句可宕入对方视角：他此刻在做什么？这种「不对称」比自言自语更有张力`, `善用「梦」意象：梦里相聚、梦醒更孤，虚实相生增加层次`, `结尾以物结情：落花、孤灯、秋月、残照，以景写情胜于直说`],
          rhyme: '闺怨常用「u」韵（书、疏、孤、图等），韵致幽细，契合婉约情感',
          rhymeEx: ['u韵：书、疏、孤、图、湖', 'ou韵：楼、愁、舟、幽'],
          avoid: ['写成思妇独白，从头到尾都是「我想你」，没有层次', '把女子写成怨妇形象，缺乏尊严和人格', '结尾「早日归来」等套话，太直白']
        }
      };

      // 模糊匹配：看主题中是否包含关键词
      let matched = null;
      for (const key of Object.keys(themeMap)) {
        if (t.includes(key) || kwStr.includes(key)) {
          matched = themeMap[key];
          break;
        }
      }

      if (matched) {
        const mappedExamples = matched.examples.map(([ex, meta]) => ({
          position: '', role: '', description: '', example: ex, themeHint: meta
        }));
        const lineRoles = ['第一句（起）', '第二句（承）', '第三句（转）', '第四句（合）'];
        const lineRolesShort = ['起', '承', '转', '合'];
        const lineDescs = [
          `紧扣「${t}」主题：分析这一主题最适合从哪个具体画面或角度开篇（时令景物、空间环境、人物状态等）`,
          `紧扣「${t}」主题：承接起句后如何展开描写，层层铺陈 ${t} 的意境或情感`,
          `紧扣「${t}」主题：转句如何打破前两句的平稳（时空跳跃、情感反转、以动写静等）`,
          `紧扣「${t}」主题：合句如何收束全诗、升华情感（情景交融、以景结情、余韵悠长）`
        ];
        const hintPrefixes = ['先写', '用', '从', '以'];

        return {
          name: genre,
          lines: lineCount,
          charactersPerLine: charCount,
          rhymeScheme: charCount === 5 ? '二四句押韵' : '二四句押韵',
          introduction: matched.intro,
          structure: lineRoles.map((pos, i) => ({
            position: pos,
            role: lineRolesShort[i],
            description: lineDescs[i],
            example: matched.examples[i][0],
            themeHint: matched.examples[i][1]
          })),
          tips: matched.tips,
          rhyme: matched.rhyme,
          rhymeExamples: matched.rhymeEx,
          keywordSuggestions: kw.slice(0, 3).map(kwItem => ({
            keyword: kwItem,
            usage: `紧扣「${t}」主题：这个词在诗中适合放在哪一句、用什么方式呈现，融入 ${t} 的意境`
          })),
          avoid: matched.avoid,
          advancedTips: [
            `紧扣「${t}」主题：以动写静手法——用具体动态意象反衬 ${t} 主题的静谧或寂寥`,
            `紧扣「${t}」主题：虚实相生——眼前实景与心中虚景交织，丰富诗歌层次感`,
            `紧扣「${t}」主题：对写法——写对方视角或对方所在地，增强 ${t} 的情感张力`
          ]
        };
      }

      // 未匹配到具体主题时的通用 fallback（比之前好）
      const coreTheme = t || '一般主题';
      return {
        name: genre,
        lines: lineCount,
        charactersPerLine: charCount,
        rhymeScheme: charCount === 5 ? '二四句押韵' : '二四句押韵',
        introduction: `${genre}是古典诗歌的经典形式，讲究起承转合、情景交融。在「${coreTheme}」主题下创作时，要善于选取与主题最契合的具体意象，避免空洞抒情。${charCount}字一句，字字需锤炼。`,
        structure: [
          { position: '第一句（起）', role: '起', description: `紧扣「${coreTheme}」主题：起句如何切入，从哪个具体画面或角度落笔（如时令景物、空间一瞬、人物神态），避免泛泛而言`, example: '（请参考与「' + coreTheme + '」相近主题的经典诗作起句）', themeHint: `先定「${coreTheme}」主题下的核心意象，再由此展开` },
          { position: '第二句（承）', role: '承', description: `紧扣「${coreTheme}」主题：承接起句的意象，进一步描写或深化，注意层层递进，不要原地踏步`, example: '（请参考相近主题的经典承句）', themeHint: `选择能深化「${coreTheme}」意境的具体意象承接` },
          { position: '第三句（转）', role: '转', description: `紧扣「${coreTheme}」主题：转句是全诗的关键，需要打破前两句的平稳，可从视角切换、时空跳跃、情感转折等角度求变`, example: '（请参考相近主题的经典转句）', themeHint: `从「${coreTheme}」的另一面或对立面寻求转折` },
          { position: '第四句（合）', role: '合', description: `紧扣「${coreTheme}」主题：合句如何收束全诗、升华主旨，可用情景交融、以景结情或直抒胸臆，忌空喊口号`, example: '（请参考相近主题的经典合句）', themeHint: `以最能概括「${coreTheme}」情感的意象定格全诗` }
        ],
        tips: [
          `紧扣「${coreTheme}」：选取3-4个与主题最相关的核心意象，不要面面俱到`,
          `紧扣「${coreTheme}」：用具体画面代替抽象情感词（不说「我很惆怅」，而写惆怅时的景物）`,
          `紧扣「${coreTheme}」：注意起承转合的节奏分配，不要四句都在说同一件事`,
          `紧扣「${coreTheme}」：注意${charCount}字一句的字数限制，每个字都要有存在价值`,
          `紧扣「${coreTheme}」：选择与主题情感契合的韵部，韵脚和谐能强化意境`
        ],
        rhyme: `围绕「${coreTheme}」主题选择韵部：豪放主题可用 ang/eng 韵（开阔洪亮），婉约主题可用 i/u/ing 韵（幽细悠长），凄凉主题可用 an/en 韵（沉郁厚重）`,
        rhymeExamples: [`ang韵：适合开阔壮美类「${coreTheme}」主题`, `i韵：适合婉约细腻类「${coreTheme}」主题`],
        keywordSuggestions: kw.slice(0, 3).map(kwItem => ({
          keyword: kwItem,
          usage: `紧扣「${coreTheme}」主题：这个关键词适合用在承句或转句中，配合其他意象共同呈现 ${coreTheme}`
        })),
        avoid: [
          `写「${coreTheme}」时直接抒发抽象情感（愁、喜、悲、乐）而不借助具体意象`,
          `写「${coreTheme}」时堆砌相关意象却没有一条情感主线串联`,
          `写「${coreTheme}」时四句都在一个层面（全是写景或全是抒情），缺乏起伏层次`
        ],
        advancedTips: [
          `紧扣「${coreTheme}」：以动写静手法——用具体动态反衬主题的静谧感或内心的波澜`,
          `紧扣「${coreTheme}」：虚实相生——眼前实景与心中虚景交织，丰富层次感`,
          `紧扣「${coreTheme}」：对写法——从对方视角写，增强主题情感的张力`
        ]
      };
    };

    // 加载结构引导
    const loadStructure = async () => {
      localLoading.value = true;

      try {
        const response = await api.creationWorkbench.getStructureGuide({
          genre: props.genre,
          theme: props.theme,
          keywords: props.keywords,
          mood: props.mood
        });
        const result = response.data || response;
        structure.value = result;
      } catch (error) {
        console.error('加载结构引导失败:', error);
        structure.value = buildThemeFallback(props.theme, props.genre, props.keywords, props.mood);
      } finally {
        localLoading.value = false;
      }
    };

    // 当genre或theme变化时自动加载
    watch([() => props.genre, () => props.theme], () => {
      if (props.genre && props.theme) {
        loadStructure();
      }
    });

    // 组件挂载时自动加载
    onMounted(() => {
      if (props.genre && props.theme) {
        loadStructure();
      }
    });

    return {
      structure,
      localLoading,
      loadStructure
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

.ai-badge {
  background: linear-gradient(135deg, #7c9eb2, #5a7a8c);
}

.structure-intro {
  font-size: 15px;
  color: #5d4e37;
  line-height: 1.8;
  margin: 0;
}

/* 流程标题 */
.flow-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(139, 115, 85, 0.1);
}

.flow-icon {
  font-size: 20px;
}

.flow-title h3 {
  font-size: 18px;
  color: #5d4e37;
  margin: 0;
  font-family: 'Noto Serif SC', serif;
}

/* 结构流程 */
.structure-flow {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(139, 115, 85, 0.12);
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
  background: rgba(245, 239, 230, 0.5);
  border-radius: 16px;
  border: 1px solid rgba(139, 115, 85, 0.08);
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
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.node-theme-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(122, 158, 199, 0.1), rgba(101, 137, 181, 0.08));
  border-radius: 10px;
  margin-bottom: 12px;
  border-left: 3px solid #7a9ec7;
}

.hint-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.hint-text {
  font-size: 13px;
  color: #5d4e37;
  line-height: 1.5;
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

/* 通用section样式 */
.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.section-icon {
  font-size: 20px;
}

.section-header h3 {
  font-size: 16px;
  color: #5d4e37;
  margin: 0;
  font-family: 'Noto Serif SC', serif;
}

/* 关键词建议 */
.keyword-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(139, 115, 85, 0.12);
}

.keyword-suggestions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.keyword-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(212, 165, 116, 0.06);
  border-radius: 12px;
}

.keyword-tag {
  padding: 6px 14px;
  background: linear-gradient(135deg, #d4a574, #8b7355);
  color: white;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  flex-shrink: 0;
}

.keyword-usage {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

/* 写作技巧 */
.tips-section {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(139, 115, 85, 0.12);
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

/* 避免的错误 */
.avoid-section {
  background: rgba(255, 245, 245, 0.9);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(199, 125, 142, 0.2);
}

.avoid-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.avoid-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(199, 125, 142, 0.08);
  border-radius: 10px;
}

.avoid-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #c77d8e;
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.avoid-text {
  font-size: 14px;
  color: #8b5a5a;
  line-height: 1.5;
}

/* 进阶技巧 */
.advanced-section {
  background: linear-gradient(135deg, rgba(122, 158, 199, 0.08), rgba(101, 137, 181, 0.06));
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(122, 158, 199, 0.2);
}

.advanced-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.advanced-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 12px;
}

.advanced-number {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7a9ec7, #6589b5);
  color: white;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.advanced-text {
  font-size: 14px;
  color: #4a5a6a;
  line-height: 1.6;
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
