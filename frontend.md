# frontend.md

Frontend architecture, components, styling, and client-side patterns for Arao.

## Components

### User-Facing Components
- **`consulting-section.tsx`** — User consultation interface (create, list, detail, edit)
  - Modes: create, list, detail, edit
  - Status: pending (editable), resolved (read-only)
  - Displays unread reply badges

- **`user-dashboard.tsx`** — Wraps consulting section with auth checks
  - Fetches user profile and consultations server-side
  - Passes data to ConsultingSection

- **`gallery-hero-item.tsx`** — Gallery image card
  - Displays EXIF metadata (camera, aperture, ISO, etc.)
  - Caption editing
  - Image aspect ratio dropdown

### Admin Components
- **`admin-consulting-manager.tsx`** — Full consultation management
  - List all user consultations with filters (type, status)
  - Detail view with reply form
  - Status color badges
  - Filter: type (`consulting` | `general`), status

- **`admin-dashboard.tsx`** — Admin hub
  - Sidebar navigation
  - Integrates: content manager, pricing manager, consulting manager
  - Notification badge (pending count)

- **`admin-content-manager.tsx`** — Landing content editor
  - Hero section (title, subtitle, image)
  - Before/After comparison
  - Reviews section
  - Footer content
  - CRUD operations to `landing_contents` table

- **`admin-pricing-manager.tsx`** — Pricing table editor
  - Edit pricing tiers
  - Save to database

### Shared Components
- **`site-header.tsx`** — Main navigation (authenticated users)
  - Navigation links
  - Profile menu with logout
  - Notification badge

- **`landing-page-header.tsx`** — Landing pages navigation
  - Logo, menu links, CTA buttons
  - Mobile hamburger menu
  - No notification badge (public)

- **`landing-page-footer.tsx`** — Footer (all pages)
  - Company info, links, social
  - Contact information

- **`header-profile-link.tsx`** — Profile icon with badge
  - Shows notification count (red badge)
  - User: unread replies count
  - Admin: pending consultations count
  - Polling every 60 seconds

## Hooks

### Polling Hooks
- **`use-notification-count.ts`** — User unread reply count
  - Polls `/api/account/notifications` every 60 seconds
  - Skips polls when tab is hidden
  - Refreshes on tab focus
  - Returns: `{ count, loading, error }`

- **`use-admin-pending-count.ts`** — Admin pending consultation count
  - Polls `/api/admin/consulting/pending-count` every 60 seconds
  - Skips polls when tab is hidden
  - Refreshes on tab focus
  - Returns: `{ count, loading, error }`

### Pattern: Tab Focus Detection
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // Refetch when tab becomes visible
      fetchData();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

## Styling & CSS

### Global Styles
- File: `app/globals.css`
- 500+ lines of consultation-specific styles
- Tailwind conventions

### Status Badges
```css
.consulting-status-pending { background: #EF4444; color: white; }     /* Red */
.consulting-status-progress { background: #3B82F6; color: white; }    /* Blue */
.consulting-status-resolved { background: #3B82F6; color: white; }    /* Blue */
.consulting-status-closed { background: #9CA3AF; color: white; }      /* Gray */
.consulting-item-badge { background: #FBBF24; }                       /* Yellow "답변 있음" */
```

### Button Styles
```css
.consulting-btn-group { display: flex; gap: 8px; }
.consulting-btn-edit { background: #3B82F6; }
.consulting-btn-close { background: #EF4444; }
```

### Admin Lists
```css
.admin-consulting-list { display: grid; }
.admin-consulting-item { border: 1px solid #E5E7EB; padding: 16px; }
```

## Responsive Design

### Design Constraints
- **Mobile-first approach** — Baseline design for mobile phones
- **Tablet support** — iPad and similar tablets (~1024px max-width)
- **No separate desktop layout** — Desktop uses tablet layout
- **Breakpoint:** 1024px (tablet/desktop threshold)

### Layout Principles
- Hamburger menu for navigation on mobile
- Single column for mobile, multi-column for tablet
- Touch-friendly buttons and spacing
- Full viewport width on mobile, constrained on tablet

### Media Query Example
```css
@media (max-width: 1024px) {
  /* Tablet/Desktop styles */
}
```

## Client-Side Patterns

### "use client" Pattern
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useNotificationCount } from '@/hooks/use-notification-count';

export default function ConsultingSection() {
  const [message, setMessage] = useState<string | null>(null);
  const { count } = useNotificationCount();

  // Component logic
}
```

### State Management
- Use `useState` for local component state
- Use custom hooks for shared state (notification counts)
- Clear message state on navigation/tab changes
- Use `setMessage(null)` on view switches

### Message Display Pattern
- Display success/error messages
- Auto-clear after user action
- Clear on navigation:
```typescript
const handleTabClick = (tab: string) => {
  setCurrentTab(tab);
  setMessage(null);  // Clear on tab change
};
```

### Form Handling
- Title and content validation required
- Disabled submit button during loading
- Show success message after submission
- Display error messages on failure

## Server Components Integration

### Data Fetching
Server components fetch data, pass to client components:
```typescript
// Server Component (app/account/page.tsx)
export default async function AccountPage() {
  const consultations = await getInquiriesByProfile(email);
  return <ConsultingSection initialData={consultations} />;
}
```

### Auth Checks in Server Components
```typescript
const user = await currentUser();
const profile = await syncProfile({ email: user.emailAddresses[0].emailAddress });
if (!profile) return <NotFound />;
```

## Common UI Patterns

### Status Badge Display
```typescript
const statusColors: Record<Inquiry['status'], string> = {
  pending: 'consulting-status-pending',
  in_progress: 'consulting-status-progress',
  resolved: 'consulting-status-resolved',
  closed: 'consulting-status-closed',
};
```

### List Item with Metadata
- Title, subtitle, date, status in grid layout
- Hover effects for interactivity
- Badge for additional info (replies, status)

### Detail View
- Full consultation content
- Reply section with form
- Status change options (admin only)
- Edit/close buttons (users only, if pending)

## Testing & Debugging

- **No console debugging** — User preference, analyze code instead
- **Test locally:** `npm run dev` before pushing
- **Build check:** `npm run build`
- **Linting:** `npm run lint`
