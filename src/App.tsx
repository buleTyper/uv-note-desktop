import { useState, useCallback, useEffect, useRef } from 'react'

// ============================
// 类型定义
// ============================
interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

interface DragSource {
  name: string
  dirKey: string
}

interface DragTarget {
  name: string
  dirKey: string
  position: 'before' | 'after'
}

interface ContextMenuState {
  x: number
  y: number
  type: 'file' | 'folder' | 'empty'
  targetPath: string
  parentDir: string
}

interface DialogState {
  type: 'new-file' | 'new-folder' | 'rename'
  parentDir: string
  targetPath?: string
  oldName?: string
}

// ============================
// 工具函数
// ============================
function defaultSort(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })
}

function sortByOrderConfig(
  entries: FileEntry[],
  orderConfig: Record<string, string[]>,
  dirKey: string
): FileEntry[] {
  const order = orderConfig[dirKey]
  if (!order || order.length === 0) return defaultSort(entries)

  const entryMap = new Map(entries.map((e) => [e.name, e]))
  const sorted: FileEntry[] = []
  const seen = new Set<string>()

  for (const name of order) {
    const entry = entryMap.get(name)
    if (entry) { sorted.push(entry); seen.add(name) }
  }
  sorted.push(...defaultSort(entries.filter((e) => !seen.has(e.name))))
  return sorted
}

// ============================
// 图标
// ============================
function FolderIcon({ open }: { open: boolean }) {
  return <span className="tree-icon">{open ? '📂' : '📁'}</span>
}
function FileIcon() {
  return <span className="tree-icon">📄</span>
}

// ============================
// 树节点
// ============================
function TreeNode({
  entry, depth, dirKey, onSelectFile, onToggleFolder,
  expandedFolders, selectedPath, dropIndicator,
  onDragStart, onDragOver, onDragLeave, onDrop, onContextMenu,
  altHeld,
}: {
  entry: FileEntry; depth: number; dirKey: string
  onSelectFile: (path: string) => void
  onToggleFolder: (path: string) => void
  expandedFolders: Set<string>
  selectedPath: string | null
  dropIndicator: 'before' | 'after' | null
  onDragStart: (entry: FileEntry, dirKey: string) => void
  onDragOver: (e: React.DragEvent, entry: FileEntry, dirKey: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, entry: FileEntry, dirKey: string) => void
  onContextMenu: (e: React.MouseEvent, targetPath: string, entryType: 'file' | 'folder', parentDir: string) => void
  altHeld: boolean
}) {
  const isExpanded = expandedFolders.has(entry.path)
  const isSelected = selectedPath === entry.path
  const canDrag = altHeld
  const entryType: 'file' | 'folder' = entry.isDirectory ? 'folder' : 'file'

  const handleClick = () => {
    if (altHeld) return
    if (entry.isDirectory) onToggleFolder(entry.path)
    else onSelectFile(entry.path)
  }

  const indicatorClass = dropIndicator
    ? dropIndicator === 'before' ? 'drop-before' : 'drop-after' : ''

  return (
    <div className="tree-node" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
      <div
        className={`tree-row ${isSelected ? 'tree-row--selected' : ''} ${indicatorClass} ${canDrag ? 'tree-row--draggable' : ''}`}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.stopPropagation()
          onContextMenu(e, entry.path, entryType, dirKey)
        }}
        draggable={canDrag}
        onDragStart={() => onDragStart(entry, dirKey)}
        onDragOver={(e) => onDragOver(e, entry, dirKey)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, entry, dirKey)}
        title={canDrag ? '↕ 拖动排序' : entry.name}
      >
        {entry.isDirectory ? (
          <>
            <span className="tree-arrow">{isExpanded ? '▾' : '▸'}</span>
            <FolderIcon open={isExpanded} />
          </>
        ) : (
          <>
            <span className="tree-arrow tree-arrow--spacer" />
            <FileIcon />
          </>
        )}
        <span className="tree-name">{entry.name}</span>
      </div>
    </div>
  )
}

