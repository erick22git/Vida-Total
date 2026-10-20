-- ============================================================================
-- 0021_modulos_independientes_planes_usuarios.sql
--
-- 1) Módulos independientes: Agua y Kegel dejan de colgar de Calorías/Entrenamiento y pasan a ser módulos
--    propios (`gym_agua`, `gym_kegel`) en el CHECK de `user_module_access.module`. Quien ya tenía acceso a
--    Calorías/Entrenamiento conserva en los hechos el acceso a Agua/Kegel (se copia su valor actual).
-- 2) Planes de suscripción CONFIGURABLES (`subscription_plans`): nombre, meses, precio, orden, activo. El
--    admin agrega/edita/desactiva planes desde la app; los 4 iniciales (1 mes, 3 meses, 6 meses, 1 año)
--    son solo una siembra. El comprobante queda atado al plan que el usuario eligió al pagar.
-- 3) `profiles.payment_required`: una cuenta NUEVA nace exigiendo pago (no entra a nada hasta que el admin
--    confirme un pago o le asigne una prueba gratuita). Las cuentas que ya existían quedan en `false`
--    (no se les corta nada). El usuario NO puede cambiarse este campo (se agrega a la policy de update).
-- 4) Eliminar usuarios: `profiles.deleted_at` (soft-delete: la cuenta queda bloqueada y oculta, con sus datos
--    intactos); el borrado definitivo lo hace el servidor con la service role (ruta /api/admin/users).
-- 5) `profiles.display_name` (cómo lo llama la mascota) y `profiles.phone` (contacto, opcional).
-- 6) Pedidos de acceso: un solo pedido sin resolver por usuario y módulo, y el aviso al admin dice el
--    NOMBRE real del módulo ("Pedido de acceso a Calorías"), nunca la clave interna.
--
-- Cómo correrla: Dashboard de Supabase -> SQL Editor -> pegar TODO -> Run. Idempotente. Requiere 0001.
-- Las partes que dependen de 0018/0019 se saltan solas si esas tablas no existen.
-- ============================================================================

-- ── 1) Módulos independientes ───────────────────────────────────────────────
alter table public.user_module_access drop constraint if exists user_module_access_module_check;
alter table public.user_module_access add constraint user_module_access_module_check
  check (module in ('gym_calorias', 'gym_agua', 'gym_entrenamiento', 'gym_kegel', 'habitos', 'outfit', 'paz_mental', 'finanzas', 'voz'));

insert into public.user_module_access (user_id, module, enabled)
select user_id, 'gym_agua', enabled from public.user_module_access where module = 'gym_calorias'
on conflict (user_id, module) do nothing;

insert into public.user_module_access (user_id, module, enabled)
select user_id, 'gym_kegel', enabled from public.user_module_access where module = 'gym_entrenamiento'
on conflict (user_id, module) do nothing;

-- ── 3-5) Columnas nuevas de profiles ────────────────────────────────────────
-- `payment_required` se crea UNA vez y, justo en ese momento, las cuentas que ya existían quedan en false (si se
-- repitiera esta migración más adelante, no vuelve a tocar a las cuentas nuevas).
do $outer$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'payment_required') then
    execute 'alter table public.profiles add column payment_required boolean not null default true';
    execute 'update public.profiles set payment_required = false';
  end if;
end $outer$;

alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deleted_by uuid references public.profiles (id) on delete set null;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists phone text;

comment on column public.profiles.payment_required is 'true = la cuenta todavía no pagó ni recibió prueba gratuita: ve la pantalla de pago en vez de los módulos. Lo apaga el admin al confirmar un pago o asignar una prueba.';
comment on column public.profiles.deleted_at is 'Soft-delete: la cuenta queda bloqueada y oculta del listado, con sus datos intactos. El borrado definitivo es aparte (service role).';

-- Un usuario puede editar SU fila (nombre, username, onboarding…), pero nunca los campos administrativos.
drop policy if exists "profiles_update_own_basic_fields" on public.profiles;
create policy "profiles_update_own_basic_fields"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_blocked = (select p.is_blocked from public.profiles p where p.id = auth.uid())
    and access_until is not distinct from (select p.access_until from public.profiles p where p.id = auth.uid())
    and access_from = (select p.access_from from public.profiles p where p.id = auth.uid())
    and payment_required = (select p.payment_required from public.profiles p where p.id = auth.uid())
    and deleted_at is not distinct from (select p.deleted_at from public.profiles p where p.id = auth.uid())
  );

