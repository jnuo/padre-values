# Profile Access Management

## Overview

Each profile (e.g., "Yüksel O.") can have multiple email addresses authorized to access it. When a user logs in with Google OAuth, their email is checked against the `profile_allowed_emails` table. If found, they get access. If not, they are rejected.

## Database Schema

### `profile_allowed_emails` table

| Column     | Type        | Description                                       |
| ---------- | ----------- | ------------------------------------------------- |
| id         | UUID        | Primary key                                       |
| profile_id | UUID        | References `profiles.id`                          |
| email      | TEXT        | Google email address (unique across all profiles) |
| created_at | TIMESTAMPTZ | When the binding was created                      |

**Constraint**: Each email can only be bound to ONE profile.

## Adding Email Access to a Profile

### Via SQL (Supabase SQL Editor)

```sql
-- First, find the profile ID
SELECT id, display_name FROM profiles;

-- Add an email to a profile
INSERT INTO profile_allowed_emails (profile_id, email)
VALUES ('PROFILE_UUID_HERE', 'user@gmail.com');

-- Add multiple emails at once
INSERT INTO profile_allowed_emails (profile_id, email) VALUES
  ('PROFILE_UUID_HERE', 'user1@gmail.com'),
  ('PROFILE_UUID_HERE', 'user2@gmail.com'),
  ('PROFILE_UUID_HERE', 'user3@gmail.com');
```

### Via Code (Node.js/TypeScript)

```typescript
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY, // Use service role key for admin operations
);

// Add single email
await supabase
  .from("profile_allowed_emails")
  .insert({ profile_id: "PROFILE_UUID", email: "user@gmail.com" });

// Add multiple emails
await supabase.from("profile_allowed_emails").insert([
  { profile_id: "PROFILE_UUID", email: "user1@gmail.com" },
  { profile_id: "PROFILE_UUID", email: "user2@gmail.com" },
]);
```

## Removing Email Access

```sql
DELETE FROM profile_allowed_emails WHERE email = 'user@gmail.com';
```

## Listing Allowed Emails for a Profile

```sql
SELECT email, created_at
FROM profile_allowed_emails
WHERE profile_id = 'PROFILE_UUID_HERE';
```

## Authentication Flow

1. User clicks "Google ile Giriş Yap" on login page
2. Google OAuth authenticates the user
3. Callback (`/auth/callback`) receives the auth code
4. Code is exchanged for a session
5. **Email check**: `check_email_allowed(email)` RPC is called
   - If email found in `profile_allowed_emails` → user proceeds to dashboard
   - If email NOT found → user is signed out, shown error "Bu e-posta adresi için erişim izni bulunamadı."
6. `claim_profile_by_email` links the user to the profile in `user_access` table

## Current Bindings

Profile: **Yüksel O.** (`3d599095-0885-47ef-a9bc-3800698610c1`)

- onurovalii@gmail.com
- hulyaovaliyil@gmail.com

## Google OAuth Test Users

If the OAuth app is in "Testing" mode, emails must also be added as test users:

1. Google Cloud Console → APIs & Services → OAuth consent screen
2. Scroll to "Test users" section
3. Click "Add users" and add the email addresses

## Future: Signup Flow

The signup flow will need to:

1. Create a new profile for the user
2. Add their email to `profile_allowed_emails`
3. Optionally allow profile owners to invite others by email

API endpoint idea:

```
POST /api/profile/invite
Body: { email: "newuser@gmail.com" }
```
