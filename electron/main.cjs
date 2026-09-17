const { app, BrowserWindow, shell, Menu, MenuItem } = require('electron');
const path = require('path');
const fs = require('fs');

// Critical for Windows Virtual Machines (VMware, VirtualBox, Hyper-V, VPS):
// Virtualized display drivers lack GPU acceleration and cause a blank/black screen
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'NFT 公共铸造抢购工具 (SeaDrop Sniper)',
    autoHideMenuBar: true,
    show: true,
    backgroundColor: '#020617', // slate-950
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // allow direct RPC and cross-origin blockchain queries
    }
  });

  // Calculate correct dist/index.html path
  let indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(indexPath);
  }

  // Handle right-click context menu (Cut, Copy, Paste, Select All)
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    if (params.isEditable) {
      menu.append(new MenuItem({ label: '粘贴 (Paste)', role: 'paste' }));
      menu.append(new MenuItem({ label: '复制 (Copy)', role: 'copy' }));
      menu.append(new MenuItem({ label: '剪切 (Cut)', role: 'cut' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: '全选 (Select All)', role: 'selectAll' }));
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      menu.append(new MenuItem({ label: '复制 (Copy)', role: 'copy' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: '全选 (Select All)', role: 'selectAll' }));
    } else {
      menu.append(new MenuItem({ label: '重新加载 (Reload)', role: 'reload' }));
    }

    menu.popup(mainWindow);
  });

  // Handle load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorCode}, ${errorDescription}`);
  });

  // Open external links in user default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // F12 to toggle DevTools if needed for debugging
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
