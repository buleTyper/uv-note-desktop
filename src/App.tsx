import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, FileText, X, RefreshCw, AlertCircle } from 'lucide-react'
import MainLayout from './components/layout/MainLayout'
import MarkdownEditor from './components/editor/MarkdownEditor'
import TagTreeView from './components/tagTree/TagTreeView'
import { buildTagTree } from './utils/tagTreeBuilder'
import type { TagsIndex, TagsSchema, TagTreeNode, TagSortBy } from './utils/types'

// ============================
// 类型
// ============================
interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

interface Tab {
  id: string
  path: string
  name: string
  content: string
  editContent: string
  isDirty: boolean
  isPreview: boolean
}

function sortFiles(files: FileEntry[]): FileEntry[] {
  return [...files].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

// ============================
// App 组件
// ============================
export default function App() {
  // ---- 工作区 & 文件树 ----
  const [workspace, setWorkspace] = useState<string | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [children, setChildren] = useState<Record<string, FileEntry[]>>({})

  // ---- Tab 状态 ----
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // ---- 活动栏 ----
  const [activeActivityTab, setActiveActivityTab] = useState('explorer')

  // ---- 标签系统 ----
  const [tagsIndex, setTagsIndex] = useState<TagsIndex | null>(null)
  const [tagsSchema, setTagsSchema] = useState<TagsSchema | null>(null)
  const [tagTree, setTagTree] = useState<TagTreeNode[]>([])
  const [tagSortBy, setTagSortBy] = useState<TagSortBy | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const workspaceRef = useRef<string | null>(null)
  // 保持 ref 同步
  workspaceRef.current = workspace
  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  // ============================
  // 加载 & 刷新
  // ============================

  const applyTagsData = useCallback(
    (index: TagsIndex, schema: TagsSchema | null, wp: string) => {
      setTagsIndex(index)
      setTagsSchema(schema)
      if (schema) {
        setTagTree(buildTagTree(schema, index, wp, tagSortBy ?? undefined))
      }
    },
    [tagSortBy],
  )

  const loadTagsData = useCallback(async (wp: string) => {
    // 读 index
    const idxRes = await window.electronAPI.tagsReadIndex(wp)
    let index: TagsIndex | null = idxRes.success && idxRes.data ? idxRes.data : null

    // 读 schema
    const schemaRes = await window.electronAPI.tagsReadSchema(wp)
    let schema: TagsSchema | null = schemaRes.success && schemaRes.data ? schemaRes.data : null

    // 首次打开：没有 → 自动扫描
    if (!index || !schema) {
      const scanRes = await window.electronAPI.tagsScanWorkspace(wp)
      if (scanRes.success && scanRes.data) {
        index = scanRes.data
        const sRes = await window.electronAPI.tagsReadSchema(wp)
        schema = sRes.success && sRes.data ? sRes.data : null
      }
    }

    if (index && schema) {
      applyTagsData(index, schema, wp)
    } else {
      setTagsIndex(null)
      setTagsSchema(null)
      setTagTree([])
    }
  }, [applyTagsData])

  const refreshWorkspace = useCallback(async () => {
    if (!workspace) return
    setIsRefreshing(true)
    setRefreshMsg(null)
    try {
      const r = await window.electronAPI.tagsScanWorkspace(workspace)
      if (r.success && r.data) {
        const sRes = await window.electronAPI.tagsReadSchema(workspace)
        const schema = sRes.success && sRes.data ? sRes.data : null
        applyTagsData(r.data, schema, workspace)
        setRefreshMsg({ type: 'ok', text: `已刷新，${Object.keys(r.data.files).length} 个文件` })
      } else {
        setRefreshMsg({ type: 'err', text: '刷新失败: ' + (r.error || '') })
      }
    } catch (err: any) {
      setRefreshMsg({ type: 'err', text: '刷新失败: ' + (err?.message || '') })
    }
    setIsRefreshing(false)
    setTimeout(() => setRefreshMsg(null), 2500)
  }, [workspace, applyTagsData])

  // ============================
  // 工作区
  // ============================
  const openWorkspace = useCallback(async () => {
    const fp = await window.electronAPI.selectFolder()
    if (!fp) return
    setWorkspace(fp)
    const entries = await window.electronAPI.readDirectory(fp)
    setFiles(entries)
    setExpanded(new Set([fp])) // 默认展开根节点
    setChildren({})
    setTabs([])
    setActiveTabId(null)
    window.electronAPI.setAppConfig({ lastWorkspace: fp })
    await loadTagsData(fp)
  }, [loadTagsData])

  useEffect(() => {
    ;(async () => {
      const cfg = await window.electronAPI.getAppConfig()
      if (cfg.lastWorkspace) {
        const wp = cfg.lastWorkspace
        setWorkspace(wp)
        const entries = await window.electronAPI.readDirectory(wp)
        setFiles(entries)
        setExpanded(new Set([wp])) // 默认展开根节点
        await loadTagsData(wp)
      }
    })()

    // 监听 tree.txt / schema.json 外部修改 → 自动重载标签树
    const unsub = window.electronAPI.onTagsConfigChanged(async () => {
      const wp = workspaceRef.current
      if (wp) {
        const sRes = await window.electronAPI.tagsReadSchema(wp)
        const schema = sRes.success && sRes.data ? sRes.data : null
        const iRes = await window.electronAPI.tagsReadIndex(wp)
        const index = iRes.success && iRes.data ? iRes.data : null
        if (schema && index) {
          applyTagsData(index, schema, wp)
        }
      }
    })

    return () => {
      unsub()
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (workspace) window.electronAPI.tagsStopWatch(workspace)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ============================
  // 文件树
  // ============================
  const toggleDir = useCallback(
    async (p: string) => {
      const next = new Set(expanded)
      if (next.has(p)) { next.delete(p) }
      else {
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

  // ============================
  // Tab 操作
  // ============================
  const openFile = useCallback(async (filePath: string, pin = false) => {
    const r = await window.electronAPI.readFile(filePath)
    const fileContent = r.success ? r.content ?? '' : `读取失败: ${r.error}`
    const fileName = filePath.split('\\').pop() || filePath

    setTabs(prev => {
      const existIdx = prev.findIndex(t => t.path === filePath)
      if (existIdx >= 0) {
        return pin ? prev.map(t => t.path === filePath ? { ...t, isPreview: false } : t) : prev
      }
      if (!pin) {
        const previewIdx = prev.findIndex(t => t.isPreview && !t.isDirty)
        if (previewIdx >= 0) {
          return prev.map((t, i) =>
            i === previewIdx
              ? { id: filePath, path: filePath, name: fileName, content: fileContent, editContent: fileContent, isDirty: false, isPreview: true }
              : t,
          )
        }
      }
      return [...prev, { id: filePath, path: filePath, name: fileName, content: fileContent, editContent: fileContent, isDirty: false, isPreview: !pin }]
    })
    setActiveTabId(filePath)
  }, [])

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs(prev => {
        const idx = prev.findIndex(t => t.id === tabId)
        if (idx < 0) return prev
        const newTabs = prev.filter(t => t.id !== tabId)
        if (tabId === activeTabId) {
          const nextTab = newTabs[Math.min(idx, newTabs.length - 1)] ?? null
          setActiveTabId(nextTab?.id ?? null)
        }
        return newTabs
      })
    },
    [activeTabId],
  )

  const switchTab = useCallback((tabId: string) => { setActiveTabId(tabId) }, [])

  const handleEditChange = useCallback(
    (newContent: string) => {
      if (!activeTabId) return
      setTabs(prev =>
        prev.map(t =>
          t.id === activeTabId ? { ...t, editContent: newContent, isDirty: newContent !== t.content, isPreview: false } : t,
        ),
      )
      if (patchTimerRef.current) clearTimeout(patchTimerRef.current)
      patchTimerRef.current = setTimeout(async () => {
        if (!workspace || !activeTab) return
        const relPath = activeTab.path.startsWith(workspace)
          ? activeTab.path.slice(workspace.length).replace(/\\/g, '/').replace(/^\//, '')
          : activeTab.path.replace(/\\/g, '/')
        const r = await window.electronAPI.tagsPatchFile(workspace, relPath, newContent)
        if (r.success && r.data) {
          const sRes = await window.electronAPI.tagsReadSchema(workspace)
          const schema = sRes.success && sRes.data ? sRes.data : null
          applyTagsData(r.data, schema, workspace)
        }
      }, 300)
    },
    [activeTabId, activeTab, workspace, applyTagsData],
  )

  // ============================
  // Ctrl+S
  // ============================
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!activeTab || !activeTab.isDirty) return
        ;(async () => {
          const r = await window.electronAPI.saveFile(activeTab.path, activeTab.editContent)
          if (r.success) {
            setTabs(prev =>
              prev.map(t => t.id === activeTab.id ? { ...t, content: t.editContent, isDirty: false } : t),
            )
          } else { alert('保存失败: ' + r.error) }
        })()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [activeTab])

  // ============================
  // 标签排序 & 右键
  // ============================
  const handleTagSort = useCallback(
    (_tagName: string, sortConfig: TagSortBy) => {
      setTagSortBy(sortConfig)
      if (tagsIndex && tagsSchema) {
        setTagTree(buildTagTree(tagsSchema, tagsIndex, workspace!, sortConfig))
      }
    },
    [tagsIndex, tagsSchema, workspace],
  )

  const handleFileContextMenu = useCallback(
    (_e: React.MouseEvent, filePath: string, _fileName: string) => {
      openFile(filePath, true)
    },
    [openFile],
  )

  const handleActivityTabChange = useCallback(async (tabId: string) => {
    setActiveActivityTab(tabId)
    // 切换到标签树时，从磁盘重新加载（确保外部编辑 tree.txt/schema.json 后能看到）
    if (tabId === 'tags' && workspace) {
      // 先检查 tree.txt 是否比 schema.json 更新 → 如果是，从 tree.txt 重建 schema
      const treeRes = await window.electronAPI.tagsReadTreeTxt(workspace)
      const sRes = await window.electronAPI.tagsReadSchema(workspace)
      let schema = sRes.success && sRes.data ? sRes.data : null

      if (treeRes.success && treeRes.data && treeRes.data.trim()) {
        // 用 tree.txt 重建 schema（用户可能外部编辑了 tree.txt）
        const rebuiltRes = await window.electronAPI.tagsSaveTreeTxt(workspace, treeRes.data)
        if (rebuiltRes.success && rebuiltRes.data) {
          schema = rebuiltRes.data
        }
      }

      const iRes = await window.electronAPI.tagsReadIndex(workspace)
      const index = iRes.success && iRes.data ? iRes.data : null
      if (schema && index) {
        applyTagsData(index, schema, workspace)
      }
    }
  }, [workspace, applyTagsData])

  // ============================
  // 文件树渲染
  // ============================
  const renderTree = useCallback(
    (entries: FileEntry[], depth: number): JSX.Element[] => {
      return sortFiles(entries).map(e => {
        const isDir = e.isDirectory
        const isExpanded = expanded.has(e.path)
        const isSelected = !isDir && tabs.some(t => t.path === e.path && t.id === activeTabId)

        return (
          <div key={e.path}>
            <div
              className={`tree-row ${isSelected ? 'tree-row--sel' : ''}`}
              style={{ paddingLeft: depth * 12 + 8 }}
              onClick={() => { if (isDir) toggleDir(e.path); else openFile(e.path, false) }}
              onDoubleClick={!isDir ? () => openFile(e.path, true) : undefined}
              onContextMenu={!isDir ? (ev: React.MouseEvent) => handleFileContextMenu(ev, e.path, e.name) : undefined}
            >
              {Array.from({ length: depth }, (_, i) => (
                <div key={`g-${i}`} className="tree-guide" style={{ left: i * 12 + 10 }} />
              ))}
              <span className="tree-arrow">
                {isDir && <ChevronRight size={18} strokeWidth={1.5} className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />}
              </span>
              <span className="tree-icon">{!isDir && <FileText size={17} strokeWidth={1.5} />}</span>
              <span className="tree-name">{e.name}</span>
            </div>
            {isDir && isExpanded && <>{renderTree(children[e.path] ?? [], depth + 1)}</>}
          </div>
        )
      })
    },
    [expanded, children, tabs, activeTabId, toggleDir, openFile, handleFileContextMenu],
  )

  // ============================
  // 侧边栏
  // ============================
  const workspaceName = workspace ? workspace.split('\\').pop() || workspace : undefined
  const showTagTree = activeActivityTab === 'tags'
  const sidebarTitle = showTagTree ? '标签树' : '文件列表'

  const sidebarContent = (
    <>
      {/* ---- 头部：高度与 Tab 栏对齐（h-9 = 36px） ---- */}
      <div className="h-9 flex items-center justify-between px-3 text-[11px] font-semibold text-app-text-muted border-b border-app-border flex-shrink-0">
        <span>{sidebarTitle}</span>
        <div className="flex items-center gap-1">
          {showTagTree && workspace && (
            <button
              className="px-2 py-0.5 text-[11px] border border-app-border-light rounded-[3px] cursor-pointer bg-app-surface3 text-app-text hover:bg-app-hover transition-colors flex items-center gap-1"
              onClick={refreshWorkspace}
              disabled={isRefreshing}
              title="刷新标签索引"
            >
              <RefreshCw size={12} strokeWidth={1.5} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
          )}
          <button
            className="px-2 py-0.5 text-[11px] border border-app-border-light rounded-[3px] cursor-pointer bg-app-surface3 text-app-text hover:bg-app-hover transition-colors"
            onClick={openWorkspace}
          >
            {workspace ? '切换' : '打开文件夹'}
          </button>
        </div>
      </div>

      {/* ---- 刷新提示 ---- */}
      {refreshMsg && (
        <div className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] flex-shrink-0 ${refreshMsg.type === 'ok' ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
          {refreshMsg.type === 'err' && <AlertCircle size={13} strokeWidth={1.5} />}
          {refreshMsg.text}
        </div>
      )}

      {/* ---- 内容区（display:none 保持状态） ---- */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto py-1" style={{ display: showTagTree ? 'none' : 'block' }}>
          {!workspace ? (
            <div className="flex items-center justify-center h-full text-app-text-dim text-[13px]">👆 打开一个文件夹开始</div>
          ) : files.length === 0 ? (
            <div className="flex items-center justify-center h-full text-app-text-dim text-[13px]">📭 文件夹为空</div>
          ) : (
            <>
              {/* VSCode 风格：工作区文件夹名作为树的根节点 */}
              <div
                className="tree-row"
                style={{ paddingLeft: 8 }}
                onClick={() => {
                  const next = new Set(expanded)
                  if (next.has(workspace!)) next.delete(workspace!)
                  else next.add(workspace!)
                  setExpanded(next)
                }}
              >
                <span className="tree-arrow">
                  <ChevronRight
                    size={18} strokeWidth={1.5}
                    className={`transition-transform duration-150 ${expanded.has(workspace!) ? 'rotate-90' : ''}`}
                  />
                </span>
                <span className="tree-name font-bold">{workspaceName}</span>
              </div>
              {expanded.has(workspace!) && renderTree(files, 1)}
            </>
          )}
        </div>
        <div className="absolute inset-0 flex flex-col" style={{ display: showTagTree ? 'flex' : 'none' }}>
          {workspace ? (
            <TagTreeView
              tree={tagTree}
              workspacePath={workspace}
              workspaceName={workspaceName}
              activeFilePath={activeTab?.path ?? null}
              sortBy={tagSortBy}
              onOpenFile={openFile}
              onSortBy={handleTagSort}
              onFileContextMenu={handleFileContextMenu}
              onRefresh={refreshWorkspace}
            />
          ) : (
            <div className="flex items-center justify-center flex-1 text-app-text-dim text-[13px]">👆 打开一个文件夹开始</div>
          )}
        </div>
      </div>
    </>
  )

  // ============================
  // 编辑器区
  // ============================
  const editorContent = (
    <>
      {tabs.length > 0 ? (
        <div className="tab-bar">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId
            return (
              <div key={tab.id} className={`tab-item group ${isActive ? 'tab-item--active' : ''}`} onClick={() => switchTab(tab.id)} title={tab.path}>
                <span className="tab-name">{tab.name}</span>
                <span className="tab-action" onClick={e => { e.stopPropagation(); closeTab(tab.id) }} title="关闭">
                  {tab.isDirty ? (
                    <>
                      <span className="tab-dirty-dot text-[16px] leading-none text-white">●</span>
                      <X size={14} strokeWidth={1.5} className="tab-close-x" />
                    </>
                  ) : (
                    <X size={14} strokeWidth={1.5} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="h-9 flex items-center px-4 text-[12px] text-app-text-muted border-b border-app-border bg-app-surface flex-shrink-0" />
      )}
      {activeTab ? (
        <MarkdownEditor value={activeTab.editContent} onChange={handleEditChange} workspacePath={workspace} />
      ) : (
        <div className="flex items-center justify-center flex-1 text-app-text-dim text-[14px]">📂 选择文件开始编辑</div>
      )}
    </>
  )

  // ============================
  // 状态栏
  // ============================
  const statusBarContent = (
    <div className="flex items-center justify-between h-[24px] px-3 bg-app-accent-vivid text-white text-[11px] flex-shrink-0">
      <span className="truncate">{workspace || '未打开工作区'}</span>
      <span className="flex-shrink-0 ml-2 flex items-center gap-2">
        {workspace && tagsIndex && <span className="text-white/70">{Object.keys(tagsIndex.files).length} 文件</span>}
        {activeTab ? activeTab.name : ''}
      </span>
    </div>
  )

  return (
    <MainLayout
      workspaceName={workspaceName}
      sidebar={sidebarContent}
      statusBar={statusBarContent}
      activeActivityTab={activeActivityTab}
      onActivityTabChange={handleActivityTabChange}
    >
      {editorContent}
    </MainLayout>
  )
}
