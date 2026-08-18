-- SecureWatch job-photo storage + staff authorization (features.md Track C).
-- Run ONCE in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Idempotent — safe to re-run, same convention as supabase-realtime.sql.
--
-- Purpose: technicians upload proof-of-work photos for a job DIRECTLY from
-- the phone to the private `job-photos` bucket using their own session.
-- Object keys follow `<auth.uid()>/jobs/<mongoJobId>/<file>` — storage RLS
-- can only pin the first path segment to the uploader's own uid (jobs live
-- in MongoDB, not here), so the SERVER validates the jobId segment when the
-- app records the path onto the Job (server/routes/appJobs.js). Reads from
-- the admin/app go through server-minted signed URLs (service role).

-- 1. Private bucket. Never make this public — it holds photos of clients'
--    homes and premises.
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

-- 2. staff_links: maps a Supabase auth.uid() to a Mongo staff record, the
--    staff-side sibling of client_links. Written only by the server (service
--    role) on invite-code claim. Introduced for the storage policies below;
--    the armed-response slice's realtime topics will reuse it.
create table if not exists public.staff_links (
  supabase_user_id uuid primary key,
  staff_id         text not null,
  staff_type       text not null check (staff_type in ('technician', 'response')),
  created_at       timestamptz not null default now()
);

alter table public.staff_links enable row level security;

-- REQUIRED for the storage policies below to work at all. Policies evaluate
-- AS the authenticated user, and RLS applies inside the policy's EXISTS
-- subquery too — without this select-own policy the subquery always sees
-- zero rows and every upload is rejected. (Same failure mode as the
-- client_links realtime bug — see BUGS_AND_FIXES.md 2026-07-11.)
drop policy if exists "staff can read own link" on public.staff_links;
create policy "staff can read own link"
on public.staff_links
for select
to authenticated
using (supabase_user_id = (select auth.uid()));

-- 3. Storage policies: an authenticated STAFF user may upload into (and read
--    back from) their own uid-named top-level folder only. No UPDATE/DELETE
--    policies on purpose — proof photos are immutable from the phone;
--    removal goes through the server, which uses the service role.
drop policy if exists "staff upload own job photos" on storage.objects;
create policy "staff upload own job photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'job-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.staff_links sl
    where sl.supabase_user_id = (select auth.uid())
  )
);

drop policy if exists "staff read own job photos" on storage.objects;
create policy "staff read own job photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'job-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.staff_links sl
    where sl.supabase_user_id = (select auth.uid())
  )
);
