// src/components/layout/Sidebar.jsx — Purpose-built collegiate sidebar navigation

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CheckSquare,
  CalendarDays,
  BookOpen,
  UserCircle,
  X,
  Compass,
} from 'lucide-react'
import { MOCK_TASKS, MOCK_USER } from '../../utils/mockData'

// Navigation sections grouped with intentional academic hierarchy
const navSections = [
  {
    title: 'Academics',
    items: [
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard',
        badge: null,
      },
      {
        label: 'Academic Planner',
        icon: CheckSquare,
        path: '/planner',
        badge: `${MOCK_TASKS.filter(t => t.status === 'pending').length} due`,
        badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
      },
      {
        label: 'NoteNest Library',
        icon: BookOpen,
        path: '/resources',
        badge: null,
      },
    ],
  },
  {
    title: 'Campus Life',
    items: [
      {
        label: 'CampusConnect',
        icon: CalendarDays,
        path: '/events',
        badge: '7 live',
        badgeColor: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
      },
      {
        label: 'CampusFind',
        icon: Compass,
        path: '/lost-found',
        badge: null,
      },
    ],
  },
  {
    title: 'Personal',
    items: [
      {
        label: 'Profile & Settings',
        icon: UserCircle,
        path: '/profile',
        badge: null,
      },
    ],
  },
]

function Sidebar({ isOpen, onClose }) {
  return (
    <aside
      className={[
        'fixed top-0 left-0 h-full w-[250px] flex flex-col z-30',
        'bg-[#FAFBFD] dark:bg-[#121622]',
        'border-r border-slate-200/80 dark:border-white/[0.08]',
        'transition-transform duration-200 ease-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0 md:static md:z-auto',
      ].join(' ')}
    >
      {/* ── College Workspace Identity Header ── */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200/70 dark:border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#94B8FF] to-[#C2B0FF] flex items-center justify-center flex-shrink-0 text-white shadow-xs font-semibold text-xs tracking-wider">
            CM
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="font-semibold text-sm tracking-tight text-slate-900 dark:text-slate-100 truncate"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                CampusMate
              </span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                v1.2
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              DTU Campus · Sem 5
            </p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Navigation Sections ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-2.5 text-[10px] font-medium tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {section.title}
            </p>

            <div className="space-y-0.5">
              {section.items.map(({ label, icon: Icon, path, badge, badgeColor }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    [
                      'group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-white shadow-xs border border-slate-200/60 dark:border-white/[0.08]'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.03]',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon
                          size={16}
                          className={[
                            'transition-colors flex-shrink-0',
                            isActive
                              ? 'text-[#5B8DEF] dark:text-[#94B8FF]'
                              : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300',
                          ].join(' ')}
                          strokeWidth={isActive ? 2.2 : 1.75}
                        />
                        <span className="truncate">{label}</span>
                      </div>

                      {badge && (
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${badgeColor || 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'}`}
                        >
                          {badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Student Mini-Profile & Campus Pulse Footer ── */}
      <div className="p-3 border-t border-slate-200/70 dark:border-white/[0.06] flex-shrink-0 bg-white/50 dark:bg-transparent">
        <NavLink
          to="/profile"
          onClick={onClose}
          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-slate-200 flex-shrink-0">
            {MOCK_USER.avatarInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate block">
                {MOCK_USER.name}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" title="Active on Campus" />
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
              {MOCK_USER.department.split(' ')[0]} · Sem {MOCK_USER.semester}
            </span>
          </div>
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar
