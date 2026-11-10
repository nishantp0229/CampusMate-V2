// src/components/layout/Sidebar.jsx — Collegiate University Navigation inspired by Campus Compass

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Compass,
  BookOpen,
  UserCircle,
  X,
  Sparkles,
} from 'lucide-react'
import { MOCK_USER } from '../../utils/mockData'

const WORKSPACE_NAV = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Academic Planner', path: '/planner', icon: CheckSquare },
  { label: 'NoteNest Vault', path: '/resources', icon: BookOpen },
]

const CAMPUS_NAV = [
  { label: 'CampusConnect', path: '/events', icon: CalendarDays },
  { label: 'CampusFind (Lost & Found)', path: '/lost-found', icon: Compass },
]

function Sidebar({ isOpen, onClose }) {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
      isActive
        ? 'bg-[var(--cm-accent)] text-white shadow-sm'
        : 'text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)]'
    }`

  return (
    <aside
      className={`fixed top-0 left-0 z-30 flex h-full w-64 flex-col border-r border-[var(--cm-border)] bg-[var(--cm-surface)] transition-transform duration-200 md:static md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand header with Campus Compass collegiate vibe */}
      <div className="flex h-18 items-center justify-between border-b border-[var(--cm-border)] px-4">
        <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-3 group">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#AA2347] to-[#78142F] text-white shadow-md shadow-[#AA2347]/20 group-hover:scale-105 transition">
            <Compass size={22} className="text-[#FFC72C]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-['Poppins'] text-base font-extrabold tracking-tight text-[var(--cm-text)]">
                CampusMate
              </span>
              <span className="rounded bg-[#FFC72C]/20 text-[#D99B00] dark:text-[#FFC72C] text-[9px] font-bold px-1.5 py-0.2 uppercase">
                v2.0
              </span>
            </div>
            <span className="block text-[11px] font-medium text-[var(--cm-muted)]">
              University Student Compass
            </span>
          </div>
        </NavLink>

        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--cm-muted)] hover:text-[var(--cm-text)] md:hidden cursor-pointer"
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3.5 py-5">
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
              Core Academics
            </p>
            <span className="text-[9px] font-semibold text-[#AA2347] dark:text-[#FFC72C]">
              Sem 5
            </span>
          </div>
          <div className="space-y-1">
            {WORKSPACE_NAV.map(({ label, path, icon: Icon }) => (
              <NavLink key={path} to={path} onClick={onClose} className={linkClass}>
                <Icon size={17} />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
            Campus Life & Hubs
          </p>
          <div className="space-y-1">
            {CAMPUS_NAV.map(({ label, path, icon: Icon }) => (
              <NavLink key={path} to={path} onClick={onClose} className={linkClass}>
                <Icon size={17} />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">
            Student Identity
          </p>
          <NavLink to="/profile" onClick={onClose} className={linkClass}>
            <UserCircle size={17} />
            <span className="truncate">Student Passport & ID</span>
          </NavLink>
        </div>
      </nav>

      {/* Student footer card */}
      <div className="border-t border-[var(--cm-border)] p-3.5">
        <NavLink
          to="/profile"
          onClick={onClose}
          className="flex items-center gap-3 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-2.5 hover:border-[var(--cm-accent)]/50 transition group"
        >
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cm-accent)] text-white text-xs font-bold shadow-xs">
            {MOCK_USER.avatarInitials}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--cm-surface)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[var(--cm-text)] group-hover:text-[var(--cm-accent)] transition">
              {MOCK_USER.name}
            </p>
            <p className="truncate text-[11px] text-[var(--cm-muted)]">
              CSE · 2K22/CO/184
            </p>
          </div>
          <Sparkles size={14} className="text-[#FFC72C] shrink-0" />
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar
