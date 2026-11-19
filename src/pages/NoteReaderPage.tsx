import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  List,
  MessageSquarePlus,
} from 'lucide-react'
import { FolderTree } from '../components/FolderTree'
import { useVault } from '../context/vaultStore'
import { indexSingleRawNote } from '../services/searchIndexService'
import { fetchNoteContent, slugify } from '../services/vaultService'
import type { LoadedNote } from '../types/vault'

const MarkdownRenderer = lazy(() =>
  import('../components/MarkdownRenderer').then((mod) => ({
    default: mod.MarkdownRenderer,
  })),
)

const DEFAULT_DOCUMENT_TITLE = 'Apunts Interactiva — Arxiu Editorial · UAB'

export function NoteReaderPage() {
  const { noteSlug } = useParams<{ noteSlug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedSection = searchParams.get('seccio')

  const { catalog, loading: catalogLoading } = useVault()
  const [loadedState, setLoadedState] = useState<{ path: string; note: LoadedNote } | null>(null)
  const [errorState, setErrorState] = useState<{ path: string; message: string } | null>(null)
  const [indexOpen, setIndexOpen] = useState(false)
  const [readProgress, setReadProgress] = useState(0)
  const [activeHeadingState, setActiveHeadingState] = useState<{
    path: string
    id: string
  } | null>(null)

  const articleRef = useRef<HTMLElement | null>(null)
  const tocPanelRef = useRef<HTMLElement | null>(null)
  const lastScrolledTargetRef = useRef<string>('')

  const noteItem = useMemo(() => {
    if (!catalog || !noteSlug) return null
    let decoded = noteSlug
    try {
      decoded = decodeURIComponent(noteSlug)
    } catch {
      decoded = noteSlug
    }
    return catalog.allNotes.find((n) => n.path === decoded || n.slug === noteSlug) ?? null
  }, [catalog, noteSlug])

  const subject = useMemo(() => {
    if (!catalog || !noteItem) return null
    return catalog.subjects.find((s) => s.name === noteItem.subjectName) ?? null
  }, [catalog, noteItem])

  const { prevNote, nextNote } = useMemo(() => {
    if (!subject || !noteItem) return { prevNote: null, nextNote: null }
    const idx = subject.allNotes.findIndex((n) => n.path === noteItem.path)
    return {
      prevNote: idx > 0 ? subject.allNotes[idx - 1] : null,
      nextNote: idx >= 0 && idx < subject.allNotes.length - 1 ? subject.allNotes[idx + 1] : null,
    }
  }, [subject, noteItem])

  // Títol dinàmic de la pestanya
  useEffect(() => {
    if (noteItem) {
      document.title = `${noteItem.title} · ${noteItem.subjectName} — Apunts Interactiva`
    } else {
      document.title = DEFAULT_DOCUMENT_TITLE
    }
    return () => {
      document.title = DEFAULT_DOCUMENT_TITLE
    }
  }, [noteItem])

  // Càrrega de l'apunt Markdown
  useEffect(() => {
    if (!catalog || !noteItem || noteItem.extension === 'pdf') return

    let cancelled = false
    const targetPath = noteItem.path

    fetchNoteContent(noteItem, catalog)
      .then((res) => {
        if (!cancelled) {
          setLoadedState({ path: targetPath, note: res })
          setErrorState(null)
          indexSingleRawNote(res.item, res.rawMarkdown)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorState({
            path: targetPath,
            message:
              err instanceof Error ? err.message : 'Error inesperat en carregar l’apunt.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [catalog, noteItem])

  const loadedNote =
    noteItem && loadedState?.path === noteItem.path ? loadedState.note : null
  const error =
    noteItem && errorState?.path === noteItem.path ? errorState.message : null
  const loading = Boolean(
    noteItem && noteItem.extension !== 'pdf' && !loadedNote && !error,
  )

  const activeHeadingId =
    noteItem && activeHeadingState?.path === noteItem.path
      ? activeHeadingState.id
      : (loadedNote?.headings[0]?.id ?? '')

  const jumpToSection = useCallback(
    (rawSectionId: string, syncQueryParam = false) => {
      if (!noteItem) return
      const normalized = slugify(rawSectionId) || rawSectionId

      let targetEl =
        document.getElementById(rawSectionId) ||
        document.getElementById(normalized)

      let resolvedId = targetEl?.id ?? rawSectionId

      if (!targetEl && loadedNote) {
        const matched =
          loadedNote.headings.find((h) => h.id === normalized) ||
          loadedNote.headings.find((h) => slugify(h.text) === normalized) ||
          loadedNote.headings.find(
            (h) => h.id.includes(normalized) || slugify(h.text).includes(normalized),
          )
        if (matched) {
          resolvedId = matched.id
          targetEl = document.getElementById(matched.id)
        }
      }

      if (!targetEl) return

      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveHeadingState({ path: noteItem.path, id: resolvedId })

      targetEl.classList.remove('heading-flash')
      void targetEl.offsetWidth
      targetEl.classList.add('heading-flash')
      window.setTimeout(() => targetEl?.classList.remove('heading-flash'), 1800)

      if (syncQueryParam) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.set('seccio', resolvedId)
            return next
          },
          { replace: true },
        )
      }
    },
    [loadedNote, noteItem, setSearchParams],
  )

  // Salt automàtic a la secció indicada a ?seccio=... (des de [[Apunt#Secció]] o el cercador)
  useEffect(() => {
    if (!loadedNote || !noteItem || !requestedSection) {
      lastScrolledTargetRef.current = ''
      return
    }

    const scrollKey = `${noteItem.path}::${requestedSection}`
    if (lastScrolledTargetRef.current === scrollKey) return
    lastScrolledTargetRef.current = scrollKey

    const rafId = window.requestAnimationFrame(() => {
      const timerId = window.setTimeout(() => {
        jumpToSection(requestedSection, false)
      }, 40)
      return () => window.clearTimeout(timerId)
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [jumpToSection, loadedNote, noteItem, requestedSection])

  // Barra de progrés de lectura + Scroll-spy de la taula de continguts
  useEffect(() => {
    if (!loadedNote || !noteItem || noteItem.extension === 'pdf') return

    const headings = loadedNote.headings
    const targetPath = noteItem.path
    let rafId = 0

    const updateReadingState = () => {
      rafId = 0

      // 1. Progrés de lectura respecte a l'article
      const articleEl = articleRef.current
      if (articleEl) {
        const rect = articleEl.getBoundingClientRect()
        const articleTop = window.scrollY + rect.top
        const scrollable = Math.max(1, articleEl.offsetHeight - window.innerHeight * 0.72)
        const progressed = (window.scrollY - articleTop + 96) / scrollable
        const clamped = Math.max(0, Math.min(1, progressed))
        setReadProgress(clamped)
      }

      // 2. Scroll-spy de l'encapçalament actiu
      if (headings.length === 0) return

      const atBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 28
      if (atBottom) {
        const lastId = headings[headings.length - 1].id
        setActiveHeadingState((prev) =>
          prev?.path === targetPath && prev.id === lastId
            ? prev
            : { path: targetPath, id: lastId },
        )
        return
      }

      const threshold = 148
      let currentId = headings[0].id

      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (!el) continue
        if (el.getBoundingClientRect().top <= threshold) {
          currentId = h.id
        } else {
          break
        }
      }

      setActiveHeadingState((prev) =>
        prev?.path === targetPath && prev.id === currentId
          ? prev
          : { path: targetPath, id: currentId },
      )
    }

    const scheduleUpdate = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(updateReadingState)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate, { passive: true })

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [loadedNote, noteItem])

  // Manté visible l'element actiu dins del panell TOC sense moure el scroll de la finestra
  useEffect(() => {
    if (!activeHeadingId || !tocPanelRef.current) return
    const panel = tocPanelRef.current
    const activeLink = panel.querySelector<HTMLElement>(`[data-toc-id="${CSS.escape(activeHeadingId)}"]`)
    if (!activeLink) return

    const panelRect = panel.getBoundingClientRect()
    const itemRect = activeLink.getBoundingClientRect()
    if (itemRect.top < panelRect.top + 24 || itemRect.bottom > panelRect.bottom - 24) {
      const targetTop =
        activeLink.offsetTop - panel.clientHeight / 2 + activeLink.offsetHeight / 2
      panel.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
    }
  }, [activeHeadingId])

  if (catalogLoading && !catalog) {
    return (
      <div className="container section-block">
        <div className="skeleton-box" style={{ height: '420px' }} />
      </div>
    )
  }

  if (!noteItem) {
    return (
      <div className="container section-block">
        <div className="editorial-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <h1 className="section-title">Apunt no trobat</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
            Aquest document no existeix o s’ha mogut dins del repositori.
          </p>
          <Link to="/" className="btn-primary" style={{ marginTop: '1.25rem' }}>
            Tornar a l’inici
          </Link>
        </div>
      </div>
    )
  }

  const progressPercent = Math.round(readProgress * 100)

  return (
    <>
      {noteItem.extension !== 'pdf' && loadedNote && (
        <div
          className="reading-progress-track"
          role="progressbar"
          aria-label="Progrés de lectura"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div
            className="reading-progress-bar"
            style={{ transform: `scaleX(${readProgress})` }}
          />
        </div>
      )}

      <div className="container">
        <nav className="breadcrumbs" aria-label="Fil d’Ariadna">
          <Link to="/">Inici</Link>
          <ChevronRight size={13} />
          {subject && (
            <>
              <Link to={`/assignatura/${subject.slug}`}>{subject.name}</Link>
              <ChevronRight size={13} />
            </>
          )}
          <span style={{ color: 'var(--text-ink)' }}>{noteItem.title}</span>
        </nav>

        {subject && (
          <section className="subject-index-drawer" aria-label="Índex de l’assignatura">
            <button
              type="button"
              className="subject-index-toggle"
              aria-expanded={indexOpen}
              onClick={() => setIndexOpen((open) => !open)}
            >
              <span className="subject-index-toggle-label">
                <List size={15} color="var(--accent-primary)" />
                <span>
                  Índex de l’assignatura · <strong>{subject.name}</strong>
                </span>
                <span className="subject-index-count">
                  ({subject.totalNotes} {subject.totalNotes === 1 ? 'document' : 'documents'})
                </span>
              </span>
              <span className="subject-index-chevron">
                {indexOpen ? (
                  <>
                    Amagar <ChevronUp size={15} />
                  </>
                ) : (
                  <>
                    Desplegar <ChevronDown size={15} />
                  </>
                )}
              </span>
            </button>

            {indexOpen && (
              <div className="subject-index-panel">
                <FolderTree
                  folder={subject.rootFolder}
                  activePath={noteItem.path}
                  onSelectNote={() => setIndexOpen(false)}
                />
              </div>
            )}
          </section>
        )}

        <div className="reader-layout">
          <article ref={articleRef} className="article-paper">
            <header className="article-header">
              <div className="article-kicker">
                {noteItem.subjectName}
                {noteItem.folderSegments.length > 0
                  ? ` · ${noteItem.folderSegments.join(' / ')}`
                  : ''}
              </div>

              <h1 className="article-title">{noteItem.title}</h1>

              <div className="article-meta-bar">
                {loadedNote && (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={13} />
                      {loadedNote.readingTimeMin} min de lectura
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <FileText size={13} />
                      {loadedNote.wordCount} paraules
                    </span>
                  </>
                )}
                {noteItem.isDraft && <span className="badge badge-draft">Document en preparació</span>}
                {noteItem.extension === 'pdf' && <span className="badge badge-pdf">Document PDF</span>}
              </div>

              <div className="article-actions-bar">
                <Link
                  to={`/colaborar?assignatura=${encodeURIComponent(noteItem.subjectName)}&apunt=${encodeURIComponent(noteItem.path)}`}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.83rem' }}
                >
                  <MessageSquarePlus size={14} />
                  Proposar modificació o millora
                </Link>
                <a
                  href={noteItem.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.83rem' }}
                >
                  <ExternalLink size={14} />
                  Veure font original
                </a>
              </div>
            </header>

            {noteItem.isDraft && (
              <div className="notice-banner">
                Aquest fitxer figura actualment com a esborrany o pendent de completar al repositori.
                Si disposes de material per ampliar-lo, pots obrir un tiquet de col·laboració.
              </div>
            )}

            {noteItem.extension === 'pdf' ? (
              <div>
                <iframe
                  src={noteItem.rawUrl}
                  title={noteItem.title}
                  style={{
                    width: '100%',
                    height: '72vh',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                />
                <div style={{ marginTop: '1rem' }}>
                  <a
                    href={noteItem.rawUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary"
                  >
                    Obrir PDF en una pestanya nova
                  </a>
                </div>
              </div>
            ) : loading ? (
              <div style={{ display: 'grid', gap: '0.9rem' }}>
                <div className="skeleton-box" style={{ height: '24px', width: '65%' }} />
                <div className="skeleton-box" style={{ height: '18px', width: '95%' }} />
                <div className="skeleton-box" style={{ height: '18px', width: '88%' }} />
                <div className="skeleton-box" style={{ height: '18px', width: '92%' }} />
                <div className="skeleton-box" style={{ height: '140px', marginTop: '0.5rem' }} />
              </div>
            ) : error ? (
              <div className="notice-banner" role="alert">
                {error}
              </div>
            ) : loadedNote ? (
              <Suspense
                fallback={
                  <div style={{ display: 'grid', gap: '0.9rem' }}>
                    <div className="skeleton-box" style={{ height: '24px', width: '65%' }} />
                    <div className="skeleton-box" style={{ height: '18px', width: '95%' }} />
                    <div className="skeleton-box" style={{ height: '140px', marginTop: '0.5rem' }} />
                  </div>
                }
              >
                <MarkdownRenderer
                  markdown={loadedNote.processedMarkdown}
                  headings={loadedNote.headings}
                  onJumpToSection={(sectionId) => jumpToSection(sectionId, true)}
                />
              </Suspense>
            ) : null}

            <footer
              style={{
                marginTop: '3rem',
                paddingTop: '1.5rem',
                borderTop: '1px solid var(--border-hairline)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              {prevNote ? (
                <Link
                  to={`/apunt/${prevNote.slug}`}
                  className="btn-secondary"
                  style={{ maxWidth: '48%' }}
                >
                  <ArrowLeft size={15} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {prevNote.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}

              {nextNote && (
                <Link
                  to={`/apunt/${nextNote.slug}`}
                  className="btn-secondary"
                  style={{ maxWidth: '48%', marginLeft: 'auto' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nextNote.title}
                  </span>
                  <ArrowRight size={15} />
                </Link>
              )}
            </footer>
          </article>

          <aside ref={tocPanelRef} className="toc-panel" aria-label="Taula de continguts">
            <div className="toc-panel-header">
              <h2 className="sidebar-heading" style={{ margin: 0 }}>
                En aquest apunt
              </h2>
              {loadedNote && noteItem.extension !== 'pdf' && (
                <span className="toc-progress-pill">{progressPercent}%</span>
              )}
            </div>

            {loadedNote && loadedNote.headings.length > 0 ? (
              <ul className="toc-list">
                {loadedNote.headings.map((h) => {
                  const isActive = activeHeadingId === h.id
                  return (
                    <li
                      key={h.id}
                      className={`toc-item level-${h.level} ${isActive ? 'active' : ''}`}
                    >
                      <a
                        href={`#${h.id}`}
                        data-toc-id={h.id}
                        aria-current={isActive ? 'location' : undefined}
                        onClick={(e) => {
                          e.preventDefault()
                          jumpToSection(h.id, true)
                        }}
                      >
                        {h.text}
                      </a>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                Aquest document no conté apartats jeràrquics.
              </p>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}
