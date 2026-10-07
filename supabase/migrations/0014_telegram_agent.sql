-- 0014 — Telegram + bandeja de comandos del agente.
--
-- NO aplicada todavía: ejecutarla a mano en el SQL Editor de Supabase cuando se decida (ver docs/telegram.md).
-- SOLO ADITIVA e idempotente. Requiere 0012 (agent_settings / agent_action_log) y 0002 (apply_own_rows_rls).
--
-- Quién escribe qué (las rutas /api/telegram/* usan la service role, que se salta RLS; el navegador usa la anon key + RLS):
--   telegram_links       → la crea el servidor al vincular; el usuario solo puede LEER y BORRAR (desvincular) la suya.
--   telegram_link_codes  → solo el servidor (RLS activa y sin políticas = nadie más). Guarda el HASH del código, nunca el código.
--   telegram_updates     → solo el servidor: deduplicación por update_id (Telegram reintenta).
--   agent_pending        → solo el servidor: planes/confirmaciones que esperan un botón de Telegram.
--   agent_chat_state     → solo el servidor: últimos mensajes de la conversación (para aclaraciones de varios turnos).
--   agent_commands       → bandeja: el servidor encola ediciones de cosas que ya existen; la app las aplica con sus
--                          acciones de negocio y las marca. El usuario lee y actualiza SOLO las suyas.

-- 1) Vínculo usuario ↔ cuenta de Telegram (uno a uno).
create table if not exists public.telegram_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  chat_id bigint not null unique,
  telegram_user_id bigint not null unique,
  username text,
  linked_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;
do $$ begin
  create policy telegram_links_select_own on public.telegram_links for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy telegram_links_delete_own on public.telegram_links for delete using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- 2) Códigos de vinculación de un solo uso (solo el hash).
create table if not exists public.telegram_link_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists telegram_link_codes_user_idx on public.telegram_link_codes (user_id);
alter table public.telegram_link_codes enable row level security;

-- 3) Deduplicación de updates de Telegram.
create table if not exists public.telegram_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);
alter table public.telegram_updates enable row level security;

-- 4) Confirmaciones y planes pendientes de un botón.
create table if not exists public.agent_pending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chat_id bigint not null,
  payload jsonb not null,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);
create index if not exists agent_pending_user_idx on public.agent_pending (user_id, status);
alter table public.agent_pending enable row level security;

-- 5) Memoria corta de la conversación de Telegram.
create table if not exists public.agent_chat_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.agent_chat_state enable row level security;

-- 6) Bandeja de comandos que la app aplica.
create table if not exists public.agent_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  source text not null default 'telegram',
  status text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  result text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists agent_commands_user_idx on public.agent_commands (user_id, status, created_at);
alter table public.agent_commands enable row level security;
do $$ begin
  create policy agent_commands_select_own on public.agent_commands for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy agent_commands_update_own on public.agent_commands for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Limpieza opcional (correr de vez en cuando): delete from public.telegram_updates where received_at < now() - interval '7 days';
