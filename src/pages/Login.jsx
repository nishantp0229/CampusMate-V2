import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Compass, Eye, EyeOff, Moon, Sun, X } from 'lucide-react'
import { useTheme } from '../App'
import './Auth.css'

const photo = (name) => `${import.meta.env.BASE_URL}landing/${name}.jpg`
const currentYear = new Date().getFullYear()

function Field({ id, label, type = 'text', value, onChange, placeholder, autoComplete, inputRef, autoFocus, aside, onToggle, visible }) {
  return (
    <div className="cm-auth-field">
      <div className="cm-auth-label-row">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      <div className={`cm-auth-input-wrap ${onToggle ? 'has-toggle' : ''}`}>
        <input id={id} ref={inputRef} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} autoFocus={autoFocus} required />
        {onToggle && <button type="button" className="cm-auth-password-toggle" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
      </div>
    </div>
  )
}

function SignInForm({ prefix, data, setData, visible, setVisible, error, loading, onSubmit, onForgot, emailRef }) {
  return (
    <form className="cm-auth-form" onSubmit={onSubmit}>
      <div className="cm-auth-form-heading">
        <p className="cm-auth-eyebrow"><span /> YOUR EVERYDAY, ALL IN ONE PLACE</p>
        <h1>Good to see<br /><em>you again.</em></h1>
        <p>Sign in and pick up right where your campus day left off.</p>
      </div>
      {error && <p className="cm-auth-error" role="alert">{error}</p>}
      <Field id={`${prefix}-login-email`} label="University email" type="email" value={data.email} onChange={(email) => setData({ ...data, email })} placeholder="you@university.edu" autoComplete="email" inputRef={emailRef} />
      <Field id={`${prefix}-login-password`} label="Password" type={visible ? 'text' : 'password'} value={data.password} onChange={(password) => setData({ ...data, password })} placeholder="Enter your password" autoComplete="current-password" visible={visible} onToggle={() => setVisible(!visible)} aside={<button type="button" className="cm-auth-text-button" onClick={onForgot}>Forgot password?</button>} />
      <button className="cm-auth-submit" type="submit" disabled={loading}>{loading ? 'Signing in...' : <>Sign In <ArrowRight size={17} /></>}</button>
      <p className="cm-auth-demo"><strong>Demo mode.</strong> Use any valid email and a password of at least 6 characters.</p>
    </form>
  )
}

function SignUpForm({ prefix, data, setData, visible, setVisible, error, loading, onSubmit, nameRef }) {
  return (
    <form className="cm-auth-form cm-auth-signup-form" onSubmit={onSubmit}>
      <div className="cm-auth-form-heading">
        <p className="cm-auth-eyebrow"><span /> A LITTLE MORE CAMPUS LIFE</p>
        <h1>Let’s get<br /><em>you started.</em></h1>
        <p>Make a little more room for everything that matters.</p>
      </div>
      {error && <p className="cm-auth-error" role="alert">{error}</p>}
      <Field id={`${prefix}-signup-name`} label="Full name" value={data.name} onChange={(name) => setData({ ...data, name })} placeholder="Your full name" autoComplete="name" inputRef={nameRef} />
      <Field id={`${prefix}-signup-email`} label="University email" type="email" value={data.email} onChange={(email) => setData({ ...data, email })} placeholder="you@university.edu" autoComplete="email" />
      <div className="cm-auth-passwords">
        <Field id={`${prefix}-signup-password`} label="Password" type={visible ? 'text' : 'password'} value={data.password} onChange={(password) => setData({ ...data, password })} placeholder="8+ chars" autoComplete="new-password" visible={visible} onToggle={() => setVisible(!visible)} />
        <Field id={`${prefix}-signup-confirm`} label="Confirm password" type={visible ? 'text' : 'password'} value={data.confirmPassword} onChange={(confirmPassword) => setData({ ...data, confirmPassword })} placeholder="Repeat password" autoComplete="new-password" />
      </div>
      <button className="cm-auth-submit" type="submit" disabled={loading}>{loading ? 'Getting started...' : <>Create Account <ArrowRight size={17} /></>}</button>
      <p className="cm-auth-demo"><strong>Demo mode.</strong> This form previews the experience; no account is created.</p>
    </form>
  )
}

