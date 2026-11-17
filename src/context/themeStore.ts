import { createContext, useContext } from 'react'

export type EditorialTheme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: EditorialTheme
  toggleTheme: () => void
  setTheme: (theme: EditorialTheme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme ha d’utilitzar-se dins ThemeProvider')
  return ctx
}
