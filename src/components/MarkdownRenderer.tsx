import {
  Children,
  isValidElement,
  useCallback,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'
import {
  AlertTriangle,
  BookOpen,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  Flame,
  Hash,
  HelpCircle,
  Info,
  Lightbulb,
  ListTodo,
  Quote,
  XCircle,
  ZoomIn,
} from 'lucide-react'
import type { MarkdownHeading } from '../types/vault'
import { slugify } from '../services/vaultService'
import { remarkObsidianHighlight } from '../utils/remarkObsidianHighlight'
import { MediaLightbox, type LightboxMedia } from './MediaLightbox'
import { MermaidDiagram } from './MermaidDiagram'

interface MarkdownRendererProps {
  markdown: string
  headings: MarkdownHeading[]
  onJumpToSection?: (sectionId: string) => void
}

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  jsx: 'JSX',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  tsx: 'TSX',
  html: 'HTML',
  xml: 'XML',
  svg: 'SVG',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  md: 'Markdown',
  markdown: 'Markdown',
  py: 'Python',
  python: 'Python',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Shell',
  sql: 'SQL',
  yaml: 'YAML',
  yml: 'YAML',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  cs: 'C#',
  java: 'Java',
  php: 'PHP',
  go: 'Go',
  rust: 'Rust',
  r: 'R',
  latex: 'LaTeX',
  tex: 'LaTeX',
  diff: 'Diff',
}

function getTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getTextContent).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextContent(node.props.children)
  }
  return ''
}

function getCalloutTone(type: string): string {
  if (type === 'warning' || type === 'caution' || type === 'attention' || type === 'note') {
    return 'warning'
  }
  if (
    type === 'danger' ||
    type === 'error' ||
    type === 'failure' ||
    type === 'fail' ||
    type === 'missing' ||
    type === 'bug'
  ) {
    return 'danger'
  }
  if (type === 'success' || type === 'check' || type === 'done') {
    return 'success'
  }
  if (type === 'question' || type === 'help' || type === 'faq') {
    return 'question'
  }
  if (type === 'tip' || type === 'hint' || type === 'important') {
    return 'tip'
  }
  if (type === 'quote' || type === 'cite') {
    return 'quote'
  }
  return 'info'
}

function getCalloutIcon(type: string) {
  if (type === 'quote' || type === 'cite') return <Quote size={14} />
  if (type === 'warning' || type === 'caution' || type === 'attention') {
    return <AlertTriangle size={14} />
  }
  if (type === 'danger' || type === 'error') return <Flame size={14} />
  if (type === 'failure' || type === 'fail' || type === 'missing') return <XCircle size={14} />
  if (type === 'bug') return <Bug size={14} />
  if (type === 'tip' || type === 'hint' || type === 'important') return <Lightbulb size={14} />
  if (type === 'success' || type === 'check' || type === 'done') return <CheckCircle2 size={14} />
  if (type === 'question' || type === 'help' || type === 'faq') return <HelpCircle size={14} />
  if (type === 'todo') return <ListTodo size={14} />
  if (type === 'note') return <FileText size={14} />
  if (type === 'example' || type === 'abstract' || type === 'summary' || type === 'tldr') {
    return <BookOpen size={14} />
  }
  return <Info size={14} />
}

function CollapsibleCallout({
  type,
  title,
  defaultOpen,
  children,
}: {
  type: string
  title: string
  defaultOpen: boolean
  children: ReactNode[]
}) {
  const [open, setOpen] = useState(defaultOpen)
  const tone = getCalloutTone(type)

  return (
    <aside className={`obsidian-callout callout-${type} callout-tone-${tone} is-collapsible`}>
      <button
        type="button"
        className="obsidian-callout-toggle"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="obsidian-callout-header">
          {getCalloutIcon(type)}
          <span>{title}</span>
        </span>
        <ChevronDown
          size={15}
          className={`obsidian-callout-chevron ${open ? 'open' : ''}`}
        />
      </button>
      {open && children.length > 0 && (
        <div className="obsidian-callout-body">{children}</div>
      )}
    </aside>
  )
}

