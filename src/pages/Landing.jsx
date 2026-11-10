// src/pages/Landing.jsx — Public landing/home page

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap, CheckSquare, CalendarDays, MapPin, BookOpen,
  Moon, Sun, Menu, X, ChevronRight, Zap, Shield, Smartphone,
} from 'lucide-react'
import { useTheme } from '../App'

const FEATURES = [
  { icon: CheckSquare, title: 'Academic Planner', description: 'Track assignments and deadlines, set priorities, and never miss a submission again.' },
  { icon: CalendarDays, title: 'CampusConnect', description: 'Discover hackathons, workshops, fests and talks happening on your campus.' },
  { icon: MapPin, title: 'CampusFind', description: 'Post lost items or report what you found. Help your campus community stay connected.' },
  { icon: BookOpen, title: 'NoteNest', description: 'Save and organize study links, PDF notes and resources sorted by subject and semester.' },
]

const STEPS = [
  { step: '01', title: 'Create your account', description: 'Sign up in seconds with your college email.' },
  { step: '02', title: 'Add your tasks & events', description: 'Import your deadlines, discover campus events.' },
  { step: '03', title: 'Stay on top of everything', description: 'One dashboard for your entire college life.' },
]

function Landing() {
  const { theme, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--cm-bg)] text-[var(--cm-text)]">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 border-b border-[var(--cm-border)] bg-[var(--cm-surface)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex flex-shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cm-accent)] text-[var(--cm-accent-text)]">
              <GraduationCap size={16} />
            </div>
            <span className="text-base font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>
              CampusMate
            </span>
          </Link>

          <div className="hidden items-center gap-6 text-sm text-[var(--cm-muted)] md:flex">
            <a href="#features" className="transition-colors hover:text-[var(--cm-text)]">Features</a>
            <a href="#how-it-works" className="transition-colors hover:text-[var(--cm-text)]">How it works</a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-[var(--cm-muted)] transition-colors hover:bg-[var(--cm-secondary)] hover:text-[var(--cm-text)]"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to="/login" className="hidden px-3 py-1.5 text-sm font-medium text-[var(--cm-muted)] transition-colors hover:text-[var(--cm-text)] sm:inline-flex">
              Log in
            </Link>
            <Link to="/signup" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--cm-accent)] px-4 py-1.5 text-sm font-medium text-[var(--cm-accent-text)] transition-opacity hover:opacity-90">
              Get Started
            </Link>
            <button onClick={() => setMobileMenuOpen(o => !o)} className="rounded-lg p-2 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] md:hidden" aria-label="Menu">
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="space-y-1 border-t border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-3 md:hidden">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-[var(--cm-muted)]">Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-[var(--cm-muted)]">How it works</a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-[var(--cm-muted)]">Log in</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="border-b border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-secondary)] px-3 py-1 text-xs font-medium text-[var(--cm-text)]">
            Free for all college students
          </div>

          <h1 className="mb-5 text-4xl font-bold leading-tight text-[var(--cm-text)] sm:text-5xl" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Your College Life,<br />
            <span className="text-[var(--cm-muted)]">Organized.</span>
          </h1>

          <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-[var(--cm-muted)] sm:text-lg">
            CampusMate brings your tasks, events, notes and campus community into one clean, easy-to-use dashboard — built for students, by students.
          </p>

          <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-lg bg-[var(--cm-accent)] px-6 py-3 font-semibold text-[var(--cm-accent-text)] transition-opacity hover:opacity-90">
              Get Started Free <ChevronRight size={16} />
            </Link>
            <a href="#features" className="inline-flex items-center gap-2 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] px-6 py-3 font-medium text-[var(--cm-text)] transition-colors hover:bg-[var(--cm-secondary)]">
              Learn More
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[var(--cm-muted)]">
            {['✓ Free to use', '✓ No credit card required', '✓ Works on all devices'].map(t => (
              <span key={t} className="flex items-center gap-1">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-2xl font-bold text-[var(--cm-text)] sm:text-3xl" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Everything you need in one place
            </h2>
            <p className="mx-auto max-w-md text-[var(--cm-muted)]">
              Four powerful modules designed around how students actually use their time.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] p-6 transition-colors hover:border-[var(--cm-muted)]">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--cm-border)] bg-[var(--cm-secondary)] text-[var(--cm-text)]">
                  <Icon size={20} />
                </div>
                <h3 className="mb-2 font-semibold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</h3>
                <p className="text-sm leading-relaxed text-[var(--cm-muted)]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-2xl font-bold text-[var(--cm-text)] sm:text-3xl" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Up and running in minutes
            </h2>
            <p className="text-[var(--cm-muted)]">No tutorials needed — just sign up and go.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map(({ step, title, description }) => (
              <div key={step} className="text-center">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--cm-accent)] text-lg font-bold text-[var(--cm-accent-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {step}
                </div>
                <h3 className="mb-2 font-semibold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</h3>
                <p className="text-sm text-[var(--cm-muted)]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { icon: Zap, title: 'Fast & lightweight', desc: 'Loads instantly. No bloat, no clutter — just the tools you need.' },
            { icon: Shield, title: 'Your data is yours', desc: 'Supabase-powered with row-level security. Only you see your data.' },
            { icon: Smartphone, title: 'Works everywhere', desc: 'Fully responsive on mobile, tablet and desktop.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-card)] p-5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--cm-border)] bg-[var(--cm-secondary)] text-[var(--cm-text)]">
                <Icon size={18} />
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</p>
                <p className="text-xs leading-relaxed text-[var(--cm-muted)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="border-t border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="mb-3 text-2xl font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Ready to get organized?
          </h2>
          <p className="mb-6 text-[var(--cm-muted)]">
            Join hundreds of students who use CampusMate to stay on top of their semester.
          </p>
          <Link to="/signup" className="inline-flex items-center gap-2 rounded-lg bg-[var(--cm-accent)] px-6 py-3 font-semibold text-[var(--cm-accent-text)] transition-opacity hover:opacity-90">
            Sign Up Free <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--cm-accent)] text-[var(--cm-accent-text)]">
              <GraduationCap size={12} />
            </div>
            <span className="text-sm font-semibold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>CampusMate</span>
          </div>
          <p className="text-xs text-[var(--cm-muted)]">© 2026 CampusMate. Built for students.</p>
          <div className="flex gap-4 text-xs text-[var(--cm-muted)]">
            <Link to="/login" className="hover:text-[var(--cm-text)]">Log in</Link>
            <Link to="/signup" className="hover:text-[var(--cm-text)]">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
