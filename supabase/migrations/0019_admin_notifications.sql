-- ============================================================================
-- 0019_admin_notifications.sql
--
-- 1) `profiles.username` — nombre de usuario que se pide en el formulario inicial (onboarding), antes
--    de la pantalla de pago.
-- 2) Red de seguridad: `ensure_own_profile()` — si por lo que sea el trigger `handle_new_user` (0001)
--    no corrió para una cuenta (p. ej. se creó antes de que existiera, o falló una vez), el propio
--    usuario puede crear SU fila de `profiles` (nunca la de otro) la próxima vez que entra a la app.
--    Sin esto, una cuenta sin fila en `profiles` queda invisible para siempre en `/admin/usuarios` y
--    nadie puede asignarle módulos ni revisar su suscripción.
-- 3) `module_requests` — "pedir acceso" a un módulo deshabilitado (botón ya existía en la pantalla de
--    módulo bloqueado; no hacía nada).
-- 4) Avisos al admin: usuario nuevo, comprobante de pago subido, pedido de módulo — reusan
--    `agent_notification_log` (0015, AVISOS DENTRO DE LA APP/Isla Dinámica) agregando 3 kinds nuevos.
--    Si 0015 todavía no está aplicada, esta parte se salta sola (no hay nada que romper).
--
-- Cómo correrla: Dashboard de Supabase -> SQL Editor -> pegar TODO -> Run. Idempotente. Requiere 0001.
-- ============================================================================

-- ── profiles.username ────────────────────────────────────────────────────────
alter table public.profiles add column if not exists username text;

do $$ begin
  alter table public.profiles add constraint profiles_username_unique unique (username);
exception when duplicate_object then null; end $$;

comment on column public.profiles.username is
  'Nombre de usuario elegido en el formulario inicial (onboarding). NULL en cuentas que ya existían antes de este cambio.';

-- ── Red de seguridad: crear el propio perfil si el trigger no corrió ───────
-- SECURITY DEFINER para poder insertar en `profiles` pese a que la policy de INSERT es solo-admin (0001);
-- pero el `values` está fijo a `auth.uid()`, así que nunca puede crear ni tocar la fila de otro usuario.
create or replace function public.ensure_own_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  select auth.uid(), (select email from auth.users where id = auth.uid()), 'user'
  where auth.uid() is not null
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_own_profile() to authenticated;

-- ── Compañera de un cambio de CÓDIGO (no de esta migración): el default de `buildModuleAccess`
-- (src/lib/account/modules.ts) pasa de "sin filas = todo habilitado" a "sin filas = solo
-- Entrenamiento". Para que nadie que ya viniera usando varios módulos pierda acceso de golpe, acá se
-- les deja grabado explícitamente lo que YA tenían en los hechos (todo habilitado) a quienes existían
-- antes de este cambio y nunca tuvieron ni una fila tocada por un admin. Un usuario que YA tiene
-- alguna fila (un admin ya lo configuró) no se toca.
insert into public.user_module_access (user_id, module, enabled)
select p.id, m.module, true
from public.profiles p
cross join (values ('gym_calorias'), ('gym_entrenamiento'), ('habitos'), ('outfit'), ('paz_mental'), ('finanzas'), ('voz')) as m(module)
where p.role = 'user'
  and p.created_at < now()
  and not exists (select 1 from public.user_module_access x where x.user_id = p.id)
on conflict (user_id, module) do nothing;

-- ── module_requests: "pedir acceso" a un módulo deshabilitado ──────────────
create table if not exists public.module_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_at timestamptz
);

create index if not exists module_requests_user_idx on public.module_requests (user_id, created_at desc);
create index if not exists module_requests_pending_idx on public.module_requests (resolved, created_at desc);

alter table public.module_requests enable row level security;

drop policy if exists "module_requests_select_own_or_admin" on public.module_requests;
create policy "module_requests_select_own_or_admin"
  on public.module_requests for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "module_requests_insert_own" on public.module_requests;
create policy "module_requests_insert_own"
  on public.module_requests for insert
  with check (user_id = auth.uid());

