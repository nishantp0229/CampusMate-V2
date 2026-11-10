// src/pages/Landing.jsx — Immersive university platform landing page inspired by Campus Compass

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Compass,
  CheckSquare,
  CalendarDays,
  Search,
  BookOpen,
  Moon,
  Sun,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  MapPin,
  Sparkles,
  Lightbulb,
  Check,
  GraduationCap,
  Users,
  Award,
  Layers,
} from 'lucide-react'
import { useTheme } from '../App'

const TICKER_TIPS = [
  'Welcome Class of 2026 to CampusMate! Your university journey begins here 🎓',
  'Central Library 2nd floor silent reading carrels are open until 11:00 PM 📚',
  'Attendance threshold reminder: Maintain ≥ 75% to stay eligible for end-semester exams ⚠️',
  'TechFusion 36-Hour Hackathon registration is live with ₹1,50,000 in prizes 🚀',
  'Report misplaced student ID cards or valuables on the CampusFind marketplace 🔍',
  'Download verified Semester 5 handwritten notes from the NoteNest vault 📖',
]

const HERO_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1600&q=80',
    tag: 'Academic Quadrangle',
    badge: 'Class of 2026 Guide',
    title: 'Your University Life, Perfectly Orchestrated.',
    desc: 'From 8:30 AM lectures to weekend hackathons, verified study notes and lost & found recovery — navigate university life with clarity.',
    ctaPrimary: 'Get Started Free',
    ctaSecondary: 'Explore Campus Tour ↓',
  },
  {
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=1600&q=80',
    tag: 'Innovation & Tech Hub',
    badge: 'Flagship Chapters',
    title: 'Find Your Tribe & Build Real-World Skills.',
    desc: 'Join ACM, AI/ML Societies, Robotics makerspaces, and battle of bands. Discover events, connect with seniors, and build your resume.',
    ctaPrimary: 'Discover Clubs & Events',
    ctaSecondary: 'View Societies ↓',
  },
  {
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1600&q=80',
    tag: 'Knowledge Vault',
    badge: '8.5+ Target CGPA',
    title: 'Protect Your CGPA & Master Your Coursework.',
    desc: 'Access verified lecture slides, topper handwritten notes, previous exam question papers (PYQs), and interactive timetable alarms.',
    ctaPrimary: 'Open Study Vault',
    ctaSecondary: 'See Resources ↓',
  },
  {
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1600&q=80',
    tag: 'Fest Season & Culture',
    badge: 'AURORA 2026',
    title: 'Experience Campus Life at Its Brightest.',
    desc: 'Three days of music, theatre, celebrity concerts, inter-college sports championships, and campus memories that last a lifetime.',
    ctaPrimary: 'Explore Campus Life',
    ctaSecondary: 'Browse Highlights ↓',
  },
]

const CAMPUS_GALLERY = [
  {
    title: 'Central Computing & AI Labs',
    category: 'Engineering & Research',
    desc: 'Equipped with GPU workstation clusters and gigabit fiber research lines for deep learning and robotics projects.',
    timing: '09:00 AM – 06:00 PM',
    location: 'CSE Block, 2nd Floor',
    image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Open Air Amphitheatre (OAT)',
    category: 'Cultural Arena',
    desc: 'A 2,500-capacity open arena hosting band wars, dance showcases, celebrity nights, and student gatherings.',
    timing: 'Open Daily until 10:00 PM',
    location: 'Adjacent to Student Activity Centre',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Central Library & Reading Pods',
    category: 'Silent Study Haven',
    desc: '3 floors of quiet air-conditioned carrels, digital research terminals, and over 120,000 physical volumes.',
    timing: '08:00 AM – 11:00 PM',
    location: 'Central Academic Quad',
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Main Sports Complex & Turf',
    category: 'Athletics & Fitness',
    desc: 'Floodlit cricket oval, FIFA-standard football pitch, synthetic tennis courts, and indoor badminton arenas.',
    timing: '06:00 AM – 08:30 PM',
    location: 'East Campus Grounds',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80',
  },
  {
    title: 'Student Hub & Canteen Gardens',
    category: 'Social & Dining',
    desc: 'Vibrant indoor and open-air food courts serving breakfast, lunch resets, and evening chai between lectures.',
    timing: '07:30 AM – 10:00 PM',
    location: 'Hostel Triangle Plaza',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80',
  },
]

