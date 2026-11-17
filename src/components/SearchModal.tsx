import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Search, X } from 'lucide-react'
import { useVault } from '../context/vaultStore'

function SearchModalContent() {
  const { catalog, setSearchOpen } = useVault()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 20)
    return () => clearTimeout(timer)
  }, [])

  const results = useMemo(() => {
    if (!catalog) return []
    const q = query.trim().toLowerCase()
    if (!q) return catalog.allNotes.slice(0, 10)

    return catalog.allNotes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.subjectName.toLowerCase().includes(q) ||
          n.path.toLowerCase().includes(q),
      )
      .slice(0, 18)
  }, [catalog, query])

  const openNote = (slug: string) => {
    setSearchOpen(false)
    navigate(`/apunt/${slug}`)
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Cercador d’apunts"
      onClick={() => setSearchOpen(false)}
    >
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrap">
          <Search size={18} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per títol, assignatura o carpeta..."
          />
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            aria-label="Tancar cercador"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              padding: '0.2rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="search-results">
          {results.length === 0 ? (
            <div
              style={{
                padding: '2.2rem 1rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.92rem',
              }}
            >
              No s’ha trobat cap apunt coincident amb «{query}».
            </div>
          ) : (
            results.map((note) => (
              <button
                key={note.path}
                type="button"
                className="search-result-item"
                onClick={() => openNote(note.slug)}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <FileText size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.15rem',
                        fontWeight: 600,
                        color: 'var(--text-ink)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {note.title}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {note.subjectName}
                      {note.folderSegments.length > 0 ? ` · ${note.folderSegments.join(' / ')}` : ''}
                    </div>
                  </div>
                </div>

                {note.isDraft ? (
                  <span className="badge badge-draft">Esborrany</span>
                ) : note.extension === 'pdf' ? (
                  <span className="badge badge-pdf">PDF</span>
                ) : null}
              </button>
            ))
          )}
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
