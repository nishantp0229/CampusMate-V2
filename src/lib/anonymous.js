// src/lib/anonymous.js — Domain logic, validation & helpers for CampusAnonymous

export const ANONYMOUS_STATUS = {
  IDLE: 'idle',
  WAITING: 'waiting',
  CONNECTED: 'connected',
  ENDED: 'ended',
}

/**
 * Checks whether CampusAnonymous is enabled via feature flag.
 * Disabled by default in production (VITE_ENABLE_CAMPUS_ANONYMOUS=false).
 */
export function isCampusAnonymousEnabled() {
  const flag =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ENABLE_CAMPUS_ANONYMOUS) ??
    (typeof process !== 'undefined' && process.env && process.env.VITE_ENABLE_CAMPUS_ANONYMOUS)

  return String(flag).toLowerCase() === 'true'
}

export const REPORT_REASONS = [
  'Harassment or hate speech',
  'Explicit or inappropriate content',
  'Spam or advertising',
  'Impersonation or phishing',
  'Other violation',
]

/**
 * Validate message content before transmission
 */
export function validateAnonymousMessage(content) {
  if (typeof content !== 'string') {
    return { isValid: false, error: 'Message must be text.' }
  }
  const clean = content.trim()
  if (clean.length === 0) {
    return { isValid: false, error: 'Message cannot be empty.' }
  }
  if (clean.length > 1000) {
    return { isValid: false, error: 'Message cannot exceed 1000 characters.' }
  }
  return { isValid: true, content: clean }
}

/**
 * Validate report form input
 */
export function validateAnonymousReport(reason, snippet = '') {
  if (!reason || typeof reason !== 'string') {
    return { isValid: false, error: 'Please select a reason for reporting.' }
  }
  const cleanReason = reason.trim()
  if (cleanReason.length < 3 || cleanReason.length > 300) {
    return { isValid: false, error: 'Reason must be between 3 and 300 characters.' }
  }

  const cleanSnippet = typeof snippet === 'string' ? snippet.trim().slice(0, 500) : ''
  return {
    isValid: true,
    reason: cleanReason,
    snippet: cleanSnippet || null,
  }
}

/**
 * Format timestamps for anonymous messages
 */
export function formatMessageTime(isoString) {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Resolve ICE servers from environment or fall back to public STUN.
 * Never hardcodes TURN credentials in client source.
 */
export function getIceServers() {
  const envIce =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_ICE_SERVERS) ||
    (typeof process !== 'undefined' && process.env && process.env.VITE_ICE_SERVERS)

  if (envIce) {
    try {
      const parsed = JSON.parse(envIce)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    } catch {
      // If it's a comma-separated list of URLs
      const urls = envIce.split(',').map((u) => u.trim()).filter(Boolean)
      if (urls.length > 0) {
        return [{ urls }]
      }
    }
  }

  // Safe fallback to 5 redundant public Google STUN servers (zero-cost)
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ]
}

/**
 * Safely requests browser fullscreen on documentElement.
 * Non-blocking and swallows rejections if browser policy or user denies.
 */
export async function requestBrowserFullscreen() {
  if (typeof document === 'undefined') return
  try {
    if (!document.fullscreenElement) {
      const el = document.documentElement
      if (el?.requestFullscreen) {
        await el.requestFullscreen().catch(() => {})
      } else if (el?.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen().catch(() => {})
      } else if (el?.msRequestFullscreen) {
        await el.msRequestFullscreen().catch(() => {})
      }
    }
  } catch {
    // Non-fatal if browser blocks fullscreen
  }
}

/**
 * Safely exits browser fullscreen if active.
 */
export async function exitBrowserFullscreen() {
  if (typeof document === 'undefined') return
  try {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {})
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen().catch(() => {})
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen().catch(() => {})
      }
    }
  } catch {
    // Non-fatal
  }
}

