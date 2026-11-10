// src/pages/Login.jsx — Sliding Sign In / Sign Up interface inspired by Florin Pop & Campus Compass

import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Compass,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sun,
  Moon,
  ShieldCheck,
  CheckCircle2,
  X,
} from 'lucide-react'
import { useTheme } from '../App'

const INPUT_CLASS =
  'w-full pl-10 pr-3.5 py-2.5 bg-[var(--cm-bg)] border border-[var(--cm-border)] rounded-xl text-xs sm:text-sm text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:outline-none focus:border-[var(--cm-accent)] focus:ring-1 focus:ring-[var(--cm-accent)]/30 transition'

export function AuthCard({ initialSignUp = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  const [isSignUp, setIsSignUp] = useState(() => location.pathname === '/signup' || initialSignUp)

  // Form states
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [signupData, setSignupData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Forgot password modal
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const handleLoginSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!loginData.email.trim() || !loginData.email.includes('@')) {
      return setError('Please enter a valid university email address.')
    }
    if (loginData.password.length < 6) {
      return setError('Password must be at least 6 characters.')
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      navigate('/dashboard')
    }, 700)
  }

  const handleSignupSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (signupData.name.trim().length < 2) {
      return setError('Please enter your full legal name.')
    }
    if (!signupData.email.trim() || !signupData.email.includes('@')) {
      return setError('Please enter a valid university email address.')
    }
    if (signupData.password.length < 8) {
      return setError('Password must be at least 8 characters long.')
    }
    if (signupData.password !== signupData.confirmPassword) {
      return setError('Passwords do not match.')
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      navigate('/dashboard')
    }, 700)
  }

  const handleForgotSubmit = (e) => {
    e.preventDefault()
    if (!forgotEmail || !forgotEmail.includes('@')) return
    setForgotSent(true)
    setTimeout(() => {
      setForgotSent(false)
      setForgotOpen(false)
      setForgotEmail('')
    }, 2200)
  }

  return (
    <div className="min-h-screen bg-[var(--cm-bg)] flex flex-col justify-between p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Ambient background decoration */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#AA2347]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#FFC72C]/10 blur-3xl pointer-events-none" />

      {/* Top Bar with brand & theme switcher */}
      <header className="relative z-10 mx-auto w-full max-w-5xl flex items-center justify-between pb-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#AA2347] to-[#8A1B39] text-white shadow-md shadow-[#AA2347]/20 group-hover:scale-105 transition">
            <Compass size={20} className="text-[#FFC72C]" />
          </div>
          <div>
            <span className="font-['Poppins'] text-base font-extrabold tracking-tight text-[var(--cm-text)]">
              CampusMate
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-bold text-[#AA2347] dark:text-[#FFC72C] uppercase tracking-wider">
              Student Portal
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-2 text-[var(--cm-muted)] hover:text-[var(--cm-text)] transition cursor-pointer shadow-2xs"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={17} className="text-[#FFC72C]" /> : <Moon size={17} />}
          </button>
          <Link
            to="/"
            className="text-xs font-semibold text-[var(--cm-muted)] hover:text-[var(--cm-text)] transition hidden sm:inline-block px-2"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Auth Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center py-4">
        {/* ── DESKTOP SLIDING CONTAINER (Florin Pop mechanism) ── */}
        <div
          className={`auth-container hidden md:block rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-2xl ${
            isSignUp ? 'right-panel-active' : ''
          }`}
        >
          {/* 1. SIGN IN FORM (Left half) */}
          <div className="auth-form-container auth-sign-in flex flex-col justify-center px-10 py-8">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="text-center mb-6">
                <h1 className="font-['Poppins'] text-2xl font-extrabold text-[var(--cm-text)]">
                  Sign In to CampusMate
                </h1>
                <p className="text-xs text-[var(--cm-muted)] mt-1">
                  Access your semester timetable, notes and events
                </p>
              </div>

              {error && !isSignUp && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1.5">
                  University Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type="email"
                    required
                    placeholder="arjun.mehta@dtu.ac.in"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs font-semibold text-[#AA2347] dark:text-[#FFC72C] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className={`${INPUT_CLASS} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)] hover:text-[var(--cm-text)] cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-[#AA2347]/25 hover:brightness-110 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-2.5 text-center">
                <p className="text-[11px] text-[var(--cm-muted)]">
                  <strong className="text-[var(--cm-text)]">Demo Mode:</strong> Any university email & 6+ char password opens the dashboard.
                </p>
              </div>
            </form>
          </div>

          {/* 2. SIGN UP FORM (Left half originally, slides into place) */}
          <div className="auth-form-container auth-sign-up flex flex-col justify-center px-10 py-8">
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="text-center mb-4">
                <h1 className="font-['Poppins'] text-2xl font-extrabold text-[var(--cm-text)]">
                  Create Student Account
                </h1>
                <p className="text-xs text-[var(--cm-muted)] mt-1">
                  Join CampusMate to organize your courses and campus life
                </p>
              </div>

              {error && isSignUp && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1">
                  Full Legal Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type="text"
                    required
                    placeholder="Arjun Mehta"
                    value={signupData.name}
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1">
                  University Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type="email"
                    required
                    placeholder="arjun.mehta@dtu.ac.in"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1">
                    Password <span className="text-[10px] lowercase font-normal">(8+ chars)</span>
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      className={`${INPUT_CLASS} pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)] hover:text-[var(--cm-text)] cursor-pointer"
                      aria-label="Toggle password visibility"
                    >
                      {showSignupPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-[#AA2347]/25 hover:brightness-110 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
              >
                {loading ? (
                  <span>Registering...</span>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 3. SLIDING OVERLAY CONTAINER */}
          <div className="auth-overlay-container">
            <div className="auth-overlay bg-gradient-to-br from-[#AA2347] via-[#8A1B39] to-[#5A1128] text-white">
              {/* Left Overlay Panel (Revealed when Sign Up is active, offers switch to Sign In) */}
              <div className="auth-overlay-panel auth-overlay-left">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md mb-3 text-[#FFC72C]">
                  <Compass size={13} /> University Portal
                </span>
                <h2 className="font-['Poppins'] text-2xl font-extrabold leading-snug">
                  Welcome Back, Scholar!
                </h2>
                <p className="text-xs sm:text-sm text-white/85 leading-relaxed mt-2 mb-6 max-w-xs">
                  To stay connected with your lectures, lab submissions and club events, please sign in with your student credentials.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="rounded-xl border-2 border-white px-7 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white hover:text-[#AA2347] transition-all duration-300 cursor-pointer shadow-md"
                >
                  Sign In Instead
                </button>
              </div>

              {/* Right Overlay Panel (Default visible, offers switch to Sign Up) */}
              <div className="auth-overlay-panel auth-overlay-right">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-md mb-3 text-[#FFC72C]">
                  <ShieldCheck size={13} /> Fresher Compass
                </span>
                <h2 className="font-['Poppins'] text-2xl font-extrabold leading-snug">
                  Hello, Future Achiever!
                </h2>
                <p className="text-xs sm:text-sm text-white/85 leading-relaxed mt-2 mb-6 max-w-xs">
                  Enter your university details and begin your academic journey with timetables, verified notes, and campus hubs.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="rounded-xl border-2 border-white px-7 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-white hover:text-[#AA2347] transition-all duration-300 cursor-pointer shadow-md"
                >
                  Sign Up Free
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── MOBILE RESPONSIVE ADAPTATION (< 768px) ── */}
        <div className="w-full max-w-md md:hidden rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-xl space-y-6">
          {/* Segmented Form Switcher */}
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`py-2 rounded-xl transition cursor-pointer ${
                !isSignUp
                  ? 'bg-[var(--cm-accent)] text-white shadow-xs'
                  : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`py-2 rounded-xl transition cursor-pointer ${
                isSignUp
                  ? 'bg-[var(--cm-accent)] text-white shadow-xs'
                  : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {!isSignUp ? (
            /* Mobile Sign In */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="text-center">
                <h1 className="font-['Poppins'] text-xl font-extrabold text-[var(--cm-text)]">
                  Sign In to CampusMate
                </h1>
                <p className="text-xs text-[var(--cm-muted)] mt-0.5">
                  Access your classes, notes and fests
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1">
                  University Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type="email"
                    required
                    placeholder="arjun.mehta@dtu.ac.in"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="text-xs font-semibold text-[#AA2347] dark:text-[#FFC72C]"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className={`${INPUT_CLASS} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]"
                  >
                    {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:brightness-110 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <span>Signing in...</span> : <><span>Sign In</span><ArrowRight size={15} /></>}
              </button>
            </form>
          ) : (
            /* Mobile Sign Up */
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div className="text-center">
                <h1 className="font-['Poppins'] text-xl font-extrabold text-[var(--cm-text)]">
                  Create Student Account
                </h1>
                <p className="text-xs text-[var(--cm-muted)] mt-0.5">
                  Join CampusMate in seconds
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type="text"
                    required
                    placeholder="Arjun Mehta"
                    value={signupData.name}
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1">
                  University Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type="email"
                    required
                    placeholder="arjun.mehta@dtu.ac.in"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type="password"
                    required
                    placeholder="•••••••• (8+ chars)"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] text-white font-bold text-xs uppercase tracking-wider shadow-md hover:brightness-110 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <span>Registering...</span> : <><span>Create Account</span><ArrowRight size={15} /></>}
              </button>
            </form>
          )}

          <div className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-2.5 text-center">
            <p className="text-[11px] text-[var(--cm-muted)]">
              <strong>Demo mode:</strong> Enter any valid email and 6+ char password to access.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-2 text-xs text-[var(--cm-muted)]">
        © 2026 CampusMate · University Student Companion · Built for Students
      </footer>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-2xl relative">
            <button
              onClick={() => setForgotOpen(false)}
              className="absolute top-4 right-4 text-[var(--cm-muted)] hover:text-[var(--cm-text)] cursor-pointer"
            >
              <X size={18} />
            </button>

            <h3 className="font-['Poppins'] text-lg font-bold text-[var(--cm-text)] mb-2">
              Reset Your Password
            </h3>
            <p className="text-xs text-[var(--cm-muted)] mb-4 leading-relaxed">
              Enter your registered college email and we will send you secure password reset instructions.
            </p>

            {forgotSent ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={16} /> Instructions sent to your email!
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="your.name@dtu.ac.in"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className={INPUT_CLASS}
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-[var(--cm-accent)] text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition cursor-pointer"
                >
                  Send Reset Link
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Login() {
  return <AuthCard initialSignUp={false} />
}

export default Login