drop policy if exists "module_requests_update_admin" on public.module_requests;
create policy "module_requests_update_admin"
  on public.module_requests for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── Avisos al admin (reusa agent_notification_log de 0015 si está aplicada) ─
-- CREATE FUNCTION/CREATE TRIGGER van con EXECUTE de un string dólar-citado (mismo criterio que
-- `apply_own_rows_rls` en 0002, EXECUTE format(...) para DDL condicional dentro de PL/pgSQL) en vez de
-- escribirlos directo dentro del DO: así el texto entero queda diferido a cuando se EJECUTA, sin
-- depender de que Postgres acepte CREATE FUNCTION/CREATE TRIGGER como sentencia directa anidada en un
-- bloque DO (comportamiento no usado antes en ninguna migración de este repo).
do $outer$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'agent_notification_log') then

    -- Agrega los 3 kinds nuevos al check existente (el nombre lo pone Postgres solo al crear la
    -- columna en 0015: "<tabla>_<columna>_check").
    alter table public.agent_notification_log drop constraint if exists agent_notification_log_kind_check;
    alter table public.agent_notification_log add constraint agent_notification_log_kind_check
      check (kind in ('task', 'subtask', 'routine', 'water', 'meal', 'summary', 'admin_new_user', 'admin_payment', 'admin_module_request'));

    -- Aviso: usuario nuevo registrado.
    execute $exec1$
      create or replace function public.notify_admins_new_user()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $fn1$
      begin
        if new.role = 'user' then
          insert into public.agent_notification_log (user_id, key, kind, title, body, payload)
          select admin.id, 'new_user_' || new.id::text, 'admin_new_user',
                 'Usuario nuevo', coalesce(new.email, 'Un usuario nuevo') || ' se registró — todavía solo tiene acceso a Entrenamiento.',
                 jsonb_build_object('userId', new.id)
          from public.profiles admin where admin.role = 'admin'
          on conflict (user_id, key) do nothing;
        end if;
        return new;
      end;
      $fn1$
    $exec1$;

    execute 'drop trigger if exists on_profile_created_notify_admin on public.profiles';
    execute 'create trigger on_profile_created_notify_admin after insert on public.profiles for each row execute function public.notify_admins_new_user()';

    -- Aviso: comprobante de pago subido (si 0018 está aplicada: la tabla existe recién ahí).
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'payment_requests') then
      execute $exec2$
        create or replace function public.notify_admins_new_payment()
        returns trigger
        language plpgsql
        security definer
        set search_path = public
        as $fn2$
        begin
          insert into public.agent_notification_log (user_id, key, kind, title, body, payload)
          select admin.id, 'payment_' || new.id::text, 'admin_payment',
                 'Comprobante de pago', 'Hay un comprobante esperando revisión en Pagos.',
                 jsonb_build_object('userId', new.user_id, 'requestId', new.id)
          from public.profiles admin where admin.role = 'admin'
          on conflict (user_id, key) do nothing;
          return new;
        end;
        $fn2$
      $exec2$;

      execute 'drop trigger if exists on_payment_request_notify_admin on public.payment_requests';
      execute 'create trigger on_payment_request_notify_admin after insert on public.payment_requests for each row execute function public.notify_admins_new_payment()';
    end if;

    -- Aviso: pedido de módulo nuevo.
    execute $exec3$
      create or replace function public.notify_admins_module_request()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $fn3$
      begin
        insert into public.agent_notification_log (user_id, key, kind, title, body, payload)
        select admin.id, 'modreq_' || new.id::text, 'admin_module_request',
               'Pedido de módulo', coalesce((select email from public.profiles where id = new.user_id), 'Un usuario') || ' pidió acceso a ' || new.module || '.',
               jsonb_build_object('userId', new.user_id, 'module', new.module, 'requestId', new.id)
        from public.profiles admin where admin.role = 'admin'
        on conflict (user_id, key) do nothing;
        return new;
      end;
      $fn3$
    $exec3$;

    execute 'drop trigger if exists on_module_request_notify_admin on public.module_requests';
    execute 'create trigger on_module_request_notify_admin after insert on public.module_requests for each row execute function public.notify_admins_module_request()';

  end if;
end $outer$;
