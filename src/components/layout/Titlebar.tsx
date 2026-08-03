import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  PanelLeft,
  PanelBottom,
  PanelRight,
  Minus,
  Square,
  X,
} from 'lucide-react'

// ============================
// 类型
// ============================
interface MenuItem {
  label: string
}

const MENU_ITEMS: MenuItem[] = [
  { label: '文件(F)' },
  { label: '编辑(E)' },
  { label: '选择(S)' },
  { label: '查看(V)' },
  { label: '转到(G)' },
  { label: '运行(R)' },
  { label: '终端(T)' },
  { label: '帮助(H)' },
]

interface TitlebarProps {
  workspaceName?: string
  onToggleSidebar?: () => void
}

// ============================
// 还原窗口图标（两个重叠方块）
// ============================
function RestoreIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
    >
      <rect x="1.8" y="3.5" width="7.5" height="7.5" rx="0.6" />
      <rect
        x="3.7"
        y="1.5"
        width="7.5"
        height="7.5"
        rx="0.6"
        fill="#1e1e1e"
        stroke="currentColor"
      />
    </svg>
  )
}

// ============================
// Titlebar 组件
// ============================
export default function Titlebar({
  workspaceName,
  onToggleSidebar,
}: TitlebarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  // 获取初始最大化状态 + 监听变化
  useEffect(() => {
    window.electronAPI.windowIsMaximized().then(setIsMaximized)
    const unsub = window.electronAPI.onWindowMaximizeChange(setIsMaximized)
    return unsub
  }, [])

  // 点击菜单外部时关闭菜单
  useEffect(() => {
    if (!activeMenu) return
    const handleClick = () => setActiveMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [activeMenu])

  // 窗口控制
  const handleMinimize = () => window.electronAPI.windowMinimize()
  const handleMaximize = () => window.electronAPI.windowMaximize()
  const handleClose = () => window.electronAPI.windowClose()

  // 双击标题栏 → 最大化/还原
  const handleTitlebarDoubleClick = () => window.electronAPI.windowMaximize()

  // 菜单点击（阻止冒泡防止立即被外部点击关闭）
  const handleMenuClick = (label: string) => {
    setActiveMenu(prev => (prev === label ? null : label))
  }

  const dragStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

  return (
    <div
      className="flex items-center h-[34px] bg-app-surface border-b border-app-border select-none flex-shrink-0"
      style={dragStyle}
      onDoubleClick={handleTitlebarDoubleClick}
    >
      {/* ================================================================ */}
      {/*  左侧：Logo + 菜单栏                                               */}
      {/* ================================================================ */}
      <div className="flex items-center h-full" style={noDragStyle}>
        {/* App Logo — 无背景蓝色 "UV" 等宽字母 */}
        <div className="flex items-center justify-center w-12 h-full">
          <span className="text-[15px] font-bold text-app-accent font-mono tracking-tight select-none">
            UV
          </span>
        </div>

        {/* 菜单项 */}
        <nav className="flex items-center h-full">
          {MENU_ITEMS.map(item => (
            <button
              key={item.label}
              onClick={(e) => {
                e.stopPropagation()
                handleMenuClick(item.label)
              }}
              className={`
                h-full px-2 text-[12.5px] transition-colors duration-75
                ${
                  activeMenu === item.label
                    ? 'bg-app-hover text-white'
                    : 'text-app-text-muted hover:text-white hover:bg-app-hover'
                }
              `}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ================================================================ */}
      {/*  中间：导航按钮 + 全局搜索框                                        */}
      {/* ================================================================ */}
      <div
        className="flex-1 flex items-center justify-center h-full px-2"
        style={noDragStyle}
      >
        {/* 历史导航 */}
        <div className="flex items-center gap-px mr-1.5">
          <button
            className="w-7 h-7 flex items-center justify-center rounded-[4px] text-app-text-muted hover:text-white hover:bg-app-hover transition-colors"
            title="后退"
          >
            <ChevronLeft size={16} strokeWidth={1.5} />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-[4px] text-app-text-muted hover:text-white hover:bg-app-hover transition-colors"
            title="前进"
          >
            <ChevronRight size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* 全局搜索框（装饰性） */}
        <div className="flex items-center h-[26px] bg-app-input border border-app-border rounded-[5px] px-3 gap-2 max-w-[460px] w-full">
          <Search
            size={14}
            strokeWidth={1.5}
            className="text-app-text-muted flex-shrink-0"
          />
          <span className="text-[12px] text-app-text-muted truncate flex-1 text-center select-none">
            {workspaceName || 'UV Note'}
          </span>
        </div>
      </div>

      {/* ================================================================ */}
      {/*  右侧：视图切换 + 窗口控制三键                                      */}
      {/* ================================================================ */}
      <div className="flex items-center h-full" style={noDragStyle}>
        {/* 视图切换按钮 */}
        <div className="flex items-center gap-px mr-1">
          <button
            className="w-7 h-7 flex items-center justify-center rounded-[4px] text-app-text-muted hover:text-white hover:bg-app-hover transition-colors"
            title="切换侧边栏"
            onClick={onToggleSidebar}
          >
            <PanelLeft size={16} strokeWidth={1.5} />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-[4px] text-app-text-muted hover:text-white hover:bg-app-hover transition-colors"
            title="面板"
          >
            <PanelBottom size={16} strokeWidth={1.5} />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-[4px] text-app-text-muted hover:text-white hover:bg-app-hover transition-colors"
            title="右侧栏"
          >
            <PanelRight size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* ======== 窗口控制三键 ======== */}
        <div className="flex items-center h-full">
          {/* 最小化 */}
          <button
            className="w-[46px] h-full flex items-center justify-center text-app-text-muted hover:text-white hover:bg-app-hover transition-colors"
            onClick={handleMinimize}
            title="最小化"
          >
            <Minus size={15} strokeWidth={1.5} />
          </button>

          {/* 最大化 / 还原 */}
          <button
            className="w-[46px] h-full flex items-center justify-center text-app-text-muted hover:text-white hover:bg-app-hover transition-colors"
            onClick={handleMaximize}
            title={isMaximized ? '还原' : '最大化'}
          >
            {isMaximized ? (
              <RestoreIcon />
            ) : (
              <Square size={13} strokeWidth={1.5} />
            )}
          </button>

          {/* 关闭 */}
          <button
            className="w-[46px] h-full flex items-center justify-center text-app-text-muted hover:text-white hover:bg-app-close-hover transition-colors"
            onClick={handleClose}
            title="关闭"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
