import { app, BrowserWindow, ipcMain, dialog } from 'electron/main'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 判断是否在开发模式
const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'UV Note',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    // 开发模式：加载 Vite 开发服务器
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    // 生产模式：加载打包后的文件
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ============================
// IPC 处理：文件夹选择
// ============================

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择工作区文件夹',
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) {
    return null
  }
  return result.filePaths[0]
})

// ============================
// IPC 处理：读取目录内容
// ============================

ipcMain.handle('read-directory', async (_event, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(dirPath, entry.name),
    }))
  } catch (err) {
    console.error('读取目录失败:', err)
    return []
  }
})

// ============================
// IPC 处理：读取文本文件
// ============================

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, content }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================
// IPC 处理：保存文本文件
// ============================

ipcMain.handle('save-file', async (_event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================
// IPC 处理：新建文件
// ============================

ipcMain.handle('create-file', async (_event, dirPath, fileName) => {
  const filePath = path.join(dirPath, fileName)
  try {
    if (fs.existsSync(filePath)) {
      return { success: false, error: '文件已存在' }
    }
    fs.writeFileSync(filePath, '', 'utf-8')
    return { success: true, path: filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================
// IPC 处理：新建文件夹
// ============================

ipcMain.handle('create-folder', async (_event, dirPath, folderName) => {
  const folderPath = path.join(dirPath, folderName)
  try {
    if (fs.existsSync(folderPath)) {
      return { success: false, error: '文件夹已存在' }
    }
    fs.mkdirSync(folderPath)
    return { success: true, path: folderPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================
// IPC 处理：删除文件/文件夹
// ============================

ipcMain.handle('delete-entry', async (_event, targetPath) => {
  try {
    const stat = fs.statSync(targetPath)
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true })
    } else {
      fs.unlinkSync(targetPath)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================
// IPC 处理：重命名文件/文件夹
// ============================

ipcMain.handle('rename-entry', async (_event, oldPath, newName) => {
  const dir = path.dirname(oldPath)
  const newPath = path.join(dir, newName)
  try {
    if (fs.existsSync(newPath)) {
      return { success: false, error: '该名称已存在' }
    }
    fs.renameSync(oldPath, newPath)
    return { success: true, path: newPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================
// IPC 处理：读取排序配置
// ============================

ipcMain.handle('read-order-config', async (_event, workspacePath) => {
  const configPath = path.join(workspacePath, '.uvnote', 'order.json')
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('读取排序配置失败:', err)
  }
  return {}
})

// ============================
// IPC 处理：保存排序配置
// ============================

ipcMain.handle('save-order-config', async (_event, workspacePath, orderData) => {
  const configDir = path.join(workspacePath, '.uvnote')
  const configPath = path.join(configDir, 'order.json')
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    fs.writeFileSync(configPath, JSON.stringify(orderData, null, 2), 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================
// 应用配置（记录上次工作区等）
// ============================

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json')
}

function readAppConfig() {
  const configPath = getConfigPath()
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    }
  } catch (err) {
    console.error('读取应用配置失败:', err)
  }
  return {}
}

function writeAppConfig(config) {
  const configPath = getConfigPath()
  try {
    const dir = path.dirname(configPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

ipcMain.handle('get-app-config', async () => {
  return readAppConfig()
})

ipcMain.handle('set-app-config', async (_event, config) => {
  return writeAppConfig(config)
})

// ============================
// 应用生命周期
// ============================

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
