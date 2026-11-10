# CampusMate 🎓

CampusMate is an all-in-one college companion web application built to help university students manage their daily academic and campus life. It brings together daily schedules, assignments, campus events, lost-and-found recovery, and peer-shared study resources into a unified, easy-to-use interface.

---

## 🌟 Features & Modules

### 1. Landing Page (`/`)
- University welcome page inspired by collegiate portals like Campus Compass.
- **Campus Pulse Ticker:** A live scrolling announcement strip for daily notices, library timings, and reminders.
- **Hero Photography Carousel:** Featured slides showcasing campus life, fests, study vaults, and key academic milestones.
- **Campus Spaces Gallery:** Horizontal preview of student hangouts and facilities (libraries, computing labs, amphitheatres, and sports grounds).
- **Senior Survival Kit:** Practical advice for first-year students, highlighting essential habits (*Green Signals*) and common mistakes to avoid (*Red Flags*).
- **Interactive Module Showcase:** Tabbed preview of core modules before signing in.

### 2. Sign In & Registration (`/login`, `/signup`)
- Sliding split-container authentication interface inspired by Florin Pop's double slider design.
- Smooth transitions between **Sign In** and **Sign Up** forms.
- Form validation for university email, password matching, and registration details.
- **Forgot Password Modal:** Interactive modal with confirmation messaging.
- **Quick Demo Access:** One-click button to jump straight into the dashboard without registration.
- Mobile-friendly segmented tab switcher for smaller screens.

### 3. Campus Dashboard (`/dashboard`)
- Central overview for student day-to-day activities.
- **Hero Highlights:** Carousel linking directly to current campus events, study vaults, and planner sprints.
- **Today's Class Schedule:** Sequential timeline showing class timings, room numbers, subjects, and current active lecture.
- **75% Attendance Safeguard:** Interactive calculator to track attended vs. total classes and verify safety margins before exams.
- **Assignment Sprint:** Quick checklist of pending course deliverables with priority tags and completion toggles.
- **Campus Spaces & Recent Listings:** Previews of campus spots, recent lost-and-found items, and upcoming fests.

### 4. Academic Planner (`/planner`)
- **Weekly Timetable:** Complete Monday through Sunday class schedule with period timings, course titles, and room locations.
- **Interactive Day Selector:** Switch between days with an indicator for the current weekday.
- **Assignments Manager:** Filter assignments by status (*All*, *Pending*, *Completed*) or subject, with priority badges (*High*, *Medium*, *Low*).
- **Add Assignment:** Modal dialog to record new tasks with due date, subject, and priority.

### 5. CampusConnect — Events & Clubs (`/events`)
- **Student Societies & Clubs:** Showcase cards for flagship student organizations (ACM Chapter, AI/ML Club, Cultural Council, Sports Council) with member counts.
- **Freshman Pathway:** A 4-step visual guide outlining how club recruitment works from orientation to selection.
- **Events Board:** Browse hackathons, workshops, cultural nights, and athletic tournaments.
- **Filters & Search:** Filter events by category (*Academic*, *Cultural*, *Technical*, *Sports*) or keyword.
- **RSVP Tracking:** Real-time counter showing attending peers with an interactive "Going" toggle.
- **Post an Event:** Modal form allowing student organizers to announce new events and workshops.

### 6. CampusFind — Lost & Found (`/lost-found`)
- Marketplace-style image grid for reporting and recovering misplaced items on campus.
- **Status Tabs:** Quickly view *All*, *Lost*, *Found*, *Saved*, or *Resolved* listings.
- **Location & Category Filters:** Narrow down by campus area (*Library*, *Canteen*, *Hostel*, *Labs*, *Auditorium*) or item type (*Electronics*, *Accessories*, *Documents*, *Books*).
- **Listing Details Modal:** View full item photos, detailed descriptions, reporter info, and date found/lost.
- **Action Buttons:** Send notification to reporter ("I Found This Item") or mark the item as returned.
- **Post an Item:** Submission modal with image upload preview (or category-based placeholder), location tag, and description.

### 7. NoteNest — Study Vault (`/resources`)
- Peer-to-peer academic resource repository organized for quick exam revision.
- **Semester Filter:** Navigate study material across Semesters 1 through 8.
- **Format Filter:** Filter by material type (*PDF Notes*, *Web Links*, *Video Tutorials*, *Handwritten Notes*).
- **Subject Shortcuts:** Quick filters for core courses such as DBMS, DSA, Operating Systems, Machine Learning, and Computer Networks.
- **Resource Cards:** Direct access links to lecture slides, question papers (PYQs), and contributor attribution.
- **Upload Resource:** Modal form to share new notes, external drive links, and study sheets.

### 8. Student Profile & Settings (`/profile`)
- **Student Passport:** Academic profile displaying department, semester, college, and calculated CGPA.
- **Profile Editor:** Edit student name, email, department, and semester with in-app confirmation.
- **Theme Switcher:** Toggle between Dark Theme and Light Theme (persisted in `localStorage`).
- **Notification Preferences:** Enable or disable campus alerts and reminders.

