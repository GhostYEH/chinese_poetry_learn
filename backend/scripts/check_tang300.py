
import json
import os

file_path = os.path.join(os.path.dirname(__file__), '../../poetry/全唐诗/唐诗三百首.json')

print('检查唐诗三百首文件...\n')

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f'唐诗三百首共有 {len(data)} 首诗词\n')
    
    print('查找静夜思:')
    found = False
    for item in data:
        title = item.get('title', '')
        author = item.get('author', '')
        if '静' in title and '思' in title:
            print('  找到:', title, '-', author)
            if 'paragraphs' in item:
                print('  内容:', ''.join(item['paragraphs']))
            found = True
    
    if not found:
        print('  未找到静夜思！')
    
    print('\n查找李白的诗 (前20首):')
    count = 0
    for item in data:
        author = item.get('author', '')
        if '李白' in author and count &lt; 20:
            title = item.get('title', '')
            print('  ', title, '-', author)
            count += 1
            
except Exception as e:
    print(f'错误: {e}')
