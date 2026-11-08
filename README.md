# CampusMate 🎓

> Your all-in-one college companion — tasks, events, notes, lost & found in one place.

---

## 📋 Modules

| Module | Description |
|---|---|
| **Dashboard** | Overview of tasks, events, resources and lost & found |
| **Academic Planner** | Manage assignments, due dates and priorities |
| **CampusConnect** | College events, workshops and hackathons |
| **CampusFind** | Lost and found item board |
| **NoteNest** | Study notes and resource links organized by subject |

---

## 🛠 Tech Stack

- **React 19** + **Vite 8** — fast development and builds
- **Tailwind CSS v4** — utility-first styling
- **React Router v7** — client-side routing
- **Supabase** — PostgreSQL database, authentication and file storage
- **Lucide React** — consistent outline icons

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- A free [Supabase](https://supabase.com) account

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/campusmate.git
cd campusmate
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
# Copy the example file
copy .env.example .env
```

Open `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
```

**Where to find these values:**
1. Go to [supabase.com](https://supabase.com) → open your project
2. Left sidebar → **Project Settings** → **Data API**
3. Copy **Project URL** and the **anon public** key

### 4. Set up the database

1. In your Supabase project, go to **SQL Editor**
2. Open the file `database/schema.sql` from this project
3. Paste the entire contents into the SQL Editor and click **Run**

This creates all the tables, row-level security policies and indexes.

### 5. Run the development server

```bash
npm run dev
```

The app will open at **http://localhost:5173**

---

## 📁 Project Structure

```
CampusMate/
├── public/
│   └── assets/            # Static assets (images, icons)
├── src/
│   ├── components/
│   │   ├── layout/        # Navbar, Sidebar, page wrappers
│   │   └── ui/            # Reusable UI: Button, Card, Badge, Modal...
│   ├── pages/             # One file per page/module
│   ├── services/          # All Supabase database operations
│   ├── lib/               # Supabase client configuration
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Helper functions (dates, formatting...)
│   └── styles/            # Global CSS and Tailwind configuration
├── database/
│   └── schema.sql         # Full database schema (run once in Supabase)
├── .env.example           # Environment variable template
├── .gitignore
└── README.md
```

---

## 👥 Teamwork Guide

We recommend splitting work by module:

| Developer | Modules |
|---|---|
| Developer 1 | Dashboard, Academic Planner |
| Developer 2 | CampusConnect, CampusFind, NoteNest |

**Branch strategy:**
```bash
# Each feature gets its own branch
git checkout -b feature/academic-planner
git checkout -b feature/campusconnect

# Never commit directly to main
# Open a Pull Request to merge completed features
```

---

## 📝 Available Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |

---

## 🔐 Security Notes

- The `.env` file is in `.gitignore` — it will **never** be committed
- Only the Supabase **anon key** is used in the frontend — this is safe
- Row Level Security (RLS) is enabled on all tables — users can only access their own data
- Never put the **service-role key** anywhere in this codebase

---

## 📄 License

MIT — free to use for academic and personal projects.
