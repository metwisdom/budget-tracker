# Free cloud accounts and database setup

This app can use Supabase's free tier for email/password accounts and a hosted
PostgreSQL database. The browser connects directly to Supabase; row-level
security policies restrict every record to its owning account.

## Create the Supabase project

1. Create a free project at [supabase.com](https://supabase.com/).
2. In **SQL Editor**, run the SQL below.
3. In **Project Settings → API**, copy the project URL and the public
   anon/publishable key. Never use a `service_role` or secret key in this app.
4. Add those values to a local `supabase-config.js` file. This file is
   intentionally ignored by Git and should not be committed.
5. Serve this folder from a local web server or deploy it to a static host.
   Do not open `index.html` directly as a `file://` URL.
6. Open the app, create an account, and sign in. If email confirmation is
   enabled, confirm the address before signing in.
7. In Supabase **Authentication → URL Configuration**, set your deployed
   address as the Site URL and add it to the allowed redirect URLs.

GitHub Pages is one free option for hosting the static app. The app does not
need a separately hosted server because Supabase provides the database and
authentication API.

The Supabase URL and anon/publishable key are intended for browser use. They
are not database passwords; row-level security is what protects user data.
Keep row-level security enabled and never add a service-role key to this app.
Because `supabase-config.js` is excluded from the repository, a deployed copy
without a separately configured client file will use browser-only storage and
will not connect to Supabase.

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