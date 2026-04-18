
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('添加并检查静夜思...\n')

# 添加静夜思
title = '静夜思'
author = '李白'
dynasty = '唐'
content = '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
tags = '思乡,月亮'

cursor.execute(
    'INSERT INTO poems (title, author, dynasty, content, tags) VALUES (?, ?, ?, ?, ?)',
    (title, author, dynasty, content, tags)
)

new_id = cursor.lastrowid
print('已添加静夜思，新ID:', new_id)

conn.commit()

# 检查所有李白的诗
print('\n查找所有李白的诗:')
cursor.execute('SELECT id, title, author, content FROM poems WHERE author LIKE ?', ('%李白%',))
rows = cursor.fetchall()
for row in rows:
    print('  [' + str(row[0]) + '] ' + row[1] + ' - ' + row[2])
    print('    内容:', row[3])

conn.close()

print('\n完成！')
