import { NavLink } from 'react-router-dom'
import { LayoutDashboard, CheckSquare, CalendarDays, Compass, BookOpen, UserCircle, X, ArrowUpRight, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const groups = [
  {
    label: 'Your workspace',
    links: [
      { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { label: 'Academic Planner', path: '/planner', icon: CheckSquare },
      { label: 'NoteNest', path: '/resources', icon: BookOpen },
    ],
  },
  {
    label: 'Campus life',
    links: [
      { label: 'CampusConnect', path: '/events', icon: CalendarDays },
      { label: 'CampusFind', path: '/lost-found', icon: Compass },
    ],
  },
  {
    label: 'Your account',
    links: [{ label: 'Student Profile', path: '/profile', icon: UserCircle }],
  },
]

function Sidebar({ isOpen, isMobile, onClose, closeButtonRef }) {
  const { signOut, studentName, studentInitials, profile } = useAuth()
  return (
    <aside id="workspace-sidebar" className={`workspace-sidebar ${isOpen ? 'is-open' : ''}`} aria-hidden={isMobile && !isOpen ? true : undefined} inert={isMobile && !isOpen}>
      <div className="workspace-sidebar-head">
        <NavLink to="/dashboard" onClick={onClose} className="workspace-brand" aria-label="CampusMate dashboard">
          <span className="workspace-brand-mark"><Compass size={22} strokeWidth={1.7} /></span>
          <span>CampusMate<small>MADE FOR CAMPUS LIFE</small></span>
        </NavLink>
        <button ref={closeButtonRef} type="button" className="workspace-sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
      </div>

      <nav className="workspace-nav" aria-label="Workspace navigation">
        {groups.map((group) => (
          <div className="workspace-nav-group" key={group.label}>
            <p>{group.label}</p>
            {group.links.map(({ label, path, icon: Icon }) => (
              <NavLink key={path} to={path} onClick={onClose} className={({ isActive }) => `workspace-nav-link ${isActive ? 'is-active' : ''}`}>
                <Icon size={18} strokeWidth={1.7} /><span>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
        <div className="workspace-nav-group">
          <p>Session</p>
          <button
            type="button"
            onClick={() => {
              onClose()
              signOut()
            }}
            className="workspace-nav-link"
            style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <LogOut size={18} strokeWidth={1.7} /><span>Sign Out</span>
          </button>
        </div>
      </nav>

      <div className="workspace-sidebar-footer">
        <span>YOUR CAMPUS, YOUR WAY.</span>
        <NavLink to="/profile" onClick={onClose} className="workspace-student" aria-label={`View ${studentName}'s profile`}>
          <span className="workspace-student-avatar">{studentInitials}</span>
          <span className="workspace-student-details">
            <strong>{studentName}</strong>
            <small>{profile?.department || profile?.college || 'Student Profile'}</small>
          </span>
          <ArrowUpRight size={16} />
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar
