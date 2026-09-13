-- ============================================================================
-- 0001_admin_foundation.sql
--
-- Base de datos para: roles de usuario (admin vs usuario normal), estado de
-- bloqueo/activación de cuenta con rango de fechas de acceso, y qué módulos
-- tiene habilitados cada usuario. Esto NO construye el panel de admin (eso
-- es trabajo de una migración/entrega posterior) — solo sienta el schema,
-- el trigger de auto-creación de perfil, y las políticas de RLS.
--
-- Cómo correr esta migración (elige UNA opción):
--
--   OPCIÓN A — Dashboard de Supabase (recomendada si no usas el CLI):
--     1. Entra a https://supabase.com/dashboard -> tu proyecto.
--     2. Ve a "SQL Editor" (ícono de la izquierda) -> "New query".
--     3. Pega el contenido COMPLETO de este archivo.
--     4. Click en "Run" (o Ctrl+Enter). Debe terminar sin errores.
--
--   OPCIÓN B — Supabase CLI (si ya tienes el proyecto vinculado con
--   `supabase link`):
--     supabase db push
--
-- ============================================================================

-- ── Extensión necesaria para gen_random_uuid() ──────────────────────────────
create extension if not exists pgcrypto;

-- ── Tabla profiles ───────────────────────────────────────────────────────────
-- Un perfil por usuario de auth.users. Se crea automáticamente vía el
-- trigger handle_new_user (más abajo) cuando alguien se registra.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  -- Fecha desde la que la cuenta tiene acceso. Por defecto "ahora" (hoy).
  access_from date not null default now(),
  -- Fecha hasta la que la cuenta tiene acceso. NULL = acceso indefinido
  -- (sin fecha de vencimiento).
  access_until date,
  -- Bloqueo manual por parte de un admin (p.ej. pago pendiente). IMPORTANTE:
  -- esto NO corta el acceso a la app — ver src/app/(dashboard)/layout.tsx,
  -- que solo muestra un aviso. Lo que se haga con este flag en la UI es
  -- decisión de la app, no de la base de datos.
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil extendido de cada usuario de auth.users: rol, vigencia de acceso y estado de bloqueo.';

-- ── Tabla user_module_access ─────────────────────────────────────────────────
-- Qué módulos de la app tiene habilitados cada usuario. Sin fila para un
-- (user_id, module) dado, la app posterior deberá decidir el default
-- (sugerido: enabled=true, es decir "habilitado salvo que se deshabilite
-- explícitamente") — esta migración no inserta filas por defecto para no
-- acoplarse a esa decisión de producto.
create table if not exists public.user_module_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  module text not null check (
    module in (
      'gym_calorias',
      'gym_entrenamiento',
      'habitos',
      'outfit',
      'paz_mental',
      'finanzas',
      'voz'
    )
  ),
  enabled boolean not null default true,
  primary key (user_id, module)
);

comment on table public.user_module_access is
  'Qué módulos de la app tiene habilitados cada usuario (control fino del admin).';

-- ── Tabla admin_audit_log ────────────────────────────────────────────────────
-- Bitácora de acciones administrativas (cambios de rol, bloqueos, cambios
-- de módulos, etc.) que hará el futuro panel de admin.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Bitácora de acciones administrativas sobre usuarios (rol, bloqueo, módulos, etc.).';

-- ============================================================================
-- Trigger: auto-crear el perfil al registrarse
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Función helper: is_admin()
-- ============================================================================
-- SECURITY DEFINER + search_path fijo para poder leer profiles.role desde
-- dentro de una policy sin recursión infinita de RLS (la función evalúa con
-- los privilegios de quien la definió, no del usuario que dispara la
-- policy).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.user_module_access enable row level security;
alter table public.admin_audit_log enable row level security;

-- ── profiles: SELECT ─────────────────────────────────────────────────────
-- Un usuario puede leer SU PROPIO perfil completo (incluye role/is_blocked/
-- access_until: necesita verlos para saber su propio estado, aunque no
-- pueda cambiarlos — ver policies de UPDATE abajo). Un admin puede leer
-- cualquier perfil.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- ── profiles: UPDATE (usuario normal, columnas NO administrativas) ─────────
-- Un usuario normal puede actualizar su propia fila, pero SOLO puede
-- tocar full_name/email (nunca role/is_blocked/access_until/access_from) —
-- eso se fuerza comparando esas columnas contra el valor ya almacenado en
-- la cláusula WITH CHECK.
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
  );

-- ── profiles: UPDATE (admin, cualquier fila, cualquier columna) ────────────
drop policy if exists "profiles_update_admin_full" on public.profiles;
create policy "profiles_update_admin_full"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── profiles: INSERT ─────────────────────────────────────────────────────
-- El insert normal lo hace el trigger handle_new_user (security definer,
-- corre como el dueño de la función, no como el usuario), así que no hace
-- falta una policy de INSERT para el flujo de registro. Se agrega igual una
-- policy mínima para que un admin pueda insertar perfiles manualmente si
-- hiciera falta.
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (public.is_admin());

-- ── user_module_access: SELECT ──────────────────────────────────────────
-- Un usuario puede ver sus propios módulos habilitados; un admin puede ver
-- los de cualquiera.
drop policy if exists "module_access_select_own_or_admin" on public.user_module_access;
create policy "module_access_select_own_or_admin"
  on public.user_module_access for select
  using (user_id = auth.uid() or public.is_admin());

-- ── user_module_access: INSERT/UPDATE/DELETE — solo admin ──────────────────
-- Los módulos habilitados de un usuario los decide el admin, nunca el
-- propio usuario.
drop policy if exists "module_access_write_admin" on public.user_module_access;
create policy "module_access_write_admin"
  on public.user_module_access for insert
  with check (public.is_admin());

drop policy if exists "module_access_update_admin" on public.user_module_access;
create policy "module_access_update_admin"
  on public.user_module_access for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "module_access_delete_admin" on public.user_module_access;
create policy "module_access_delete_admin"
  on public.user_module_access for delete
  using (public.is_admin());

-- ── admin_audit_log: SELECT — solo admin ────────────────────────────────
drop policy if exists "audit_log_select_admin" on public.admin_audit_log;
create policy "audit_log_select_admin"
  on public.admin_audit_log for select
  using (public.is_admin());

-- ── admin_audit_log: INSERT — solo admin (y solo a su propio nombre) ────────
drop policy if exists "audit_log_insert_admin" on public.admin_audit_log;
create policy "audit_log_insert_admin"
  on public.admin_audit_log for insert
  with check (public.is_admin() and admin_id = auth.uid());

-- admin_audit_log no lleva policies de UPDATE/DELETE a propósito: es una
-- bitácora de auditoría, no debería poder modificarse ni borrarse desde
-- el cliente (ni siquiera un admin) — con RLS habilitado y sin esas
-- policies, ambas operaciones quedan denegadas por defecto.

-- ============================================================================
-- Cómo marcar tu propia cuenta como admin (UNA VEZ que ya te hayas
-- registrado en la app con email+contraseña o con Google, para que exista
-- la fila en profiles):
--
--   UPDATE profiles SET role = 'admin' WHERE email = 'erickarancibia77@gmail.com';
--
-- Corre ese UPDATE en el mismo SQL Editor del dashboard, DESPUÉS de correr
-- todo lo de arriba y DESPUÉS de haberte registrado al menos una vez en la
-- app (el trigger handle_new_user necesita que auth.users ya tenga esa
-- cuenta para crear la fila en profiles).
-- ============================================================================
