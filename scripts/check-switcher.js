const assert = require('node:assert/strict');
const { SITES, siteForUrl, permissionAllowed } = require('../src/weather-sites');

for (const [site, { url, provider }] of Object.entries(SITES)) assert.equal(siteForUrl(url), provider || site);
assert.equal(siteForUrl('https://rain-alarm.com/map'), 'rain');
assert.equal(siteForUrl('https://unwx.app/pwa/'), 'severe');
for (const url of ['http://www.unwx.app/pwa/', 'https://www.unwx.app.evil.test/',
  'https://www.unwx.app:444/', 'https://evil@www.unwx.app/', 'file:///tmp/map', 'invalid']) {
  assert.equal(siteForUrl(url), null, url);
  assert.equal(permissionAllowed(url, 'geolocation'), false, url);
}
assert.equal(permissionAllowed(SITES.severe.url, 'geolocation'), true);
assert.equal(permissionAllowed(SITES.severe.url, 'notifications'), true);
assert.equal(permissionAllowed(SITES.severe.url, 'media'), false);
assert.equal(permissionAllowed(SITES.severe.url, 'display-capture'), false);
assert.equal(permissionAllowed(SITES.rain.url, 'geolocation'), true);
for (const site of ['earthWind', 'earthTemp', 'earthOcean']) {
  assert.equal(siteForUrl(SITES[site].url), 'earth');
  assert.equal(permissionAllowed(SITES[site].url, 'notifications'), false);
}
assert.equal(siteForUrl('https://earth.nullschool.net.evil.test/'), null);
console.log('Weather navigation and permission checks passed.');
