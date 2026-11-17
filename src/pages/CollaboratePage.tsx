import { useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  FileUp,
  Paperclip,
  Send,
  TicketCheck,
  Trash2,
} from 'lucide-react'
import { useVault } from '../context/vaultStore'
import { createTicket, TICKET_TYPE_LABELS } from '../services/ticketService'
import type { TicketItem, TicketType } from '../types/vault'

const MAX_FILE_BYTES = 3 * 1024 * 1024 // 3 MB (~4 MB en base64 per respectar el límit de Vercel)

export function CollaboratePage() {
  const { catalog } = useVault()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const prefilledSubject = searchParams.get('assignatura') ?? ''
  const prefilledNote = searchParams.get('apunt') ?? ''
  const prefilledTopic = searchParams.get('tema') ?? ''

  const [type, setType] = useState<TicketType>(
    prefilledNote ? 'modificacio' : 'addicio',
  )
  const [subject, setSubject] = useState(prefilledSubject)
  const [notePath, setNotePath] = useState(prefilledNote)
  const [title, setTitle] = useState(
    prefilledTopic ? `Elaborar fitxa sobre: ${prefilledTopic}` : '',
  )
  const [description, setDescription] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [authorContact, setAuthorContact] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submittedResult, setSubmittedResult] = useState<{
    ticket: TicketItem
    mode: 'remote' | 'local'
  } | null>(null)

  const subjectNotes = useMemo(() => {
    if (!catalog || !subject) return []
    const found = catalog.subjects.find((s) => s.name === subject)
    return found?.allNotes ?? []
  }, [catalog, subject])

  const handleFileSelect = (selected: File | null) => {
    setErrorMsg(null)
    if (!selected) {
      setFile(null)
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      setErrorMsg('El fitxer supera el límit màxim de 3 MB.')
      return
    }
    setFile(selected)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files?.[0] ?? null
    handleFileSelect(dropped)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!subject.trim()) {
      setErrorMsg('Selecciona una assignatura per poder classificar la petició.')
      return
    }
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Omple el títol i la descripció de la proposta.')
      return
    }

    setSubmitting(true)
    try {
      const result = await createTicket({
        type,
        subject: subject.trim(),
        notePath: notePath || undefined,
        title: title.trim(),
        description: description.trim(),
        authorName: authorName.trim() || 'Estudiant UAB',
        authorContact: authorContact.trim() || undefined,
        file,
      })
      setSubmittedResult(result)
      setTitle('')
      setDescription('')
      setFile(null)
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No s’ha pogut registrar el tiquet.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container section-block">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Participació acadèmica</div>
          <h1 className="section-title" style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.3rem)' }}>
            Obrir un <em>tiquet</em> de col·laboració
          </h1>
        </div>

        <Link to="/seguiment" className="btn-secondary">
          <TicketCheck size={16} />
          Veure estat de les peticions
        </Link>
      </div>

      <div className="collab-grid">
        <div className="editorial-card">
          {submittedResult && (
            <div
              className="notice-banner"
              style={{
                borderLeftColor: 'var(--status-accepted-fg)',
                marginBottom: '1.5rem',
              }}
            >
              <CheckCircle2 size={20} color="var(--status-accepted-fg)" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ display: 'block', color: 'var(--text-ink)' }}>
                  Tiquet #{submittedResult.ticket.number} registrat correctament
                </strong>
                <p style={{ margin: '0.35rem 0 0.75rem', fontSize: '0.9rem' }}>
                  {submittedResult.mode === 'remote'
                    ? 'La petició i el material adjunt s’han enviat per a la revisió editorial.'
                    : 'La petició s’ha desat al registre local d’aquest navegador (pendent d’activar la passarel·la del servidor per publicar-la automàticament al repositori).'}
                </p>
                <Link
                  to="/seguiment"
                  style={{
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    color: 'var(--accent-primary)',
                    textDecoration: 'underline',
                  }}
                >
                  Anar al tauler de seguiment →
                </Link>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="notice-banner" role="alert">
              {errorMsg}
            </div>
          )}

          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="form-row-2">
              <div>
                <label className="field-label" htmlFor="ticket-type">
                  Tipus de petició
                </label>
                <select
                  id="ticket-type"
                  className="field-select"
                  value={type}
                  onChange={(e) => setType(e.target.value as TicketType)}
                >
                  {(Object.keys(TICKET_TYPE_LABELS) as TicketType[]).map((key) => (
                    <option key={key} value={key}>
                      {TICKET_TYPE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="ticket-subject">
                  Assignatura
                </label>
                <select
                  id="ticket-subject"
                  className="field-select"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value)
                    setNotePath('')
                  }}
                  required
                >
                  <option value="">Selecciona una assignatura...</option>
                  {catalog?.subjects.map((s) => (
                    <option key={s.slug} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  <option value="Altra assignatura">Altra assignatura del grau</option>
                </select>
              </div>
            </div>

            {subjectNotes.length > 0 && (
              <div>
                <label className="field-label" htmlFor="ticket-note">
                  Apunt relacionat (opcional)
                </label>
                <select
                  id="ticket-note"
                  className="field-select"
                  value={notePath}
                  onChange={(e) => setNotePath(e.target.value)}
                >
                  <option value="">Cap apunt en concret / Nou tema</option>
                  {subjectNotes.map((n) => (
                    <option key={n.path} value={n.path}>
                      {n.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="ticket-title">
                Títol resum de la proposta
              </label>
              <input
                id="ticket-title"
                type="text"
                className="field-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Apunts complets del Tema 5 o correcció de definició..."
                required
              />
            </div>

            <div>
              <label className="field-label" htmlFor="ticket-description">
                Descripció i detalls per a la revisió
              </label>
              <textarea
                id="ticket-description"
                className="field-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explica què cal afegir, modificar o revisar perquè puguem integrar-ho fàcilment..."
                required
              />
            </div>

            <div>
              <span className="field-label">Document adjunt (opcional · màx. 3 MB)</span>
              <div
                className={`dropzone ${dragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.md,.txt,.doc,.docx,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
                <FileUp size={22} color="var(--accent-primary)" />
                <div style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-ink)' }}>
                  Arrossega un document aquí o fes clic per seleccionar-lo
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Formats admesos: PDF, Markdown (.md), Word (.docx), TXT o imatges
                </div>
              </div>

              {file && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.7rem',
                    padding: '0.55rem 0.8rem',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-hairline)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.86rem',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Paperclip size={14} color="var(--accent-primary)" />
                    <strong>{file.name}</strong>
                    <span style={{ color: 'var(--text-muted)' }}>
                      ({Math.max(1, Math.round(file.size / 1024))} KB)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    aria-label="Treure fitxer adjunt"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--accent-primary)',
                      display: 'inline-flex',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>

            <div className="form-row-2">
              <div>
                <label className="field-label" htmlFor="ticket-author">
                  El teu nom o pseudònim
                </label>
                <input
                  id="ticket-author"
                  type="text"
                  className="field-input"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Per acreditar l’aportació (opcional)"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="ticket-contact">
                  Contacte o usuari públic (opcional)
                </label>
                <input
                  id="ticket-contact"
                  type="text"
                  className="field-input"
                  value={authorContact}
                  onChange={(e) => setAuthorContact(e.target.value)}
                  placeholder="Ex.: @usuari (els tiquets són públics)"
                />
              </div>
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              <button type="submit" className="btn-primary" disabled={submitting}>
                <Send size={15} />
                {submitting ? 'Registrant tiquet...' : 'Enviar tiquet de col·laboració'}
              </button>
            </div>
          </form>
        </div>

        <aside style={{ display: 'grid', gap: '1.25rem' }}>
          <div className="editorial-card">
            <div className="section-eyebrow">Procés editorial</div>
            <h2 className="section-title" style={{ fontSize: '1.7rem', marginBottom: '0.85rem' }}>
              Revisió abans de <em>publicar</em>
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.94rem', color: 'var(--text-secondary)' }}>
              Aquest sistema de tiquets evita que hagis de barallar-te amb branques o conflictes a
              GitHub. Cada aportació es revisa manualment per mantenir la coherència i qualitat de
              l’arxiu:
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.2rem',
                fontSize: '0.92rem',
                color: 'var(--text-secondary)',
                display: 'grid',
                gap: '0.55rem',
              }}
            >
              <li>
                <strong style={{ color: 'var(--text-ink)' }}>Pendent:</strong> El tiquet ha entrat a
                la cua de revisió.
              </li>
              <li>
                <strong style={{ color: 'var(--text-ink)' }}>En revisió:</strong> S’està comprovant
                el document adjunt i integrant el format.
              </li>
              <li>
                <strong style={{ color: 'var(--text-ink)' }}>Acceptat i publicat:</strong> Els nous
                apunts o correccions ja es poden consultar a la web.
              </li>
            </ul>
          </div>

          <div className="editorial-card" style={{ backgroundColor: 'var(--bg-callout)' }}>
            <div className="section-eyebrow">Consells per al material</div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Pots enviar els teus apunts tal com els tinguis redactats (PDF, Word, Markdown o
              captures nítides). No cal que els tradueixis: l’arxiu conserva la llengua original de
              cada assignatura i document.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
