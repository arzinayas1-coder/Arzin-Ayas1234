-- FORGE AI — Supabase PostgreSQL Schema & Row-Level Security Migration
-- Deploy this migration when running with external Supabase PostgreSQL + Auth.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  template text not null default 'react-vite',
  git_branch text not null default 'main',
  workspace_uri text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tool_events jsonb not null default '[]'::jsonb,
  plan jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  status text not null,
  current_stage text not null,
  iterations integer not null default 0,
  max_iterations integer not null default 15,
  summary text,
  error text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.file_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  file_path text not null,
  operation text not null check (operation in ('create', 'update', 'delete', 'rename')),
  previous_content text,
  new_content text,
  diff_text text not null default '',
  status text not null check (status in ('pending', 'approved', 'rejected', 'rolled_back')),
  created_at timestamptz not null default now()
);

create table if not exists public.project_memory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  memory_key text not null,
  memory_value text not null,
  updated_at timestamptz not null default now(),
  unique (project_id, memory_key)
);

-- Encrypted user provider settings: NEVER expose encrypted_api_key to client RLS reads
create table if not exists public.user_provider_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  base_url text not null default '',
  model text not null,
  temperature numeric(3,2) not null default 0.20,
  max_output_tokens integer not null default 8192,
  max_context_files integer not null default 12,
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Isolated private secret vault table (service-role only, zero client RLS access)
create table if not exists private_vault.provider_secrets (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  ciphertext text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.agent_runs enable row level security;
alter table public.file_snapshots enable row level security;
alter table public.project_memory enable row level security;
alter table public.user_provider_settings enable row level security;

create policy "Users own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users read own messages" on public.messages
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = auth.uid()
    )
  );

create policy "Users own agent runs" on public.agent_runs
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "Users own snapshots" on public.file_snapshots
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "Users own project memory" on public.project_memory
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy "Users own provider settings" on public.user_provider_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
