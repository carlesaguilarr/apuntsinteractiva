import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchVaultCatalog } from '../services/vaultService'
import type { VaultCatalog } from '../types/vault'
import { VaultContext, type VaultRefreshFeedback } from './vaultStore'

const MIN_REFRESH_SPIN_MS = 380

function getCatalogFingerprint(cat: VaultCatalog | null): string {
  if (!cat) return ''
  if (cat.commitSha) return `sha:${cat.commitSha}`
  return cat.allNotes.map((n) => `${n.path}:${n.id}`).join('|')
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<VaultCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshFeedback, setRefreshFeedback] = useState<VaultRefreshFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  const catalogRef = useRef<VaultCatalog | null>(null)
  const refreshingRef = useRef(false)
  const requestIdRef = useRef(0)
  const feedbackTimerRef = useRef<number | null>(null)

  const clearFeedbackTimer = useCallback(() => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
  }, [])

  const clearRefreshFeedback = useCallback(() => {
    clearFeedbackTimer()
    setRefreshFeedback(null)
  }, [clearFeedbackTimer])

  useEffect(() => {
    const reqId = ++requestIdRef.current

    fetchVaultCatalog(false)
      .then((data) => {
        if (reqId === requestIdRef.current) {
          catalogRef.current = data
          setCatalog(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (reqId === requestIdRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : 'No s’ha pogut carregar l’arxiu d’apunts des de GitHub.',
          )
        }
      })
      .finally(() => {
        if (reqId === requestIdRef.current) {
          setLoading(false)
        }
      })

    return () => {
      requestIdRef.current += 1
      clearFeedbackTimer()
    }
  }, [clearFeedbackTimer])

  const refreshCatalog = useCallback(async (): Promise<VaultCatalog | null> => {
    if (refreshingRef.current) {
      return catalogRef.current
    }

    refreshingRef.current = true
    const reqId = ++requestIdRef.current
    clearFeedbackTimer()

    setRefreshing(true)
    setLoading(true)
    setError(null)
    setRefreshFeedback(null)

    const prevFingerprint = getCatalogFingerprint(catalogRef.current)
    const startedAt = Date.now()

    try {
      const data = await fetchVaultCatalog(true)
      const elapsed = Date.now() - startedAt
      if (elapsed < MIN_REFRESH_SPIN_MS) {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, MIN_REFRESH_SPIN_MS - elapsed),
        )
      }

      if (reqId !== requestIdRef.current) {
        return data
      }

      const nextFingerprint = getCatalogFingerprint(data)
      const hasChanges = prevFingerprint !== '' && nextFingerprint !== prevFingerprint

      catalogRef.current = data
      setCatalog(data)
      setRefreshFeedback({
        type: 'updated',
        message: hasChanges ? 'Actualitzat amb canvis' : 'Al dia',
      })
      feedbackTimerRef.current = window.setTimeout(() => {
        setRefreshFeedback(null)
        feedbackTimerRef.current = null
      }, 4500)

      return data
    } catch (err) {
      const elapsed = Date.now() - startedAt
      if (elapsed < MIN_REFRESH_SPIN_MS) {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, MIN_REFRESH_SPIN_MS - elapsed),
        )
      }

      if (reqId !== requestIdRef.current) {
        return null
      }

      const message =
        err instanceof Error
          ? err.message
          : 'No s’ha pogut actualitzar l’arxiu d’apunts des de GitHub.'
      setError(message)
      setRefreshFeedback({ type: 'error', message })
      return null
    } finally {
      refreshingRef.current = false
      if (reqId === requestIdRef.current) {
        setRefreshing(false)
        setLoading(false)
      }
    }
  }, [clearFeedbackTimer])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <VaultContext.Provider
      value={{
        catalog,
        loading,
        refreshing,
        refreshFeedback,
        clearRefreshFeedback,
        error,
        refreshCatalog,
        searchOpen,
        setSearchOpen,
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}
