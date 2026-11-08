// Topbar.jsx — Sticky top header bar for all authenticated pages (height: 56px)
// Shows: hamburger (mobile), page title, notifications dropdown, theme toggle, user avatar

import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Bell, Moon, Sun, X } from 'lucide-react'
import { useTheme } from '../../App'

// Maps route paths → human-readable page titles
const PAGE_TITLES = {
  '/dashboard':  'Dashboard',
  '/planner':    'Academic Planner',
  '/events':     'CampusConnect',
  '/lost-found': 'CampusFind',
  '/resources':  'NoteNest',
  '/profile':    'Profile & Settings',
}

// Mock notifications data
const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    title: 'Data Structures assignment due tomorrow',
    time: '2h ago',
    dotColor: '#FF9BAA',
  },
  {
    id: 2,
    title: 'TechFusion Hackathon registration open',
    time: '5h ago',
    dotColor: '#A9C9FF',
  },
  {
    id: 3,
    title: 'New resource added: ML Workshop Notes',
    time: '1d ago',
    dotColor: '#6BCB9A',
  },
]

function Topbar({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  // Notifications dropdown state
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  // Derive current page title from the route
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'CampusMate'

  // Close notifications panel when user clicks outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header
      className={[
        'h-14 flex items-center px-4 gap-3 flex-shrink-0',
        'sticky top-0 z-10',
        // Semi-transparent background with blur for a frosted-glass look
        'bg-white/80 dark:bg-[#171A29]/90 backdrop-blur-md',
        'border-b border-[#E2E8F0] dark:border-white/[0.07]',
      ].join(' ')}
    >
      {/* ── Left side: hamburger + page title ── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Hamburger — only visible on mobile (md:hidden) */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl text-[#737B8C] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.06] transition-colors flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        {/* Page title in Poppins */}
        <h1
          className="text-[#242B3A] dark:text-[#F1F1FC] font-semibold text-base truncate"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          {pageTitle}
        </h1>
      </div>

      {/* ── Right side: notifications, theme toggle, avatar ── */}
      <div className="flex items-center gap-1 flex-shrink-0">

        {/* Notifications bell with dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(prev => !prev)}
            className="relative p-2 rounded-xl text-[#737B8C] dark:text-[#A0A8B8] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Notifications"
          >
            <Bell size={19} />
            {/* Unread badge dot */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF9BAA] border-2 border-white dark:border-[#171A29]" />
          </button>

          {/* Notifications dropdown panel */}
          {notifOpen && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] shadow-lg overflow-hidden z-50">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] dark:border-white/[0.07]">
                <span
                  className="text-sm font-semibold text-[#242B3A] dark:text-[#F1F1FC]"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Notifications
                </span>
                <button
                  onClick={() => setNotifOpen(false)}
                  className="p-1 rounded-lg text-[#737B8C] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.06] transition-colors"
                  aria-label="Close notifications"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Notification items */}
              <ul>
                {MOCK_NOTIFICATIONS.map(({ id, title, time, dotColor }) => (
                  <li
                    key={id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-[#F7F8FC] dark:hover:bg-white/[0.04] transition-colors cursor-pointer border-b last:border-0 border-[#E2E8F0] dark:border-white/[0.05]"
                  >
                    {/* Colored indicator dot */}
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#242B3A] dark:text-[#F1F1FC] leading-snug">
                        {title}
                      </p>
                      <p className="text-[11px] text-[#737B8C] dark:text-[#A0A8B8] mt-0.5">
                        {time}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Theme toggle — Moon in light mode, Sun in dark mode */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-[#737B8C] dark:text-[#A0A8B8] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.06] transition-colors"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        {/* User avatar — initials "AM", navigates to /profile on click */}
        <button
          onClick={() => navigate('/profile')}
          className="w-8 h-8 rounded-full bg-[#A9C9FF] text-white text-xs font-bold flex items-center justify-center hover:opacity-90 transition-opacity ml-1"
          aria-label="Go to profile"
        >
          AM
        </button>
      </div>
    </header>
  )
}

export default Topbar
