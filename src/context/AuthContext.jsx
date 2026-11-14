// src/context/AuthContext.jsx — Real Supabase Authentication & Student Profile Provider
import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(supabase))
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState(null)

  // Cache refs to prevent redundant fetches and infinite loops
  const profileUserIdRef = useRef(null)
  const isFetchingProfileRef = useRef(false)

  // ── 1. Fetch user profile from public.profiles (stable, deduplicated) ──
  const fetchProfile = useCallback(async (userId, userMetadata = null, force = false) => {
    if (!supabase || !userId) {
      setProfile(null)
      profileUserIdRef.current = null
      return null
    }

    // Skip redundant fetch if already loaded for this user and not forced
    if (!force && profileUserIdRef.current === userId) {
      return null
    }

    // Skip if another fetch is currently in-flight
    if (isFetchingProfileRef.current) {
      return null
    }

    isFetchingProfileRef.current = true
    try {
      setProfileLoading(true)
      setProfileError(null)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('[CampusMate] Error fetching profile:', error.message)
        setProfileError(error.message)
        return null
      }

      if (data) {
        profileUserIdRef.current = userId
        setProfile(data)
        return data
      }

      // If profile row doesn't exist yet, create it safely with auth metadata
      const fallbackName =
        userMetadata?.full_name?.trim() ||
        userMetadata?.name?.trim() ||
        'Student'

      const { data: created, error: insertError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          full_name: fallbackName,
        })
        .select()
        .maybeSingle()

      if (insertError) {
        console.warn('[CampusMate] Could not auto-create profile:', insertError.message)
      } else if (created) {
        profileUserIdRef.current = userId
        setProfile(created)
        return created
      }

      return null
    } catch (err) {
      console.error('[CampusMate] Exception fetching profile:', err)
      setProfileError(err.message || 'Failed to load profile')
      return null
    } finally {
      isFetchingProfileRef.current = false
      setProfileLoading(false)
    }
  }, [])

  // ── 2. Initialize session & listen to auth changes (ONCE on mount) ────
  useEffect(() => {
    if (!supabase) return

    let isMounted = true

    // Check active session on initial load
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession }, error }) => {
        if (!isMounted) return
        if (error) {
          console.error('[CampusMate] Error getting initial session:', error.message)
        }
        setSession(currentSession)
        const currentUser = currentSession?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          fetchProfile(currentUser.id, currentUser.user_metadata)
        }
      })
      .catch((err) => {
        console.error('[CampusMate] Session check exception:', err)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    // Listen to real-time auth state updates (stable singleton subscription)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return

      // Don't refetch or trigger re-render cascades on background token refresh
      if (event === 'TOKEN_REFRESHED') {
        setSession(currentSession)
        return
      }

      setSession(currentSession)
      const currentUser = currentSession?.user ?? null
      setUser(currentUser)
      setLoading(false)

      if (currentUser) {
        fetchProfile(currentUser.id, currentUser.user_metadata)
      } else {
        profileUserIdRef.current = null
        setProfile(null)
        setProfileError(null)
      }
    })

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [fetchProfile])

  // ── 3. Update profile fields ───────────────────────────────
  const updateProfile = async (updates) => {
    if (!supabase) throw new Error('Supabase client is not configured.')
    if (!user) throw new Error('No authenticated user found.')

    setProfileError(null)

    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[CampusMate] Error updating profile:', error.message)
      setProfileError(error.message)
      throw error
    }

    if (data) {
      profileUserIdRef.current = user.id
      setProfile(data)
    }
    return data
  }

  // ── 4. Refresh profile manually ────────────────────────────
  const refreshProfile = useCallback(() => {
    if (user?.id) {
      return fetchProfile(user.id, user.user_metadata, true)
    }
    return Promise.resolve(null)
  }, [user, fetchProfile])

  // ── 5. Auth operations ─────────────────────────────────────
  const signIn = async (email, password) => {
    if (!supabase) throw new Error('Supabase client is not configured.')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const signUp = async (email, password, fullName) => {
    if (!supabase) throw new Error('Supabase client is not configured.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          name: fullName,
        },
      },
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[CampusMate] Sign out error:', error.message)
      throw error
    }
    profileUserIdRef.current = null
    setSession(null)
    setUser(null)
    setProfile(null)
  }

  const resetPassword = async (email) => {
    if (!supabase) throw new Error('Supabase client is not configured.')
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) throw error
    return data
  }

  // ── 6. Derived student identity values ─────────────────────
  const studentName = useMemo(() => {
    const raw =
      profile?.full_name?.trim() ||
      user?.user_metadata?.full_name?.trim() ||
      user?.user_metadata?.name?.trim()
    return raw || 'Student'
  }, [profile?.full_name, user?.user_metadata])

  const studentInitials = useMemo(() => {
    if (!studentName) return 'ST'
    const parts = studentName.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'ST'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }, [studentName])

  const studentEmail = user?.email || ''
  const studentCollege = profile?.college || 'University Campus'
  const studentDepartment = profile?.department || 'Undergraduate Department'
  const studentSemester = profile?.semester ?? 1

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        profileLoading,
        profileError,
        studentName,
        studentInitials,
        studentEmail,
        studentCollege,
        studentDepartment,
        studentSemester,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
