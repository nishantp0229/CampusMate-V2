// src/pages/Dashboard.jsx — Visually rich university campus homepage inspired by Campus Compass

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  AlertTriangle,
  Lightbulb,
  Compass,
  Award,
  Layers,
} from 'lucide-react'
import {
  MOCK_TASKS,
  MOCK_EVENTS,
  MOCK_LOST_FOUND,
  MOCK_USER,
} from '../utils/mockData'

const QUICK_TIPS = [
  'Always carry your physical university ID card on campus! 🪪',
  'Attendance below 75% results in exam debarment without formal medical leave ⚠️',
  'Central Library 2nd floor has 24/7 quiet air-conditioned study pods 📚',
  'TechFusion Hackathon registration closes this Friday — ₹1,50,000 prize pool 🚀',
  'Found an abandoned item? Post it on CampusFind to notify the owner 🔍',
  'Mess dinner timings are strict (7:30 PM – 9:30 PM) — don\'t miss out! 🍽️',
  'Backup your lab projects to GitHub or Google Drive before practical evaluations 💾',
]

const HERO_CAROUSEL_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1400&q=80',
    tag: 'Campus Quadrangle',
    badge: 'Class of 2026',
    title: 'Welcome to DTU, Class of 2026! 🎓',
    desc: 'Your all-in-one student compass — designed by seniors to help you master academics, discover clubs, and thrive in university life.',
    ctaText: 'Explore Academics',
    ctaLink: '/planner',
  },
  {
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=80',
    tag: 'Flagship Event',
    badge: 'Nov 22–24',
    title: 'TechFusion 36-Hour Hackathon 🚀',
    desc: 'Build next-gen solutions across HealthTech, EdTech, and AI tracks. Network with Google & Microsoft engineers with ₹1.5L prizes.',
    ctaText: 'Register for Hackathon',
    ctaLink: '/events',
  },
  {
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1400&q=80',
    tag: 'Knowledge Vault',
    badge: 'NoteNest Hub',
    title: 'Semester 5 Notes & PYQ Vault 📚',
    desc: 'Access verified handwritten notes, previous exam papers, and formula cheat sheets curated by toppers and faculty mentors.',
    ctaText: 'Browse NoteNest',
    ctaLink: '/resources',
  },
]

const CAMPUS_SPACES = [
  {
    name: 'Central Library & Reading Pods',
    category: 'Study Zone',
    timing: '8:00 AM – 11:00 PM',
    location: 'Central Campus Block',
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=80',
    highlight: 'Over 120,000 physical volumes and 500 quiet study carrels.',
  },
  {
    name: 'Advanced Computing & AI Labs',
    category: 'Engineering',
    timing: '9:00 AM – 6:00 PM',
    location: 'CSE Block, 2nd Floor',
    image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
    highlight: 'GPU workstation clusters and high-speed gigabit research network.',
  },
  {
    name: 'Innovation & Robotics Hub',
    category: 'Makerspace',
    timing: 'Open 24/7 for Projects',
    location: 'Block A, Ground Floor',
    image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80',
    highlight: '3D printers, soldering stations, and drone testing cages.',
  },
  {
    name: 'Open Air Theatre (OAT)',
    category: 'Cultural Hub',
    timing: '4:00 PM – 10:00 PM',
    location: 'Beside SAC Block',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
    highlight: '2,500-capacity amphitheatre for fest performances and battle of bands.',
  },
  {
    name: 'DTU Main Sports Complex',
    category: 'Athletics',
    timing: '6:00 AM – 8:00 PM',
    location: 'East Campus Grounds',
    image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=80',
    highlight: 'Floodlit cricket ground, FIFA-sized football turf, and synthetic tennis courts.',
  },
]

const DAY_FLOW = [
  { time: '08:30 AM', title: 'Breakfast & Morning Start', location: 'Hostel Mess & Common Hall', tag: 'Hostel' },
  { time: '09:00 AM', title: 'Data Structures & Algorithms', location: 'Room 204, Academic Block', tag: 'Class' },
  { time: '11:00 AM', title: 'DBMS Practical Lab Evaluation', location: 'Computer Lab 2, CSE Block', tag: 'Lab', active: true },
  { time: '01:00 PM', title: 'Lunch Break & Social Reset', location: 'DTU Central Canteen', tag: 'Break' },
  { time: '02:00 PM', title: 'DBMS Quiz — Normalization & ER', location: 'Seminar Hall B', tag: 'Exam' },
  { time: '04:30 PM', title: 'ACM Problem Solving Meetup', location: 'Innovation Hub, Block A', tag: 'Club' },
  { time: '07:30 PM', title: 'Library Study Sprint & Review', location: 'Central Library, 2nd Floor', tag: 'Study' },
]

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const formatEventDate = (dateStr) => {
  const d = new Date(dateStr)
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
  }
}

function Dashboard({ lostFoundItems = MOCK_LOST_FOUND }) {
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0)
  const [taskFilter, setTaskFilter] = useState('pending')
  const [calcClassesAttended, setCalcClassesAttended] = useState(34)
  const [calcTotalClasses, setCalcTotalClasses] = useState(40)
  const spaceScrollRef = useRef(null)

  // Auto-advance hero carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [])

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
      )
    )
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length
  const weeklyPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0
  const attendanceRate =
    calcTotalClasses > 0 ? Math.round((calcClassesAttended / calcTotalClasses) * 100) : 0

  const visibleTasks = tasks.filter((t) =>
    taskFilter === 'all' ? true : t.status === taskFilter
  )

  const slide = HERO_CAROUSEL_SLIDES[currentHeroSlide]

  const nextSpace = () => {
    if (spaceScrollRef.current) {
      spaceScrollRef.current.scrollBy({ left: 320, behavior: 'smooth' })
    }
  }

  const prevSpace = () => {
    if (spaceScrollRef.current) {
      spaceScrollRef.current.scrollBy({ left: -320, behavior: 'smooth' })
    }
  }

  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. CAMPUS COMPASS TICKER TAPE ── */}
      <div className="border-b border-[var(--cm-border)] bg-[var(--cm-surface)] py-2.5 text-xs overflow-hidden shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center px-4 sm:px-6">
          <div className="mr-3 flex shrink-0 items-center gap-1.5 rounded-lg bg-[#AA2347] px-2.5 py-1 text-white font-bold shadow-xs">
            <Lightbulb size={13} className="text-[#FFC72C]" />
            <span className="uppercase tracking-wider text-[10px]">Senior Tips</span>
          </div>
          <div className="overflow-hidden whitespace-nowrap">
            <div className="animate-ticker font-medium text-[var(--cm-muted)]">
              {QUICK_TIPS.concat(QUICK_TIPS).map((tip, idx) => (
                <span key={idx} className="inline-block px-8">
                  {tip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
        {/* ── 2. LARGE VISUALLY IMPRESSIVE HERO SECTION (Campus Compass Island style) ── */}
        <div className="relative overflow-hidden rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-md">
          {/* Hero background image with gradient overlay */}
          <div className="relative h-[480px] sm:h-[420px] lg:h-[460px] w-full overflow-hidden">
            <img
              src={slide.image}
              alt={slide.title}
              className="h-full w-full object-cover transition-transform duration-1000 scale-102"
            />
            {/* Rich gradient mask */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0C0E14] via-[#0C0E14]/80 to-[#0C0E14]/40" />

            {/* Slide Content */}
            <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10 lg:p-12 text-white">
              {/* Top Bar inside hero */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3.5 py-1 text-xs font-semibold backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-[#FFC72C] animate-pulse" />
                  <span className="text-[#FFC72C]">{slide.tag}</span>
                  <span className="text-white/60">·</span>
                  <span>{slide.badge}</span>
                </div>

                <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs backdrop-blur-md text-white/80">
                  <Compass size={14} className="text-[#FFC72C]" />
                  <span>{MOCK_USER.college}</span>
                </div>
              </div>

              {/* Main Titles */}
              <div className="max-w-3xl space-y-3">
                <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[#FFC72C]">
                  Step into your university command centre
                </p>
                <h1 className="font-['Poppins'] text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
                  {slide.title}
                </h1>
                <p className="text-xs sm:text-base text-white/85 leading-relaxed max-w-2xl font-normal drop-shadow-xs">
                  {slide.desc}
                </p>
              </div>

              {/* Bottom Actions & Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/15">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to={slide.ctaLink}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-[#AA2347]/40 hover:brightness-110 transition cursor-pointer"
                  >
                    {slide.ctaText} <ArrowRight size={15} />
                  </Link>
                  <Link
                    to="/lost-found"
                    state={{ openAdd: true }}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 transition cursor-pointer"
                  >
                    <Search size={14} /> Report Lost Item
                  </Link>
                </div>

                {/* Carousel Controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setCurrentHeroSlide(
                        (prev) => (prev - 1 + HERO_CAROUSEL_SLIDES.length) % HERO_CAROUSEL_SLIDES.length
                      )
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-white/20 transition cursor-pointer"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div className="flex gap-1.5 px-1">
                    {HERO_CAROUSEL_SLIDES.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentHeroSlide(i)}
                        aria-label={`Go to slide ${i + 1}`}
                        className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                          i === currentHeroSlide ? 'w-6 bg-[#FFC72C]' : 'w-2 bg-white/40'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentHeroSlide((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length)
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md hover:bg-white/20 transition cursor-pointer"
                    aria-label="Next slide"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Banner below hero */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--cm-border)] bg-[var(--cm-bg)]">
            <div className="p-4 sm:p-5 flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#AA2347]/10 text-[#AA2347] dark:text-[#FFC72C]">
                <Award size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">Target CGPA</p>
                <p className="font-['Poppins'] text-lg font-extrabold text-[var(--cm-text)]">8.6 / 10</p>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Class Top 10%</span>
              </div>
            </div>

            <div className="p-4 sm:p-5 flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">Attendance</p>
                <p className="font-['Poppins'] text-lg font-extrabold text-[var(--cm-text)]">{attendanceRate}% Safe</p>
                <span className="text-[10px] font-semibold text-[var(--cm-muted)]">≥ 75% required</span>
              </div>
            </div>

            <div className="p-4 sm:p-5 flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <Clock size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">Sessions Today</p>
                <p className="font-['Poppins'] text-lg font-extrabold text-[var(--cm-text)]">{DAY_FLOW.length} Events</p>
                <span className="text-[10px] font-semibold text-[var(--cm-muted)]">DBMS Lab active</span>
              </div>
            </div>

            <div className="p-4 sm:p-5 flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--cm-muted)]">Tasks Done</p>
                <p className="font-['Poppins'] text-lg font-extrabold text-[var(--cm-text)]">{completedCount} of {tasks.length}</p>
                <span className="text-[10px] font-semibold text-[#AA2347] dark:text-[#FFC72C]">{weeklyPercent}% complete</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. HORIZONTAL CAMPUS SPACES GALLERY (Campus Compass Inspired) ── */}
        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#AA2347] dark:text-[#FFC72C]">
                <Layers size={14} /> Campus Tour & Facilities
              </div>
              <h2 className="font-['Poppins'] text-xl sm:text-2xl font-extrabold text-[var(--cm-text)]">
                Explore the Spaces That Shape Your Learning 🏛️
              </h2>
              <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
                Swipe through high-tech labs, research hubs, amphitheaters, and study carrels.
              </p>
            </div>

            <div className="flex items-center gap-2 self-end">
              <button
                onClick={prevSpace}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] text-[var(--cm-muted)] hover:border-[var(--cm-accent)] hover:text-[var(--cm-accent)] transition cursor-pointer shadow-xs"
                aria-label="Previous campus space"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={nextSpace}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] text-[var(--cm-muted)] hover:border-[var(--cm-accent)] hover:text-[var(--cm-accent)] transition cursor-pointer shadow-xs"
                aria-label="Next campus space"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Horizontal Gallery Cards */}
          <div
            ref={spaceScrollRef}
            className="flex gap-5 overflow-x-auto no-scrollbar pb-2 pt-1 scroll-smooth"
          >
            {CAMPUS_SPACES.map((space, idx) => (
              <div
                key={idx}
                className="w-72 sm:w-80 shrink-0 overflow-hidden rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-xs hover:border-[var(--cm-accent)]/80 hover:shadow-md transition-all duration-300 group"
              >
                <div className="relative h-44 w-full overflow-hidden">
                  <img
                    src={space.image}
                    alt={space.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="rounded-lg bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                      {space.category}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <span className="block truncate text-xs font-medium text-white/90 drop-shadow-md">
                      🕒 {space.timing}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="font-['Poppins'] text-sm font-bold text-[var(--cm-text)] line-clamp-1 group-hover:text-[var(--cm-accent)] transition">
                    {space.name}
                  </h3>
                  <p className="flex items-center gap-1 text-xs text-[var(--cm-muted)]">
                    <MapPin size={12} className="shrink-0 text-[#AA2347]" /> {space.location}
                  </p>
                  <p className="text-xs text-[var(--cm-muted)] line-clamp-2 leading-relaxed pt-1 border-t border-[var(--cm-border)]/60">
                    {space.highlight}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. TWO-COLUMN INTERACTIVE TIMELINE & ACADEMIC SPRINT ── */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Column (7 cols): Day Flow Timeline */}
          <div className="space-y-8 lg:col-span-7">
            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-xs">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-['Poppins'] text-base sm:text-lg font-extrabold text-[var(--cm-text)]">
                    Your Fresher Day Flow ⏱️
                  </h3>
                  <p className="text-xs text-[var(--cm-muted)]">
                    Wednesday Schedule · DTU Academic Quad
                  </p>
                </div>
                <Link
                  to="/planner"
                  className="text-xs font-bold text-[#AA2347] dark:text-[#FFC72C] hover:underline"
                >
                  Full Weekly Timetable →
                </Link>
              </div>

              {/* Journey Timeline */}
              <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--cm-border)]">
                {DAY_FLOW.map((item, index) => (
                  <div key={index} className="relative group">
                    {/* Timeline bullet */}
                    <div
                      className={`absolute -left-6 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 transition ${
                        item.active
                          ? 'border-[#AA2347] bg-[#FFC72C] ring-4 ring-[#AA2347]/20 scale-110'
                          : 'border-[var(--cm-border)] bg-[var(--cm-surface)] group-hover:border-[var(--cm-accent)]'
                      }`}
                    />

                    <div
                      className={`rounded-xl border p-3.5 transition ${
                        item.active
                          ? 'border-[#AA2347] bg-[#AA2347]/5 dark:bg-[#AA2347]/15'
                          : 'border-[var(--cm-border)]/60 bg-[var(--cm-bg)]/40 hover:bg-[var(--cm-secondary)]/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-xs font-bold text-[var(--cm-text)] flex items-center gap-1.5">
                          <Clock size={12} className="text-[var(--cm-muted)]" />
                          {item.time}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {item.active && (
                            <span className="rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold px-2 py-0.5 uppercase tracking-wide animate-pulse">
                              Active Now
                            </span>
                          )}
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              item.tag === 'Exam'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : item.tag === 'Lab'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                : item.tag === 'Club'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-[var(--cm-secondary)] text-[var(--cm-muted)]'
                            }`}
                          >
                            {item.tag}
                          </span>
                        </div>
                      </div>

                      <h4 className="font-semibold text-sm text-[var(--cm-text)]">
                        {item.title}
                      </h4>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[var(--cm-muted)]">
                        <MapPin size={12} className="shrink-0 text-[#AA2347]" />
                        {item.location}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Academic Task Sprint Checklist */}
            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-xs">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-['Poppins'] text-base sm:text-lg font-extrabold text-[var(--cm-text)]">
                    Academic Task Sprint
                  </h3>
                  <p className="text-xs text-[var(--cm-muted)]">
                    Keep your lab submissions and assignments on track
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-1 text-xs">
                  <button
                    onClick={() => setTaskFilter('pending')}
                    className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer ${
                      taskFilter === 'pending'
                        ? 'bg-[var(--cm-accent)] text-white shadow-xs'
                        : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                    }`}
                  >
                    Pending ({tasks.filter((t) => t.status === 'pending').length})
                  </button>
                  <button
                    onClick={() => setTaskFilter('completed')}
                    className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer ${
                      taskFilter === 'completed'
                        ? 'bg-[var(--cm-accent)] text-white shadow-xs'
                        : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                    }`}
                  >
                    Done ({completedCount})
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4 space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[var(--cm-muted)]">Sprint Completion</span>
                  <span className="text-[#AA2347] dark:text-[#FFC72C]">{weeklyPercent}% complete</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--cm-secondary)]">
                  <div
                    className="h-full bg-gradient-to-r from-[#AA2347] to-[#D4345A] transition-all duration-500"
                    style={{ width: `${weeklyPercent}%` }}
                  />
                </div>
              </div>

              {/* Tasks list */}
              <div className="divide-y divide-[var(--cm-border)]/60">
                {visibleTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-[var(--cm-secondary)]/30 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className="shrink-0 text-[var(--cm-muted)] hover:text-[#AA2347] cursor-pointer"
                        aria-label="Toggle task status"
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 size={19} className="text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Circle size={19} />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-semibold truncate ${
                            task.status === 'completed'
                              ? 'line-through text-[var(--cm-muted)]'
                              : 'text-[var(--cm-text)]'
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-[var(--cm-muted)] truncate">
                          {task.subject}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2.5">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          task.priority === 'high'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {task.priority}
                      </span>
                      <span className="text-xs text-[var(--cm-muted)] font-medium">
                        {formatDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-[var(--cm-border)]/60 text-right">
                <Link
                  to="/planner"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#AA2347] dark:text-[#FFC72C] hover:underline"
                >
                  Manage all tasks in Planner <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Events Showcase + Lost&Found + Survival Calculator */}
          <div className="space-y-8 lg:col-span-5">
            {/* CampusConnect: Upcoming Events with Real Images */}
            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-xs">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-['Poppins'] text-base font-extrabold text-[var(--cm-text)]">
                    Campus Life & Festivities 🎪
                  </h3>
                  <p className="text-xs text-[var(--cm-muted)]">
                    Upcoming hackathons & tournaments
                  </p>
                </div>
                <Link
                  to="/events"
                  className="text-xs font-bold text-[#AA2347] dark:text-[#FFC72C] hover:underline"
                >
                  All Events →
                </Link>
              </div>

              <div className="space-y-4">
                {MOCK_EVENTS.slice(0, 3).map((event) => {
                  const { month, day } = formatEventDate(event.date)
                  return (
                    <Link
                      key={event.id}
                      to="/events"
                      state={{ selectedId: event.id }}
                      className="group flex gap-3.5 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3 hover:border-[var(--cm-accent)]/80 hover:shadow-xs transition"
                    >
                      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg">
                        <img
                          src={event.image}
                          alt={event.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute top-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-center">
                          <span className="block text-[8px] font-bold text-rose-400 uppercase leading-none">
                            {month}
                          </span>
                          <span className="block font-bold text-xs text-white leading-tight">
                            {day}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#AA2347] dark:text-[#FFC72C]">
                            {event.category}
                          </span>
                          <h4 className="font-semibold text-xs text-[var(--cm-text)] group-hover:text-[#AA2347] transition line-clamp-1 mt-0.5">
                            {event.title}
                          </h4>
                          <p className="text-[11px] text-[var(--cm-muted)] line-clamp-1 mt-0.5">
                            📍 {event.location}
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-[var(--cm-muted)]">
                          {event.attendees} students registered
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* CampusFind Lost & Found Board Preview */}
            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-xs">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-['Poppins'] text-base font-extrabold text-[var(--cm-text)]">
                    CampusFind Board 🔍
                  </h3>
                  <p className="text-xs text-[var(--cm-muted)]">
                    Community lost & found recovery
                  </p>
                </div>
                <Link
                  to="/lost-found"
                  className="text-xs font-bold text-[#AA2347] dark:text-[#FFC72C] hover:underline"
                >
                  Marketplace →
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {lostFoundItems.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    to="/lost-found"
                    state={{ selectedId: item.id }}
                    className="group block overflow-hidden rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-2 hover:border-[var(--cm-accent)] transition"
                  >
                    <div className="relative h-20 w-full overflow-hidden rounded-lg">
                      <img
                        src={item.imageUrl}
                        alt={item.itemName}
                        className="h-full w-full object-cover group-hover:scale-105 transition"
                      />
                      <span
                        className={`absolute top-1 left-1 rounded px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-white ${
                          item.type === 'lost' ? 'bg-rose-600' : 'bg-emerald-600'
                        }`}
                      >
                        {item.type}
                      </span>
                    </div>
                    <div className="mt-2 px-0.5">
                      <p className="truncate text-xs font-bold text-[var(--cm-text)] group-hover:text-[#AA2347] transition">
                        {item.itemName}
                      </p>
                      <p className="truncate text-[10px] text-[var(--cm-muted)]">
                        {item.locationTag || item.location}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Campus Survival Kit: Attendance Threshold Calculator */}
            <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="font-['Poppins'] text-sm font-extrabold text-[var(--cm-text)]">
                    Attendance Safeguard Meter
                  </h3>
                  <p className="text-[11px] text-[var(--cm-muted)]">
                    University 75% rule tracker
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--cm-muted)] font-medium">Attended / Total:</span>
                  <div className="flex items-center gap-1.5 font-bold text-[var(--cm-text)]">
                    <input
                      type="number"
                      min="0"
                      max={calcTotalClasses}
                      value={calcClassesAttended}
                      onChange={(e) => setCalcClassesAttended(Number(e.target.value))}
                      className="w-12 rounded-md border border-[var(--cm-border)] bg-[var(--cm-surface)] px-1 py-0.5 text-center text-xs font-bold text-[var(--cm-text)]"
                    />
                    <span>/</span>
                    <input
                      type="number"
                      min="1"
                      value={calcTotalClasses}
                      onChange={(e) => setCalcTotalClasses(Number(e.target.value))}
                      className="w-12 rounded-md border border-[var(--cm-border)] bg-[var(--cm-surface)] px-1 py-0.5 text-center text-xs font-bold text-[var(--cm-text)]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--cm-muted)]">Current Standing:</span>
                  <span
                    className={`font-['Poppins'] text-sm font-extrabold ${
                      attendanceRate >= 75
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {attendanceRate}% {attendanceRate >= 75 ? '✓ Safe for Exams' : '⚠️ Danger Debarred'}
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--cm-secondary)]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      attendanceRate >= 75 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, attendanceRate)}%` }}
                  />
                </div>
              </div>

              {/* Campus Compass Green Signals & Red Flags */}
              <div className="mt-4 pt-4 border-t border-[var(--cm-border)] grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-2.5 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <span className="font-extrabold flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    <Check size={12} /> DO THIS, LEGEND
                  </span>
                  <p className="mt-1 text-[11px] leading-snug">
                    Always verify attendance on ERP every Friday before 5 PM.
                  </p>
                </div>
                <div className="rounded-xl border border-rose-300 bg-rose-50/70 p-2.5 text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200">
                  <span className="font-extrabold flex items-center gap-1 text-[10px] uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    <AlertTriangle size={12} /> DON&apos;T DO THIS
                  </span>
                  <p className="mt-1 text-[11px] leading-snug">
                    Don&apos;t miss breakfast or mess dinner timings (7:30–9:30 PM).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
