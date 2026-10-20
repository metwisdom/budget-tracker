# Free cloud accounts and database setup

This app can use Supabase's free tier for email/password accounts and a hosted
PostgreSQL database. The browser connects directly to Supabase; row-level
security policies restrict every record to its owning account.

## Create the Supabase project

1. Create a free project at [supabase.com](https://supabase.com/).
2. In **SQL Editor**, run the SQL below.
3. In **Project Settings → API**, copy the project URL and the public
   anon/publishable key. Never use a `service_role` or secret key in this app.
4. For local development, add the URL and publishable key to a
   `supabase-config.js` file. This file is intentionally ignored by Git.
5. Serve the app from a local web server. Do not open `index.html` directly as
   a `file://` URL.
6. In Supabase **Authentication → URL Configuration**, set your deployed
   address as the Site URL and add it to the allowed redirect URLs.
7. Open the app, create an account, and sign in. If email confirmation is
   enabled, confirm the address before signing in.

## Deploying to GitHub Pages

The repository includes a GitHub Actions workflow that builds the site and
creates `supabase-config.js` during deployment. To enable it:

1. In GitHub, open **Settings → Secrets and variables → Actions** and add
   repository secrets named `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
2. Set their values to your Supabase project URL and publishable key.
3. In **Settings → Pages**, set the build and deployment source to **GitHub
   Actions**.
4. Push to `main` or manually run **Deploy to GitHub Pages** from the
   repository's **Actions** tab.
5. In Supabase **Authentication → URL Configuration**, allow
   `https://metwisdom.github.io/budget-tracker/` as the Site URL and redirect
   URL.

The Supabase URL and anon/publishable key are intended for browser use. They
are not database passwords; row-level security is what protects user data.
The Actions secrets keep these values out of repository files and commit
history, but the generated client configuration is visible to visitors of the
deployed site, as required for a browser app. Keep row-level security enabled
and never add a service-role key or other secret key to this app.

## Database schema and access policies

```sql
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  income numeric(12, 2) not null default 5000 check (income > 0)
);

create table public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (length(trim(category)) > 0),
  category_key text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  unique (user_id, category_key)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  item text not null,
  planned numeric(12, 2) not null check (planned >= 0),
  actual numeric(12, 2) not null check (actual >= 0),
  spent_on date not null,
  created_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
alter table public.category_budgets enable row level security;
alter table public.expenses enable row level security;

create policy "Users manage their own settings"
  on public.user_settings for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own category budgets"
  on public.category_budgets for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own expenses"
  on public.expenses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.user_settings, public.category_budgets, public.expenses
  to authenticated;
revoke all
  on public.user_settings, public.category_budgets, public.expenses
  from anon;
```

The app writes `category_key` as the lower-case category name and uses it to
avoid duplicate budgets that differ only by letter case.

## Existing browser data

Current data in `localStorage` remains in that browser and is not automatically
uploaded to a new account. Once signed in, the app reads and writes the
Supabase account instead. Existing local data is left untouched.