const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const POETRY_DIR = path.join(ROOT_DIR, 'poetry');

const NODE_VERSION = '20.11.0';
const NODE_DOWNLOAD_URL = `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`;
const NODE_ZIP_PATH = path.join(DIST_DIR, 'node.zip');
const NODE_DIR = path.join(DIST_DIR, 'node');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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

console.log('========================================');
console.log('    古诗词学习系统 打包工具');
console.log('========================================');
console.log('');

ensureDir(DIST_DIR);

console.log('[1/6] 复制后端代码...');
const distBackendDir = path.join(DIST_DIR, 'backend');
if (fs.existsSync(distBackendDir)) {
  fs.rmSync(distBackendDir, { recursive: true });
}
copyDir(BACKEND_DIR, distBackendDir, ['node_modules', 'cache']);

console.log('[2/6] 复制诗词数据...');
const distPoetryDir = path.join(DIST_DIR, 'poetry');
if (fs.existsSync(distPoetryDir)) {
  fs.rmSync(distPoetryDir, { recursive: true });
}
copyDir(POETRY_DIR, distPoetryDir);

console.log('[3/6] 创建 .env 配置文件...');
const envContent = `PORT=3000
NODE_ENV=production

JWT_SECRET=your-secret-key-change-this-in-production

DB_PATH=./db/poetry.db

ALIYUN_BAILIAN_API_KEY=sk-a108d2b3d248481fb4201626bc44f464
DASHSCOPE_API_KEY=sk-a108d2b3d248481fb4201626bc44f464

ZHIPU_API_KEY=20aa68f683dd4089a8e13bf91bdb32c0.kmud8gA1sseTSnMF

SILICONFLOW_API_KEY=sk-dpfwjaxfgczlafuzpewcczlwvmkfnzvjrrqxmwchdunylzvs

CORS_ORIGIN=*

LOG_LEVEL=info
`;
fs.writeFileSync(path.join(distBackendDir, '.env'), envContent);

console.log('[4/6] 下载 Node.js 绿色版...');
ensureDir(NODE_DIR);

const https = require('https');
const http = require('http');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    
    const request = protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = Math.round((downloadedSize / totalSize) * 100);
        process.stdout.write(`\r下载进度: ${percent}%`);
      });
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('');
        resolve();
      });
    });
    
    request.on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function extractZipWithPowerShell(zipPath, destDir) {
  const psCommand = `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`;
  execSync(`powershell -Command "${psCommand}"`, { stdio: 'inherit' });
}

async function downloadAndExtractNode() {
  if (fs.existsSync(path.join(NODE_DIR, 'node.exe'))) {
    console.log('Node.js 已存在，跳过下载');
    return true;
  }
  
  console.log('正在下载 Node.js v' + NODE_VERSION + '...');
  
  try {
    await downloadFile(NODE_DOWNLOAD_URL, NODE_ZIP_PATH);
    console.log('下载完成，正在解压...');
    
    extractZipWithPowerShell(NODE_ZIP_PATH, DIST_DIR);
    
    const extractedDir = path.join(DIST_DIR, `node-v${NODE_VERSION}-win-x64`);
    if (fs.existsSync(extractedDir)) {
      console.log('重命名目录...');
      const entries = fs.readdirSync(extractedDir);
      for (const entry of entries) {
        const srcPath = path.join(extractedDir, entry);
        const destPath = path.join(NODE_DIR, entry);
        if (fs.statSync(srcPath).isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
      fs.rmSync(extractedDir, { recursive: true });
    }
    
    fs.unlinkSync(NODE_ZIP_PATH);
    console.log('Node.js 解压完成');
    return true;
  } catch (err) {
    console.error('下载/解压 Node.js 失败:', err.message);
    return false;
  }
}

async function main() {
  const nodeOk = await downloadAndExtractNode();
  
  if (!nodeOk) {
    console.log('');
    console.log('请手动下载 Node.js 并解压:');
    console.log(NODE_DOWNLOAD_URL);
    console.log('解压后将文件夹重命名为 "node" 放在 dist 目录下');
    return;
  }
  
  console.log('[5/6] 修复依赖兼容性并安装...');
  const pkgPath = path.join(distBackendDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.dependencies.uuid = '^9.0.0';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  
  try {
    const npmCmd = path.join(NODE_DIR, 'npm.cmd');
    execSync(`"${npmCmd}" install --production`, {
      cwd: distBackendDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
  } catch (e) {
    console.log('npm install 失败，请检查网络连接');
  }
  
  console.log('[6/6] 创建数据库目录...');
  ensureDir(path.join(distBackendDir, 'db'));
  
  console.log('');
  console.log('========================================');
  console.log('    打包完成！');
  console.log('========================================');
  console.log('');
  console.log('输出目录: ' + DIST_DIR);
  console.log('');
  console.log('使用方法:');
  console.log('  双击运行: dist/启动古诗词学习系统.bat');
  console.log('');
}

main().catch(console.error);
