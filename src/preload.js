(() => {
  const GEO_CACHE_KEY = 'rainAlarm.geolocationFallback';
  const GEO_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const GEO_WATCH_INTERVAL_MS = 5 * 60 * 1000;
  const REFRESH_REQUEST_COOLDOWN_MS = 60 * 1000;
  const geoWatchers = new Map();
  let nextGeoWatchId = 1;
  let lastRefreshRequestHandled = 0;

  const POSITIVE_TEXT = /\b(ok|yes|allow|accept|agree|continue|enable|turn on|got it|done|start|use location|locate me|save)\b/i;
  const DISMISS_TEXT = /\b(close|dismiss|skip|later|not now)\b/i;
  const NEGATIVE_TEXT = /\b(cancel|deny|decline|reject|disallow|no)\b/i;
  const REFRESH_REQUEST_TEXT = /\b(refresh|reload|restart|new version|out of date|too old|timed out|timeout|update required)\b/i;
  const DIALOG_SELECTOR = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[class*="dialog" i]',
    '[class*="modal" i]',
    '[class*="popup" i]',
    '[class*="prompt" i]',
    '[class*="overlay" i]',
    '[class*="toast" i]',
    '[class*="alert" i]',
    '[class*="permission" i]',
    '[id*="dialog" i]',
    '[id*="modal" i]',
    '[id*="popup" i]',
    '[id*="prompt" i]',
    '[id*="permission" i]',
  ].join(',');
  const BUTTON_SELECTOR = [
    'button',
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
    'a[href]',
    '[tabindex]',
  ].join(',');
  const clicked = new WeakSet();

  function setValue(object, property, value) {
    try {
      Object.defineProperty(object, property, {
        configurable: true,
        writable: true,
        value,
      });
    } catch {
      try {
        object[property] = value;
      } catch {
        // Some browser properties are intentionally not writable.
      }
    }
  }

  function coordsFromProvider(name, data) {
    if (name === 'ipwhois' && data?.success && Number.isFinite(Number(data.latitude)) && Number.isFinite(Number(data.longitude))) {
      return {
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        accuracy: 30000,
        source: 'ipwhois',
      };
    }

    if (name === 'ipinfo' && typeof data?.loc === 'string') {
      const [latitude, longitude] = data.loc.split(',').map(Number);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return {
          latitude,
          longitude,
          accuracy: 50000,
          source: 'ipinfo',
        };
      }
    }

    if (name === 'geojs' && Number.isFinite(Number(data?.latitude)) && Number.isFinite(Number(data?.longitude))) {
      return {
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        accuracy: Number.isFinite(Number(data.accuracy)) ? Math.max(Number(data.accuracy), 10000) : 50000,
        source: 'geojs',
      };
    }

    return null;
  }

  function browserPositionFromCoords(coords) {
    return {
      coords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };
  }

  function readCachedPosition(allowStale = false) {
    try {
      const cached = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || 'null');
      if (!cached || !Number.isFinite(cached.latitude) || !Number.isFinite(cached.longitude)) {
        return null;
      }

      if (!allowStale && Date.now() - cached.timestamp > GEO_CACHE_MAX_AGE_MS) {
        return null;
      }

      return cached;
    } catch {
      return null;
    }
  }

  function writeCachedPosition(coords) {
    try {
      localStorage.setItem(
        GEO_CACHE_KEY,
        JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          source: coords.source,
          timestamp: Date.now(),
        }),
      );
    } catch {
      // localStorage can be unavailable during very early page startup.
    }
  }

  async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Location provider returned ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function locateByNetwork() {
    const cached = readCachedPosition(false);
    if (cached) {
      return cached;
    }

    const providers = [
      ['ipwhois', 'https://ipwho.is/'],
      ['ipinfo', 'https://ipinfo.io/json'],
      ['geojs', 'https://get.geojs.io/v1/ip/geo.json'],
    ];

    for (const [name, url] of providers) {
      try {
        const coords = coordsFromProvider(name, await fetchJsonWithTimeout(url));
        if (coords) {
          writeCachedPosition(coords);
          return coords;
        }
      } catch {
        // Try the next no-key provider.
      }
    }

    const stale = readCachedPosition(true);
    if (stale) {
      return stale;
    }

    throw new Error('No app-provided geolocation source is available.');
  }

  function installGeolocationFallback() {
    const geolocation = {
      getCurrentPosition(success, error) {
        locateByNetwork()
          .then((coords) => {
            if (typeof success === 'function') {
              success(browserPositionFromCoords(coords));
            }
          })
          .catch((reason) => {
            if (typeof error === 'function') {
              error({
                code: 2,
                message: reason?.message || 'Position unavailable.',
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              });
            }
          });
      },

      watchPosition(success, error) {
        const id = nextGeoWatchId;
        nextGeoWatchId += 1;

        geolocation.getCurrentPosition(success, error);
        geoWatchers.set(
          id,
          setInterval(() => {
            geolocation.getCurrentPosition(success, error);
          }, GEO_WATCH_INTERVAL_MS),
        );

        return id;
      },

      clearWatch(id) {
        const timer = geoWatchers.get(id);
        if (!timer) {
          return;
        }

        clearInterval(timer);
        geoWatchers.delete(id);
      },
    };

    try {
      Object.defineProperty(Navigator.prototype, 'geolocation', {
        configurable: true,
        get: () => geolocation,
      });
    } catch {
      setValue(navigator, 'geolocation', geolocation);
    }
  }

  function installBrowserPromptBypass() {
    setValue(window, 'alert', () => undefined);
    setValue(window, 'confirm', () => true);
    setValue(window, 'prompt', (_message, defaultValue = '') => defaultValue);
    setValue(window, 'onbeforeunload', null);

    window.addEventListener(
      'beforeunload',
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        delete event.returnValue;
      },
      true,
    );

    if (window.Notification?.requestPermission) {
      setValue(window.Notification, 'requestPermission', (callback) => {
        const result = 'granted';
        if (typeof callback === 'function') {
          queueMicrotask(() => callback(result));
        }
        return Promise.resolve(result);
      });
    }

    const originalPermissionsQuery = navigator.permissions?.query?.bind(navigator.permissions);
    if (originalPermissionsQuery) {
      setValue(navigator.permissions, 'query', (descriptor) => {
        const granted = new Set([
          'clipboard-read',
          'clipboard-write',
          'geolocation',
          'notifications',
          'persistent-storage',
          'push',
          'screen-wake-lock',
        ]);

        if (granted.has(descriptor?.name)) {
          return Promise.resolve({
            state: 'granted',
            onchange: null,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => false,
          });
        }

        return originalPermissionsQuery(descriptor);
      });
    }
  }

  function textFor(element) {
    return [
      element.innerText,
      element.textContent,
      element.value,
      element.title,
      element.ariaLabel,
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('data-label'),
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function dialogAncestor(element) {
    return element.closest?.(DIALOG_SELECTOR);
  }

  function candidateScore(element) {
    const label = textFor(element);
    const inDialog = Boolean(dialogAncestor(element));

    if (!inDialog && !POSITIVE_TEXT.test(label)) {
      return 0;
    }

    if (NEGATIVE_TEXT.test(label)) {
      return 0;
    }

    if (POSITIVE_TEXT.test(label)) {
      return 100;
    }

    if (inDialog && DISMISS_TEXT.test(label)) {
      return 50;
    }

    return inDialog ? 10 : 0;
  }

  function clickNextDialogAction() {
    const candidates = Array.from(document.querySelectorAll(BUTTON_SELECTOR))
      .filter((element) => !clicked.has(element) && isVisible(element))
      .map((element) => ({ element, score: candidateScore(element) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    const selected = candidates[0]?.element;
    if (!selected) {
      return;
    }

    clicked.add(selected);
    selected.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    selected.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    selected.click();
    selected.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  function clickElement(element) {
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.click();
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }

  function handleRefreshRequest(reason, actionElement = null) {
    const now = Date.now();
    if (now - lastRefreshRequestHandled < REFRESH_REQUEST_COOLDOWN_MS) {
      return;
    }

    lastRefreshRequestHandled = now;

    try {
      console.info(`[Rain Alarm wrapper] Refresh requested by ${reason}`);
    } catch {
      // Console logging is best-effort only.
    }

    if (actionElement && isVisible(actionElement)) {
      clickElement(actionElement);
      setTimeout(() => {
        if (document.contains(actionElement) && isVisible(actionElement)) {
          window.location.reload();
        }
      }, 750);
      return;
    }

    window.location.reload();
  }

  function refreshActionFor(container) {
    const candidates = Array.from(container.querySelectorAll(BUTTON_SELECTOR))
      .filter((element) => isVisible(element))
      .map((element) => ({
        element,
        label: textFor(element),
      }));

    return (
      candidates.find((candidate) => REFRESH_REQUEST_TEXT.test(candidate.label) && !NEGATIVE_TEXT.test(candidate.label))?.element ||
      candidates.find((candidate) => POSITIVE_TEXT.test(candidate.label) && !NEGATIVE_TEXT.test(candidate.label))?.element ||
      null
    );
  }

  function handleRainAlarmRefreshTimeout() {
    const refreshTimeout = document.getElementById('refresh-timeout');
    if (refreshTimeout && isVisible(refreshTimeout)) {
      handleRefreshRequest('refresh-timeout UI', refreshTimeout);
    }
  }

  function handleRefreshDialogText() {
    const dialogs = Array.from(document.querySelectorAll(DIALOG_SELECTOR)).filter(isVisible);

    for (const dialog of dialogs) {
      const label = textFor(dialog);
      if (!REFRESH_REQUEST_TEXT.test(label)) {
        continue;
      }

      handleRefreshRequest('refresh dialog text', refreshActionFor(dialog));
      break;
    }
  }

  function handleRefreshRequests() {
    handleRainAlarmRefreshTimeout();
    handleRefreshDialogText();
  }

  function installDialogAutoClicker() {
    const scheduleClick = () => {
      setTimeout(clickNextDialogAction, 50);
      setTimeout(clickNextDialogAction, 250);
      setTimeout(clickNextDialogAction, 750);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleClick, { once: true });
    } else {
      scheduleClick();
    }

    window.addEventListener('load', scheduleClick, { once: true });

    const observe = () => {
      const root = document.documentElement || document.body;
      if (!root) {
        setTimeout(observe, 20);
        return;
      }

      new MutationObserver(scheduleClick).observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'open'],
      });
    };

    observe();
  }

  function installRefreshRequestWatcher() {
    const scheduleRefreshCheck = () => {
      setTimeout(handleRefreshRequests, 50);
      setTimeout(handleRefreshRequests, 250);
      setTimeout(handleRefreshRequests, 1000);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleRefreshCheck, { once: true });
    } else {
      scheduleRefreshCheck();
    }

    window.addEventListener('load', scheduleRefreshCheck, { once: true });

    const observe = () => {
      const root = document.documentElement || document.body;
      if (!root) {
        setTimeout(observe, 20);
        return;
      }

      new MutationObserver(scheduleRefreshCheck).observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'open', 'src'],
      });
    };

    observe();
  }

  function installWeatherSwitcher() {
    if (window.top !== window || document.getElementById('rain-alarm-switcher')) return;
    const severe = ['www.unwx.app', 'unwx.app'].includes(location.hostname);
    const host = document.createElement('div');
    host.id = 'rain-alarm-switcher';
    // A shadow root keeps site CSS and the dialog auto-clicker away from these links.
    host.style.cssText = 'position:fixed!important;bottom:44px!important;left:50%!important;transform:translateX(-50%)!important;z-index:2147483647!important;display:block!important;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { color-scheme: light dark; }
        nav { display:flex; gap:4px; padding:5px; border:1px solid #ffffff30;
          border-radius:16px; background:#172132ed; box-shadow:0 5px 24px #08142638;
          backdrop-filter:blur(20px); font:600 13px/1.2 -apple-system,BlinkMacSystemFont,sans-serif; }
        a { display:flex; align-items:center; gap:8px; padding:11px 15px; color:#d8e2ef;
          text-decoration:none; border-radius:11px; white-space:nowrap; transition:background .15s; }
        a:hover { background:#ffffff15; }
        a[aria-current="page"] { background:#e9f2ff; color:#163552; box-shadow:0 1px 5px #0002; }
        a[data-site="severe"][aria-current="page"] { background:#fff0d8; color:#68470f; }
        a:focus-visible { outline:3px solid #69b9ff; outline-offset:2px; }
        svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.7;
          stroke-linecap:round; stroke-linejoin:round; }
        @media (prefers-reduced-motion:reduce) { a { transition:none; } }
      </style>
      <nav aria-label="Weather views">
        <a data-site="rain" href="https://www.rain-alarm.com/" title="Rain radar · ⌘1" ${!severe ? 'aria-current="page"' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15a4 4 0 0 1-1-8 6 6 0 0 1 11-1 4.5 4.5 0 0 1 1 9"/><path d="m8 18-1 3m6-3-1 3m6-3-1 3"/></svg>
          Rain radar
        </a>
        <a data-site="severe" href="https://www.unwx.app/pwa/" title="UnWX severe-weather warnings · ⌘2" ${severe ? 'aria-current="page"' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 4a2 2 0 0 1 3.4 0l8 14a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3Z"/><path d="M12 9v5m0 3h.01"/></svg>
          Severe weather
        </a>
      </nav>`;
    root.addEventListener('click', (event) => event.stopPropagation());
    document.body.append(host);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWeatherSwitcher, { once: true });
  } else {
    installWeatherSwitcher();
  }
  installBrowserPromptBypass();
  installGeolocationFallback();
  installDialogAutoClicker();
  installRefreshRequestWatcher();
})();
