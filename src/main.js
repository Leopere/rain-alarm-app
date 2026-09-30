const { app, BrowserWindow, Menu, shell, session, desktopCapturer } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { SITES, siteForUrl, permissionAllowed } = require('./weather-sites');

function isRainAlarmUrl(value) {
  return siteForUrl(value) === 'rain';
}

function selectedSite() {
  try {
    const site = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'weather-site.json'), 'utf8')).site;
    if (Object.hasOwn(SITES, site)) return site;
  } catch { /* First launch or a damaged preference falls back to radar. */ }
  return 'rain';
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

  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(permissionAllowed(requestOrigin(webContents, details), permission));
  });

  defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return permissionAllowed(requestingOrigin || requestOrigin(webContents, details), permission);
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
    if (siteForUrl(url)) {
      mainWindow.loadURL(url).catch(console.error);
    } else {
      openExternal(url);
    }
    return { action: 'deny' };
  });

  function guardNavigation(event, url) {
    if (siteForUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  }
  mainWindow.webContents.on('will-navigate', guardNavigation);
  mainWindow.webContents.on('will-redirect', guardNavigation);

  mainWindow.webContents.on('did-navigate', (_event, url) => {
    const site = siteForUrl(url);
    if (!site) return;
    mainWindow.setTitle(`Rain Alarm · ${SITES[site].label}`);
    try {
      const file = path.join(app.getPath('userData'), 'weather-site.json');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify({ site }), { mode: 0o600 });
      fs.renameSync(`${file}.tmp`, file);
    } catch (error) {
      console.warn('Could not save the selected weather view:', error.message);
    }
  });

  mainWindow.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();
    callback(isRainAlarmWebContents(mainWindow.webContents) ? devices[0]?.deviceId || '' : '');
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'Weather', submenu: Object.values(SITES).map(({ label, url }, index) => ({
      label, accelerator: `CmdOrCtrl+${index + 1}`, click: () => mainWindow.loadURL(url).catch(console.error),
    })) },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
  mainWindow.loadURL(SITES[selectedSite()].url).catch(console.error);
  return mainWindow;
}

function openExternal(value) {
  try {
    if (['https:', 'http:', 'mailto:'].includes(new URL(value).protocol)) shell.openExternal(value).catch(console.error);
  } catch { /* Ignore malformed or executable links. */ }
}

if (require.main === module) {
  app.setName('Rain Alarm');
  app.setPath('userData', path.join(app.getPath('appData'), 'Rain Alarm'));

  app.whenReady().then(() => {
    installPermissionPolicy();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(isRainAlarmUrl(url));
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}

module.exports = { createWindow, installPermissionPolicy, selectedSite };
