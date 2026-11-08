// Modal.jsx — Reusable dialog/modal overlay for CampusMate
// Uses ReactDOM.createPortal so it renders outside the normal DOM tree,
// avoiding z-index stacking issues.

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * @param {boolean}  isOpen    - Whether the modal is visible
 * @param {function} onClose   - Called when user clicks X or the backdrop
 * @param {string}   title     - Modal heading
 * @param {ReactNode} children - Content inside the modal
 * @param {'sm'|'md'|'lg'} size - Width preset (default: 'md')
 */
function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  // Prevent body from scrolling while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Close on Escape key press
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }[size] ?? 'max-w-md'

  return createPortal(
    // Backdrop overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal panel — stop click propagation so clicks inside don't close modal */}
      <div
        className={`w-full ${sizeClass} bg-white dark:bg-[#252A3C] rounded-2xl shadow-xl border border-[#E2E8F0] dark:border-white/[0.07] flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] dark:border-white/[0.07] flex-shrink-0">
          <h2
            className="text-base font-semibold text-[#242B3A] dark:text-[#F1F1FC]"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#737B8C] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1 p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Modal

