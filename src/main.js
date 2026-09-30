const { app, BrowserWindow, Menu, shell, session, desktopCapturer, WebContentsView, ipcMain } = require('electron');
const path = require('node:path');
<<<<<<< Updated upstream
const fs = require('node:fs');
const { SITES, siteForUrl, permissionAllowed } = require('./weather-sites');
=======
const { pathToFileURL } = require('node:url');

const MAPS = [
  { id: 'rain', name: 'Rain Alarm', url: 'https://www.rain-alarm.com/', description: 'Live rain radar and approaching-rain alerts.' },
  { id: 'unwx', name: 'UnWX', url: 'https://www.unwx.app/pwa/', description: 'Rain Alarm’s sister site for official severe-weather warnings.' },
  { id: 'canada', name: 'Environment Canada', url: 'https://weather.gc.ca/?layers=radar', description: 'Canadian radar and official weather alerts.' },
  { id: 'windy', name: 'Windy', url: 'https://www.windy.com/', description: 'Wind, rain, temperature, and forecast models.' },
  { id: 'lightning', name: 'LightningMaps', url: 'https://www.lightningmaps.org/', description: 'Real-time lightning activity.' },
];
const SHELL_URL = pathToFileURL(path.join(__dirname, 'index.html')).href;
const TOOLBAR_HEIGHT = 112;

function isMapUrl(map, value) {
  if (map.id === 'rain') return isRainAlarmUrl(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === new URL(map.url).origin;
  } catch {
    return false;
  }
}

function openExternal(value) {
  try {
    if (['https:', 'http:'].includes(new URL(value).protocol)) {
      shell.openExternal(value).catch(console.error);
    }
  } catch { /* Ignore invalid links from remote pages. */ }
}

function canUseLocation(webContents, value) {
  return MAPS.some((map) => isMapUrl(map, webContents?.getURL()) && isMapUrl(map, value));
}
const APP_ORIGINS = new Set([
  'https://www.rain-alarm.com',
  'https://rain-alarm.com',
  'https://app.rain-alarm.com',
]);
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(permissionAllowed(requestOrigin(webContents, details), permission));
  });

  defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return permissionAllowed(requestingOrigin || requestOrigin(webContents, details), permission);
=======
  defaultSession.setPermissionRequestHandler((webContents, _permission, callback, details) => {
    const origin = requestOrigin(webContents, details);
    callback(isRainAlarmUrl(origin) || (_permission === 'geolocation' && canUseLocation(webContents, origin)));
  });

  defaultSession.setPermissionCheckHandler((webContents, _permission, requestingOrigin, details) => {
    const origin = requestingOrigin || requestOrigin(webContents, details);
    return isRainAlarmUrl(origin) || (_permission === 'geolocation' && canUseLocation(webContents, origin));
>>>>>>> Stashed changes
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
    width: 1120, height: 820, minWidth: 620, minHeight: 480,
    title: 'Rain Alarm', backgroundColor: '#f5f7fa', show: false,
    webPreferences: {
      preload: path.join(__dirname, 'shell-preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  const views = new Map();
  const statuses = new Map();
  let selected;

  function resize() {
    const [width, height] = mainWindow.getContentSize();
    selected?.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(0, height - TOOLBAR_HEIGHT) });
  }

<<<<<<< Updated upstream
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
=======
  function status(map, phase, message = '') {
    const value = { id: map.id, phase, message };
    statuses.set(map.id, value);
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('maps:status', value);
  }

  function select(id) {
    const map = MAPS.find((item) => item.id === id);
    if (!map) throw new Error('Unknown map');
    let view = views.get(id);
    if (!view) {
      view = new WebContentsView({ webPreferences: {
        ...(id === 'rain' ? { preload: path.join(__dirname, 'preload.js'), contextIsolation: false, backgroundThrottling: false } : { contextIsolation: true }),
        nodeIntegration: false, sandbox: true, webSecurity: true,
      } });
      views.set(id, view);
      const contents = view.webContents;
      contents.on('did-start-loading', () => status(map, 'loading'));
      contents.on('did-stop-loading', () => {
        if (statuses.get(id)?.phase !== 'error') status(map, 'ready');
      });
      contents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
        if (isMainFrame && code !== -3) status(map, 'error', 'Could not load this map. Retry or open it in your browser.');
      });
      contents.on('render-process-gone', () => status(map, 'error', 'This map stopped responding. Reload to try again.'));
      contents.setWindowOpenHandler(({ url }) => {
        if (isMapUrl(map, url)) contents.loadURL(url).catch(() => {});
        else openExternal(url);
        return { action: 'deny' };
      });
      for (const eventName of ['will-navigate', 'will-redirect']) {
        contents.on(eventName, (event, url) => {
          if (!isMapUrl(map, url)) {
            event.preventDefault();
            openExternal(url);
          }
        });
      }
      if (id === 'rain') {
        contents.on('will-prevent-unload', (event) => event.preventDefault());
        contents.on('select-bluetooth-device', (event, devices, callback) => {
          event.preventDefault();
          callback(isRainAlarmWebContents(contents) ? devices[0]?.deviceId || '' : '');
        });
      }
      status(map, 'loading');
      contents.loadURL(map.url).catch(() => {});
    }
    if (selected) mainWindow.contentView.removeChildView(selected);
    selected = view;
    mainWindow.contentView.addChildView(view);
    resize();
    mainWindow.setTitle(`${map.name} — Rain Alarm`);
    return statuses.get(id);
  }

  // Only the bundled main frame may control the map views.
  const channels = ['maps:list', 'maps:select', 'maps:reload', 'maps:open'];
  function handle(channel, action) {
    ipcMain.handle(channel, (event, ...args) => {
      if (event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || event.senderFrame.url !== SHELL_URL) {
        throw new Error('Untrusted map control request');
      }
      return action(...args);
    });
  }
  handle('maps:list', () => MAPS);
  handle('maps:select', select);
  handle('maps:reload', () => selected?.webContents.reload());
  handle('maps:open', () => {
    const map = MAPS.find((item) => views.get(item.id) === selected);
    if (map) openExternal(map.url);
  });
  mainWindow.on('resize', resize);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.on('closed', () => {
    channels.forEach((channel) => ipcMain.removeHandler(channel));
    for (const view of views.values()) {
      if (!view.webContents.isDestroyed()) view.webContents.close();
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
>>>>>>> Stashed changes
  return mainWindow;
}

function openExternal(value) {
  try {
    if (['https:', 'http:', 'mailto:'].includes(new URL(value).protocol)) shell.openExternal(value).catch(console.error);
  } catch { /* Ignore malformed or executable links. */ }
}

<<<<<<< Updated upstream
if (require.main === module) {
  app.setName('Rain Alarm');
  app.setPath('userData', path.join(app.getPath('appData'), 'Rain Alarm'));
=======
if (require.main === module) app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  installPermissionPolicy();
  createWindow();
>>>>>>> Stashed changes

  app.whenReady().then(() => {
    installPermissionPolicy();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

<<<<<<< Updated upstream
  app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(isRainAlarmUrl(url));
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}

module.exports = { createWindow, installPermissionPolicy, selectedSite };
=======
if (require.main === module) app.on('window-all-closed', () => {
  app.quit();
});

module.exports = { createWindow, installPermissionPolicy, MAPS, isMapUrl };
>>>>>>> Stashed changes
