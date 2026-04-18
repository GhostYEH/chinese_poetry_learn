
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('查找诗词...\n')

# 查找静夜思
print('查找静夜思:')
cursor.execute('SELECT id, title, author, content FROM poems WHERE title LIKE ?', ('%静夜思%',))
rows = cursor.fetchall()
if rows:
    for row in rows:
        print('  找到:')
        print('    ID:', row[0])
        print('    标题:', row[1])
        print('    作者:', row[2])
        print('    内容:', row[3])
else:
    print('  未找到')

# 查找卜算子
print('\n查找卜算子 (苏轼):')
cursor.execute('SELECT id, title, author, content FROM poems WHERE title LIKE ? AND author LIKE ?', 
              ('%卜算子%', '%苏轼%'))
rows = cursor.fetchall()
if rows:
    for row in rows:
        print('  找到:')
        print('    ID:', row[0])
        print('    标题:', row[1])
        print('    作者:', row[2])
        print('    内容:', row[3])
else:
    print('  未找到')

conn.close()
