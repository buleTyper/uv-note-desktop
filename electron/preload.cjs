const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 选择工作区文件夹
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // 读取目录内容
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),

  // 读取文本文件
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

  // 保存文本文件
  saveFile: (filePath, content) =>
    ipcRenderer.invoke('save-file', filePath, content),

  // 读取排序配置
  readOrderConfig: (workspacePath) =>
    ipcRenderer.invoke('read-order-config', workspacePath),

  // 保存排序配置
  saveOrderConfig: (workspacePath, orderData) =>
    ipcRenderer.invoke('save-order-config', workspacePath, orderData),

  // 应用配置（记录上次工作区等）
  getAppConfig: () => ipcRenderer.invoke('get-app-config'),
  setAppConfig: (config) => ipcRenderer.invoke('set-app-config', config),

  // 新建文件/文件夹
  createFile: (dirPath, fileName) =>
    ipcRenderer.invoke('create-file', dirPath, fileName),
  createFolder: (dirPath, folderName) =>
    ipcRenderer.invoke('create-folder', dirPath, folderName),

  // 删除
  deleteEntry: (targetPath) => ipcRenderer.invoke('delete-entry', targetPath),

  // 重命名
  renameEntry: (oldPath, newName) =>
    ipcRenderer.invoke('rename-entry', oldPath, newName),
})
