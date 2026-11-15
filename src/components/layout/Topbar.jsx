import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Menu, Bell, Moon, Sun, Search, X } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/planner': 'Academic Planner',
  '/events': 'CampusConnect',
  '/lost-found': 'CampusFind',
  '/resources': 'NoteNest',
  '/profile': 'Student Profile',
  '/admin': 'Admin Console',
}

function Topbar({ onMenuClick, menuOpen, menuButtonRef }) {
  const { theme, toggleTheme } = useTheme()
  const { user, studentName, studentInitials } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [notifications, setNotifications] = useState([])
  const searchRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const onDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  // Fetch real assignment deadlines as notifications
  useEffect(() => {
    if (!supabase || !user?.id) {
      setNotifications([])
      return
    }

    supabase
      .from('tasks')
      .select('id, title, due_date')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(3)
      .then(({ data, error }) => {
        if (!error && data) {
          setNotifications(
            data.map((t) => ({
              id: t.id,
              title: `Upcoming: ${t.title}`,
              link: '/planner',
              tag: 'Assignment',
            }))
          )
        }
      })
      .catch(() => {
        setNotifications([])
      })
  }, [user?.id])

  const query = search.trim().toLowerCase()

  // Live search across Supabase modules
  useEffect(() => {
    if (!query || query.length < 2 || !supabase) {
      setSearchResults([])
      return
    }

    let isCurrent = true
    const timer = setTimeout(async () => {
      try {
        const [eventsRes, resourcesRes, lostRes] = await Promise.all([
          supabase.from('events').select('id, title, category').ilike('title', `%${query}%`).limit(3),
          supabase.from('resources').select('id, title, subject').ilike('title', `%${query}%`).limit(3),
          supabase.from('lost_found').select('id, item_name, location, type').ilike('item_name', `%${query}%`).limit(3),
        ])

        if (!isCurrent) return

        const groups = []
        if (eventsRes.data?.length) {
          groups.push({
            module: 'CampusConnect',
            items: eventsRes.data.map((e) => ({
              id: e.id,
              title: e.title,
              meta: e.category,
              path: '/events',
              state: { selectedId: e.id },
            })),
          })
        }
        if (resourcesRes.data?.length) {
          groups.push({
            module: 'NoteNest',
            items: resourcesRes.data.map((r) => ({
              id: r.id,
              title: r.title,
              meta: r.subject,
              path: '/resources',
            })),
          })
        }
        if (lostRes.data?.length) {
          groups.push({
            module: 'CampusFind',
            items: lostRes.data.map((l) => ({
              id: l.id,
              title: l.item_name,
              meta: `${l.type?.toUpperCase()} · ${l.location}`,
              path: '/lost-found',
              state: { selectedId: l.id },
            })),
          })
        }
        setSearchResults(groups)
      } catch (err) {
        console.error('[CampusMate] Search error:', err)
      }
    }, 250)

    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [query])

  const handleSelectResult = (item) => {
    setSearchOpen(false)
    setSearch('')
    navigate(item.path, item.state ? { state: item.state } : undefined)
  }

  return (
    <header className="workspace-topbar">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onMenuClick}
        className="workspace-icon-button workspace-menu-button"
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        aria-controls="workspace-sidebar"
      >
        <Menu size={20} />
      </button>
      <div className="workspace-breadcrumb">
        <span>YOUR CAMPUS</span>
        <span>/</span>
        <strong>{pageTitles[pathname] || 'Workspace'}</strong>
      </div>

      <div ref={searchRef} className="workspace-search">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (query) setSearchOpen(true)
          }}
        >
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onFocus={() => setSearchOpen(true)}
            onChange={(event) => {
              setSearch(event.target.value)
              setSearchOpen(true)
            }}
            placeholder="Search campus"
            aria-label="Search CampusMate"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setSearchOpen(false)
              }}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </form>
        {searchOpen && query && (
          <div className="workspace-dropdown workspace-search-results">
            {searchResults.length === 0 ? (
              <p className="workspace-empty-search">No results for “{search.trim()}”</p>
            ) : (
              searchResults.map((group) => (
                <div className="workspace-result-group" key={group.module}>
                  <p>{group.module}</p>
                  {group.items.slice(0, 3).map((item) => (
                    <button type="button" key={item.id} onClick={() => handleSelectResult(item)}>
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="workspace-topbar-actions">
        <div ref={notifRef} className="workspace-notifications">
          <button
            type="button"
            onClick={() => setNotifOpen((open) => !open)}
            className="workspace-icon-button"
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <Bell size={19} />
            {notifications.length > 0 && <span className="workspace-notification-dot" />}
          </button>
          {notifOpen && (
            <div className="workspace-dropdown workspace-notification-list">
              <div className="workspace-notification-heading">
                <strong>Campus notices</strong>
                <span>LATEST</span>
              </div>
              {notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-[var(--cm-muted)]">
                  No pending deadlines or notices right now.
                </p>
              ) : (
                notifications.map((item) => (
                  <Link key={item.id} to={item.link} onClick={() => setNotifOpen(false)}>
                    <strong>{item.title}</strong>
                    <span>{item.tag}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="workspace-icon-button"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <Link
          to="/profile"
          className="workspace-topbar-avatar"
          aria-label={`View ${studentName}'s profile`}
        >
          {studentInitials}
        </Link>
      </div>
    </header>
  )
}

export default Topbar
