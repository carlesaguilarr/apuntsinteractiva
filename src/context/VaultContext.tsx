import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { fetchVaultCatalog } from '../services/vaultService'
import type { VaultCatalog } from '../types/vault'
import { VaultContext } from './vaultStore'

export function VaultProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<VaultCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetchVaultCatalog(false)
      .then((data) => {
        if (!cancelled) {
          setCatalog(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'No s’ha pogut carregar l’arxiu d’apunts des de GitHub.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const refreshCatalog = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchVaultCatalog(true)
      setCatalog(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No s’ha pogut carregar l’arxiu d’apunts des de GitHub.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

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
