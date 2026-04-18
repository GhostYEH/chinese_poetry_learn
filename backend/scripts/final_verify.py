
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('验证修复的诗词...\n')

# 验证静夜思
print('验证静夜思:')
cursor.execute('SELECT id, title, author, content FROM poems WHERE id = 8309')
row = cursor.fetchone()
if row:
    print('  ID:', row[0])
    print('  标题:', row[1])
    print('  作者:', row[2])
    print('  内容:', row[3])
    
    correct = '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
    if row[3] == correct:
        print('  内容正确')
    else:
        print('  内容不正确')
else:
    print('  未找到')

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
        print('  内容正确')
    else:
        print('  内容不正确')
else:
    print('  未找到')

# 统计数据库总数
cursor.execute('SELECT COUNT(*) FROM poems')
count = cursor.fetchone()[0]
print('\n数据库中共有', count, '首诗词')

conn.close()
print('\n验证完成！')
