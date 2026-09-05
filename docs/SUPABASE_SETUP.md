# Supabase setup

Slice 1 of the SaaS build: authentication, multi-tenancy, and persistence.
Follow these steps once and the dashboard becomes a real, login-gated product.

## 1. Create the project

1. Go to https://supabase.com and create a new project (the free tier is fine).
2. Wait for it to finish provisioning.

## 2. Create the schema

1. Open the project, go to **SQL Editor**, and click New query.
2. Paste the entire contents of [`supabase/schema.sql`](../supabase/schema.sql) and run it.

This creates profiles, organizations, memberships, repositories, hunts, findings,
pull requests, and the hunt event timeline. Every table has Row Level Security
enabled, so a signed-in user can only ever read rows for organizations they
belong to. A trigger also gives each new user a profile and a personal workspace
with an owner membership, so there is no empty state after signup.

## 3. Enable sign-in providers

**Email:** Authentication → Providers → Email is on by default. Magic links work
out of the box.

**GitHub OAuth:**
1. On GitHub: Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: `http://localhost:5273` (add your production URL later).
   - Authorization callback URL: copy it from Supabase in the next step.
2. In Supabase: Authentication → Providers → GitHub. Enable it, then paste the
   GitHub Client ID and Client Secret. Supabase shows you the exact callback URL
   to put back into the GitHub OAuth App.

## 4. Point the app at your project

1. In Supabase: Project Settings → API. Copy the **Project URL** and the
   **anon public** key.
2. Create `ui/.env` (it is git-ignored):
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

The anon key is safe in the browser. It carries no privileges of its own, and
Row Level Security decides what any session can read or write.

## 5. Run it

```bash
npm --prefix ui run dev
```

Open the dev server, click **Launch app**, and you should land on the sign-in
screen. Sign in with GitHub or an email link, and you are taken to the dashboard.
The landing page stays public; only the dashboard requires a session.

## What exists after this slice

- Real accounts with sessions that persist across reloads.
- A personal workspace (organization) created automatically on signup.
- A database schema ready for hunts, findings, pull requests, and the live
  event timeline, all isolated per organization.

## What comes next

- Wire the dashboard to read hunts and events from Postgres instead of the local
  in-memory stream, using Supabase Realtime for live updates.
- Replace personal access tokens with a GitHub App install flow.
- Team invitations, per-repo Sentinel toggles, and notifications.