function CodeBlock({
  children,
  onExpandMermaid,
}: {
  children: ReactNode
  onExpandMermaid: (svg: string, title: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const childArray = Children.toArray(children)
  const codeElement = childArray.find((child) =>
    isValidElement<{ className?: string; children?: ReactNode }>(child),
  )

  const codeClassName = isValidElement<{ className?: string }>(codeElement)
    ? (codeElement.props.className ?? '')
    : ''
  const langMatch = codeClassName.match(/language-([a-zA-Z0-9_+-]+)/)
  const langKey = langMatch ? langMatch[1].toLowerCase() : ''
  const rawCode = getTextContent(children).replace(/\n$/, '')

  if (langKey === 'mermaid') {
    return <MermaidDiagram code={rawCode} onExpand={onExpandMermaid} />
  }

  const displayLang = langKey
    ? (LANGUAGE_LABELS[langKey] ?? langKey.toUpperCase())
    : 'Codi'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignora si el navegador bloqueja el porta-retalls
    }
  }

  return (
    <div className="code-block-frame">
      <div className="code-block-header">
        <span className="code-block-lang">{displayLang}</span>
        <button
          type="button"
          className="code-copy-btn"
          onClick={() => void handleCopy()}
          aria-label="Copiar codi"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiat' : 'Copiar'}
        </button>
      </div>
      <pre className="code-block-pre">{children}</pre>
    </div>
  )
}

function parseImageMeta(rawSrc: string, rawAlt: string): {
  cleanSrc: string
  cleanAlt: string
  style?: CSSProperties
} {
  let cleanSrc = rawSrc
  let cleanAlt = rawAlt
  let width: number | undefined
  let height: number | undefined

  const hashMatch = cleanSrc.match(/#obs-size=(\d+)(?:x(\d+))?$/i)
  if (hashMatch) {
    width = Number(hashMatch[1])
    height = hashMatch[2] ? Number(hashMatch[2]) : undefined
    cleanSrc = cleanSrc.slice(0, hashMatch.index)
  }

  const altSizeMatch = cleanAlt.match(/^(.*?)\|(\d+)(?:x(\d+))?$/i)
  if (altSizeMatch) {
    cleanAlt = altSizeMatch[1].trim()
    if (!width) {
      width = Number(altSizeMatch[2])
      height = altSizeMatch[3] ? Number(altSizeMatch[3]) : undefined
    }
  }

  if (!width) {
    return { cleanSrc, cleanAlt }
  }

  const style: CSSProperties = {
    width: `${width}px`,
    maxWidth: '100%',
    ...(height ? { height: `${height}px`, objectFit: 'contain' } : {}),
  }

  return { cleanSrc, cleanAlt, style }
}

function MarkdownImage({
  src = '',
  alt = '',
  onZoom,
}: {
  src?: string
  alt?: string
  onZoom: (media: LightboxMedia) => void
}) {
  const { cleanSrc, cleanAlt, style } = parseImageMeta(src, alt)

  return (
    <span className="md-image-wrap">
      <button
        type="button"
        className="md-image-trigger"
        onClick={() => onZoom({ kind: 'image', src: cleanSrc, alt: cleanAlt })}
        aria-label={cleanAlt ? `Ampliar imatge: ${cleanAlt}` : 'Ampliar imatge'}
      >
        <img
          src={cleanSrc}
          alt={cleanAlt}
          loading="lazy"
          style={style}
          className="md-zoomable-img"
        />
        <span className="md-image-zoom-hint" aria-hidden="true">
          <ZoomIn size={13} />
          Ampliar
        </span>
      </button>
    </span>
  )
}

function ProseHeading({
  level,
  id,
  children,
  onJumpToSection,
}: {
  level: 1 | 2 | 3
  id: string
  children: ReactNode
  onJumpToSection: (sectionId: string) => void
}) {
  const content = (
    <>
      <span>{children}</span>
      <button
        type="button"
        className="heading-anchor-btn"
        title="Enllaç directe a aquesta secció"
        aria-label="Anar a aquesta secció"
        onClick={() => onJumpToSection(id)}
      >
        <Hash size={14} />
      </button>
    </>
  )

  if (level === 1) return <h1 id={id} className="prose-heading">{content}</h1>
  if (level === 2) return <h2 id={id} className="prose-heading">{content}</h2>
  return <h3 id={id} className="prose-heading">{content}</h3>
}

const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkObsidianHighlight]
const REHYPE_PLUGINS = [
  [rehypeKatex, { strict: false }] as const,
  [
    rehypeHighlight,
    { detect: false, plainText: ['mermaid', 'text', 'txt', 'plaintext'] },
  ] as const,
]

