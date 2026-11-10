// src/components/layout/Topbar.jsx — Top bar with functional global search, notifications & theme toggle

import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Menu, Bell, Moon, Sun, Search, X } from 'lucide-react'
import { useTheme } from '../../App'
import { MOCK_USER, MOCK_TASKS, MOCK_EVENTS, MOCK_RESOURCES, MOCK_LOST_FOUND } from '../../utils/mockData'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/planner': 'Academic Planner',
  '/events': 'CampusConnect',
  '/lost-found': 'CampusFind',
  '/resources': 'NoteNest',
  '/profile': 'Profile & Settings',
}

const NOTIFICATIONS = [
  { id: 1, title: 'Data Structures assignment due soon', link: '/planner' },
  { id: 2, title: 'TechFusion Hackathon registration open', link: '/events' },
  { id: 3, title: 'New DBMS notes added to NoteNest', link: '/resources' },
]

function Topbar({ onMenuClick, lostFoundItems = MOCK_LOST_FOUND }) {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)

  // Close search dropdown on outside click or Escape
  useEffect(() => {
    const onDown = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setSearchOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const q = search.trim().toLowerCase()

  const searchGroups = q
    ? [
        {
          module: 'Academic Planner',
          items: MOCK_TASKS.filter(
            (t) => t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
          ).map((t) => ({ id: t.id, title: t.title, meta: t.subject, path: '/planner' })),
        },
        {
          module: 'CampusConnect',
          items: MOCK_EVENTS.filter(
            (ev) => ev.title.toLowerCase().includes(q) || ev.category.toLowerCase().includes(q)
          ).map((ev) => ({ id: ev.id, title: ev.title, meta: ev.category, path: '/events', state: { selectedId: ev.id } })),
        },
        {
          module: 'NoteNest',
          items: MOCK_RESOURCES.filter(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              r.subject.toLowerCase().includes(q) ||
              r.tags?.some((tag) => tag.toLowerCase().includes(q))
          ).map((r) => ({ id: r.id, title: r.title, meta: `${r.subject} · Sem ${r.semester}`, path: '/resources' })),
        },
        {
          module: 'CampusFind',
          items: lostFoundItems.filter(
            (i) => i.itemName.toLowerCase().includes(q) || i.location.toLowerCase().includes(q)
          ).map((i) => ({ id: i.id, title: i.itemName, meta: `${i.type.toUpperCase()} · ${i.location}`, path: '/lost-found', state: { selectedId: i.id } })),
        },
      ].filter((group) => group.items.length > 0)
    : []

  const handleSubmit = (e) => {
    e.preventDefault()
    if (q) setSearchOpen(true)
  }

  const handleSelectResult = (item) => {
    setSearchOpen(false)
    setSearch('')
    navigate(item.path, item.state ? { state: item.state } : undefined)
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[var(--cm-border)]/70 bg-[var(--cm-surface)] px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded p-1.5 text-[var(--cm-muted)] hover:text-[var(--cm-text)] md:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="font-['Poppins'] text-sm font-semibold text-[var(--cm-text)]">
          {PAGE_TITLES[pathname] || 'CampusMate'}
        </h1>
      </div>

      {/* Global Search across all modules */}
      <div ref={searchRef} className="relative max-w-sm flex-1">
        <form onSubmit={handleSubmit} className="relative">
          <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--cm-muted)]" />
          <input
            type="text"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true) }}
            placeholder="Search tasks, events, notes, items..."
            className="w-full rounded border border-[var(--cm-border)]/60 bg-[var(--cm-bg)] py-1.5 pr-7 pl-8 text-xs text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-muted)] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchOpen(false) }}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </form>

        {searchOpen && q && (
          <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-80 overflow-y-auto rounded border border-[var(--cm-border)] bg-[var(--cm-card)] p-2">
            {searchGroups.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-[var(--cm-muted)]">
                No matches found for &ldquo;{search.trim()}&rdquo;
              </p>
            ) : (
              searchGroups.map((group) => (
                <div key={group.module} className="mb-2 last:mb-0">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cm-muted)]">
                    {group.module}
                  </p>
                  {group.items.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectResult(item)}
                      className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[var(--cm-secondary)]"
                    >
                      <span className="truncate font-medium text-[var(--cm-text)]">{item.title}</span>
                      <span className="shrink-0 text-[11px] text-[var(--cm-muted)]">{item.meta}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setNotifOpen((open) => !open)}
            className="relative rounded p-1.5 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]/60 hover:text-[var(--cm-text)]"
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-50 mt-2 w-72 rounded border border-[var(--cm-border)] bg-[var(--cm-card)] p-2">
              <p className="px-2 py-1 text-xs font-semibold text-[var(--cm-text)]">Notifications</p>
              {NOTIFICATIONS.map((item) => (
                <Link
                  key={item.id}
                  to={item.link}
                  onClick={() => setNotifOpen(false)}
                  className="block rounded px-2 py-2 text-xs text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)]"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="rounded p-1.5 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]/60 hover:text-[var(--cm-text)]"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <Link
          to="/profile"
          className="flex h-7 w-7 items-center justify-center rounded bg-[var(--cm-secondary)] text-[11px] font-semibold text-[var(--cm-text)]"
        >
          {MOCK_USER.avatarInitials}
        </Link>
      </div>
    </header>
  )
}

export default Topbar
