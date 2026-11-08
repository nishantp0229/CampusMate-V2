// src/pages/Landing.jsx — Public landing/home page

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  GraduationCap, CheckSquare, CalendarDays, MapPin, BookOpen,
  Moon, Sun, Menu, X, ChevronRight, Zap, Shield, Smartphone,
} from 'lucide-react'
import { useTheme } from '../App'

// ─── Feature data ─────────────────────────────────────────────
const FEATURES = [
  {
    icon: CheckSquare,
    color: '#A9C9FF',
    bgColor: '#EAF2FF',
    title: 'Academic Planner',
    description: 'Track assignments and deadlines, set priorities, and never miss a submission again.',
  },
  {
    icon: CalendarDays,
    color: '#C8B6FF',
    bgColor: '#F0EBFF',
    title: 'CampusConnect',
    description: 'Discover hackathons, workshops, fests and talks happening on your campus.',
  },
  {
    icon: MapPin,
    color: '#FF9BAA',
    bgColor: '#FFF0F2',
    title: 'CampusFind',
    description: 'Post lost items or report what you found. Help your campus community stay connected.',
  },
  {
    icon: BookOpen,
    color: '#FFB347',
    bgColor: '#FFF6E9',
    title: 'NoteNest',
    description: 'Save and organize study links, PDF notes and resources sorted by subject and semester.',
  },
]

const STEPS = [
  { step: '01', title: 'Create your account', description: 'Sign up in seconds with your college email.' },
  { step: '02', title: 'Add your tasks & events', description: 'Import your deadlines, discover campus events.' },
  { step: '03', title: 'Stay on top of everything', description: 'One dashboard for your entire college life.' },
]

