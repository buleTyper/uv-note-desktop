/**
 * 标签树构建器
 *
 * 显示规则（用户定义）：
 *   文件要显示在某个标签节点下，必须：
 *     1) 拥有该标签
 *     2) 拥有该节点的所有祖先标签（往上的每一层都要满足）
 *     3) 不拥有该节点的任何子标签（排他下沉）
 *   如果文件不匹配任何标签 → 不显示在标签树中
 *
 * schema.json 初始由文件系统层级生成，用户可通过 tree.txt 编辑。
 * tree.txt 用缩进表示层级关系。
 */

import type {
  TagsIndex,
  TagsSchema,
  TagTreeNode,
  TagSchemaNode,
  TagSortBy,
} from './types'

export type { TagTreeNode, TagSortBy }

// ============================
// 构建标签树
// ============================

/** schema + index → UI 树 */
export function buildTagTree(
  schema: TagsSchema,
  index: TagsIndex | null,
  workspacePath: string,
  sortBy?: TagSortBy,
): TagTreeNode[] {
  if (!index || !schema?.tree) return []

  const result = buildNodeChildren(
    schema.tree,
    index,
    workspacePath,
    [],
    0,
    sortBy,
  )

  // 收集所有已被放置到树中的 FileID
  const placedFids = new Set<string>()
  function collectFids(nodes: TagTreeNode[]) {
    for (const node of nodes) {
      if (!node.isTag && node.fileId) placedFids.add(node.fileId)
      if (node.isTag && node.children) collectFids(node.children)
    }
  }
  collectFids(result)

  // 所有不匹配任何 schema 标签的文件 → 放到"未分类"节点下
  const unmatchedFiles: TagTreeNode[] = []
  for (const [fid, entry] of Object.entries(index.files)) {
    if (!placedFids.has(fid)) {
      const fileName = entry.relativePath.split('/').pop() || entry.relativePath
      unmatchedFiles.push({
        key: `file-${fid}`,
        name: fileName,
        depth: 1,
        isTag: false,
        fileId: fid,
        filePath: workspacePath + '/' + entry.relativePath,
        fileName,
        metaValues: entry.metaValues,
        ancestorTags: [],
      })
    }
  }

  if (unmatchedFiles.length > 0) {
    unmatchedFiles.sort((a, b) => a.name.localeCompare(b.name))
    result.push({
      key: 'tag-__uncategorized__',
      name: '未分类',
      depth: 0,
      isTag: true,
      tagName: '未分类',
      children: unmatchedFiles,
      matchCount: unmatchedFiles.length,
      ancestorTags: [],
    })
  }

  return result
}

// ============================
// 内部递归
// ============================

/**
 * @param ancestorTags - 从根到当前节点（不含）的标签名列表
 */
function buildNodeChildren(
  node: TagSchemaNode,
  index: TagsIndex,
  workspacePath: string,
  ancestorTags: string[],
  depth: number,
  sortBy?: TagSortBy,
): TagTreeNode[] {
  const result: TagTreeNode[] = []

  // 1) 子 schema 节点 → 标签分组
  if (node.children) {
    for (const child of node.children) {
      const childAncestors = [...ancestorTags, child.name]
      result.push(
        buildTagNode(child, index, workspacePath, childAncestors, depth, sortBy),
      )
    }
  }

  // 2) 找出直接属于此节点的文件
  // 条件：文件拥有 ancestorTags 中所有标签 + 拥有当前节点标签，且不拥有任何子标签
  const allChildTagNames = new Set<string>()
  if (node.children) {
    for (const child of node.children) {
      collectAllNames(child, allChildTagNames)
    }
  }

  // 此节点要求的全部标签 = 祖先 + 自身
  const requiredTags = [...ancestorTags]

  // 对于 root 节点，我们处理特殊逻辑：
  // root 是虚拟根，没有自己的标签名，只展示其子节点
  // 不在这里处理文件

  const directFiles: string[] = []

  if (node.name !== 'root') {
    // 找到 tagIndex 中匹配此节点名的文件
    const candidateIds = index.tagIndex[node.name] || []

    for (const fid of candidateIds) {
      const fileEntry = index.files[fid]
      if (!fileEntry) continue

      const fileTags = new Set([
        ...(fileEntry.pathTags || []),
        ...(fileEntry.contentTags || []),
      ])

      // 检查是否满足所有祖先标签
      const allAncestorsOk = ancestorTags.every(t => fileTags.has(t))

      if (!allAncestorsOk) continue

      // 排他：不能拥有任何子标签
      if (allChildTagNames.size > 0) {
        const hasChildTag = [...allChildTagNames].some(t => fileTags.has(t))
        if (hasChildTag) continue
      }

      directFiles.push(fid)
    }
  }

  // 创建文件节点
  for (const fid of directFiles) {
    const fileEntry = index.files[fid]
    if (!fileEntry) continue
    const fileName =
      fileEntry.relativePath.split('/').pop() || fileEntry.relativePath

    result.push({
      key: `file-${fid}`,
      name: fileName,
      depth,
      isTag: false,
      fileId: fid,
      filePath: workspacePath + '/' + fileEntry.relativePath,
      fileName,
      metaValues: fileEntry.metaValues,
      ancestorTags: [...ancestorTags, node.name],
    })
  }

  // 排序：标签节点在前，文件节点在后
  result.sort((a, b) => {
    if (a.isTag !== b.isTag) return a.isTag ? -1 : 1
    if (sortBy) return compareNodes(a, b, sortBy)
    return a.name.localeCompare(b.name)
  })

  return result
}

function buildTagNode(
  schemaNode: TagSchemaNode,
  index: TagsIndex,
  workspacePath: string,
  ancestorTags: string[],
  depth: number,
  sortBy?: TagSortBy,
): TagTreeNode {
  const children = buildNodeChildren(
    schemaNode,
    index,
    workspacePath,
    ancestorTags,
    depth + 1,
    sortBy,
  )

  const matchCount = countFiles(children)

  return {
    key: `tag-${ancestorTags.join('/')}-${schemaNode.name}`,
    name: schemaNode.name,
    depth,
    isTag: true,
    tagName: schemaNode.name,
    children,
    matchCount,
    ancestorTags,
  }
}

function collectAllNames(node: TagSchemaNode, set: Set<string>) {
  set.add(node.name)
  if (node.children) {
    for (const child of node.children) collectAllNames(child, set)
  }
}

function countFiles(nodes: TagTreeNode[]): number {
  let count = 0
  for (const node of nodes) {
    if (node.isTag && node.children) count += countFiles(node.children)
    else if (!node.isTag) count++
  }
  return count
}

function compareNodes(
  a: TagTreeNode,
  b: TagTreeNode,
  sortBy: TagSortBy,
): number {
  const order = sortBy.order === 'asc' ? 1 : -1
  if (sortBy.type === 'name') return a.name.localeCompare(b.name) * order
  if (sortBy.type === 'tag') {
    const va = a.metaValues?.[sortBy.tagName] ?? 0
    const vb = b.metaValues?.[sortBy.tagName] ?? 0
    return (va - vb) * order
  }
  return 0
}

// ============================
// 默认 schema（从文件系统层级生成，由主进程完成，这里作为 fallback）
// ============================

export function createDefaultSchema(
  allTags: string[],
  _index?: TagsIndex,
): TagsSchema {
  const unique = [...new Set(allTags)].sort()
  return {
    tree: {
      name: 'root',
      children: unique.map(t => ({ name: t })),
    },
  }
}
