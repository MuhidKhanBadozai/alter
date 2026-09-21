const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  searchYoutube: (query) => ipcRenderer.invoke('search-youtube', query),
  recommendYoutube: (query) => ipcRenderer.invoke('recommend-youtube', query),
  getStreamBaseUrl: () => 'http://127.0.0.1:47891',

  // Version Control & Auto-Updater API
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUpdateConfig: () => ipcRenderer.invoke('get-update-config'),
  setUpdateConfig: (config) => ipcRenderer.invoke('set-update-config', config),
  checkForUpdates: (customRepo) => ipcRenderer.invoke('check-for-updates', customRepo),
  startDownloadUpdate: () => ipcRenderer.invoke('start-download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  onDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateError: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },
});
