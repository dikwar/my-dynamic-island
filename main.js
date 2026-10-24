const { app, BrowserWindow, screen, ipcMain, shell, clipboard, globalShortcut } = require('electron');
const os = require('os');

let win;
let lastClipboard = '';
let isGhostMode = false;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  const windowWidth = 480;
  const windowHeight = 350;

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

  // Shortcut Global Alt + X untuk Ghost Mode (Anti-Penghalang 100%)
  globalShortcut.register('Alt+X', () => {
    isGhostMode = !isGhostMode;
    if (win) {
      win.setIgnoreMouseEvents(true, { forward: true });
      win.webContents.send('ghost-mode-changed', isGhostMode);
    }
  });

  // Monitor Kesehatan Laptop (RAM & CPU) & Clipboard setiap 2 detik
  setInterval(() => {
    if (!win || win.isDestroyed()) return;

    // 1. Cek Penggunaan RAM & CPU
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const ramUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
      for (let type in cpu.times) totalTick += cpu.times[type];
      totalIdle += cpu.times.idle;
    });
    const cpuUsage = Math.min(100, Math.max(5, Math.round(100 - ~~(100 * totalIdle / totalTick))));

    win.webContents.send('system-stats', { ram: ramUsage, cpu: cpuUsage });

    // 2. Cek Teks Baru di Clipboard (Copy-Paste)
    const currentClip = clipboard.readText().trim();
    if (currentClip && currentClip !== lastClipboard) {
      lastClipboard = currentClip;
      win.webContents.send('clipboard-update', currentClip);
    }
  }, 2000);
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

// Pindah Posisi Kapsul (Kiri / Tengah / Kanan) agar tidak menghalangi
ipcMain.on('move-position', (event, pos) => {
  if (!win) return;
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const winWidth = 480;
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
