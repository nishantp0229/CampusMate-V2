// src/pages/Dashboard.jsx — Clean editorial CampusMate student workspace

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ExternalLink, CheckCircle2, Circle, CalendarDays, BookOpen, Compass } from 'lucide-react'
import {
  MOCK_TASKS,
  MOCK_EVENTS,
  MOCK_LOST_FOUND,
  MOCK_RESOURCES,
  MOCK_TODAY_SCHEDULE,
  MOCK_USER,
} from '../utils/mockData'

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function Dashboard({ lostFoundItems = MOCK_LOST_FOUND }) {
  const [tasks, setTasks] = useState(MOCK_TASKS)

  const toggleTask = (id) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t
      )
    )
  }

  const pendingTasks = tasks.filter((t) => t.status === 'pending')
  const completedCount = tasks.length - pendingTasks.length
  const weeklyPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0

  const summaryStats = [
    { label: 'pending tasks', value: pendingTasks.length, link: '/planner' },
    { label: 'completed', value: completedCount, link: '/planner' },
    { label: 'upcoming events', value: MOCK_EVENTS.length, link: '/events' },
    { label: 'resources', value: MOCK_RESOURCES.length, link: '/resources' },
  ]

  const quickActions = [
    { label: 'Add a Task', to: '/planner', state: { openAdd: true }, icon: Plus },
    { label: 'Explore Events', to: '/events', icon: CalendarDays },
    { label: 'Upload Notes', to: '/resources', state: { openAdd: true }, icon: BookOpen },
    { label: 'Report Lost or Found Item', to: '/lost-found', state: { openAdd: true }, icon: Compass },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-8">
      {/* Header + Compact Inline Statistics */}
      <header className="space-y-4 border-b border-[var(--cm-border)] pb-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium text-[var(--cm-muted)]">
              {MOCK_USER.college} · {MOCK_USER.department} · Sem {MOCK_USER.semester}
            </p>
            <h2 className="mt-1 font-['Poppins'] text-2xl font-semibold tracking-tight text-[var(--cm-text)] sm:text-3xl">
              Welcome back, {MOCK_USER.name}
            </h2>
          </div>

          <Link
            to="/planner"
            className="inline-flex items-center gap-1.5 self-start rounded bg-[var(--cm-accent)] px-3.5 py-2 text-xs font-medium text-[var(--cm-accent-text)] transition-opacity hover:opacity-90"
          >
            <Plus size={14} /> Add Task
          </Link>
        </div>

        {/* Inline stats */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1 text-xs text-[var(--cm-muted)]">
          {summaryStats.map((stat) => (
            <Link key={stat.label} to={stat.link} className="transition-colors hover:text-[var(--cm-text)]">
              <strong className="font-semibold text-[var(--cm-text)]">{stat.value}</strong> {stat.label}
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {quickActions.map(({ label, to, state, icon: Icon }) => (
            <Link
              key={label}
              to={to}
              state={state}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--cm-border)] bg-[var(--cm-card)] px-3 py-1.5 text-xs font-medium text-[var(--cm-text)] transition-colors hover:bg-[var(--cm-secondary)]"
            >
              <Icon size={13} className="text-[var(--cm-muted)]" />
              {label}
            </Link>
          ))}
        </div>
      </header>

      {/* Weekly Progress */}
      <section className="space-y-2 border-b border-[var(--cm-border)] pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <h3 className="font-['Poppins'] text-sm font-semibold text-[var(--cm-text)]">
            Weekly Progress
          </h3>
          <span className="text-[var(--cm-muted)]">
            <strong className="font-semibold text-[var(--cm-text)]">{completedCount}</strong> of{' '}
            <strong className="font-semibold text-[var(--cm-text)]">{tasks.length}</strong> tasks completed ({weeklyPercent}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-[var(--cm-secondary)]">
          <div
            className="h-full bg-[var(--cm-accent)] transition-all duration-300"
            style={{ width: `${weeklyPercent}%` }}
          />
        </div>
      </section>

      {/* Main Two-Column Editorial Workspace */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Left Column: Assignments + Resources */}
        <div className="space-y-9 lg:col-span-2">
          {/* Upcoming Assignments List */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-['Poppins'] text-base font-semibold text-[var(--cm-text)]">
                Upcoming Assignments
              </h3>
              <Link to="/planner" className="text-xs font-medium text-[var(--cm-muted)] hover:text-[var(--cm-text)]">
                View all →
              </Link>
            </div>

            <div className="divide-y divide-[var(--cm-border)]/70 border-y border-[var(--cm-border)]/70">
              {pendingTasks.slice(0, 4).map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      onClick={() => toggleTask(task.id)}
                      className="shrink-0 text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
                      aria-label="Toggle task status"
                    >
                      {task.status === 'completed' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </button>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--cm-text)]">{task.title}</p>
                      <p className="text-xs text-[var(--cm-muted)]">{task.subject}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--cm-muted)]">
                    Due {formatDate(task.dueDate)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Recently Added Resources (Horizontal Previews) */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-['Poppins'] text-base font-semibold text-[var(--cm-text)]">
                Recently Added Resources
              </h3>
              <Link to="/resources" className="text-xs font-medium text-[var(--cm-muted)] hover:text-[var(--cm-text)]">
                Browse NoteNest →
              </Link>
            </div>

            <div className="divide-y divide-[var(--cm-border)]/70 border-y border-[var(--cm-border)]/70">
              {MOCK_RESOURCES.slice(0, 3).map((res) => (
                <div key={res.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--cm-text)]">{res.title}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--cm-muted)]">
                      {res.subject} · Sem {res.semester} · {res.resourceType.toUpperCase()}
                    </p>
                  </div>
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--cm-muted)] hover:text-[var(--cm-text)]"
                  >
                    Open <ExternalLink size={12} />
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Today's Schedule + Editorial Events List + Image-Focused Lost & Found */}
        <div className="space-y-9">
          {/* Today's Schedule */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-['Poppins'] text-base font-semibold text-[var(--cm-text)]">
                Today&apos;s Schedule
              </h3>
              <span className="text-xs text-[var(--cm-muted)]">4 sessions</span>
            </div>

            <div className="divide-y divide-[var(--cm-border)]/70 border-y border-[var(--cm-border)]/70">
              {MOCK_TODAY_SCHEDULE.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--cm-text)]">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--cm-muted)]">
                      {item.type} · {item.location}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-[var(--cm-muted)]">{item.time}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Upcoming Events (Compact Editorial List) */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-['Poppins'] text-base font-semibold text-[var(--cm-text)]">
                Upcoming Events
              </h3>
              <Link to="/events" className="text-xs font-medium text-[var(--cm-muted)] hover:text-[var(--cm-text)]">
                All events →
              </Link>
            </div>

            <div className="divide-y divide-[var(--cm-border)]/70 border-y border-[var(--cm-border)]/70">
              {MOCK_EVENTS.slice(0, 3).map((ev) => (
                <div key={ev.id} className="py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--cm-muted)]">
                    {formatDate(ev.date)} · {ev.category}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-[var(--cm-text)]">{ev.title}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--cm-muted)]">{ev.location}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Lost & Found (Image-Focused) */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-['Poppins'] text-base font-semibold text-[var(--cm-text)]">
                Recent Lost & Found
              </h3>
              <Link to="/lost-found" className="text-xs font-medium text-[var(--cm-muted)] hover:text-[var(--cm-text)]">
                Board →
              </Link>
            </div>

            <div className="divide-y divide-[var(--cm-border)]/70 border-y border-[var(--cm-border)]/70">
              {lostFoundItems.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  to="/lost-found"
                  className="group flex items-center gap-3.5 py-3"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.itemName}
                    className="h-16 w-24 shrink-0 rounded border border-[var(--cm-border)] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${
                      item.type === 'lost' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {item.type}
                    </p>
                    <p className="truncate text-sm font-medium text-[var(--cm-text)] group-hover:underline">
                      {item.itemName}
                    </p>
                    <p className="truncate text-xs text-[var(--cm-muted)]">{item.location}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
