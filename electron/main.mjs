import { app, BrowserWindow, ipcMain, dialog } from 'electron/main'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// ============================
// 窗口
// ============================
function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600,
    title: 'UV Note',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ============================
// IPC
// ============================
ipcMain.handle('select-folder', async () => {
  const r = await dialog.showOpenDialog({ title: '选择文件夹', properties: ['openDirectory'] })
  return (r.canceled || r.filePaths.length === 0) ? null : r.filePaths[0]
})

ipcMain.handle('read-directory', async (_e, dirPath) => {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true }).map(e => ({
      name: e.name, isDirectory: e.isDirectory(), path: path.join(dirPath, e.name),
    }))
  } catch { return [] }
})

ipcMain.handle('read-file', async (_e, filePath) => {
  try { return { success: true, content: fs.readFileSync(filePath, 'utf-8') } }
  catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('save-file', async (_e, filePath, content) => {
  try { fs.writeFileSync(filePath, content, 'utf-8'); return { success: true } }
  catch (err) { return { success: false, error: err.message } }
})

// 应用配置
function configPath() { return path.join(app.getPath('userData'), 'config.json') }
ipcMain.handle('get-app-config', () => {
  try { return fs.existsSync(configPath()) ? JSON.parse(fs.readFileSync(configPath(), 'utf-8')) : {} }
  catch { return {} }
})
ipcMain.handle('set-app-config', (_e, cfg) => {
  try {
    const d = path.dirname(configPath())
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
    fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf-8')
    return { success: true }
  } catch (err) { return { success: false, error: err.message } }
})

// ============================
// 生命周期
// ============================
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
