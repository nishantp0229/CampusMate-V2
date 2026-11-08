// src/pages/Profile.jsx — Student Profile and Preferences module
// Displays student academic profile, inline profile editor, theme preferences and account actions.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Moon, Sun, LogOut, Edit2, Check,
  Shield, Bell, CheckCircle2
} from 'lucide-react'
import { useTheme } from '../App'
import { MOCK_USER } from '../utils/mockData'

function Profile() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const [user, setUser] = useState(MOCK_USER)
  const [isEditing, setIsEditing] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  const [editForm, setEditForm] = useState({
    name: user.name,
    email: user.email,
    college: user.college,
    department: user.department,
    semester: user.semester,
  })

  const handleSaveProfile = (e) => {
    e.preventDefault()
    setUser(prev => ({
      ...prev,
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      college: editForm.college.trim(),
      department: editForm.department.trim(),
      semester: Number(editForm.semester),
      avatarInitials: editForm.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    }))
    setIsEditing(false)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 3000)
  }

  const handleSignOut = () => {
    // In Stage 3, this will call supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <div>
        <h1
          className="text-2xl font-bold text-[#242B3A] dark:text-[#F1F1FC]"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Profile & Settings
        </h1>
        <p className="text-sm text-[#737B8C] dark:text-[#A0A8B8] mt-1">
          Manage your personal details, academic information and account preferences.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 size={16} />
          Profile updated successfully!
        </div>
      )}

      {/* ══ PROFILE CARD ═════════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#E2E8F0] dark:border-white/[0.05]">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#A9C9FF] to-[#C8B6FF] text-white text-xl font-bold flex items-center justify-center shadow-sm">
              {user.avatarInitials}
            </div>

            <div>
              <h2
                className="text-lg font-bold text-[#242B3A] dark:text-[#F1F1FC]"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                {user.name}
              </h2>
              <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] mt-0.5">
                {user.email}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-[#EAF2FF] dark:bg-[#A9C9FF]/10 text-xs font-medium text-[#5B9BF8] dark:text-[#A9C9FF]">
                  Semester {user.semester}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-[#F0EBFF] dark:bg-[#C8B6FF]/10 text-xs font-medium text-[#9B7FE8] dark:text-[#C8B6FF]">
                  {user.department}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setEditForm({
                name: user.name,
                email: user.email,
                college: user.college,
                department: user.department,
                semester: user.semester,
              })
              setIsEditing(!isEditing)
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.1] text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] hover:bg-[#F7F8FC] dark:hover:bg-white/[0.05] transition-colors"
          >
            <Edit2 size={13} />
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {/* Inline Edit Form */}
        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-[#242B3A] dark:text-[#F1F1FC]">
              Edit Student Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                  College / University
                </label>
                <input
                  type="text"
                  value={editForm.college}
                  onChange={(e) => setEditForm(f => ({ ...f, college: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                  Department / Branch
                </label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm(f => ({ ...f, department: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                  Current Semester
                </label>
                <select
                  value={editForm.semester}
                  onChange={(e) => setEditForm(f => ({ ...f, semester: e.target.value }))}
                  className="w-full px-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl border border-[#E2E8F0] dark:border-white/[0.1] text-xs font-medium text-[#737B8C]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#A9C9FF] text-white rounded-xl text-xs font-medium hover:bg-[#8BB8F8] transition-colors"
              >
                <Check size={14} />
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          /* Read-only details grid */
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-[#F7F8FC] dark:bg-[#171A29]">
              <span className="text-[#737B8C] dark:text-[#A0A8B8] block mb-1">College</span>
              <span className="font-semibold text-sm text-[#242B3A] dark:text-[#F1F1FC]">{user.college}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F7F8FC] dark:bg-[#171A29]">
              <span className="text-[#737B8C] dark:text-[#A0A8B8] block mb-1">Department</span>
              <span className="font-semibold text-sm text-[#242B3A] dark:text-[#F1F1FC]">{user.department}</span>
            </div>
          </div>
        )}
      </div>

      {/* ══ PREFERENCES & APPEARANCE ═════════════════════════════ */}
      <div className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-6 shadow-sm space-y-4">
        <h3
          className="text-base font-semibold text-[#242B3A] dark:text-[#F1F1FC]"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Preferences
        </h3>

        {/* Theme Toggle row */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F8FC] dark:bg-[#171A29]">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? (
              <Moon size={18} className="text-[#C8B6FF]" />
            ) : (
              <Sun size={18} className="text-[#FFB347]" />
            )}
            <div>
              <p className="text-sm font-medium text-[#242B3A] dark:text-[#F1F1FC]">
                Theme Mode
              </p>
              <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8]">
                Currently using {theme} mode.
              </p>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#252A3C] border border-[#E2E8F0] dark:border-white/[0.1] text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] hover:bg-[#EAF2FF] dark:hover:bg-white/[0.05] transition-colors"
          >
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>

        {/* Notifications notice */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F8FC] dark:bg-[#171A29]">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-[#5B9BF8]" />
            <div>
              <p className="text-sm font-medium text-[#242B3A] dark:text-[#F1F1FC]">
                In-App Notifications
              </p>
              <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8]">
                Assignment reminders and event alerts are active.
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
            Enabled
          </span>
        </div>
      </div>

      {/* ══ ACCOUNT & SESSION ════════════════════════════════════ */}
      <div className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-6 shadow-sm space-y-4">
        <h3
          className="text-base font-semibold text-[#242B3A] dark:text-[#F1F1FC]"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          Account Security
        </h3>

        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F8FC] dark:bg-[#171A29]">
          <div className="flex items-center gap-3">
            <Shield size={18} className="text-[#6BCB9A]" />
            <div>
              <p className="text-sm font-medium text-[#242B3A] dark:text-[#F1F1FC]">
                Authentication Provider
              </p>
              <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8]">
                Configured for Supabase Auth (Demo session active)
              </p>
            </div>
          </div>

          <button
            onClick={() => alert('Password reset will be available once Supabase Auth is enabled.')}
            className="text-xs text-[#5B9BF8] hover:underline font-medium"
          >
            Change Password
          </button>
        </div>

        <div className="pt-2">
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-xs font-semibold hover:bg-red-100 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default Profile
