-- ============================================================================
-- aplicar-pendientes.sql — migraciones 0003 a 0008, en orden
--
-- Se puede correr DOS (o más) veces sin dañar datos:
--   · solo ADITIVO: create table / index IF NOT EXISTS, add column IF NOT EXISTS, y las policies pasan por
--     public.apply_own_rows_rls (que ignora las que ya existen).
--   · NO hay DROP de tablas, columnas ni policies, ni DELETE/UPDATE de filas, ni TRUNCATE.
-- Va dentro de UNA transacción: si algo falla, no queda nada a medias (todo o nada).
--
-- ANTES: corre supabase/verificar-migraciones.sql para ver qué ya existe (esto es seguro aunque ya esté todo).
-- Requiere que 0001 y 0002 ya estén aplicadas (el bloque de abajo lo comprueba y aborta con un mensaje claro).
--
-- Cada bloque es EL MISMO texto que su archivo en supabase/migrations/. Si cambias una migración, regenera este archivo.
-- NO incluye 0009–0011 (son propuestas, ver docs/migraciones-pendientes.md).
-- ============================================================================

begin;

-- Comprobación previa: sin 0001/0002 no se puede seguir.
do $$
begin
  if to_regclass('public.training_plans') is null
     or to_regclass('public.habits') is null
     or to_regclass('public.recipes') is null
     or to_regclass('public.gym_workout_state') is null
     or to_regprocedure('public.apply_own_rows_rls(text)') is null then
    raise exception 'Faltan las migraciones 0001/0002 (training_plans, habits, recipes, gym_workout_state o apply_own_rows_rls). Aplícalas primero.';
  end if;
end $$;

-- ############################################################################
-- 0003_progress_photos.sql
-- ############################################################################

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

-- ############################################################################
-- 0004_habits_extended.sql
-- ############################################################################

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

-- ############################################################################
-- 0005_habit_progress_source.sql
-- ############################################################################

-- ============================================================================
-- 0005 — Fuente de progreso de un hábito (integración Hábitos ↔ Gym)
--
-- SOLO ADITIVA e idempotente: no borra ni modifica columnas/filas existentes. Se puede volver a ejecutar.
-- Requiere que 0002/0004 ya estén corridas (usa la tabla `habits`).
--
-- `habits.source_id`: de qué módulo puede venir "ya cumpliste esto" (ver src/lib/habits/progress-sources.ts):
--   'gym.water' | 'gym.calories' | 'gym.workout'
--   'none' = el usuario lo dejó sin vínculo
--   NULL   = sin valor guardado → la app usa la fuente por defecto de la categoría (hábitos anteriores a esta migración)
--
-- La colección de figuras 3D (Hábitos/Gym) NO se guarda: se deriva de `category_id` (src/lib/habits/category-config.ts).
-- El progreso de figura y el desbloqueo tampoco: se derivan de `completed_dates` (ya persistido).
-- ============================================================================

alter table public.habits
  add column if not exists source_id text;

create index if not exists habits_user_source_idx
  on public.habits (user_id, source_id)
  where source_id is not null;

-- ############################################################################
-- 0006_kegel_session_log.sql
-- ############################################################################

-- ============================================================================
-- 0006_kegel_session_log.sql
--
-- Registro de sesiones Kegel completadas por día.
--
-- Propósito: sincronizar kegelPlanStore (completed: Record<dayKey, sessionId[]>)
-- entre dispositivos, con patrón merge-safe (una fila por día+sesión, idempotente
-- vía ON CONFLICT DO NOTHING).
--
-- Diseño:
--   - Una fila por (user_id, day_key, session_id) — granularidad mínima.
--   - `partial` = true si la sesión se interrumpió; no cuenta para racha/nivel.
--   - `completed_at` = timestamp UTC del servidor al insertar (para resolución
--     de conflictos entre dispositivos: gana la más antigua, es decir, la
--     primera vez que el usuario la completó ese día).
--   - ON CONFLICT DO NOTHING asegura idempotencia: reinsertar la misma sesión
--     del mismo día no cambia nada (merge-safe).
--   - RLS: cada usuario solo puede leer/escribir sus propias filas.
--
-- IMPORTANTE: NO aplicar este archivo manualmente — esperar a que el equipo
-- revise y lo ejecute en el entorno correcto.
-- ============================================================================

create table if not exists public.kegel_session_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  day_key     date not null,           -- 'YYYY-MM-DD' local del usuario
  session_id  text not null,           -- p.ej. 'sesion-1'
  partial     boolean not null default false,
  completed_at timestamptz not null default now(),

  -- Idempotencia: el mismo usuario no puede tener dos filas para el mismo
  -- (día, sesión) completa. Permite varias filas partial para auditoría.
  constraint kegel_session_log_unique unique nulls not distinct (user_id, day_key, session_id)
);

-- Índice para fetchear todos los días de un usuario
create index if not exists kegel_session_log_user_idx
  on public.kegel_session_log (user_id, day_key);

-- RLS
select public.apply_own_rows_rls('kegel_session_log');

-- ############################################################################
-- 0007_habit_routines_dias_semana.sql
-- ############################################################################

-- ============================================================================
-- 0007 — habit_routines: columnas dias_semana y ends_at
--
-- SOLO ADITIVA e idempotente. Requiere que 0004 ya esté corrida.
--
-- Agrega:
--   dias_semana integer[] — días activos (convencion Date.getDay(): 0=dom…6=sáb)
--                           null = activa todos los días.
--   ends_at     date      — fin opcional de la rutina; null = sin fin.
-- ============================================================================

alter table public.habit_routines
  add column if not exists dias_semana integer[],
  add column if not exists ends_at date;

-- ############################################################################
-- 0008_recipes_verificado.sql
-- ############################################################################

-- 0008 — Recetas: campo `verificado` (igual que en alimentos).
--
-- NO aplicada todavía: ejecutarla a mano en el SQL Editor de Supabase cuando se decida.
-- Hasta entonces la app funciona igual: `verificado` va en su propia escritura (syncRecipeVerified en
-- src/lib/sync/gym-sync.ts) que falla sola si la columna no existe, sin afectar el resto de la receta.
--
-- Importante: `verificado = true` solo debe salir de la acción manual "Verificar" de la app (nunca de un script
-- ni de una migración), por eso el default es false y esta migración no marca ninguna fila.
-- TODO: restringir esa acción al rol admin cuando exista el sistema de roles.

alter table public.recipes
  add column if not exists verificado boolean not null default false;

commit;
