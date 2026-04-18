
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), '../db/poetry.db')

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print('查找李白的诗词:')
cursor.execute('SELECT id, title, author FROM poems WHERE author LIKE ? LIMIT 20', ('%李白%',))
rows = cursor.fetchall()
for row in rows:
    print('  [' + str(row[0]) + '] ' + row[1] + ' - ' + row[2])

print('\n查找苏轼的诗词:')
cursor.execute('SELECT id, title, author FROM poems WHERE author LIKE ? LIMIT 20', ('%苏轼%',))
rows = cursor.fetchall()
for row in rows:
    print('  [' + str(row[0]) + '] ' + row[1] + ' - ' + row[2])

conn.close()
