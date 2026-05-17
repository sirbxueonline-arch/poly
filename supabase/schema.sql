-- ────────────────────────────────────────────────────────────────────────
-- Polymarket Pulse — Supabase schema
--
-- Paste this whole file into the Supabase SQL editor and hit Run.
-- Safe to re-run (uses IF NOT EXISTS).
-- ────────────────────────────────────────────────────────────────────────

-- Per-market AI predictions, keyed by Polymarket market id.
create table if not exists public.predictions (
  id          text primary key,
  question    text not null,
  slug        text not null,
  event_slug  text,
  outcomes    jsonb not null,
  yes_price   double precision not null,
  no_price    double precision not null,
  volume24hr  double precision not null default 0,
  end_date    text,
  pick        text not null,
  fair_value  double precision not null,
  confidence  text not null,
  thesis      text,
  reason      text,
  category    text,
  updated_at  timestamptz not null default now()
);

create index if not exists idx_predictions_updated_at
  on public.predictions (updated_at desc);

-- Small key/value store: last digest timestamp, pulse take, price-map blob, etc.
create table if not exists public.meta (
  key   text primary key,
  value text not null
);

-- ────────────────────────────────────────────────────────────────────────
-- Row-level security
--
-- The server writes with the SERVICE_ROLE key (bypasses RLS). The browser
-- never touches these tables directly. We still enable RLS and add a
-- read-only anon policy for safety, in case the anon key ever leaks.
-- ────────────────────────────────────────────────────────────────────────

alter table public.predictions enable row level security;
alter table public.meta enable row level security;

drop policy if exists "anon can read predictions" on public.predictions;
create policy "anon can read predictions"
  on public.predictions for select
  to anon
  using (true);

drop policy if exists "anon can read meta" on public.meta;
create policy "anon can read meta"
  on public.meta for select
  to anon
  using (true);
