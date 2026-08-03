const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (p) => ipcRenderer.invoke('read-directory', p),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  saveFile: (p, c) => ipcRenderer.invoke('save-file', p, c),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  setAppConfig: (c) => ipcRenderer.invoke('set-app-config', c),

  // 窗口控制（无边框自定义标题栏用）
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // 窗口最大化状态变化监听
  onWindowMaximizeChange: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized)
    ipcRenderer.on('window-maximized', handler)
    // 返回取消监听的函数
    return () => ipcRenderer.removeListener('window-maximized', handler)
  },
})