-- ── 2) Planes de suscripción configurables ──────────────────────────────────
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  months integer not null check (months between 1 and 120),
  price_label text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

-- Todo usuario logueado ve los planes activos (los necesita para elegir al pagar); el admin ve y escribe todos.
drop policy if exists "subscription_plans_select" on public.subscription_plans;
create policy "subscription_plans_select"
  on public.subscription_plans for select
  using (auth.uid() is not null and (active or public.is_admin()));

drop policy if exists "subscription_plans_insert_admin" on public.subscription_plans;
create policy "subscription_plans_insert_admin" on public.subscription_plans for insert with check (public.is_admin());

drop policy if exists "subscription_plans_update_admin" on public.subscription_plans;
create policy "subscription_plans_update_admin" on public.subscription_plans for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "subscription_plans_delete_admin" on public.subscription_plans;
create policy "subscription_plans_delete_admin" on public.subscription_plans for delete using (public.is_admin());

-- Siembra inicial (solo si todavía no hay ningún plan). El precio se completa desde el panel de admin.
insert into public.subscription_plans (name, months, sort_order)
select v.name, v.months, v.ord
from (values ('1 mes', 1, 1), ('3 meses', 3, 2), ('6 meses', 6, 3), ('1 año', 12, 4)) as v(name, months, ord)
where not exists (select 1 from public.subscription_plans);

-- Si ya había precios cargados en el esquema viejo (app_settings.payment_prices, JSON {"1":"Bs 30",…}), se copian.
do $outer$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_settings') then
    begin
      update public.subscription_plans p
      set price_label = coalesce(nullif((select (s.value::jsonb) ->> p.months::text from public.app_settings s where s.key = 'payment_prices'), ''), p.price_label)
      where p.price_label = '';
    exception when others then
      null; -- JSON inválido o sin precios: se dejan vacíos, el admin los completa
    end;
  end if;
end $outer$;

-- ── Comprobantes atados al plan elegido ─────────────────────────────────────
do $outer$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'payment_requests') then
    execute 'alter table public.payment_requests add column if not exists plan_id uuid references public.subscription_plans (id) on delete set null';
    execute 'alter table public.payment_requests add column if not exists plan_name text';
    execute 'alter table public.payment_requests add column if not exists plan_months integer';
    execute 'alter table public.payment_requests add column if not exists plan_price_label text';
  end if;
end $outer$;

-- ── 6) Pedidos de acceso: uno solo sin resolver por usuario+módulo, con nombre real del módulo ──
do $outer$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'module_requests') then
    -- Si ya hay duplicados sin resolver, se cierran los más viejos para poder crear el índice único.
    execute $sql$
      update public.module_requests set resolved = true, resolved_at = now()
      where id in (
        select id from (
          select id, row_number() over (partition by user_id, module order by created_at desc) as rn
          from public.module_requests where resolved = false
        ) t where rn > 1
      )
    $sql$;
    execute 'create unique index if not exists module_requests_one_pending on public.module_requests (user_id, module) where resolved = false';
  end if;
end $outer$;

create or replace function public.notify_admins_module_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  mod_label text;
begin
  mod_label := case new.module
    when 'gym_calorias' then 'Calorías'
    when 'gym_agua' then 'Agua'
    when 'gym_entrenamiento' then 'Entrenamiento'
    when 'gym_kegel' then 'Kegel'
    when 'habitos' then 'Hábitos'
    when 'outfit' then 'Outfit'
    when 'paz_mental' then 'Paz Mental'
    when 'finanzas' then 'Finanzas'
    when 'voz' then 'Voz'
    else new.module
  end;
  insert into public.agent_notification_log (user_id, key, kind, title, body, payload)
  select admin.id, 'modreq_' || new.id::text, 'admin_module_request',
         'Pedido de acceso a ' || mod_label,
         coalesce((select coalesce(p.display_name, p.full_name, p.email) from public.profiles p where p.id = new.user_id), 'Un usuario') || ' pidió acceso a ' || mod_label || '.',
         jsonb_build_object('userId', new.user_id, 'module', new.module, 'requestId', new.id)
  from public.profiles admin where admin.role = 'admin'
  on conflict (user_id, key) do nothing;
  return new;
end;
$fn$;
