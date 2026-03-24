const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

// 判断是否是开发环境
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// 获取后端路径
function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend', 'server.js');
  } else {
    return path.join(process.resourcesPath, 'backend', 'server.js');
  }
}

// 获取前端路径
function getFrontendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend', 'public', 'index.html');
  } else {
    return path.join(process.resourcesPath, 'backend', 'public', 'index.html');
  }
}

// 启动后端服务器
function startBackend() {
  const backendPath = getBackendPath();
  const backendDir = path.dirname(backendPath);

  console.log('Starting backend from:', backendPath);
  console.log('Backend directory:', backendDir);

  // 设置环境变量
  const env = {
    ...process.env,
    PORT: '3000',
    NODE_ENV: 'production',
    DB_PATH: isDev ? './db/poetry.db' : path.join(process.resourcesPath, 'db', 'poetry.db'),
    POETRY_DATA_PATH: isDev ? './poetry' : path.join(process.resourcesPath, 'poetry')
  };

  // 启动后端进程
  backendProcess = spawn('node', [backendPath], {
    cwd: backendDir,
    env: env,
    stdio: 'inherit',
    shell: true
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.ico'),
    title: '古诗词学习系统',
    show: false
  });

  // 等待后端启动后加载页面
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.show();

    // 开发模式下打开开发者工具
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  }, 3000);

  // 创建菜单
  const menuTemplate = [
    {
      label: '文件',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'forceReload', label: '强制刷新' },
        { type: 'separator' },
        { role: 'close', label: '关闭' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '古诗词学习系统',
              detail: '版本: 1.0.0\n\n一个功能完整的古诗词学习平台，包含诗词浏览、飞花令游戏、AI辅助等功能。'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 在新窗口中打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  // 启动后端
  startBackend();

  // 创建窗口
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出
app.on('window-all-closed', () => {
  // 停止后端进程
  if (backendProcess) {
    backendProcess.kill();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出时清理
app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
