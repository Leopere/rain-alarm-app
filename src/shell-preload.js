const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('maps', {
  list: () => ipcRenderer.invoke('maps:list'),
  select: (id) => ipcRenderer.invoke('maps:select', id),
  reload: () => ipcRenderer.invoke('maps:reload'),
  onStatus: (callback) => ipcRenderer.on('maps:status', (_event, value) => callback(value)),
});
