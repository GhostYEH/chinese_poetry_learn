# 古诗词学习系统

> 一个融合趣味游戏与个性化学习的古诗词教育平台

## 项目简介

这是一个功能丰富的古诗词在线学习系统，分为**学生端**和**教师端**，支持多种趣味闯关模式、AI智能辅导和个性化学习路径。系统采用前后端分离架构，前端基于 Vue.js，后端基于 Node.js + Express，数据存储使用 SQLite。

### 主要特色

- **多种趣味闯关模式**：飞花令对战、诗词接龙、诗词跑酷、诗词消消乐等
- **AI智能辅导**：基于大语言模型的诗词解读、背诵检测、字符详解和学习建议
- **个性化学习分析**：智能分析学习数据，提供个性化诗词推荐
- **教师管理后台**：学生管理、班级管理、学习数据统计与分析
- **响应式设计**：支持桌面端和移动端访问
- **实时对战**：支持多人在线飞花令对战
- **意境图生成**：AI生成诗词意境图和诗人头像

## 项目结构

```
chinese-poetry/
├── backend/                     # 后端服务
│   ├── src/
│   │   ├── api/                # API路由（路由接口）
│   │   │   ├── aiRoutes.js     # AI相关接口
│   │   │   ├── authRoutes.js   # 认证相关接口
│   │   │   ├── challengeRoutes.js  # 闯关相关接口
│   │   │   ├── creationRoutes.js   # 创作相关接口
│   │   │   ├── feihuaRoutes.js     # 飞花令相关接口
│   │   │   ├── learningRoutes.js   # 学习相关接口
│   │   │   ├── poemRoutes.js       # 诗词相关接口
│   │   │   ├── teacherRoutes.js    # 教师端接口
│   │   │   └── ...
│   │   ├── config/             # 配置文件
│   │   ├── data/               # 数据文件（飞花令诗词库等）
│   │   ├── middleware/         # 中间件（认证、日志等）
│   │   ├── services/          # 业务逻辑服务
│   │   │   ├── aiService.js       # AI服务
│   │   │   ├── feihualingService.js  # 飞花令服务
│   │   │   ├── learningService.js   # 学习记录服务
│   │   │   ├── mistakesService.js   # 错题本服务
│   │   │   └── ...
│   │   ├── socket/             # WebSocket实时通信
│   │   ├── utils/              # 工具函数
│   │   └── db.js               # 数据库初始化
│   ├── public/                 # 静态文件
│   ├── scripts/                # 脚本工具（数据导入等）
│   └── server.js               # 主入口
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/         # 公共组件
│   │   │   ├── common/         # 通用组件
│   │   │   ├── home/           # 首页组件
│   │   │   ├── poem/           # 诗词相关组件
│   │   │   └── teacher/        # 教师端组件
│   │   ├── data/               # 前端数据文件
│   │   ├── router/             # 路由配置
│   │   ├── services/           # API服务
│   │   ├── stores/             # 状态管理
│   │   ├── views/              # 页面组件
│   │   │   ├── creation/       # 诗词创作页面
│   │   │   ├── teacher/        # 教师端页面
│   │   │   ├── ChallengeBattle.vue    # 诗词接龙对战
│   │   │   ├── FeiHuaLingOnline.vue  # 飞花令在线对战
│   │   │   ├── FeiHuaLingSingle.vue  # 飞花令单人
│   │   │   ├── FeiHuaRanking.vue     # 飞花令排行榜
│   │   │   ├── Home.vue             # 首页
│   │   │   ├── LearningDashboard.vue  # 学习看板
│   │   │   ├── PoemDetail.vue        # 诗词详情
│   │   │   ├── PoetryCardCatch.vue   # 诗词消消乐
│   │   │   ├── Search.vue            # 诗词搜索
│   │   │   └── ...
│   │   └── App.vue             # 根组件
│   └── index.html
└── poetry/                     # 诗词原始数据
    ├── 全唐诗/
    ├── 宋词/
    ├── 诗经/
    └── ...
```

