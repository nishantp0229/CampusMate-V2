<div align="center">

# 🎓 CampusMate

### College life, a little less chaotic.

A unified collegiate platform for your classes, deadlines, campus events, lost items, study resources, student community, project teams, marketplace, and anonymous campus chats.

<br/>

<a href="https://campus-mate-v2.vercel.app/">
  <img src="https://img.shields.io/badge/EXPLORE%20CAMPUSMATE-Live%20Demo-6D5DFB?style=for-the-badge" alt="Explore CampusMate live"/>
</a>
<a href="https://github.com/nishantp0229/CampusMate-V2">
  <img src="https://img.shields.io/badge/GitHub-Source%20Code-24292F?style=for-the-badge&logo=github" alt="GitHub repository"/>
</a>

<br/><br/>

*Plan your week. Find your people. Buy & sell on campus. Connect freely.*

</div>

---

## 🏛️ System Architecture & Zero-Budget Policy

CampusMate is built under a **strict zero-budget development policy ($0 expenditure)**:
- **No paid APIs or recurring SaaS charges.**
- **No paid TURN providers or proprietary video infra.** Native browser WebRTC with public Google STUN fallbacks is utilized.
- **No custom VPS or external Node.js backend.** All backend operations, authorization, and data persistence execute entirely on the user's Supabase instance through PostgreSQL schemas, row-level security (RLS), and transactional `SECURITY DEFINER` RPCs.
- **Supabase Realtime** powers live messaging and friend notifications. CampusAnonymous video signaling uses server-validated RPCs.

> [!NOTE]
> **P2P Privacy Disclosure**: Because CampusMate operates on a zero-budget architecture without paid TURN relay servers, WebRTC connections in CampusAnonymous are direct peer-to-peer (P2P). This inherently involves exchanging candidate IP addresses between connecting browsers via STUN. Real database UUIDs, profile names, and personal student information are strictly hidden behind ephemeral aliases and alias-safe RPCs.

---

## 🚀 Application Modules

<table>
<tr>
<td width="50%" valign="top">

### 📅 Academic Planner & Attendance (Phase A.1)
- Weekly timetable scheduling with room and instructor tracking
- Coursework tasks with priority and due date filters
- Strict integer attendance meter against the mandatory 75% threshold
- Automatic sync with the Student Dashboard

</td>
<td width="50%" valign="top">

### 🎉 CampusConnect (Events)
- Student-organized workshops, hackathons, and fests
- Category filtering and external registration URLs
- Direct link with dashboard highlights
- Admin review and moderation panel

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🔎 CampusFind (Lost & Found)
- Interactive lost and found notices
- Campus area categorization and search
- Status tracking (`Lost`, `Found`, `Resolved`)
- Community resolution workflows

</td>
<td width="50%" valign="top">

### 📚 NoteNest (Resources)
- Academic repository organized by semester and subject
- Lecture notes, syllabus, lab manuals, and previous year papers
- Direct Google Drive/cloud links with validation

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 💬 CampusCommunity (Phases B & B.1)
- 5 public student channels with live broadcast
- Participant-scoped 1-on-1 private Direct Messaging
- Two-way Friend Request workflow with live badges
- Bidirectional blocking and message abuse reporting

</td>
<td width="50%" valign="top">

### 🤝 TeamUp (Phase C)
- Find teammates for hackathons, capstone projects, and study groups
- Team creation with role descriptions and required skills
- Concurrency-safe join requests serialized with database row locking
- Member capacity enforcement and application pitch review

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🛍️ CampusMarket (Phase D)
- Peer-to-peer campus marketplace for textbooks, electronics, and essentials
- Secure seller-isolated storage folders in private Supabase bucket
- Time-limited signed URL generation; each request rechecks Storage access
- After the separate image-privacy migration, access follows visible listings, upload ownership, or Market admin status; existing signed links remain bearer links until expiration
- In-app friend request integration to contact verified sellers
- Admin listing reports and moderation queue

</td>
<td width="50%" valign="top">

### 🎭 CampusAnonymous (Phase E)
- Full-screen (100vw × 100dvh) Omegle-style video & text chat
- Atomic matchmaking with PostgreSQL transaction locks (`FOR UPDATE SKIP LOCKED`)
- Complete UUID protection: alias-safe RPCs and zero client UUID leaks
- Mutual consent dual-handshake video calling via native WebRTC
- Evidence-preserving report & block mechanisms
- Message cleanup is proposed but disabled pending separate approval; a separate, approval-gated in-database job is proposed for signaling expiry

</td>
</tr>
</table>

---

## 🛠️ Tech Stack

