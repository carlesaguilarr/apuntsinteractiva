import { useEffect, useId, useState } from 'react'
import { AlertTriangle, Check, Copy, Maximize2 } from 'lucide-react'
import { useTheme } from '../context/themeStore'

interface MermaidDiagramProps {
  code: string
  onExpand?: (svg: string, title: string) => void
}

interface MermaidRenderState {
  key: string
  svg: string | null
  error: string | null
}

let renderQueue: Promise<unknown> = Promise.resolve()
let renderCounter = 0

function enqueueMermaidRender<T>(task: () => Promise<T>): Promise<T> {
  const next = renderQueue.then(task, task)
  renderQueue = next.catch(() => undefined)
  return next
}

function getThemeVariables(theme: 'light' | 'dark') {
  if (theme === 'dark') {
    return {
      darkMode: true,
      background: '#181613',
      primaryColor: '#211e1a',
      primaryTextColor: '#f3eee5',
      primaryBorderColor: '#5bb381',
      secondaryColor: '#2a2621',
      secondaryTextColor: '#f3eee5',
      secondaryBorderColor: '#cba866',
      tertiaryColor: '#1c1a16',
      tertiaryTextColor: '#d4ccc0',
      lineColor: '#a69d90',
      textColor: '#f3eee5',
      mainBkg: '#211e1a',
      nodeBorder: '#5bb381',
      clusterBkg: '#1c1a16',
      clusterBorder: '#3e3830',
      edgeLabelBackground: '#181613',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      fontSize: '14px',
    }
  }

  return {
    darkMode: false,
    background: '#ffffff',
    primaryColor: '#f3eee4',
    primaryTextColor: '#161412',
    primaryBorderColor: '#185838',
    secondaryColor: '#f6f2ea',
    secondaryTextColor: '#161412',
    secondaryBorderColor: '#8a6c34',
    tertiaryColor: '#faf8f4',
    tertiaryTextColor: '#2d2925',
    lineColor: '#625b51',
    textColor: '#161412',
    mainBkg: '#f3eee4',
    nodeBorder: '#185838',
    clusterBkg: '#faf8f4',
    clusterBorder: '#cfc5b4',
    edgeLabelBackground: '#ffffff',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    fontSize: '14px',
  }
}

export function MermaidDiagram({ code, onExpand }: MermaidDiagramProps) {
  const { theme } = useTheme()
  const rawId = useId()
  const [copied, setCopied] = useState(false)
  const trimmedCode = code.trim()
  const renderKey = `${theme}:${trimmedCode}`
  const [state, setState] = useState<MermaidRenderState | null>(null)

  useEffect(() => {
    if (!trimmedCode) return

    let cancelled = false

    enqueueMermaidRender(async () => {
      const { default: mermaid } = await import('mermaid')
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        suppressErrorRendering: true,
        theme: 'base',
        themeVariables: getThemeVariables(theme),
      })

      renderCounter += 1
      const cleanId = `obs-mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-${renderCounter}`
      const { svg } = await mermaid.render(cleanId, trimmedCode)
      return svg
    })
      .then((svg) => {
        if (!cancelled) {
          setState({ key: renderKey, svg, error: null })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            key: renderKey,
            svg: null,
            error:
              err instanceof Error
                ? err.message
                : 'No s’ha pogut renderitzar el diagrama Mermaid.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [rawId, renderKey, theme, trimmedCode])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trimmedCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignora si el navegador bloqueja el porta-retalls
    }
  }

  const isLoading = !state || state.key !== renderKey
  const activeSvg = state?.key === renderKey ? state.svg : null
  const activeError = state?.key === renderKey ? state.error : null

  return (
    <figure className="mermaid-block">
      <div className="code-block-header">
        <span className="code-block-lang">Diagrama · Mermaid</span>
        <div className="code-block-actions">
          {activeSvg && onExpand && (
            <button
              type="button"
              className="code-copy-btn"
              onClick={() => onExpand(activeSvg, 'Diagrama Mermaid')}
              title="Ampliar diagrama"
            >
              <Maximize2 size={12} />
              Ampliar
            </button>
          )}
          <button
            type="button"
            className="code-copy-btn"
            onClick={() => void handleCopy()}
            title="Copiar font Mermaid"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copiat' : 'Copiar'}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="mermaid-loading">
          <div className="skeleton-box" style={{ height: '140px', width: '100%' }} />
        </div>
      ) : activeError ? (
        <div className="mermaid-error">
          <div className="mermaid-error-title">
            <AlertTriangle size={15} />
            <span>No s’ha pogut dibuixar aquest diagrama Mermaid</span>
          </div>
          <p className="mermaid-error-msg">{activeError}</p>
          <details className="mermaid-source-details">
            <summary>Veure codi font del diagrama</summary>
            <pre>
              <code>{trimmedCode}</code>
            </pre>
          </details>
        </div>
      ) : activeSvg ? (
        <div
          className="mermaid-canvas"
          role="button"
          tabIndex={0}
          aria-label="Ampliar diagrama Mermaid"
          onClick={() => onExpand?.(activeSvg, 'Diagrama Mermaid')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onExpand?.(activeSvg, 'Diagrama Mermaid')
            }
          }}
          dangerouslySetInnerHTML={{ __html: activeSvg }}
        />
      ) : null}
    </figure>
  )
}
