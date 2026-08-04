/**
 * 标签系统公共类型
 */

// ---- index.json ----

/** index.json 中的单个文件条目 */
export interface TagFileEntry {
  relativePath: string       // 相对于工作区的路径
  pathTags: string[]         // 由路径决定的标签
  contentTags: string[]      // 文件内 #手写 的标签
  metaValues: Record<string, number>  // #标签:数值
  birthtimeMs: number        // 文件创建时间戳
}

/** index.json 完整结构 */
export interface TagsIndex {
  files: Record<string, TagFileEntry>   // Record<FileID, TagFileEntry>
  tagIndex: Record<string, string[]>    // Record<TagName, FileID[]>
  lastScanTime: string
}

// ---- schema.json ----

export interface TagSchemaNode {
  name: string
  children?: TagSchemaNode[]
}

export interface TagsSchema {
  tree: TagSchemaNode
}

// ---- UI 用 ----

export interface TagTreeNode {
  key: string
  name: string
  depth: number
  isTag: boolean           // true=标签分类节点  false=文件节点
  tagName?: string
  fileId?: string
  filePath?: string
  fileName?: string
  metaValues?: Record<string, number>
  children?: TagTreeNode[]
  matchCount?: number
  ancestorTags: string[]   // 从根到此节点的所有标签名（含自身）
}

export type TagSortBy =
  | { type: 'name'; order: 'asc' | 'desc' }
  | { type: 'tag'; tagName: string; order: 'asc' | 'desc' }
