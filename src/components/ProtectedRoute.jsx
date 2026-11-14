// src/components/ProtectedRoute.jsx — Guards private workspace routes
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--cm-bg)] text-[var(--cm-text)]">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#AA2347] to-[#78142F] text-white shadow-lg">
            <Compass size={26} className="text-[#FFC72C] animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <p className="font-['Poppins'] text-xs font-semibold tracking-wider text-[var(--cm-muted)] uppercase">
            Loading CampusMate...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export default ProtectedRoute
