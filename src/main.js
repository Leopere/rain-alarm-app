const { app, BrowserWindow, Menu, shell, session, desktopCapturer } = require('electron');
const path = require('node:path');

const APP_URL = 'https://www.rain-alarm.com/';
const APP_ORIGINS = new Set([
  'https://www.rain-alarm.com',
  'https://rain-alarm.com',
  'https://app.rain-alarm.com',
]);

function isRainAlarmUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && APP_ORIGINS.has(url.origin);
  } catch {
    return false;
  }
}

function requestOrigin(webContents, details = {}) {
  return (
    details.requestingUrl ||
    details.securityOrigin ||
    details.embeddingOrigin ||
    details.origin ||
    details.frame?.url ||
    webContents?.getURL()
  );
}

function isRainAlarmWebContents(webContents) {
  return isRainAlarmUrl(webContents?.getURL());
}

function installPermissionPolicy() {
  const defaultSession = session.defaultSession;

  defaultSession.setPermissionRequestHandler((webContents, _permission, callback, details) => {
    callback(isRainAlarmUrl(requestOrigin(webContents, details)));
  });

  defaultSession.setPermissionCheckHandler((webContents, _permission, requestingOrigin, details) => {
    return isRainAlarmUrl(requestingOrigin) || isRainAlarmUrl(requestOrigin(webContents, details));
  });

  defaultSession.setDevicePermissionHandler((details) => {
    return isRainAlarmUrl(details.origin);
  });

  defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!isRainAlarmUrl(request.securityOrigin)) {
      callback({});
      return;
    }

    try {
      const streams = {};

      if (request.videoRequested) {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        streams.video = sources[0];
      }

      if (request.audioRequested && request.frame) {
        streams.audio = request.frame;
        streams.enableLocalEcho = true;
      }

      callback(streams);
    } catch {
      callback({});
    }
  });

  defaultSession.on('file-system-access-restricted', (event, details, callback) => {
    event.preventDefault();
    callback(isRainAlarmUrl(details.origin) ? 'allow' : 'deny');
  });

  defaultSession.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    callback(isRainAlarmUrl(details.frame?.url) ? details.deviceList[0]?.deviceId : undefined);
  });

  defaultSession.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    callback(isRainAlarmWebContents(webContents) ? portList[0]?.portId || '' : '');
  });

  defaultSession.on('select-usb-device', (event, details, callback) => {
    event.preventDefault();
    callback(isRainAlarmUrl(details.frame?.url) ? details.deviceList[0]?.deviceId : undefined);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 820,
    minWidth: 820,
    minHeight: 620,
    title: 'Rain Alarm',
    backgroundColor: '#707070',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isRainAlarmUrl(url)) {
      return { action: 'allow' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isRainAlarmUrl(url)) {
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();
    callback(isRainAlarmWebContents(mainWindow.webContents) ? devices[0]?.deviceId || '' : '');
  });

  mainWindow.loadURL(APP_URL);
}

app.setName('Rain Alarm');
app.setPath('userData', path.join(app.getPath('appData'), 'Rain Alarm'));

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  installPermissionPolicy();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('certificate-error', (event, webContents, url, _error, _certificate, callback) => {
  event.preventDefault();
  callback(isRainAlarmUrl(url) || isRainAlarmWebContents(webContents));
});

app.on('window-all-closed', () => {
  app.quit();
});
