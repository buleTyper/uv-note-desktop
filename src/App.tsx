import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, FileText, X } from 'lucide-react'
import MainLayout from './components/layout/MainLayout'

// ============================
// 类型
// ============================
interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

/** 编辑器 Tab 标签页 */
interface Tab {
  id: string // 唯一标识（等于 filePath）
  path: string // 文件路径
  name: string // 显示名称（文件名）
  content: string // 已保存的原始内容
  editContent: string // 当前编辑中的内容
  isDirty: boolean // 是否有未保存的修改
  isPreview: boolean // 是否为"临时预览"Tab（可被替换）
}

// ============================
// 工具函数
// ============================
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

  // ---- 多 Tab 状态 ----
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // 当前激活的 Tab
  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  // ============================
  // 选择工作区
  // ============================
  const openWorkspace = useCallback(async () => {
    const fp = await window.electronAPI.selectFolder()
    if (!fp) return
    setWorkspace(fp)
    const entries = await window.electronAPI.readDirectory(fp)
    setFiles(entries)
    setExpanded(new Set())
    setChildren({})
    setTabs([])
    setActiveTabId(null)
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

  // ============================
  // 展开/折叠目录
  // ============================
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

  // ============================
  // Tab 核心逻辑
  // ============================

  /**
   * 打开文件
   * @param filePath 文件路径
   * @param pin 是否为"固定"模式（双击/编辑触发），false 则为"预览"模式
   */
  const openFile = useCallback(
    async (filePath: string, pin = false) => {
      // 读取文件内容
      const r = await window.electronAPI.readFile(filePath)
      const fileContent = r.success
        ? r.content ?? ''
        : `读取失败: ${r.error}`
      const fileName = filePath.split('\\').pop() || filePath

      setTabs(prev => {
        // 1) 已打开 → 只需切换（pin 的话顺便固定）
        const existIdx = prev.findIndex(t => t.path === filePath)
        if (existIdx >= 0) {
          return pin
            ? prev.map(t =>
                t.path === filePath ? { ...t, isPreview: false } : t,
              )
            : prev
        }

        // 2) 预览模式 → 尝试替换已有的未修改预览 Tab
        if (!pin) {
          const previewIdx = prev.findIndex(
            t => t.isPreview && !t.isDirty,
          )
          if (previewIdx >= 0) {
            return prev.map((t, i) =>
              i === previewIdx
                ? {
                    id: filePath,
                    path: filePath,
                    name: fileName,
                    content: fileContent,
                    editContent: fileContent,
                    isDirty: false,
                    isPreview: true,
                  }
                : t,
            )
          }
        }

        // 3) 新建 Tab
        const newTab: Tab = {
          id: filePath,
          path: filePath,
          name: fileName,
          content: fileContent,
          editContent: fileContent,
          isDirty: false,
          isPreview: !pin,
        }
        return [...prev, newTab]
      })

      setActiveTabId(filePath)
    },
    [],
  )

  /** 关闭 Tab */
  const closeTab = useCallback(
    (tabId: string) => {
      setTabs(prev => {
        const idx = prev.findIndex(t => t.id === tabId)
        if (idx < 0) return prev

        const newTabs = prev.filter(t => t.id !== tabId)

        // 如果关闭的是当前激活 Tab，切换到相邻 Tab
        if (tabId === activeTabId) {
          const nextTab =
            newTabs[Math.min(idx, newTabs.length - 1)] ?? null
          setActiveTabId(nextTab?.id ?? null)
        }

        return newTabs
      })
    },
    [activeTabId],
  )

  /** 切换 Tab */
  const switchTab = useCallback((tabId: string) => {
    setActiveTabId(tabId)
  }, [])

  /** 编辑内容变更 → 顺便固定预览 Tab */
  const handleEditChange = useCallback(
    (newContent: string) => {
      if (!activeTabId) return
      setTabs(prev =>
        prev.map(t =>
          t.id === activeTabId
            ? {
                ...t,
                editContent: newContent,
                isDirty: newContent !== t.content,
                isPreview: false, // 编辑即固定
              }
            : t,
        ),
      )
    },
    [activeTabId],
  )

  // ============================
  // 保存 Ctrl+S
  // ============================
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!activeTab || !activeTab.isDirty) return
        ;(async () => {
          const r = await window.electronAPI.saveFile(
            activeTab.path,
            activeTab.editContent,
          )
          if (r.success) {
            setTabs(prev =>
              prev.map(t =>
                t.id === activeTab.id
                  ? { ...t, content: t.editContent, isDirty: false }
                  : t,
              ),
            )
          } else {
            alert('保存失败: ' + r.error)
          }
        })()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [activeTab])

  // ============================
  // 文件树渲染
  // ============================
  const renderTree = useCallback(
    (entries: FileEntry[], depth: number): JSX.Element[] => {
      return sortFiles(entries).map(e => {
        const isDir = e.isDirectory
        const isExpanded = expanded.has(e.path)
        const isSelected =
          !isDir && tabs.some(t => t.path === e.path && t.id === activeTabId)

        return (
          <div key={e.path}>
            <div
              className={`tree-row ${
                isSelected ? 'tree-row--sel' : ''
              }`}
              style={{ paddingLeft: depth * 12 + 8 }}
              onClick={() => {
                if (isDir) {
                  toggleDir(e.path)
                } else {
                  openFile(e.path, false) // 单击 → 预览模式
                }
              }}
              onDoubleClick={
                !isDir
                  ? () => openFile(e.path, true) // 双击 → 固定
                  : undefined
              }
            >
              {/* 层级竖线 */}
              {Array.from({ length: depth }, (_, i) => (
                <div
                  key={`g-${i}`}
                  className="tree-guide"
                  style={{ left: i * 12 + 10 }}
                />
              ))}

              {/* 展开箭头（目录） */}
              <span className="tree-arrow">
                {isDir && (
                  <ChevronRight
                    size={18}
                    strokeWidth={1.5}
                    className={`transition-transform duration-150 ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                )}
              </span>

              {/* 文件图标（文件）; 目录不显示 */}
              <span className="tree-icon">
                {!isDir && <FileText size={17} strokeWidth={1.5} />}
              </span>

              <span className="tree-name">{e.name}</span>
            </div>

            {isDir && isExpanded && (
              <>
                {renderTree(children[e.path] ?? [], depth + 1)}
              </>
            )}
          </div>
        )
      })
    },
    [expanded, children, tabs, activeTabId, toggleDir, openFile],
  )

  // ============================
  // 提取工作区名称
  // ============================
  const workspaceName = workspace
    ? workspace.split('\\').pop() || workspace
    : undefined

  // ============================
  // 侧边栏（文件树）
  // ============================
  const sidebarContent = (
    <>
      <div className="h-9 flex items-center justify-between px-3 text-[11px] font-semibold text-app-text-muted border-b border-app-border flex-shrink-0">
        <span>资源管理器</span>
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
      {/* ====== Tab 栏 ====== */}
      {tabs.length > 0 ? (
        <div className="tab-bar">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                className={`tab-item group ${
                  isActive ? 'tab-item--active' : ''
                }`}
                onClick={() => switchTab(tab.id)}
                title={tab.path}
              >
                {/* 文件名 */}
                <span className="tab-name">{tab.name}</span>

                {/* 操作区：dirty dot ↔ close x */}
                <span
                  className="tab-action"
                  onClick={e => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  title="关闭"
                >
                  {tab.isDirty ? (
                    <>
                      {/* 未悬浮：白色实心圆点 */}
                      <span className="tab-dirty-dot text-[16px] leading-none text-white">
                        ●
                      </span>
                      {/* 悬浮时：显示 × */}
                      <X
                        size={14}
                        strokeWidth={1.5}
                        className="tab-close-x"
                      />
                    </>
                  ) : (
                    <X
                      size={14}
                      strokeWidth={1.5}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        /* 无 Tab 时的占位栏 */
        <div className="h-9 flex items-center px-4 text-[12px] text-app-text-muted border-b border-app-border bg-app-surface flex-shrink-0" />
      )}

      {/* ====== 编辑器 ====== */}
      {activeTab ? (
        <textarea
          className="flex-1 px-6 py-4 font-mono text-[14px] leading-relaxed text-app-text bg-transparent border-none outline-none resize-none editor-area"
          value={activeTab.editContent}
          onChange={e => handleEditChange(e.target.value)}
          spellCheck={false}
          placeholder="开始编辑..."
        />
      ) : (
        <div className="flex items-center justify-center flex-1 text-app-text-dim text-[14px]">
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
        {activeTab ? activeTab.name : ''}
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
