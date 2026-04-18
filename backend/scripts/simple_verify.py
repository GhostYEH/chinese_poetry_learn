
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('验证导入的诗词...\n')

# 查找静夜思
print('查找静夜思:')
cursor.execute('SELECT id, title, author, content FROM poems WHERE title LIKE ? AND author LIKE ?', 
              ('%静夜思%', '%李白%'))
rows = cursor.fetchall()
if rows:
    for row in rows:
        print('  找到:')
        print('    ID:', row[0])
        print('    标题:', row[1])
        print('    作者:', row[2])
        print('    内容:', row[3])
        
        correct = '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
        if row[3] == correct:
            print('    内容正确！')
        else:
            print('    内容不正确，正在修复...')
            cursor.execute('UPDATE poems SET content = ? WHERE id = ?', (correct, row[0]))
            print('    已修复！')
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
        
        correct = '缺月挂疏桐，漏断人初静。时见幽人独往来，缥缈孤鸿影。惊起却回头，有恨无人省。拣尽寒枝不肯栖，寂寞沙洲冷。'
        if row[3] == correct:
            print('    内容正确！')
        else:
            print('    内容不正确，正在修复...')
            cursor.execute('UPDATE poems SET content = ? WHERE id = ?', (correct, row[0]))
            print('    已修复！')
else:
    print('  未找到')

conn.commit()
conn.close()

print('\n验证完成！')
