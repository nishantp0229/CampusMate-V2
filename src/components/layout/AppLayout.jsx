// AppLayout.jsx — Root layout shell for all authenticated pages
// Composes Sidebar + Topbar + <Outlet> (page content).
// Manages mobile sidebar open/close state.

import { useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import '../../styles/workspace.css'

function AppLayout({ lostFoundItems }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const menuButtonRef = useRef(null)
  const closeButtonRef = useRef(null)

  const closeSidebar = () => {
    setSidebarOpen(false)
    if (isMobile) menuButtonRef.current?.focus()
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => {
      setIsMobile(media.matches)
      if (!media.matches) setSidebarOpen(false)
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!sidebarOpen || !isMobile) return undefined
    closeButtonRef.current?.focus()
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
        menuButtonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [sidebarOpen, isMobile])

  return (
    <div className="workspace">
      <Sidebar isOpen={sidebarOpen} isMobile={isMobile} onClose={closeSidebar} closeButtonRef={closeButtonRef} />
      {sidebarOpen && (
        <button type="button" className="workspace-backdrop" onClick={closeSidebar} aria-label="Close navigation" />
      )}
      <div className="workspace-column">
        <Topbar onMenuClick={() => setSidebarOpen(true)} menuOpen={sidebarOpen} menuButtonRef={menuButtonRef} lostFoundItems={lostFoundItems} />
        <main className="workspace-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
