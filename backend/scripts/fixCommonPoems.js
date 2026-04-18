
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/poetry.db');
const db = new sqlite3.Database(DB_PATH);

const poemsToFix = [
  { id: 1900, content: '缺月挂疏桐，漏断人初静。时见幽人独往来，缥缈孤鸿影。惊起却回头，有恨无人省。拣尽寒枝不肯栖，寂寞沙洲冷。' },
];

const commonPoems = [
  { title: '水调歌头', author: '苏轼', content: '明月几时有？把酒问青天。不知天上宫阙，今夕是何年。我欲乘风归去，又恐琼楼玉宇，高处不胜寒。起舞弄清影，何似在人间。转朱阁，低绮户，照无眠。不应有恨，何事长向别时圆？人有悲欢离合，月有阴晴圆缺，此事古难全。但愿人长久，千里共婵娟。' },
  { title: '念奴娇', author: '苏轼', content: '大江东去，浪淘尽，千古风流人物。故垒西边，人道是，三国周郎赤壁。乱石穿空，惊涛拍岸，卷起千堆雪。江山如画，一时多少豪杰。遥想公瑾当年，小乔初嫁了，雄姿英发。羽扇纶巾，谈笑间，樯橹灰飞烟灭。故国神游，多情应笑我，早生华发。人生如梦，一尊还酹江月。' },
  { title: '声声慢', author: '李清照', content: '寻寻觅觅，冷冷清清，凄凄惨惨戚戚。乍暖还寒时候，最难将息。三杯两盏淡酒，怎敌他、晚来风急？雁过也，正伤心，却是旧时相识。满地黄花堆积。憔悴损，如今有谁堪摘？守着窗儿，独自怎生得黑？梧桐更兼细雨，到黄昏、点点滴滴。这次第，怎一个愁字了得！' },
  { title: '虞美人', author: '李煜', content: '春花秋月何时了？往事知多少。小楼昨夜又东风，故国不堪回首月明中。雕栏玉砌应犹在，只是朱颜改。问君能有几多愁？恰似一江春水向东流。' },
  { title: '相见欢', author: '李煜', content: '无言独上西楼，月如钩。寂寞梧桐深院锁清秋。剪不断，理还乱，是离愁。别是一般滋味在心头。' },
  { title: '望岳', author: '杜甫', content: '岱宗夫如何？齐鲁青未了。造化钟神秀，阴阳割昏晓。荡胸生曾云，决眦入归鸟。会当凌绝顶，一览众山小。' },
  { title: '春望', author: '杜甫', content: '国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。' },
  { title: '赋得古原草送别', author: '白居易', content: '离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。' },
  { title: '钱塘湖春行', author: '白居易', content: '孤山寺北贾亭西，水面初平云脚低。几处早莺争暖树，谁家新燕啄春泥。乱花渐欲迷人眼，浅草才能没马蹄。最爱湖东行不足，绿杨阴里白沙堤。' }
];

async function fixAllPoems() {
  console.log('=== 开始修复诗词 ===\n');
  
  // 先处理已知 ID 的诗词
  for (let i = 0; i &lt; poemsToFix.length; i++) {
    const poem = poemsToFix[i];
    console.log('修复 ID ' + poem.id);
    await updatePoem(poem.id, poem.content);
    console.log('✓ 已修复\n');
  }
  
  // 查找并修复其他诗词
  for (let i = 0; i &lt; commonPoems.length; i++) {
    const poem = commonPoems[i];
    const results = await queryAll('SELECT id, title, author, content FROM poems WHERE title LIKE "%' + poem.title + '%" AND author LIKE "%' + poem.author + '%"');
    
    for (let j = 0; j &lt; results.length; j++) {
      const p = results[j];
      console.log('【' + p.title + ' - ' + p.author + ' (ID ' + p.id + ')】');
      
      if (p.content !== poem.content) {
        console.log('  ⚠️  内容不匹配，正在修复...');
        await updatePoem(p.id, poem.content);
        console.log('  ✓ 已修复\n');
      } else {
        console.log('  ✓ 内容正确\n');
      }
    }
  }
  
  console.log('=== 修复完成 ===');
  db.close();
}

function queryAll(sql) {
  return new Promise(function(resolve, reject) {
    db.all(sql, function(err, rows) {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function updatePoem(id, content) {
  return new Promise(function(resolve, reject) {
    db.run('UPDATE poems SET content = ? WHERE id = ?', [content, id], function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

fixAllPoems().catch(function(err) { 
  console.error(err); 
  db.close(); 
});
