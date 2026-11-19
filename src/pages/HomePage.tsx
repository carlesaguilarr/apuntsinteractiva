import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, GitBranch } from 'lucide-react'
import { useVault } from '../context/vaultStore'
import { formatTagLabel, groupSubjectsByCurriculum } from '../services/vaultService'

function renderCourseTitle(label: string) {
  const parts = label.split(' ')
  if (parts.length > 1) {
    const last = parts[parts.length - 1]
    const head = parts.slice(0, -1).join(' ')
    return (
      <>
        {head} <em>{last}</em>
      </>
    )
  }
  return label
}

export function HomePage() {
  const { catalog, loading, error, refreshFeedback, refreshCatalog } = useVault()
  const [selectedTag, setSelectedTag] = useState<string>('totes')

  const publishedCount = catalog ? catalog.allNotes.filter((n) => !n.isDraft).length : 0
  const draftCount = catalog ? catalog.allNotes.filter((n) => n.isDraft).length : 0

  const tagOptions = useMemo(() => {
    if (!catalog) return []
    const set = new Set<string>()
    for (const s of catalog.subjects) {
      for (const t of s.meta?.tags ?? []) {
        set.add(t.toLowerCase())
      }
    }
    return Array.from(set)
  }, [catalog])

  const filteredSubjects = useMemo(() => {
    if (!catalog) return []
    if (selectedTag === 'totes') return catalog.subjects
    return catalog.subjects.filter((s) =>
      (s.meta?.tags ?? []).some((t) => t.toLowerCase() === selectedTag),
    )
  }, [catalog, selectedTag])

  const courseGroups = useMemo(
    () => groupSubjectsByCurriculum(filteredSubjects),
    [filteredSubjects],
  )

  return (
    <div>
      <section className="hero-section">
        <div className="container">
          <div className="hero-kicker">Universitat Autònoma de Barcelona</div>

          <div className="hero-grid">
            <div>
              <h1 className="hero-headline">
                Arxiu d’apunts de <em>Comunicació Interactiva</em>.
              </h1>
              <p className="hero-lead" style={{ marginTop: '1rem' }}>
                Recull col·laboratiu d’apunts i materials del grau organitzat per assignatures.
              </p>
            </div>

            <aside className="hero-meta-card" aria-label="Resum de l’arxiu">
              <div className="hero-stats">
                <div>
                  <div className="stat-value">{catalog ? catalog.subjects.length : '—'}</div>
                  <div className="stat-label">Assignatures</div>
                </div>
                <div>
                  <div className="stat-value">{catalog ? publishedCount : '—'}</div>
                  <div className="stat-label">Publicats</div>
                </div>
                <div>
                  <div className="stat-value">{catalog ? draftCount : '—'}</div>
                  <div className="stat-label">Esborranys</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="container">
          {error && refreshFeedback?.type !== 'error' && (
            <div className="notice-banner" role="alert">
              <div style={{ flex: 1 }}>
                <strong>Avís de connexió:</strong> {error}
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
                onClick={() => void refreshCatalog()}
              >
                Reintentar
              </button>
            </div>
          )}

          {catalog?.rateLimited && (
            <div className="notice-banner">
              Mostrant una còpia desada temporalment perquè GitHub ha limitat les peticions
              momentàniament.
            </div>
          )}

          <div className="section-header">
            <div>
              <div className="section-eyebrow">Índex general</div>
              <h2 className="section-title">
                Assignatures del <em>grau</em>
              </h2>
            </div>

            {tagOptions.length > 1 && (
              <div className="filter-pills-bar" style={{ marginBottom: 0 }}>
                <button
                  type="button"
                  onClick={() => setSelectedTag('totes')}
                  className={selectedTag === 'totes' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
                >
                  Totes
                </button>
                {tagOptions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={selectedTag === tag ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem' }}
                  >
                    {formatTagLabel(tag)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && !catalog ? (
            <div className="subjects-grid">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="skeleton-box" style={{ height: '240px' }} />
              ))}
            </div>
          ) : courseGroups.length === 0 ? (
            <div className="editorial-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Cap assignatura coincideix amb el filtre seleccionat.
              </p>
            </div>
          ) : (
            <div className="curriculum-stack">
              {courseGroups.map((course) => (
                <div key={course.label} className="course-group">
                  <div className="course-group-header">
                    <h3 className="course-group-title">{renderCourseTitle(course.label)}</h3>
                  </div>

                  {course.semesters.map((semester) => (
                    <div key={`${course.label}-${semester.label}`} className="semester-group">
                      <div className="semester-group-header">
                        <h4 className="semester-group-title">{semester.label}</h4>
                        <span className="semester-group-count">
                          {semester.subjects.length}{' '}
                          {semester.subjects.length === 1 ? 'assignatura' : 'assignatures'}
                        </span>
                      </div>

                      <div className="subjects-grid">
                        {semester.subjects.map((subject) => {
                          const tags = subject.meta?.tags ?? []

                          return (
                            <Link
                              key={subject.slug}
                              to={`/assignatura/${subject.slug}`}
                              className="subject-card"
                            >
                              <div>
                                <div className="subject-card-top">
                                  <span className="subject-numeral">{subject.romanNumeral}</span>
                                  <span className="subject-count">
                                    {subject.totalNotes}{' '}
                                    {subject.totalNotes === 1 ? 'document' : 'documents'}
                                  </span>
                                </div>

                                <h5 className="subject-name">{subject.name}</h5>

                                {tags.length > 0 && (
                                  <div className="subject-meta-tags">
                                    {tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className={`subject-meta-tag ${tag.toLowerCase().includes('optativ') ? 'tag-optativa' : ''}`}
                                      >
                                        {formatTagLabel(tag)}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <ul className="subject-preview-list">
                                  {subject.allNotes.slice(0, 3).map((note) => (
                                    <li key={note.path}>{note.title}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="subject-card-footer">
                                <span>Obrir dossier</span>
                                <ArrowRight size={15} />
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section-block">
        <div className="container">
          <div className="editorial-card">
            <div className="section-eyebrow">Col·laboració oberta</div>
            <h2 className="section-title" style={{ marginBottom: '1rem' }}>
              Com funciona l’enviament <em>d’aportacions</em>
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.5rem',
                marginTop: '1.5rem',
              }}
            >
              <div>
                <div className="subject-numeral" style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>
                  01
                </div>
                <strong style={{ display: 'block', color: 'var(--text-ink)', marginBottom: '0.3rem' }}>
                  Obre un tiquet guiat
                </strong>
                <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                  Indica l’assignatura, si és material nou o una correcció, i descriu breument la
                  proposta.
                </p>
              </div>
              <div>
                <div className="subject-numeral" style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>
                  02
                </div>
                <strong style={{ display: 'block', color: 'var(--text-ink)', marginBottom: '0.3rem' }}>
                  Adjunta el teu document
                </strong>
                <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                  Pots pujar un PDF, un document de text, Markdown o imatge amb els apunts perquè
                  siguin revisats abans de publicar-se.
                </p>
              </div>
              <div>
                <div className="subject-numeral" style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>
                  03
                </div>
                <strong style={{ display: 'block', color: 'var(--text-ink)', marginBottom: '0.3rem' }}>
                  Fes-ne el seguiment
                </strong>
                <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                  Cada petició rep un estat transparent: <em>Pendent</em>, <em>En revisió</em> o{' '}
                  <em>Acceptat i publicat</em>.
                </p>
              </div>
            </div>

            <div style={{ marginTop: '1.75rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <Link to="/colaborar" className="btn-primary">
                <GitBranch size={16} />
                Enviar una aportació
              </Link>
              <Link to="/seguiment" className="btn-secondary">
                Veure tiquets oberts
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
