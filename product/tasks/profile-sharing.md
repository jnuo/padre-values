# Task: Profile Sharing & Access Management

**Status:** Todo
**Priority:** High
**Created:** 2026-02-03

---

## Problem

Users can't share profiles with family members. Current state:

- Profiles are created by one user
- No UI to invite others
- No way to manage who has access
- `user_access` table exists but no API/UI to use it

**Use cases:**

- Parent monitoring elderly parent's health (dad's results)
- Siblings collaborating on parent's care
- Spouses sharing personal health data
- Caregivers tracking patient results

---

## Solution: Simple Profile Sharing

### Core Concept

- **One owner per profile** — the person who created it
- **Owner can share by email** — grants viewer or editor access
- **Shared users see profile in their dashboard** — via profile switcher
- **No groups, no hierarchy** — just a flat list of people with access

### Access Levels

| Level  | View Data | Upload/Edit | Manage Access |
| ------ | --------- | ----------- | ------------- |
| Viewer | ✅        | ❌          | ❌            |
| Editor | ✅        | ✅          | ❌            |
| Owner  | ✅        | ✅          | ✅            |

---

## User Flow

### Sharing a Profile (Owner)

1. Go to Settings → Profile Access (new tab)
2. See list of people with access
3. Click "Invite" → enter email + choose access level
4. If email not in system → add to `profile_allowed_emails` (whitelist)
5. When invited user logs in → they see the profile in their dashboard

### Receiving Access (Invited User)

1. Get notified (email or just see it when they log in)
2. Log in with Google
3. Profile appears in profile switcher
4. Can view (or edit if editor) the shared profile

### Revoking Access (Owner)

1. Go to Settings → Profile Access
2. See list of people with access
3. Click "Remove" next to a user
4. User loses access immediately

---

## Technical Implementation

### Database

Already exists:

- `user_access` table (user_id, profile_id, access_level)
- `profile_allowed_emails` table (email whitelist)
- RLS policies for access control

No schema changes needed.

### API Routes (New)

```
GET    /api/profiles/[id]/access        → List who has access
POST   /api/profiles/[id]/access        → Grant access (email + level)
DELETE /api/profiles/[id]/access/[userId] → Revoke access
PUT    /api/profiles/[id]/access/[userId] → Change access level
```

### Frontend (New)

#### 1. Settings → Profile Access Tab

```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                                    │
├──────────┬──────────┬──────────────────────────────────────┤
│ Files    │ Access   │                                      │
├──────────┴──────────┴──────────────────────────────────────┤
│                                                             │
│ People with access to "Yüksel O."                          │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 👤 Onur Ovali                                           ││
│ │    onurovalii@gmail.com                                 ││
│ │    Owner                              [Cannot remove]   ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 👤 Hülya Ovalı                                          ││
│ │    hulyaovaliyil@gmail.com                              ││
│ │    [Viewer ▾]                         [Remove]          ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 👤 Olcay Ovalı                                          ││
│ │    ovaliolcay@yahoo.com                                 ││
│ │    [Editor ▾]                         [Remove]          ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│                              [+ Invite someone]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Invite Modal

```
┌─────────────────────────────────────────────────────────────┐
│ Invite someone to "Yüksel O."                          [X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Email address                                               │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ sister@gmail.com                                        ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Access level                                                │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Viewer ▾                                                ││
│ └─────────────────────────────────────────────────────────┘│
│   ○ Viewer — Can view data only                            │
│   ○ Editor — Can view and upload new reports               │
│                                                             │
│                                    [Cancel]  [Send Invite]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3. Profile Switcher Update

```
┌─────────────────────────────────────┐
│ ▾ Yüksel O.        (Owner)         │  ← Show access level
├─────────────────────────────────────┤
│   Yüksel O.        Owner     (12)  │
│   Onur O.          Owner     (3)   │
│   Ayşe H.          Viewer    (5)   │  ← Shared with you
├─────────────────────────────────────┤
│   + Add new profile                 │
└─────────────────────────────────────┘
```

#### 4. Dashboard Header (Optional)

For shared profiles, show who owns it:

```
Dashboard › Yüksel O. (shared by Onur Ovali)
```

---

## Edge Cases

### What if invited email isn't a user yet?

- Add to `profile_allowed_emails`
- When they sign up, auto-grant access via existing `signIn` callback

### What if owner tries to remove themselves?

- Block it. Owner can't remove self.
- To transfer ownership: not in MVP scope.

### What if user has access to 0 profiles?

- Show onboarding flow to create their own profile
- Already handled by existing `viziai_needs_onboarding` cookie

### What about public/private profiles?

- Not in scope. All profiles require explicit sharing.

---

## Out of Scope (Future)

- Family groups / teams
- Multiple owners per profile
- Ownership transfer
- Public profiles / share links
- Email notifications for invites
- Activity log (who did what)

---

## Success Metrics

- Users can share profiles with family members
- Shared users can view data without friction
- Owner has full control over access

---

## Implementation Phases

1. **API endpoints** — CRUD for access management
2. **Settings UI** — Profile Access tab with user list
3. **Invite flow** — Email input + access level selection
4. **Profile switcher update** — Show access level badge

---

## Files to Modify

**New:**

- `/web/src/app/api/profiles/[id]/access/route.ts` — Access management API
- `/web/src/app/settings/access/page.tsx` — Profile Access settings page
- `/web/src/components/invite-modal.tsx` — Invite user modal

**Modify:**

- `/web/src/components/profile-switcher.tsx` — Show access level
- `/web/src/app/settings/page.tsx` — Add "Access" tab