<div align="center">

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![React Router](https://img.shields.io/badge/React_Router-7-CA4245?logo=reactrouter&logoColor=white)](https://reactrouter.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Lucide](https://img.shields.io/badge/Lucide_React-Icons-F56565?logo=lucide&logoColor=white)](https://lucide.dev/)

</div>

---

## ⚙️ Local Development Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- A [Supabase](https://supabase.com/) project (Free tier is fully supported)

### 2. Installation
```bash
git clone https://github.com/nishantp0229/CampusMate-V2.git
cd CampusMate-V2
npm install
```

### 3. Environment Variables
Create a `.env` file in the project root:
```env
# Required: Supabase Project Credentials
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-publishable-key

# Optional: Custom STUN/TURN servers (defaults to 5 public Google STUN servers)
# VITE_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"}]'
```

> [!CAUTION]
> Never expose your Supabase `service_role` secret key in client environment variables. Only the public `anon` key should ever be placed in `.env`.

### 4. Running the App
```bash
npm run dev
```
Navigate to `http://localhost:5173`.

---

## 🗄️ Database Migrations Checklist

Migrations are located in `database/`. Do not blindly rerun existing migrations.
The table below describes dependencies, not permission to execute them. For the
pending Market/Anonymous installation, follow `database/SECURITY_REVIEW.md` after
approval. The Market base script contains storage policy drops and must not be
run against existing policies.

| Step | Migration File | Description & Prerequisites |
|:---:|:---|:---|
| **1** | `database/schema.sql` | **Base Schema**: Core profiles, events, lost_found, resources, tasks, attendance, and timetables. |
| **2** | `database/migration_admin_academic.sql` | **Phase A**: `admin_users` registry, academic planner extensions, timetable schedules, and moderation audit trail. |
| **3** | `database/migration_campus_community.sql` | **Phase B**: CampusCommunity public channels, 1-on-1 private DMs, message reports, and participant-only RLS. |
| **4** | `database/migration_community_friends.sql` | **Phase B.1**: Friend requests, friendships, mutual blocking, and private Realtime notifications. |
| **5** | `database/migration_teamup.sql` | **Phase C**: TeamUp projects, hackathon groups, member capacity locks, and join application approvals. |
| **6** | `database/migration_campus_market.sql` | **Phase D**: CampusMarket listings, private storage bucket configuration, signed image access, and listing reports. |
| **7** | `database/migration_campus_market_completion.sql` | Market completion: additive, preflight-checked Storage policies and admin review RPC. |
| **8** | `database/migration_campus_anonymous.sql` | **Phase E**: CampusAnonymous alias-safe chat, validated signaling RPCs, and report evidence preservation; first install only. |

### Admin User Bootstrap
After running `migration_admin_academic.sql`, grant your account administrator privileges by running this query in the SQL Editor (replacing with your user UUID from **Authentication → Users**):
```sql
INSERT INTO public.admin_users (user_id)
VALUES ('<YOUR-AUTH-USER-UUID>'::uuid)
ON CONFLICT (user_id) DO NOTHING;
```

---

## 🧪 Testing Suite & Quality Assurance

Run the comprehensive unit test suite covering domain logic, formatting, and static SQL security contracts:
```bash
# Run local domain, static-contract, and mock tests (not database tests)
node --test src/lib/*.test.js

# Run code linter
npm run lint

# Production build verification
npm run build
```

---

## 👥 Multi-Account Manual Verification Guide

### 1. CampusCommunity & Friend Requests (2 Accounts)
1. Open Account A in Browser 1 (e.g. Chrome) and Account B in Browser 2 (e.g. Chrome Incognito).
2. Both navigate to `/community` and join the student directory.
3. In Account A, search for Account B's pseudonym and click **Add Friend**.
4. Observe real-time notification badge appear on Account B's friends tab without page refresh.
5. In Account B, click **Accept**. Verify both accounts show each other in their Friends list.
6. Open private DM between Account A and Account B. Send messages and verify bidirectional Realtime delivery.
7. Test blocking: In Account A, click **Block**. Verify private chat is locked and friendship is terminated.
8. With Account C (third observer), verify that Account C's client cannot read private DMs or friend requests.

### 2. TeamUp Concurrency & Capacity (3 Accounts)
1. Account A creates a new team with `max_members = 2` (Leader + 1 member).
2. Account B and Account C both apply to join the team with custom pitches.
3. Account A accepts Account B's application.
4. Verify Account B is added to team members and the team status automatically shifts to `Full`.
5. Verify that Account A attempting to accept Account C is safely rejected by database capacity locks.

### 3. CampusMarket Image Isolation & Seller Contact (2 Accounts)
1. Account A creates a listing with a uploaded item photo.
2. Verify image upload succeeds into folder `campus-market/<account-a-uuid>/<filename>`.
3. Account B views the marketplace listing. Verify image renders through secure signed URL.
4. Account B clicks **Contact Seller**.
5. If Account A and B are not yet friends, verify application triggers the friend request flow with a contextual message.
6. Account B reports the listing with a reason.
7. Admin account opens `/admin` → **CampusMarket** tab and reviews/dismisses the report or deletes the listing.

### 4. CampusAnonymous Omegle-Style Matchmaking & Video Call (2 Accounts)
1. Account A and Account B navigate to `/anonymous`. Both view the immersive 100vw × 100dvh interface.
2. Account A clicks **Start Chat**. Status changes to "Searching for a student partner...".
3. Account B clicks **Start Chat**. Matchmaking atomically connects them into an ephemeral room.
4. Both receive randomized anonymous aliases (e.g. "Anonymous Owl", "Anonymous Fox").
5. Both send inline text messages; verify participant-only Postgres Changes delivery.
6. Account A clicks **Start Video Call** (initiates request). Account B receives call request modal.
7. Account B clicks **Accept Video**. Native WebRTC dual-handshake negotiates candidates and both local and remote video streams render.
8. Account A clicks **Next Partner** or **Stop**. Room closes cleanly, media streams release, and UI resets.

---

<div align="center">

### Built for the everyday college experience. 🎓

**CampusMate Team** · Safe, Simple, Collaborative
</div>
