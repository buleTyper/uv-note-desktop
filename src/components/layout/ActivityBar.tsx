import type { LucideIcon } from 'lucide-react'
import {
  Files,
  Search,
  GitGraph,
  LayoutGrid,
  Calendar,
  Layers,
  Terminal,
  Settings,
} from 'lucide-react'

// ============================
// 类型
// ============================
export interface ActivityNavItem {
  id: string
  icon: LucideIcon
  label: string
}

/** 活动栏导航项配置 */
export const ACTIVITY_ITEMS: ActivityNavItem[] = [
  { id: 'explorer', icon: Files, label: '资源管理器' },
  { id: 'search', icon: Search, label: '搜索' },
  { id: 'graph', icon: GitGraph, label: '关系图谱' },
  { id: 'layout', icon: LayoutGrid, label: '视图布局' },
  { id: 'calendar', icon: Calendar, label: '日历' },
  { id: 'files', icon: Layers, label: '文件视图' },
  { id: 'terminal', icon: Terminal, label: '终端' },
  { id: 'settings', icon: Settings, label: '设置' },
]

// ============================
// Props
// ============================
interface ActivityBarProps {
  /** 当前激活的标签页 ID */
  activeTab: string
  /** 切换标签页回调 */
  onTabChange: (tabId: string) => void
}

// ============================
// ActivityBar 组件
// ============================
export default function ActivityBar({
  activeTab,
  onTabChange,
}: ActivityBarProps) {
  return (
    <div className="w-12 flex flex-col items-center bg-app-surface border-r border-app-border flex-shrink-0 py-1.5 gap-0.5">
      {ACTIVITY_ITEMS.map(item => {
        const isActive = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            title={item.label}
            className={`
              relative w-12 h-11 flex items-center justify-center
              transition-colors duration-100 ease-out
              ${
                isActive
                  ? 'text-white'
                  : 'text-app-text-muted hover:text-white'
              }
            `}
            aria-label={item.label}
            aria-pressed={isActive}
          >
            {/* 左侧蓝色激活指示条 */}
            {isActive && (
              <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-app-accent rounded-r-sm" />
            )}
            <item.icon size={22} strokeWidth={isActive ? 1.8 : 1.5} />
          </button>
        )
      })}
    </div>
  )
}
