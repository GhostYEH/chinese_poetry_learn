
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('搜索静夜思...\n')

# 只用标题搜索
print('只用标题搜索:')
cursor.execute('SELECT id, title, author, content FROM poems WHERE title LIKE ?', ('%静%',))
rows = cursor.fetchall()
for row in rows:
    print('  [' + str(row[0]) + '] ' + row[1] + ' - ' + row[2])
    print('    内容:', row[3])

# 用作者搜索李白的诗
print('\n李白的诗 (前30首):')
cursor.execute('SELECT id, title, author FROM poems WHERE author LIKE ? LIMIT 30', ('%李%',))
rows = cursor.fetchall()
for row in rows:
    print('  [' + str(row[0]) + '] ' + row[1] + ' - ' + row[2])

conn.close()
