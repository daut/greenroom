-- Greenroom sync: one row per training session, recordings in a private bucket.
-- Every row and object belongs to exactly one user; RLS restricts access to the owner.

create table public.training_sessions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  training_id text not null,
  title text not null,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  primary key (user_id, id)
);

create index training_sessions_user_updated_idx
  on public.training_sessions (user_id, updated_at desc);

alter table public.training_sessions enable row level security;

grant select, insert, update, delete on public.training_sessions to authenticated;

create policy "Owners read their sessions" on public.training_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners insert their sessions" on public.training_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Owners update their sessions" on public.training_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners delete their sessions" on public.training_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Recordings: private bucket, objects stored under "<user id>/<file name>".
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "Owners read their recordings" on storage.objects
  for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners upload their recordings" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners replace their recordings" on storage.objects
  for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owners delete their recordings" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
