const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const POETRY_DIR = path.join(ROOT_DIR, 'poetry');
const NODEJS_DIR = path.join(ROOT_DIR, 'nodejs');

const DIST_BACKEND_DIR = path.join(DIST_DIR, 'backend');
const DIST_NODEJS_DIR = path.join(DIST_DIR, 'nodejs');
const DIST_POETRY_DIR = path.join(DIST_DIR, 'poetry');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function removeDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function copyDir(src, dest, excludePatterns = []) {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        const shouldExclude = excludePatterns.some(pattern => {
            if (pattern.endsWith('/**')) {
                return entry.name === pattern.replace('/**', '');
            }
            return entry.name === pattern;
        });

        if (shouldExclude) continue;

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath, excludePatterns);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    ensureDir(destDir);
    fs.copyFileSync(src, dest);
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getDirSize(dir) {
    let size = 0;
    if (!fs.existsSync(dir)) return 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            size += getDirSize(fullPath);
        } else {
            size += fs.statSync(fullPath).size;
        }
    }
    return size;
}

function countFiles(dir) {
    let count = 0;
    if (!fs.existsSync(dir)) return 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            count += countFiles(fullPath);
        } else {
            count++;
        }
    }
    return count;
}

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║          古诗词学习系统 - 完整打包工具                      ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

