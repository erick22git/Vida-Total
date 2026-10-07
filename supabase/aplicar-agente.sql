-- ============================================================================
-- aplicar-agente.sql — migraciones del agente 0012 a 0015, en orden
--
-- Se puede correr DOS (o más) veces sin dañar datos:
--   · solo ADITIVO: create table / index IF NOT EXISTS, add column IF NOT EXISTS; las políticas ya existentes se ignoran.
--   · NO hay DROP, DELETE, UPDATE de filas ni TRUNCATE.
-- Va dentro de UNA transacción: si algo falla, no queda nada a medias (todo o nada).
--
-- ANTES: tener aplicadas 0001 y 0002 (y, si usas Hábitos/Recetas con sync, 0003–0008: supabase/aplicar-pendientes.sql).
-- DESPUÉS: corre supabase/verificar-agente.sql (solo lectura) y comprueba que todo salga en true.
--
-- Cada bloque es EL MISMO texto que su archivo en supabase/migrations/. Si cambias una migración, regenera este archivo
-- (node scripts/build-aplicar-agente.mjs).
--
-- AVISO DE RLS: las tablas telegram_link_codes, telegram_updates, agent_pending y agent_chat_state solo las toca el SERVIDOR
-- (service role, que se salta RLS). Tienen RLS activado y una política explícita «denegar todo» para anon/authenticated, así que
-- el navegador no puede leerlas ni escribirlas y el Security Advisor de Supabase no marca "RLS enabled, no policy".
-- ============================================================================

begin;

do $$
begin
  if to_regprocedure('public.apply_own_rows_rls(text)') is null
     or to_regclass('public.profiles') is null then
    raise exception 'Faltan las migraciones 0001/0002 (apply_own_rows_rls o profiles). Aplícalas primero.';
  end if;
  if to_regclass('public.tasks') is null then
    raise exception 'Falta la tabla tasks (migración 0002).';
  end if;
end $$;

-- ############################################################################
-- 0012_agent_settings.sql
-- ############################################################################

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

-- ############################################################################
-- 0013_tasks_reminder.sql
-- ############################################################################

-- 0013 — Tareas: hora de recordatorio opcional.
--
-- NO aplicada todavía: ejecutarla a mano en el SQL Editor de Supabase cuando se decida.
-- SOLO ADITIVA e idempotente. La app solo envía `reminder` cuando una tarea tiene recordatorio, así que hasta aplicarla
-- todo lo demás de las tareas sigue sincronizando igual. (Los recordatorios de SUBTAREAS viajan dentro del jsonb `subtasks`.)
alter table public.tasks
  add column if not exists reminder text check (reminder is null or reminder ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ############################################################################
-- 0014_telegram_agent.sql
-- ############################################################################

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
do $$ begin
  create policy telegram_link_codes_deny_all on public.telegram_link_codes for all to anon, authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;

-- 3) Deduplicación de updates de Telegram.
create table if not exists public.telegram_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);
alter table public.telegram_updates enable row level security;
do $$ begin
  create policy telegram_updates_deny_all on public.telegram_updates for all to anon, authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;

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
do $$ begin
  create policy agent_pending_deny_all on public.agent_pending for all to anon, authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;

-- 5) Memoria corta de la conversación de Telegram.
create table if not exists public.agent_chat_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.agent_chat_state enable row level security;
do $$ begin
  create policy agent_chat_state_deny_all on public.agent_chat_state for all to anon, authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;

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

-- ############################################################################
-- 0015_agent_notifications.sql
-- ############################################################################

-- 0015 — Avisos del agente (app y Telegram).
--
-- NO aplicada todavía: ejecutarla a mano en el SQL Editor de Supabase cuando se decida (ver docs/notificaciones.md).
-- SOLO ADITIVA e idempotente. Requiere 0012.
--
-- agent_notification_log: un registro por aviso enviado. La restricción única (user_id, key) es la deduplicación: aunque el
-- programador corra dos veces en el mismo minuto, un aviso sale una sola vez. La escribe el servidor (service role); el
-- usuario solo puede LEER los suyos y marcarlos como leídos o pospuestos (para los avisos dentro de la app).
create table if not exists public.agent_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  kind text not null check (kind in ('task', 'subtask', 'routine', 'water', 'meal', 'summary')),
  title text not null,
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  telegram_sent boolean not null default false,
  snooze_until timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);
create index if not exists agent_notification_log_user_idx on public.agent_notification_log (user_id, created_at desc);
alter table public.agent_notification_log enable row level security;
do $$ begin
  create policy agent_notification_log_select_own on public.agent_notification_log for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy agent_notification_log_update_own on public.agent_notification_log for update using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Limpieza opcional (de vez en cuando): delete from public.agent_notification_log where created_at < now() - interval '30 days';

commit;
