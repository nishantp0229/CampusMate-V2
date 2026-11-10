import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Moon, Sun, LogOut, Edit2, Check, Shield, Bell, CheckCircle2 } from 'lucide-react'
import { useTheme } from '../App'
import { MOCK_USER } from '../utils/mockData'

const inp = 'w-full px-3 py-2 bg-[var(--cm-surface)] border border-[var(--cm-border)] rounded-lg text-sm text-[var(--cm-text)] focus:outline-none focus:border-[var(--cm-muted)]'
const lbl = 'block text-xs font-medium text-[var(--cm-muted)] mb-1.5'

function Profile() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [user, setUser] = useState(MOCK_USER)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ name: user.name, email: user.email, college: user.college, department: user.department, semester: user.semester })

  const save = e => {
    e.preventDefault()
    setUser(prev => ({ ...prev, ...form, semester: Number(form.semester), avatarInitials: form.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) }))
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const pref = (icon, title, desc, right) => (
    <div className="flex items-center justify-between p-3.5 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)]">
      <div className="flex items-center gap-3">{icon}<div><p className="text-sm font-medium text-[var(--cm-text)]">{title}</p><p className="text-xs text-[var(--cm-muted)]">{desc}</p></div></div>
      {right}
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="border-b border-[var(--cm-border)] pb-5">
        <h1 className="text-2xl font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>Profile & Settings</h1>
        <p className="text-sm text-[var(--cm-muted)] mt-1">Manage your personal details, academic info and preferences.</p>
      </div>

      {saved && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={16} /> Profile updated successfully!
        </div>
      )}

      <div className="bg-[var(--cm-card)] rounded-lg border border-[var(--cm-border)] p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[var(--cm-border)]">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-[var(--cm-accent)] text-[var(--cm-accent-text)] text-xl font-bold flex items-center justify-center">{user.avatarInitials}</div>
            <div>
              <h2 className="text-lg font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>{user.name}</h2>
              <p className="text-xs text-[var(--cm-muted)] mt-0.5">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2.5 py-0.5 rounded bg-[var(--cm-secondary)] text-xs font-medium text-[var(--cm-text)]">Semester {user.semester}</span>
                <span className="px-2.5 py-0.5 rounded bg-[var(--cm-secondary)] text-xs font-medium text-[var(--cm-muted)]">{user.department}</span>
              </div>
            </div>
          </div>
          <button onClick={() => { setForm({ name: user.name, email: user.email, college: user.college, department: user.department, semester: user.semester }); setEditing(!editing) }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[var(--cm-border)] text-xs font-medium text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition-colors">
            <Edit2 size={13} /> {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {editing ? (
          <form onSubmit={save} className="pt-6 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--cm-text)]">Edit Student Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={lbl}>Full Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className={inp} /></div>
              <div><label className={lbl}>Email</label><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required className={inp} /></div>
              <div><label className={lbl}>College</label><input value={form.college} onChange={e => setForm(f => ({ ...f, college: e.target.value }))} required className={inp} /></div>
              <div><label className={lbl}>Department</label><input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} required className={inp} /></div>
              <div>
                <label className={lbl}>Semester</label>
                <select value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} className={inp}>
                  {[1,2,3,4,5,6,7,8,9,10].map(s => <option key={s} value={s}>Semester {s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg border border-[var(--cm-border)] text-xs font-medium text-[var(--cm-muted)] hover:bg-[var(--cm-secondary)]">Cancel</button>
              <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--cm-accent)] text-[var(--cm-accent-text)] rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"><Check size={14} /> Save Changes</button>
            </div>
          </form>
        ) : (
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {[['College', user.college], ['Department', user.department]].map(([label, val]) => (
              <div key={label} className="p-3 rounded-lg border border-[var(--cm-border)] bg-[var(--cm-surface)]">
                <span className="text-[var(--cm-muted)] block mb-1">{label}</span>
                <span className="font-semibold text-sm text-[var(--cm-text)]">{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[var(--cm-card)] rounded-lg border border-[var(--cm-border)] p-6 space-y-4">
        <h3 className="text-base font-semibold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>Preferences</h3>
        {pref(theme === 'dark' ? <Moon size={18} className="text-[var(--cm-text)]" /> : <Sun size={18} className="text-[var(--cm-text)]" />, 'Theme Mode', `Currently using ${theme} mode.`,
          <button onClick={toggleTheme} className="px-3.5 py-1.5 rounded-lg bg-[var(--cm-card)] border border-[var(--cm-border)] text-xs font-medium text-[var(--cm-text)] hover:bg-[var(--cm-secondary)] transition-colors">Switch to {theme === 'dark' ? 'Light' : 'Dark'}</button>
        )}
        {pref(<Bell size={18} className="text-[var(--cm-muted)]" />, 'In-App Notifications', 'Assignment reminders and event alerts are active.',
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Enabled</span>
        )}
      </div>

      <div className="bg-[var(--cm-card)] rounded-lg border border-[var(--cm-border)] p-6 space-y-4">
        <h3 className="text-base font-semibold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>Account Security</h3>
        {pref(<Shield size={18} className="text-[var(--cm-muted)]" />, 'Authentication Provider', 'Configured for Supabase Auth (Demo session active)',
          <button onClick={() => alert('Available after Supabase Auth is enabled.')} className="text-xs text-[var(--cm-text)] hover:underline font-medium">Change Password</button>
        )}
        <div className="pt-2">
          <button onClick={() => navigate('/login')} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold hover:opacity-90 transition-opacity">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}

export default Profile
