begin;

create table if not exists public.content_factory_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_factory_workspace_members (
  workspace_id uuid not null references public.content_factory_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.content_factory_state (
  workspace_id uuid not null references public.content_factory_workspaces(id) on delete cascade,
  store_key text not null,
  payload jsonb not null,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, store_key)
);

create index if not exists content_factory_state_updated_at_idx
  on public.content_factory_state (workspace_id, updated_at desc);

alter table public.content_factory_workspaces enable row level security;
alter table public.content_factory_workspace_members enable row level security;
alter table public.content_factory_state enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-factory-assets',
  'content-factory-assets',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/markdown', 'text/csv']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members can read their membership" on public.content_factory_workspace_members;
create policy "members can read their membership"
  on public.content_factory_workspace_members
  for select
  to authenticated
  using (user_id = auth.uid());

-- Application state is intentionally accessed by a server-only secret-key client.
-- Browser clients never receive direct access to customer state.

commit;
