import { Link } from 'react-router-dom'
import { VAULT_OWNER, VAULT_REPO } from '../services/vaultService'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-colophon">
            Apunts <em>Interactiva</em> — Edició Digital UAB
          </div>
          <div className="footer-meta" style={{ marginTop: '0.35rem' }}>
            Font sincronitzada en temps real amb{' '}
            <a
              href={`https://github.com/${VAULT_OWNER}/${VAULT_REPO}`}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'underline' }}
            >
              {VAULT_OWNER}/{VAULT_REPO}
            </a>
            . Els documents conserven el seu idioma original.
          </div>
        </div>

        <div
          className="footer-meta"
          style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}
        >
          <Link to="/">Assignatures</Link>
          <Link to="/colaborar">Enviar aportació</Link>
          <Link to="/seguiment">Estat dels tiquets</Link>
        </div>
      </div>
    </footer>
  )
}