// ============================
// 右键菜单
// ============================
function ContextMenu({
  menu, onClose, onNewFile, onNewFolder, onRename, onDelete,
}: {
  menu: ContextMenuState
  onClose: () => void
  onNewFile: (dir: string) => void
  onNewFolder: (dir: string) => void
  onRename: (path: string, name: string) => void
  onDelete: (path: string) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const items: { label: string; action: () => void }[] = []

  if (menu.type === 'folder') {
    items.push(
      { label: '📄 新建文件', action: () => onNewFile(menu.targetPath) },
      { label: '📁 新建文件夹', action: () => onNewFolder(menu.targetPath) },
      { label: '✏️ 重命名', action: () => onRename(menu.targetPath, menu.targetPath.split('\\').pop() || '') },
      { label: '🗑️ 删除', action: () => onDelete(menu.targetPath) },
    )
  } else if (menu.type === 'file') {
    items.push(
      { label: '✏️ 重命名', action: () => onRename(menu.targetPath, menu.targetPath.split('\\').pop() || '') },
      { label: '🗑️ 删除', action: () => onDelete(menu.targetPath) },
    )
  } else if (menu.type === 'empty') {
    items.push(
      { label: '📄 新建文件', action: () => onNewFile(menu.parentDir) },
      { label: '📁 新建文件夹', action: () => onNewFolder(menu.parentDir) },
    )
  }

  return (
    <div className="context-menu" ref={menuRef} style={{ left: menu.x, top: menu.y }}>
      {items.map((item, i) => (
        <div key={i} className="context-menu-item" onClick={() => { item.action(); onClose() }}>
          {item.label}
        </div>
      ))}
    </div>
  )
}

// ============================
// 对话框
// ============================
function Dialog({
  dialog, onClose, onSubmit,
}: {
  dialog: DialogState
  onClose: () => void
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(dialog.oldName || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  const title = dialog.type === 'new-file' ? '新建文件'
    : dialog.type === 'new-folder' ? '新建文件夹' : '重命名'

  const commit = () => { const t = value.trim(); if (t) onSubmit(t) }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        <input
          ref={inputRef}
          className="dialog-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onClose() }}
          placeholder={dialog.type === 'rename' ? '输入新名称' : '输入名称'}
        />
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={commit}>确定</button>
        </div>
      </div>
    </div>
  )
}

// ============================
// 主应用
// ============================
export default function App() {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null)
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [folderContents, setFolderContents] = useState<Record<string, FileEntry[]>>({})
  const [orderConfig, setOrderConfig] = useState<Record<string, string[]>>({})
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [editingContent, setEditingContent] = useState('')
  const [isModified, setIsModified] = useState(false)
  const [altHeld, setAltHeld] = useState(false)
  const [dragSource, setDragSource] = useState<DragSource | null>(null)
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)

  // ============================
  // Alt 键监听（仅用于拖动，不影响其他功能）
  // ============================
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Alt') { setAltHeld(true); e.preventDefault() } }
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') { setAltHeld(false); setDragSource(null); setDragTarget(null) } }
    const blur = () => { setAltHeld(false); setDragSource(null); setDragTarget(null) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  // ============================
  // 刷新目录
  // ============================
  const refreshDirectory = useCallback(async (dirPath: string) => {
    const entries = await window.electronAPI.readDirectory(dirPath)
    if (dirPath === workspacePath) setRootEntries(entries)
    else setFolderContents((prev) => ({ ...prev, [dirPath]: entries }))
  }, [workspacePath])

  // ============================
  // 加载工作区
  // ============================
  const loadWorkspace = useCallback(async (folderPath: string) => {
    setWorkspacePath(folderPath)
    const config = await window.electronAPI.readOrderConfig(folderPath)
    setOrderConfig(config)
    const entries = await window.electronAPI.readDirectory(folderPath)
    setRootEntries(entries)
    setExpandedFolders(new Set())
    setFolderContents({})
    setSelectedPath(null)
    setFileContent('')
    setEditingContent('')
    setIsModified(false)
  }, [])

  const handleSelectFolder = useCallback(async () => {
    const folderPath = await window.electronAPI.selectFolder()
    if (!folderPath) return
    await loadWorkspace(folderPath)
    window.electronAPI.setAppConfig({ lastWorkspace: folderPath })
  }, [loadWorkspace])

  useEffect(() => {
    (async () => {
      const config = await window.electronAPI.getAppConfig()
      if (config.lastWorkspace) await loadWorkspace(config.lastWorkspace)
    })()
  }, [loadWorkspace])

  // ============================
  // 文件夹展开/折叠
  // ============================
  const handleToggleFolder = useCallback(async (folderPath: string) => {
    const next = new Set(expandedFolders)
    if (next.has(folderPath)) { next.delete(folderPath) }
    else {
      next.add(folderPath)
      if (!folderContents[folderPath]) {
        const entries = await window.electronAPI.readDirectory(folderPath)
        setFolderContents((prev) => ({ ...prev, [folderPath]: entries }))
      }
    }
    setExpandedFolders(next)
  }, [expandedFolders, folderContents])

  // ============================
  // 文件选中 & 编辑
  // ============================
  const handleSelectFile = useCallback(async (filePath: string) => {
    setSelectedPath(filePath)
    const result = await window.electronAPI.readFile(filePath)
    const c = result.success ? result.content || '' : `❌ 读取失败: ${result.error}`
    setFileContent(c)
    setEditingContent(c)
    setIsModified(false)
  }, [])

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value; setEditingContent(v); setIsModified(v !== fileContent)
    }, [fileContent]
  )

  const handleSave = useCallback(async () => {
    if (!selectedPath || !isModified) return
    const r = await window.electronAPI.saveFile(selectedPath, editingContent)
    if (r.success) { setFileContent(editingContent); setIsModified(false) }
    else alert(`保存失败: ${r.error}`)
  }, [selectedPath, isModified, editingContent])

  // ============================
  // Alt+, Alt+. — 在编辑时移动当前文件排序位置
  // ============================
  const handleSortMove = useCallback((direction: 'up' | 'down') => {
    if (!selectedPath || !workspacePath) return

    // 反推文件所属目录和文件名
    const parentDir = selectedPath.substring(0, selectedPath.lastIndexOf('\\'))
    const fileName = selectedPath.split('\\').pop() || ''

    // 取该目录的条目列表，生成当前排序
    const entries = parentDir === workspacePath ? rootEntries : folderContents[parentDir] || []
    const currentOrder = orderConfig[parentDir]
      ? [...orderConfig[parentDir]]
      : defaultSort(entries).map(e => e.name)

    const idx = currentOrder.indexOf(fileName)
    if (idx === -1) return

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= currentOrder.length) return

    // 交换
    ;[currentOrder[idx], currentOrder[targetIdx]] = [currentOrder[targetIdx], currentOrder[idx]]

    const updated = { ...orderConfig, [parentDir]: currentOrder }
    setOrderConfig(updated)
    window.electronAPI.saveOrderConfig(workspacePath, updated)
  }, [selectedPath, workspacePath, orderConfig, rootEntries, folderContents])

  // ============================
  // 快捷键
  // ============================
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // Ctrl+S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); return }

      // Alt+, 上移  /  Alt+. 下移（仅在编辑区有选中文件时生效）
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === ',') { e.preventDefault(); handleSortMove('up'); return }
        if (e.key === '.') { e.preventDefault(); handleSortMove('down'); return }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [handleSave, handleSortMove])

  // ============================
  // 右键菜单（始终可用，不依赖任何模式）
  // ============================
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    targetPath: string,
    entryType: 'file' | 'folder',
    parentDir: string
  ) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX, y: e.clientY,
      type: entryType,
      targetPath,
      parentDir,
    })
  }, [])

  // ============================
  // 文件操作
  // ============================
  const handleNewFile = useCallback((dir: string) => {
    setDialog({ type: 'new-file', parentDir: dir })
  }, [])
  const handleNewFolder = useCallback((dir: string) => {
    setDialog({ type: 'new-folder', parentDir: dir })
  }, [])
  const handleRename = useCallback((p: string, name: string) => {
    setDialog({ type: 'rename', parentDir: p.substring(0, p.lastIndexOf('\\')), targetPath: p, oldName: name })
  }, [])
  const handleDelete = useCallback(async (targetPath: string) => {
    const name = targetPath.split('\\').pop() || ''
    if (!window.confirm(`确定删除 "${name}"？不可撤销。`)) return
    const r = await window.electronAPI.deleteEntry(targetPath)
    if (r.success) {
      const pd = targetPath.substring(0, targetPath.lastIndexOf('\\'))
      await refreshDirectory(pd)
      if (selectedPath === targetPath) {
        setSelectedPath(null); setFileContent(''); setEditingContent(''); setIsModified(false)
      }
      setExpandedFolders((prev) => { const n = new Set(prev); n.delete(targetPath); return n })
      setFolderContents((prev) => { const n = { ...prev }; delete n[targetPath]; return n })
    } else alert(`删除失败: ${r.error}`)
  }, [selectedPath, refreshDirectory])

  const handleDialogSubmit = useCallback(async (value: string) => {
    if (!dialog) return
    const d = dialog; setDialog(null)
    if (d.type === 'new-file') {
      const fn = value.includes('.') ? value : value + '.md'
      const r = await window.electronAPI.createFile(d.parentDir, fn)
      if (r.success && r.path) { await refreshDirectory(d.parentDir); handleSelectFile(r.path) }
      else alert(`创建失败: ${r.error}`)
    } else if (d.type === 'new-folder') {
      const r = await window.electronAPI.createFolder(d.parentDir, value)
      if (r.success) await refreshDirectory(d.parentDir)
      else alert(`创建失败: ${r.error}`)
    } else if (d.type === 'rename' && d.targetPath) {
      const r = await window.electronAPI.renameEntry(d.targetPath, value)
      if (r.success && r.path) {
        if (selectedPath === d.targetPath) setSelectedPath(r.path)
        await refreshDirectory(d.parentDir)
      } else alert(`重命名失败: ${r.error}`)
    }
  }, [dialog, refreshDirectory, handleSelectFile, selectedPath])

  // ============================
  // 拖动（仅 Alt+鼠标拖动）
  // ============================
  const handleDragStart = useCallback((entry: FileEntry, dk: string) => {
    setDragSource({ name: entry.name, dirKey: dk })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, entry: FileEntry, dk: string) => {
    e.preventDefault()
    if (!dragSource) return
    if (dragSource.name === entry.name && dragSource.dirKey === dk) { setDragTarget(null); return }
    if (dragSource.dirKey !== dk) { setDragTarget(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setDragTarget({ name: entry.name, dirKey: dk, position: e.clientY < rect.top + rect.height / 2 ? 'before' : 'after' })
  }, [dragSource])

  const handleDragLeave = useCallback(() => setDragTarget(null), [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetEntry: FileEntry, targetDK: string) => {
    e.preventDefault()
    if (!dragSource || dragSource.dirKey !== targetDK || dragSource.name === targetEntry.name) {
      setDragSource(null); setDragTarget(null); return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    const cur = [...(orderConfig[targetDK] || [])]
    const filtered = cur.filter(n => n !== dragSource.name)
    const ti = filtered.indexOf(targetEntry.name)
    filtered.splice(pos === 'before' ? ti : ti + 1, 0, dragSource.name)
    const no = { ...orderConfig, [targetDK]: filtered }
    setOrderConfig(no)
    setDragSource(null); setDragTarget(null)
    if (workspacePath) window.electronAPI.saveOrderConfig(workspacePath, no)
  }, [dragSource, orderConfig, workspacePath])

  // ============================
  // 渲染主侧边栏文件树
  // ============================
  function renderTree(entries: FileEntry[], dk: string, depth: number) {
    const sorted = sortByOrderConfig(entries, orderConfig, dk)
    const nodes: JSX.Element[] = []

    sorted.forEach((entry) => {
      const di = dragTarget && dragTarget.dirKey === dk && dragTarget.name === entry.name
        ? dragTarget.position : null

      nodes.push(
        <TreeNode
          key={entry.path}
          entry={entry} depth={depth} dirKey={dk}
          onSelectFile={handleSelectFile}
          onToggleFolder={handleToggleFolder}
          expandedFolders={expandedFolders}
          selectedPath={selectedPath}
          dropIndicator={di}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onContextMenu={(e, targetPath, entryType, parentDir) => handleContextMenu(e, targetPath, entryType, parentDir)}
          altHeld={altHeld}
        />
      )
      if (entry.isDirectory && expandedFolders.has(entry.path)) {
        const children = folderContents[entry.path] || []
        nodes.push(...renderTree(children, entry.path, depth + 1))
      }
    })
    return nodes
  }

  // ============================
  // 辅助侧边栏
  // ============================
  const [auxExpanded, setAuxExpanded] = useState<Set<string>>(new Set())
  const [auxContents, setAuxContents] = useState<Record<string, FileEntry[]>>({})

  const handleAuxToggle = useCallback(async (folderPath: string) => {
    const next = new Set(auxExpanded)
    if (next.has(folderPath)) { next.delete(folderPath) }
    else {
      next.add(folderPath)
      if (!auxContents[folderPath]) {
        const entries = await window.electronAPI.readDirectory(folderPath)
        setAuxContents((prev) => ({ ...prev, [folderPath]: entries }))
      }
    }
    setAuxExpanded(next)
  }, [auxExpanded, auxContents])

  function renderAuxTree(entries: FileEntry[], depth: number) {
    const sorted = defaultSort(entries)
    const nodes: JSX.Element[] = []
    sorted.forEach((entry) => {
      const isExp = auxExpanded.has(entry.path)
      nodes.push(
        <div key={entry.path} className="tree-node" style={{ paddingLeft: `${depth * 12 + 6}px` }}>
          <div className="tree-row" onClick={() => {
            entry.isDirectory ? handleAuxToggle(entry.path) : handleSelectFile(entry.path)
          }} title={entry.name}>
            {entry.isDirectory ? (
              <><span className="tree-arrow">{isExp ? '▾' : '▸'}</span><FolderIcon open={isExp} /></>
            ) : (
              <><span className="tree-arrow tree-arrow--spacer" /><FileIcon /></>
            )}
            <span className="tree-name">{entry.name}</span>
          </div>
        </div>
      )
      if (entry.isDirectory && isExp) {
        nodes.push(...renderAuxTree(auxContents[entry.path] || [], depth + 1))
      }
    })
    return nodes
  }

  // ============================
  // 渲染
  // ============================
  return (
    <div className="app">
      <div className="toolbar">
        <span className="toolbar-title">UV Note</span>
        <div className="toolbar-actions">
          {workspacePath && <span className="toolbar-path" title={workspacePath}>📁 {workspacePath}</span>}
          <button className="btn btn-primary" onClick={handleSelectFolder}>
            {workspacePath ? '切换工作区' : '选择工作区文件夹'}
          </button>
        </div>
      </div>

      <div className="main">
        {/* 主侧边栏 */}
        <div className="sidebar sidebar--left">
          <div className="sidebar-header">
            <span>📑 文件列表</span>
            <span className={`hint-text ${altHeld ? 'hint-text--active' : ''}`}>
              {altHeld ? '🔓 拖动模式' : '按住 Alt 拖动排序'}
            </span>
          </div>
          <div className="sidebar-content"
            onContextMenu={(e) => {
              if (workspacePath) {
                e.preventDefault()
                setContextMenu({
                  x: e.clientX, y: e.clientY,
                  type: 'empty',
                  targetPath: workspacePath, parentDir: workspacePath,
                })
              }
            }}>
            {!workspacePath ? (
              <div className="empty-state"><p>👆 请先选择一个文件夹作为工作区</p></div>
            ) : rootEntries.length === 0 ? (
              <div className="empty-state"><p>📭 文件夹为空</p></div>
            ) : (
              renderTree(rootEntries, '', 0)
            )}
          </div>
        </div>

        {/* 编辑区 */}
        <div className="editor">
          {selectedPath ? (
            <>
              <div className="editor-header">
                <span className={`editor-modified ${isModified ? 'editor-modified--visible' : ''}`}>●</span>
                <span>📝 {selectedPath.split('\\').pop()}</span>
                <span className="editor-hint">{isModified ? '未保存 — Ctrl+S' : ''}</span>
              </div>
              <div className="editor-content">
                <textarea className="editor-textarea" value={editingContent}
                  onChange={handleContentChange} spellCheck={false} placeholder="开始编辑..." />
              </div>
            </>
          ) : (
            <div className="empty-state"><p>📂 选择一个文件开始编辑</p></div>
          )}
        </div>

        {/* 辅助侧边栏 */}
        <div className="sidebar sidebar--right">
          <div className="sidebar-header"><span>📋 原始顺序</span></div>
          <div className="sidebar-content">
            {!workspacePath ? (
              <div className="empty-state"><p style={{ fontSize: 12 }}>无工作区</p></div>
            ) : rootEntries.length === 0 ? (
              <div className="empty-state"><p style={{ fontSize: 12 }}>文件夹为空</p></div>
            ) : (
              renderAuxTree(rootEntries, 0)
            )}
          </div>
        </div>
      </div>

      <div className="statusbar">
        <span>{workspacePath ? `工作区: ${workspacePath}` : '未打开工作区'}</span>
        <span>{altHeld ? '↕ 可拖动排序' : selectedPath ? `📝 ${selectedPath.split('\\').pop()}` : ''}</span>
      </div>

      {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)}
          onNewFile={handleNewFile} onNewFolder={handleNewFolder}
          onRename={handleRename} onDelete={handleDelete} />
      )}
      {dialog && (
        <Dialog dialog={dialog} onClose={() => setDialog(null)} onSubmit={handleDialogSubmit} />
      )}
    </div>
  )
}
