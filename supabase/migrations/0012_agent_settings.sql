-- 0012 — Agente: configuración de permisos y registro de acciones.
--
-- NO aplicada todavía: ejecutarla a mano en el SQL Editor de Supabase cuando se decida (ver docs/agente.md).
-- SOLO ADITIVA e idempotente. Requiere 0001/0002 (usa public.apply_own_rows_rls y auth.users).
--
-- agent_settings: la configuración de permisos del agente (una fila por usuario). El cliente la sube para que el SERVIDOR
--   (Telegram, programador de avisos) pueda aplicar las mismas reglas; el servidor la vuelve a sanear siempre y nunca
--   toma de aquí el "Auto total" (ese estado vive solo en el dispositivo y caduca).
-- agent_action_log: historial de lo que hizo el agente (con la forma de deshacerlo). Lo escribe el servidor para las
--   acciones de Telegram y la app lo muestra junto a las suyas.

create table if not exists public.agent_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.agent_settings enable row level security;

create table if not exists public.agent_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('app', 'telegram', 'scheduler')),
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  summary text not null default '',
  ok boolean not null default true,
  undo jsonb,
  undone boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists agent_action_log_user_idx on public.agent_action_log (user_id, created_at desc);
alter table public.agent_action_log enable row level security;

-- agent_llm_usage: contador de llamadas al proveedor del modelo (una fila por usuario y día UTC).
create table if not exists public.agent_llm_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  calls integer not null default 0,
  rate_limited integer not null default 0,
  fallbacks integer not null default 0,
  by_agent jsonb not null default '{}'::jsonb,
  primary key (user_id, day)
);
alter table public.agent_llm_usage enable row level security;

-- Políticas "solo tus filas" (las crea la función de 0002; ignora las que ya existen).
select public.apply_own_rows_rls('agent_settings');
select public.apply_own_rows_rls('agent_action_log');
select public.apply_own_rows_rls('agent_llm_usage');
