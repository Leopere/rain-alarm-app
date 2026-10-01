const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, protocol, shell, Menu, BrowserWindow } = require('electron');
const { createWindow, installPermissionPolicy, MAPS, isMapUrl, selectedSite } = require('../src/main');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rain-alarm-maps-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
const external = [];
shell.openExternal = async (url) => { external.push(url); };
let fail = false;
let loads = 0;
const deadline = setTimeout(() => { console.error('Map smoke test timed out'); app.exit(1); }, 45000);
const choose = (id) => Menu.getApplicationMenu().getMenuItemById(id).click();
const active = (window) => window.contentView.children.at(-1);
async function until(check) {
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error('Expected map state did not appear');
}
app.whenReady().then(async () => {
  installPermissionPolicy();
  protocol.handle('https', () => {
    loads += 1;
    if (fail) throw new Error('Simulated offline map');
    return new Response('<!doctype html><title>Map fixture</title><h1>Interactive map fixture</h1><div class="earth-bar">Menu</div><div id="menu">Settings</div><div class="cta-bar">Get the app</div><div class="plans">Plans</div><div class="plansplus">Plans Plus</div><div class="premium-banner">Premium</div><div class="adsbygoogle">Ad</div><div class="attribution">Nullschool Technologies</div>', { headers: { 'content-type': 'text/html' } });
  });
  let window = createWindow();
  assert.equal(selectedSite(), 'rain');
  for (const map of MAPS) {
    assert(isMapUrl(map, map.url));
    for (const url of ['http://example.com', 'file:///tmp/map', 'javascript:alert(1)', map.url.replace('https://', 'https://evil.example/?')]) assert(!isMapUrl(map, url));
    choose(map.id);
    const view = active(window);
    await until(() => !view.webContents.isLoading() && window.getTitle() === `${map.name} — Rain Alarm`);
    assert.equal(view.webContents.getURL(), map.url);
    assert.equal(await view.webContents.executeJavaScript('typeof window.maps'), 'undefined');
    assert.equal(await view.webContents.executeJavaScript('typeof require'), 'undefined');
    assert.equal(Menu.getApplicationMenu().getMenuItemById(map.id).checked, true);
    assert.equal(selectedSite(), map.id);
    assert.equal(view.getBounds().y, 0, 'Maps must fill the window without a toolbar');
    assert.equal(view.getBounds().height, window.getContentSize()[1]);
    await until(() => view.webContents.executeJavaScript('getComputedStyle(document.querySelector(".plansplus")).display === "none"'));
    assert.equal(await view.webContents.executeJavaScript('getComputedStyle(document.querySelector(".plans")).display'), 'none');
    assert.equal(await view.webContents.executeJavaScript('getComputedStyle(document.querySelector(".premium-banner")).display'), 'none');
    assert.equal(await view.webContents.executeJavaScript('getComputedStyle(document.querySelector(".adsbygoogle")).display'), 'none');
    if (map.provider === 'earth') {
      await until(() => view.webContents.executeJavaScript('getComputedStyle(document.getElementById("menu")).display === "none"'));
      assert.equal(await view.webContents.executeJavaScript('getComputedStyle(document.querySelector(".cta-bar")).display'), 'none');
      assert.notEqual(await view.webContents.executeJavaScript('getComputedStyle(document.querySelector(".attribution")).display'), 'none');
    }
    const beforeUrl = view.webContents.getURL();
    const navigation = new Promise((resolve) => view.webContents.once('will-navigate', resolve));
    await view.webContents.executeJavaScript("const link = document.createElement('a'); link.href = 'https://outside.example/'; document.body.append(link); link.click();", true);
    await navigation;
    assert.equal(view.webContents.getURL(), beforeUrl);
    await view.webContents.executeJavaScript("window.open('https://outside.example/', '_blank')", true);
    const detail = new URL('/fixture-detail', map.url).href;
    await view.webContents.executeJavaScript(`window.open(${JSON.stringify(detail)}, '_blank')`, true);
    await until(() => view.webContents.getURL() === detail && !view.webContents.isLoading());
    assert.equal(BrowserWindow.getAllWindows().length, 1, 'Links must reuse the same window');
  }
  const last = MAPS.at(-1);
  const view = active(window);
  await view.webContents.executeJavaScript('window.retainedMapState = 42');
  choose('rain'); choose(last.id);
  assert.equal(await view.webContents.executeJavaScript('window.retainedMapState'), 42);
  assert.equal(external.length, 0, 'Maps must not launch external applications');
  fail = true; choose('reload-map');
  await until(() => window.getTitle().includes('Unavailable'));
  await until(() => !view.webContents.isLoading());
  choose('rain'); choose(last.id);
  assert(window.getTitle().includes('Unavailable'), 'Failed maps must retain their error state when switched back');
  fail = false;
  const before = loads;
  choose('reload-map');
  await until(() => !view.webContents.isLoading());
  assert.equal(window.getTitle(), `${last.name} — Rain Alarm`);
  assert(loads > before);
  window.setContentSize(620, 480);
  await until(() => view.getBounds().width === 620);
  assert.equal(view.getBounds().height, 480);
  const renderers = [view.webContents];
  window.destroy();
  await until(() => renderers.every((item) => item.isDestroyed()));
  window = createWindow();
  assert.equal(selectedSite(), last.id);
  await until(() => active(window).webContents.getURL() === last.url);
  window.destroy();
  clearTimeout(deadline);
  console.log(`PASS: ${MAPS.length} menu presets, full-window maps, retained state, saved selection, isolation, blocked external links, same-window links, Earth cleanup, error/retry, resize, renderer cleanup`);
  app.quit();
}).catch((error) => { console.error(error); clearTimeout(deadline); app.exit(1); });
app.on('will-quit', () => fs.rmSync(profile, { recursive: true, force: true }));
