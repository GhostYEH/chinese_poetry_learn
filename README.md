# 古诗词学习系统 - 教师端

## 项目概述

这是一个古诗词学习系统，分为教师端和学生端，支持不同身份的账号登录实现。

## 项目结构

```
chinese-poetry-master/
├── backend/          # 后端服务
│   ├── src/
│   │   ├── api/     # API路由
│   │   ├── config/  # 配置文件
│   │   ├── middleware/ # 中间件
│   │   ├── services/ # 业务逻辑
│   │   └── utils/   # 工具函数
│   ├── db/          # 数据库文件
│   └── server.js    # 主服务器文件
├── frontend/         # 前端应用
│   ├── src/
│   │   ├── components/ # 组件
│   │   ├── views/     # 页面组件
│   │   ├── router/    # 路由配置
│   │   └── services/  # API服务
│   └── index.html    # HTML模板
└── poetry/           # 诗词数据
```

## 环境配置

### 1. 复制环境变量文件

```bash
cp .env.example .env
```

### 2. 配置环境变量

编辑 `.env` 文件，设置以下变量：

```env
# 应用配置
PORT=3000
NODE_ENV=development

# JWT配置
JWT_SECRET=your-secret-key-change-this-in-production

# 数据库配置
DB_PATH=./db/poetry.db

# 硅基流动API配置（可选）
SILICONFLOW_API_KEY=your-siliconflow-api-key

# CORS配置
CORS_ORIGIN=http://localhost:8080

# 日志配置
LOG_LEVEL=info
```

### 3. 安装依赖

```bash
# 后端依赖
cd backend
npm install

# 前端依赖
cd ../frontend
npm install
```

### 4. 启动服务

```bash
# 启动后端服务
cd backend
npm start

# 启动前端开发服务器
cd ../frontend
npm run dev
```

## 教师端功能

### 登录/注册
- 教师专用登录页面：`/teacher/login`
- 教师注册页面：`/teacher/register`
- 与学生端登录分离，使用不同的JWT令牌

### 数据看板
- 学生总数统计
- 今日活跃学生数
- 平均关卡进度
- 错题总数统计
- 学习趋势图表
- 关卡分布图表
- 错题TOP10排行榜
- 正确率vs错误率图表

### 学生管理
- 查看学生学习详情
- 学习记录分析
- 学习偏好对比
- 学习时段分布
- 记忆遗忘曲线
- 学习能力分析
- 个性化诗词推荐

### 班级管理
- 班级列表查看
- 班级对比数据
- 学生排名统计
- 闯关排名数据

### 数据导出
- 支持Excel格式导出
- 可导出排名数据
- 可导出学习统计

## 数据库初始化

系统首次启动时会自动创建以下表：

1. **用户表 (users)** - 学生信息
2. **教师表 (teachers)** - 教师信息
3. **诗词表 (poems)** - 诗词数据
4. **学习记录表 (learning_records)** - 学生学习记录
5. **错题本表 (mistakes)** - 学生错题记录
6. **收藏表 (collections)** - 学生收藏记录
7. **创作表 (creations)** - 学生创作记录
8. **班级表 (classes)** - 班级信息
9. **班级统计表 (class_stats)** - 班级统计数据
10. **用户闯关进度表 (user_challenge_progress)** - 闯关进度
11. **用户答题记录表 (user_challenge_records)** - 答题记录
12. **用户错题本表 (user_error_book)** - 错题复习
13. **教师备注表 (teacher_notes)** - 教师对学生备注
14. **学生标签表 (student_tags)** - 学生标签

## 安全配置

### JWT认证
- 教师和学生使用不同的JWT令牌
- 令牌包含角色信息（teacher/student）
- 令牌有效期24小时
- 使用环境变量配置密钥

### 路由守卫
- 教师端路由需要教师认证
- 学生端路由需要学生认证
- 自动清理冲突的token

### 数据库安全
- 使用参数化查询防止SQL注入
- 密码使用bcrypt哈希存储
- 外键约束和级联删除

## API接口

### 教师端API
- `POST /api/teacher/register` - 教师注册
- `POST /api/teacher/login` - 教师登录
- `GET /api/teacher/dashboard` - 看板数据
- `GET /api/teacher/student/:id/detail` - 学生详情
- `GET /api/teacher/student/:id/analysis` - 学生分析
- `GET /api/teacher/classes` - 班级列表
- `GET /api/teacher/rankings/overall` - 总排名
- `GET /api/teacher/rankings/class/:classId` - 班级排名
- `GET /api/teacher/challenge/rankings` - 闯关排名
- `POST /api/teacher/export` - 数据导出

### 学生端API
- `POST /api/auth/register` - 学生注册
- `POST /api/auth/login` - 学生登录
- `GET /api/poems` - 获取诗词
- `POST /api/learn/record` - 记录学习
- `GET /api/challenge/progress` - 闯关进度

## 常见问题

### 1. 数据库连接失败
- 确保数据库目录存在：`backend/db/`
- 检查SQLite数据库文件权限

### 2. JWT认证失败
- 检查JWT_SECRET环境变量
- 确保教师和学生使用不同的角色标识

### 3. 前端无法连接后端
- 检查后端服务是否运行在正确端口（默认3000）
- 检查CORS配置
- 确保前端代理配置正确

### 4. 硅基流动API调用失败
- 检查SILICONFLOW_API_KEY环境变量
- 确保网络连接正常
- API调用失败时会返回模拟数据

## 开发说明

### 添加新功能
1. 在后端`src/api/`中添加新的路由文件
2. 在前端`src/views/teacher/`中添加新的页面组件
3. 在路由配置中添加新的路由
4. 更新数据库表结构（如果需要）

### 修改样式
- 使用CSS变量统一颜色主题
- 响应式设计支持移动端
- 使用ECharts进行数据可视化

### 部署说明
1. 设置生产环境变量
2. 构建前端应用：`npm run build`
3. 配置Nginx反向代理
4. 使用PM2管理Node.js进程

## 许可证

MIT License