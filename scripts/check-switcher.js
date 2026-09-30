const assert = require('node:assert/strict');
const { SITES, siteForUrl, permissionAllowed } = require('../src/weather-sites');

for (const [site, { url }] of Object.entries(SITES)) assert.equal(siteForUrl(url), site);
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
console.log('Weather navigation and permission checks passed.');
