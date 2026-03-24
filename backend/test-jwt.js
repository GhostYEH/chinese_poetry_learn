// JWT Token验证测试
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-secret-key-change-in-production';

console.log('=== JWT Token 验证测试 ===\n');

// 创建测试token
const testUser = { id: 1, username: '测试用户' };
const token = jwt.sign(
  { id: testUser.id, username: testUser.username },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('生成的Token:', token);
console.log('使用的密钥:', JWT_SECRET);
console.log('\n尝试验证Token...');

try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('✅ Token验证成功!');
  console.log('解码后的数据:', decoded);
} catch (error) {
  console.log('❌ Token验证失败!');
  console.log('错误:', error.message);
}

// 测试不同的密钥
console.log('\n测试使用不同密钥验证...');
const wrongSecret = 'wrong-secret';
try {
  const decoded = jwt.verify(token, wrongSecret);
  console.log('✅ Token验证成功!');
  console.log('解码后的数据:', decoded);
} catch (error) {
  console.log('❌ Token验证失败（预期结果）');
  console.log('错误:', error.message);
}
