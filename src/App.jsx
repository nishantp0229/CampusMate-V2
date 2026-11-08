// src/App.jsx — Root component: routing + dark-mode context provider

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'

// Layout (shared shell for authenticated pages)
import AppLayout from './components/layout/AppLayout'

// Public pages
import Landing  from './pages/Landing'
import Login    from './pages/Login'
import Signup   from './pages/Signup'

// Authenticated pages
import Dashboard from './pages/Dashboard'
import Planner   from './pages/Planner'
import Events    from './pages/Events'
import LostFound from './pages/LostFound'
import Resources from './pages/Resources'
import Profile   from './pages/Profile'

// 404
import NotFound from './pages/NotFound'

// ─── Theme Context ────────────────────────────────────────────────────────────
// Any component can call useTheme() to read theme ('light'|'dark')
// or call toggleTheme() to switch it.
export const ThemeContext = createContext(null)

export function useTheme() {
  return useContext(ThemeContext)
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('campusmate-theme') || 'light'
  )

  // Apply/remove .dark class on <html> and persist to localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('campusmate-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <BrowserRouter>
        <Routes>
          {/* ── Public ─────────────────────────── */}
          <Route path="/"       element={<Landing />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* ── Authenticated (share sidebar + topbar via AppLayout) ── */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/planner"    element={<Planner />} />
            <Route path="/events"     element={<Events />} />
            <Route path="/lost-found" element={<LostFound />} />
            <Route path="/resources"  element={<Resources />} />
            <Route path="/profile"    element={<Profile />} />
          </Route>

          {/* ── Fallback ───────────────────────── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ThemeContext.Provider>
  )
}

export default App
