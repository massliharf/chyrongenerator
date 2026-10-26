-- Savvy Editor cloud: teams, members, invitations and team media.
-- Run once in the Supabase SQL editor (or `supabase db push`). Every table is
-- protected by row level security: people only see the teams they belong to.

-- ---------- Tables ----------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists team_members_user_idx on public.team_members (user_id);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and position('@' in email) > 1),
  role text not null default 'member' check (role in ('admin', 'member')),
  invited_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  unique (team_id, email)
);
create index if not exists team_invites_email_idx on public.team_invites (email);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 160),
  filename text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);
create index if not exists media_team_idx on public.media (team_id, created_at desc);

-- ---------- Helpers (security definer, so policies don't recurse) ----------
create or replace function public.team_role(t uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.team_members where team_id = t and user_id = auth.uid()
$$;

create or replace function public.is_team_member(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.team_members where team_id = t and user_id = auth.uid())
$$;

create or replace function public.is_team_admin(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.team_role(t) in ('owner', 'admin'), false)
$$;

-- A team is made together with its owner, in one step.
create or replace function public.create_team(team_name text)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.teams;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.teams (name, created_by) values (trim(team_name), auth.uid()) returning * into created;
  insert into public.team_members (team_id, user_id, email, role)
  values (created.id, auth.uid(), lower(auth.jwt() ->> 'email'), 'owner');
  return created;
end;
$$;

-- Joins every team that invited the signed-in person's email address.
create or replace function public.accept_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me text := lower(auth.jwt() ->> 'email');
  joined integer;
begin
  if auth.uid() is null or me is null then
    return 0;
  end if;
  insert into public.team_members (team_id, user_id, email, role)
  select team_id, auth.uid(), me, role from public.team_invites where email = me
  on conflict (team_id, user_id) do nothing;
  get diagnostics joined = row_count;
  delete from public.team_invites where email = me;
  return joined;
end;
$$;

revoke execute on function public.create_team(text) from anon;
revoke execute on function public.accept_invites() from anon;

-- ---------- Row level security ----------
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.media enable row level security;

drop policy if exists "teams: members read" on public.teams;
create policy "teams: members read" on public.teams
  for select to authenticated using (public.is_team_member(id));
drop policy if exists "teams: admins rename" on public.teams;
create policy "teams: admins rename" on public.teams
  for update to authenticated using (public.is_team_admin(id)) with check (public.is_team_admin(id));
drop policy if exists "teams: owner deletes" on public.teams;
create policy "teams: owner deletes" on public.teams
  for delete to authenticated using (public.team_role(id) = 'owner');

drop policy if exists "members: teammates read" on public.team_members;
create policy "members: teammates read" on public.team_members
  for select to authenticated using (public.is_team_member(team_id));
-- Owners change roles (never their own, so a team always keeps an owner).
drop policy if exists "members: owner sets roles" on public.team_members;
create policy "members: owner sets roles" on public.team_members
  for update to authenticated
  using (public.team_role(team_id) = 'owner' and user_id <> auth.uid())
  with check (public.team_role(team_id) = 'owner' and role in ('admin', 'member'));
-- Anyone but the owner can leave; admins remove anyone but the owner.
drop policy if exists "members: leave or remove" on public.team_members;
create policy "members: leave or remove" on public.team_members
  for delete to authenticated
  using (role <> 'owner' and (user_id = auth.uid() or public.is_team_admin(team_id)));

drop policy if exists "invites: admins and invitee read" on public.team_invites;
create policy "invites: admins and invitee read" on public.team_invites
  for select to authenticated
  using (public.is_team_admin(team_id) or email = lower(auth.jwt() ->> 'email'));
drop policy if exists "invites: admins invite" on public.team_invites;
create policy "invites: admins invite" on public.team_invites
  for insert to authenticated
  with check (public.is_team_admin(team_id) and invited_by = auth.uid());
drop policy if exists "invites: admins or invitee cancel" on public.team_invites;
create policy "invites: admins or invitee cancel" on public.team_invites
  for delete to authenticated
  using (public.is_team_admin(team_id) or email = lower(auth.jwt() ->> 'email'));

drop policy if exists "media: members read" on public.media;
create policy "media: members read" on public.media
  for select to authenticated using (public.is_team_member(team_id));
drop policy if exists "media: members upload" on public.media;
create policy "media: members upload" on public.media
  for insert to authenticated
  with check (public.is_team_member(team_id) and uploaded_by = auth.uid()
    and storage_path like team_id::text || '/%');
drop policy if exists "media: uploader or admin renames" on public.media;
create policy "media: uploader or admin renames" on public.media
  for update to authenticated
  using (uploaded_by = auth.uid() or public.is_team_admin(team_id))
  with check (public.is_team_member(team_id));
drop policy if exists "media: uploader or admin deletes" on public.media;
create policy "media: uploader or admin deletes" on public.media
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_team_admin(team_id));

-- ---------- Storage: one private bucket, a folder per team ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-media',
  'team-media',
  false,
  26214400,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "team-media: members read" on storage.objects;
create policy "team-media: members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'team-media' and public.is_team_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "team-media: members upload" on storage.objects;
create policy "team-media: members upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'team-media' and public.is_team_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "team-media: uploader or admin deletes" on storage.objects;
create policy "team-media: uploader or admin deletes" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'team-media'
    and (owner_id = auth.uid()::text or public.is_team_admin(((storage.foldername(name))[1])::uuid))
  );
