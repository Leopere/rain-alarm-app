const picker = document.getElementById('map');
const description = document.getElementById('description');
const status = document.getElementById('status');
const reload = document.getElementById('reload');

function showStatus(value) {
  if (!value || value.id !== picker.value) return;
  status.dataset.phase = value.phase;
  status.textContent = value.phase === 'error' ? value.message : value.phase === 'loading' ? 'Loading map…' : 'Map loaded';
}

window.maps.onStatus(showStatus);
window.maps.list().then(async (catalog) => {
  for (const map of catalog) picker.add(new Option(map.name, map.id));
  let saved;
  try { saved = localStorage.getItem('selectedMap'); } catch { /* Use Rain Alarm when storage is unavailable. */ }
  picker.value = catalog.some((map) => map.id === saved) ? saved : 'rain';
  async function select() {
    description.textContent = catalog.find((map) => map.id === picker.value).description;
    try {
      showStatus(await window.maps.select(picker.value));
      try { localStorage.setItem('selectedMap', picker.value); } catch { /* Selection still works without storage. */ }
    } catch {
      showStatus({ id: picker.value, phase: 'error', message: 'Could not switch maps. Please restart the app.' });
    }
  }
  picker.addEventListener('change', select);
  reload.addEventListener('click', () => window.maps.reload());
  await select();
  picker.disabled = reload.disabled = false;
}).catch(() => {
  status.dataset.phase = 'error';
  status.textContent = 'Could not start the map switcher. Please restart the app.';
});
