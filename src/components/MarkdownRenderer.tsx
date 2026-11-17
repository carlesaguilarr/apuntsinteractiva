import { Children, isValidElement, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, BookOpen, Info, Lightbulb, Quote } from 'lucide-react'
import type { MarkdownHeading } from '../types/vault'
import { slugify } from '../services/vaultService'

interface MarkdownRendererProps {
  markdown: string
  headings: MarkdownHeading[]
}

function getTextContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getTextContent).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getTextContent(node.props.children)
  }
  return ''
}

function getCalloutIcon(type: string) {
  if (type === 'quote' || type === 'cite') return <Quote size={14} />
  if (type === 'warning' || type === 'caution' || type === 'danger') {
    return <AlertTriangle size={14} />
  }
  if (type === 'tip' || type === 'hint') return <Lightbulb size={14} />
  if (type === 'example' || type === 'abstract') return <BookOpen size={14} />
  return <Info size={14} />
}

export function MarkdownRenderer({ markdown, headings }: MarkdownRendererProps) {
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
    <div className="editorial-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{
          h1: ({ children }) => <h1 id={resolveHeadingId(children)}>{children}</h1>,
          h2: ({ children }) => <h2 id={resolveHeadingId(children)}>{children}</h2>,
          h3: ({ children }) => <h3 id={resolveHeadingId(children)}>{children}</h3>,
          a: ({ href = '', children }) => {
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
            const markerMatch = firstText.match(/^OBSCALLOUT::([^:]+)::(.*)$/)

            if (markerMatch) {
              const type = markerMatch[1].toLowerCase()
              const title = markerMatch[2].trim()
              const restChildren = childArray.slice(1)

              return (
                <aside className={`obsidian-callout callout-${type}`}>
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
  )
}
