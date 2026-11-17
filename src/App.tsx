import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
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

export function App() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <HashRouter>
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
