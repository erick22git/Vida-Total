-- ============================================================================
-- 0018_suscripciones_onboarding.sql
--
-- Suscripción por transferencia (QR bancario) con confirmación MANUAL del admin,
-- onboarding de usuario nuevo y tutorial guiado.
--
-- IMPORTANTE: el pago NO se confirma solo. El QR es de una transferencia bancaria: no hay webhook ni API.
-- El usuario sube un comprobante y un admin lo aprueba desde la app (extiende `access_until` y desbloquea).
--
-- Cómo correrla: Dashboard de Supabase -> SQL Editor -> pegar TODO -> Run. Es idempotente.
-- ============================================================================

-- ── profiles: onboarding y tutorial ─────────────────────────────────────────
alter table public.profiles add column if not exists onboarding_done boolean not null default false;
alter table public.profiles add column if not exists tutorial_seen boolean not null default false;

-- Los usuarios que YA existían no deben pasar por el onboarding ni por el tutorial al desplegar esto.
update public.profiles set onboarding_done = true, tutorial_seen = true where created_at < now();

-- La policy `profiles_update_own_basic_fields` (0001) ya deja que un usuario edite su propia fila salvo role / is_blocked /
-- access_from / access_until, así que puede marcar SU onboarding_done y tutorial_seen sin cambios extra.

-- ── app_settings: clave/valor global (el QR de pago vive acá) ───────────────
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.app_settings is
  'Ajustes globales. Claves usadas: payment_qr_payload (texto exacto decodificado del QR del banco), payment_amount_label, payment_instructions.';

alter table public.app_settings enable row level security;

-- Cualquier usuario logueado puede LEER (necesita el payload para mostrar el QR de pago); solo un admin escribe.
drop policy if exists "app_settings_select_authenticated" on public.app_settings;
create policy "app_settings_select_authenticated"
  on public.app_settings for select
  using (auth.uid() is not null);

drop policy if exists "app_settings_insert_admin" on public.app_settings;
create policy "app_settings_insert_admin"
  on public.app_settings for insert
  with check (public.is_admin());

drop policy if exists "app_settings_update_admin" on public.app_settings;
create policy "app_settings_update_admin"
  on public.app_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── payment_requests: comprobantes subidos por el usuario ──────────────────
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Ruta dentro del bucket privado `comprobantes` (<user_id>/<archivo>). NULL si el usuario avisó sin adjuntar.
  receipt_path text,
  note text,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists payment_requests_user_idx on public.payment_requests (user_id, created_at desc);
create index if not exists payment_requests_status_idx on public.payment_requests (status, created_at desc);

alter table public.payment_requests enable row level security;

drop policy if exists "payment_requests_select_own_or_admin" on public.payment_requests;
create policy "payment_requests_select_own_or_admin"
  on public.payment_requests for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "payment_requests_insert_own" on public.payment_requests;
create policy "payment_requests_insert_own"
  on public.payment_requests for insert
  with check (user_id = auth.uid() and status = 'pendiente');

drop policy if exists "payment_requests_update_admin" on public.payment_requests;
create policy "payment_requests_update_admin"
  on public.payment_requests for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── Storage: bucket privado para los comprobantes ───────────────────────────
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- El usuario sube y ve SOLO su carpeta (<user_id>/...); un admin ve todo.
drop policy if exists "comprobantes_insert_own" on storage.objects;
create policy "comprobantes_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "comprobantes_select_own_or_admin" on storage.objects;
create policy "comprobantes_select_own_or_admin"
  on storage.objects for select
  using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
