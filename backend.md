# backend.md

Backend architecture, APIs, database schema, and server-side patterns for Arao.

## Server Architecture

### Supabase Clients
Three client types based on permission level:

1. **`createSupabaseServerClient()`** — User-level access
   - Location: `lib/supabase/server.ts`
   - Uses: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Use: Server Components, route handlers with user auth
   - Limited by RLS (Row-Level Security) policies

2. **`createSupabaseAdminClient()`** — Admin-level access
   - Location: `lib/supabase/admin.ts`
   - Uses: `SUPABASE_SERVICE_ROLE_KEY`
   - Use: API routes requiring elevated permissions (role checks, direct writes)
   - Bypasses RLS — use carefully with auth checks

3. **`createSupabaseClient()`** — Browser-level access
   - Location: `lib/supabase/client.ts`
   - Uses: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Use: Browser client (deprecated, use server components instead)

## Database Schema

### Core Tables

**`profiles`** — User accounts (synced by login email)
```sql
id (uuid, pk)           -- Internal user ID (generated with randomUUID)
email (text, unique)    -- Email address
username (text)         -- Display name
phone (text)            -- Contact number
role (text)             -- 'user' | 'admin'
created_at (timestamp)  -- Account creation
```

**`inquiries`** — User consultations
```sql
id (uuid, pk)           -- Consultation ID
user_id (uuid, fk)      -- Profile ID
type (text)             -- 'consulting' | 'general'
title (text)            -- Consultation title
content (text)          -- Full content
status (text)           -- 'pending' | 'in_progress' | 'resolved' | 'closed'
created_at (timestamp)  -- Submission time
updated_at (timestamp)  -- Last modification
```

**`inquiry_replies`** — Admin responses
```sql
id (uuid, pk)           -- Reply ID
inquiry_id (uuid, fk)   -- Parent inquiry ID
user_id (uuid, fk)      -- Admin profile ID (who replied)
content (text)          -- Reply content
created_at (timestamp)  -- Reply time
```

**`landing_contents`** — Editable landing page content
```sql
id (text, pk)           -- 'main' (single record)
hero_title (text)       -- Hero section title
hero_subtitle (text)    -- Hero section subtitle
hero_image_url (text)   -- Hero image URL
before_after_items (jsonb) -- Array of {before_url, after_url, caption}
reviews (jsonb)         -- Array of {author, text, rating}
footer_content (text)   -- Footer text
updated_at (timestamp)  -- Last update
```

**Other Tables (stubs):**
- `products` — Product listings
- `orders` — User orders
- `order_items` — Order line items
- `payments` — Payment records

## API Endpoints

### User Endpoints

**`GET /api/account/consulting`**
- Query params: `type` (default: 'consulting'), `page`, `limit`
- Returns: User's consultations (auto-marks as read)
- Auth: User required

**`POST /api/account/consulting`**
- Body: `{ type, title, content }`
- Returns: Created inquiry object
- Auth: User required

**`GET /api/account/consulting/[id]`**
- Returns: Consultation detail with all replies (marks as read)
- Auth: User + owner verification

**`PATCH /api/account/consulting/[id]`**
- Body: `{ title?, content? }` or `{ status: 'closed' }`
- Restricts: Edit only if `status = 'pending'` (resolved/closed are read-only)
- Auth: User + owner verification

**`GET /api/account/notifications`**
- Returns: `{ unreadCount: number }`
- Auth: User required

**`POST /api/account/general`**
- Body: `{ username?, phone?, password? }`
- Updates user profile
- Auth: User required

### Admin Endpoints

**`GET /api/admin/consulting`**
- Query params: `type` ('consulting'|'general'|undefined), `status`, `page`, `limit`
- Returns: All user consultations with user profiles (JOIN)
- Auth: Admin required

**`GET /api/admin/consulting/[id]`**
- Returns: Consultation detail with all replies and user profile
- Auth: Admin required

**`POST /api/admin/consulting/[id]`**
- Body: `{ content }` (admin reply)
- Auto-updates: inquiry `status = 'in_progress'`
- Returns: Created reply
- Auth: Admin required

**`PATCH /api/admin/consulting/[id]`**
- Body: `{ status: 'pending'|'in_progress'|'resolved'|'closed' }`
- Updates consultation status
- Auth: Admin required

**`GET /api/admin/consulting/pending-count`**
- Returns: `{ count: number }` of `status = 'pending'` consultations
- Auth: Admin required

**`GET/PUT /api/admin/landing-content`**
- GET: Returns current landing content
- PUT: Body: landing content object
- Updates: `landing_contents` table (id='main')
- Auth: Admin required

### System Endpoints
**`GET /api/health`** — Server status check

## Database Operations

### Server Component Data Fetching
Using `lib/consulting.ts` functions:

```typescript
// Import functions
const { getInquiriesByProfile, getInquiryById, getAllInquiries } =
  await import('@/lib/consulting');

// Fetch user's consultations
const consultations = await getInquiriesByProfile(
  email: string,
  type: 'consulting'|'general'|undefined,
  page: number,
  limit: number
);

// Fetch single consultation (user view)
const inquiry = await getInquiryById(id, email);

// Fetch all consultations (admin view)
const allInquiries = await getAllInquiries(type?, status?, page?, limit?);

// Get consultation detail with replies
const inquiryWithReplies = await getInquiryByIdAdmin(id);
```

### API Route Patterns

**Auth + Admin Check Pattern:**
```typescript
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const user = await currentUser();
  const profile = await syncProfile({ email: user.emailAddresses[0].emailAddress });
  if (profile?.role !== 'admin')
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  // Admin-only operation
  const admin = createSupabaseAdminClient();
  await admin.from('inquiries').update({ status: 'resolved' });
}
```

**Dynamic Route (Next.js 16) Pattern:**
```typescript
// Next.js 16 requires params as Promise
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;  // Await params first
  // ... rest of logic
}
```

### Data Modification Examples

**Create Inquiry:**
```typescript
const admin = createSupabaseAdminClient();
await admin.from('inquiries').insert({
  user_id: profile.id, type: 'consulting', title, content, status: 'pending'
});
```

**Add Reply + Update Status:**
```typescript
const admin = createSupabaseAdminClient();
await admin.from('inquiry_replies').insert({ inquiry_id: id, user_id, content });
await admin.from('inquiries').update({ status: 'in_progress' }).eq('id', id);
```

**Update User Consultation:**
```typescript
const supabase = await createSupabaseServerClient();
await supabase.from('inquiries').update({ title, content }).eq('id', id);
```

## Key Server Functions

### Key Functions (lib/consulting.ts)

**Profile:** `syncProfile(email, fullName)` — Auto-create/update profile

**Queries:**
- `getInquiriesByProfile(email, type, page, limit)` — User's consultations
- `getAllInquiries(type, status, page, limit)` — Admin: all consultations (with JOIN)
- `getInquiryById(id, email)` — User view (verified ownership)
- `getInquiryByIdAdmin(id)` — Admin view (full details)

**Mutations:**
- `createInquiry()`, `createReply()`, `updateInquiryStatus()`, `updateInquiry()`

## Environment Setup

See `share.md` for required environment variables (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, CLERK keys).
Set in `.env.local` locally or Vercel project settings for production.

## Common Issues

**"Type is not assignable to Promise"** — Next.js 16 dynamic routes require `await params`
**Cache corruption** — Delete `.next` folder and restart dev server
**RLS policy violations** — Check Supabase RLS policies match auth requirements
