# Supabase authentication setup

CJNET PhotoDesk uses Supabase email/password authentication. There is no public registration page: create and activate each staff account manually.

## 1. Create the Supabase project

1. Create a Supabase project for CJNET.
2. In **Authentication → Providers → Email**, keep Email enabled.
3. Do not expose the service-role key in PhotoDesk or Vercel.

## 2. Apply the migration

Run these migrations in order in the Supabase SQL Editor, or apply them with the Supabase CLI:

1. [`202608130001_profiles_and_staff_auth.sql`](../supabase/migrations/202608130001_profiles_and_staff_auth.sql)
2. [`202608130002_customer_library.sql`](../supabase/migrations/202608130002_customer_library.sql)

The migration creates:

- `profiles` with `admin | staff`, an `active` flag, and RLS.
- A trigger that creates an inactive `staff` profile for every new Auth user.
- A reusable `is_active_staff()` database helper for later Customer Library policies.

The second migration creates the customer/photo tables, search indexes, active-staff RLS policies, and the private `customer-photos` Storage bucket. It limits uploads to JPG, PNG, and WebP files no larger than 20 MB.

New profiles are deliberately inactive. This prevents a newly created or accidentally invited account from entering the app until an administrator approves it.

## 3. Create the first administrator

1. Open **Authentication → Users → Add user → Create new user**.
2. Enter the staff email and password. Add `full_name` as user metadata if desired.
3. Copy the new user's UUID.
4. In the SQL Editor, run the following after replacing both values:

```sql
update public.profiles
set full_name = 'CJNET Administrator',
    role = 'admin',
    active = true
where id = 'USER_UUID_HERE';
```

For later staff accounts, create the Auth user the same way, then set `active = true`. Leave `role = 'staff'` unless the account genuinely needs administrator authority.

## 4. Configure local environment variables

Copy `.env.example` to `.env.local` and fill in the project's **Project URL** and **Publishable key** from **Project Settings → API**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Older Supabase projects may provide a legacy anon key. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a fallback. Never use the secret/service-role key in either variable.

Restart `npm run dev` after changing environment variables.

## 5. Verify access

1. Open `/app/template` in a signed-out private browser window. It must redirect to `/login`.
2. Try an invalid password. The page must show a generic login error.
3. Try a valid but inactive account. It must be signed out and denied access.
4. Sign in as the active administrator. `/app/template` must open and show the administrator's name and role.
5. Select **Sign out**. Returning to `/app/template` must redirect to `/login`.
6. Create a customer, upload a test photo, and choose **Use in Template**.
7. Copy the object's ordinary Storage URL without its signed token and open it in a private window. The private object must not load.

The server validates the Auth JWT and then checks the signed-in user's own RLS-protected `profiles` row. Hiding navigation is not used as authorization.

## 6. Configure Vercel

Add these variables to the Production, Preview, and Development environments as appropriate:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Redeploy after saving them. No service-role variable is required for this milestone.

## Security notes

- `/app/*` is guarded in both Next.js Proxy and the authenticated app layout.
- Proxy refreshes Supabase cookies; the layout independently verifies an active profile.
- RLS allows authenticated users to select only their own profile.
- The Customer Library uses `is_active_staff()` in every customer, photo, and Storage policy.
- Supabase Auth and profile checks require internet. An already loaded local Template Builder can continue its browser-only image and PDF work, but a fresh protected-page load requires authentication.
