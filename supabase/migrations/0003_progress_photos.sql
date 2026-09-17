-- Bloque 13: historial de qué plan de entrenamiento estuvo activo en qué
-- rango de fechas, y fotos de progreso mensuales asociadas a ese plan.

alter table public.gym_workout_state
  add column if not exists plan_history jsonb not null default '[]';

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month_key text not null, -- "yyyy-MM"
  photo_url text not null, -- data URL, mismo criterio que recipes.foto
  plan_id uuid references public.training_plans (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, month_key)
);
select public.apply_own_rows_rls('progress_photos');