export function MarkdownRenderer({
  markdown,
  headings,
  onJumpToSection,
}: MarkdownRendererProps) {
  const [lightboxMedia, setLightboxMedia] = useState<LightboxMedia | null>(null)

  const handleJumpToSection = useCallback(
    (sectionId: string) => {
      if (onJumpToSection) {
        onJumpToSection(sectionId)
        return
      }
      const el = document.getElementById(sectionId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    [onJumpToSection],
  )

  const handleExpandMermaid = useCallback((svg: string, title: string) => {
    setLightboxMedia({ kind: 'svg', svg, title })
  }, [])

  // Mantenim un comptador pur per renderització per assignar els mateixos IDs que l'índex
  const usedCounts = new Map<string, number>()

  const resolveHeadingId = (children: ReactNode): string => {
    const plain = getTextContent(children).trim()
    const base = slugify(plain) || 'seccio'
    const currentCount = usedCounts.get(base) ?? 0
    usedCounts.set(base, currentCount + 1)
    const candidate = currentCount === 0 ? base : `${base}-${currentCount + 1}`

    const matched = headings.find((h) => h.id === candidate)
    return matched ? matched.id : candidate
  }

  return (
    <>
      <div className="editorial-prose">
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS as never}
          urlTransform={(url) => url}
          components={{
            h1: ({ children }) => (
              <ProseHeading
                level={1}
                id={resolveHeadingId(children)}
                onJumpToSection={handleJumpToSection}
              >
                {children}
              </ProseHeading>
            ),
            h2: ({ children }) => (
              <ProseHeading
                level={2}
                id={resolveHeadingId(children)}
                onJumpToSection={handleJumpToSection}
              >
                {children}
              </ProseHeading>
            ),
            h3: ({ children }) => (
              <ProseHeading
                level={3}
                id={resolveHeadingId(children)}
                onJumpToSection={handleJumpToSection}
              >
                {children}
              </ProseHeading>
            ),
            pre: ({ children }) => (
              <CodeBlock onExpandMermaid={handleExpandMermaid}>{children}</CodeBlock>
            ),
            img: ({ src, alt }) => (
              <MarkdownImage src={src} alt={alt} onZoom={setLightboxMedia} />
            ),
            table: ({ children }) => (
              <div className="table-scroll-wrap">
                <table>{children}</table>
              </div>
            ),
            a: ({ href = '', children }) => {
              if (href.startsWith('#obs-section/')) {
                const sectionId = decodeURIComponent(href.replace('#obs-section/', ''))
                return (
                  <a
                    href={`#${sectionId}`}
                    className="wikilink-section"
                    onClick={(e) => {
                      e.preventDefault()
                      handleJumpToSection(sectionId)
                    }}
                  >
                    {children}
                  </a>
                )
              }
              if (href.startsWith('#/apunt/')) {
                return <Link to={href.slice(1)}>{children}</Link>
              }
              if (href.startsWith('#/nota-pendent/')) {
                const noteTitle = decodeURIComponent(href.replace('#/nota-pendent/', ''))
                return (
                  <Link
                    to={`/colaborar?tema=${encodeURIComponent(noteTitle)}`}
                    className="wikilink-pending"
                    title="Aquest concepte encara no té fitxa pròpia. Fes clic per proposar-ne l’elaboració."
                  >
                    {children}
                  </Link>
                )
              }
              // Enllaços d'àncora interns (ex. notes al peu GFM #user-content-fn-1) sense trencar HashRouter
              if (href.startsWith('#')) {
                const targetId = decodeURIComponent(href.slice(1))
                return (
                  <a
                    href={href}
                    onClick={(e) => {
                      e.preventDefault()
                      handleJumpToSection(targetId)
                    }}
                  >
                    {children}
                  </a>
                )
              }
              return (
                <a href={href} target="_blank" rel="noreferrer">
                  {children}
                </a>
              )
            },
            blockquote: ({ children }) => {
              const childArray = Children.toArray(children).filter(
                (c) => !(typeof c === 'string' && c.trim() === ''),
              )
              const firstText = childArray[0] ? getTextContent(childArray[0]).trim() : ''
              const markerMatch = firstText.match(/^OBSCALLOUT::([^:]+)::(?:([+-]?)::)?(.*)$/)

              if (markerMatch) {
                const type = markerMatch[1].toLowerCase()
                const fold = markerMatch[2] ?? ''
                const title = markerMatch[3].trim()
                const restChildren = childArray.slice(1)
                const tone = getCalloutTone(type)

                if (fold === '-' || fold === '+') {
                  return (
                    <CollapsibleCallout
                      type={type}
                      title={title}
                      defaultOpen={fold === '+'}
                    >
                      {restChildren}
                    </CollapsibleCallout>
                  )
                }

                return (
                  <aside className={`obsidian-callout callout-${type} callout-tone-${tone}`}>
                    <div className="obsidian-callout-header">
                      {getCalloutIcon(type)}
                      <span>{title}</span>
                    </div>
                    {restChildren.length > 0 && (
                      <div className="obsidian-callout-body">{restChildren}</div>
                    )}
                  </aside>
                )
              }

              return <blockquote>{children}</blockquote>
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>

      <MediaLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
    </>
  )
}
