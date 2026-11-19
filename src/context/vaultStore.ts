import { createContext, useContext } from 'react'
import type { VaultCatalog } from '../types/vault'

export interface VaultRefreshFeedback {
  type: 'updated' | 'error'
  message: string
}

export interface VaultContextValue {
  catalog: VaultCatalog | null
  loading: boolean
  refreshing: boolean
  refreshFeedback: VaultRefreshFeedback | null
  clearRefreshFeedback: () => void
  error: string | null
  refreshCatalog: () => Promise<VaultCatalog | null>
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

export const VaultContext = createContext<VaultContextValue | null>(null)

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault ha d’utilitzar-se dins VaultProvider')
  return ctx
}
