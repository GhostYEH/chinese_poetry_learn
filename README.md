# 古诗词学习系统

一个基于 Node.js 和 Vue 3 的古诗词学习系统，集成了 AI 讲解功能，帮助用户更好地理解和学习古诗词。

## 项目结构

### 后端结构
```
backend/
├── src/
│   ├── api/           # API路由模块
│   │   ├── poemRoutes.js     # 诗词相关的API路由
│   │   └── aiRoutes.js       # AI相关的API路由
│   ├── config/        # 配置文件
│   │   └── config.js         # 主配置文件
│   ├── services/      # 业务逻辑服务
│   │   └── aiService.js      # AI服务模块
│   ├── utils/         # 工具函数
│   │   ├── cache.js          # 缓存工具函数
│   │   └── dataLoader.js     # 数据加载工具函数
│   ├── components/    # 组件（如果需要）
│   ├── store/         # 状态管理（如果需要）
├── server.js          # 主服务器文件
├── package.json       # 依赖管理
```

### 前端结构
```
frontend/
├── src/
│   ├── assets/        # 静态资源
│   │   └── style.css         # 样式文件
│   ├── components/     # Vue组件
│   ├── config/         # 配置文件
│   ├── router/         # 路由配置
│   │   └── index.js          # 路由配置文件
│   ├── services/       # 服务层（API调用等）
│   ├── store/          # 状态管理
│   ├── utils/          # 工具函数
│   ├── views/           # 页面组件
│   │   ├── Home.vue           # 首页
│   │   ├── PoemDetail.vue      # 诗词详情页
│   │   ├── Profile.vue         # 个人中心
│   │   └── Search.vue          # 搜索页
│   ├── App.vue          # 根组件
│   ├── main.js          # 入口文件
├── index.html          # HTML模板
├── package.json         # 依赖管理
├── vite.config.js       # Vite配置
```

## 核心功能

### 后端功能
1. **诗词数据管理**：加载和管理诗词数据
2. **诗词列表查询**：支持分页查询和随机获取诗词
3. **诗词详情查询**：根据ID查询诗词详情
4. **每日一诗**：随机获取一首诗词作为每日一诗
5. **AI讲解**：使用 SiliconFlow API 对诗词进行讲解，包括：
   - 生活化诗意解释
   - 关键词深度解析
   - 意境赏析
   - 引导性思考题
6. **AI背诵检测**：检测用户背诵的诗词是否正确，并提供AI反馈
7. **缓存管理**：对AI讲解结果进行缓存，提高性能

### 前端功能
1. **诗词列表展示**：展示诗词列表，支持分页和随机获取
2. **诗词详情展示**：展示诗词的详细信息，包括标题、作者、内容等
3. **AI讲解展示**：展示AI对诗词的讲解结果
4. **背诵检测**：用户可以背诵诗词，系统会检测背诵是否正确
5. **搜索功能**：搜索诗词和作者
6. **个人中心**：用户可以查看自己的学习记录

## 技术栈

### 后端
- Node.js
- Express
- SiliconFlow API (AI 服务)
- Python (数据加载和AI背诵检测)

### 前端
- Vue 3
- Vite
- Vue Router

## 安装和运行

### 后端安装和运行
1. 进入后端目录
   ```bash
   cd backend
   ```
2. 安装依赖
   ```bash
   npm install
   ```
3. 运行服务器
   ```bash
   npm start
   ```
   服务器将在 `http://localhost:3000` 上运行

### 前端安装和运行
1. 进入前端目录
   ```bash
   cd frontend
   ```
2. 安装依赖
   ```bash
   npm install
   ```
3. 运行开发服务器
   ```bash
   npm run dev
   ```
   前端将在 `http://localhost:5173` 上运行

## API 接口

### 诗词相关接口
1. **获取诗词列表**
   - URL: `/api/poems`
   - Method: GET
   - Query参数:
     - page: 页码，默认1
     - pageSize: 每页数量，默认30
     - random: 是否随机获取，默认false
   - 返回: 诗词列表

2. **获取诗词详情**
   - URL: `/api/poems/:id`
   - Method: GET
   - 返回: 诗词详情

3. **获取每日一诗**
   - URL: `/api/daily-poem`
   - Method: GET
   - 返回: 随机一首诗词

### AI 相关接口
1. **获取诗词讲解**
   - URL: `/api/ai/explainPoem`
   - Method: POST
   - Body参数:
     - poem: 诗词内容
     - title: 诗词标题
     - author: 诗词作者
   - 返回: AI讲解结果，包含生活化诗意解释、关键词深度解析、意境赏析和引导性思考题

2. **获取诗词生活化解释**
   - URL: `/api/ai/explainPoem/daily_life_explanation`
   - Method: POST
   - Body参数:
     - poem: 诗词内容
     - title: 诗词标题
     - author: 诗词作者
   - 返回: 诗词的生活化解释

3. **获取诗词关键词解析**
   - URL: `/api/ai/explainPoem/keyword_analysis`
   - Method: POST
   - Body参数:
     - poem: 诗词内容
     - title: 诗词标题
     - author: 诗词作者
   - 返回: 诗词的关键词深度解析

4. **获取诗词意境赏析**
   - URL: `/api/ai/explainPoem/artistic_conception`
   - Method: POST
   - Body参数:
     - poem: 诗词内容
     - title: 诗词标题
     - author: 诗词作者
   - 返回: 诗词的意境赏析

5. **获取诗词引导性思考题**
   - URL: `/api/ai/explainPoem/thinking_questions`
   - Method: POST
   - Body参数:
     - poem: 诗词内容
     - title: 诗词标题
     - author: 诗词作者
   - 返回: 诗词的引导性思考题

6. **背诵检测**
   - URL: `/api/ai/recite-check`
   - Method: POST
   - Body参数:
     - original: 原始诗词内容
     - input: 用户背诵的内容
   - 返回: 背诵检测结果，包含得分、错误字符、缺失字符、多余字符和AI建议

## 配置文件

### 后端配置文件
`backend/src/config/config.js` 文件包含以下配置项：
- **服务器配置**：端口、主机等
- **AI模型配置**：API密钥、模型名称、API URL等
- **缓存配置**：缓存目录、缓存过期时间等
- **数据加载配置**：Python脚本路径、默认数据等

### 环境变量
后端需要设置以下环境变量：
- **SILICONFLOW_API_KEY**：SiliconFlow API 密钥

## 数据来源

诗词数据来源于项目根目录下的各个文件夹，如 `全唐诗`、`宋词`、`元曲` 等。

## 贡献指南

请参考 [CONTRIBUTING.md](CONTRIBUTING.md) 文件，了解项目的文件命名规范、模块间依赖关系和代码风格规范。

## 许可证

本项目采用 MIT 许可证，请参考 [LICENSE](LICENSE) 文件。
