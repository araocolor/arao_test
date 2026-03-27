# claude.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository. See **frontend.md**, **backend.md**, and **share.md** for detailed specifications.

## Quick Start

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (localhost:3000)
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run linting
```

## Project Overview

**Arao** is a Next.js expansion architecture converting a static landing site into a full-stack service platform with user authentication, admin content management, and consultation/inquiry system with notifications.

- **Framework:** Next.js 16 (App Router)
- **Auth:** Clerk (session-based, 1-hour expiration)
- **Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (`landing-assets` bucket)
- **Payments:** PortOne, Stripe (currently stubs)
- **Deployment:** Vercel (auto-deploy from GitHub)
- **Language:** TypeScript
- **Status:** Production (https://arao-test-7gxt.vercel.app)

## Core Concepts

### Client-Server Architecture
- **Server Components:** Data fetching, auth checks, admin operations
- **Client Components:** Interactive UI with state management
- **API Routes:** Bridge for client operations requiring auth/permissions

### Authentication
- Users log in via Clerk (`/sign-in`, `/sign-up`)
- `syncProfile()` auto-creates Supabase profiles on first login
- Middleware protects `/admin`, `/account`, `/article` routes
- Admin role: `profiles.role = 'admin'` (Supabase table)

### Key Features
- User profile management
- Admin content/pricing editing
- 1:1 consultation system (create, reply, track status)
- Real-time notification badges (60s polling)
- Gallery with EXIF metadata

## Project Structure

```
app/              # Next.js App Router
├── api/          # API routes
├── admin/        # Admin pages
├── account/      # User pages
└── ...           # Public pages

components/       # React components
lib/              # Utilities (supabase, consulting, profiles)
hooks/            # React hooks (notification polling)
app/globals.css   # Global styles (500+ lines)
```

## Database Overview

**Core Tables:**
- `profiles` — User accounts (Clerk sync)
- `inquiries` — Consultations (type, status, content)
- `inquiry_replies` — Admin responses
- `landing_contents` — Editable content
- Commerce tables (stubs)

**Inquiry Status:** `pending` (red) → `in_progress` → `resolved` (blue) → `closed`

## Key Components

**Frontend:** `consulting-section`, `admin-dashboard`, `gallery-hero-item`, headers/footers
**Backend:** API routes for consulting, notifications, landing content
**Hooks:** `use-notification-count`, `use-admin-pending-count` (60s polling)

## Documentation

| File | Contains |
|------|----------|
| **claude.md** | This overview |
| **frontend.md** | Components, styling, client patterns |
| **backend.md** | APIs, database, server patterns |
| **share.md** | Routing, auth, workflows, deployment, preferences |
| **README.md** | Full project details |
| **START_CHECKLIST.md** | Completed/pending tasks |

## Before You Start

1. Read **share.md** for authentication and user preferences
2. Read **frontend.md** or **backend.md** based on your task
3. Run `npm run dev` to start development
4. Verify locally before pushing
