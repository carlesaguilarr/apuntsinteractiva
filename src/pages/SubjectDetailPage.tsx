import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { useVault } from '../context/vaultStore'
import type { VaultFolderNode, VaultNoteItem } from '../types/vault'

type StatusFilter = 'tots' | 'publicats' | 'esborranys'

function matchesFilter(note: VaultNoteItem, filter: StatusFilter): boolean {
  if (filter === 'publicats') return !note.isDraft
  if (filter === 'esborranys') return note.isDraft
  return true
}

function filterFolderNode(folder: VaultFolderNode, filter: StatusFilter): VaultFolderNode {
  const notes = folder.notes.filter((n) => matchesFilter(n, filter))
  const subfolders = folder.subfolders
    .map((sub) => filterFolderNode(sub, filter))
    .filter((sub) => sub.totalNotes > 0)

  const totalNotes =
    notes.length + subfolders.reduce((acc, sub) => acc + sub.totalNotes, 0)

  return {
    ...folder,
    notes,
    subfolders,
    totalNotes,
  }
}

function NoteRow({ note }: { note: VaultNoteItem }) {
  return (
    <Link to={`/apunt/${note.slug}`} className="note-row">
      <div>
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
  )
}

function FolderAccordion({ folder }: { folder: VaultFolderNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="folder-accordion">
      <button
        type="button"
        className="folder-accordion-btn"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="folder-accordion-left">
          {open ? (
            <FolderOpen size={18} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
          ) : (
            <Folder size={18} color="var(--accent-brass)" style={{ flexShrink: 0 }} />
          )}
          <span className="folder-accordion-title">{folder.name}</span>
        </span>

        <span className="folder-accordion-right">
          <span>
            {folder.totalNotes} {folder.totalNotes === 1 ? 'document' : 'documents'}
          </span>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {open && (
        <div className="folder-accordion-body">
          {folder.subfolders.map((sub) => (
            <FolderAccordion key={sub.path} folder={sub} />
          ))}
          {folder.notes.map((note) => (
            <NoteRow key={note.path} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}

export function SubjectDetailPage() {
  const { subjectSlug } = useParams<{ subjectSlug: string }>()
  const { catalog, loading } = useVault()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tots')

  const subject = useMemo(() => {
    if (!catalog || !subjectSlug) return null
    return catalog.subjects.find((s) => s.slug === subjectSlug) ?? null
  }, [catalog, subjectSlug])

  const filteredTree = useMemo(() => {
    if (!subject) return null
    return filterFolderNode(subject.rootFolder, statusFilter)
  }, [subject, statusFilter])

  if (loading && !catalog) {
    return (
      <div className="container section-block">
        <div className="skeleton-box" style={{ height: '160px', marginBottom: '1.5rem' }} />
        <div className="skeleton-box" style={{ height: '340px' }} />
      </div>
    )
  }

  if (!subject || !filteredTree) {
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

      {filteredTree.totalNotes === 0 ? (
        <div className="editorial-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            No hi ha documents en aquesta categoria.
          </p>
        </div>
      ) : (
        <div className="notes-index-list">
          {filteredTree.subfolders.map((sub) => (
            <FolderAccordion key={sub.path} folder={sub} />
          ))}
          {filteredTree.notes.map((note) => (
            <NoteRow key={note.path} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}