## 技术栈

### 前端
- **框架**: Vue 3 + Composition API
- **构建工具**: Vite
- **路由**: Vue Router
- **状态管理**: Pinia
- **HTTP客户端**: Axios
- **图表**: ECharts
- **样式**: CSS3 + Flexbox/Grid

### 后端
- **运行时**: Node.js
- **框架**: Express
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT
- **实时通信**: Socket.io
- **AI服务**: 硅基流动API、阿里云百炼API、智谱AI

## 环境配置

### 1. 安装依赖

```bash
# 后端依赖
cd backend
npm install

# 前端依赖
cd ../frontend
npm install
```

### 2. 环境变量配置

创建 `backend/.env` 文件：

```env
# 应用配置
PORT=3000
NODE_ENV=development

# JWT配置
JWT_SECRET=your-secret-key-change-this-in-production

# 数据库配置
DB_PATH=./db/poetry.db

# 硅基流动API配置（用于图像生成）
SILICONFLOW_API_KEY=your-siliconflow-api-key

# 阿里云百炼API配置（用于AI对话和背诵检测）
ALIYUN_BAILIAN_API_KEY=your-aliyun-bailian-api-key
# 或者
DASHSCOPE_API_KEY=your-dashscope-api-key

# CORS配置
CORS_ORIGIN=http://localhost:5173

# 日志配置
LOG_LEVEL=info
```

### 3. 启动服务

```bash
# 启动后端（端口3000）
cd backend
npm start

# 启动前端开发服务器（端口5173）
cd frontend
npm run dev
```

## 功能模块

### 学生端功能

#### 1. 首页 (`/`)
- 每日推荐诗词展示
- 学习数据统计（已学诗词数、连续学习天数等）
- 趣味游戏入口卡片
- 个性化诗词推荐

#### 2. 登录/注册
- 学生账号登录 (`/login`)
- 新用户注册 (`/register`)
- 演示模式入口 (`/demo`)

#### 3. 诗词学习
- **诗词列表** (`/search`): 搜索和浏览诗词
- **诗词详情** (`/poem/:id`): 
  - 诗词原文展示
  - 注释、译文、赏析
  - AI多种讲解模式（生活化解释、关键词分析、意境赏析、思考题）
  - 意境图生成
  - 诗人头像生成
  - 背诵检测
  - 字符详解
- **学习路径** (`/learning-path`): 个性化学习路径规划

#### 4. 趣味闯关游戏

| 游戏名称 | 路由 | 玩法说明 |
|---------|------|---------|
| 飞花令-单人 | `/feihua/single` | 选择关键字，轮流说出含该字的诗句 |
| 飞花令-对战 | `/feihua/multiplayer` | 在线匹配对战，支持实时PK |
| 飞花令排行榜 | `/feihua/ranking` | 查看飞花令排行榜 |
| 诗词跑酷 | `/poetry-parkour` | 诗句逐字出现，快速选择正确续接 |
| 诗词消消乐 | `/poetry-card-catch` | 翻开卡牌记忆诗句，考验记忆力 |
| 诗词挑战 | `/poem-challenge` | 选择关卡挑战，答题闯关 |
| 诗词接龙 | `/challenge-battle` | 根据提示接龙下一句诗句 |

#### 5. 学习辅助
- **错题本** (`/error-book`): 自动收录背诵检测错误
- **错题复习** (`/wrong-review`): 针对性复习易错诗词
- **收藏夹** (`/collection`): 收藏喜欢的诗词

#### 6. 学习数据
- **学习看板** (`/dashboard`): 个人学习数据统计
- **个人中心** (`/profile`): 修改个人信息

### 教师端功能

访问路径: `/teacher/*`

#### 1. 教师登录
- 教师登录 (`/teacher/login`)
- 教师注册 (`/teacher/register`)

#### 2. 数据看板 (`/teacher/dashboard`)
- 学生总数统计
- 今日活跃学生数
- 平均关卡进度
- 学习趋势图表（柱状图）
- 关卡分布图表
- 错题TOP10排行榜

