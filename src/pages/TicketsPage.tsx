import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, FilePlus2, Paperclip, RefreshCw, Search } from 'lucide-react'
import {
  fetchTickets,
  TICKET_STATUS_META,
  TICKET_TYPE_LABELS,
} from '../services/ticketService'
import type { TicketItem, TicketStatus } from '../types/vault'

export function TicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [githubError, setGithubError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'tots' | TicketStatus>('tots')
  const [query, setQuery] = useState('')

  const handleRefresh = async () => {
    setLoading(true)
    const res = await fetchTickets(true)
    setTickets(res.tickets)
    setGithubError(res.githubError ?? null)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    fetchTickets().then((res) => {
      if (!cancelled) {
        setTickets(res.tickets)
        setGithubError(res.githubError ?? null)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(() => {
    const base: Record<TicketStatus, number> = {
      pendent: 0,
      en_revisio: 0,
      acceptat: 0,
      rebutjat: 0,
    }
    for (const t of tickets) {
      base[t.status] += 1
    }
    return base
  }, [tickets])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tickets.filter((t) => {
      if (statusFilter !== 'tots' && t.status !== statusFilter) return false
      if (!q) return true
      return (
        t.title.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.authorName.toLowerCase().includes(q)
      )
    })
  }, [tickets, statusFilter, query])

  return (
    <div className="container section-block">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">Transparència editorial</div>
          <h1 className="section-title" style={{ fontSize: 'clamp(2.2rem, 4.5vw, 3.3rem)' }}>
            Seguiment de <em>tiquets</em>
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void handleRefresh()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            {loading ? 'Actualitzant...' : 'Actualitzar'}
          </button>
          <Link to="/colaborar" className="btn-primary">
            <FilePlus2 size={16} />
            Nou tiquet
          </Link>
        </div>
      </div>

      {githubError && <div className="notice-banner">{githubError}</div>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        {(Object.keys(TICKET_STATUS_META) as TicketStatus[]).map((statusKey) => {
          const meta = TICKET_STATUS_META[statusKey]
          return (
            <button
              key={statusKey}
              type="button"
              onClick={() =>
                setStatusFilter((prev) => (prev === statusKey ? 'tots' : statusKey))
              }
              className="editorial-card"
              style={{
                textAlign: 'left',
                padding: '1.1rem 1.25rem',
                borderColor:
                  statusFilter === statusKey
                    ? 'var(--accent-primary)'
                    : 'var(--border-hairline)',
              }}
            >
              <span className={`badge badge-status-${meta.tone}`}>{meta.label}</span>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.1rem',
                  fontWeight: 600,
                  color: 'var(--text-ink)',
                  marginTop: '0.5rem',
                  lineHeight: 1,
                }}
              >
                {counts[statusKey]}
              </div>
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={statusFilter === 'tots' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.42rem 0.85rem', fontSize: '0.84rem' }}
            onClick={() => setStatusFilter('tots')}
          >
            Tots ({tickets.length})
          </button>
          {(Object.keys(TICKET_STATUS_META) as TicketStatus[]).map((statusKey) => (
            <button
              key={statusKey}
              type="button"
              className={statusFilter === statusKey ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.42rem 0.85rem', fontSize: '0.84rem' }}
              onClick={() => setStatusFilter(statusKey)}
            >
              {TICKET_STATUS_META[statusKey].label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', minWidth: 'min(100%, 280px)' }}>
          <Search
            size={15}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="search"
            className="field-input"
            style={{ paddingLeft: '2.3rem', paddingBlock: '0.52rem' }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cercar tiquet o assignatura..."
            aria-label="Cercar tiquets"
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-box" style={{ height: '130px' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="editorial-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <h2 className="section-title" style={{ fontSize: '1.65rem' }}>
            Encara no hi ha cap tiquet en aquesta vista
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.6rem' }}>
            Quan algú proposi una ampliació, un document nou o una correcció, apareixerà aquí amb
            el seu estat actualitzat.
          </p>
          <Link to="/colaborar" className="btn-primary" style={{ marginTop: '1.25rem' }}>
            Obrir el primer tiquet
          </Link>
        </div>
      ) : (
        <div>
          {filtered.map((ticket) => {
            const statusMeta = TICKET_STATUS_META[ticket.status]
            const dateStr = new Date(ticket.createdAt).toLocaleDateString('ca-ES', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })

            return (
              <article key={ticket.id} className="ticket-card">
                <div className="ticket-card-header">
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.73rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>#{ticket.number ?? '—'}</span>
                      <span>·</span>
                      <span style={{ color: 'var(--accent-brass)' }}>{ticket.subject}</span>
                      <span>·</span>
                      <span>{TICKET_TYPE_LABELS[ticket.type]}</span>
                      {ticket.source === 'local' && (
                        <>
                          <span>·</span>
                          <span>Registre local</span>
                        </>
                      )}
                    </div>
                    <h2 className="ticket-title">{ticket.title}</h2>
                  </div>

                  <span className={`badge badge-status-${statusMeta.tone}`}>
                    {statusMeta.label}
                  </span>
                </div>

                <p
                  style={{
                    margin: '0.5rem 0 0.9rem',
                    fontSize: '0.94rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {ticket.description}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border-hairline)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.9rem', alignItems: 'center' }}>
                    <span>Proposat per: {ticket.authorName}</span>
                    <span>Data: {dateStr}</span>
                    {ticket.attachment && (
                      <a
                        href={ticket.attachment.url || ticket.attachment.dataUrl}
                        download={ticket.attachment.dataUrl ? ticket.attachment.name : undefined}
                        target={ticket.attachment.url ? '_blank' : undefined}
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          color: 'var(--accent-primary)',
                          textDecoration: 'underline',
                        }}
                      >
                        <Paperclip size={13} />
                        {ticket.attachment.name}
                      </a>
                    )}
                  </div>

                  {ticket.htmlUrl && (
                    <a
                      href={ticket.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Seguiment detallat <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
