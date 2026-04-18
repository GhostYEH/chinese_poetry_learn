
import os
import glob

print('在整个项目中查找数据库文件...\n')

# 查找所有 .db 文件
db_files = glob.glob('**/*.db', recursive=True)

if db_files:
    print('找到数据库文件:')
    for f in db_files:
        abs_path = os.path.abspath(f)
        print('  -', abs_path)
        print('    大小:', os.path.getsize(f) // 1024, 'KB')
else:
    print('未找到 .db 文件')
    print('\n根据配置，数据库应该在:')
    print('  backend/db/poetry.db')
    print('\n数据库会在第一次启动服务器时自动创建。')