#### 3. 学生管理 (`/teacher/students`)
- 学生列表查看
- 学生详情分析 (`/teacher/student/:id`)
  - 学习记录分析
  - 学习偏好对比
  - 学习时段分布
  - 记忆遗忘曲线
  - 学习能力分析
  - 个性化诗词推荐

#### 4. 班级管理 (`/teacher/classes`)
- 班级列表
- 班级对比数据
- 学生排名统计
- 闯关排名数据
- 班级详情 (`/teacher/class/:id`)

#### 5. 诗词管理 (`/teacher/poems`)
- 诗词库管理
- 添加/编辑/删除诗词

#### 6. 游戏数据 (`/teacher/game-data`)
- 游戏参与统计
- 游戏表现分析

### AI功能详解

#### 1. 诗词讲解 (`/api/ai/explainPoem/*`)
- `daily_life_explanation`: 生活化诗意解释
- `keyword_analysis`: 关键词深度解析
- `artistic_conception`: 意境赏析
- `thinking_questions`: 引导性思考题
- `batch`: 批量获取所有讲解

#### 2. 背诵检测 (`/api/ai/recite-check`)
- 程序比对：基础字符匹配
- AI智能判断：语义理解，判断背诵正确性
- 错题自动收录

#### 3. AI对话助教 (`/api/ai/tutor`)
- 支持连续追问
- 上下文记忆

#### 4. 字符详解 (`/api/ai/char-info`)
- 单字查询：读音、释义
- 批量查询：一首诗中所有字符

#### 5. 图像生成
- **意境图** (`/api/ai/scene-image`): 根据诗句生成意境画面
- **诗人头像** (`/api/ai/author-avatar`): 生成诗人肖像
- **轮播图** (`/api/ai/image/carousel`): 多风格意境图

#### 6. 飞花令验证 (`/api/ai/feihua-validate`)
- 数据库快速验证
- AI语义验证
- 支持模糊匹配

#### 7. 学习建议 (`/api/ai/advice`)
- 基于学习记录生成个性化建议
- 薄弱点分析
- 学习计划推荐

## 数据库表结构

系统首次启动时自动创建以下数据表：

| 表名 | 说明 |
|------|------|
| users | 学生用户信息 |
| teachers | 教师用户信息 |
| poems | 诗词数据 |
| learning_records | 学习记录 |
| mistakes | 错题记录 |
| collections | 收藏记录 |
| creations | 创作记录 |
| classes | 班级信息 |
| class_stats | 班级统计数据 |
| user_challenge_progress | 用户闯关进度 |
| user_challenge_records | 用户答题记录 |
| user_error_book | 用户错题本 |
| teacher_notes | 教师备注 |
| student_tags | 学生标签 |
| daily_poems | 每日推荐诗词 |
| personalized_recommendations | 个性化推荐 |

## API接口概览

### 认证相关
- `POST /api/auth/register` - 学生注册
- `POST /api/auth/login` - 学生登录
- `POST /api/auth/logout` - 登出
- `POST /api/teacher/register` - 教师注册
- `POST /api/teacher/login` - 教师登录

### 诗词相关
- `GET /api/poems` - 获取诗词列表（支持分页、筛选）
- `GET /api/poems/:id` - 获取诗词详情
- `GET /api/poems/search` - 搜索诗词
- `GET /api/poems/levels` - 获取诗词难度等级
- `GET /api/poems/random` - 随机获取诗词

### 学习相关
- `POST /api/learning/record` - 记录学习行为
- `GET /api/learning/path` - 获取学习路径
- `GET /api/learning/stats` - 获取学习统计
- `GET /api/learning/dashboard` - 获取学习仪表盘数据