function PhotoPanel({ mode, onSwitch, active }) {
  const isWelcome = mode === 'welcome'
  return (
    <div className={`cm-auth-photo-panel ${isWelcome ? 'cm-auth-photo-left' : 'cm-auth-photo-right'}`} aria-hidden={!active} inert={!active}>
      <img src={photo(isWelcome ? 'students' : 'architecture')} alt="" width="1600" height="1067" />
      <div className="cm-auth-photo-content">
        <p className="cm-auth-eyebrow"><span /> {isWelcome ? 'THE STORY CONTINUES' : 'YOUR NEXT CHAPTER AWAITS'}</p>
        <h2>{isWelcome ? <>There’s more<br />to <em>your story.</em></> : <>Your campus<br />story <em>starts here.</em></>}</h2>
        <p>{isWelcome ? 'Your notes, plans, and campus moments are right where you left them.' : 'For the classes, the communities, and everything in between.'}</p>
        <button className="cm-auth-photo-button" type="button" onClick={onSwitch}>{isWelcome ? 'Sign In Instead' : 'Create an Account'} <ArrowUpRight size={17} /></button>
      </div>
      <div className="cm-auth-photo-footer"><span>{isWelcome ? '02' : '01'} / 02 &nbsp; · &nbsp; CAMPUSMATE</span><span>ILLUSTRATIVE PHOTO</span></div>
    </div>
  )
}

