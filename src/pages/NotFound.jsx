// src/pages/NotFound.jsx — 404 fallback page

import { Link } from 'react-router-dom'
import { Home, AlertCircle } from 'lucide-react'

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--cm-bg)] p-6">
      <div className="text-center max-w-sm">
        <AlertCircle size={48} className="text-[var(--cm-muted)] mx-auto mb-4" />
        <h1 className="text-5xl font-bold text-[var(--cm-text)] mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
          404
        </h1>
        <p className="text-[var(--cm-muted)] mb-8">
          Oops! This page doesn't exist. Let's get you back on track.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--cm-accent)] text-[var(--cm-accent-text)] font-semibold hover:opacity-90 transition-opacity"
        >
          <Home size={18} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default NotFound
