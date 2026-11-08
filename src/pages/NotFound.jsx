// src/pages/NotFound.jsx
//
// Shown whenever the user visits a URL that doesn't match any route.
// React Router renders this via the wildcard route: <Route path="*" ... />

import { Link } from 'react-router-dom'
import { Home, AlertCircle } from 'lucide-react'

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F8FC] dark:bg-[#171A29] p-6">
      <div className="text-center max-w-sm">
        <AlertCircle size={48} className="text-[#C8B6FF] mx-auto mb-4" />
        <h1 className="text-5xl font-bold text-[#242B3A] dark:text-[#F1F1FC] mb-2"
            style={{ fontFamily: 'Poppins, sans-serif' }}>
          404
        </h1>
        <p className="text-[#737B8C] dark:text-[#A0A8B8] mb-8">
          Oops! This page doesn't exist. Let's get you back on track.
        </p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A9C9FF] text-white font-semibold hover:bg-[#8BB8F8] transition-colors"
        >
          <Home size={18} />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

export default NotFound

