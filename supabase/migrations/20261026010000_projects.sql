-- Savvy Editor cloud: team projects (.savvy files) for the Home page.
-- Run after 20261026000000_teams_media.sql.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  kind text not null check (kind in ('chyron', 'design', 'hero')),
  name text not null check (char_length(name) between 1 and 120),
  storage_path text not null unique,
  thumb_path text,
  size_bytes bigint not null default 0,
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_team_idx on public.projects (team_id, updated_at desc);

alter table public.projects enable row level security;

drop policy if exists "projects: members read" on public.projects;
create policy "projects: members read" on public.projects
  for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "projects: members create" on public.projects;
create policy "projects: members create" on public.projects
  for insert to authenticated
  with check (public.is_team_member(team_id) and created_by = auth.uid()
    and storage_path like team_id::text || '/%');
-- Everyone in the team can save over a project; it stays in its team.
drop policy if exists "projects: members save" on public.projects;
create policy "projects: members save" on public.projects
  for update to authenticated
  using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id) and storage_path like team_id::text || '/%');
drop policy if exists "projects: creator or admin deletes" on public.projects;
create policy "projects: creator or admin deletes" on public.projects
  for delete to authenticated
  using (created_by = auth.uid() or public.is_team_admin(team_id));

-- Project files and their thumbnails, a folder per team.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-projects',
  'team-projects',
  false,
  52428800,
  array['application/x-savvy', 'application/json', 'image/webp', 'image/png']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "team-projects: members read" on storage.objects;
create policy "team-projects: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'team-projects' and public.is_team_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "team-projects: members write" on storage.objects;
create policy "team-projects: members write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'team-projects' and public.is_team_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "team-projects: members overwrite" on storage.objects;
create policy "team-projects: members overwrite" on storage.objects
  for update to authenticated
  using (bucket_id = 'team-projects' and public.is_team_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'team-projects' and public.is_team_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "team-projects: members delete" on storage.objects;
create policy "team-projects: members delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'team-projects' and public.is_team_member(((storage.foldername(name))[1])::uuid));

-- Deleting your own account. Teams you own go with it (their rows cascade);
-- the app removes the Storage files you own or uploaded before calling this.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from anon, public;
grant execute on function public.delete_my_account() to authenticated;
