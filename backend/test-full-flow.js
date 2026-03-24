// 完整的背景图生成流程测试
require('dotenv').config();
const axios = require('axios');

async function testFullFlow() {
  console.log('=== 完整背景图生成流程测试 ===\n');
  
  const apiKey = process.env.SILICONFLOW_API_KEY;
  console.log('1. API密钥检查:');
  console.log('   ✅ 密钥已配置:', `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)}\n`);
  
  // 测试生成图片
  console.log('2. 测试图片生成:');
  const testPoem = {
    id: 1,
    title: '静夜思',
    author: '李白',
    content: '床前明月光，疑是地上霜。举头望明月，低头思故乡。'
  };
  
  const prompt = `根据古诗词《${testPoem.title}》（作者：${testPoem.author}）的内容生成一幅中国风图像，画面要准确描绘诗中所描述的场景和意境，${testPoem.content}，中国传统风格，高清细腻，氛围感强，无任何文字、无水印、无logo，画面干净统一，适合做网页背景图`;
  
  console.log('   Prompt:', prompt.substring(0, 100) + '...\n');
  
  try {
    const response = await axios.post('https://api.siliconflow.cn/v1/images/generations', {
      model: 'Kwai-Kolors/Kolors',
      prompt,
      image_size: '1440x720',
      batch_size: 1,
      num_inference_steps: 20,
      guidance_scale: 7.5
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });
    
    console.log('   ✅ API调用成功');
    console.log('   响应状态:', response.status);
    
    // 处理图片数据
    if (response.data && response.data.images && response.data.images[0]) {
      const imageData = response.data.images[0];
      let imageUrl;
      
      if (typeof imageData === 'object' && imageData !== null) {
        if (imageData.url) {
          imageUrl = imageData.url;
          console.log('   ✅ 获取到图片URL:', imageUrl);
        } else if (imageData.data) {
          imageUrl = `data:image/png;base64,${imageData.data}`;
          console.log('   ✅ 获取到Base64数据，长度:', imageData.data.length);
        }
      } else if (typeof imageData === 'string') {
        if (imageData.startsWith('http')) {
          imageUrl = imageData;
          console.log('   ✅ 获取到图片URL:', imageUrl);
        } else {
          imageUrl = `data:image/png;base64,${imageData}`;
          console.log('   ✅ 获取到Base64数据，长度:', imageData.length);
        }
      }
      
      console.log('\n3. 测试图片访问:');
      if (imageUrl && imageUrl.startsWith('http')) {
        try {
          const imgResponse = await axios.head(imageUrl, { timeout: 10000 });
          console.log('   ✅ 图片URL可访问');
          console.log('   图片大小:', imgResponse.headers['content-length'] ? 
            `${(parseInt(imgResponse.headers['content-length']) / 1024).toFixed(2)} KB` : '未知');
          console.log('   图片类型:', imgResponse.headers['content-type'] || '未知');
        } catch (error) {
          console.log('   ⚠️ 图片URL访问失败:', error.message);
        }
      }
      
      console.log('\n✅ 测试成功！背景图生成功能正常工作。');
      console.log('\n📝 使用说明:');
      console.log('   1. 打开诗词详情页');
      console.log('   2. 页面会自动预生成背景图');
      console.log('   3. 点击"开始学习"按钮');
      console.log('   4. 背景将显示AI生成的中国风图片');
      
    } else {
      console.log('   ❌ 响应数据格式异常');
    }
    
  } catch (error) {
    console.log('   ❌ 测试失败:', error.message);
    if (error.response) {
      console.log('   错误状态:', error.response.status);
      console.log('   错误详情:', error.response.data);
    }
  }
  
  console.log('\n=== 测试完成 ===');
}

testFullFlow();
