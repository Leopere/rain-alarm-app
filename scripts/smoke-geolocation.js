const { app, BrowserWindow, session } = require('electron');
const path = require('node:path');

app.setPath('userData', path.join(app.getPath('appData'), 'Rain Alarm Smoke Test'));

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  session.defaultSession.setPermissionCheckHandler(() => true);

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'src', 'preload.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  await window.loadURL('https://www.rain-alarm.com/');

  const result = await window.webContents.executeJavaScript(`
    new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          ok: true,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        }),
        (error) => resolve({
          ok: false,
          code: error.code,
          message: error.message,
        }),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      );
    });
  `);

  console.log(JSON.stringify(result, null, 2));
  window.destroy();
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});
