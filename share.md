# share.md

Shared information: routing, authentication, development workflow, deployment, and user preferences.

## Route Structure

### Public Routes (No auth required)
- `/` — Home page (hero, before/after, reviews, pricing)
- `/arao` — About/introduction page
- `/gallery` — Image gallery (read-only, no EXIF editor)
- `/pricing` — Pricing table
- `/manual` — User guide
- `/sign-in` — Clerk login page
- `/sign-up` — Clerk signup page

### Protected Routes (Auth required)
- `/account` — User profile settings (username, phone, password)
- `/account/withdraw` — Account deletion (UI only, not implemented)
- `/admin` — Admin dashboard (content, pricing, consulting management)
- `/article` — 1:1 consultation list (admin only)

**Middleware:** `middleware.ts` protects `/admin`, `/account`, `/article` routes using `clerkMiddleware()`

## Authentication & Authorization

### Authentication Flow
1. User clicks sign in → Clerk `/sign-in` page
2. After login, Clerk sets session
3. Server components call `await auth()` to get `userId`
4. `syncProfile()` auto-creates Supabase profile
5. User can access protected routes

### Authorization Pattern
**Role-Based Access Control (RBAC):**
- Admin role: `profiles.role = 'admin'` (manually set in Supabase)
- Users without admin role cannot access `/admin` or `/article`
- Server components verify: `if (profile?.role !== 'admin') return <Forbidden />`

### Setting Admin Role
1. Create user via `/sign-up`
2. Go to Supabase → `profiles` table
3. Find user by email
4. Update `role` column from 'user' to 'admin'
5. User gains admin access on next page load/login

## Development Workflow

### Before Starting
1. Read **frontend.md** or **backend.md** for your task
2. Check memory system for user feedback/preferences: `.claude/projects/*/memory/MEMORY.md`
3. Review recent commits: `git log`

### Important Patterns

**Dynamic Routes (Next.js 16):**
```typescript
async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;  // Must await!
  // ... rest of code
}
```

**Clerk + Supabase in API Route:**
```typescript
const { userId } = await auth();
if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

const user = await currentUser();
const profile = await syncProfile({ email: user.emailAddresses[0].emailAddress });
```

**Polling Notifications:**
- User: 60-second interval for unread replies
- Admin: 60-second interval for pending consultations
- Skip polling when tab is hidden
- Refresh on tab focus

**Clearing Messages on Navigation:**
```typescript
const handleTabClick = (tab: string) => {
  setCurrentTab(tab);
  setMessage(null);  // Always clear on navigation
};

const handleCreateClick = () => {
  setMode('create');
  setMessage(null);  // Always clear on mode change
};
```

### Testing & Debugging
- **No console debugging** — User finds difficult; analyze code instead
- **Test locally:** `npm run dev` before committing
- **Build check:** `npm run build` before pushing
- **Linting:** `npm run lint`

## Committing Changes

### Commit Message Pattern
User instruction: "XXX로 올려" (bring up XXX)
- Means: Use "XXX" as commit message
- Example: "1:1 상담시스템 올려" → commit message: "1:1 상담시스템"

### Permission Required
- **Always request user permission** before committing/pushing
- User preference: "커밋/푸시는 반드시 사용자 허락 후에만 진행"
- Do NOT commit during active development ("빌드 커밋 하지 마세요")

### Commit Format
```bash
git commit -m "your message" -m "Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>"
```

## Environment Variables

### Required for Development
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=[clerk-key]
CLERK_SECRET_KEY=[clerk-secret]
```

### Optional (Payment stubs)
```
PORTONE_API_SECRET=
PORTONE_STORE_ID=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Setup
- **Local:** Create `.env.local` in project root
- **Production:** Set in Vercel project environment variables
- **Example:** Copy from `.env.example`

## User Preferences & Constraints

### Language & Communication
- User communicates in **Korean**
- Grammar lesson: "~게" = user will do, "~려" = command to assistant
- Avoid verbose explanations; be concise
- Respond naturally in Korean when user speaks Korean

### Development Practices
- **Mobile-first design** — Design for mobile/tablet first (see `project_device_target.md`)
- **No separate desktop layout** — Desktop uses same layout as tablet
- **Tablet breakpoint:** 1024px
- **Edit files** over creating new ones (prevent bloat)
- **No premature abstractions** — Write minimum code for task
- **Test locally** before pushing to Vercel

### Code Quality
- Don't add unnecessary comments, type annotations, or error handling
- Don't use feature flags for simple changes
- Don't create utilities for one-time operations
- Trust framework guarantees; validate only at system boundaries

### Session Management
- Session expiration: 1 hour (see `project_session_auth.md`)
- Middleware enforces auth checks

## Deployment

### Vercel (Production)
- **Auto-deploy:** Push to `main` branch → auto-deploys
- **URL:** https://arao-test-7gxt.vercel.app
- **GitHub:** https://github.com/araocolor/arao_test

### Pre-Deployment Checklist
```bash
npm run build      # Test build locally
npm run start      # Test production server
npm run lint       # Check for lint errors
```

### Troubleshooting
- **Build fails locally but works in Vercel:** Check `.next` cache (delete and retry)
- **Cache issues on Vercel:** Hard refresh browser or use dev tools cache clearing
- **Env vars not set:** Check Vercel project settings

### Admin Account Setup (Production)
1. User signs up via `/sign-up`
2. Go to Vercel or local Supabase dashboard
3. Find user in `profiles` table
4. Change `role` to 'admin'

## Design Constraints

### Mobile-First
- Baseline design for mobile phones
- Responsive up to 1024px (tablet)
- No additional desktop-specific layout
- Touch-friendly buttons/spacing

### Consultation System
- Types: 'consulting' | 'general'
- Status flow: pending → in_progress → resolved → closed
- Pending: editable by user, red badge "답변대기중"
- Resolved: read-only, blue badge "답변완료"
- Admin can always reply/change status

### EXIF Metadata
- Gallery displays 6 EXIF fields (camera, lens, aperture, shutter, ISO, white balance)
- Stored in single JSON field in database
- Users can edit EXIF in admin gallery management

## Known Limitations (Stubs)

- PortOne real payment not connected
- Stripe real payment not connected
- Account withdrawal logic not implemented
- Orders/sales/member management UIs not connected
- Commerce tables created but unused

## Documentation References

- **claude.md** — Project overview and quick start
- **frontend.md** — UI components and styling
- **backend.md** — APIs and database
- **README.md** — Full project details
- **START_CHECKLIST.md** — Completed and pending tasks
- **Memory Index** — User feedback and preferences

## Quick Command Reference

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Build for production
npm run start        # Start production server (after build)
npm run lint         # Check code quality
git log              # See recent commits
```
