
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('开始修复重要诗词...\n')

# 修复静夜思
cursor.execute('SELECT id, title, author, content FROM poems WHERE id = 1803')
row = cursor.fetchone()
if row:
    print('找到静夜思 (ID 1803):')
    print('  当前内容:', row[3])
    
    correct = '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
    cursor.execute('UPDATE poems SET content = ? WHERE id = 1803', (correct,))
    print('  ✓ 已修复为:', correct)
else:
    print('未找到静夜思')

# 修复卜算子
cursor.execute('SELECT id, title, author, content FROM poems WHERE id = 1900')
row = cursor.fetchone()
if row:
    print('\n找到卜算子 (ID 1900):')
    print('  当前内容:', row[3])
    
    correct = '缺月挂疏桐，漏断人初静。时见幽人独往来，缥缈孤鸿影。惊起却回头，有恨无人省。拣尽寒枝不肯栖，寂寞沙洲冷。'
    cursor.execute('UPDATE poems SET content = ? WHERE id = 1900', (correct,))
    print('  ✓ 已修复为:', correct)
else:
    print('\n未找到卜算子')

conn.commit()
conn.close()

print('\n修复完成！')
