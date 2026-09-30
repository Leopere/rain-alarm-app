const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWindow, installPermissionPolicy, selectedSite } = require('../src/main');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rain-switcher-'));
app.setPath('userData', profile);
// The reopen assertion deliberately closes the last window without quitting.
app.on('window-all-closed', () => {});
// Keep automation running when the Mac has no visible display.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
const deadline = setTimeout(() => { console.error('Weather switcher smoke timed out.'); app.exit(1); }, 40000);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let window;
console.log('Weather smoke: starting.');

function loaded() {
  return new Promise((resolve, reject) => {
    window.webContents.once('did-finish-load', resolve);
    window.webContents.once('did-fail-load', (_event, code, description, url, mainFrame) => {
      if (mainFrame) reject(new Error(`${code}: ${description} ${url}`));
    });
  });
}

async function checkPage(site, hostname) {
  assert.equal(new URL(window.webContents.getURL()).hostname, hostname);
  const state = await window.webContents.executeJavaScript(`(() => {
    const host = document.getElementById('rain-alarm-switcher');
    const links = host?.shadowRoot?.querySelectorAll('a');
    const active = host?.shadowRoot?.querySelector('[aria-current="page"]');
    return { count: links?.length, active: active?.dataset.site,
      visible: host?.getBoundingClientRect().width > 0,
      map: !!document.querySelector('.leaflet-container'),
      tiles: [...document.querySelectorAll('.leaflet-tile-loaded')].filter(tile => tile.complete && tile.naturalWidth > 0).length,
      title: document.title, body: document.body.innerText.length };
  })()`);
  assert.equal(state.count, 2);
  assert.equal(state.active, site);
  assert.equal(state.visible, true);
  assert.equal(state.map, true, 'The live map must render.');
  assert.ok(state.tiles > 0, 'The live map must load its image tiles.');
  assert.ok(state.body > 20, 'The page must have meaningful content.');
  assert.equal(selectedSite(), site, 'Selection must be saved by the real main process.');
  if (process.env.RAIN_ALARM_SCREENSHOT_DIR) {
    fs.mkdirSync(process.env.RAIN_ALARM_SCREENSHOT_DIR, { recursive: true });
    const image = await window.webContents.capturePage();
    fs.writeFileSync(path.join(process.env.RAIN_ALARM_SCREENSHOT_DIR, `${site}.png`), image.toPNG());
  }
  return state;
}

app.whenReady().then(async () => {
  try {
    console.log('Weather smoke: Electron ready.');
    installPermissionPolicy();
    window = createWindow();
    window.webContents.setBackgroundThrottling(false);
    await loaded();
    await delay(4000);
    console.log('Weather smoke: rain page loaded.');
    const rain = await checkPage('rain', 'www.rain-alarm.com');
    const next = loaded();
    await window.webContents.executeJavaScript("document.getElementById('rain-alarm-switcher').shadowRoot.querySelector('[data-site=severe]').click()");
    await next;
    await delay(4000);
    window.setContentSize(820, 620);
    console.log('Weather smoke: severe-weather page loaded.');
    const severe = await checkPage('severe', 'www.unwx.app');
    window.destroy();
    window = createWindow();
    window.webContents.setBackgroundThrottling(false);
    await loaded();
    await delay(1000);
    assert.equal(new URL(window.webContents.getURL()).hostname, 'www.unwx.app', 'Reopen must restore Severe weather.');
    const back = loaded();
    await window.webContents.executeJavaScript("document.getElementById('rain-alarm-switcher').shadowRoot.querySelector('[data-site=rain]').click()");
    await back;
    await delay(1000);
    await checkPage('rain', 'www.rain-alarm.com');
    console.log('RAIN_SWITCHER_SMOKE_OK ' + JSON.stringify({ rain, severe, restored: true, roundTrip: true }));
    clearTimeout(deadline);
    window.destroy();
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(deadline);
    if (window && !window.isDestroyed()) window.destroy();
    app.exit(1);
  }
});
