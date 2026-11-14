import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('CampusMate caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--cm-bg)] text-[var(--cm-text)] p-6 font-['Inter',sans-serif]">
          <div className="max-w-md w-full rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] p-8 text-center shadow-xl space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--cm-accent-tint)] text-[var(--cm-accent)] text-2xl font-bold">
              ⚠️
            </div>
            <h1 className="font-['Georgia'] text-3xl font-normal text-[var(--cm-text)]">
              Something went wrong
            </h1>
            <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
              {this.state.error?.message || 'An unexpected error occurred while loading this page.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded bg-[var(--cm-accent)] px-4 py-2.5 text-xs font-bold text-[var(--cm-accent-text)] hover:opacity-90 transition cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.href = '/'
                }}
                className="rounded border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
              >
                Go to Landing
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
