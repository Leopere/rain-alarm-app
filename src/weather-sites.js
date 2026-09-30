const SITES = {
  rain: { label: 'Rain Alarm', url: 'https://www.rain-alarm.com/', description: 'Live rain radar and approaching-rain alerts.' },
  severe: { label: 'UnWX', url: 'https://www.unwx.app/pwa/', description: 'Rain Alarm’s sister site for official severe-weather warnings.' },
  canada: { label: 'Environment Canada', url: 'https://weather.gc.ca/?layers=radar', description: 'Canadian radar and official weather alerts.' },
  windy: { label: 'Windy', url: 'https://www.windy.com/', description: 'Wind, rain, temperature, and forecast models.' },
  lightning: { label: 'LightningMaps', url: 'https://www.lightningmaps.org/', description: 'Real-time lightning activity.' },
};

function siteForUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return null;
    if (['www.rain-alarm.com', 'rain-alarm.com', 'app.rain-alarm.com'].includes(url.hostname)) return 'rain';
    if (['www.unwx.app', 'unwx.app'].includes(url.hostname)) return 'severe';
    for (const [site, { url: home }] of Object.entries(SITES)) {
      if (url.origin === new URL(home).origin) return site;
    }
  } catch { /* Invalid URLs are never app navigation. */ }
  return null;
}

function permissionAllowed(origin, permission) {
  const site = siteForUrl(origin);
  return site === 'rain' || (site === 'severe' && ['geolocation', 'notifications', 'fullscreen', 'clipboard-sanitized-write'].includes(permission)) || (site !== null && permission === 'geolocation');
}

module.exports = { SITES, siteForUrl, permissionAllowed };
