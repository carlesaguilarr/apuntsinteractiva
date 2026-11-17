import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  MessageSquarePlus,
} from 'lucide-react'
import { FolderTree } from '../components/FolderTree'
import { MarkdownRenderer } from '../components/MarkdownRenderer'
import { useVault } from '../context/vaultStore'
import { fetchNoteContent } from '../services/vaultService'
import type { LoadedNote } from '../types/vault'

export function NoteReaderPage() {
  const { noteSlug } = useParams<{ noteSlug: string }>()
  const { catalog, loading: catalogLoading } = useVault()
  const [loadedState, setLoadedState] = useState<{ path: string; note: LoadedNote } | null>(null)
  const [errorState, setErrorState] = useState<{ path: string; message: string } | null>(null)

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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [noteItem?.path])

  useEffect(() => {
    if (!catalog || !noteItem || noteItem.extension === 'pdf') return

    let cancelled = false
    const targetPath = noteItem.path

    fetchNoteContent(noteItem, catalog)
      .then((res) => {
        if (!cancelled) {
          setLoadedState({ path: targetPath, note: res })
          setErrorState(null)
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

  return (
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

      <div className="reader-layout">
        <aside className="reader-sidebar" aria-label="Índex de l’assignatura">
          <h2 className="sidebar-heading">
            {subject ? `Índex · ${subject.romanNumeral}` : 'Navegació'}
          </h2>
          {subject && <FolderTree folder={subject.rootFolder} activePath={noteItem.path} />}
        </aside>

        <article className="article-paper">
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
            <MarkdownRenderer
              markdown={loadedNote.processedMarkdown}
              headings={loadedNote.headings}
            />
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

        <aside className="toc-panel" aria-label="Taula de continguts">
          <h2 className="sidebar-heading">En aquest apunt</h2>
          {loadedNote && loadedNote.headings.length > 0 ? (
            <ul className="toc-list">
              {loadedNote.headings.map((h) => (
                <li key={h.id} className={`toc-item level-${h.level}`}>
                  <a
                    href={`#${h.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Aquest document no conté apartats jeràrquics.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
