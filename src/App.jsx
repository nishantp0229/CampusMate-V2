// src/App.jsx — Root component: routing + dark-mode context provider

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

// Layout (shared shell for authenticated pages)
import AppLayout from './components/layout/AppLayout'
import ErrorBoundary from './components/ui/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'

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
import Admin     from './pages/Admin'
import Community from './pages/Community'
import TeamUp    from './pages/TeamUp'
import Market    from './pages/Market'
import Anonymous from './pages/Anonymous'
import { isCampusAnonymousEnabled } from './lib/anonymous'

// 404
import NotFound from './pages/NotFound'
import { ThemeContext } from './context/ThemeContext'

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
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* ── Public ─────────────────────────── */}
              <Route path="/"       element={<Landing />} />
              <Route path="/login"  element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* ── Authenticated (protected by Supabase session) ── */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard"  element={<Dashboard />} />
                  <Route path="/planner"    element={<Planner />} />
                  <Route path="/events"     element={<Events />} />
                  <Route path="/lost-found" element={<LostFound />} />
                  <Route path="/resources"  element={<Resources />} />
                  <Route path="/community"  element={<Community />} />
                  <Route path="/teamup"     element={<TeamUp />} />
                  <Route path="/market"     element={<Market />} />
                  <Route path="/profile"    element={<Profile />} />
                  <Route path="/admin"      element={<Admin />} />
                </Route>
                {/* ── Immersive Full-Screen CampusAnonymous ── */}
                <Route
                  path="/anonymous"
                  element={
                    isCampusAnonymousEnabled() ? (
                      <Anonymous />
                    ) : (
                      <Navigate to="/dashboard" replace />
                    )
                  }
                />
              </Route>

              {/* ── Fallback ───────────────────────── */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeContext.Provider>
  )
}

export default App
