// src/pages/Profile.jsx — Student Passport & Profile inspired by Campus Compass identity

import { useState } from 'react'
import {
  Shield,
  Moon,
  Sun,
  Edit3,
  Compass,
} from 'lucide-react'
import { useTheme } from '../App'
import { MOCK_USER } from '../utils/mockData'

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-none transition'
const LABEL_CLASS = 'mb-1 block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider'

function Profile() {
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = useState(MOCK_USER)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    college: user.college,
    department: user.department,
    semester: user.semester,
  })

  const save = (e) => {
    e.preventDefault()
    setUser((prev) => ({
      ...prev,
      ...form,
      semester: Number(form.semester),
      avatarInitials: form.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    }))
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. PROFILE HERO HEADER ── */}
      <div className="border-b border-[var(--cm-border)] bg-[var(--cm-surface)] py-8 shadow-2xs">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--cm-border)] bg-[var(--cm-bg)] px-3.5 py-1 text-xs font-semibold text-[var(--cm-muted)]">
                <Shield size={14} className="text-emerald-500" />
                <span>Verified University Student Passport</span>
              </div>
              <h1 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--cm-text)]">
                Student Passport & Profile 🎓
              </h1>
              <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
                Manage your collegiate credentials, academic standing, and application settings.
              </p>
            </div>

            <button
              onClick={() => {
                setForm({
                  name: user.name,
                  email: user.email,
                  college: user.college,
                  department: user.department,
                  semester: user.semester,
                })
                setEditing(!editing)
              }}
              className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-4 py-2.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer shadow-xs"
            >
              <Edit3 size={15} className="text-[#AA2347]" /> {editing ? 'Cancel Editing' : 'Edit Credentials'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8">
        {saved && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs">
            ✓ Student credentials and profile information successfully saved.
          </div>
        )}

        {/* ── 2. UNIVERSITY DIGITAL ID CARD / STUDENT PASSPORT ── */}
        <div className="overflow-hidden rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-md">
          {/* Card Top Strip */}
          <div className="border-b border-[var(--cm-border)] bg-gradient-to-r from-[#AA2347]/10 via-[#AA2347]/5 to-transparent p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#AA2347] to-[#78142F] text-white shadow-md">
                <Compass size={22} className="text-[#FFC72C]" />
              </div>
              <div>
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#AA2347] dark:text-[#FFC72C]">
                  Official University Passport
                </span>
                <span className="block font-['Poppins'] text-base font-extrabold text-[var(--cm-text)]">
                  {user.college}
                </span>
              </div>
            </div>

            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-3.5 py-1 text-xs font-extrabold">
              Active Enrolled · Fall 2026
            </span>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Avatar & Initials */}
            <div className="flex flex-col items-center justify-center text-center md:col-span-4 border-b md:border-b-0 md:border-r border-[var(--cm-border)]/60 pb-6 md:pb-0 md:pr-8">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-[#AA2347] to-[#8A1B39] text-3xl font-extrabold text-white shadow-lg shadow-[#AA2347]/30">
                {user.avatarInitials}
                <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-[var(--cm-surface)]" />
              </div>
              <h2 className="mt-4 font-['Poppins'] text-xl font-extrabold text-[var(--cm-text)]">
                {user.name}
              </h2>
              <p className="text-xs text-[var(--cm-muted)] font-medium mt-0.5">{user.email}</p>
              <span className="mt-3 rounded-lg bg-[var(--cm-secondary)] px-3 py-1 text-xs font-bold text-[var(--cm-text)]">
                Roll No: 2K22/CO/184
              </span>
            </div>

            {/* Academic details */}
            <div className="space-y-4 md:col-span-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Department</span>
                  <p className="mt-1 font-bold text-xs text-[var(--cm-text)] truncate">{user.department}</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Term Status</span>
                  <p className="mt-1 font-bold text-xs text-[var(--cm-text)]">Semester {user.semester}</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Cumulative CGPA</span>
                  <p className="mt-1 font-bold text-xs text-emerald-600 dark:text-emerald-400">8.6 / 10.0</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Completed Credits</span>
                  <p className="mt-1 font-bold text-xs text-[var(--cm-text)]">112 / 160</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Attendance Meter</span>
                  <p className="mt-1 font-bold text-xs text-emerald-600 dark:text-emerald-400">85% Safe</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Society Role</span>
                  <p className="mt-1 font-bold text-xs text-[#AA2347] dark:text-[#FFC72C]">ACM Student Lead</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. EDIT CREDENTIALS FORM ── */}
        {editing && (
          <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 sm:p-8 shadow-xs">
            <h3 className="font-['Poppins'] text-lg font-extrabold text-[var(--cm-text)] mb-4">
              Edit Student Credentials
            </h3>
            <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Institutional Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>College / University</label>
                <input
                  type="text"
                  required
                  value={form.college}
                  onChange={(e) => setForm({ ...form, college: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Branch / Department</label>
                <input
                  type="text"
                  required
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Current Semester</label>
                <select
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: e.target.value })}
                  className={INPUT_CLASS}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-end gap-2 sm:col-span-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-[#AA2347] to-[#8A1B39] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#AA2347]/20 hover:brightness-110 transition cursor-pointer"
                >
                  Save Credentials
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── 4. PREFERENCES & SETTINGS ── */}
        <div className="rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-6 sm:p-8 shadow-xs space-y-4">
          <h3 className="font-['Poppins'] text-lg font-extrabold text-[var(--cm-text)]">
            Preferences & Appearance
          </h3>

          <div className="divide-y divide-[var(--cm-border)]/60">
            {/* Theme Toggle */}
            <div className="py-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--cm-text)]">Collegiate Theme Mode</p>
                <p className="text-[11px] text-[var(--cm-muted)]">Switch between Daylight Ivory and Midnight Obsidian themes</p>
              </div>
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-4 py-2 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer shadow-2xs"
              >
                {theme === 'dark' ? <Sun size={15} className="text-[#FFC72C]" /> : <Moon size={15} />}
                {theme === 'dark' ? 'Obsidian Dark' : 'Daylight Ivory'}
              </button>
            </div>

            {/* Notification setting */}
            <div className="py-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--cm-text)]">Assignment & Hackathon Notices</p>
                <p className="text-[11px] text-[var(--cm-muted)]">Receive notifications for upcoming lab evaluations</p>
              </div>
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer shadow-2xs ${
                  notificationsEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[var(--cm-secondary)] text-[var(--cm-muted)]'
                }`}
              >
                {notificationsEnabled ? 'Active ✓' : 'Muted'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