const MODULE_TABS = [
  {
    id: 'planner',
    label: 'Academic Planner',
    icon: CheckSquare,
    badge: 'Academics',
    title: 'Stay on Track with Timetables & 75% Safeguard',
    desc: 'Schedule internal assignments, track lab report deadlines, and monitor your attendance standing with live warnings before exam debarment.',
    stats: '8.6 Target CGPA · 4 Sessions Today · 85% Safe',
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
    bullets: ['Interactive Monday–Sunday weekday timetable', 'Priority-tagged assignment sprint checklist', '75% mandatory attendance calculator meter'],
  },
  {
    id: 'events',
    label: 'CampusConnect',
    icon: CalendarDays,
    badge: 'Events & Fests',
    title: 'Discover Fests, Hackathons & Club Recruits',
    desc: 'Never miss an inter-college championship or coding bootcamp. Register with one tap, view live attendee counts, and follow society roadmaps.',
    stats: '312 Going · ₹1.5L Prize Pool · 4 Flagship Clubs',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80',
    bullets: ['Flagship society wonder cards & member counts', '4-Step Curious Fresher to Active Member pathway', 'High-res event discovery grid with RSVP confirmation'],
  },
  {
    id: 'lostfound',
    label: 'CampusFind',
    icon: Search,
    badge: 'Marketplace',
    title: 'Peer-to-Peer Campus Lost & Found Recovery',
    desc: 'Misplaced your earbuds in the lab or an ID card at the auditorium? Post photo listings, filter by campus area, and safely reunite items.',
    stats: '14 Items Reunited · Real Photos · Verified Students',
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02560?auto=format&fit=crop&w=800&q=80',
    bullets: ['Image-first photo cards with status ribbons', 'Campus location tags: Library, Canteen, Labs, Hostel', 'One-click "I Found This Item" & "Mark as Returned"'],
  },
  {
    id: 'resources',
    label: 'NoteNest Vault',
    icon: BookOpen,
    badge: 'Resource Vault',
    title: 'Curated Study Materials by University Toppers',
    desc: 'A structured vault of lecture slides, textbook PDF links, handwritten formulas, and previous year question papers categorized by semester.',
    stats: 'Sem 1–8 · Peer-Reviewed · Direct Google Drive Access',
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
    bullets: ['Semester pills and subject shortcuts (DBMS, DSA, OS)', 'Format filters: PDFs, Web Links, Video Tutorials', 'Verified exam revision notes and formula cheat sheets'],
  },
]

const DO_ITEMS = [
  'Carry your physical college ID card every single day for lab & library entry.',
  'Verify your attendance percentages on ERP every Friday before 5:00 PM.',
  'Download course lecture slides and syllabus notes before midterm evaluation week.',
  'Join at least one flagship technical or cultural club during fresher orientation.',
  'Keep hydrated and protect your room keys — reissuing duplicates takes days.',
]

const DONT_ITEMS = [
  'Don’t skip breakfast or ignore hostel mess dinner timings (strict 7:30–9:30 PM).',
  'Don’t let your attendance drop below 75% — debarment policies are strictly enforced.',
  'Don’t wait until dead-week to ask professors for lab practical sign-offs.',
  'Don’t leave laptops, earbuds or chargers unattended in library vending areas.',
  'Don’t study alone in isolation — collaborate on group projects and seek senior advice.',
]

function Landing() {
  const { theme, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [activeModuleIndex, setActiveModuleIndex] = useState(0)
  const galleryScrollRef = useRef(null)

  // Auto-advance hero carousel every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  const nextHero = () => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)
  }

  const prevHero = () => {
    setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
  }

  const scrollGallery = (direction) => {
    if (galleryScrollRef.current) {
      const offset = direction === 'left' ? -340 : 340
      galleryScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }

  const slide = HERO_SLIDES[currentSlide]
  const activeModule = MODULE_TABS[activeModuleIndex]

  return (
    <div className="min-h-screen bg-[var(--cm-bg)] text-[var(--cm-text)] selection:bg-[#AA2347] selection:text-white">
      {/* ── 1. SENIOR TIPS TICKER TAPE (Campus Compass style) ── */}
      <div className="border-b border-[var(--cm-border)] bg-[var(--cm-surface)] py-2.5 text-xs overflow-hidden shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center px-4 sm:px-6">
          <div className="mr-3 flex shrink-0 items-center gap-1.5 rounded-lg bg-[#AA2347] px-2.5 py-1 text-white font-bold shadow-xs">
            <Lightbulb size={13} className="text-[#FFC72C]" />
            <span className="uppercase tracking-wider text-[10px]">Campus Pulse</span>
          </div>
          <div className="overflow-hidden whitespace-nowrap">
            <div className="animate-ticker font-medium text-[var(--cm-muted)]">
              {TICKER_TIPS.concat(TICKER_TIPS).map((tip, idx) => (
                <span key={idx} className="inline-block px-8">
                  {tip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. STICKY COLLEGIATE NAVBAR ── */}
      <nav className="sticky top-0 z-40 border-b border-[var(--cm-border)] bg-[var(--cm-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link to="/" className="flex flex-shrink-0 items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#AA2347] to-[#78142F] text-white shadow-md shadow-[#AA2347]/20 group-hover:scale-105 transition">
              <Compass size={22} className="text-[#FFC72C]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-['Poppins'] text-lg font-extrabold tracking-tight text-[var(--cm-text)]">
                  CampusMate
                </span>
                <span className="rounded bg-[#FFC72C]/20 text-[#D99B00] dark:text-[#FFC72C] text-[9px] font-bold px-1.5 py-0.2 uppercase">
                  Compass
                </span>
              </div>
              <span className="block text-[11px] font-medium text-[var(--cm-muted)]">
                University Student Hub
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden items-center gap-7 text-xs sm:text-sm font-semibold text-[var(--cm-muted)] lg:flex">
            <a href="#features" className="transition-colors hover:text-[var(--cm-accent)]">
              Features
            </a>
            <a href="#campus-spaces" className="transition-colors hover:text-[var(--cm-accent)]">
              Campus Spaces
            </a>
            <a href="#survival-kit" className="transition-colors hover:text-[var(--cm-accent)]">
              Senior Survival Kit
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-[var(--cm-accent)]">
              How It Works
            </a>
          </div>

          {/* Actions: Theme Toggle, Log In, Get Started */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-2 text-[var(--cm-muted)] hover:text-[var(--cm-text)] transition cursor-pointer shadow-2xs"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={18} className="text-[#FFC72C]" /> : <Moon size={18} />}
            </button>

            <Link
              to="/login"
              className="hidden px-4 py-2 text-xs sm:text-sm font-bold text-[var(--cm-text)] hover:text-[#AA2347] transition sm:inline-flex"
            >
              Sign In
            </Link>

            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] px-4.5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-[#AA2347]/20 hover:brightness-110 transition cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight size={15} />
            </Link>

            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="rounded-xl border border-[var(--cm-border)] p-2 text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] lg:hidden cursor-pointer"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="space-y-2 border-t border-[var(--cm-border)] bg-[var(--cm-surface)] px-6 py-4 lg:hidden">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[var(--cm-text)]"
            >
              Features
            </a>
            <a
              href="#campus-spaces"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[var(--cm-text)]"
            >
              Campus Spaces
            </a>
            <a
              href="#survival-kit"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[var(--cm-text)]"
            >
              Senior Survival Kit
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-[var(--cm-text)]"
            >
              How It Works
            </a>
            <div className="pt-2 border-t border-[var(--cm-border)]/60 flex items-center justify-between">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm font-bold text-[#AA2347]"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl bg-[#AA2347] px-4 py-2 text-xs font-bold text-white"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── 3. HERO SECTION WITH LARGE IMAGE CAROUSEL ── */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-3xl sm:rounded-[36px] border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-2xl">
            {/* Background Image Carousel with smooth zoom */}
            <div className="relative h-[520px] sm:h-[500px] lg:h-[560px] w-full overflow-hidden">
              <img
                src={slide.image}
                alt={slide.title}
                className="h-full w-full object-cover transition-transform duration-1000 scale-102"
              />
              {/* Deep Collegiate gradient veil */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0C0E14] via-[#0C0E14]/75 to-[#0C0E14]/40" />

              {/* Slide Overlay Content */}
              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-12 lg:p-16 text-white">
                {/* Top Badge Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-4 py-1 text-xs font-semibold backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-[#FFC72C] animate-pulse" />
                    <span className="text-[#FFC72C]">{slide.tag}</span>
                    <span className="text-white/60">·</span>
                    <span>{slide.badge}</span>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3.5 py-1 text-xs backdrop-blur-md text-white/80">
                    <Compass size={14} className="text-[#FFC72C]" />
                    <span>Amrita / DTU Student Guide</span>
                  </div>
                </div>

                {/* Main Titles */}
                <div className="max-w-3xl space-y-4">
                  <span className="inline-block text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#FFC72C]">
                    Your All-in-One University Companion
                  </span>
                  <h1 className="font-['Poppins'] text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight drop-shadow-md">
                    {slide.title}
                  </h1>
                  <p className="text-sm sm:text-lg text-white/85 leading-relaxed max-w-2xl font-normal drop-shadow-xs">
                    {slide.desc}
                  </p>
                </div>

                {/* Bottom Action CTAs & Slider Controls */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/20">
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to="/signup"
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xl shadow-[#AA2347]/40 hover:brightness-110 transition cursor-pointer"
                    >
                      {slide.ctaPrimary} <ArrowRight size={16} />
                    </Link>
                    <a
                      href="#campus-spaces"
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 py-3 text-xs sm:text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 transition cursor-pointer"
                    >
                      {slide.ctaSecondary}
                    </a>
                  </div>

                  {/* Previous / Next Arrows & Indicators */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={prevHero}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-white/20 transition cursor-pointer"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft size={20} />
                    </button>

                    <div className="flex gap-1.5 px-1">
                      {HERO_SLIDES.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlide(i)}
                          aria-label={`Go to slide ${i + 1}`}
                          className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                            i === currentSlide ? 'w-8 bg-[#FFC72C]' : 'w-2.5 bg-white/40'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={nextHero}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-white/20 transition cursor-pointer"
                      aria-label="Next slide"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* University Highlight Stats Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--cm-border)] bg-[var(--cm-bg)]">
              <div className="p-5 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#AA2347]/10 text-[#AA2347] dark:text-[#FFC72C]">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">Built for Students</p>
                  <p className="font-['Poppins'] text-xl font-black text-[var(--cm-text)]">100% Free</p>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Zero subscription fees</span>
                </div>
              </div>

              <div className="p-5 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                  <Award size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">Academic Radar</p>
                  <p className="font-['Poppins'] text-xl font-black text-[var(--cm-text)]">8.5+ Target</p>
                  <span className="text-[10px] font-semibold text-[var(--cm-muted)]">CGPA Protection Plan</span>
                </div>
              </div>

              <div className="p-5 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600">
                  <CalendarDays size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">Campus Hubs</p>
                  <p className="font-['Poppins'] text-xl font-black text-[var(--cm-text)]">4 Modules in 1</p>
                  <span className="text-[10px] font-semibold text-[var(--cm-muted)]">Planner · Events · Lost · Notes</span>
                </div>
              </div>

              <div className="p-5 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">Community Reach</p>
                  <p className="font-['Poppins'] text-xl font-black text-[var(--cm-text)]">14+ Reunited</p>
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Lost valuables restored</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. HORIZONTAL CAMPUS LIFE & FACILITIES GALLERY ── */}
      <section id="campus-spaces" className="px-4 sm:px-6 lg:px-8 py-16 border-t border-[var(--cm-border)]/70">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#AA2347] dark:text-[#FFC72C]">
                <Layers size={14} /> University Environment
              </div>
              <h2 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold text-[var(--cm-text)] mt-1">
                Explore the Spaces That Shape Your Learning 🏛️
              </h2>
              <p className="text-xs sm:text-base text-[var(--cm-muted)] mt-1 max-w-2xl">
                Swipe through research laboratories, amphitheaters, sports arenas, and quiet study carrels across campus.
              </p>
            </div>

            <div className="flex items-center gap-2 self-end">
              <button
                onClick={() => scrollGallery('left')}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] text-[var(--cm-muted)] hover:border-[#AA2347] hover:text-[#AA2347] transition cursor-pointer shadow-xs"
                aria-label="Scroll left"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => scrollGallery('right')}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] text-[var(--cm-muted)] hover:border-[#AA2347] hover:text-[#AA2347] transition cursor-pointer shadow-xs"
                aria-label="Scroll right"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          {/* Horizontal Image Gallery */}
          <div
            ref={galleryScrollRef}
            className="flex gap-6 overflow-x-auto no-scrollbar pb-3 pt-1 scroll-smooth"
          >
            {CAMPUS_GALLERY.map((space, idx) => (
              <div
                key={idx}
                className="w-80 sm:w-96 shrink-0 overflow-hidden rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-xs hover:border-[var(--cm-accent)]/80 hover:shadow-lg transition-all duration-300 group flex flex-col justify-between"
              >
                <div className="relative h-52 w-full overflow-hidden">
                  <img
                    src={space.image}
                    alt={space.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-3.5 left-3.5">
                    <span className="rounded-xl bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                      {space.category}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="block truncate text-xs font-semibold text-white/95 drop-shadow-md">
                      🕒 {space.timing}
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-['Poppins'] text-base font-bold text-[var(--cm-text)] group-hover:text-[#AA2347] transition line-clamp-1">
                      {space.title}
                    </h3>
                    <p className="flex items-center gap-1.5 text-xs text-[var(--cm-muted)] mt-1">
                      <MapPin size={13} className="shrink-0 text-[#AA2347]" /> {space.location}
                    </p>
                    <p className="text-xs text-[var(--cm-muted)] leading-relaxed mt-2 line-clamp-2">
                      {space.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[var(--cm-border)]/60 flex items-center justify-between text-xs font-bold text-[#AA2347] dark:text-[#FFC72C]">
                    <span>Facility Open</span>
                    <span className="group-hover:translate-x-1 transition-transform">Campus Guide →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. INTERACTIVE FEATURE SHOWCASE WITH TABS ── */}
      <section id="features" className="px-4 sm:px-6 lg:px-8 py-16 bg-[var(--cm-secondary)]/30 border-y border-[var(--cm-border)]/70">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#AA2347] dark:text-[#FFC72C]">
              Four Core Pillars
            </span>
            <h2 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold text-[var(--cm-text)]">
              Everything You Need in One Unified Hub
            </h2>
            <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
              Designed around how real university students manage classes, deadlines, fests, and lost items.
            </p>
          </div>

          {/* Interactive Feature Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {MODULE_TABS.map((tab, idx) => {
              const Icon = tab.icon
              const isSelected = activeModuleIndex === idx
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveModuleIndex(idx)}
                  className={`flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs sm:text-sm font-bold transition cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--cm-accent)] text-white shadow-md'
                      : 'border border-[var(--cm-border)] bg-[var(--cm-surface)] text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Selected Feature Card Display */}
          <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] overflow-hidden shadow-xl grid grid-cols-1 lg:grid-cols-12 items-center">
            {/* Left Content */}
            <div className="p-8 sm:p-12 lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#AA2347]/10 text-[#AA2347] dark:text-[#FFC72C] px-3.5 py-1 text-xs font-bold uppercase tracking-wider">
                <Sparkles size={14} /> {activeModule.badge}
              </div>

              <h3 className="font-['Poppins'] text-2xl sm:text-3xl font-extrabold text-[var(--cm-text)] leading-tight">
                {activeModule.title}
              </h3>

              <p className="text-xs sm:text-sm text-[var(--cm-muted)] leading-relaxed">
                {activeModule.desc}
              </p>

              {/* Bullet points */}
              <div className="space-y-2.5 pt-2">
                {activeModule.bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs font-medium text-[var(--cm-text)]">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 mt-0.5">
                      <Check size={12} />
                    </div>
                    <span>{b}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex items-center gap-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:brightness-110 transition"
                >
                  Try {activeModule.label} <ArrowRight size={15} />
                </Link>
                <span className="text-xs font-bold text-[var(--cm-muted)] font-mono">
                  {activeModule.stats}
                </span>
              </div>
            </div>

            {/* Right Featured Image Mockup */}
            <div className="relative h-64 sm:h-80 lg:h-full lg:col-span-6 overflow-hidden bg-[var(--cm-secondary)]">
              <img
                src={activeModule.image}
                alt={activeModule.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-[var(--cm-surface)] via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. SENIOR SURVIVAL KIT: GREEN SIGNALS & RED FLAGS (Campus Compass staple) ── */}
      <section id="survival-kit" className="px-4 sm:px-6 lg:px-8 py-16">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#AA2347] dark:text-[#FFC72C]">
              Fresher Survival Guide
            </span>
            <h2 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold text-[var(--cm-text)]">
              Green Signals & Red Flags 🚦
            </h2>
            <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
              Lessons seniors wish someone told them on day one — distilled into actionable rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Green Signals Column */}
            <div className="rounded-3xl border border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-emerald-200 dark:border-emerald-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-black text-sm">
                  DO
                </div>
                <div>
                  <h3 className="font-['Poppins'] text-lg font-bold text-emerald-900 dark:text-emerald-200">
                    Do This, Legend ✓
                  </h3>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Habits that protect your CGPA and mental peace
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {DO_ITEMS.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-emerald-950 dark:text-emerald-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold mt-0.5">
                      ✓
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Red Flags Column */}
            <div className="rounded-3xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-6 sm:p-8 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-rose-200 dark:border-rose-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#AA2347] text-white font-black text-sm">
                  NO
                </div>
                <div>
                  <h3 className="font-['Poppins'] text-lg font-bold text-rose-900 dark:text-rose-200">
                    Don’t Do This, Boss ⚠️
                  </h3>
                  <p className="text-xs text-rose-700 dark:text-rose-400">
                    Costly mistakes freshers make during their first semester
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {DONT_ITEMS.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-rose-950 dark:text-rose-100">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#AA2347] text-white text-[10px] font-bold mt-0.5">
                      ✕
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. HOW CAMPUSMATE WORKS IN 3 STEPS ── */}
      <section id="how-it-works" className="px-4 sm:px-6 lg:px-8 py-16 bg-[var(--cm-secondary)]/30 border-t border-[var(--cm-border)]/70">
        <div className="mx-auto max-w-5xl space-y-10">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#AA2347] dark:text-[#FFC72C]">
              Simple & Intuitive
            </span>
            <h2 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold text-[var(--cm-text)]">
              Up and Running in 3 Minutes
            </h2>
            <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
              No complex manual setup — just enter your college email and get started.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 space-y-3 text-center">
              <span className="font-mono text-3xl font-black text-[#AA2347]">01</span>
              <h3 className="font-['Poppins'] text-base font-bold text-[var(--cm-text)]">
                Create Your Account
              </h3>
              <p className="text-xs text-[var(--cm-muted)] leading-relaxed">
                Sign up with your university email address. No credit card or verification delay needed.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 space-y-3 text-center">
              <span className="font-mono text-3xl font-black text-[#AA2347]">02</span>
              <h3 className="font-['Poppins'] text-base font-bold text-[var(--cm-text)]">
                Track Timetable & Tasks
              </h3>
              <p className="text-xs text-[var(--cm-muted)] leading-relaxed">
                Review your weekly lecture agenda, lab practicals, and monitor your 75% attendance safeguard meter.
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 space-y-3 text-center">
              <span className="font-mono text-3xl font-black text-[#AA2347]">03</span>
              <h3 className="font-['Poppins'] text-base font-bold text-[var(--cm-text)]">
                Connect with Campus
              </h3>
              <p className="text-xs text-[var(--cm-muted)] leading-relaxed">
                Discover fests & hackathons, share handwritten notes on NoteNest, and report lost valuables.
              </p>
            </div>
          </div>

          {/* CTA Banner */}
          <div className="rounded-3xl bg-gradient-to-r from-[#AA2347] via-[#8A1B39] to-[#5A1128] p-8 sm:p-12 text-center text-white space-y-5 shadow-2xl">
            <h3 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold leading-tight">
              Ready to Master Your Semester?
            </h3>
            <p className="text-xs sm:text-base text-white/85 max-w-xl mx-auto leading-relaxed">
              Join students who navigate university life, coursework, and events effortlessly with CampusMate.
            </p>
            <div className="pt-2">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-2xl bg-white text-[#AA2347] font-extrabold px-8 py-3.5 text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:bg-white/95 transition cursor-pointer"
              >
                <span>Get Started Now</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. UNIVERSITY COMPREHENSIVE FOOTER ── */}
      <footer className="border-t border-[var(--cm-border)] bg-[var(--cm-surface)] px-4 sm:px-6 lg:px-8 py-12">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Col 1 & 2: Brand */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#AA2347] to-[#78142F] text-white shadow-md">
                  <Compass size={20} className="text-[#FFC72C]" />
                </div>
                <span className="font-['Poppins'] text-lg font-extrabold text-[var(--cm-text)]">
                  CampusMate
                </span>
              </div>
              <p className="text-xs text-[var(--cm-muted)] leading-relaxed max-w-sm">
                The ultimate university student compass — bringing timetables, attendance tracking, verified notes, campus fests, and lost & found recovery into one clean platform.
              </p>
              <p className="text-[11px] text-[var(--cm-muted)] font-mono">
                Amrita & DTU Edition · Class of 2026
              </p>
            </div>

            {/* Col 3: Modules */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--cm-text)]">
                Modules
              </p>
              <ul className="space-y-1.5 text-xs text-[var(--cm-muted)]">
                <li><Link to="/planner" className="hover:text-[#AA2347]">Academic Planner</Link></li>
                <li><Link to="/events" className="hover:text-[#AA2347]">CampusConnect</Link></li>
                <li><Link to="/lost-found" className="hover:text-[#AA2347]">CampusFind</Link></li>
                <li><Link to="/resources" className="hover:text-[#AA2347]">NoteNest Vault</Link></li>
              </ul>
            </div>

            {/* Col 4: Guide */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--cm-text)]">
                Fresher Guide
              </p>
              <ul className="space-y-1.5 text-xs text-[var(--cm-muted)]">
                <li><a href="#survival-kit" className="hover:text-[#AA2347]">Senior Tips</a></li>
                <li><a href="#campus-spaces" className="hover:text-[#AA2347]">Campus Spaces</a></li>
                <li><a href="#how-it-works" className="hover:text-[#AA2347]">How It Works</a></li>
                <li><a href="#features" className="hover:text-[#AA2347]">Features</a></li>
              </ul>
            </div>

            {/* Col 5: Access */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--cm-text)]">
                Student Access
              </p>
              <ul className="space-y-1.5 text-xs text-[var(--cm-muted)]">
                <li><Link to="/login" className="hover:text-[#AA2347]">Sign In</Link></li>
                <li><Link to="/signup" className="hover:text-[#AA2347]">Create Account</Link></li>
                <li><Link to="/profile" className="hover:text-[#AA2347]">Student Passport</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--cm-border)]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--cm-muted)]">
            <p>© 2026 CampusMate. Built by students, for students. All rights reserved.</p>
            <div className="flex gap-4">
              <Link to="/login" className="hover:text-[var(--cm-text)]">Sign In</Link>
              <span>·</span>
              <Link to="/signup" className="hover:text-[var(--cm-text)]">Register</Link>
              <span>·</span>
              <Link to="/dashboard" className="hover:text-[var(--cm-text)]">Dashboard</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
