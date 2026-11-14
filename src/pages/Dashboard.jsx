// src/pages/Dashboard.jsx — Visually rich university campus homepage inspired by Campus Compass

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  Pause,
  Play,
} from 'lucide-react'
import {
  MOCK_TASKS,
  MOCK_EVENTS,
  MOCK_LOST_FOUND,
} from '../utils/mockData'

const photo = (name) => `${import.meta.env.BASE_URL}landing/${name}.jpg`

const QUICK_TIPS = [
  'A little planning makes room for a lot more living.',
  'Check your timetable before the day gets going.',
  'Share useful notes with someone learning alongside you.',
  'Make time for a club, a conversation, or a coffee.',
  'Keep an eye on deadlines and event registrations.',
]

const HERO_CAROUSEL_SLIDES = [
  {
    image: photo('architecture'),
    tag: 'YOUR CAMPUS, ALL IN ONE PLACE',
    title: 'Make a little more of today.',
    desc: 'Your classes, plans, and campus moments — a little more organised, all together.',
    ctaText: 'Open Academic Planner',
    ctaLink: '/planner',
  },
  {
    image: photo('students'),
    tag: 'MAKE ROOM FOR CAMPUS LIFE',
    title: 'There’s more beyond class.',
    desc: 'Find your people and discover the communities and activities around you.',
    ctaText: 'Explore CampusConnect',
    ctaLink: '/events',
  },
  {
    image: photo('library'),
    tag: 'BETTER NOTES, TOGETHER',
    title: 'Good notes travel further.',
    desc: 'Find study resources and share what helps with the people learning alongside you.',
    ctaText: 'Explore NoteNest',
    ctaLink: '/resources',
  },
]

