
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('检查数据库内容...\n')

# 统计总数
cursor.execute('SELECT COUNT(*) FROM poems')
count = cursor.fetchone()[0]
print('数据库中共有', count, '首诗词\n')

# 查看前20首
print('前20首诗词:')
cursor.execute('SELECT id, title, author, dynasty FROM poems LIMIT 20')
rows = cursor.fetchall()
for row in rows:
    print('  [' + str(row[0]) + '] ' + row[1] + ' - ' + row[2] + ' (' + row[3] + ')')

conn.close()
