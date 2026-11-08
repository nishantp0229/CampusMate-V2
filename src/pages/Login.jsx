// src/pages/Login.jsx — Student login interface

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

function Login() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('') // clear error on typing
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Basic frontend validation
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    // Simulate login delay — this is mock frontend logic.
    // In Stage 3, this will call supabase.auth.signInWithPassword({ email, password })
    setTimeout(() => {
      setLoading(false)
      navigate('/dashboard')
    }, 800)
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] dark:bg-[#171A29] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="bg-white dark:bg-[#252A3C] rounded-2xl border border-[#E2E8F0] dark:border-white/[0.07] p-8 shadow-sm">

          {/* Logo & title */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#A9C9FF] flex items-center justify-center">
                <GraduationCap size={20} color="#fff" />
              </div>
            </Link>
            <h1 className="text-xl font-bold text-[#242B3A] dark:text-[#F1F1FC]"
              style={{ fontFamily: 'Poppins, sans-serif' }}>
              Welcome back
            </h1>
            <p className="text-xs text-[#737B8C] dark:text-[#A0A8B8] mt-1">
              Sign in to your CampusMate account
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC] mb-1.5">
                College Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737B8C]" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="arjun.mehta@dtu.ac.in"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] placeholder-[#737B8C] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50 focus:border-[#A9C9FF]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#242B3A] dark:text-[#F1F1FC]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert('Password reset will be available once Supabase Auth is connected.')}
                  className="text-xs text-[#5B9BF8] hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737B8C]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-9 py-2 bg-white dark:bg-[#171A29] border border-[#E2E8F0] dark:border-white/[0.1] rounded-xl text-sm text-[#242B3A] dark:text-[#F1F1FC] placeholder-[#737B8C] focus:outline-none focus:ring-2 focus:ring-[#A9C9FF]/50 focus:border-[#A9C9FF]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737B8C] hover:text-[#242B3A] dark:hover:text-[#F1F1FC]"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#A9C9FF] text-white font-medium text-sm rounded-xl hover:bg-[#8BB8F8] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-2 shadow-sm"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick login helper for testing */}
          <div className="mt-4 p-2.5 bg-[#F7F8FC] dark:bg-[#171A29] rounded-xl text-center">
            <p className="text-[11px] text-[#737B8C] dark:text-[#A0A8B8]">
              💡 <strong>Demo mode:</strong> Enter any valid email and 6+ char password to sign in.
            </p>
          </div>

          {/* Link to signup */}
          <p className="text-center text-xs text-[#737B8C] dark:text-[#A0A8B8] mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-[#5B9BF8] font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