const CAMPUS_SPACES = [
  {
    name: 'Library & study spaces',
    category: 'Find your focus',
    image: photo('library'),
    highlight: 'A little quiet for the work that needs your attention.',
  },
  {
    name: 'Labs & learning',
    category: 'Hands-on ideas',
    image: photo('lab'),
    highlight: 'Where curiosity turns into experiments and new skills.',
  },
  {
    name: 'People & projects',
    category: 'Better together',
    image: photo('students'),
    highlight: 'Good ideas are even better when you share them.',
  },
  {
    name: 'Events & culture',
    category: 'Show up for it',
    image: photo('event'),
    highlight: 'The shared moments worth making time for.',
  },
  {
    name: 'Sports & movement',
    category: 'Team spirit',
    image: photo('sports'),
    highlight: 'A change of pace and a chance to play together.',
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
  const [heroPaused, setHeroPaused] = useState(false)
  const [heroHovered, setHeroHovered] = useState(false)
  const [heroFocused, setHeroFocused] = useState(false)
  const [taskFilter, setTaskFilter] = useState('pending')
  const [calcClassesAttended, setCalcClassesAttended] = useState(34)
  const [calcTotalClasses, setCalcTotalClasses] = useState(40)
  const spaceScrollRef = useRef(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timer
    const update = () => {
      window.clearInterval(timer)
      if (!media.matches && !heroPaused && !heroHovered && !heroFocused) {
        timer = window.setInterval(() => setCurrentHeroSlide((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length), 6500)
      }
    }
    update()
    media.addEventListener('change', update)
    return () => { window.clearInterval(timer); media.removeEventListener('change', update) }
  }, [heroPaused, heroHovered, heroFocused])

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
      spaceScrollRef.current.scrollBy({ left: 320, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }

  const prevSpace = () => {
    if (spaceScrollRef.current) {
      spaceScrollRef.current.scrollBy({ left: -320, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }

  return (
    <div className="space-y-10 pb-16">
      <div className="workspace-pulse" aria-label="Campus Pulse student tips">
        <span className="workspace-pulse-label"><span /> CAMPUS PULSE</span>
        <div className="workspace-pulse-window" tabIndex="0" aria-label="Student tips. Focus to pause scrolling.">
          <div className="workspace-pulse-track">
            {[0, 1].map((copy) => <div className="workspace-pulse-group" key={copy} aria-hidden={copy === 1}>{QUICK_TIPS.map((tip) => <span key={tip}>{tip}<b>✳</b></span>)}</div>)}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
        <div className="workspace-welcome">
          <section className="workspace-hero" aria-label="CampusMate highlights" aria-roledescription="carousel"
            onMouseEnter={() => setHeroHovered(true)} onMouseLeave={() => setHeroHovered(false)}
            onFocusCapture={() => setHeroFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHeroFocused(false) }}>
            <div className="workspace-hero-images" aria-hidden="true">
              {HERO_CAROUSEL_SLIDES.map((item, index) => <img key={item.image} src={item.image} alt="" width="1600" height="1067" loading={index === 0 ? 'eager' : 'lazy'} className={index === currentHeroSlide ? 'is-active' : ''} />)}
            </div>
            <div className="workspace-hero-shade" />
            <div className="workspace-hero-content">
              <div>
                <p className="workspace-hero-kicker"><span /> {slide.tag}</p>
                <h1>{slide.title}</h1>
                <p className="workspace-hero-description">{slide.desc}</p>
                <div className="workspace-hero-actions">
                  <Link to={slide.ctaLink} className="workspace-hero-primary">{slide.ctaText} <ArrowRight size={16} /></Link>
                  <Link to="/lost-found" state={{ openAdd: true }} className="workspace-hero-secondary">Report Lost Item <ArrowRight size={16} /></Link>
                </div>
              </div>
              <div className="workspace-hero-bottom">
                <div className="workspace-hero-controls">
                  <span>{String(currentHeroSlide + 1).padStart(2, '0')} / 03</span>
                  {HERO_CAROUSEL_SLIDES.map((item, index) => <button type="button" key={item.image} className={`workspace-hero-dot ${index === currentHeroSlide ? 'is-active' : ''}`} aria-label={`Show highlight ${index + 1}`} aria-pressed={index === currentHeroSlide} onClick={() => { setCurrentHeroSlide(index); setHeroPaused(true) }} />)}
                  <button type="button" className="workspace-hero-arrow" aria-label="Previous slide" onClick={() => { setCurrentHeroSlide((prev) => (prev - 1 + HERO_CAROUSEL_SLIDES.length) % HERO_CAROUSEL_SLIDES.length); setHeroPaused(true) }}><ChevronLeft size={17} /></button>
                  <button type="button" className="workspace-hero-arrow" aria-label="Next slide" onClick={() => { setCurrentHeroSlide((prev) => (prev + 1) % HERO_CAROUSEL_SLIDES.length); setHeroPaused(true) }}><ChevronRight size={17} /></button>
                  <button type="button" className="workspace-hero-play" aria-label={heroPaused ? 'Play slideshow' : 'Pause slideshow'} onClick={() => setHeroPaused(!heroPaused)}>{heroPaused ? <Play size={14} /> : <Pause size={14} />}</button>
                </div>
                <span className="workspace-hero-credit">ILLUSTRATIVE PHOTOGRAPHY · EXAMPLE DATA</span>
              </div>
            </div>
          </section>
          <div className="workspace-overview" aria-label="Your day at a glance">
            <div><span>YOUR TARGET CGPA</span><strong>8.6 <small>/ 10</small></strong><p>Example academic goal</p></div>
            <div><span>ATTENDANCE</span><strong>{attendanceRate}%</strong><p>Based on your calculator</p></div>
            <div><span>DAY FLOW</span><strong>{DAY_FLOW.length} <small>moments</small></strong><p>Explore your sample schedule</p></div>
            <div><span>TASKS COMPLETED</span><strong>{completedCount} <small>/ {tasks.length}</small></strong><p>{weeklyPercent}% of your task list</p></div>
          </div>
        </div>

        <section className="workspace-spaces">
          <div className="workspace-section-heading">
            <div><p className="workspace-section-kicker"><span /> THE WORLD AROUND YOU</p><h2>More than a place to study.</h2><p>For the places, people, and moments in between.</p></div>
            <div className="workspace-space-controls">
              <button type="button" onClick={prevSpace} aria-label="Previous campus space"><ChevronLeft size={18} /></button>
              <button type="button" onClick={nextSpace} aria-label="Next campus space"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div ref={spaceScrollRef} className="workspace-space-rail" aria-label="Illustrative campus life photographs">
            {CAMPUS_SPACES.map((space) => (
              <article className="workspace-space" key={space.name}>
                <div><img src={space.image} alt="" width="1600" height="1067" loading="lazy" /><span>{space.category}</span></div>
                <h3>{space.name}</h3><p>{space.highlight}</p>
              </article>
            ))}
          </div>
          <p className="workspace-spaces-note">ILLUSTRATIVE PHOTOGRAPHY · NOT A SPECIFIC CAMPUS</p>
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
                  className="text-xs font-bold text-[var(--cm-accent)] hover:underline"
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
                          ? 'border-[var(--cm-accent)] bg-[var(--cm-accent)] ring-4 ring-[var(--cm-accent)]/20 scale-110'
                          : 'border-[var(--cm-border)] bg-[var(--cm-surface)] group-hover:border-[var(--cm-accent)]'
                      }`}
                    />

                    <div
                      className={`rounded-xl border p-3.5 transition ${
                        item.active
                          ? 'border-[var(--cm-accent)] bg-[var(--cm-accent-tint)]'
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
                        <MapPin size={12} className="shrink-0 text-[var(--cm-accent)]" />
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
                        ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
                        : 'text-[var(--cm-muted)] hover:text-[var(--cm-text)]'
                    }`}
                  >
                    Pending ({tasks.filter((t) => t.status === 'pending').length})
                  </button>
                  <button
                    onClick={() => setTaskFilter('completed')}
                    className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer ${
                      taskFilter === 'completed'
                        ? 'bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-xs'
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
                  <span className="text-[var(--cm-accent)]">{weeklyPercent}% complete</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--cm-secondary)]">
                  <div
                    className="h-full bg-[var(--cm-accent)] transition-all duration-500"
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
                        className="shrink-0 text-[var(--cm-muted)] hover:text-[var(--cm-accent)] cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--cm-accent)] hover:underline"
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
                  className="text-xs font-bold text-[var(--cm-accent)] hover:underline"
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
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--cm-accent)]">
                            {event.category}
                          </span>
                          <h4 className="font-semibold text-xs text-[var(--cm-text)] group-hover:text-[var(--cm-accent)] transition line-clamp-1 mt-0.5">
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
                  className="text-xs font-bold text-[var(--cm-accent)] hover:underline"
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
                      <p className="truncate text-xs font-bold text-[var(--cm-text)] group-hover:text-[var(--cm-accent)] transition">
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
