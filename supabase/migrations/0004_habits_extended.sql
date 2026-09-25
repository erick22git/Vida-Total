-- ============================================================================
-- 0004 — Hábitos extendido (Fase 13)
--
-- SOLO ADITIVA e idempotente: no borra ni modifica columnas/filas existentes.
-- Se puede volver a ejecutar sin errores. Requiere que 0002 ya esté corrida
-- (usa la tabla `habits` y la función `apply_own_rows_rls`).
--
-- 1) Columnas nuevas en `habits`: categoría, tipo/objetivo, días, recordatorio,
--    misión, dominado y hitos ya vistos (hoy solo existían en el dispositivo).
-- 2) `habit_completions`: una fila por hábito y día con su valor (5/8 vasos,
--    20/30 min) — historial real para hábitos de cantidad/tiempo.
-- 3) `habit_routines`: las rutinas de Hábitos (pasos vinculados a hábitos).
-- ============================================================================

-- 1) habits ------------------------------------------------------------------
alter table public.habits
  add column if not exists category_id text,
  add column if not exists type text not null default 'binario'
    check (type in ('binario','cantidad','tiempo')),
  add column if not exists goal integer check (goal is null or goal > 0),
  add column if not exists unit text,
  add column if not exists scheduled_days jsonb,            -- ej. [1,2,3,4,5]; null = todos los días
  add column if not exists reminder text,                   -- "HH:mm"
  add column if not exists mission text,
  add column if not exists mastered boolean not null default false,
  add column if not exists milestones_unlocked jsonb not null default '[]';

-- 2) habit_completions -------------------------------------------------------
create table if not exists public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  completed_date date not null,
  value numeric not null default 1 check (value >= 0),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, completed_date)
);
create index if not exists habit_completions_user_habit_date_idx
  on public.habit_completions (user_id, habit_id, completed_date);
alter table public.habit_completions enable row level security;
select public.apply_own_rows_rls('habit_completions');

-- 3) habit_routines ----------------------------------------------------------
create table if not exists public.habit_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  items jsonb not null default '[]',
  completed_dates jsonb not null default '[]',
  streak integer not null default 0,
  milestones_unlocked jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.habit_routines enable row level security;
select public.apply_own_rows_rls('habit_routines');
