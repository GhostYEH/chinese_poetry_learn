const { db } = require('./src/utils/db');
const bcrypt = require('bcrypt');

const samplePoems = [
  { title: "静夜思", author: "李白", dynasty: "唐", content: "床前明月光，疑是地上霜。举头望明月，低头思故乡。", tags: "思乡,月亮" },
  { title: "春晓", author: "孟浩然", dynasty: "唐", content: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。", tags: "春天,自然" },
  { title: "望庐山瀑布", author: "李白", dynasty: "唐", content: "日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。", tags: "山水,壮观" },
  { title: "黄鹤楼送孟浩然之广陵", author: "李白", dynasty: "唐", content: "故人西辞黄鹤楼，烟花三月下扬州。孤帆远影碧空尽，唯见长江天际流。", tags: "送别,友情" },
  { title: "江雪", author: "柳宗元", dynasty: "唐", content: "千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。", tags: "山水,孤独" },
  { title: "望岳", author: "杜甫", dynasty: "唐", content: "岱宗夫如何？齐鲁青未了。造化钟神秀，阴阳割昏晓。荡胸生曾云，决眦入归鸟。会当凌绝顶，一览众山小。", tags: "山水,励志" },
  { title: "春望", author: "杜甫", dynasty: "唐", content: "国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。", tags: "爱国,忧伤" },
  { title: "赋得古原草送别", author: "白居易", dynasty: "唐", content: "离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。", tags: "送别,自然" },
  { title: "钱塘湖春行", author: "白居易", dynasty: "唐", content: "孤山寺北贾亭西，水面初平云脚低。几处早莺争暖树，谁家新燕啄春泥。乱花渐欲迷人眼，浅草才能没马蹄。最爱湖东行不足，绿杨阴里白沙堤。", tags: "春天,山水" },
  { title: "凉州词", author: "王之涣", dynasty: "唐", content: "黄河远上白云间，一片孤城万仞山。羌笛何须怨杨柳，春风不度玉门关。", tags: "边塞,思乡" },
  { title: "登鹳雀楼", author: "王之涣", dynasty: "唐", content: "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。", tags: "山水,励志" },
  { title: "清明", author: "杜牧", dynasty: "唐", content: "清明时节雨纷纷，路上行人欲断魂。借问酒家何处有？牧童遥指杏花村。", tags: "清明,思乡" },
  { title: "山行", author: "杜牧", dynasty: "唐", content: "远上寒山石径斜，白云生处有人家。停车坐爱枫林晚，霜叶红于二月花。", tags: "山水,秋天" },
  { title: "泊秦淮", author: "杜牧", dynasty: "唐", content: "烟笼寒水月笼沙，夜泊秦淮近酒家。商女不知亡国恨，隔江犹唱后庭花。", tags: "爱国,忧伤" },
  { title: "夜雨寄北", author: "李商隐", dynasty: "唐", content: "君问归期未有期，巴山夜雨涨秋池。何当共剪西窗烛，却话巴山夜雨时。", tags: "思乡,爱情" },
  { title: "锦瑟", author: "李商隐", dynasty: "唐", content: "锦瑟无端五十弦，一弦一柱思华年。庄生晓梦迷蝴蝶，望帝春心托杜鹃。沧海月明珠有泪，蓝田日暖玉生烟。此情可待成追忆？只是当时已惘然。", tags: "爱情,忧伤" },
  { title: "送元二使安西", author: "王维", dynasty: "唐", content: "渭城朝雨浥轻尘，客舍青青柳色新。劝君更尽一杯酒，西出阳关无故人。", tags: "送别,友情" },
  { title: "九月九日忆山东兄弟", author: "王维", dynasty: "唐", content: "独在异乡为异客，每逢佳节倍思亲。遥知兄弟登高处，遍插茱萸少一人。", tags: "思乡,亲情" },
  { title: "山居秋暝", author: "王维", dynasty: "唐", content: "空山新雨后，天气晚来秋。明月松间照，清泉石上流。竹喧归浣女，莲动下渔舟。随意春芳歇，王孙自可留。", tags: "山水,秋天" },
  { title: "鹿柴", author: "王维", dynasty: "唐", content: "空山不见人，但闻人语响。返景入深林，复照青苔上。", tags: "山水,幽静" },
  { title: "相思", author: "王维", dynasty: "唐", content: "红豆生南国，春来发几枝。愿君多采撷，此物最相思。", tags: "爱情,相思" },
  { title: "望天门山", author: "李白", dynasty: "唐", content: "天门中断楚江开，碧水东流至此回。两岸青山相对出，孤帆一片日边来。", tags: "山水,壮观" },
  { title: "早发白帝城", author: "李白", dynasty: "唐", content: "朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。", tags: "山水,轻快" },
  { title: "独坐敬亭山", author: "李白", dynasty: "唐", content: "众鸟高飞尽，孤云独去闲。相看两不厌，只有敬亭山。", tags: "山水,孤独" },
  { title: "秋浦歌", author: "李白", dynasty: "唐", content: "白发三千丈，缘愁似个长。不知明镜里，何处得秋霜？", tags: "忧伤,秋天" },
  { title: "望洞庭", author: "刘禹锡", dynasty: "唐", content: "湖光秋月两相和，潭面无风镜未磨。遥望洞庭山水翠，白银盘里一青螺。", tags: "山水,秋天" },
  { title: "乌衣巷", author: "刘禹锡", dynasty: "唐", content: "朱雀桥边野草花，乌衣巷口夕阳斜。旧时王谢堂前燕，飞入寻常百姓家。", tags: "怀旧,感慨" },
  { title: "竹枝词", author: "刘禹锡", dynasty: "唐", content: "杨柳青青江水平，闻郎江上唱歌声。东边日出西边雨，道是无晴却有晴。", tags: "爱情,自然" },
  { title: "别董大", author: "高适", dynasty: "唐", content: "千里黄云白日曛，北风吹雁雪纷纷。莫愁前路无知己，天下谁人不识君？", tags: "送别,友情" },
  { title: "芙蓉楼送辛渐", author: "王昌龄", dynasty: "唐", content: "寒雨连江夜入吴，平明送客楚山孤。洛阳亲友如相问，一片冰心在玉壶。", tags: "送别,友情" },
  { title: "水调歌头", author: "苏轼", dynasty: "宋", content: "明月几时有？把酒问青天。不知天上宫阙，今夕是何年。我欲乘风归去，又恐琼楼玉宇，高处不胜寒。起舞弄清影，何似在人间。转朱阁，低绮户，照无眠。不应有恨，何事长向别时圆？人有悲欢离合，月有阴晴圆缺，此事古难全。但愿人长久，千里共婵娟。", tags: "月亮,思亲" },
  { title: "念奴娇·赤壁怀古", author: "苏轼", dynasty: "宋", content: "大江东去，浪淘尽，千古风流人物。故垒西边，人道是，三国周郎赤壁。乱石穿空，惊涛拍岸，卷起千堆雪。江山如画，一时多少豪杰。遥想公瑾当年，小乔初嫁了，雄姿英发。羽扇纶巾，谈笑间，樯橹灰飞烟灭。故国神游，多情应笑我，早生华发。人生如梦，一尊还酹江月。", tags: "怀古,豪放" },
  { title: "江城子·密州出猎", author: "苏轼", dynasty: "宋", content: "老夫聊发少年狂，左牵黄，右擎苍，锦帽貂裘，千骑卷平冈。为报倾城随太守，亲射虎，看孙郎。酒酣胸胆尚开张，鬓微霜，又何妨！持节云中，何日遣冯唐？会挽雕弓如满月，西北望，射天狼。", tags: "豪放,壮志" },
  { title: "声声慢", author: "李清照", dynasty: "宋", content: "寻寻觅觅，冷冷清清，凄凄惨惨戚戚。乍暖还寒时候，最难将息。三杯两盏淡酒，怎敌他、晚来风急？雁过也，正伤心，却是旧时相识。满地黄花堆积，憔悴损，如今有谁堪摘？守着窗儿，独自怎生得黑？梧桐更兼细雨，到黄昏、点点滴滴。这次第，怎一个愁字了得！", tags: "忧伤,秋天" },
  { title: "如梦令", author: "李清照", dynasty: "宋", content: "常记溪亭日暮，沉醉不知归路。兴尽晚回舟，误入藕花深处。争渡，争渡，惊起一滩鸥鹭。", tags: "自然,清新" },
  { title: "满江红", author: "岳飞", dynasty: "宋", content: "怒发冲冠，凭栏处、潇潇雨歇。抬望眼，仰天长啸，壮怀激烈。三十功名尘与土，八千里路云和月。莫等闲，白了少年头，空悲切！靖康耻，犹未雪。臣子恨，何时灭！驾长车，踏破贺兰山缺。壮志饥餐胡虏肉，笑谈渴饮匈奴血。待从头、收拾旧山河，朝天阙。", tags: "爱国,壮志" },
  { title: "破阵子", author: "辛弃疾", dynasty: "宋", content: "醉里挑灯看剑，梦回吹角连营。八百里分麾下炙，五十弦翻塞外声，沙场秋点兵。马作的卢飞快，弓如霹雳弦惊。了却君王天下事，赢得生前身后名。可怜白发生！", tags: "爱国,壮志" },
  { title: "青玉案·元夕", author: "辛弃疾", dynasty: "宋", content: "东风夜放花千树，更吹落、星如雨。宝马雕车香满路。凤箫声动，玉壶光转，一夜鱼龙舞。蛾儿雪柳黄金缕，笑语盈盈暗香去。众里寻他千百度，蓦然回首，那人却在，灯火阑珊处。", tags: "节日,爱情" },
  { title: "蝶恋花", author: "柳永", dynasty: "宋", content: "伫倚危楼风细细，望极春愁，黯黯生天际。草色烟光残照里，无言谁会凭阑意。拟把疏狂图一醉，对酒当歌，强乐还无味。衣带渐宽终不悔，为伊消得人憔悴。", tags: "爱情,相思" },
  { title: "雨霖铃", author: "柳永", dynasty: "宋", content: "寒蝉凄切，对长亭晚，骤雨初歇。都门帐饮无绪，留恋处，兰舟催发。执手相看泪眼，竟无语凝噎。念去去，千里烟波，暮霭沉沉楚天阔。多情自古伤离别，更那堪，冷落清秋节！今宵酒醒何处？杨柳岸，晓风残月。此去经年，应是良辰好景虚设。便纵有千种风情，更与何人说？", tags: "离别,忧伤" }
];

const firstNames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗'];
const lastNames = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞'];

function generateUsername() {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return firstName + lastName + Math.floor(Math.random() * 100);
}

function generateEmail(username) {
  const domains = ['qq.com', '163.com', 'gmail.com', 'outlook.com'];
  return `${username}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seedDatabase() {
  console.log('开始填充测试数据...\n');
  
  const passwordHash = await bcrypt.hash('123456', 10);
  
  await new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO teachers (username, password) VALUES (?, ?)', ['teacher', passwordHash], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  console.log('✓ 创建教师账号: teacher / 123456');
  
  const classes = [];
  const classNames = ['一年级一班', '一年级二班', '二年级一班', '二年级二班', '三年级一班'];
  
  for (let i = 0; i < classNames.length; i++) {
    const classId = i + 1;
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO class_stats (class_id, total_students, total_poems_studied, avg_study_time, avg_completion_rate) VALUES (?, ?, ?, ?, ?)',
        [classId, 0, 0, 0, 0],
        (err) => {
          if (err) reject(err);
          else {
            classes.push({ id: classId, name: classNames[i] });
            resolve();
          }
        }
      );
    });
  }
  console.log(`✓ 创建 ${classes.length} 个班级`);
  
  const students = [];
  const studentCount = 50;
  
  for (let i = 0; i < studentCount; i++) {
    const username = generateUsername();
    const email = generateEmail(username);
    const classId = classes[Math.floor(Math.random() * classes.length)].id;
    const now = new Date().toISOString();
    
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, email, password_hash, class_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [username, email, passwordHash, classId, now, now],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    students.push({ id: result, username, classId });
  }
  console.log(`✓ 创建 ${studentCount} 个学生账号 (密码均为: 123456)`);
  
  const learningRecords = [];
  for (const student of students) {
    const poemCount = Math.floor(Math.random() * 20) + 5;
    const studiedPoems = new Set();
    
    for (let j = 0; j < poemCount; j++) {
      let poemId;
      do {
        poemId = Math.floor(Math.random() * samplePoems.length) + 1;
      } while (studiedPoems.has(poemId));
      studiedPoems.add(poemId);
      
      const studyTime = Math.floor(Math.random() * 1800) + 300;
      const lastViewTime = randomDate(new Date(2024, 0, 1), new Date()).toISOString();
      
      learningRecords.push({
        userId: student.id,
        poemId,
        studyTime,
        lastViewTime
      });
    }
  }
  
  for (const record of learningRecords) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO learning_records (user_id, poem_id, study_time, last_view_time) VALUES (?, ?, ?, ?)',
        [record.userId, record.poemId, record.studyTime, record.lastViewTime],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log(`✓ 创建 ${learningRecords.length} 条学习记录`);
  
  for (const cls of classes) {
    const classStudents = students.filter(s => s.classId === cls.id);
    const classRecords = learningRecords.filter(r => classStudents.some(s => s.id === r.userId));
    
    const totalStudents = classStudents.length;
    const totalPoems = classRecords.length;
    const avgStudyTime = classRecords.length > 0 
      ? Math.round(classRecords.reduce((sum, r) => sum + r.studyTime, 0) / classRecords.length / 60)
      : 0;
    const avgCompletionRate = Math.random() * 0.3 + 0.5;
    
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE class_stats SET total_students = ?, total_poems_studied = ?, avg_study_time = ?, avg_completion_rate = ? WHERE class_id = ?',
        [totalStudents, totalPoems, avgStudyTime, avgCompletionRate, cls.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('✓ 更新班级统计数据');
  
  for (const student of students) {
    const highestLevel = Math.floor(Math.random() * 150) + 1;
    const currentLevel = Math.min(highestLevel + 1, 200);
    const aiHelpUsed = Math.floor(Math.random() * 20);
    const totalErrors = Math.floor(Math.random() * 30);
    const lastChallengeTime = randomDate(new Date(2024, 0, 1), new Date()).toISOString();
    
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO user_challenge_progress (user_id, highest_level, current_challenge_level, last_challenge_time, total_ai_help_used, total_errors) VALUES (?, ?, ?, ?, ?, ?)',
        [student.id, highestLevel, currentLevel, lastChallengeTime, aiHelpUsed, totalErrors],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log('✓ 创建学生闯关进度');
  
  const challengeRecords = [];
  for (const student of students) {
    const recordCount = Math.floor(Math.random() * 50) + 20;
    
    for (let i = 0; i < recordCount; i++) {
      const level = Math.floor(Math.random() * 150) + 1;
      const isCorrect = Math.random() > 0.3;
      const answeredAt = randomDate(new Date(2024, 0, 1), new Date()).toISOString();
      
      const poem = samplePoems[Math.floor(Math.random() * samplePoems.length)];
      const lines = poem.content.split(/[。，]/).filter(l => l.trim());
      const question = lines.length > 0 ? `${lines[0]}____` : '填空题';
      const answer = lines.length > 1 ? lines[1] : '答案';
      
      challengeRecords.push({
        userId: student.id,
        level,
        question,
        userAnswer: isCorrect ? answer : '错误答案',
        correctAnswer: answer,
        isCorrect,
        answeredAt,
        poemTitle: poem.title,
        poemAuthor: poem.author
      });
    }
  }
  
  for (const record of challengeRecords) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO user_challenge_records (user_id, level, question_content, user_answer, correct_answer, is_correct, answered_at, poem_title, poem_author) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [record.userId, record.level, record.question, record.userAnswer, record.correctAnswer, record.isCorrect ? 1 : 0, record.answeredAt, record.poemTitle, record.poemAuthor],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log(`✓ 创建 ${challengeRecords.length} 条闯关记录`);
  
  const gameRecords = [];
  for (let i = 0; i < 100; i++) {
    const player1 = students[Math.floor(Math.random() * students.length)].username;
    let player2;
    do {
      player2 = students[Math.floor(Math.random() * students.length)].username;
    } while (player2 === player1);
    
    const winner = Math.random() > 0.5 ? player1 : player2;
    const date = randomDate(new Date(2024, 0, 1), new Date()).toISOString();
    
    gameRecords.push({ player1, player2, winner, date });
  }
  
  for (const game of gameRecords) {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO fight_history (player1, player2, winner, date) VALUES (?, ?, ?, ?)',
        [game.player1, game.player2, game.winner, game.date],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  console.log(`✓ 创建 ${gameRecords.length} 条对战记录`);
  
  console.log('\n========================================');
  console.log('测试数据填充完成！');
  console.log('========================================');
  console.log('\n教师登录信息:');
  console.log('  用户名: teacher');
  console.log('  密码: 123456');
  console.log('\n学生登录信息:');
  console.log('  密码均为: 123456');
  console.log('\n');
  
  db.close();
}

seedDatabase().catch(err => {
  console.error('填充数据失败:', err);
  db.close();
});