// ─── Component ────────────────────────────────────────────────
function Landing() {
  const { theme, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white dark:bg-[#171A29] text-[#242B3A] dark:text-[#F1F1FC]">

      {/* ══ NAVBAR ══════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-40 bg-white/90 dark:bg-[#171A29]/90 backdrop-blur border-b border-[#E2E8F0] dark:border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-[#A9C9FF] flex items-center justify-center">
              <GraduationCap size={16} color="#fff" />
            </div>
            <span className="font-bold text-base text-[#242B3A] dark:text-[#F1F1FC]"
              style={{ fontFamily: 'Poppins, sans-serif' }}>
              CampusMate
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6 text-sm text-[#737B8C] dark:text-[#A0A8B8]">
            <a href="#features" className="hover:text-[#242B3A] dark:hover:text-[#F1F1FC] transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-[#242B3A] dark:hover:text-[#F1F1FC] transition-colors">How it works</a>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme}
              className="p-2 rounded-xl text-[#737B8C] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.06] transition-colors"
              aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to="/login"
              className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium text-[#737B8C] dark:text-[#A0A8B8] hover:text-[#242B3A] dark:hover:text-[#F1F1FC] transition-colors">
              Log in
            </Link>
            <Link to="/signup"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#A9C9FF] text-white text-sm font-medium rounded-xl hover:bg-[#8BB8F8] transition-colors">
              Get Started
            </Link>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileMenuOpen(o => !o)}
              className="md:hidden p-2 rounded-xl text-[#737B8C] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.06]"
              aria-label="Menu">
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E2E8F0] dark:border-white/[0.07] px-4 py-3 space-y-1 bg-white dark:bg-[#171A29]">
            <a href="#features" onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-[#737B8C] dark:text-[#A0A8B8]">Features</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-[#737B8C] dark:text-[#A0A8B8]">How it works</a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-[#737B8C] dark:text-[#A0A8B8]">Log in</Link>
          </div>
        )}
      </nav>

      {/* ══ HERO ════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-[#EAF2FF] to-[#F0EBFF] dark:from-[#1A1E2E] dark:to-[#1E1A2E] py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white dark:bg-[#252A3C] rounded-full border border-[#E2E8F0] dark:border-white/[0.1] text-xs font-medium text-[#737B8C] dark:text-[#A0A8B8] mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6BCB9A]"></span>
            Free for all college students
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-[#242B3A] dark:text-[#F1F1FC] leading-tight mb-5"
            style={{ fontFamily: 'Poppins, sans-serif' }}>
            Your College Life,<br />
            <span className="text-[#5B9BF8]">Organized.</span>
          </h1>

          <p className="text-base sm:text-lg text-[#737B8C] dark:text-[#A0A8B8] leading-relaxed max-w-xl mx-auto mb-8">
            CampusMate brings your tasks, events, notes and campus community into one clean, easy-to-use dashboard — built for students, by students.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link to="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#A9C9FF] text-white font-semibold rounded-xl hover:bg-[#8BB8F8] transition-colors shadow-sm">
              Get Started Free <ChevronRight size={16} />
            </Link>
            <a href="#features"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-[#252A3C] text-[#242B3A] dark:text-[#F1F1FC] font-medium rounded-xl border border-[#E2E8F0] dark:border-white/[0.1] hover:bg-[#F7F8FC] dark:hover:bg-[#2D3348] transition-colors">
              Learn More
            </a>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[#737B8C] dark:text-[#A0A8B8]">
            {['✓ Free to use', '✓ No credit card required', '✓ Works on all devices'].map(t => (
              <span key={t} className="flex items-center gap-1">{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════ */}
      <section id="features" className="py-20 px-4 bg-white dark:bg-[#171A29]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#242B3A] dark:text-[#F1F1FC] mb-3"
              style={{ fontFamily: 'Poppins, sans-serif' }}>
              Everything you need in one place
            </h2>
            <p className="text-[#737B8C] dark:text-[#A0A8B8] max-w-md mx-auto">
              Four powerful modules designed around how students actually use their time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, color, bgColor, title, description }) => (
              <div key={title}
                className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: bgColor }}>
                  <Icon size={22} style={{ color }} />
                </div>
                <h3 className="font-semibold text-[#242B3A] dark:text-[#F1F1FC] mb-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {title}
                </h3>
                <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 px-4 bg-[#F7F8FC] dark:bg-[#1A1E2E]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#242B3A] dark:text-[#F1F1FC] mb-3"
              style={{ fontFamily: 'Poppins, sans-serif' }}>
              Up and running in minutes
            </h2>
            <p className="text-[#737B8C] dark:text-[#A0A8B8]">No tutorials needed — just sign up and go.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map(({ step, title, description }) => (
              <div key={step} className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#A9C9FF] text-white font-bold text-lg mb-4"
                  style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {step}
                </div>
                <h3 className="font-semibold text-[#242B3A] dark:text-[#F1F1FC] mb-2"
                  style={{ fontFamily: 'Poppins, sans-serif' }}>
                  {title}
                </h3>
                <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8]">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ BENEFITS ════════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-white dark:bg-[#171A29]">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Zap, color: '#FFB347', title: 'Fast & lightweight', desc: 'Loads instantly. No bloat, no clutter — just the tools you need.' },
              { icon: Shield, color: '#6BCB9A', title: 'Your data is yours', desc: 'Supabase-powered with row-level security. Only you see your data.' },
              { icon: Smartphone, color: '#C8B6FF', title: 'Works everywhere', desc: 'Fully responsive on mobile, tablet and desktop.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="flex gap-4 p-5 bg-[#F7F8FC] dark:bg-[#1A1E2E] rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#252A3C] flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Icon size={18} style={{ color }} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#242B3A] dark:text-[#F1F1FC] mb-1"
                    style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</p>
                  <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA BANNER ══════════════════════════════════════════ */}
      <section className="py-16 px-4 bg-gradient-to-br from-[#EAF2FF] to-[#F0EBFF] dark:from-[#1A1E2E] dark:to-[#1E1A2E]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-[#242B3A] dark:text-[#F1F1FC] mb-3"
            style={{ fontFamily: 'Poppins, sans-serif' }}>
            Ready to get organized?
          </h2>
          <p className="text-[#737B8C] dark:text-[#A0A8B8] mb-6">
            Join hundreds of students who use CampusMate to stay on top of their semester.
          </p>
          <Link to="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#A9C9FF] text-white font-semibold rounded-xl hover:bg-[#8BB8F8] transition-colors shadow-sm">
            Sign Up Free <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════ */}
      <footer className="py-8 px-4 border-t border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#171A29]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#A9C9FF] flex items-center justify-center">
              <GraduationCap size={12} color="#fff" />
            </div>
            <span className="font-semibold text-sm text-[#242B3A] dark:text-[#F1F1FC]"
              style={{ fontFamily: 'Poppins, sans-serif' }}>CampusMate</span>
          </div>
          <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8]">
            © 2026 CampusMate. Built with ❤️ for students.
          </p>
          <div className="flex gap-4 text-xs text-[#737B8C] dark:text-[#A0A8B8]">
            <Link to="/login" className="hover:text-[#242B3A] dark:hover:text-[#F1F1FC]">Log in</Link>
            <Link to="/signup" className="hover:text-[#242B3A] dark:hover:text-[#F1F1FC]">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing

