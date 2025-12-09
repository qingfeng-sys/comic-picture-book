// 测试环境变量读取
require('dotenv').config({ path: '.env.local' });

console.log('=== 环境变量测试 ===');
console.log('DEEPSEEK_API_KEY:', process.env.DEEPSEEK_API_KEY ? '已设置' : '未设置');
console.log('QINIU_API_KEY:', process.env.QINIU_API_KEY ? '已设置' : '未设置');

if (process.env.QINIU_API_KEY) {
  console.log('QINIU_API_KEY 前10个字符:', process.env.QINIU_API_KEY.substring(0, 10) + '...');
}
