const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createWindow, installPermissionPolicy, MAPS, isMapUrl } = require('../src/main');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rain-switcher-live-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
const deadline = setTimeout(() => { console.error('Live map smoke timed out.'); app.exit(1); }, 90000);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check) {
  const end = Date.now() + 14000;
  while (Date.now() < end) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error('Expected live map state did not appear');
}

app.whenReady().then(async () => {
  installPermissionPolicy();
  let window = createWindow();
  await until(() => window.webContents.executeJavaScript('document.getElementById("map")?.disabled === false'));
  const results = [];
  for (const map of MAPS) {
    await window.webContents.executeJavaScript(`document.getElementById('map').value = ${JSON.stringify(map.id)}; document.getElementById('map').dispatchEvent(new Event('change'));`);
    await until(() => window.getTitle() === `${map.name} — Rain Alarm` && window.contentView.children.at(-1).webContents.getURL() !== '');
    const contents = window.contentView.children.at(-1).webContents;
    await until(() => !contents.isLoading());
    assert(isMapUrl(map, contents.getURL()), 'Live provider must stay on its own site');
    await until(() => contents.executeJavaScript('document.body?.innerText.length > 20'));
    const page = await contents.executeJavaScript('({ title: document.title, map: !!document.querySelector(".leaflet-container,canvas,.ol-viewport"), setup: /Privacy Policy|location/i.test(document.body.innerText) })');
    assert(page.title.length > 0);
    // Some providers require their own first-run consent before drawing the map.
    results.push({ id: map.id, ...page });
    console.log('Live provider loaded:', map.id, page.title);
  }
  window.destroy();
  window = createWindow();
  await until(() => window.webContents.executeJavaScript('document.getElementById("map")?.disabled === false'));
  assert.equal(await window.webContents.executeJavaScript('document.getElementById("map").value'), MAPS.at(-1).id);
  window.destroy();
  clearTimeout(deadline);
  console.log('RAIN_SWITCHER_SMOKE_OK ' + JSON.stringify({ maps: results, restored: true }));
  app.quit();
}).catch((error) => {
  console.error(error);
  clearTimeout(deadline);
  app.exit(1);
});
app.on('will-quit', () => fs.rmSync(profile, { recursive: true, force: true }));
