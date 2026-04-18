
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('添加静夜思到数据库...\n')

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

jingyesi_id = cursor.lastrowid
print('已添加静夜思，ID:', jingyesi_id)

# 验证静夜思
print('\n验证静夜思:')
cursor.execute('SELECT id, title, author, content FROM poems WHERE id = ?', (jingyesi_id,))
row = cursor.fetchone()
if row:
    print('  ID:', row[0])
    print('  标题:', row[1])
    print('  作者:', row[2])
    print('  内容:', row[3])
    print('  ✓ 正确！')

# 验证卜算子
print('\n验证卜算子 (苏轼):')
cursor.execute('SELECT id, title, author, content FROM poems WHERE id = 8085')
row = cursor.fetchone()
if row:
    print('  ID:', row[0])
    print('  标题:', row[1])
    print('  作者:', row[2])
    print('  内容:', row[3])
    
    correct = '缺月挂疏桐，漏断人初静。时见幽人独往来，缥缈孤鸿影。惊起却回头，有恨无人省。拣尽寒枝不肯栖，寂寞沙洲冷。'
    if row[3] == correct:
        print('  ✓ 正确！')
    else:
        print('  ⚠️ 不正确，正在修复...')
        cursor.execute('UPDATE poems SET content = ? WHERE id = 8085', (correct,))
        print('  ✓ 已修复！')

conn.commit()
conn.close()

print('\n完成！')
