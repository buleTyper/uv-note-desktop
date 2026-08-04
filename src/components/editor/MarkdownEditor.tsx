import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

// ============================
// 类型
// ============================
interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  /** 工作区路径（用于图片保存） */
  workspacePath?: string | null
}

interface GutterEntry {
  key: string
  lineIndex: number
  lineNumber: number | null
  isHeading: boolean
  hasFold: boolean
  headingLine: number | null
  /** 图片折叠行（挂在上一个逻辑行下方） */
  isImageFold: boolean
  imageLine: number | null
  isImageExpanded: boolean
}

interface HeadingInfo {
  lineIndex: number
  level: number
  foldRange: { start: number; end: number } | null
}

// ============================
// 工具
// ============================
function parseHeadings(lines: string[]): HeadingInfo[] {
  const result: HeadingInfo[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/)
    if (!m) continue
    result.push({ lineIndex: i, level: m[1].length, foldRange: null })
  }
  for (let i = 0; i < result.length; i++) {
    const h = result[i]
    const start = h.lineIndex + 1
    let end = lines.length - 1
    for (let j = i + 1; j < result.length; j++) {
      if (result[j].level <= h.level) {
        end = result[j].lineIndex - 1
        break
      }
    }
    if (start <= end) h.foldRange = { start, end }
  }
  return result
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 检测行内图片引用，返回 [alt, url][] */
function parseImageRefs(
  line: string,
): { alt: string; url: string }[] {
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g
  const refs: { alt: string; url: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    refs.push({ alt: m[1], url: m[2] })
  }
  return refs
}

