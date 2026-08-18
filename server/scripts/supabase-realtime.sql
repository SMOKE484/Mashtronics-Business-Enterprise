-- SecureWatch realtime authorization (features.md Track C).
-- Run ONCE in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--
-- Purpose: lets a signed-in app user receive private-channel Broadcast
-- events only on their own topic `client:<mongoClientId>`. The server
-- (server/services/supabaseLinks.js) upserts the mapping row on claim
-- using the service role key; the app never writes this table.
--
-- This is the ONE deliberate exception to "Supabase never holds business
-- data" — it stores only the identity mapping needed for channel auth.

create table if not exists public.client_links (
  supabase_user_id uuid primary key,
  client_id        text not null,
  created_at       timestamptz not null default now()
);

-- Lock the table down: only the service role writes it (service role
-- bypasses RLS), and authenticated users can read ONLY their own row.
alter table public.client_links enable row level security;

-- REQUIRED for the realtime.messages policy below to work at all.
-- Realtime Authorization evaluates that policy AS the subscribing user
-- (role `authenticated`), and RLS applies inside the policy's subquery
-- too — so if client_links has RLS enabled with no select policy, the
-- EXISTS below always sees zero rows and every subscribe is rejected
-- with "Unauthorized". (This was the root cause of the "chat doesn't
-- update live" bug — see BUGS_AND_FIXES.md 2026-07-11.)
drop policy if exists "client can read own link" on public.client_links;
create policy "client can read own link"
on public.client_links
for select
to authenticated
using (supabase_user_id = (select auth.uid()));

-- Realtime Authorization: a user may subscribe to / receive broadcasts on
-- the private topic 'client:<id>' only if client_links maps their auth.uid()
-- to that client id.
drop policy if exists "client can receive own broadcasts" on realtime.messages;
create policy "client can receive own broadcasts"
on realtime.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.client_links cl
    where cl.supabase_user_id = (select auth.uid())
      and realtime.topic() = 'client:' || cl.client_id
  )
);

-- Staff-side sibling: a staff member (technician/response officer) may
-- subscribe to / receive broadcasts on the private topic 'staff:<id>' only
-- if staff_links (created in supabase-storage.sql) maps their auth.uid() to
-- that staff id. staff_links already has its own "read own link" policy
-- (required for this EXISTS to see any rows at all — same lesson as above).
drop policy if exists "staff can receive own broadcasts" on realtime.messages;
create policy "staff can receive own broadcasts"
on realtime.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.staff_links sl
    where sl.supabase_user_id = (select auth.uid())
      and realtime.topic() = 'staff:' || sl.staff_id
  )
);
