import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Compass, Menu, Pause, Play, X } from 'lucide-react'
import './Landing.css'

const image = (name) => `${import.meta.env.BASE_URL}landing/${name}.jpg`
const number = (index) => String(index + 1).padStart(2, '0')
const currentYear = new Date().getFullYear()

const heroSlides = [
  { image: 'architecture', label: 'A place to begin', detail: 'Campus architecture' },
  { image: 'students', label: 'Better together', detail: 'Student life' },
  { image: 'studying', label: 'Make space to learn', detail: 'Academics' },
  { image: 'workshop', label: 'Find your people', detail: 'Clubs & collaboration' },
  { image: 'event', label: 'Be part of the moment', detail: 'Events & culture' },
]

const tips = [
  'A little planning makes room for a lot more living.',
  'Check your timetable before the day gets going.',
  'Share the notes that helped you with someone else.',
  'Make time for a club, a conversation, or a coffee.',
  'Keep an eye on deadlines and event registrations.',
]

const modules = [
  {
    name: 'Dashboard', category: 'Your starting point', route: '/dashboard', image: 'module-dashboard',
    title: 'A clearer view of your day.',
    description: 'See the essentials at a glance, from your schedule and assignments to the things happening around campus.',
  },
  {
    name: 'Academic Planner', category: 'Make a little room', route: '/planner', image: 'module-planner',
    title: 'A plan for the busy days.',
    description: 'Keep your timetable and assignments together, so you can spend less time remembering and more time doing.',
  },
  {
    name: 'CampusConnect', category: 'Find your people', route: '/events', image: 'module-events',
    title: 'There’s more beyond class.',
    description: 'Explore student communities, campus events, and the activities that make college feel like yours.',
  },
  {
    name: 'CampusFind', category: 'Look out for each other', route: '/lost-found', image: 'module-lost-found',
    title: 'Lost things find their way.',
    description: 'Browse lost and found listings or share an item you’ve found with the campus community.',
  },
  {
    name: 'NoteNest', category: 'Better notes, together', route: '/resources', image: 'module-resources',
    title: 'Good notes travel further.',
    description: 'Find study resources and share useful materials with the people learning alongside you.',
  },
]

const spaces = [
  { name: 'Library & study spaces', image: 'library', alt: 'Shelves of books in a library', caption: 'For the quiet moments of focus.' },
  { name: 'Labs', image: 'lab', alt: 'Glassware on a laboratory table', caption: 'Where questions become experiments.' },
  { name: 'Student hangouts', image: 'hangout', alt: 'People gathered around a table for a meal', caption: 'The conversations between everything else.' },
  { name: 'Events', image: 'event', alt: 'A crowd enjoying a performance', caption: 'The moments worth showing up for.' },
  { name: 'Sports', image: 'sports', alt: 'A football player on a grass field', caption: 'A little movement, a lot of team spirit.' },
  { name: 'Campus architecture', image: 'architecture', alt: 'A university building across a green lawn', caption: 'A backdrop for everything that comes next.' },
]

const activities = [
  { category: '01 / COMMUNITY', title: 'Student clubs', text: 'Find the people who are into what you’re into.', image: 'students' },
  { category: '02 / MAKE', title: 'Hackathons', text: 'Bring an idea, build something, learn together.', image: 'workshop' },
  { category: '03 / CULTURE', title: 'Arts & culture', text: 'From the first rehearsal to the last encore.', image: 'culture' },
  { category: '04 / TOGETHER', title: 'Campus events', text: 'Make the most of the moments outside class.', image: 'event' },
]

const day = [
  { time: '8:30 AM', title: 'Check your timetable.', text: 'Start the morning knowing where you need to be.' },
  { time: '11:00 AM', title: 'Review assignments.', text: 'Give the important things a little head start.' },
  { time: '1:00 PM', title: 'Discover campus events.', text: 'Find something to look forward to after class.' },
  { time: '4:00 PM', title: 'Explore clubs.', text: 'Make time for new ideas and new people.' },
  { time: '7:00 PM', title: 'Find notes and prepare for tomorrow.', text: 'Wrap up today and make tomorrow feel lighter.' },
]

const signals = ['Plan assignments early.', 'Track attendance.', 'Join campus communities.', 'Share study resources.']
const flags = ['Missing deadlines.', 'Ignoring attendance.', 'Losing notes.', 'Missing event registrations.']

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

