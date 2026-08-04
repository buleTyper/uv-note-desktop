/**
 * TagTreeView — 虚拟标签树视图
 * 根据 schema.json 结构渲染标签层级树
 */

import { useState, useCallback } from 'react'
import { ChevronRight, FileText } from 'lucide-react'
import type { TagTreeNode, TagSortBy } from '../../utils/types'

interface TagTreeViewProps {
  tree: TagTreeNode[]
  workspacePath: string
  workspaceName?: string
  activeFilePath?: string | null
  sortBy?: TagSortBy | null
  onOpenFile: (filePath: string, pin: boolean) => void
  onSortBy: (tagName: string, sortConfig: TagSortBy) => void
  onFileContextMenu?: (e: React.MouseEvent, filePath: string, fileName: string) => void
  onRefresh: () => void
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  tagName: string
}

export default function TagTreeView({
  tree,
  workspaceName,
  activeFilePath,
  sortBy,
  onOpenFile,
  onSortBy,
  onFileContextMenu,
}: TagTreeViewProps) {
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
  const [ctx, setCtx] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    tagName: '',
  })

  const toggleExpand = useCallback((key: string) => {
    setExpandedTags(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tagName: string) => {
      e.preventDefault()
      e.stopPropagation()
      setCtx({ visible: true, x: e.clientX, y: e.clientY, tagName })
    },
    [],
  )

  const closeCtx = useCallback(() => setCtx(p => ({ ...p, visible: false })), [])

  const handleSortName = (order: 'asc' | 'desc') => {
    onSortBy(ctx.tagName, { type: 'name', order })
    closeCtx()
  }

  const handleSortTag = (tagName: string, order: 'asc' | 'desc') => {
    onSortBy(ctx.tagName, { type: 'tag', tagName, order })
    closeCtx()
  }

  // ---- 渲染单个节点 ----
  const renderNode = useCallback(
    (node: TagTreeNode) => {
      const isExpanded = expandedTags.has(node.key)
      const isActive = !node.isTag && node.filePath === activeFilePath
      const hasChildren =
        node.isTag && node.children && node.children.length > 0

      return (
        <div key={node.key}>
          <div
            className={`tree-row ${isActive ? 'tree-row--sel' : ''}`}
            style={{ paddingLeft: node.depth * 14 + 8 }}
            onClick={() => {
              if (node.isTag && hasChildren) {
                toggleExpand(node.key)
              } else if (!node.isTag && node.filePath) {
                onOpenFile(node.filePath, false)
              }
            }}
            onDoubleClick={
              !node.isTag && node.filePath
                ? () => onOpenFile(node.filePath!, true)
                : undefined
            }
            onContextMenu={e => {
              if (node.isTag && node.tagName) {
                handleContextMenu(e, node.tagName)
              } else if (!node.isTag && node.filePath && node.fileName && onFileContextMenu) {
                onFileContextMenu(e, node.filePath, node.fileName)
              }
            }}
          >
            {/* 缩进竖线 */}
            {Array.from({ length: node.depth }, (_, i) => (
              <div
                key={`g-${i}`}
                className="tree-guide"
                style={{ left: i * 14 + 10 }}
              />
            ))}

            {/* 展开箭头 */}
            <span className="tree-arrow">
              {node.isTag && hasChildren && (
                <ChevronRight
                  size={18}
                  strokeWidth={1.5}
                  className={`transition-transform duration-150 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
              )}
            </span>

            {/* 图标：仅文件节点 */}
            {!node.isTag && (
              <span className="tree-icon">
                <FileText size={17} strokeWidth={1.5} />
              </span>
            )}

            {/* 名称 */}
            <span className="tree-name">
              {node.name}
            </span>

            {/* 匹配数 */}
            {node.isTag && node.matchCount !== undefined && node.matchCount > 0 && (
              <span className="ml-auto text-[11px] text-app-text-dim flex-shrink-0">
                {node.matchCount}
              </span>
            )}
          </div>

          {/* 子节点 */}
          {node.isTag && hasChildren && isExpanded && (
            <>{node.children!.map(child => renderNode(child))}</>
          )}
        </div>
      )
    },
    [
      expandedTags,
      activeFilePath,
      toggleExpand,
      onOpenFile,
      handleContextMenu,
      onFileContextMenu,
    ],
  )

  return (
    <>
      {/* 标签树 */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="flex items-center justify-center h-full text-app-text-dim text-[13px]">
            📭 没有标签数据，请刷新工作区
          </div>
        ) : (
          tree.map(node => renderNode(node))
        )}
      </div>

      {/* 标签节点右键菜单 */}
      {ctx.visible && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={closeCtx}
            onContextMenu={e => { e.preventDefault(); closeCtx() }}
          />
          <div
            className="tag-context-menu"
            style={{ position: 'fixed', left: ctx.x, top: ctx.y, zIndex: 9999 }}
          >
            <div className="tag-context-menu__inner">
              <div className="tag-context-menu__header">
                在「{ctx.tagName}」下按...排序
              </div>
              <button
                className={`tag-context-menu__item ${sortBy?.type === 'name' && sortBy.order === 'asc' ? 'tag-context-menu__item--active' : ''}`}
                onClick={() => handleSortName('asc')}
              >
                文件名 A→Z
              </button>
              <button
                className={`tag-context-menu__item ${sortBy?.type === 'name' && sortBy.order === 'desc' ? 'tag-context-menu__item--active' : ''}`}
                onClick={() => handleSortName('desc')}
              >
                文件名 Z→A
              </button>
              <div className="tag-context-menu__divider" />
              <button
                className="tag-context-menu__item"
                onClick={() => handleSortTag('重要程度', 'desc')}
              >
                按重要程度 ↓（数值大在前）
              </button>
              <button
                className="tag-context-menu__item"
                onClick={() => handleSortTag('重要程度', 'asc')}
              >
                按重要程度 ↑（数值小在前）
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
