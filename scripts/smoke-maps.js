const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, protocol, shell } = require('electron');
const { createWindow, installPermissionPolicy, MAPS, isMapUrl } = require('../src/main');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rain-alarm-maps-'));
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
const external = [];
shell.openExternal = async (url) => { external.push(url); };
let fail = false;
let loads = 0;
const deadline = setTimeout(() => { console.error('Map smoke test timed out'); app.exit(1); }, 45000);

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
    return new Response('<!doctype html><title>Map fixture</title><h1>Interactive map fixture</h1>', { headers: { 'content-type': 'text/html' } });
  });
  const window = createWindow();
  const errors = [];
  const run = (code) => window.webContents.executeJavaScript(code).catch((error) => {
    console.error('Failed renderer check:', code, errors);
    throw error;
  });
  window.webContents.on('console-message', (event) => { if (event.level === 'error') errors.push(event.message); });
  await until(() => run('document.getElementById("map")?.disabled === false'));
  assert.equal(await run('document.querySelectorAll("option").length'), MAPS.length);
  assert.equal(await run('document.getElementById("map").value'), 'rain');
  for (const map of MAPS) {
    assert(isMapUrl(map, map.url));
    for (const url of ['http://example.com', 'file:///tmp/map', 'javascript:alert(1)', map.url.replace('https://', 'https://evil.example/?')]) assert(!isMapUrl(map, url));
    await run(`document.getElementById('map').value = ${JSON.stringify(map.id)}; document.getElementById('map').dispatchEvent(new Event('change'));`);
    await until(() => run(`document.getElementById('status').textContent === 'Map loaded' && document.getElementById('description').textContent === ${JSON.stringify(map.description)}`));
    const view = window.contentView.children.at(-1);
    assert.equal(view.webContents.getURL(), map.url);
    assert.equal(await view.webContents.executeJavaScript('typeof window.maps'), 'undefined');
    assert.equal(await view.webContents.executeJavaScript('typeof require'), 'undefined');
    assert.equal(window.getTitle(), `${map.name} — Rain Alarm`);
    const bounds = view.getBounds();
    assert.equal(bounds.y, 112);
    assert.equal(bounds.width, window.getContentSize()[0]);
    const beforeUrl = view.webContents.getURL();
    const viewCount = window.contentView.children.length;
    const navigation = new Promise((resolve) => view.webContents.once('will-navigate', resolve));
    await view.webContents.executeJavaScript("const link = document.createElement('a'); link.href = 'https://outside.example/'; document.body.append(link); link.click();", true);
    await navigation;
    assert.equal(view.webContents.getURL(), beforeUrl, 'Outside navigation must stay blocked');
    await view.webContents.executeJavaScript("window.open('https://outside.example/', '_blank')", true);
    const detail = new URL('/fixture-detail', map.url).href;
    await view.webContents.executeJavaScript(`window.open(${JSON.stringify(detail)}, '_blank')`, true);
    await until(() => view.webContents.getURL() === detail && !view.webContents.isLoading());
    assert.equal(window.contentView.children.length, viewCount, 'Allowed links must reuse the same view');
  }
  const view = window.contentView.children.at(-1);
  await view.webContents.executeJavaScript('window.retainedMapState = 42');
  await run("(async () => { await window.maps.select('rain'); await window.maps.select('lightning'); })()");
  assert.equal(await view.webContents.executeJavaScript('window.retainedMapState'), 42);
  assert.equal(await run("window.maps.select('invalid').then(() => false, () => true)"), true);
  assert.equal(await run("document.getElementById('open')"), null);
  assert.equal(external.length, 0, 'Map links must never launch an external application');
  fail = true;
  await run("document.getElementById('reload').click()");
  await until(() => run('document.getElementById("status").dataset.phase === "error"'));
  fail = false;
  const before = loads;
  await run("document.getElementById('reload').click()");
  await until(() => run('document.getElementById("status").textContent === "Map loaded"'));
  assert(loads > before);
  window.setContentSize(620, 480);
  await until(() => view.getBounds().width === 620);
  const overflow = await run('document.querySelector(".controls").scrollWidth > document.querySelector(".controls").clientWidth');
  assert.equal(overflow, false, 'Toolbar must fit the minimum window width');
  fs.writeFileSync(path.join(os.tmpdir(), 'rain-alarm-switcher.png'), (await window.capturePage()).toPNG());
  const contents = window.contentView.children.map((child) => child.webContents);
  window.destroy();
  await until(() => contents.every((item) => item.isDestroyed()));
  const reopened = createWindow();
  await until(() => reopened.webContents.executeJavaScript('document.getElementById("map")?.disabled === false'));
  assert.equal(await reopened.webContents.executeJavaScript('document.getElementById("map").value'), 'lightning');
  reopened.destroy();
  assert.equal(errors.length, 0, errors.join('\n'));
  clearTimeout(deadline);
  console.log(`PASS: ${MAPS.length} maps, switching, retained state, saved selection, isolation, blocked external links, same-view links, error/retry, minimum width, renderer cleanup`);
  app.quit();
}).catch((error) => {
  console.error(error);
  clearTimeout(deadline);
  app.exit(1);
});

app.on('will-quit', () => fs.rmSync(profile, { recursive: true, force: true }));