/** 语法高亮（纯字符串 → HTML） */
function highlightLine(line: string): string {
  let html = escapeHtml(line)

  // 图片引用
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<span class="syntax-image">![$1]($2)</span>',
  )
  // 链接
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<span class="syntax-link">$1</span>',
  )
  // 加粗 ** **
  html = html.replace(
    /\*\*(.+?)\*\*/g,
    '<span class="syntax-bracket">**</span><span class="syntax-bold">$1</span><span class="syntax-bracket">**</span>',
  )
  // 斜体 * *（单星号，不匹配 **）
  html = html.replace(
    /(?<!\*)\*([^*]+)\*(?!\*)/g,
    '<span class="syntax-bracket">*</span><span class="syntax-italic">$1</span><span class="syntax-bracket">*</span>',
  )
  // 删除线 ~~ ~~
  html = html.replace(
    /~~(.+?)~~/g,
    '<span class="syntax-bracket">~~</span><span class="syntax-strike">$1</span><span class="syntax-bracket">~~</span>',
  )
  // 行内代码 ` `
  html = html.replace(
    /`([^`]+)`/g,
    '<span class="syntax-bracket">`</span><span class="syntax-code">$1</span><span class="syntax-bracket">`</span>',
  )
  // 标题
  html = html.replace(
    /^(#{1,6})\s(.+)$/,
    '<span class="syntax-bracket">$1</span> <span class="syntax-heading">$2</span>',
  )

  return html
}

// ============================
// MarkdownEditor 组件
// ============================
export default function MarkdownEditor({
  value,
  onChange,
  workspacePath,
}: MarkdownEditorProps) {
  // ---- 折叠状态 ----
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<number>>(
    new Set(),
  )
  const [collapsedImages, setCollapsedImages] = useState<Set<string>>(
    new Set(),
  ) // key = `${lineIndex}-${url}`

  // ---- UI 状态 ----
  const [gutterHovered, setGutterHovered] = useState(false)
  const [contentWidth, setContentWidth] = useState(0)
  const [visualLineCounts, setVisualLineCounts] = useState<number[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)

  const lines = value.split('\n')

  // ---- ResizeObserver → 内容宽度 ----
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const ro = new ResizeObserver(() => {
      setContentWidth(ta.clientWidth - 16)
    })
    ro.observe(ta)
    setContentWidth(ta.clientWidth - 16)
    return () => ro.disconnect()
  }, [])

  // ---- 自动撑高 textarea ----
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
  }, [value, contentWidth])

  // ---- 镜像实测换行 ----
  useLayoutEffect(() => {
    const mirror = mirrorRef.current
    if (!mirror || contentWidth <= 0) return
    const divs = mirror.querySelectorAll<HTMLDivElement>('[data-mirror-line]')
    const cs = getComputedStyle(mirror)
    const lh = parseFloat(cs.lineHeight)
    if (Number.isNaN(lh) || lh === 0) return
    const counts: number[] = []
    divs.forEach(d => {
      counts.push(Math.max(1, Math.round(d.getBoundingClientRect().height / lh)))
    })
    setVisualLineCounts(counts)
  }, [value, contentWidth])

  // ---- 标题解析 ----
  const headings = useMemo(() => parseHeadings(lines), [lines])
  const headingRangeMap = useMemo(() => {
    const m = new Map<number, { start: number; end: number }>()
    for (const h of headings) {
      if (h.foldRange) m.set(h.lineIndex, h.foldRange)
    }
    return m
  }, [headings])

  // ---- 图片引用解析 ----
  const imageLines = useMemo(() => {
    const m = new Map<number, { alt: string; url: string }[]>()
    lines.forEach((line, i) => {
      const refs = parseImageRefs(line)
      if (refs.length > 0) m.set(i, refs)
    })
    return m
  }, [lines])

  // ---- 装订线条目 ----
  const gutterEntries = useMemo((): GutterEntry[] => {
    if (visualLineCounts.length === 0) return []
    const entries: GutterEntry[] = []
    const imgLines = imageLines

    for (let i = 0; i < lines.length; i++) {
      const vLines = visualLineCounts[i] ?? 1
      const text = lines[i]
      const isHeading = /^#{1,6}\s/.test(text)
      const hasFold = isHeading && headingRangeMap.has(i)
      const imgRefs = imgLines.get(i)

      for (let v = 0; v < vLines; v++) {
        entries.push({
          key: `${i}-t${v}`,
          lineIndex: i,
          lineNumber: v === 0 ? i + 1 : null,
          isHeading: v === 0 && isHeading,
          hasFold: v === 0 && hasFold,
          headingLine: hasFold ? i : null,
          isImageFold: false,
          imageLine: null,
          isImageExpanded: false,
        })
      }

      // 图片预览行（仅当有图片引用且未折叠时）
      if (imgRefs) {
        for (const ref of imgRefs) {
          const imgKey = `${i}-${ref.url}`
          const expanded = !collapsedImages.has(imgKey)
          entries.push({
            key: `${i}-img-${ref.url}`,
            lineIndex: i,
            lineNumber: null,
            isHeading: false,
            hasFold: false,
            headingLine: null,
            isImageFold: true,
            imageLine: i,
            isImageExpanded: expanded,
          })
        }
      }
    }
    return entries
  }, [lines, visualLineCounts, headingRangeMap, imageLines, collapsedImages])

  // ---- 折叠操作 ----
  const toggleFold = useCallback((headingLine: number) => {
    setCollapsedHeadings(prev => {
      const next = new Set(prev)
      if (next.has(headingLine)) next.delete(headingLine)
      else next.add(headingLine)
      return next
    })
  }, [])

  const toggleImage = useCallback((imgKey: string) => {
    setCollapsedImages(prev => {
      const next = new Set(prev)
      if (next.has(imgKey)) next.delete(imgKey)
      else next.add(imgKey)
      return next
    })
  }, [])

  // ---- 装订线 hover ----
  const gutterDigits = Math.max(3, String(lines.length).length)
  const gutterWidth = gutterDigits * 9 + 40

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = scrollRef.current?.getBoundingClientRect()
      if (!rect) return
      setGutterHovered(e.clientX - rect.left < gutterWidth)
    },
    [gutterWidth],
  )
  const handleMouseLeave = useCallback(() => setGutterHovered(false), [])

  // ---- 空白区点击 → 聚焦 textarea ----
  const handleScrollClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA') return
    // 如果点击图片预览上的按钮，不抢焦点
    if (target.closest('.image-preview-row')) return
    if (target.closest('.fold-toggle')) return
    textareaRef.current?.focus()
  }, [])

  // ---- 粘贴图片 ----
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items || !workspacePath) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const blob = item.getAsFile()
          if (!blob) continue

          // 读取为 base64
          const base64: string = await new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })

          const result = await window.electronAPI.saveClipboardImage(
            workspacePath,
            base64,
          )
          if (result.success && result.path) {
            const ta = textareaRef.current
            if (!ta) return
            const pos = ta.selectionStart
            const syntax = `![image](${result.path})`
            const newValue =
              value.slice(0, pos) + syntax + value.slice(ta.selectionEnd)
            onChange(newValue)
            // 恢复光标
            requestAnimationFrame(() => {
              ta.focus()
              ta.selectionStart = ta.selectionEnd = pos + syntax.length
            })
          }
          break // 只处理第一张图片
        }
      }
    },
    [value, onChange, workspacePath],
  )

  // ---- 拼接图片 URL ----
  const resolveImageSrc = useCallback(
    (url: string): string => {
      if (url.startsWith('http://') || url.startsWith('https://')) return url
      if (workspacePath) {
        // 相对路径 → 绝对路径
        const abs = url.replace(/\\/g, '/')
        return `file:///${workspacePath.replace(/\\/g, '/')}/${abs}`
      }
      return url
    },
    [workspacePath],
  )

  return (
    <div
      ref={scrollRef}
      className={`editor-scroll${gutterHovered ? ' editor-scroll--gutter-hover' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleScrollClick}
    >
      <div className="editor-body" style={{ position: 'relative' }}>
        {/* ====== 镜像测量 div ====== */}
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className="editor-mirror"
          style={{ width: contentWidth > 0 ? contentWidth : 0 }}
        >
          {lines.map((line, i) => (
            <div key={i} data-mirror-line={i}>
              {line || ' '}
            </div>
          ))}
        </div>

        {/* ====== 装订线 ====== */}
        <div className="gutter" style={{ minWidth: gutterWidth, zIndex: 3 }}>
          {gutterEntries.map(entry => (
            <div key={entry.key} className="gutter-row">
              <span className="gutter-ln">
                {entry.lineNumber ?? ''}
              </span>
              <span
                className={`fold-toggle${
                  (entry.headingLine !== null &&
                    collapsedHeadings.has(entry.headingLine)) ||
                  entry.isImageFold
                    ? ' fold-toggle--visible'
                    : ''
                }`}
                onClick={e => {
                  e.stopPropagation()
                  if (entry.headingLine !== null) {
                    toggleFold(entry.headingLine)
                  } else if (entry.isImageFold && entry.imageLine !== null) {
                    const refs = imageLines.get(entry.imageLine)
                    if (refs) {
                      for (const ref of refs) {
                        toggleImage(`${entry.imageLine}-${ref.url}`)
                      }
                    }
                  }
                }}
                role="button"
                aria-label={
                  entry.headingLine !== null &&
                  collapsedHeadings.has(entry.headingLine)
                    ? '展开'
                    : entry.isImageFold
                      ? entry.isImageExpanded
                        ? '折叠图片'
                        : '展开图片'
                      : entry.hasFold
                        ? '折叠'
                        : undefined
                }
              >
                {(entry.headingLine !== null ||
                  entry.isImageFold) &&
                  (entry.headingLine !== null &&
                  collapsedHeadings.has(entry.headingLine) ? (
                    <ChevronRight size={14} strokeWidth={1.5} />
                  ) : (
                    <ChevronDown size={14} strokeWidth={1.5} />
                  ))}
              </span>
            </div>
          ))}
        </div>

        {/* ====== 渲染层（语法高亮 + 图片预览） ====== */}
        <div className="render-layer">
          {lines.map((line, i) => {
            const vCount = visualLineCounts[i] ?? 1
            const imgRefs = imageLines.get(i)
            const highlighted = highlightLine(line) || '&nbsp;'

            return (
              <div key={i}>
                {/* 文本行：一个逻辑行有多少视觉行就渲染多少个 div，overflow 裁剪 + translateY 偏移 */}
                {Array.from({ length: vCount }, (_, v) => (
                  <div
                    key={v}
                    className="render-line"
                    style={{ overflow: 'hidden' }}
                  >
                    <span
                      style={{
                        display: 'block',
                        position: 'relative',
                        top: `${-v * 1.6}em`,
                      }}
                      dangerouslySetInnerHTML={{ __html: highlighted }}
                    />
                  </div>
                ))}

                {/* 图片预览 */}
                {imgRefs &&
                  imgRefs.map(ref => {
                    const imgKey = `${i}-${ref.url}`
                    if (collapsedImages.has(imgKey)) return null
                    return (
                      <div key={imgKey} className="image-preview-row">
                        <img
                          src={resolveImageSrc(ref.url)}
                          alt={ref.alt || 'image'}
                          className="image-preview-img"
                          onError={e => {
                            ;(e.target as HTMLImageElement).style.display =
                              'none'
                          }}
                        />
                      </div>
                    )
                  })}
              </div>
            )
          })}
        </div>

        {/* ====== 透明 textarea（输入层） ====== */}
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          style={{
            position: 'absolute',
            top: 0,
            left: gutterWidth,
            right: 0,
            bottom: 0,
            width: undefined as any,
            height: undefined as any,
          }}
          value={value}
          onChange={e => onChange(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={e => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const ta = e.currentTarget
              const start = ta.selectionStart
              const end = ta.selectionEnd
              onChange(value.slice(0, start) + '\t' + value.slice(end))
              requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + 1
              })
            }
          }}
          spellCheck={false}
        />
      </div>
    </div>
  )
}