### AI相关
- `POST /api/ai/explainPoem` - 诗词讲解
- `POST /api/ai/explainPoem/batch` - 批量诗词讲解
- `POST /api/ai/recite-check` - 背诵检测
- `POST /api/ai/tutor` - AI对话助教
- `POST /api/ai/char-info` - 字符详解
- `POST /api/ai/char-info/batch` - 批量字符详解
- `POST /api/ai/search` - AI智能语义搜索
- `POST /api/ai/scene-image` - 生成诗句意境图
- `POST /api/ai/author-avatar` - 生成诗人头像
- `POST /api/ai/feihua-validate` - 飞花令诗句验证
- `POST /api/ai/advice` - 学习建议

### 游戏相关
- `POST /api/feihua/start` - 开始飞花令
- `POST /api/feihua/submit` - 提交诗句
- `GET /api/feihua/ranking` - 飞花令排行榜
- `POST /api/feihua/validate` - 验证诗句
- `POST /api/card-game/verify` - 验证卡牌游戏答案

### 教师端API
- `GET /api/teacher/dashboard` - 看板数据
- `GET /api/teacher/students` - 学生列表
- `GET /api/teacher/student/:id/detail` - 学生详情
- `GET /api/teacher/classes` - 班级列表
- `GET /api/teacher/class/:id` - 班级详情
- `GET /api/teacher/rankings` - 排名数据
- `GET /api/teacher/analytics` - 数据分析

## 实时通信 (WebSocket)

系统使用 Socket.io 实现实时功能：

- **飞花令对战**: 实时匹配和答题
- **图像生成进度**: 实时推送生成状态
- **排行榜更新**: 实时更新游戏排名
- **通知推送**: 学习提醒和成就通知

## 安全配置

### JWT认证
- 学生和教师使用不同的JWT令牌
- 令牌包含角色信息（teacher/student）
- 令牌有效期24小时
- 敏感操作需要身份验证

### 数据安全
- 使用参数化查询防止SQL注入
- 密码加密存储
- 敏感API需要身份验证

### CORS配置
- 开发环境允许本地访问
- 生产环境配置指定域名

## 常见问题

### 1. 数据库连接失败
- 确保 `backend/db/` 目录存在
- 检查数据库文件权限
- 首次运行会自动创建数据库

### 2. 前端无法连接后端
- 检查后端服务是否运行在端口3000
- 检查CORS配置是否正确
- 确保前端代理配置正确

### 3. AI功能不可用
- 检查 `SILICONFLOW_API_KEY` 和 `ALIYUN_BAILIAN_API_KEY` 环境变量
- 确保网络连接正常
- API调用失败时会返回模拟数据或错误提示

### 4. WebSocket连接失败
- 检查端口是否被占用
- 确保防火墙允许WebSocket连接
- 检查代理配置是否支持WebSocket

### 5. 图像生成失败
- 检查硅基流动API密钥是否配置正确
- 检查API配额是否用完
- 查看后端日志获取详细错误信息

## 开发指南

### 添加新的游戏模式

1. **后端路由**: 在 `backend/src/api/` 添加游戏路由文件
2. **后端服务**: 在 `backend/src/services/` 添加游戏逻辑
3. **前端页面**: 在 `frontend/src/views/` 添加游戏页面
4. **路由配置**: 在 `frontend/src/router/` 添加路由
5. **API服务**: 在 `frontend/src/services/` 添加API调用

### 代码规范

- 后端代码使用传统 function 风格，便于阅读和维护
- 前端使用 Vue 3 Composition API
- 使用有意义的变量和函数命名
- 添加必要的注释说明复杂逻辑

### 样式规范

- 使用CSS变量定义主题色
- 采用BEM命名规范
- 响应式设计适配多端
- 使用ECharts进行数据可视化

## 部署说明

### 开发环境
```bash
# 后端开发
cd backend && npm start

# 前端开发
cd frontend && npm run dev
```

### 生产环境
1. 设置生产环境变量
2. 构建前端: `cd frontend && npm run build`
3. 配置Web服务器（Nginx）
4. 使用PM2管理Node.js进程

## 贡献指南

欢迎提交Issue和Pull Request！

## 许可证

MIT License

## 致谢

- 诗词数据来源：[chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)
- 使用了多种开源库，详见各项目package.json
