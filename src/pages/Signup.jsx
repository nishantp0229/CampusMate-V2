// src/pages/Signup.jsx — Student registration interface

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

const inputCls = 'w-full pl-9 pr-3 py-2 bg-[var(--cm-surface)] border border-[var(--cm-border)] rounded-lg text-sm text-[var(--cm-text)] placeholder-[var(--cm-muted)] focus:outline-none focus:border-[var(--cm-muted)]'

function Signup() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.name.trim().length < 2) return setError('Please enter your full name.')
    if (!formData.email.includes('@')) return setError('Please enter a valid email address.')
    if (formData.password.length < 8) return setError('Password must be at least 8 characters long.')
    if (formData.password !== formData.confirmPassword) return setError('Passwords do not match.')

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      navigate('/dashboard')
    }, 800)
  }

  return (
    <div className="min-h-screen bg-[var(--cm-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-[var(--cm-card)] rounded-lg border border-[var(--cm-border)] p-8">
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[var(--cm-accent)] text-[var(--cm-accent-text)] flex items-center justify-center">
                <GraduationCap size={20} />
              </div>
            </Link>
            <h1 className="text-xl font-bold text-[var(--cm-text)]" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Create an account
            </h1>
            <p className="text-xs text-[var(--cm-muted)] mt-1">
              Join CampusMate and organize your college life
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[var(--cm-muted)] mb-1.5">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="Arjun Mehta" required className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--cm-muted)] mb-1.5">College Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="arjun.mehta@dtu.ac.in" required className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--cm-muted)] mb-1.5">
                Password <span className="font-normal">(min 8 characters)</span>
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                <input type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} placeholder="••••••••" required className={`${inputCls} pr-9`} />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)] hover:text-[var(--cm-text)]" aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--cm-muted)] mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cm-muted)]" />
                <input type={showPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" required className={inputCls} />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full py-2.5 bg-[var(--cm-accent)] text-[var(--cm-accent-text)] font-medium text-sm rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 mt-2">
              {loading ? <span>Creating account...</span> : <><span>Create Account</span><ArrowRight size={16} /></>}
            </button>
          </form>

          <p className="text-center text-xs text-[var(--cm-muted)] mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--cm-text)] font-medium hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup
