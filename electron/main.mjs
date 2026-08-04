import { app, BrowserWindow, ipcMain, dialog } from 'electron/main'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

// ============================
// 窗口
// ============================
function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600,
    frame: false,                              // 无边框 ← 自定义标题栏
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

  // 窗口最大化/还原事件 → 通知渲染进程更新图标
  win.on('maximize', () => win.webContents.send('window-maximized', true))
  win.on('unmaximize', () => win.webContents.send('window-maximized', false))
}

// ============================
// 窗口控制 IPC
// ============================
ipcMain.handle('window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})
ipcMain.handle('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  win.isMaximized() ? win.unmaximize() : win.maximize()
})
ipcMain.handle('window-close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close()
})
ipcMain.handle('window-is-maximized', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
})

// ============================
// 文件操作 IPC
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

// 剪贴板图片保存
ipcMain.handle('save-clipboard-image', async (_e, workspacePath, base64Data) => {
  try {
    const assetsDir = path.join(workspacePath, '.uvnote', 'assets')
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })

    // 从 base64 提取扩展名
    const m = base64Data.match(/^data:image\/(png|jpeg|gif|webp);base64,/)
    const ext = m ? m[1] : 'png'
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, '')

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `image-${stamp}.${ext}`
    const filePath = path.join(assetsDir, filename)

    fs.writeFileSync(filePath, Buffer.from(raw, 'base64'))
    return { success: true, path: `.uvnote/assets/${filename}` }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ============================
// 标签系统 — 常量 & 路径
// ============================
const TAGS_DIR = '.uvnote/tags'
const IGNORED_DIRS = new Set(['.uvnote', '.git', '.vscode', 'node_modules', 'dist', 'release', '__pycache__'])

function tagsDir(wp) { return path.join(wp, TAGS_DIR) }
function indexPath(wp) { return path.join(tagsDir(wp), 'index.json') }
function schemaPath(wp) { return path.join(tagsDir(wp), 'schema.json') }
function treeTxtPath(wp) { return path.join(tagsDir(wp), 'tree.txt') }

// ============================
// 标签提取
// ============================

/** 从 Markdown 文本提取标签。支持中文冒号（：）和英文冒号（:） */
function extractContentTags(content) {
  const plainTags = []
  const metaValues = {}
  // 匹配 #标签名  或  #标签名:数值  或  #标签名：数值
  const re = /#([\w一-鿿぀-ゟ゠-ヿ가-힯À-ɏ]+)(?:\s*[:：]\s*(-?\d+(?:\.\d+)?))?/g
  let m
  while ((m = re.exec(content)) !== null) {
    const tagName = m[1]
    if (m[2] !== undefined) metaValues[tagName] = parseFloat(m[2])
    if (!plainTags.includes(tagName)) plainTags.push(tagName)
  }
  return { plainTags, metaValues }
}

function extractPathTags(relativePath) {
  const dir = path.dirname(relativePath)
  if (dir === '.') return []
  return dir.split(path.sep).filter(p => p && !IGNORED_DIRS.has(p))
}

// ============================
// FileID — 基于创建时间戳（birthtimeMs）
// 重命名、移动都不影响，因为创建时间不变
// ============================
function generateFileID(fullPath) {
  try {
    const stat = fs.statSync(fullPath)
    const birthtimeMs = Math.floor(stat.birthtimeMs || stat.ctimeMs)
    return 'fid_' + birthtimeMs.toString(36)
  } catch {
    // 极端情况 fallback
    return 'fid_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
  }
}

// ============================
// 全量扫描 → index.json
// ============================
function scanWorkspace(workspacePath) {
  const files = {}       // Record<FileID, entry>
  const tagIndex = {}    // Record<tag, FileID[]>

  function walk(dir, basePath) {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = path.relative(basePath, fullPath)
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(fullPath, basePath)
      } else if (entry.name.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const fileId = generateFileID(fullPath)
          const { plainTags, metaValues } = extractContentTags(content)
          const pathTags = extractPathTags(relPath)

          // 默认标签：#重要程度:0
          if (!metaValues['重要程度']) metaValues['重要程度'] = 0
          if (!plainTags.includes('重要程度')) plainTags.push('重要程度')

          const allTags = [...new Set([...pathTags, ...plainTags])]
          files[fileId] = {
            relativePath: relPath.replace(/\\/g, '/'),
            pathTags,
            contentTags: plainTags,
            metaValues,
            birthtimeMs: Math.floor((fs.statSync(fullPath).birthtimeMs || 0)),
          }

          for (const tag of allTags) {
            if (!tagIndex[tag]) tagIndex[tag] = []
            if (!tagIndex[tag].includes(fileId)) tagIndex[tag].push(fileId)
          }
        } catch { /* skip */ }
      }
    }
  }

  walk(workspacePath, workspacePath)
  return { files, tagIndex, lastScanTime: new Date().toISOString() }
}

