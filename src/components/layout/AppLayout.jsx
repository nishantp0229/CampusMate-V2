// AppLayout.jsx — Root layout shell for all authenticated pages
// Composes Sidebar + Topbar + <Outlet> (page content).
// Manages mobile sidebar open/close state.

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

function AppLayout({ lostFoundItems }) {
  // Controls whether the mobile sidebar drawer is open
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--cm-bg)] text-[var(--cm-text)]">
      {/* Fixed sidebar — static on desktop, overlay drawer on mobile */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile backdrop — dims the page behind the open drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content column: topbar + scrollable page area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setSidebarOpen(true)} lostFoundItems={lostFoundItems} />
        <main className="flex-1 overflow-y-auto">
          {/* Child route components render here */}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
