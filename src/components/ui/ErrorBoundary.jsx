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
        <div className="min-h-screen flex items-center justify-center bg-[#FAF7F8] dark:bg-[#0D0F17] text-[#191B24] dark:text-[#ECEAF2] p-6 font-['Inter',sans-serif]">
          <div className="max-w-md w-full rounded-3xl border border-[#E8D3DC] dark:border-[#2F3752] bg-white dark:bg-[#151825] p-8 text-center shadow-xl space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#AA2347]/10 text-[#AA2347] dark:bg-[#D4345A]/20 dark:text-[#FFC72C] text-2xl font-bold">
              ⚠️
            </div>
            <h1 className="font-['Poppins'] text-2xl font-extrabold text-[#191B24] dark:text-[#ECEAF2]">
              Something went wrong
            </h1>
            <p className="text-xs sm:text-sm text-[#666C82] dark:text-[#9BA3BF]">
              {this.state.error?.message || 'An unexpected error occurred while loading this page.'}
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-xl bg-[#AA2347] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#8A1B39] transition cursor-pointer"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.href = '/'
                }}
                className="rounded-xl border border-[#E8D3DC] dark:border-[#2F3752] px-4 py-2.5 text-xs font-bold text-[#191B24] dark:text-[#ECEAF2] hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
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

