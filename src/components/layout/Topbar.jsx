// src/components/layout/Topbar.jsx — Collegiate Topbar with breadcrumb, global search & quick notifications

import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Menu, Bell, Moon, Sun, Search, X } from 'lucide-react'
import { useTheme } from '../../App'
import { MOCK_USER, MOCK_TASKS, MOCK_EVENTS, MOCK_RESOURCES, MOCK_LOST_FOUND } from '../../utils/mockData'

const PAGE_TITLES = {
  '/dashboard': 'Campus Compass Hub',
  '/planner': 'Academic Planner',
  '/events': 'CampusConnect (Events)',
  '/lost-found': 'CampusFind (Lost & Found)',
  '/resources': 'NoteNest Vault',
  '/profile': 'Student Passport',
}

const NOTIFICATIONS = [
  { id: 1, title: 'Data Structures assignment due in 48 hours', link: '/planner', tag: 'Academic' },
  { id: 2, title: 'TechFusion Hackathon registration is filling up', link: '/events', tag: 'Campus' },
  { id: 3, title: 'New Unit 3 DBMS Notes added to Vault', link: '/resources', tag: 'Notes' },
]

function Topbar({ onMenuClick, lostFoundItems = MOCK_LOST_FOUND }) {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)

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
          module: 'NoteNest Vault',
          items: MOCK_RESOURCES.filter(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              r.subject.toLowerCase().includes(q) ||
              r.tags?.some((tag) => tag.toLowerCase().includes(q))
          ).map((r) => ({ id: r.id, title: r.title, meta: `${r.subject} · Sem ${r.semester}`, path: '/resources' })),
        },
        {
          module: 'CampusFind Marketplace',
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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[var(--cm-border)] bg-[var(--cm-surface)]/95 backdrop-blur-md px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)] md:hidden cursor-pointer"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2 text-xs">
          <span className="hidden text-[var(--cm-muted)] sm:inline font-medium">DTU Portal</span>
          <span className="hidden text-[var(--cm-muted)]/50 sm:inline">/</span>
          <span className="font-['Poppins'] text-sm font-bold text-[var(--cm-text)]">
            {PAGE_TITLES[pathname] || 'Workspace'}
          </span>
        </div>
      </div>

      {/* Global Search across all modules */}
      <div ref={searchRef} className="relative max-w-md flex-1">
        <form onSubmit={handleSubmit} className="relative">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--cm-muted)]" />
          <input
            type="text"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => { setSearch(e.target.value); setSearchOpen(true) }}
            placeholder="Search courses, hackathons, lost items, notes..."
            className="w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] py-2 pr-8 pl-9.5 text-xs text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:border-[var(--cm-accent)] focus:ring-1 focus:ring-[var(--cm-accent)]/30 focus:outline-none transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchOpen(false) }}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--cm-muted)] hover:text-[var(--cm-text)] cursor-pointer"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </form>

        {searchOpen && q && (
          <div className="absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-[var(--cm-border)] bg-[var(--cm-card)] p-2.5 shadow-xl">
            {searchGroups.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[var(--cm-muted)]">
                No university assets match &ldquo;{search.trim()}&rdquo;
              </p>
            ) : (
              searchGroups.map((group) => (
                <div key={group.module} className="mb-2.5 last:mb-0">
                  <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--cm-accent)]">
                    {group.module}
                  </p>
                  {group.items.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectResult(item)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[var(--cm-secondary)] transition cursor-pointer"
                    >
                      <span className="truncate font-semibold text-[var(--cm-text)]">{item.title}</span>
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
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((open) => !open)}
            className="relative rounded-xl p-2 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)] cursor-pointer transition"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#AA2347] ring-2 ring-[var(--cm-surface)]" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-card)] p-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--cm-border)]">
                <p className="text-xs font-bold text-[var(--cm-text)]">Campus Notices</p>
                <span className="rounded bg-[var(--cm-secondary)] px-2 py-0.5 text-[10px] font-bold text-[var(--cm-accent)]">
                  3 unread
                </span>
              </div>
              <div className="divide-y divide-[var(--cm-border)]/60 pt-1">
                {NOTIFICATIONS.map((item) => (
                  <Link
                    key={item.id}
                    to={item.link}
                    onClick={() => setNotifOpen(false)}
                    className="block rounded-lg px-2.5 py-2 text-xs hover:bg-[var(--cm-secondary)] transition"
                  >
                    <span className="block font-semibold text-[var(--cm-text)]">{item.title}</span>
                    <span className="block text-[10px] text-[var(--cm-muted)] uppercase tracking-wider mt-0.5">
                      {item.tag}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-xl p-2 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)] cursor-pointer transition"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} className="text-[#FFC72C]" /> : <Moon size={18} />}
        </button>

        {/* Student Avatar */}
        <Link
          to="/profile"
          className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#AA2347] to-[#8A1B39] text-xs font-bold text-white shadow-xs hover:opacity-95 transition"
          title={MOCK_USER.name}
        >
          {MOCK_USER.avatarInitials}
        </Link>
      </div>
    </header>
  )
}

export default Topbar
