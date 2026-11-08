// Sidebar.jsx — Fixed left navigation drawer for CampusMate
// Desktop: always visible static sidebar (240px wide)
// Mobile: sliding drawer overlay, controlled by isOpen/onClose props

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  MapPin,
  BookOpen,
  UserCircle,
  GraduationCap,
  X,
} from 'lucide-react'

// Navigation items — each has a label, icon component, route path, and accent color
const navItems = [
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/dashboard',  accentColor: '#A9C9FF' },
  { label: 'Academic Planner', icon: CheckSquare,     path: '/planner',    accentColor: '#6BCB9A' },
  { label: 'CampusConnect',    icon: CalendarDays,    path: '/events',     accentColor: '#C8B6FF' },
  { label: 'CampusFind',       icon: MapPin,          path: '/lost-found', accentColor: '#FF9BAA' },
  { label: 'NoteNest',         icon: BookOpen,        path: '/resources',  accentColor: '#FFB347' },
  { label: 'Profile',          icon: UserCircle,      path: '/profile',    accentColor: '#94B4FF' },
]

function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Sidebar panel
          - Mobile: fixed overlay, slides in/out via translate-x
          - Desktop (md+): static, always visible */}
      <aside
        className={[
          // Base layout
          'fixed top-0 left-0 h-full w-[240px] flex flex-col z-30',
          // Colors & border
          'bg-white dark:bg-[#202438]',
          'border-r border-[#E2E8F0] dark:border-white/[0.07]',
          // Mobile slide animation
          'transition-transform duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: always shown, static positioning handled by parent flex
          'md:translate-x-0 md:static md:z-auto',
        ].join(' ')}
      >
        {/* ── Logo / Brand area (height matches topbar: 56px) ── */}
        <div className="flex items-center justify-between h-14 px-4 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Accent circle with graduation cap icon */}
            <div className="w-8 h-8 rounded-full bg-[#A9C9FF] flex items-center justify-center flex-shrink-0">
              <GraduationCap size={16} color="#ffffff" />
            </div>
            {/* App name in Poppins bold */}
            <span
              className="text-[#242B3A] dark:text-[#F1F1FC] font-bold text-base tracking-tight"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              CampusMate
            </span>
          </div>

          {/* Close button — only visible on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-lg text-[#737B8C] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Navigation section ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/* Section label */}
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#737B8C] dark:text-[#A0A8B8]">
            Menu
          </p>

          <ul className="space-y-0.5">
            {navItems.map(({ label, icon: Icon, path, accentColor }) => (
              <li key={path}>
                {/* NavLink provides isActive to both className and children callbacks */}
                <NavLink
                  to={path}
                  onClick={onClose} // close mobile drawer on nav
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors relative',
                      isActive
                        ? 'bg-[#EAF2FF] dark:bg-white/[0.06] text-[#242B3A] dark:text-[#F1F1FC]'
                        : 'text-[#737B8C] dark:text-[#A0A8B8] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.04]',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Icon — colored with accentColor when active, muted otherwise */}
                      <Icon
                        size={18}
                        style={{ color: isActive ? accentColor : undefined }}
                        className={isActive ? '' : 'text-[#737B8C] dark:text-[#A0A8B8]'}
                        strokeWidth={isActive ? 2.2 : 1.8}
                      />

                      {/* Nav label */}
                      <span className="flex-1 truncate">{label}</span>

                      {/* Active indicator dot */}
                      {isActive && (
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: accentColor }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Footer area ── */}
        <div className="px-4 py-3 border-t border-[#E2E8F0] dark:border-white/[0.07] flex-shrink-0">
          <p className="text-[11px] text-[#737B8C] dark:text-[#A0A8B8]">
            <span className="font-medium">CampusMate</span> &nbsp;v1.0.0
          </p>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
