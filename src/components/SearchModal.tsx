import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CornerDownLeft,
  FileText,
  Hash,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useVault } from '../context/vaultStore'
import {
  ensureFullTextIndex,
  getIndexCounts,
  searchFullTextCatalog,
  type FullTextSearchHit,
  type SearchIndexProgress,
} from '../services/searchIndexService'

const MATCH_SOURCE_LABELS: Record<FullTextSearchHit['matchSource'], string> = {
  title: 'Títol',
  heading: 'Secció',
  content: 'Contingut',
  subject: 'Assignatura',
}

function SearchModalContent() {
  const { catalog, setSearchOpen } = useVault()
  const [query, setQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('totes')
  const [activeIndex, setActiveIndex] = useState(0)
  const [indexRevision, setIndexRevision] = useState(0)
  const [indexProgress, setIndexProgress] = useState<SearchIndexProgress>(() => ({
    ...getIndexCounts(catalog),
    indexing: false,
    error: null,
  }))

  const inputRef = useRef<HTMLInputElement>(null)
  const resultsListRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(timer)
  }, [])

  // Inicia (o valida) la indexació progressiva de text complet en obrir el cercador
  useEffect(() => {
    if (!catalog) return
    let cancelled = false

    void ensureFullTextIndex(catalog, (progress) => {
      if (cancelled) return
      setIndexProgress(progress)
      setIndexRevision((r) => r + 1)
    })

    return () => {
      cancelled = true
    }
  }, [catalog])

  const handleForceReindex = useCallback(() => {
    if (!catalog || indexProgress.indexing) return
    void ensureFullTextIndex(
      catalog,
      (progress) => {
        setIndexProgress(progress)
        setIndexRevision((r) => r + 1)
      },
      true,
    )
  }, [catalog, indexProgress.indexing])

  const hits = useMemo(() => {
    if (!catalog) return []
    // Referenciem indexRevision per recalcular en directe mentre s'indexen apunts nous
    void indexRevision
    return searchFullTextCatalog(catalog, query, {
      subjectName: selectedSubject,
      limit: 24,
    })
  }, [catalog, query, selectedSubject, indexRevision])

  const safeActiveIndex = hits.length > 0 ? Math.min(activeIndex, hits.length - 1) : 0

  const openHit = useCallback(
    (hit: FullTextSearchHit) => {
      setSearchOpen(false)
      const sectionQuery = hit.matchedHeading
        ? `?seccio=${encodeURIComponent(hit.matchedHeading.id)}`
        : ''
      navigate(`/apunt/${hit.note.slug}${sectionQuery}`)
    },
    [navigate, setSearchOpen],
  )

  // Manté visible l'element actiu en navegar amb teclat
  useEffect(() => {
    const container = resultsListRef.current
    if (!container) return
    const activeEl = container.querySelector<HTMLElement>(`[data-result-index="${safeActiveIndex}"]`)
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' })
    }
  }, [safeActiveIndex])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setSearchOpen(false)
      return
    }
    if (hits.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = hits[safeActiveIndex]
      if (selected) openHit(selected)
    }
  }

  const indexPct =
    indexProgress.totalCount > 0
      ? Math.round((indexProgress.indexedCount / indexProgress.totalCount) * 100)
      : 0
  const hasQuery = query.trim().length > 0

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Cercador d’apunts"
      onClick={() => setSearchOpen(false)}
      onKeyDown={handleKeyDown}
    >
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrap">
          <Search size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            placeholder="Cerca conceptes, definicions, títols o assignatures..."
            aria-label="Cercar a tot el contingut dels apunts"
          />
          {hasQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setQuery('')
                setActiveIndex(0)
                inputRef.current?.focus()
              }}
              aria-label="Netejar cerca"
              title="Netejar"
            >
              <X size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            aria-label="Tancar cercador"
            className="search-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="search-meta-bar">
          <div className="search-filter-group">
            <select
              className="search-subject-select"
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value)
                setActiveIndex(0)
              }}
              aria-label="Filtrar per assignatura"
            >
              <option value="totes">Totes les assignatures</option>
              {catalog?.subjects.map((subject) => (
                <option key={subject.slug} value={subject.name}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div className="search-index-status">
            <Sparkles size={12} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
            {indexProgress.indexing ? (
              <span>
                Indexant text complet: {indexProgress.indexedCount}/{indexProgress.totalCount} (
                {indexPct}%)
              </span>
            ) : indexProgress.error ? (
              <span style={{ color: 'var(--accent-brass)' }}>{indexProgress.error}</span>
            ) : (
              <span>
                Cerca completa activa ({indexProgress.indexedCount}/{indexProgress.totalCount}{' '}
                apunts)
              </span>
            )}
            <button
              type="button"
              className="search-reindex-btn"
              onClick={handleForceReindex}
              disabled={indexProgress.indexing || !catalog}
              title="Reindexar tots els apunts des de GitHub"
            >
              <RefreshCw size={11} className={indexProgress.indexing ? 'spin' : ''} />
              Reindexar
            </button>
          </div>
        </div>

        {indexProgress.indexing && (
          <div className="search-index-progress-track" aria-hidden="true">
            <div
              className="search-index-progress-bar"
              style={{ width: `${Math.max(6, indexPct)}%` }}
            />
          </div>
        )}

        <div ref={resultsListRef} className="search-results" role="listbox">
          {hits.length === 0 ? (
            <div className="search-empty-state">
              <p style={{ margin: 0 }}>
                No s’ha trobat cap coincidència per a «<strong>{query}</strong>»
                {selectedSubject !== 'totes' ? ` dins de ${selectedSubject}` : ''}.
              </p>
              {indexProgress.indexing && (
                <p style={{ margin: '0.45rem 0 0', fontSize: '0.82rem' }}>
                  Encara s’estan indexant apunts en segon pla; els resultats apareixeran a mesura
                  que es completin.
                </p>
              )}
            </div>
          ) : (
            hits.map((hit, idx) => {
              const isSelected = idx === safeActiveIndex
              const isHeadingMatch = hit.matchSource === 'heading'

              return (
                <button
                  key={`${hit.note.path}:${hit.matchedHeading?.id ?? 'root'}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-result-index={idx}
                  className={`search-result-item ${isSelected ? 'is-selected' : ''}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => openHit(hit)}
                >
                  <div className="search-result-main">
                    <div className="search-result-top">
                      <span className="search-result-icon">
                        {isHeadingMatch ? (
                          <Hash size={15} color="var(--accent-primary)" />
                        ) : (
                          <FileText size={15} color="var(--accent-primary)" />
                        )}
                      </span>

                      <div className="search-result-heading-block">
                        <div className="search-result-title">{hit.note.title}</div>
                        <div className="search-result-meta">
                          <span>{hit.note.subjectName}</span>
                          {hit.note.folderSegments.length > 0 && (
                            <span> · {hit.note.folderSegments.join(' / ')}</span>
                          )}
                          {hasQuery && hit.matchedHeading && (
                            <span className="search-result-section-chip">
                              § {hit.matchedHeading.text}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="search-result-badges">
                        {hasQuery && (
                          <span className="search-match-pill">
                            {MATCH_SOURCE_LABELS[hit.matchSource]}
                          </span>
                        )}
                        {hit.note.isDraft ? (
                          <span className="badge badge-draft">Esborrany</span>
                        ) : hit.note.extension === 'pdf' ? (
                          <span className="badge badge-pdf">PDF</span>
                        ) : null}
                      </div>
                    </div>

                    {hasQuery && hit.snippetParts && hit.snippetParts.length > 0 && (
                      <div className="search-result-snippet">
                        {hit.snippetParts.map((part, partIdx) =>
                          part.match ? (
                            <mark key={partIdx} className="search-highlight">
                              {part.text}
                            </mark>
                          ) : (
                            <span key={partIdx}>{part.text}</span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        <div className="search-modal-footer">
          <div className="search-shortcuts">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> Navegar
            </span>
            <span>
              <kbd>
                <CornerDownLeft size={10} />
              </kbd>{' '}
              Obrir
            </span>
            <span>
              <kbd>Esc</kbd> Tancar
            </span>
          </div>
          <span className="search-result-count">
            {hasQuery
              ? `${hits.length} ${hits.length === 1 ? 'resultat' : 'resultats'}`
              : 'Escriu per cercar dins de tots els apunts'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function SearchModal() {
  const { searchOpen } = useVault()
  if (!searchOpen) return null
  return <SearchModalContent />
}
