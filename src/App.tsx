import { useLayoutEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { SearchModal } from './components/SearchModal'
import { ThemeProvider } from './context/ThemeContext'
import { VaultProvider } from './context/VaultContext'
import { CollaboratePage } from './pages/CollaboratePage'
import { HomePage } from './pages/HomePage'
import { NoteReaderPage } from './pages/NoteReaderPage'
import { SubjectDetailPage } from './pages/SubjectDetailPage'
import { TicketsPage } from './pages/TicketsPage'

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

function forceScrollToTop() {
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = 0
  }
}

function ScrollToTop() {
  const { key, pathname, search, hash } = useLocation()

  useLayoutEffect(() => {
    const params = new URLSearchParams(search)
    if (params.has('seccio')) {
      return
    }

    forceScrollToTop()
    const rafId = window.requestAnimationFrame(forceScrollToTop)
    const timerId = window.setTimeout(forceScrollToTop, 60)

    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timerId)
    }
  }, [key, pathname, search, hash])

  return null
}

export function App() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <HashRouter>
          <ScrollToTop />
          <div className="app-shell">
            <Header />
            <main className="main-content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/assignatura/:subjectSlug" element={<SubjectDetailPage />} />
                <Route path="/apunt/:noteSlug" element={<NoteReaderPage />} />
                <Route path="/colaborar" element={<CollaboratePage />} />
                <Route path="/seguiment" element={<TicketsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
            <SearchModal />
          </div>
        </HashRouter>
      </VaultProvider>
    </ThemeProvider>
  )
}

export default App
