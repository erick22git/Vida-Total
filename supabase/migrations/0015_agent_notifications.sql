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
