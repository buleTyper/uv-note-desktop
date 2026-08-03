const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (p) => ipcRenderer.invoke('read-directory', p),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  saveFile: (p, c) => ipcRenderer.invoke('save-file', p, c),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  setAppConfig: (c) => ipcRenderer.invoke('set-app-config', c),
})
