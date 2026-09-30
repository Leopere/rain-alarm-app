const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('maps', {
  list: () => ipcRenderer.invoke('maps:list'),
  select: (id) => ipcRenderer.invoke('maps:select', id),
  reload: () => ipcRenderer.invoke('maps:reload'),
  open: () => ipcRenderer.invoke('maps:open'),
  onStatus: (callback) => ipcRenderer.on('maps:status', (_event, value) => callback(value)),
});
