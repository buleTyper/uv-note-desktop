import { useState, type ReactNode } from 'react'
import Titlebar from './Titlebar'
import ActivityBar from './ActivityBar'

// ============================
// Props
// ============================
interface MainLayoutProps {
  /** 工作区名称（显示在标题栏搜索框中） */
  workspaceName?: string
  /** 主内容区域 */
  children: ReactNode
  /** 侧边栏（文件树等），显示在 ActivityBar 右侧 */
  sidebar?: ReactNode
  /** 侧边栏是否可见 */
  sidebarVisible?: boolean
  /** 底部状态栏（横跨整行） */
  statusBar?: ReactNode
}

// ============================
// MainLayout 组件
// ============================
export default function MainLayout({
  workspaceName,
  children,
  sidebar,
  sidebarVisible: sidebarVisibleProp = true,
  statusBar,
}: MainLayoutProps) {
  const [sidebarVisible, setSidebarVisible] = useState(sidebarVisibleProp)
  const [activeTab, setActiveTab] = useState('explorer')

  // 切换侧边栏
  const toggleSidebar = () => setSidebarVisible(prev => !prev)

  // 点击活动栏时：
  //   - 如果点击的是当前激活项 → 切换侧边栏
  //   - 如果是其他项 → 切换到该项并展开侧边栏
  const handleTabChange = (tabId: string) => {
    if (tabId === activeTab) {
      toggleSidebar()
    } else {
      setActiveTab(tabId)
      if (!sidebarVisible) setSidebarVisible(true)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* ====== 顶部标题栏 ====== */}
      <Titlebar
        workspaceName={workspaceName}
        onToggleSidebar={toggleSidebar}
      />

      {/* ====== 主体区域 ====== */}
      <div className="flex flex-1 overflow-hidden">
        {/* 活动栏 */}
        <ActivityBar activeTab={activeTab} onTabChange={handleTabChange} />

        {/* 侧边栏（文件树等） */}
        {sidebarVisible && sidebar && (
          <div className="w-60 min-w-[180px] bg-app-surface2 border-r border-app-border overflow-hidden flex flex-col">
            {sidebar}
          </div>
        )}

        {/* 主内容区 */}
        <div className="flex-1 overflow-hidden flex flex-col bg-app-bg">
          {children}
        </div>
      </div>

      {/* ====== 底部状态栏（占满整行） ====== */}
      {statusBar}
    </div>
  )
}