async function build() {
    const startTime = Date.now();

    console.log('[步骤 1/8] 清理旧的打包目录...');
    removeDir(DIST_DIR);
    ensureDir(DIST_DIR);
    console.log('   ✓ 清理完成');

    console.log('');
    console.log('[步骤 2/8] 复制绿色版 Node.js...');
    if (fs.existsSync(NODEJS_DIR)) {
        copyDir(NODEJS_DIR, DIST_NODEJS_DIR);
        console.log('   ✓ Node.js 复制完成');
    } else {
        console.log('   ✗ 错误: 找不到 nodejs 目录，请确保项目根目录下有 nodejs 文件夹');
        process.exit(1);
    }

    console.log('');
    console.log('[步骤 3/8] 复制后端代码...');
    copyDir(BACKEND_DIR, DIST_BACKEND_DIR, ['node_modules']);
    
    const distPkgPath = path.join(DIST_BACKEND_DIR, 'package.json');
    const distPkg = JSON.parse(fs.readFileSync(distPkgPath, 'utf8'));
    distPkg.dependencies.uuid = '^9.0.0';
    fs.writeFileSync(distPkgPath, JSON.stringify(distPkg, null, 2));
    
    console.log('   ✓ 后端代码复制完成 (uuid 已降级到 v9)');

    console.log('');
    console.log('[步骤 4/8] 复制诗词数据...');
    if (fs.existsSync(POETRY_DIR)) {
        copyDir(POETRY_DIR, DIST_POETRY_DIR);
        console.log('   ✓ 诗词数据复制完成');
    } else {
        console.log('   ! 警告: 找不到 poetry 目录，跳过');
    }

    console.log('');
    console.log('[步骤 5/8] 复制数据库文件...');
    const dbDir = path.join(BACKEND_DIR, 'db');
    const distDbDir = path.join(DIST_BACKEND_DIR, 'db');
    ensureDir(distDbDir);

    if (fs.existsSync(dbDir)) {
        const dbFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.db'));
        if (dbFiles.length > 0) {
            for (const dbFile of dbFiles) {
                copyFile(
                    path.join(dbDir, dbFile),
                    path.join(distDbDir, dbFile)
                );
                const size = fs.statSync(path.join(dbDir, dbFile)).size;
                console.log(`   ✓ 复制数据库: ${dbFile} (${formatSize(size)})`);
            }
        } else {
            console.log('   ! 数据库目录为空，将在首次运行时自动创建');
        }
    } else {
        console.log('   ! 数据库目录不存在，将在首次运行时自动创建');
    }

    console.log('');
    console.log('[步骤 6/8] 复制缓存文件...');
    const cacheDir = path.join(BACKEND_DIR, 'cache');
    const distCacheDir = path.join(DIST_BACKEND_DIR, 'cache');
    if (fs.existsSync(cacheDir)) {
        copyDir(cacheDir, distCacheDir);
        const cacheCount = countFiles(distCacheDir);
        console.log(`   ✓ 缓存文件复制完成 (${cacheCount} 个文件)`);
    } else {
        console.log('   ! 缓存目录不存在，跳过');
    }

    console.log('');
    console.log('[步骤 7/8] 创建配置文件...');

    const envContent = `# 应用配置
PORT=3000
NODE_ENV=production

# JWT配置
JWT_SECRET=your-secret-key-change-this-in-production

# 数据库配置
DB_PATH=./db/poetry.db

# 阿里云百炼API配置
ALIYUN_BAILIAN_API_KEY=sk-a108d2b3d248481fb4201626bc44f464
DASHSCOPE_API_KEY=sk-a108d2b3d248481fb4201626bc44f464

# 智谱AI配置
ZHIPU_API_KEY=20aa68f683dd4089a8e13bf91bdb32c0.kmud8gA1sseTSnMF

# SiliconFlow API配置
SILICONFLOW_API_KEY=sk-dpfwjaxfgczlafuzpewcczlwvmkfnzvjrrqxmwchdunylzvs

# CORS配置
CORS_ORIGIN=*

# 日志配置
LOG_LEVEL=info
`;
    fs.writeFileSync(path.join(DIST_BACKEND_DIR, '.env'), envContent);
    console.log('   ✓ .env 配置文件创建完成');

    const startBatContent = `@echo off
title Poetry Learning System

pushd "%~dp0backend"
start "" http://localhost:3000
"%~dp0nodejs\\node.exe" server.js
popd
pause
`;
    fs.writeFileSync(path.join(DIST_DIR, 'start.bat'), startBatContent);
    console.log('   ✓ start.bat created');

    const stopBatContent = `@echo off
taskkill /f /im node.exe 2>nul
echo Service stopped.
pause
`;
    fs.writeFileSync(path.join(DIST_DIR, 'stop.bat'), stopBatContent);
    console.log('   ✓ stop.bat created');

    console.log('');
    console.log('[步骤 8/8] 安装生产依赖...');
    try {
        const npmCmd = path.join(DIST_NODEJS_DIR, 'npm.cmd');
        execSync(`"${npmCmd}" install --production`, {
            cwd: DIST_BACKEND_DIR,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: 'production' }
        });
        console.log('   ✓ 依赖安装完成');
    } catch (e) {
        console.log('   ! 依赖安装遇到问题，将在首次启动时自动安装');
    }

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    打包完成！                               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const distSize = getDirSize(DIST_DIR);

    console.log('打包信息:');
    console.log(`  - 输出目录: ${DIST_DIR}`);
    console.log(`  - 总大小: ${formatSize(distSize)}`);
    console.log(`  - 耗时: ${totalTime} 秒`);
    console.log('');
    console.log('使用方法:');
    console.log('  双击运行: dist/启动古诗词学习系统.bat');
    console.log('');
    console.log('目录结构:');
    console.log('  dist/');
    console.log('  ├── nodejs/              (绿色版 Node.js)');
    console.log('  ├── backend/             (后端代码)');
    console.log('  │   ├── db/              (数据库)');
    console.log('  │   ├── cache/           (缓存)');
    console.log('  │   ├── public/          (前端页面)');
    console.log('  │   └── node_modules/    (依赖)');
    console.log('  ├── poetry/              (诗词数据)');
    console.log('  ├── 启动古诗词学习系统.bat');
    console.log('  └── 停止服务.bat');
    console.log('');
}

build().catch(err => {
    console.error('打包失败:', err);
    process.exit(1);
});
