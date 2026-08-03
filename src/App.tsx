import { useState, useEffect, useCallback } from 'react'
import MainLayout from './components/layout/MainLayout'

interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

function sortFiles(files: FileEntry[]): FileEntry[] {
  return [...files].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export default function App() {
  const [workspace, setWorkspace] = useState<string | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [children, setChildren] = useState<Record<string, FileEntry[]>>({})
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [editContent, setEditContent] = useState('')
  const [modified, setModified] = useState(false)

  // 选择工作区
  const openWorkspace = useCallback(async () => {
    const fp = await window.electronAPI.selectFolder()
    if (!fp) return
    setWorkspace(fp)
    const entries = await window.electronAPI.readDirectory(fp)
    setFiles(entries)
    setExpanded(new Set())
    setChildren({})
    setSelectedPath(null)
    setContent('')
    setEditContent('')
    setModified(false)
    window.electronAPI.setAppConfig({ lastWorkspace: fp })
  }, [])

  // 启动时恢复上次工作区
  useEffect(() => {
    ;(async () => {
      const cfg = await window.electronAPI.getAppConfig()
      if (cfg.lastWorkspace) {
        setWorkspace(cfg.lastWorkspace)
        const entries = await window.electronAPI.readDirectory(cfg.lastWorkspace)
        setFiles(entries)
      }
    })()
  }, [])

  // 展开/折叠目录
  const toggleDir = useCallback(
    async (p: string) => {
      const next = new Set(expanded)
      if (next.has(p)) {
        next.delete(p)
      } else {
        next.add(p)
        if (!children[p]) {
          const e = await window.electronAPI.readDirectory(p)
          setChildren(prev => ({ ...prev, [p]: e }))
        }
      }
      setExpanded(next)
    },
    [expanded, children],
  )

  // 选择文件
  const openFile = useCallback(async (p: string) => {
    setSelectedPath(p)
    const r = await window.electronAPI.readFile(p)
    const c = r.success ? (r.content ?? '') : `读取失败: ${r.error}`
    setContent(c)
    setEditContent(c)
    setModified(false)
  }, [])

  // 保存 Ctrl+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!selectedPath || !modified) return
        ;(async () => {
          const r = await window.electronAPI.saveFile(selectedPath, editContent)
          if (r.success) {
            setContent(editContent)
            setModified(false)
          } else {
            alert('保存失败: ' + r.error)
          }
        })()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [selectedPath, modified, editContent])

  // 递归渲染文件树
  function renderTree(
    entries: FileEntry[],
    depth: number,
  ): JSX.Element[] {
    return sortFiles(entries).map(e => (
      <div key={e.path}>
        <div
          className={`tree-row ${
            selectedPath === e.path ? 'tree-row--sel' : ''
          }`}
          style={{ paddingLeft: depth * 16 + 8 }}
          onClick={() =>
            e.isDirectory ? toggleDir(e.path) : openFile(e.path)
          }
        >
          <span className="tree-arrow">
            {e.isDirectory
              ? expanded.has(e.path)
                ? '▾'
                : '▸'
              : ''}
          </span>
          <span className="tree-icon">
            {e.isDirectory
              ? expanded.has(e.path)
                ? '📂'
                : '📁'
              : '📄'}
          </span>
          <span className="tree-name">{e.name}</span>
        </div>
        {e.isDirectory &&
          expanded.has(e.path) &&
          renderTree(children[e.path] ?? [], depth + 1)}
      </div>
    ))
  }

  // 提取工作区名称
  const workspaceName = workspace
    ? workspace.split('\\').pop() || workspace
    : undefined

  // ============================
  // 侧边栏（文件树）
  // ============================
  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-app-text-muted border-b border-app-border flex-shrink-0">
        <span>📑 文件</span>
        <button
          className="px-2 py-0.5 text-[11px] border border-app-border-light rounded-[3px] cursor-pointer bg-app-surface3 text-app-text hover:bg-app-hover transition-colors"
          onClick={openWorkspace}
        >
          {workspace ? '切换' : '打开文件夹'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {!workspace ? (
          <div className="flex items-center justify-center h-full text-app-text-dim text-[13px]">
            👆 打开一个文件夹开始
          </div>
        ) : files.length === 0 ? (
          <div className="flex items-center justify-center h-full text-app-text-dim text-[13px]">
            📭 文件夹为空
          </div>
        ) : (
          renderTree(files, 0)
        )}
      </div>
    </>
  )

  // ============================
  // 编辑器区域
  // ============================
  const editorContent = (
    <>
      {selectedPath ? (
        <>
          {/* 编辑器标题栏 */}
          <div className="flex items-center gap-2 px-4 py-1.5 text-[12px] text-app-text-muted border-b border-app-border bg-app-bg flex-shrink-0">
            <span>{modified ? '●' : ''}</span>
            <span>{selectedPath.split('\\').pop()}</span>
            {modified && (
              <span className="ml-auto text-app-text-dim text-[11px]">
                Ctrl+S 保存
              </span>
            )}
          </div>
          <textarea
            className="flex-1 px-6 py-4 font-mono text-[14px] leading-relaxed text-app-text bg-transparent border-none outline-none resize-none editor-area"
            value={editContent}
            onChange={e => {
              setEditContent(e.target.value)
              setModified(e.target.value !== content)
            }}
            spellCheck={false}
            placeholder="开始编辑..."
          />
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-app-text-dim text-[14px]">
          📂 选择文件开始编辑
        </div>
      )}
    </>
  )

  // ============================
  // 底部状态栏（占满整行）
  // ============================
  const statusBarContent = (
    <div className="flex items-center justify-between h-[24px] px-3 bg-app-accent-vivid text-white text-[11px] flex-shrink-0">
      <span className="truncate">
        {workspace ? workspace : '未打开工作区'}
      </span>
      <span className="flex-shrink-0 ml-2">
        {selectedPath ? selectedPath.split('\\').pop() : ''}
      </span>
    </div>
  )

  return (
    <MainLayout
      workspaceName={workspaceName}
      sidebar={sidebarContent}
      statusBar={statusBarContent}
    >
      {editorContent}
    </MainLayout>
  )
}
