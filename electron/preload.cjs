const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (p) => ipcRenderer.invoke('read-directory', p),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  saveFile: (p, c) => ipcRenderer.invoke('save-file', p, c),
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  setAppConfig: (c) => ipcRenderer.invoke('set-app-config', c),

  // 剪贴板图片保存
  saveClipboardImage: (workspacePath, base64Data) =>
    ipcRenderer.invoke('save-clipboard-image', workspacePath, base64Data),

  // 标签系统
  tagsScanWorkspace: (workspacePath) =>
    ipcRenderer.invoke('tags-scan-workspace', workspacePath),
  tagsReadIndex: (workspacePath) =>
    ipcRenderer.invoke('tags-read-index', workspacePath),
  tagsPatchFile: (workspacePath, relativePath, content) =>
    ipcRenderer.invoke('tags-patch-file', workspacePath, relativePath, content),
  tagsRemoveFile: (workspacePath, relativePath) =>
    ipcRenderer.invoke('tags-remove-file', workspacePath, relativePath),
  tagsReadSchema: (workspacePath) =>
    ipcRenderer.invoke('tags-read-schema', workspacePath),
  tagsSaveSchema: (workspacePath, schema) =>
    ipcRenderer.invoke('tags-save-schema', workspacePath, schema),
  tagsReadTreeTxt: (workspacePath) =>
    ipcRenderer.invoke('tags-read-tree-txt', workspacePath),
  tagsSaveTreeTxt: (workspacePath, text) =>
    ipcRenderer.invoke('tags-save-tree-txt', workspacePath, text),
  tagsStopWatch: (workspacePath) =>
    ipcRenderer.invoke('tags-stop-watch', workspacePath),

  // 文件变更监听
  onFileChanged: (callback) => {
    const handler = (_event, info) => callback(info)
    ipcRenderer.on('file-changed', handler)
    return () => ipcRenderer.removeListener('file-changed', handler)
  },

  // 标签配置文件变更监听（tree.txt / schema.json 外部修改）
  onTagsConfigChanged: (callback) => {
    const handler = (_event, info) => callback(info)
    ipcRenderer.on('tags-config-changed', handler)
    return () => ipcRenderer.removeListener('tags-config-changed', handler)
  },

  // 窗口控制
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // 窗口最大化状态变化监听
  onWindowMaximizeChange: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized)
    ipcRenderer.on('window-maximized', handler)
    return () => ipcRenderer.removeListener('window-maximized', handler)
  },
})
