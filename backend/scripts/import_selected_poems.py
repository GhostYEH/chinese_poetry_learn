
import sqlite3
import json
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')
poetry_dir = os.path.join(os.path.dirname(__file__), '../../poetry')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('开始导入唐诗三百首和宋词三百首...\n')

files = [
    os.path.join(poetry_dir, '全唐诗', '唐诗三百首.json'),
    os.path.join(poetry_dir, '宋词', '宋词三百首.json')
]

total_inserted = 0

for file_path in files:
    dynasty = '唐' if '唐诗' in file_path else '宋'
    print(f'处理 {os.path.basename(file_path)} ({dynasty}朝)...')
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        inserted = 0
        for item in data:
            try:
                title = item.get('title') or item.get('rhythmic') or item.get('name', '')
                author = item.get('author') or item.get('作者', '')
                tags = ','.join(item.get('tags', []))
                
                content = ''
                if 'paragraphs' in item and isinstance(item['paragraphs'], list):
                    content = ''.join(item['paragraphs'])
                elif 'content' in item:
                    if isinstance(item['content'], list):
                        content = ''.join(item['content'])
                    else:
                        content = item['content']
                
                content = content.strip()
                title = title.strip()
                author = author.strip()
                
                if title and author and content:
                    cursor.execute(
                        'INSERT INTO poems (title, author, dynasty, content, tags) VALUES (?, ?, ?, ?, ?)',
                        (title, author, dynasty, content, tags)
                    )
                    inserted += 1
                    total_inserted += 1
            except Exception as e:
                pass
        
        print(f'  导入 {inserted} 首\n')
    except Exception as e:
        print(f'  错误: {e}\n')

conn.commit()
conn.close()

print(f'导入完成！共导入 {total_inserted} 首诗词')
