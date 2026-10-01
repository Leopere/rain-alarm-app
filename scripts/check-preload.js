const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');

function context({ native, fetch }) {
  const storage = new Map();

  class FakeElement {}

  const window = {
    addEventListener() {},
    Notification: { requestPermission: () => Promise.resolve('default') },
    location: { reload() {} },
  };

  const navigator = {
    geolocation: native,
    permissions: { query: async () => ({ state: 'prompt' }) },
  };

  return {
    AbortController,
    Element: FakeElement,
    Map,
    MouseEvent: function MouseEvent() {},
    MutationObserver: class MutationObserver { observe() {} },
    Number,
    Promise,
    Set,
    URL,
    WeakSet,
    clearInterval,
    clearTimeout,
    console,
    document: {
      readyState: 'complete',
      addEventListener() {},
      body: {},
      contains: () => false,
      documentElement: {},
      getElementById: () => null,
      querySelectorAll: () => [],
    },
    fetch,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    location: { origin: 'https://www.rain-alarm.com' },
    navigator,
    queueMicrotask: (callback) => callback(),
    setInterval: () => 1,
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    window,
  };
}

async function main() {
  let nativeCalls = 0;
  let networkCalls = 0;
  let lastOptions;
  const nativeFirst = context({
    native: {
      getCurrentPosition(success, _error, options) {
        nativeCalls += 1;
        lastOptions = options;
        success({ coords: { latitude: 43.64, longitude: -79.39, accuracy: 12 }, timestamp: 1 });
      },
    },
    fetch: async () => {
      networkCalls += 1;
      throw new Error('Network fallback should not run');
    },
  });

  vm.runInNewContext(preload, nativeFirst);
  const permission = await nativeFirst.navigator.permissions.query({ name: 'geolocation' });
  assert.equal(permission.state, 'prompt');
  assert.equal(networkCalls, 0);
  assert(nativeCalls > 0);
  assert.equal(lastOptions.timeout, 30000);

  let fallbackPosition;
  const fallback = context({
    native: {
      getCurrentPosition(_success, error) {
        error(new Error('native unavailable'));
      },
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({ success: true, latitude: 44, longitude: -80 }),
    }),
  });

  vm.runInNewContext(preload, fallback);
  await new Promise((resolve, reject) => {
    fallback.navigator.geolocation.getCurrentPosition(
      (position) => {
        fallbackPosition = position;
        resolve();
      },
      reject,
    );
  });
  assert.equal(fallbackPosition.coords.latitude, 44);
  assert.equal(fallbackPosition.coords.longitude, -80);

  console.log('Preload geolocation checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