// ============================
// 从文件系统层级生成 schema.json
// ============================
function buildSchemaFromFs(workspacePath) {
  /** @param {string} dir */
  function buildNode(dir, basePath) {
    /** @type {any} */
    const node = { name: dir === basePath ? 'root' : path.basename(dir) }
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return node }
    const subDirs = entries
      .filter(e => e.isDirectory() && !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name))
    if (subDirs.length > 0) {
      node.children = []
      for (const d of subDirs) {
        const child = buildNode(path.join(dir, d.name), basePath)
        // 只添加有内容的节点（有子节点或将来会有文件匹配）
        if (child.children || child.name) node.children.push(child)
      }
      if (node.children.length === 0) delete node.children
    }
    // root 节点特殊处理：不叫 "root"
    if (node.name === 'root') {
      node.name = 'root'
      // root 的 children 已经在上面设置好了
    }
    return node
  }
  return { tree: buildNode(workspacePath, workspacePath) }
}

// ============================
// tree.txt ↔ schema.json 双向转换
// ============================

/** schema.json → tree.txt（缩进文本） */
function schemaToText(node, indent = '') {
  let result = ''
  if (node.name !== 'root') {
    result += indent + node.name + '\n'
  }
  if (node.children) {
    for (const child of node.children) {
      result += schemaToText(child, node.name === 'root' ? '' : indent + '  ')
    }
  }
  return result
}

/** tree.txt → schema.json */
function textToSchema(text) {
  const lines = text.split('\n').filter(l => l.trim())
  const root = { name: 'root', children: [] }

  /** @param {number} indent */
  function getIndent(line) {
    const m = line.match(/^(\s*)/)
    return m ? m[1].length : 0
  }

  function parseChildren(parentLines, startIdx, parentIndent) {
    /** @type {any[]} */
    const children = []
    let i = startIdx
    while (i < parentLines.length) {
      const line = parentLines[i]
      const indent = getIndent(line)
      const name = line.trim()
      if (!name) { i++; continue }

      if (indent <= parentIndent) break // 回到上一层

      // 向后查找：下一个同缩进或更浅的行之前的、更深缩进的行都是子节点
      const childStart = i + 1
      let childEnd = childStart
      while (childEnd < parentLines.length) {
        const nextIndent = getIndent(parentLines[childEnd])
        if (nextIndent <= indent) break
        childEnd++
      }

      /** @type {any} */
      const child = { name }
      if (childEnd > childStart) {
        child.children = parseChildren(parentLines.slice(childStart, childEnd), 0, indent)
      }
      children.push(child)
      i = childEnd
    }
    return children
  }

  root.children = parseChildren(lines, 0, -1)
  return { tree: root }
}

// ============================
// 文件监听
// ============================
const watchers = new Map()
function startWatching(workspacePath, win) {
  if (watchers.has(workspacePath)) return
  try {
    // 监听工作区 .md 文件变化
    const w1 = fs.watch(workspacePath, { recursive: true }, (eventType, filename) => {
      if (!filename) return
      const rp = filename.replace(/\\/g, '/')
      if (filename.endsWith('.md')) {
        win.webContents.send('file-changed', { relativePath: rp, eventType })
      }
    })

    // 监听 tree.txt 和 schema.json 的外部修改
    const tp = treeTxtPath(workspacePath)
    const sp = schemaPath(workspacePath)
    if (fs.existsSync(tp)) {
      fs.watch(tp, () => {
        win.webContents.send('tags-config-changed', { file: 'tree.txt' })
      })
    }
    if (fs.existsSync(sp)) {
      fs.watch(sp, () => {
        win.webContents.send('tags-config-changed', { file: 'schema.json' })
      })
    }

    watchers.set(workspacePath, { w1 })
  } catch { /* ignore */ }
}
function stopWatching(workspacePath) {
  const w = watchers.get(workspacePath)
  if (w) {
    if (w.w1) w.w1.close()
    watchers.delete(workspacePath)
  }
}

// ============================
// 标签系统 IPC
// ============================

