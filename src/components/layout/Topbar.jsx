import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Menu, Bell, Moon, Sun, Search, X } from 'lucide-react'
import { useTheme } from '../../App'
import { MOCK_USER, MOCK_TASKS, MOCK_EVENTS, MOCK_RESOURCES, MOCK_LOST_FOUND } from '../../utils/mockData'

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/planner': 'Academic Planner',
  '/events': 'CampusConnect',
  '/lost-found': 'CampusFind',
  '/resources': 'NoteNest',
  '/profile': 'Student Profile',
}

const notifications = [
  { id: 1, title: 'Data Structures assignment due in 48 hours', link: '/planner', tag: 'Academic' },
  { id: 2, title: 'TechFusion Hackathon registration is filling up', link: '/events', tag: 'Campus' },
  { id: 3, title: 'New Unit 3 DBMS Notes added to Vault', link: '/resources', tag: 'Notes' },
]

function Topbar({ onMenuClick, menuOpen, menuButtonRef, lostFoundItems = MOCK_LOST_FOUND }) {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const notifRef = useRef(null)

  useEffect(() => {
    const onDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false)
    }
    const onKey = (event) => { if (event.key === 'Escape') { setSearchOpen(false); setNotifOpen(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const query = search.trim().toLowerCase()
  const searchGroups = query
    ? [
        {
          module: 'Academic Planner',
          items: MOCK_TASKS.filter((task) => task.title.toLowerCase().includes(query) || task.subject.toLowerCase().includes(query))
            .map((task) => ({ id: task.id, title: task.title, meta: task.subject, path: '/planner' })),
        },
        {
          module: 'CampusConnect',
          items: MOCK_EVENTS.filter((event) => event.title.toLowerCase().includes(query) || event.category.toLowerCase().includes(query))
            .map((event) => ({ id: event.id, title: event.title, meta: event.category, path: '/events', state: { selectedId: event.id } })),
        },
        {
          module: 'NoteNest',
          items: MOCK_RESOURCES.filter((resource) => resource.title.toLowerCase().includes(query) || resource.subject.toLowerCase().includes(query) || resource.tags?.some((tag) => tag.toLowerCase().includes(query)))
            .map((resource) => ({ id: resource.id, title: resource.title, meta: `${resource.subject} · Sem ${resource.semester}`, path: '/resources' })),
        },
        {
          module: 'CampusFind',
          items: lostFoundItems.filter((item) => item.itemName.toLowerCase().includes(query) || item.location.toLowerCase().includes(query))
            .map((item) => ({ id: item.id, title: item.itemName, meta: `${item.type.toUpperCase()} · ${item.location}`, path: '/lost-found', state: { selectedId: item.id } })),
        },
      ].filter((group) => group.items.length > 0)
    : []

  const handleSelectResult = (item) => {
    setSearchOpen(false)
    setSearch('')
    navigate(item.path, item.state ? { state: item.state } : undefined)
  }

  return (
    <header className="workspace-topbar">
      <button ref={menuButtonRef} type="button" onClick={onMenuClick} className="workspace-icon-button workspace-menu-button" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="workspace-sidebar"><Menu size={20} /></button>
      <div className="workspace-breadcrumb"><span>YOUR CAMPUS</span><span>/</span><strong>{pageTitles[pathname] || 'Workspace'}</strong></div>
      <span className="workspace-demo-label">DEMO DATA</span>

      <div ref={searchRef} className="workspace-search">
        <form onSubmit={(event) => { event.preventDefault(); if (query) setSearchOpen(true) }}>
          <Search size={17} aria-hidden="true" />
          <input type="search" value={search} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true) }} placeholder="Search campus" aria-label="Search CampusMate" />
          {search && <button type="button" onClick={() => { setSearch(''); setSearchOpen(false) }} aria-label="Clear search"><X size={15} /></button>}
        </form>
        {searchOpen && query && (
          <div className="workspace-dropdown workspace-search-results">
            {searchGroups.length === 0 ? <p className="workspace-empty-search">No results for “{search.trim()}”</p> : searchGroups.map((group) => (
              <div className="workspace-result-group" key={group.module}>
                <p>{group.module}</p>
                {group.items.slice(0, 3).map((item) => <button type="button" key={item.id} onClick={() => handleSelectResult(item)}><strong>{item.title}</strong><span>{item.meta}</span></button>)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="workspace-topbar-actions">
        <div ref={notifRef} className="workspace-notifications">
          <button type="button" onClick={() => setNotifOpen((open) => !open)} className="workspace-icon-button" aria-label="Notifications" aria-expanded={notifOpen}><Bell size={19} /><span className="workspace-notification-dot" /></button>
          {notifOpen && (
            <div className="workspace-dropdown workspace-notification-list">
              <div className="workspace-notification-heading"><strong>Campus notices</strong><span>EXAMPLE DATA</span></div>
              {notifications.map((item) => <Link key={item.id} to={item.link} onClick={() => setNotifOpen(false)}><strong>{item.title}</strong><span>{item.tag}</span></Link>)}
            </div>
          )}
        </div>
        <button type="button" onClick={toggleTheme} className="workspace-icon-button" aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
        <Link to="/profile" className="workspace-topbar-avatar" aria-label={`View ${MOCK_USER.name}'s profile`}>{MOCK_USER.avatarInitials}</Link>
      </div>
    </header>
  )
}

export default Topbar
