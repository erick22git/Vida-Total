-- ============================================================================
-- 0020_module_defaults_and_activity.sql
--
-- 1) Acompaña el cambio de código en `lib/account/modules.ts`: el default para un usuario SIN filas en
--    `user_module_access` pasa de "solo Entrenamiento" a "nada habilitado" (ni Entrenamiento) — ahora el
--    admin habilita módulo por módulo, incluido Entrenamiento. Igual que en la 0019, se siembra el
--    acceso de quien ya existiera y nunca tuviera una fila tocada por un admin, para no cortarle nada.
-- 2) `profiles.login_count` / `last_login_at` — cuántas veces entró cada usuario, para el panel de admin.
--    Trigger en `auth.sessions` (se crea una fila ahí cada vez que alguien inicia sesión).
-- 3) Aviso al USUARIO cuando el admin le da prueba gratuita o le aprueba un pago (no solo al admin):
--    agrega el kind 'trial_granted' a `agent_notification_log` (si 0015/0019 ya la dejaron con RLS) y
--    una policy para que un admin pueda escribir ahí avisos dirigidos a otro usuario (hasta ahora solo
--    escribía "el servidor"/los triggers de 0019; esto es del lado del cliente, admin autenticado).
--
-- Cómo correrla: Dashboard de Supabase -> SQL Editor -> pegar TODO -> Run. Idempotente. Requiere 0001;
-- las partes 2 y 3 se saltan solas si lo que necesitan no está aplicado.
-- ============================================================================

-- ── 1) Siembra de módulos para quien ya existía y nunca tuvo una fila ──────
-- Mismo criterio que la siembra de la 0019 (esa ya cubrió "sin filas = todo habilitado" -> "solo
-- Entrenamiento"; ahora el código pasa a "nada habilitado" para CUALQUIER usuario nuevo de acá en
-- adelante). Quien ya tenga alguna fila -sea de la siembra anterior o de un cambio real del admin- no
-- se toca. Esto deja a los usuarios que ya existían HOY con el acceso explícito que tenían en los
-- hechos (todo habilitado), igual que la vez pasada.
insert into public.user_module_access (user_id, module, enabled)
select p.id, m.module, true
from public.profiles p
cross join (values ('gym_calorias'), ('gym_entrenamiento'), ('habitos'), ('outfit'), ('paz_mental'), ('finanzas'), ('voz')) as m(module)
where p.role = 'user'
  and p.created_at < now()
  and not exists (select 1 from public.user_module_access x where x.user_id = p.id)
on conflict (user_id, module) do nothing;

-- ── 2) Cuántas veces entró cada usuario ─────────────────────────────────────
alter table public.profiles add column if not exists login_count integer not null default 0;
alter table public.profiles add column if not exists last_login_at timestamptz;

comment on column public.profiles.login_count is 'Cuántas veces inició sesión (una fila nueva en auth.sessions = +1). 0 en cuentas que ya existían antes de este contador: no se puede reconstruir el historial pasado.';

do $outer$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'sessions') then
    execute $exec$
      create or replace function public.count_login()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $fn$
      begin
        update public.profiles set login_count = login_count + 1, last_login_at = new.created_at where id = new.user_id;
        return new;
      end;
      $fn$
    $exec$;

    execute 'drop trigger if exists on_session_created_count_login on auth.sessions';
    execute 'create trigger on_session_created_count_login after insert on auth.sessions for each row execute function public.count_login()';
  end if;
end $outer$;

-- ── 3) Aviso al usuario cuando el admin le da prueba gratuita o le aprueba un pago ──
do $outer$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'agent_notification_log') then
    alter table public.agent_notification_log drop constraint if exists agent_notification_log_kind_check;
    alter table public.agent_notification_log add constraint agent_notification_log_kind_check
      check (kind in ('task', 'subtask', 'routine', 'water', 'meal', 'summary', 'admin_new_user', 'admin_payment', 'admin_module_request', 'trial_granted'));

    -- Hasta la 0019, lo único que escribía en esta tabla eran triggers de la base (security definer) o
    -- cada usuario sus propios avisos (no hay policy de insert para eso tampoco: los de tarea/agua/etc.
    -- los escribe el programador con service role, fuera de RLS). Esto es distinto: un ADMIN autenticado,
    -- desde el panel, avisándole a OTRO usuario — hace falta una policy explícita para ese caso.
    drop policy if exists "agent_notification_log_insert_admin" on public.agent_notification_log;
    create policy "agent_notification_log_insert_admin"
      on public.agent_notification_log for insert
      with check (public.is_admin());
  end if;
end $outer$;
