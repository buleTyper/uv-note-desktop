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
}

interface GutterEntry {
  key: string
  lineIndex: number
  lineNumber: number | null // null = 软换行延续行
  isHeading: boolean
  hasFold: boolean
  headingLine: number | null
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

// ============================
// MarkdownEditor
// ============================
export default function MarkdownEditor({
  value,
  onChange,
}: MarkdownEditorProps) {
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<number>>(
    new Set(),
  )
  const [gutterHovered, setGutterHovered] = useState(false)
  const [contentWidth, setContentWidth] = useState(0)
  // 每行（逻辑行）占几个视觉行，由镜像 div 实测得到
  const [visualLineCounts, setVisualLineCounts] = useState<number[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)

  const lines = value.split('\n')

  // ---- ResizeObserver → 编辑区内容宽度 ----
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    const ro = new ResizeObserver(() => {
      // clientWidth - 左右 padding(各 8px)
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

  // ---- 镜像 div 实测每行换行后的视觉高度 ----
  useLayoutEffect(() => {
    const mirror = mirrorRef.current
    if (!mirror || contentWidth <= 0) return

    const lineDivs = mirror.querySelectorAll<HTMLDivElement>(
      '[data-mirror-line]',
    )
    const computed = getComputedStyle(mirror)
    const lineHeight = parseFloat(computed.lineHeight)
    if (Number.isNaN(lineHeight) || lineHeight === 0) return

    const counts: number[] = []
    lineDivs.forEach(div => {
      const h = div.getBoundingClientRect().height
      counts.push(Math.max(1, Math.round(h / lineHeight)))
    })
    setVisualLineCounts(counts)
  }, [value, contentWidth])

  // ---- 解析标题折叠信息 ----
  const headings = useMemo(() => parseHeadings(lines), [lines])

  const headingRangeMap = useMemo(() => {
    const m = new Map<number, { start: number; end: number }>()
    for (const h of headings) {
      if (h.foldRange) m.set(h.lineIndex, h.foldRange)
    }
    return m
  }, [headings])

  // ---- 装订线条目 ----
  const gutterEntries = useMemo((): GutterEntry[] => {
    if (visualLineCounts.length === 0) return []
    const entries: GutterEntry[] = []

    for (let i = 0; i < lines.length; i++) {
      const vLines = visualLineCounts[i] ?? 1
      const text = lines[i]
      const isHeading = /^#{1,6}\s/.test(text)
      const hasFold = isHeading && headingRangeMap.has(i)

      for (let v = 0; v < vLines; v++) {
        entries.push({
          key: `${i}-${v}`,
          lineIndex: i,
          lineNumber: v === 0 ? i + 1 : null, // 仅首行显示行号
          isHeading: v === 0 && isHeading,
          hasFold: v === 0 && hasFold,
          headingLine: hasFold ? i : null,
        })
      }
    }
    return entries
  }, [lines, visualLineCounts, headingRangeMap])

  // ---- 折叠开关 ----
  const toggleFold = useCallback((headingLine: number) => {
    setCollapsedHeadings(prev => {
      const next = new Set(prev)
      if (next.has(headingLine)) next.delete(headingLine)
      else next.add(headingLine)
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

  // ---- 空白区点击 → 聚焦末尾 ----
  const handleScrollClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA') return
    textareaRef.current?.focus()
  }, [])

  return (
    <div
      ref={scrollRef}
      className={`editor-scroll${gutterHovered ? ' editor-scroll--gutter-hover' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleScrollClick}
    >
      <div className="editor-body">
        {/* ================================================================ */}
        {/*  隐藏镜像 div：与 textarea 同宽/同字体/同换行规则，用于实测每行高度  */}
        {/* ================================================================ */}
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
        <div className="gutter" style={{ minWidth: gutterWidth }}>
          {gutterEntries.map(entry => (
            <div
              key={entry.key}
              className={`gutter-row${
                entry.isHeading ? ' gutter-row--heading' : ''
              }`}
            >
              <span className="gutter-ln">
                {entry.lineNumber ?? ''}
              </span>
              <span
                className={`fold-toggle${
                  collapsedHeadings.has(entry.headingLine ?? -1)
                    ? ' fold-toggle--visible'
                    : ''
                }`}
                onClick={e => {
                  e.stopPropagation()
                  if (entry.headingLine !== null)
                    toggleFold(entry.headingLine)
                }}
                role={entry.hasFold ? 'button' : undefined}
                aria-label={
                  entry.headingLine !== null &&
                  collapsedHeadings.has(entry.headingLine)
                    ? '展开'
                    : entry.hasFold
                      ? '折叠'
                      : undefined
                }
              >
                {entry.hasFold &&
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

        {/* ====== 编辑区 ====== */}
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const ta = e.currentTarget
              const start = ta.selectionStart
              const end = ta.selectionEnd
              const newValue =
                value.slice(0, start) + '\t' + value.slice(end)
              onChange(newValue)
              requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + 1
              })
            }
          }}
          spellCheck={false}
          placeholder="开始编辑..."
        />
      </div>
    </div>
  )
}
