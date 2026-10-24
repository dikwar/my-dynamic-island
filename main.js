const { app, BrowserWindow, screen, ipcMain, shell, clipboard, globalShortcut } = require('electron');
const os = require('os');
const { exec } = require('child_process');

// Membuka blokir suara otomatis agar Nusa langsung bisa ngomong saat baru nyala
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-speech-dispatcher');

let win;
let lastClipboard = '';
let isGhostMode = false;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  const windowWidth = 500;
  const windowHeight = 380;

  win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((width - windowWidth) / 2),
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile('index.html');

  // Shortcut Alt + X untuk Ghost Mode (Anti-Penghalang 100%)
  globalShortcut.register('Alt+X', () => {
    isGhostMode = !isGhostMode;
    if (win) {
      win.setIgnoreMouseEvents(true, { forward: true });
      win.webContents.send('ghost-mode-changed', isGhostMode);
    }
  });

  // Monitor RAM & Clipboard setiap 2 detik
  setInterval(() => {
    if (!win || win.isDestroyed()) return;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);
    win.webContents.send('system-stats', { ram: ramUsage });

    const currentClip = clipboard.readText().trim();
    if (currentClip && currentClip !== lastClipboard) {
      lastClipboard = currentClip;
      win.webContents.send('clipboard-update', currentClip);
    }
  }, 2000);

  // Detektor Aplikasi Windows untuk Misi Kultivasi Otomatis (Setiap 4 detik)
  setInterval(() => {
    if (!win || win.isDestroyed()) return;
    exec('tasklist /FO CSV /NH', (err, stdout) => {
      if (err) return;
      const processes = stdout.toLowerCase();
      const detected = {
        vscode: processes.includes('code.exe'),
        word: processes.includes('winword.exe') || processes.includes('wps.exe') || processes.includes('et.exe'),
        media: processes.includes('chrome.exe') || processes.includes('msedge.exe') || processes.includes('vlc.exe') || processes.includes('spotify.exe')
      };
      win.webContents.send('running-apps', detected);
    });
  }, 4000);
}

ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (win && !isGhostMode) {
    win.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('activate-ghost', () => {
  isGhostMode = true;
  if (win) {
    win.setIgnoreMouseEvents(true, { forward: true });
    win.webContents.send('ghost-mode-changed', true);
  }
});

ipcMain.on('move-position', (event, pos) => {
  if (!win) return;
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 500;
  let newX = Math.round((width - winWidth) / 2);
  if (pos === 'left') newX = 20;
  if (pos === 'right') newX = width - winWidth - 20;
  win.setPosition(newX, 0, true);
});

ipcMain.on('copy-text', (event, text) => {
  lastClipboard = text;
  clipboard.writeText(text);
});

ipcMain.on('open-file', (event, filePath) => {
  if (filePath) shell.openPath(filePath);
});

ipcMain.on('toggle-autostart', (event, enable) => {
  app.setLoginItemSettings({ openAtLogin: enable, path: app.getPath('exe') });
});

app.whenReady().then(createWindow);
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
