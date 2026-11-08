// src/components/layout/Topbar.jsx — Refined collegiate header with academic context & quick search

import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import {
  Menu,
  Bell,
  Moon,
  Sun,
  X,
  Search,
} from 'lucide-react'
import { useTheme } from '../../App'
import { MOCK_USER } from '../../utils/mockData'

const PAGE_METADATA = {
  '/dashboard': { title: 'Personal Dashboard', section: 'Overview' },
  '/planner': { title: 'Academic Planner', section: 'Academics' },
  '/events': { title: 'CampusConnect', section: 'Campus Life' },
  '/lost-found': { title: 'CampusFind', section: 'Campus Life' },
  '/resources': { title: 'NoteNest Repository', section: 'Academics' },
  '/profile': { title: 'Student Profile & Settings', section: 'Account' },
}

const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    title: 'Data Structures Assignment #4',
    category: 'Urgent Deadline',
    time: 'Due tomorrow at 11:59 PM',
    type: 'deadline',
    link: '/planner',
  },
  {
    id: 2,
    title: 'TechFusion Hackathon registration',
    category: 'Campus Event',
    time: 'Registration closes in 2 days',
    type: 'event',
    link: '/events',
  },
  {
    id: 3,
    title: 'OS Lecture Unit 3 Slides added',
    category: 'NoteNest',
    time: 'Uploaded 4 hours ago',
    type: 'resource',
    link: '/resources',
  },
]

function Topbar({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const [notifOpen, setNotifOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const notifRef = useRef(null)

  const meta = PAGE_METADATA[location.pathname] || { title: 'CampusMate', section: 'Portal' }

  // Close notifications on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchTerm.trim()) {
      // Directs to planner or resources with search context
      navigate(`/planner?q=${encodeURIComponent(searchTerm.trim())}`)
      setSearchTerm('')
    }
  }

  return (
    <header className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20 bg-white dark:bg-[#121622] border-b border-slate-200/80 dark:border-white/[0.08]">
      {/* ── Left: Navigation toggle & Academic Breadcrumbs ── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 text-xs truncate">
          <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">
            {meta.section}
          </span>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
          <h1
            className="font-semibold text-slate-900 dark:text-slate-100 text-[13px] tracking-tight truncate"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {meta.title}
          </h1>
        </div>
      </div>

      {/* ── Center: Search Bar (Linear/Notion style) ── */}
      <form
        onSubmit={handleSearchSubmit}
        className="hidden md:flex items-center flex-1 max-w-sm mx-4"
      >
        <div className="relative w-full">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search assignments, resources, events..."
            className="w-full pl-8 pr-12 py-1.5 bg-slate-100/70 dark:bg-white/[0.05] border border-transparent focus:border-slate-300 dark:focus:border-white/20 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 dark:text-slate-500 px-1 py-0.5 rounded bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 pointer-events-none">
            ↵
          </span>
        </div>
      </form>

      {/* ── Right Actions: Academic Term, Notifications, Theme, Profile ── */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Semester Week Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.05] text-[11px] font-medium text-slate-600 dark:text-slate-400">
          <span className="w-1.5 h-1.5 rounded-full bg-[#94B8FF]" />
          <span>Fall '26 · Week 11</span>
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#181D2B] rounded-xl border border-slate-200 dark:border-white/10 shadow-lg z-50 overflow-hidden text-left">
              <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    Notifications & Reminders
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">3 unread campus alerts</p>
                </div>
                <button
                  onClick={() => setNotifOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {MOCK_NOTIFICATIONS.map((n) => (
                  <Link
                    key={n.id}
                    to={n.link}
                    onClick={() => setNotifOpen(false)}
                    className="p-3 block hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] font-medium tracking-wide uppercase text-[#5B8DEF] dark:text-[#94B8FF]">
                        {n.category}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {n.time.includes('Due') ? '⚠️' : '📢'}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-[#5B8DEF] transition-colors">
                      {n.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {n.time}
                    </p>
                  </Link>
                ))}
              </div>

              <div className="p-2 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] text-center">
                <Link
                  to="/planner"
                  onClick={() => setNotifOpen(false)}
                  className="text-[11px] font-medium text-[#5B8DEF] hover:underline"
                >
                  View assignment timeline →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Student Avatar quick access */}
        <Link
          to="/profile"
          className="flex items-center gap-2 pl-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            {MOCK_USER.avatarInitials}
          </div>
        </Link>
      </div>
    </header>
  )
}

export default Topbar
