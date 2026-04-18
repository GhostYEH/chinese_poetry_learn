
import json
import os

file_path = os.path.join(os.path.dirname(__file__), '../../poetry/全唐诗/唐诗三百首.json')

print('检查唐诗三百首文件...\n')

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print('唐诗三百首共有', len(data), '首诗词\n')
    
    print('查找静夜思:')
    found = False
    for item in data:
        title = item.get('title', '')
        if '静' in title and '思' in title:
            print('找到:', title)
            found = True
    
    if not found:
        print('未找到静夜思！')
    
except Exception as e:
    print('错误:', str(e))
