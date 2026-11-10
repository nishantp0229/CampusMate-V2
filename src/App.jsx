// src/App.jsx — Root component: routing + dark-mode context provider

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { createContext, useContext, useState, useEffect } from 'react'

// Layout (shared shell for authenticated pages)
import AppLayout from './components/layout/AppLayout'
import ErrorBoundary from './components/ui/ErrorBoundary'

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

import { MOCK_LOST_FOUND } from './utils/mockData'

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
  const [lostFoundItems, setLostFoundItems] = useState(MOCK_LOST_FOUND)

  // Apply/remove .dark class on <html> and persist to localStorage
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('campusmate-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))
  const addLostFoundItem = (newItem) => setLostFoundItems(prev => [newItem, ...prev])
  const updateLostFoundItem = (id, updates) =>
    setLostFoundItems(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* ── Public ─────────────────────────── */}
            <Route path="/"       element={<Landing />} />
            <Route path="/login"  element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* ── Authenticated (share sidebar + topbar via AppLayout) ── */}
            <Route element={<AppLayout lostFoundItems={lostFoundItems} />}>
              <Route path="/dashboard"  element={<Dashboard lostFoundItems={lostFoundItems} />} />
              <Route path="/planner"    element={<Planner />} />
              <Route path="/events"     element={<Events />} />
              <Route path="/lost-found" element={<LostFound items={lostFoundItems} onAddItem={addLostFoundItem} onUpdateItem={updateLostFoundItem} />} />
              <Route path="/resources"  element={<Resources />} />
              <Route path="/profile"    element={<Profile />} />
            </Route>

            {/* ── Fallback ───────────────────────── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeContext.Provider>
  )
}

export default App
