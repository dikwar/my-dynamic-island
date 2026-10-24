const { app, BrowserWindow, screen, ipcMain } = require('electron');

let win;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  const windowWidth = 420;
  const windowHeight = 160;

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
}

ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (win) {
    win.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