ipcMain.handle('tags-scan-workspace', async (_e, workspacePath) => {
  try {
    const dir = tagsDir(workspacePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    // 备份旧 index
    const idxPath = indexPath(workspacePath)
    if (fs.existsSync(idxPath)) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      fs.copyFileSync(idxPath, idxPath.replace('.json', `.bak_${ts}.json`))
    }

    // 扫描 → index.json
    const data = scanWorkspace(workspacePath)
    fs.writeFileSync(idxPath, JSON.stringify(data, null, 2), 'utf-8')

    // 每次刷新都重建 schema.json（从文件系统层级）+ tree.txt
    const schema = buildSchemaFromFs(workspacePath)
    const sp = schemaPath(workspacePath)
    fs.writeFileSync(sp, JSON.stringify(schema, null, 2), 'utf-8')
    const txt = schemaToText(schema.tree)
    fs.writeFileSync(treeTxtPath(workspacePath), txt, 'utf-8')

    const win = BrowserWindow.fromWebContents(_e.sender)
    if (win) startWatching(workspacePath, win)
    return { success: true, data }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('tags-read-index', async (_e, workspacePath) => {
  try {
    const p = indexPath(workspacePath)
    if (!fs.existsSync(p)) return { success: true, data: null }
    return { success: true, data: JSON.parse(fs.readFileSync(p, 'utf-8')) }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('tags-patch-file', async (_e, workspacePath, relativePath, content) => {
  try {
    const idxPath = indexPath(workspacePath)
    if (!fs.existsSync(idxPath)) return { success: false, error: '请先扫描工作区' }
    const data = JSON.parse(fs.readFileSync(idxPath, 'utf-8'))
    const rp = relativePath.replace(/\\/g, '/')
    const fullPath = path.join(workspacePath, relativePath)

    // 生成 FileID（可能和旧的不同，比如文件重命名了）
    const fileId = generateFileID(fullPath)
    const { plainTags, metaValues } = extractContentTags(content)
    const pathTags = extractPathTags(rp)
    if (!metaValues['重要程度']) metaValues['重要程度'] = 0
    if (!plainTags.includes('重要程度')) plainTags.push('重要程度')
    const allTags = [...new Set([...pathTags, ...plainTags])]

    // 移除旧记录（可能通过路径匹配）
    let oldFileId = null
    for (const [fid, entry] of Object.entries(data.files)) {
      if (entry.relativePath === rp) { oldFileId = fid; break }
    }
    if (oldFileId && oldFileId !== fileId) {
      for (const tag of (data.files[oldFileId]?.pathTags || [])) {
        if (data.tagIndex[tag]) {
          data.tagIndex[tag] = data.tagIndex[tag].filter(id => id !== oldFileId)
        }
      }
      for (const tag of (data.files[oldFileId]?.contentTags || [])) {
        if (data.tagIndex[tag]) {
          data.tagIndex[tag] = data.tagIndex[tag].filter(id => id !== oldFileId)
        }
      }
      delete data.files[oldFileId]
    }

    data.files[fileId] = { relativePath: rp, pathTags, contentTags: plainTags, metaValues }
    for (const tag of allTags) {
      if (!data.tagIndex[tag]) data.tagIndex[tag] = []
      if (!data.tagIndex[tag].includes(fileId)) data.tagIndex[tag].push(fileId)
    }

    data.lastScanTime = new Date().toISOString()
    fs.writeFileSync(idxPath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true, data }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('tags-read-schema', async (_e, workspacePath) => {
  try {
    const p = schemaPath(workspacePath)
    if (!fs.existsSync(p)) return { success: true, data: null }
    return { success: true, data: JSON.parse(fs.readFileSync(p, 'utf-8')) }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('tags-save-schema', async (_e, workspacePath, schema) => {
  try {
    const dir = tagsDir(workspacePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(schemaPath(workspacePath), JSON.stringify(schema, null, 2), 'utf-8')
    // 同步更新 tree.txt
    const txt = schemaToText(schema.tree)
    fs.writeFileSync(treeTxtPath(workspacePath), txt, 'utf-8')
    return { success: true, data: schema }
  } catch (err) { return { success: false, error: err.message } }
})

// tree.txt 读写
ipcMain.handle('tags-read-tree-txt', async (_e, workspacePath) => {
  try {
    const p = treeTxtPath(workspacePath)
    if (!fs.existsSync(p)) return { success: true, data: '' }
    return { success: true, data: fs.readFileSync(p, 'utf-8') }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('tags-save-tree-txt', async (_e, workspacePath, text) => {
  try {
    const dir = tagsDir(workspacePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(treeTxtPath(workspacePath), text, 'utf-8')
    // 同步更新 schema.json
    const schema = textToSchema(text)
    fs.writeFileSync(schemaPath(workspacePath), JSON.stringify(schema, null, 2), 'utf-8')
    return { success: true, data: schema }
  } catch (err) { return { success: false, error: err.message } }
})

ipcMain.handle('tags-stop-watch', async (_e, workspacePath) => {
  stopWatching(workspacePath)
  return { success: true }
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
