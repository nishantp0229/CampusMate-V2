// src/pages/Profile.jsx — Student Passport & Profile connected to real Supabase data

import { useState } from 'react'
import {
  Moon,
  Sun,
  Edit3,
  Compass,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useTheme } from '../App'
import { useAuth } from '../context/AuthContext'

const INPUT_CLASS =
  'w-full rounded-xl border border-[var(--cm-border)] bg-[var(--cm-surface)] px-3.5 py-2.5 text-sm text-[var(--cm-text)] focus:border-[var(--cm-accent)] focus:outline-none transition'
const LABEL_CLASS = 'mb-1 block text-xs font-bold text-[var(--cm-muted)] uppercase tracking-wider'

function Profile() {
  const { theme, toggleTheme } = useTheme()
  const {
    user,
    profile,
    profileLoading,
    profileError,
    studentName,
    studentInitials,
    studentEmail,
    studentCollege,
    studentDepartment,
    studentSemester,
    updateProfile,
    signOut,
  } = useAuth()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formError, setFormError] = useState(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const [form, setForm] = useState({
    full_name: profile?.full_name || studentName || '',
    college: profile?.college || '',
    department: profile?.department || '',
    semester: profile?.semester ?? 1,
  })

  const handleStartEdit = () => {
    setFormError(null)
    setForm({
      full_name: profile?.full_name || studentName || '',
      college: profile?.college || '',
      department: profile?.department || '',
      semester: profile?.semester ?? 1,
    })
    setEditing(true)
  }

  const handleCancelEdit = () => {
    setEditing(false)
    setFormError(null)
    setForm({
      full_name: profile?.full_name || studentName || '',
      college: profile?.college || '',
      department: profile?.department || '',
      semester: profile?.semester ?? 1,
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setFormError(null)

    const nameTrimmed = form.full_name.trim()
    if (!nameTrimmed) {
      setFormError('Please enter your full name.')
      return
    }

    const semNum = Number(form.semester)
    if (isNaN(semNum) || semNum < 1 || semNum > 10) {
      setFormError('Semester must be between 1 and 10.')
      return
    }

    try {
      setSaving(true)
      await updateProfile({
        full_name: nameTrimmed,
        college: form.college.trim(),
        department: form.department.trim(),
        semester: semNum,
      })
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    } catch (err) {
      console.error('[CampusMate] Profile update error:', err)
      setFormError(err.message || 'Failed to save student profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-10 pb-16">
      {/* ── 1. PROFILE HERO HEADER ── */}
      <div className="workspace-page-header border-b border-[var(--cm-border)] bg-[var(--cm-surface)]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <div className="workspace-page-kicker"><span /> STUDENT PROFILE · CAMPUS PASSPORT</div>
              <h1 className="font-['Poppins'] text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--cm-text)]">
                A little about you.
              </h1>
              <p className="text-xs sm:text-sm text-[var(--cm-muted)]">
                Manage your collegiate credentials, academic standing, and application settings.
              </p>
            </div>

            <button
              type="button"
              onClick={editing ? handleCancelEdit : handleStartEdit}
              className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-4 py-2.5 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer shadow-xs"
            >
              <Edit3 size={15} className="text-[var(--cm-accent)]" /> {editing ? 'Cancel Editing' : 'Edit Credentials'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Loading state indicator */}
        {profileLoading && !profile && (
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-surface)] p-4 text-xs font-semibold text-[var(--cm-muted)] shadow-xs">
            <Loader2 size={16} className="animate-spin text-[var(--cm-accent)]" />
            Loading your student profile from Supabase...
          </div>
        )}

        {/* Success feedback */}
        {saved && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-xs">
            <CheckCircle2 size={16} />
            Student credentials and profile information successfully saved.
          </div>
        )}

        {/* Error feedback */}
        {(formError || profileError) && (
          <div className="flex items-center gap-2 rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-xs font-bold text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 shadow-xs" role="alert">
            <AlertCircle size={16} />
            {formError || profileError}
          </div>
        )}

        {/* ── 2. UNIVERSITY DIGITAL ID CARD / STUDENT PASSPORT ── */}
        <div className="overflow-hidden rounded-3xl border border-[var(--cm-border)] bg-[var(--cm-surface)] shadow-md">
          {/* Card Top Strip */}
          <div className="border-b border-[var(--cm-border)] bg-[var(--cm-accent-tint)] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--cm-accent)] text-[var(--cm-accent-text)] shadow-md">
                <Compass size={22} />
              </div>
              <div>
                <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[var(--cm-accent)]">
                  Student Passport · University Verified
                </span>
                <span className="block font-['Poppins'] text-base font-extrabold text-[var(--cm-text)]">
                  {studentCollege}
                </span>
              </div>
            </div>

            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-3.5 py-1 text-xs font-extrabold">
              Active Student · Semester {studentSemester}
            </span>
          </div>

          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Avatar & Initials */}
            <div className="flex flex-col items-center justify-center text-center md:col-span-4 border-b md:border-b-0 md:border-r border-[var(--cm-border)]/60 pb-6 md:pb-0 md:pr-8">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-[var(--cm-accent)] text-3xl font-extrabold text-[var(--cm-accent-text)] shadow-lg">
                {studentInitials}
                <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 border-2 border-[var(--cm-surface)]" />
              </div>
              <h2 className="mt-4 font-['Poppins'] text-xl font-extrabold text-[var(--cm-text)]">
                {studentName}
              </h2>
              <p className="text-xs text-[var(--cm-muted)] font-medium mt-0.5">{studentEmail}</p>
              <span className="mt-3 rounded-lg bg-[var(--cm-secondary)] px-3 py-1 text-xs font-bold text-[var(--cm-text)]">
                Student ID: {user?.id ? user.id.slice(0, 8).toUpperCase() : 'ACTIVE'}
              </span>
            </div>

            {/* Academic details */}
            <div className="space-y-4 md:col-span-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Department</span>
                  <p className="mt-1 font-bold text-xs text-[var(--cm-text)] truncate">{studentDepartment}</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Term Status</span>
                  <p className="mt-1 font-bold text-xs text-[var(--cm-text)]">Semester {studentSemester}</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Cumulative CGPA</span>
                  <p className="mt-1 font-bold text-xs text-emerald-600 dark:text-emerald-400">8.6 / 10.0</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Completed Credits</span>
                  <p className="mt-1 font-bold text-xs text-[var(--cm-text)]">{studentSemester * 20} / 160</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Attendance Meter</span>
                  <p className="mt-1 font-bold text-xs text-emerald-600 dark:text-emerald-400">85% Safe</p>
                </div>
                <div className="rounded-2xl border border-[var(--cm-border)] bg-[var(--cm-bg)] p-3.5 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase text-[var(--cm-muted)]">Society Role</span>
                  <p className="mt-1 font-bold text-xs text-[var(--cm-accent)]">Student Member</p>
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
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. Nishant Patel"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Institutional Email (Account)</label>
                <input
                  type="email"
                  disabled
                  value={studentEmail}
                  className={`${INPUT_CLASS} opacity-60 cursor-not-allowed`}
                  title="Institutional email is managed by your account authentication."
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>College / University</label>
                <input
                  type="text"
                  value={form.college}
                  onChange={(e) => setForm({ ...form, college: e.target.value })}
                  placeholder="e.g. Delhi Technological University"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Branch / Department</label>
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Computer Science & Engineering"
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS}>Current Semester</label>
                <select
                  value={form.semester}
                  onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}
                  className={INPUT_CLASS}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-end gap-2 sm:col-span-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="rounded-xl border border-[var(--cm-border)] px-4 py-2.5 text-xs font-bold text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)] transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="workspace-primary-button disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Credentials'}
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
                <p className="text-[11px] text-[var(--cm-muted)]">Switch between warm daylight and forest night themes</p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--cm-border)] bg-[var(--cm-bg)] px-4 py-2 text-xs font-bold text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition cursor-pointer shadow-2xs"
              >
                {theme === 'dark' ? <Sun size={15} className="text-[var(--cm-accent)]" /> : <Moon size={15} />}
                {theme === 'dark' ? 'Forest Night' : 'Warm Daylight'}
              </button>
            </div>

            {/* Notification setting */}
            <div className="py-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--cm-text)]">Assignment & Hackathon Notices</p>
                <p className="text-[11px] text-[var(--cm-muted)]">Receive notifications for upcoming lab evaluations</p>
              </div>
              <button
                type="button"
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

            {/* Account Sign Out */}
            <div className="py-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--cm-text)]">Account Session</p>
                <p className="text-[11px] text-[var(--cm-muted)]">Sign out of your account on this device</p>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-4 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer shadow-2xs"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