export function AuthCard({ initialSignUp = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const [isSignUp, setIsSignUp] = useState(() => location.pathname === '/signup' || initialSignUp)
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [signupData, setSignupData] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const desktopLoginRef = useRef(null)
  const desktopSignupRef = useRef(null)
  const mobileLoginRef = useRef(null)
  const mobileSignupRef = useRef(null)
  const focusAfterSwitch = useRef(false)
  const previousFocus = useRef(null)
  const closeDialogRef = useRef(null)
  const authTimer = useRef(null)
  const forgotTimer = useRef(null)

  useEffect(() => {
    if (!focusAfterSwitch.current) return
    const mobile = window.matchMedia('(max-width: 767px)').matches
    const input = isSignUp ? (mobile ? mobileSignupRef : desktopSignupRef) : (mobile ? mobileLoginRef : desktopLoginRef)
    input.current?.focus({ preventScroll: true })
    focusAfterSwitch.current = false
  }, [isSignUp])

  useEffect(() => () => {
    window.clearTimeout(authTimer.current)
    window.clearTimeout(forgotTimer.current)
  }, [])

  useEffect(() => {
    if (forgotSent) closeDialogRef.current?.focus()
  }, [forgotSent])

  const switchMode = (signUp) => {
    if (signUp === isSignUp) return
    focusAfterSwitch.current = true
    setError('')
    setIsSignUp(signUp)
  }

  const handleLoginSubmit = (event) => {
    event.preventDefault()
    setError('')
    if (!loginData.email.trim() || !loginData.email.includes('@')) return setError('Please enter a valid university email address.')
    if (loginData.password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true)
    authTimer.current = window.setTimeout(() => { setLoading(false); navigate('/dashboard') }, 700)
  }

  const handleSignupSubmit = (event) => {
    event.preventDefault()
    setError('')
    if (signupData.name.trim().length < 2) return setError('Please enter your full legal name.')
    if (!signupData.email.trim() || !signupData.email.includes('@')) return setError('Please enter a valid university email address.')
    if (signupData.password.length < 8) return setError('Password must be at least 8 characters long.')
    if (signupData.password !== signupData.confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    authTimer.current = window.setTimeout(() => { setLoading(false); navigate('/dashboard') }, 700)
  }

  const openForgot = () => {
    previousFocus.current = document.activeElement
    setForgotOpen(true)
  }
  const closeForgot = () => {
    window.clearTimeout(forgotTimer.current)
    setForgotOpen(false)
    setForgotSent(false)
    window.requestAnimationFrame(() => previousFocus.current?.focus())
  }
  const handleForgotSubmit = (event) => {
    event.preventDefault()
    if (!forgotEmail || !forgotEmail.includes('@')) return
    setForgotSent(true)
    forgotTimer.current = window.setTimeout(() => { setForgotEmail(''); closeForgot() }, 2200)
  }
  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') closeForgot()
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled)')
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  const loginProps = { data: loginData, setData: setLoginData, visible: showLoginPassword, setVisible: setShowLoginPassword, error: !isSignUp ? error : '', loading, onSubmit: handleLoginSubmit, onForgot: openForgot }
  const signupProps = { data: signupData, setData: setSignupData, visible: showSignupPassword, setVisible: setShowSignupPassword, error: isSignUp ? error : '', loading, onSubmit: handleSignupSubmit }

  return (
    <div className={`cm-auth ${theme === 'dark' ? 'is-dark' : ''}`}>
      <header className="cm-auth-header">
        <Link to="/" className="cm-auth-brand" aria-label="CampusMate home">
          <span className="cm-auth-brand-mark"><Compass size={23} strokeWidth={1.7} /></span>
          <span>CampusMate<small>MADE FOR CAMPUS LIFE</small></span>
        </Link>
        <div className="cm-auth-header-actions">
          <button type="button" className="cm-auth-theme" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
          <Link className="cm-auth-back" to="/"><ArrowLeft size={16} /> <span>Back to CampusMate</span></Link>
        </div>
      </header>

      <main className="cm-auth-main">
        <div className={`cm-auth-desktop ${isSignUp ? 'is-signup' : ''}`}>
          <div className="cm-auth-panel cm-auth-signin" aria-hidden={isSignUp} inert={isSignUp}>
            <SignInForm {...loginProps} prefix="desktop" emailRef={desktopLoginRef} />
          </div>
          <div className="cm-auth-panel cm-auth-signup" aria-hidden={!isSignUp} inert={!isSignUp}>
            <SignUpForm {...signupProps} prefix="desktop" nameRef={desktopSignupRef} />
          </div>
          <div className="cm-auth-overlay-window">
            <div className="cm-auth-overlay">
              <PhotoPanel mode="welcome" active={isSignUp} onSwitch={() => switchMode(false)} />
              <PhotoPanel mode="start" active={!isSignUp} onSwitch={() => switchMode(true)} />
            </div>
          </div>
        </div>

        <div className={`cm-auth-mobile ${isSignUp ? 'is-signup' : ''}`}>
          <div className="cm-auth-mobile-visual">
            <img src={photo('architecture')} alt="" width="1600" height="1067" />
            <div><p className="cm-auth-eyebrow"><span /> YOUR NEXT CHAPTER AWAITS</p><p>A little more organised.<br /><em>A lot more campus life.</em></p></div>
          </div>
          <div className="cm-auth-mobile-tabs" aria-label="Choose sign in or sign up">
            <span aria-hidden="true" />
            <button type="button" aria-pressed={!isSignUp} onClick={() => switchMode(false)}>Sign In</button>
            <button type="button" aria-pressed={isSignUp} onClick={() => switchMode(true)}>Sign Up</button>
          </div>
          <div className="cm-auth-mobile-window">
            <div className="cm-auth-mobile-track">
              <div className="cm-auth-mobile-panel" aria-hidden={isSignUp} inert={isSignUp}><SignInForm {...loginProps} prefix="mobile" emailRef={mobileLoginRef} /></div>
              <div className="cm-auth-mobile-panel" aria-hidden={!isSignUp} inert={!isSignUp}><SignUpForm {...signupProps} prefix="mobile" nameRef={mobileSignupRef} /></div>
            </div>
          </div>
          <p className="cm-auth-mobile-credit">ILLUSTRATIVE PHOTO · UNSPLASH</p>
        </div>
      </main>

      <footer className="cm-auth-footer"><span>© {currentYear} CAMPUSMATE · BUILT FOR STUDENT LIFE</span><span>FOR THE DAYS THAT BECOME YOUR STORY.</span></footer>

      {forgotOpen && (
        <div className="cm-auth-modal-backdrop">
          <div className="cm-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title" onKeyDown={handleDialogKeyDown}>
            <button ref={closeDialogRef} className="cm-auth-dialog-close" type="button" onClick={closeForgot} aria-label="Close password reset"><X size={20} /></button>
            <p className="cm-auth-eyebrow"><span /> A LITTLE HELP</p>
            <h2 id="reset-title">Reset your<br /><em>password.</em></h2>
            <p>This is a demo. Enter an email to preview the reset flow; no email will be sent.</p>
            {forgotSent ? <div className="cm-auth-confirmation" role="status"><Check size={18} /> Demo request received. No email was sent.</div> : (
              <form onSubmit={handleForgotSubmit}>
                <Field id="reset-email" label="University email" type="email" value={forgotEmail} onChange={setForgotEmail} placeholder="you@university.edu" autoComplete="email" autoFocus />
                <button className="cm-auth-submit" type="submit">Continue <ArrowRight size={17} /></button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Login() {
  return <AuthCard initialSignUp={false} />
}

export default Login
