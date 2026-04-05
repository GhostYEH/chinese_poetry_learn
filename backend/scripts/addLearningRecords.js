/**
 * 为 Studentdemo 账号添加半个月连续学习记录
 * 时间范围：2026年3月22日 - 2026年4月6日
 * 运行方式：node backend/scripts/addLearningRecords.js
 */
const { db } = require('../src/utils/db');

const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const rand = arr => arr[Math.floor(Math.random() * arr.length)];

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function randomTimeOnDate(dateStr) {
  const d = new Date(dateStr);
  d.setHours(ri(8, 21), ri(0, 59), ri(0, 59));
  return d.toISOString();
}

function p(resolve, reject) {
  return (err) => { if (err) reject(err); else resolve(); };
}

async function main() {
  return new Promise((resolve, reject) => {
    console.log('开始为 Studentdemo 添加连续学习记录...\n');
    console.log('时间范围：2026年3月22日 - 2026年4月6日（16天）\n');

    db.serialize(async () => {
      try {
        db.run('BEGIN TRANSACTION');

        const user = await new Promise(r => db.get('SELECT id FROM users WHERE username = ?', ['Studentdemo'], (e, row) => r(row)));
        if (!user) {
          console.error('未找到 Studentdemo 账号，请先运行 createDemoAccount.js');
          process.exit(1);
        }
        const uid = user.id;
        console.log('+ 找到 Studentdemo 账号，ID:', uid);

        const startDate = new Date('2026-03-22');
        const endDate = new Date('2026-04-06');
        const dates = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          dates.push(formatDate(d));
        }
        console.log('+ 日期范围:', dates.length, '天');

        const poems = await new Promise(r => db.all('SELECT id, title FROM poems LIMIT 20', (e, rows) => r(rows)));
        if (poems.length === 0) {
          console.error('诗词表为空，请先导入诗词数据');
          process.exit(1);
        }
        console.log('+ 可用诗词:', poems.length, '首');

        const existingRecords = await new Promise(r => db.all('SELECT id, poem_id FROM learning_records WHERE user_id = ?', [uid], (e, rows) => r(rows)));
        console.log('+ 现有学习记录:', existingRecords.length, '条');

        for (const dateStr of dates) {
          const existing = await new Promise(r => db.get('SELECT id FROM daily_checkin WHERE user_id = ? AND date = ?', [uid, dateStr], (e, row) => r(row)));
          if (!existing) {
            const checkinTime = randomTimeOnDate(dateStr);
            await new Promise(r => db.run('INSERT INTO daily_checkin (user_id, date, checked_in_at) VALUES (?, ?, ?)', [uid, dateStr, checkinTime], r));
          }
        }
        console.log('+ 每日打卡: 16天（3月22日-4月6日）');

        const activityTypes = ['view', 'recite', 'challenge', 'feihua', 'ai_explain', 'checkin', 'creation', 'wrong_review'];
        let activityCount = 0;
        for (const dateStr of dates) {
          const dailyActivities = ri(2, 5);
          for (let i = 0; i < dailyActivities; i++) {
            const activityTime = randomTimeOnDate(dateStr);
            await new Promise(r => db.run(
              'INSERT INTO activity_logs (user_id, activity_type, duration_seconds, created_at) VALUES (?, ?, ?, ?)',
              [uid, rand(activityTypes), ri(60, 600), activityTime],
              r
            ));
            activityCount++;
          }
        }
        console.log('+ 活动日志:', activityCount, '条');

        const poemsPerDay = Math.ceil(poems.length / dates.length);
        let poemIndex = 0;
        for (let dayIndex = 0; dayIndex < dates.length; dayIndex++) {
          const dateStr = dates[dayIndex];
          const poemsForToday = Math.min(poemsPerDay, poems.length - poemIndex);
          if (poemsForToday <= 0) break;

          for (let i = 0; i < poemsForToday; i++) {
            const poem = poems[poemIndex % poems.length];
            poemIndex++;

            const existingRecord = existingRecords.find(r => r.poem_id === poem.id);
            const viewTime = randomTimeOnDate(dateStr);

            if (existingRecord) {
              await new Promise(r => db.run(
                'UPDATE learning_records SET view_count = view_count + ?, ai_explain_count = ai_explain_count + ?, recite_attempts = recite_attempts + ?, study_time = study_time + ?, last_view_time = ? WHERE id = ?',
                [ri(1, 3), ri(0, 2), ri(0, 2), ri(30, 180), viewTime, existingRecord.id],
                r
              ));
            } else {
              await new Promise(r => db.run(
                'INSERT INTO learning_records (user_id, poem_id, view_count, ai_explain_count, recite_attempts, best_score, total_score, study_time, last_view_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [uid, poem.id, ri(1, 5), ri(0, 3), ri(0, 3), ri(60, 100), ri(60, 100) * ri(1, 3), ri(30, 180), viewTime],
                r
              ));
              existingRecords.push({ id: -1, poem_id: poem.id });
            }
          }
        }
        console.log('+ 学习记录更新完成');

        const finalRecords = await new Promise(r => db.all('SELECT COUNT(*) as count FROM learning_records WHERE user_id = ?', [uid], (e, row) => r(row)));
        console.log('+ 最终学习记录数:', finalRecords[0]?.count || 0);

        db.run('COMMIT', e => {
          if (e) { db.run('ROLLBACK'); return reject(e); }
          console.log('\n========================================');
          console.log('  Studentdemo 学习记录添加完成！');
          console.log('  账号: Studentdemo');
          console.log('  时间: 2026年3月22日 - 4月6日');
          console.log('  连续学习: 16天');
          console.log('========================================');
          resolve();
        });
      } catch (err) {
        db.run('ROLLBACK');
        reject(err);
      }
    });
  });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
