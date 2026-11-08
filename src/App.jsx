// src/App.jsx
//
// This is the ROOT component of CampusMate.
// It does two things:
//   1. Wraps the whole app in BrowserRouter so React Router can manage pages.
//   2. Provides a ThemeContext so any component can read/toggle dark mode.
//
// As we add more pages, we register their routes here inside <Routes>.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'

// ─── Pages (we will create these one by one) ─────────────────────────────────
import Dashboard from './pages/Dashboard.jsx'
import NotFound  from './pages/NotFound.jsx'

// ─── Theme Context ────────────────────────────────────────────────────────────
// ThemeContext lets any component anywhere in the app know whether dark mode
// is active, and lets them call toggleTheme() to switch it.
export const ThemeContext = createContext(null)

export function useTheme() {
  return useContext(ThemeContext)
}

// ─── App Component ────────────────────────────────────────────────────────────
function App() {
  // Load the user's saved theme from localStorage (default: 'light')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('campusmate-theme') || 'light'
  })

  // Whenever theme changes, apply/remove the 'dark' class on <html>
  // and save the preference so it persists on refresh.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('campusmate-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    // Provide theme + toggle to every child component
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <BrowserRouter>
        <Routes>
          {/* Default route: redirect / to /dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Main pages — more will be added here in later stages */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Catch-all: show a friendly 404 page */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeContext.Provider>
  )
}

export default App
