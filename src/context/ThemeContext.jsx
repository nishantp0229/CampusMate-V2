// src/context/ThemeContext.jsx — Dark/Light Theme Context
import { createContext, useContext } from 'react'

export const ThemeContext = createContext(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  return context || { theme: 'light', toggleTheme: () => {} }
}

export default ThemeContext
