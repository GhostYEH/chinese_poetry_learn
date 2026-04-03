const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let backendProcess;

function createWindow() {
  console.log('创建应用窗口...');
  try {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false
      },
      show: false
    });

    const indexPath = path.join(__dirname, '../backend/public/index.html');
    console.log('加载页面:', indexPath);

    if (!fs.existsSync(indexPath)) {
      console.error('页面文件不存在:', indexPath);
      app.quit();
      return;
    }

    mainWindow.loadFile(indexPath);

    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    mainWindow.on('closed', function () {
      mainWindow = null;
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('页面加载失败:', errorCode, errorDescription);
    });

  } catch (error) {
    console.error('创建窗口失败:', error);
  }
}

function startBackend() {
  console.log('准备启动后端...');
  
  try {
    const backendPath = path.join(__dirname, '../backend/server.js');
    console.log('后端路径:', backendPath);

    if (!fs.existsSync(backendPath)) {
      console.error('后端文件不存在:', backendPath);
      return false;
    }

    const backendDir = path.join(__dirname, '../backend');
    console.log('工作目录:', backendDir);

    backendProcess = spawn(process.execPath, [backendPath], {
      cwd: backendDir,
      env: {
        ...process.env,
        NODE_ENV: 'production'
      },
      detached: false,
      stdio: 'pipe'
    });

    console.log('后端进程已启动，PID:', backendProcess.pid);

    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('后端:', output);
    });

    backendProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error('后端错误:', output);
    });

    backendProcess.on('close', (code) => {
      console.log('后端进程退出，代码:', code);
    });

    backendProcess.on('error', (error) => {
      console.error('后端进程错误:', error);
    });

    return true;
  } catch (error) {
    console.error('启动后端失败:', error);
    return false;
  }
}

app.on('ready', () => {
  console.log('Electron 应用已就绪');
  
  const started = startBackend();
  
  if (started) {
    console.log('等待后端启动...');
    setTimeout(() => {
      createWindow();
    }, 3000);
  } else {
    console.error('后端启动失败，直接创建窗口');
    createWindow();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  console.log('所有窗口已关闭');
  if (process.platform !== 'darwin') {
    if (backendProcess) {
      console.log('关闭后端进程...');
      try {
        backendProcess.kill();
      } catch (e) {
        console.error('关闭后端失败:', e);
      }
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  console.log('应用即将退出');
  if (backendProcess) {
    try {
      backendProcess.kill();
    } catch (e) {
      console.error('关闭后端失败:', e);
    }
  }
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
});
