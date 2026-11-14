// Modal.jsx — Reusable dialog/modal overlay for CampusMate
// Uses ReactDOM.createPortal so it renders outside the normal DOM tree,
// avoiding z-index stacking issues.

import { useEffect, useId, useRef } from 'react'
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
  const titleId = useId()
  const dialogRef = useRef(null)
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

  useEffect(() => {
    if (!isOpen) return undefined
    const previousFocus = document.activeElement
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector('button, input, select, textarea, a[href]')?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      previousFocus?.focus()
    }
  }, [isOpen])

  const handleDialogKeyDown = (event) => {
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  if (!isOpen) return null

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  }[size] ?? 'max-w-md'

  return createPortal(
    // Backdrop overlay
    <div
      className="workspace-modal-backdrop"
      onClick={onClose}
    >
      {/* Modal panel — stop click propagation so clicks inside don't close modal */}
      <div
        ref={dialogRef}
        className={`workspace-modal ${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        {/* Header */}
        <div className="workspace-modal-heading">
          <h2 id={titleId}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="workspace-modal-close"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="workspace-modal-content">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default Modal
