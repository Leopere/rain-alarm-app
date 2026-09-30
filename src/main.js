const { app, BrowserWindow, Menu, session, desktopCapturer, WebContentsView, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { SITES, siteForUrl, permissionAllowed } = require('./weather-sites');
const MAPS = Object.entries(SITES).map(([id, site]) => ({ id, name: site.label, url: site.url, description: site.description }));
const SHELL_URL = pathToFileURL(path.join(__dirname, 'index.html')).href;
const TOOLBAR_HEIGHT = 112;

function isMapUrl(map, value) {
  return siteForUrl(value) === map.id;
}

function isRainAlarmUrl(value) {
  return siteForUrl(value) === 'rain';
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
    const origin = requestOrigin(webContents, details);
    callback(permissionAllowed(origin, _permission));
  });

  defaultSession.setPermissionCheckHandler((webContents, _permission, requestingOrigin, details) => {
    const origin = requestingOrigin || requestOrigin(webContents, details);
    return permissionAllowed(origin, _permission);
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
        if (isMainFrame && code !== -3) status(map, 'error', 'Could not load this map. Reload to try again.');
      });
      contents.on('render-process-gone', () => status(map, 'error', 'This map stopped responding. Reload to try again.'));
      contents.setWindowOpenHandler(({ url }) => {
        if (isMapUrl(map, url)) contents.loadURL(url).catch(() => {});
        return { action: 'deny' };
      });
      for (const eventName of ['will-navigate', 'will-redirect']) {
        contents.on(eventName, (event, url) => {
          if (!isMapUrl(map, url)) {
            event.preventDefault();
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
  const channels = ['maps:list', 'maps:select', 'maps:reload'];
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
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'Maps', submenu: MAPS.map((map, index) => ({
      label: map.name, accelerator: `CmdOrCtrl+${index + 1}`,
      click: () => mainWindow.webContents.executeJavaScript(`document.getElementById('map').value = ${JSON.stringify(map.id)}; document.getElementById('map').dispatchEvent(new Event('change'));`).catch(console.error),
    })) },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ label: 'Reload map', accelerator: 'CmdOrCtrl+R', click: () => selected?.webContents.reload() }] },
    { role: 'windowMenu' },
  ]));
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  return mainWindow;
}

app.setName('Rain Alarm');
app.setPath('userData', path.join(app.getPath('appData'), 'Rain Alarm'));

if (require.main === module) app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  installPermissionPolicy();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

if (require.main === module) app.on('window-all-closed', () => {
  app.quit();
});

module.exports = { createWindow, installPermissionPolicy, MAPS, isMapUrl };
