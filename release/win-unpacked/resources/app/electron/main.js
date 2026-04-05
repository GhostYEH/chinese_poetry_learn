const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProcess = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function getResourcesPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.join(__dirname, '..');
}

function startBackend() {
  const resourcesPath = getResourcesPath();
  const backendPath = path.join(resourcesPath, 'backend');
  
  let nodePath;
  if (app.isPackaged) {
    nodePath = path.join(resourcesPath, 'nodejs', 'node.exe');
  } else {
    nodePath = process.execPath;
  }

  console.log('Starting backend from:', backendPath);
  console.log('Node path:', nodePath);

  backendProcess = spawn(nodePath, ['server.js'], {
    cwd: backendPath,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log('Backend process exited with code:', code);
  });
}

function stopBackend() {
  if (backendProcess) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', backendProcess.pid.toString(), '/f', '/t']);
    } else {
      backendProcess.kill('SIGTERM');
    }
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: '智韵·灵犀 - 古诗词学习系统',
    icon: path.join(getResourcesPath(), 'backend', 'public', 'run.jpg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const serverUrl = 'http://localhost:3000';
  
  setTimeout(() => {
    mainWindow.loadURL(serverUrl).catch(err => {
      console.error('Failed to load URL:', err);
    });
  }, 2000);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    setTimeout(() => {
      mainWindow.loadURL(serverUrl);
    }, 1000);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

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
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'resetZoom', label: '重置缩放' },
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
              message: '智韵·灵犀 - 古诗词学习系统',
              detail: '版本: 1.0.0\n\n一款智能古诗词学习系统，支持诗词学习、背诵检测、飞花令对战等功能。'
            });
          }
        }
      ]
    }
  ];

  if (isDev) {
    menuTemplate[1].submenu.push(
      { type: 'separator' },
      { role: 'toggleDevTools', label: '开发者工具' }
    );
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('will-quit', () => {
  stopBackend();
});
