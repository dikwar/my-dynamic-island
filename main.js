const { app, BrowserWindow, screen, ipcMain, shell, clipboard, globalShortcut } = require('electron');
const os = require('os');
const { exec } = require('child_process');

// Membuka blokir suara otomatis saat baru nyala
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-speech-dispatcher');

let win;
let lastClipboard = '';
let isGhostMode = false;
let lastSpotifyTrack = '';

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  const windowWidth = 500;
  const windowHeight = 385;

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

  // Shortcut Alt + X untuk Ghost Mode
  globalShortcut.register('Alt+X', () => {
    isGhostMode = !isGhostMode;
    if (win) {
      win.setIgnoreMouseEvents(true, { forward: true });
      win.webContents.send('ghost-mode-changed', isGhostMode);
    }
  });

  // PELACAK KURSOR GLOBAL
  setInterval(() => {
    if (!win || win.isDestroyed()) return;
    const cursorPos = screen.getCursorScreenPoint();
    const winBounds = win.getBounds();
    const displaySize = screen.getPrimaryDisplay().workAreaSize;

    win.webContents.send('global-cursor', {
      cursorX: cursorPos.x,
      cursorY: cursorPos.y,
      centerX: winBounds.x + winBounds.width / 2,
      centerY: winBounds.y + 22,
      screenW: displaySize.width,
      screenH: displaySize.height
    });
  }, 40);

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

  // Detektor Aplikasi Windows 
  setInterval(() => {
    if (!win || win.isDestroyed()) return;

    exec('tasklist /FO CSV /NH', (err, stdout) => {
      if (!err && stdout) {
        const processes = stdout.toLowerCase();
        const detected = {
          vscode: processes.includes('code.exe'),
          word: processes.includes('winword.exe') || processes.includes('wps.exe') || processes.includes('et.exe'),
          media: processes.includes('chrome.exe') || processes.includes('msedge.exe') || processes.includes('vlc.exe') || processes.includes('spotify.exe')
        };
        win.webContents.send('running-apps', detected);
      }
    });

    exec('powershell -NoProfile -WindowStyle Hidden -Command "(Get-Process Spotify -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle} | Select-Object -First 1).MainWindowTitle"', (err, stdout) => {
      if (!err && win && !win.isDestroyed()) {
        const title = (stdout || '').trim();
        if (title !== lastSpotifyTrack) {
          lastSpotifyTrack = title;
          win.webContents.send('spotify-track', title);
        }
      }
    });
  }, 3000);
}

// Kontrol Media Spotify
ipcMain.on('spotify-control', (event, action) => {
  if (action === 'open') {
    shell.openExternal('spotify:');
    return;
  }
  let keyCode = 179;
  if (action === 'next') keyCode = 176;
  if (action === 'prev') keyCode = 177;

  const psCmd = `powershell -NoProfile -WindowStyle Hidden -Command "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]${keyCode})"`;
  exec(psCmd);
});

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

// Anti-Error ffmpeg.dll saat Windows Startup
ipcMain.on('toggle-autostart', (event, enable) => {
  const realExePath = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe');
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: realExePath
  });
});

app.whenReady().then(createWindow);
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
