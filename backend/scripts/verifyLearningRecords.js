/**
 * 验证 Studentdemo 账号的学习记录
 */
const { db } = require('../src/utils/db');

async function main() {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        const user = await new Promise(r => db.get('SELECT id, username FROM users WHERE username = ?', ['Studentdemo'], (e, row) => r(row)));
        if (!user) {
          console.log('未找到 Studentdemo 账号');
          process.exit(1);
        }
        const uid = user.id;
        console.log('========================================');
        console.log('Studentdemo 账号验证 (ID:', uid, ')');
        console.log('========================================\n');

        const checkins = await new Promise(r => db.all('SELECT date, checked_in_at FROM daily_checkin WHERE user_id = ? ORDER BY date', [uid], (e, rows) => r(rows)));
        console.log('【每日打卡】共', checkins.length, '天:');
        checkins.forEach(c => console.log('  -', c.date, c.checked_in_at?.substring(11, 19) || ''));

        const activities = await new Promise(r => db.all('SELECT activity_type, COUNT(*) as cnt FROM activity_logs WHERE user_id = ? GROUP BY activity_type', [uid], (e, rows) => r(rows)));
        console.log('\n【活动统计】:');
        activities.forEach(a => console.log('  -', a.activity_type + ':', a.cnt, '次'));

        const records = await new Promise(r => db.all(
          'SELECT lr.*, p.title FROM learning_records lr JOIN poems p ON lr.poem_id = p.id WHERE lr.user_id = ? ORDER BY last_view_time DESC LIMIT 10',
          [uid],
          (e, rows) => r(rows)
        ));
        console.log('\n【学习记录】最近10条:');
        records.forEach(r => {
          const time = r.last_view_time ? r.last_view_time.substring(0, 10) : '无';
          console.log('  -', r.title, '| 查看:', r.view_count, '次 | 背诵:', r.recite_attempts, '次 | 最高分:', r.best_score, '| 时间:', time);
        });

        const totalRecords = await new Promise(r => db.get('SELECT COUNT(*) as count FROM learning_records WHERE user_id = ?', [uid], (e, row) => r(row)));
        console.log('\n【总计】学习记录:', totalRecords.count, '条');

        const totalStudyTime = await new Promise(r => db.get('SELECT SUM(study_time) as total FROM learning_records WHERE user_id = ?', [uid], (e, row) => r(row)));
        console.log('【总计】学习时长:', Math.round((totalStudyTime.total || 0) / 60), '分钟');

        console.log('\n========================================');
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
