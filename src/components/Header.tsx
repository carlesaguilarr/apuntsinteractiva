import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Menu, Moon, RefreshCw, Search, Sun, X } from 'lucide-react'
import { useTheme } from '../context/themeStore'
import { useVault } from '../context/vaultStore'

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const { catalog, loading, refreshCatalog, setSearchOpen } = useVault()
  const [menuOpen, setMenuOpen] = useState(false)

  const formattedSync = catalog?.fetchedAt
    ? new Date(catalog.fetchedAt).toLocaleTimeString('ca-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  return (
    <header className="masthead">
      <div className="masthead-strip">
        <div className="container masthead-strip-inner">
          <span>UAB · Grau en Comunicació Interactiva</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span>
              {catalog
                ? `${catalog.subjects.length} assignatures · ${catalog.allNotes.length} apunts · Sincronitzat a les ${formattedSync}`
                : 'Connectant amb l’arxiu...'}
            </span>
            <button
              type="button"
              onClick={() => void refreshCatalog()}
              title="Actualitzar índex des de GitHub"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                border: 'none',
                background: 'transparent',
                padding: 0,
                fontFamily: 'inherit',
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                textTransform: 'inherit',
                color: 'var(--accent-primary)',
              }}
            >
              <RefreshCw size={11} className={loading ? 'spin' : ''} />
              Actualitzar
            </button>
          </div>
        </div>
      </div>

      <div className="container masthead-main">
        <Link to="/" className="brand-mark" onClick={() => setMenuOpen(false)}>
          <span className="brand-title">
            Apunts <em>Interactiva</em>
          </span>
          <span className="brand-subtitle">Arxiu Editorial</span>
        </Link>

        <nav className={`nav-links ${menuOpen ? 'open' : ''}`} aria-label="Navegació principal">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            Inici
          </NavLink>
          <NavLink
            to="/colaborar"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            Col·laborar
          </NavLink>
          <NavLink
            to="/seguiment"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            Seguiment
          </NavLink>
        </nav>

        <div className="masthead-actions">
          <button
            type="button"
            className="search-bar-trigger"
            onClick={() => setSearchOpen(true)}
            aria-label="Cercar apunts"
          >
            <Search size={15} color="var(--text-muted)" />
            <span>Cercar...</span>
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={
              theme === 'light' ? 'Canviar a mode nocturn' : 'Canviar a mode clar editorial'
            }
            title={theme === 'light' ? 'Edició Nocturna' : 'Edició Paper Clar'}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <button
            type="button"
            className="icon-btn mobile-menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Obrir menú"
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>
    </header>
  )
}