### 9. Global Navigation & Search
- **Global Search:** Accessible from the top navigation bar, searching across assignments, events, lost-and-found items, and study notes simultaneously with live grouped results.
- **Notification Center:** Quick preview dropdown for upcoming deadlines and announcements.
- **Error Boundary:** Built-in crash protection that catches unexpected rendering issues and provides a recovery button.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | [React 19](https://react.dev/) | Component-based user interface |
| **Build Tool & Dev Server** | [Vite 8](https://vite.dev/) | Fast development server and production bundler |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Modern utility-first styling with custom CSS theme variables |
| **Routing** | [React Router v7](https://reactrouter.com/) | Client-side routing and layout management |
| **Icons** | [Lucide React](https://lucide.dev/) | Clean, accessible SVG iconography |
| **Linter** | [Oxlint](https://oxc.rs/) | High-performance JavaScript/JSX linter |
| **Optional Backend Ready** | `@supabase/supabase-js` | Client configuration stub and SQL schema provided for future backend integration |

---

## 📁 Project Structure

```
CampusMate/
├── database/
│   └── schema.sql             # SQL schema template for future PostgreSQL / Supabase setup
├── public/
│   ├── favicon.svg            # CampusMate app icon
│   └── icons.svg
├── src/
│   ├── assets/                # Local images and graphic assets
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx  # Authenticated shell (combines Sidebar and Topbar)
│   │   │   ├── Sidebar.jsx    # Left navigation menu for desktop and mobile
│   │   │   └── Topbar.jsx     # Breadcrumb, global search, notifications, theme toggle
│   │   └── ui/
│   │       ├── Badge.jsx      # Status and priority badges
│   │       ├── EmptyState.jsx # Fallback display for empty lists
│   │       ├── ErrorBoundary.jsx # Friendly crash recovery wrapper
│   │       └── Modal.jsx      # Reusable accessible dialog component
│   ├── lib/
│   │   └── supabase.js        # Optional Supabase client configuration
│   ├── pages/
│   │   ├── Dashboard.jsx      # Main student dashboard
│   │   ├── Events.jsx         # CampusConnect events and clubs
│   │   ├── Landing.jsx        # Public university landing page
│   │   ├── Login.jsx          # Sliding authentication page
│   │   ├── LostFound.jsx      # CampusFind lost & found marketplace
│   │   ├── NotFound.jsx       # 404 page
│   │   ├── Planner.jsx        # Academic planner & timetable
│   │   ├── Profile.jsx        # Student passport and settings
│   │   ├── Resources.jsx      # NoteNest study notes vault
│   │   └── Signup.jsx         # Registration page (shares sliding auth container)
│   ├── styles/
│   │   └── index.css          # Tailwind CSS imports, theme variables, and keyframe animations
│   ├── utils/
│   │   └── mockData.js        # Sample data for classes, tasks, events, and notes
│   ├── App.jsx                # Route definitions and global theme context provider
│   └── main.jsx               # Application entry point mounting to DOM
├── .env.example               # Template for optional Supabase environment variables
├── .gitignore
├── .oxlintrc.json             # Linter configuration
├── index.html                 # HTML entry point
├── package.json               # Project scripts and dependencies
└── vite.config.js             # Vite configuration with React and Tailwind plugins
```

---

## 🚀 Getting Started

Follow these steps to run CampusMate locally on your computer.

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x or higher recommended)
- `npm` (bundled with Node.js)

### 1. Clone the repository

```bash
git clone https://github.com/nishantp0229/CampusMate-V2.git
cd CampusMate-V2
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

After starting, Vite will display the local URL in your terminal (typically **http://localhost:5173**). Open this link in your browser to explore the app.

> **Note:** The current version of CampusMate runs entirely client-side using sample mock data and local React state. **No external database or account setup is required to run and test the application.**

---

## 🔧 Environment Variables (Optional)

The project includes an optional `.env.example` file for developers who wish to connect a live Supabase backend in the future:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

If these variables are omitted, the app continues to run in standalone demo mode with built-in mock data without throwing errors.

---

## 📜 Available Scripts

In the project directory, you can run:

| Command | Description |
|---|---|
| `npm run dev` | Runs the app in development mode with hot module replacement (HMR) |
| `npm run build` | Compiles and bundles production-ready files into the `dist/` directory |
| `npm run preview` | Locally serves the production build for testing |
| `npm run lint` | Runs the Oxlint linter across project files to check for errors |

---

## 🎨 Theme Support

CampusMate features built-in **Light** and **Dark** themes with custom collegiate colour palettes (Crimson and Gold accents with high-contrast text). The theme preference is automatically saved to your browser's `localStorage` and will persist across reloads. You can toggle the theme anytime using the Moon/Sun icon in the navigation bar.

---

## 📄 License & Academic Note

This project is developed as an academic college project to demonstrate modern frontend engineering with React, Vite, and Tailwind CSS. Feel free to use it for learning or extend it with your own university modules!
