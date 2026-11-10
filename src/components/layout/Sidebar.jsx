// src/components/layout/Sidebar.jsx — Minimal sidebar navigation

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  Compass,
  BookOpen,
  UserCircle,
  X,
} from 'lucide-react'
import { MOCK_USER } from '../../utils/mockData'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Academic Planner', path: '/planner', icon: CheckSquare },
  { label: 'NoteNest Library', path: '/resources', icon: BookOpen },
  { label: 'CampusConnect', path: '/events', icon: CalendarDays },
  { label: 'CampusFind', path: '/lost-found', icon: Compass },
  { label: 'Profile & Settings', path: '/profile', icon: UserCircle },
]

function Sidebar({ isOpen, onClose }) {
  return (
    <aside
      className={`fixed top-0 left-0 z-30 flex h-full w-56 flex-col border-r border-[var(--cm-border)]/70 bg-[var(--cm-surface)] transition-transform duration-200 md:static md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Brand header */}
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-[var(--cm-accent)] text-[11px] font-semibold text-[var(--cm-accent-text)]">
            CM
          </span>
          <span className="font-['Poppins'] text-sm font-semibold text-[var(--cm-text)]">
            CampusMate
          </span>
        </div>

        <button
          onClick={onClose}
          className="rounded p-1 text-[var(--cm-muted)] hover:text-[var(--cm-text)] md:hidden"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition-colors ${
                isActive
                  ? 'bg-[var(--cm-secondary)] font-medium text-[var(--cm-text)]'
                  : 'text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]/50 hover:text-[var(--cm-text)]'
              }`
            }
          >
            <Icon size={15} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Student footer */}
      <div className="border-t border-[var(--cm-border)]/70 px-3 py-2.5">
        <NavLink
          to="/profile"
          onClick={onClose}
          className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-[var(--cm-secondary)]/50"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[var(--cm-secondary)] text-[11px] font-semibold text-[var(--cm-text)]">
            {MOCK_USER.avatarInitials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-[var(--cm-text)]">{MOCK_USER.name}</p>
            <p className="truncate text-[11px] text-[var(--cm-muted)]">Sem {MOCK_USER.semester}</p>
          </div>
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar
