// 测试硅基流动API调用
require('dotenv').config();
const axios = require('axios');

async function testSiliconFlowAPI() {
  console.log('=== 硅基流动API测试 ===\n');
  
  // 1. 检查环境变量
  const apiKey = process.env.SILICONFLOW_API_KEY;
  console.log('1. 检查环境变量:');
  console.log('   API密钥:', apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)}` : '未配置');
  console.log('   密钥长度:', apiKey ? apiKey.length : 0);
  
  if (!apiKey || apiKey === 'your-siliconflow-api-key-here') {
    console.error('\n❌ API密钥未正确配置！');
    return;
  }
  
  console.log('   ✅ API密钥已配置\n');
  
  // 2. 测试API调用
  console.log('2. 测试API调用:');
  console.log('   正在调用硅基流动API...');
  
  try {
    const testPrompt = '根据古诗词《静夜思》（作者：李白）的内容生成一幅中国风图像，画面要准确描绘诗中所描述的场景和意境，床前明月光疑是地上霜举头望明月低头思故乡，中国传统风格，高清细腻，氛围感强，无任何文字、无水印、无logo，画面干净统一，适合做网页背景图';
    
    const response = await axios.post('https://api.siliconflow.cn/v1/images/generations', {
      model: 'Kwai-Kolors/Kolors',
      prompt: testPrompt,
      image_size: '1440x720',
      batch_size: 1,
      num_inference_steps: 20,
      guidance_scale: 7.5
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60秒超时
    });
    
    console.log('   ✅ API调用成功！');
    console.log('   响应状态:', response.status);
    console.log('   响应数据结构:', {
      hasImages: !!response.data.images,
      imagesCount: response.data.images ? response.data.images.length : 0,
      firstImageType: response.data.images && response.data.images[0] ? typeof response.data.images[0] : 'none'
    });
    
    if (response.data.images && response.data.images[0]) {
      const imageData = response.data.images[0];
      console.log('   图片数据长度:', typeof imageData === 'string' ? imageData.length : '非字符串');
      console.log('   图片数据前100字符:', typeof imageData === 'string' ? imageData.substring(0, 100) : JSON.stringify(imageData).substring(0, 100));
      console.log('\n✅ 图片生成成功！API配置正确。');
    } else {
      console.log('\n⚠️ API响应格式异常，未找到图片数据。');
    }
    
  } catch (error) {
    console.log('   ❌ API调用失败！');
    
    if (error.response) {
      // 服务器响应了错误状态码
      console.log('   错误状态:', error.response.status);
      console.log('   错误信息:', error.response.data);
      
      if (error.response.status === 401) {
        console.log('\n❌ API密钥无效或已过期，请检查密钥是否正确。');
      } else if (error.response.status === 429) {
        console.log('\n❌ API调用次数超限，请检查账户余额或等待一段时间后重试。');
      } else if (error.response.status === 500) {
        console.log('\n❌ 服务器内部错误，请稍后重试。');
      }
    } else if (error.request) {
      // 请求已发送但未收到响应
      console.log('   ❌ 未收到服务器响应');
      console.log('   可能原因: 网络连接问题或API服务不可用');
    } else {
      // 请求配置错误
      console.log('   ❌ 请求配置错误:', error.message);
    }
  }
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
testSiliconFlowAPI();
