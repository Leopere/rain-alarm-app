const { app, BrowserWindow, Menu, session, desktopCapturer, WebContentsView } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const { SITES, siteForUrl, permissionAllowed } = require('./weather-sites');
const MAPS = Object.entries(SITES).map(([id, site]) => ({ id, name: site.label, ...site }));
const MAP_CLEANUP_CSS = fs.readFileSync(path.join(__dirname, 'map-cleanup.css'), 'utf8');

function isMapUrl(map, value) {
  return siteForUrl(value) === (map.provider || map.id);
}

function selectedSite() {
  try {
    const { site } = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'weather-site.json'), 'utf8'));
    if (Object.hasOwn(SITES, site)) return site;
  } catch { /* First launch defaults to rain radar. */ }
  return 'rain';
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
    title: 'Rain Alarm', backgroundColor: '#111', show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const views = new Map();
  let selected;
  let selectedMap;

  function resize() {
    const [width, height] = mainWindow.getContentSize();
    selected?.setBounds({ x: 0, y: 0, width, height });
  }
  function title(map, state = '') {
    if (!mainWindow.isDestroyed() && selectedMap === map) {
      mainWindow.setTitle(`${map.name} — Rain Alarm${state ? ` · ${state}` : ''}`);
    }
  }
  function select(map) {
    let view = views.get(map.id);
    if (!view) {
      view = new WebContentsView({ webPreferences: {
        ...(map.id === 'rain' ? { preload: path.join(__dirname, 'preload.js'), contextIsolation: false, backgroundThrottling: false } : { contextIsolation: true }),
        nodeIntegration: false, sandbox: true, webSecurity: true,
      } });
      views.set(map.id, view);
      const contents = view.webContents;
      contents.on('did-start-loading', () => { view.failed = false; title(map, 'Loading'); });
      contents.on('did-finish-load', () => {
        if (!view.failed) title(map);
        contents.insertCSS(MAP_CLEANUP_CSS).catch(console.error);
      });
      contents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
        if (isMainFrame && code !== -3) { view.failed = true; title(map, 'Unavailable — ⌘R to retry'); }
      });
      contents.on('render-process-gone', () => { view.failed = true; title(map, 'Unavailable — ⌘R to retry'); });
      contents.setWindowOpenHandler(({ url }) => {
        if (isMapUrl(map, url)) contents.loadURL(url).catch(() => {});
        return { action: 'deny' };
      });
      for (const eventName of ['will-navigate', 'will-redirect']) {
        contents.on(eventName, (event, url) => {
          if (!isMapUrl(map, url)) event.preventDefault();
        });
      }
      if (map.id === 'rain') {
        contents.on('will-prevent-unload', (event) => event.preventDefault());
        contents.on('select-bluetooth-device', (event, devices, callback) => {
          event.preventDefault();
          callback(isRainAlarmWebContents(contents) ? devices[0]?.deviceId || '' : '');
        });
      }
      contents.loadURL(map.url).catch(() => {});
    }
    if (selected) mainWindow.contentView.removeChildView(selected);
    selected = view;
    selectedMap = map;
    mainWindow.contentView.addChildView(view);
    resize();
    title(map, view.failed ? 'Unavailable — ⌘R to retry' : view.webContents.isLoading() ? 'Loading' : '');
    const menu = Menu.getApplicationMenu();
    for (const item of MAPS) menu.getMenuItemById(item.id).checked = item.id === map.id;
    try {
      const file = path.join(app.getPath('userData'), 'weather-site.json');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify({ site: map.id }), { mode: 0o600 });
      fs.renameSync(`${file}.tmp`, file);
    } catch (error) {
      console.warn('Could not save the selected map:', error.message);
    }
  }
  const menuItem = (map, index) => ({
    id: map.id, label: map.name, type: 'checkbox', accelerator: `CmdOrCtrl+${index + 1}`,
    click: () => select(map),
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'Maps', submenu: [
      ...MAPS.filter((map) => map.provider !== 'earth').map(menuItem),
      { label: 'Earth Nullschool', submenu: MAPS.filter((map) => map.provider === 'earth').map((map) => menuItem(map, MAPS.indexOf(map))) },
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ id: 'reload-map', label: 'Reload map', accelerator: 'CmdOrCtrl+R', click: () => selected?.webContents.reload() }] },
    { role: 'windowMenu' },
  ]));
  mainWindow.on('resize', resize);
  mainWindow.on('closed', () => {
    for (const view of views.values()) if (!view.webContents.isDestroyed()) view.webContents.close();
  });
  select(MAPS.find((map) => map.id === selectedSite()));
  mainWindow.show();
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

module.exports = { createWindow, installPermissionPolicy, MAPS, isMapUrl, selectedSite };