function ArrowButton({ direction, label, onClick }) {
  const Icon = direction === 'left' ? ArrowLeft : ArrowRight
  return <button className="landing-arrow" type="button" aria-label={label} onClick={onClick}><Icon size={19} /></button>
}

function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [heroIndex, setHeroIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [heroHovered, setHeroHovered] = useState(false)
  const [heroFocused, setHeroFocused] = useState(false)
  const [moduleIndex, setModuleIndex] = useState(0)
  const [spaceIndex, setSpaceIndex] = useState(0)
  const [activeActivity, setActiveActivity] = useState(0)
  const [focusedActivity, setFocusedActivity] = useState(null)
  const [timelineVisible, setTimelineVisible] = useState(() => !('IntersectionObserver' in window))
  const timelineRef = useRef(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  useEffect(() => {
    if (!playing || reducedMotion || heroHovered || heroFocused) return undefined
    const timer = window.setInterval(() => setHeroIndex((index) => (index + 1) % heroSlides.length), 6500)
    return () => window.clearInterval(timer)
  }, [playing, reducedMotion, heroHovered, heroFocused])

  useEffect(() => {
    if (!menuOpen) return undefined
    const close = (event) => { if (event.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])

  useEffect(() => {
    if (!('IntersectionObserver' in window) || reducedMotion) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimelineVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.1 })
    if (timelineRef.current) observer.observe(timelineRef.current)
    return () => observer.disconnect()
  }, [reducedMotion])

  const moveHero = (step) => {
    setHeroIndex((index) => (index + step + heroSlides.length) % heroSlides.length)
    setPlaying(false)
  }
  const moveModule = (step) => setModuleIndex((index) => (index + step + modules.length) % modules.length)
  const moveSpace = (step) => setSpaceIndex((index) => (index + step + spaces.length) % spaces.length)
  const currentModule = modules[moduleIndex]
  const currentSpace = spaces[spaceIndex]
  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="landing">
      <a className="landing-skip" href="#main-content">Skip to content</a>
      <header className={`landing-header ${scrolled ? 'is-scrolled' : ''} ${menuOpen ? 'menu-open' : ''}`}>
        <div className="landing-nav-wrap">
          <a href="#home" className="landing-brand" onClick={closeMenu} aria-label="CampusMate home">
            <span className="landing-brand-mark"><Compass size={23} strokeWidth={1.7} /></span>
            <span>CampusMate<small>MADE FOR CAMPUS LIFE</small></span>
          </a>
          <nav className="landing-desktop-nav" aria-label="Main navigation">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#campus-spaces">Campus Life</a>
            <a href="#explore">Explore</a>
          </nav>
          <div className="landing-nav-actions">
            <Link className="landing-signin" to="/login">Sign In</Link>
            <Link className="landing-nav-cta" to="/signup">Get Started <ArrowUpRight size={16} /></Link>
            <button className="landing-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="landing-mobile-nav" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="landing-mobile-nav" className="landing-mobile-nav" aria-label="Mobile navigation">
            <a href="#home" onClick={closeMenu}>Home</a>
            <a href="#features" onClick={closeMenu}>Features</a>
            <a href="#campus-spaces" onClick={closeMenu}>Campus Life</a>
            <a href="#explore" onClick={closeMenu}>Explore</a>
            <div><Link to="/login" onClick={closeMenu}>Sign In</Link><Link to="/signup" onClick={closeMenu}>Get Started <ArrowUpRight size={16} /></Link></div>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section id="home" className="landing-hero" aria-label="Campus life slideshow" aria-roledescription="carousel"
          onMouseEnter={() => setHeroHovered(true)} onMouseLeave={() => setHeroHovered(false)}
          onFocusCapture={() => setHeroFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHeroFocused(false) }}>
          <div className="landing-hero-images" aria-hidden="true">
            {heroSlides.map((slide, index) => (
              <img key={slide.image} className={index === heroIndex ? 'is-active' : ''} src={image(slide.image)} alt="" width="1600" height="1067" loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} />
            ))}
          </div>
          <div className="landing-hero-shade" />
          <div className="landing-container landing-hero-content">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow landing-eyebrow-light"><span /> YOUR COMPANION FOR COLLEGE LIFE</p>
              <h1>Make Every<br />Campus Day <em>Count.</em></h1>
              <p className="landing-hero-description">From your next assignment to your next campus adventure — everything you need, all in one place.</p>
              <div className="landing-hero-buttons">
                <a className="landing-button landing-button-light" href="#features">Explore CampusMate <ArrowDown size={17} /></a>
                <Link className="landing-button landing-button-outline" to="/signup">Get Started <ArrowUpRight size={17} /></Link>
              </div>
            </div>
            <div className="landing-hero-bottom">
              <div className="landing-hero-controls">
                <span className="landing-hero-count">{number(heroIndex)} <span>/ {number(heroSlides.length - 1)}</span></span>
                <div className="landing-hero-dots" aria-label="Choose a slide">
                  {heroSlides.map((slide, index) => <button key={slide.image} type="button" className={index === heroIndex ? 'is-active' : ''} aria-label={`Show slide ${index + 1}: ${slide.detail}`} aria-pressed={index === heroIndex} onClick={() => { setHeroIndex(index); setPlaying(false) }} />)}
                </div>
                <ArrowButton direction="left" label="Previous hero slide" onClick={() => moveHero(-1)} />
                <ArrowButton direction="right" label="Next hero slide" onClick={() => moveHero(1)} />
                {!reducedMotion && <button className="landing-play" type="button" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>}
              </div>
              <div className="landing-hero-caption"><span>THE CAMPUS EXPERIENCE / {number(heroIndex)}</span><strong>{heroSlides[heroIndex].label}</strong><small>Illustrative photography · Unsplash</small></div>
            </div>
          </div>
        </section>

        <div className="landing-ticker" aria-label="Campus Pulse student tips">
          <span className="landing-ticker-label"><span /> CAMPUS PULSE</span>
          <div className="landing-ticker-window" tabIndex="0" aria-label="Student tips. Focus to pause scrolling.">
            <div className="landing-ticker-track">
              {[0, 1].map((copy) => <div className="landing-ticker-group" key={copy} aria-hidden={copy === 1}>{tips.map((tip) => <span key={tip}>{tip}<b>✳</b></span>)}</div>)}
            </div>
          </div>
        </div>

        <section className="landing-intro landing-section">
          <div className="landing-container">
            <div className="landing-section-top"><p className="landing-eyebrow"><span /> A LITTLE LESS TO JUGGLE</p><span>01 / THE IDEA</span></div>
            <div className="landing-intro-grid">
              <h2>College Life Has<br /><em>Enough Chaos.</em></h2>
              <div className="landing-intro-copy">
                <span className="landing-intro-asterisk">✳</span>
                <p>Your schedule, events, notes and campus essentials shouldn’t add to it.</p>
                <p>CampusMate brings the everyday pieces together, leaving you more room for the moments that matter.</p>
                <a className="landing-text-link" href="#features">GET TO KNOW CAMPUSMATE <ArrowRight size={17} /></a>
              </div>
            </div>
            <div className="landing-intro-foot"><span>FOR THE CLASSES, THE COMMUNITIES & EVERYTHING IN BETWEEN.</span><span>MADE FOR YOUR EVERYDAY ↗</span></div>
          </div>
        </section>

        <section id="features" className="landing-modules landing-section">
          <div className="landing-container">
            <div className="landing-section-top"><p className="landing-eyebrow landing-eyebrow-light"><span /> THE CAMPUSMATE COLLECTION</p><span>02 / EXPLORE THE TOOLS</span></div>
            <div className="landing-heading-row">
              <h2>One place for<br /><em>your kind of day.</em></h2>
              <p>Five thoughtful spaces for the many moving parts of college life. Take a look around.</p>
            </div>
            <div className="landing-module-stage">
              <div className="landing-module-image">
                <div className="landing-preview-bar"><span><i /><i /><i /></span><span>CAMPUSMATE / {currentModule.name.toUpperCase()}</span><span>APP PREVIEW · DEMO DATA</span></div>
                <img key={currentModule.image} src={image(currentModule.image)} alt={`${currentModule.name} application preview with sample data`} width="1280" height="800" />
              </div>
              <div className="landing-module-info">
                <div className="landing-module-count"><strong>{number(moduleIndex)}</strong><span> / {number(modules.length - 1)}</span></div>
                <p className="landing-kicker">{currentModule.category}</p>
                <h3 key={currentModule.name}>{currentModule.title}</h3>
                <p>{currentModule.description}</p>
                <Link className="landing-text-link landing-text-link-light" to={currentModule.route}>EXPLORE {currentModule.name.toUpperCase()} <ArrowUpRight size={18} /></Link>
                <div className="landing-module-arrows"><ArrowButton direction="left" label="Previous module" onClick={() => moveModule(-1)} /><ArrowButton direction="right" label="Next module" onClick={() => moveModule(1)} /></div>
              </div>
            </div>
            <div className="landing-module-thumbs" aria-label="Choose a CampusMate module">
              {modules.map((module, index) => (
                <button key={module.name} type="button" className={index === moduleIndex ? 'is-active' : ''} aria-pressed={index === moduleIndex} onClick={() => setModuleIndex(index)}>
                  <img src={image(module.image)} alt="" width="1280" height="800" loading="lazy" /><span><small>{number(index)}</small>{module.name}</span>
                </button>
              ))}
            </div>
            <p className="landing-preview-note">A LOOK INSIDE THE APP · PREVIEWS SHOW EXAMPLE DATA</p>
          </div>
        </section>

        <section id="campus-spaces" className="landing-campus landing-section">
          <div className="landing-container">
            <div className="landing-section-top"><p className="landing-eyebrow"><span /> THE WORLD AROUND YOU</p><span>03 / CAMPUS LIFE</span></div>
            <div className="landing-heading-row landing-campus-heading">
              <h2>More than a<br /><em>place to study.</em></h2>
              <p>The places, people, and in-between moments are all part of the story. Here’s to making the most of them.</p>
            </div>
            <div className="landing-campus-stage">
              <div className="landing-campus-photo">
                <img key={currentSpace.image} src={image(currentSpace.image)} alt={currentSpace.alt} width="1600" height="1067" loading="lazy" />
                <div className="landing-photo-caption"><span>THE SPACES IN BETWEEN / {number(spaceIndex)}</span><h3>{currentSpace.name}</h3><p>{currentSpace.caption}</p></div>
              </div>
              <div className="landing-campus-aside">
                <span className="landing-large-number">{number(spaceIndex)}<small> / {number(spaces.length - 1)}</small></span>
                <div><p className="landing-kicker">A LITTLE LOOK AROUND</p><h3>Life happens<br /><em>everywhere.</em></h3><p>From a quiet corner to a crowded room, every day has its own rhythm.</p></div>
                <div className="landing-campus-arrows"><ArrowButton direction="left" label="Previous campus photo" onClick={() => moveSpace(-1)} /><ArrowButton direction="right" label="Next campus photo" onClick={() => moveSpace(1)} /></div>
              </div>
            </div>
            <div className="landing-space-thumbs" aria-label="Choose a campus life photograph">
              {spaces.map((space, index) => <button key={space.name} type="button" className={index === spaceIndex ? 'is-active' : ''} aria-pressed={index === spaceIndex} onClick={() => setSpaceIndex(index)}><img src={image(space.image)} alt="" width="1600" height="1067" loading="lazy" /><span>{space.name}</span></button>)}
            </div>
            <p className="landing-image-note">IMAGERY IS ILLUSTRATIVE AND DOES NOT DEPICT A SPECIFIC CAMPUS.</p>
          </div>
        </section>

        <section id="explore" className="landing-connect landing-section">
          <div className="landing-container">
            <div className="landing-section-top"><p className="landing-eyebrow landing-eyebrow-light"><span /> CAMPUSCONNECT</p><span>04 / FIND YOUR PEOPLE</span></div>
            <div className="landing-heading-row">
              <h2>There’s a place<br /><em>for your thing.</em></h2>
              <div><p>Good ideas, new friends, unexpected passions. It all starts with showing up.</p><Link className="landing-text-link landing-text-link-light" to="/events">EXPLORE EVENTS <ArrowUpRight size={18} /></Link></div>
            </div>
            <div className="landing-activities" aria-label="Explore campus activities">
              {activities.map((activity, index) => (
                <Link key={activity.title} to="/events" className={`landing-activity ${index === (focusedActivity ?? activeActivity) ? 'is-active' : ''}`} onMouseEnter={() => setActiveActivity(index)} onFocus={() => setFocusedActivity(index)} onBlur={() => setFocusedActivity(null)}>
                  <img src={image(activity.image)} alt="" width="1600" height="1067" loading="lazy" />
                  <span className="landing-activity-content"><small>{activity.category}</small><strong>{activity.title}</strong><span>{activity.text}</span></span>
                  <span className="landing-activity-arrow"><ArrowUpRight size={19} /></span>
                </Link>
              ))}
            </div>
            <div className="landing-connect-foot"><span>CURIOUS IS A GOOD PLACE TO START.</span><span>CLUBS / CULTURE / COMMUNITY</span></div>
          </div>
        </section>

        <section id="how-it-works" className="landing-day landing-section">
          <div className="landing-container">
            <div className="landing-section-top"><p className="landing-eyebrow"><span /> A DAY WITH CAMPUSMATE</p><span>05 / THE DAILY RHYTHM</span></div>
            <div className="landing-day-grid">
              <div className="landing-day-story">
                <h2>For the day<br /><em>in front of you.</em></h2>
                <p>Every day looks a little different. Here’s one way CampusMate can come along for the ride.</p>
                <div className="landing-day-photo"><img src={image('studying')} alt="Students studying together around a table" width="1600" height="1067" loading="lazy" /><span>THE LITTLE MOMENTS<br /><strong>make the whole story.</strong></span></div>
              </div>
              <div ref={timelineRef} className={`landing-timeline ${timelineVisible ? 'is-visible' : ''}`}>
                {day.map((item, index) => <div className="landing-timeline-row" key={item.time} style={{ '--step': index }}><span className="landing-time">{item.time}</span><span className="landing-timeline-dot" /><div><h3>{item.title}</h3><p>{item.text}</p></div></div>)}
                <div className="landing-timeline-end">AND THEN, DO IT YOUR WAY AGAIN TOMORROW. ↗</div>
              </div>
            </div>
          </div>
        </section>

        <section id="survival-kit" className="landing-survival landing-section">
          <div className="landing-container">
            <div className="landing-section-top"><p className="landing-eyebrow"><span /> THE STUDENT SURVIVAL KIT</p><span>06 / A LITTLE HEADS-UP</span></div>
            <div className="landing-heading-row"><h2>A little advice<br /><em>for the road.</em></h2><p>Small habits can make a big difference. Keep the good ones close and the other ones in check.</p></div>
            <div className="landing-survival-grid">
              <article className="landing-signal landing-signal-green"><div className="landing-signal-top"><span>THE GOOD HABITS</span><span>01 — 04</span></div><h3>Green<br /><em>Signals.</em></h3><p>A few things future-you will thank you for.</p><ul>{signals.map((item, index) => <li key={item}><span>{number(index)}</span>{item}<b>↗</b></li>)}</ul></article>
              <article className="landing-signal landing-signal-red"><div className="landing-signal-top"><span>THINGS TO WATCH</span><span>01 — 04</span></div><h3>Red<br /><em>Flags.</em></h3><p>The little things that can sneak up on you.</p><ul>{flags.map((item, index) => <li key={item}><span>{number(index)}</span>{item}<b>↗</b></li>)}</ul></article>
            </div>
          </div>
        </section>

        <section className="landing-final">
          <div className="landing-final-image"><img src={image('architecture')} alt="" width="1600" height="1067" loading="lazy" /></div>
          <div className="landing-container landing-final-content"><p className="landing-eyebrow landing-eyebrow-light"><span /> YOUR NEXT CHAPTER AWAITS</p><h2>Your Campus Story<br /><em>Starts Here.</em></h2><p>There’s a lot ahead. Let’s make a little more of every day.</p><div><Link className="landing-button landing-button-light" to="/signup">Get Started <ArrowUpRight size={17} /></Link><a className="landing-button landing-button-outline" href="#features">Explore Features <ArrowRight size={17} /></a></div></div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-grid">
            <div className="landing-footer-brand"><a href="#home" className="landing-brand"><span className="landing-brand-mark"><Compass size={23} strokeWidth={1.7} /></span><span>CampusMate<small>MADE FOR CAMPUS LIFE</small></span></a><p>A little more organised.<br />A lot more campus life.</p></div>
            <div><h3>EXPLORE</h3><a href="#features">Features</a><a href="#campus-spaces">Campus Life</a><a href="#explore">CampusConnect</a><a href="#survival-kit">Survival Kit</a></div>
            <div><h3>THE MODULES</h3><Link to="/dashboard">Dashboard</Link><Link to="/planner">Academic Planner</Link><Link to="/events">CampusConnect</Link><Link to="/lost-found">CampusFind</Link><Link to="/resources">NoteNest</Link></div>
            <div><h3>THE PROJECT</h3><Link to="/login">Sign In</Link><Link to="/signup">Get Started</Link><a href="https://github.com/nishantp0229/CampusMate-V2" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={14} /></a><a href="https://unsplash.com/" target="_blank" rel="noreferrer">Illustrative photos: Unsplash <ArrowUpRight size={14} /></a></div>
          </div>
          <div className="landing-footer-bottom"><span>© {currentYear} CAMPUSMATE. BUILT FOR STUDENT LIFE.</span><a href="#home">BACK TO THE TOP ↑</a></div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
