import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, ChevronRight, FilePlus2, FolderOpen } from 'lucide-react'
import { useVault } from '../context/vaultStore'

export function SubjectDetailPage() {
  const { subjectSlug } = useParams<{ subjectSlug: string }>()
  const { catalog, loading } = useVault()
  const [statusFilter, setStatusFilter] = useState<'tots' | 'publicats' | 'esborranys'>('tots')

  const subject = useMemo(() => {
    if (!catalog || !subjectSlug) return null
    return catalog.subjects.find((s) => s.slug === subjectSlug) ?? null
  }, [catalog, subjectSlug])

  const filteredNotes = useMemo(() => {
    if (!subject) return []
    if (statusFilter === 'publicats') return subject.allNotes.filter((n) => !n.isDraft)
    if (statusFilter === 'esborranys') return subject.allNotes.filter((n) => n.isDraft)
    return subject.allNotes
  }, [subject, statusFilter])

  if (loading && !catalog) {
    return (
      <div className="container section-block">
        <div className="skeleton-box" style={{ height: '160px', marginBottom: '1.5rem' }} />
        <div className="skeleton-box" style={{ height: '340px' }} />
      </div>
    )
  }

  if (!subject) {
    return (
      <div className="container section-block">
        <div className="editorial-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <h1 className="section-title">Assignatura no trobada</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
            Aquesta carpeta no figura actualment al repositori d’apunts.
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
        <span style={{ color: 'var(--text-ink)' }}>{subject.name}</span>
      </nav>

      <header
        style={{
          paddingBottom: '1.8rem',
          borderBottom: '3px double var(--border-strong)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div>
          <div className="hero-kicker" style={{ marginBottom: '0.75rem' }}>
            Dossier {subject.romanNumeral} · {subject.totalNotes}{' '}
            {subject.totalNotes === 1 ? 'document' : 'documents'}
          </div>
          <h1
            className="section-title"
            style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)', maxWidth: '22ch' }}
          >
            {subject.name}
          </h1>
        </div>

        <Link
          to={`/colaborar?assignatura=${encodeURIComponent(subject.name)}`}
          className="btn-primary"
        >
          <FilePlus2 size={16} />
          Afegir apunts a aquesta assignatura
        </Link>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginTop: '1.75rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(
            [
              { id: 'tots', label: `Tots (${subject.allNotes.length})` },
              {
                id: 'publicats',
                label: `Publicats (${subject.allNotes.filter((n) => !n.isDraft).length})`,
              },
              {
                id: 'esborranys',
                label: `Esborranys (${subject.draftNotes})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={statusFilter === tab.id ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.84rem' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="editorial-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            No hi ha documents en aquesta categoria.
          </p>
        </div>
      ) : (
        <div className="notes-index-list">
          {filteredNotes.map((note) => (
            <Link key={note.path} to={`/apunt/${note.slug}`} className="note-row">
              <div>
                {note.folderSegments.length > 0 && (
                  <div
                    className="note-row-subject"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <FolderOpen size={12} />
                    {note.folderSegments.join(' / ')}
                  </div>
                )}
                <div className="note-row-title">{note.title}</div>
                <div className="note-row-path">
                  Fitxer font: <code>{note.name}</code>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {note.isDraft && <span className="badge badge-draft">En preparació</span>}
                {note.extension === 'pdf' && <span className="badge badge-pdf">PDF</span>}
                <ArrowRight size={16} color="var(--text-muted)" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
