const SITES = {
  rain: { label: 'Rain radar', url: 'https://www.rain-alarm.com/' },
  severe: { label: 'Severe weather', url: 'https://www.unwx.app/pwa/' },
};

function siteForUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
    if (['www.rain-alarm.com', 'rain-alarm.com', 'app.rain-alarm.com'].includes(url.hostname)) return 'rain';
    if (['www.unwx.app', 'unwx.app'].includes(url.hostname)) return 'severe';
  } catch { /* Invalid URLs are never app navigation. */ }
  return null;
}

function permissionAllowed(origin, permission) {
  const site = siteForUrl(origin);
  return site === 'rain' || (site === 'severe' && ['geolocation', 'notifications', 'fullscreen', 'clipboard-sanitized-write'].includes(permission));
}

module.exports = { SITES, siteForUrl, permissionAllowed };
