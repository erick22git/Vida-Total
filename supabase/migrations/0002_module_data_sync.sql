-- ============================================================================
-- 0002_module_data_sync.sql
--
-- Bloque 1 (sync entre dispositivos): una tabla por tipo de dato de usuario
-- en cada módulo (Gym/Calorías, Hábitos, Outfit, Finanzas, Paz Mental, Voz),
-- para reemplazar el localStorage-only que usan hoy los stores de Zustand.
--
-- Diseño:
--   - Cada tabla tiene `user_id uuid references auth.users` y RLS: cada
--     usuario solo puede leer/escribir sus propias filas.
--   - Estructuras anidadas/variables dentro de una entidad (subtareas de una
--     tarea, ingredientes de una receta, sets de un ejercicio, etc.) se
--     guardan como `jsonb` en vez de normalizarse en tablas hijas — es el
--     mismo shape que ya usan los tipos de TypeScript (ver src/lib/types/),
--     así el mapeo store <-> fila es directo. Lo que SÍ es una entidad con
--     su propia identidad (un alimento registrado, una sesión de
--     entrenamiento, una transacción) tiene su propia tabla.
--   - `logged_foods.orden` existe para el reordenamiento por arrastre del
--     Bloque 6 (posición dentro de una comida), y `meal`/`logged_date` para
--     poder mover un ítem de comida sin perder su fecha real.
--   - La sesión de entrenamiento EN CURSO (activeSession/restTimer/etc.) NO
--     se sincroniza a propósito: es estado transitorio de un solo
--     dispositivo que cambia constantemente (cada serie, cada segundo del
--     descanso) — sincronizarla generaría muchísimo tráfico de escritura
--     para algo que no tiene sentido "continuar en otro dispositivo" a
--     mitad de una serie. Sigue viviendo en localStorage; solo la sesión ya
--     TERMINADA (workout_sessions) sincroniza.
--
-- Cómo correr esta migración: igual que 0001_admin_foundation.sql — pégala
-- completa en el SQL Editor de Supabase (Dashboard -> tu proyecto -> SQL
-- Editor -> New query -> Run), o `supabase db push` si usas el CLI.
-- ============================================================================

-- ── Helper: aplica las 4 policies estándar (select/insert/update/delete,
-- todas "solo tus propias filas") a una tabla que ya tiene columna user_id.
-- Evita repetir el mismo bloque ~35 veces. Se corre una vez por tabla más
-- abajo. ──────────────────────────────────────────────────────────────────
create or replace function public.apply_own_rows_rls(table_name text) returns void as $$
begin
  execute format('alter table public.%I enable row level security', table_name);
  execute format(
    'create policy %I on public.%I for select using (user_id = auth.uid())',
    table_name || '_select_own', table_name
  );
  execute format(
    'create policy %I on public.%I for insert with check (user_id = auth.uid())',
    table_name || '_insert_own', table_name
  );
  execute format(
    'create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())',
    table_name || '_update_own', table_name
  );
  execute format(
    'create policy %I on public.%I for delete using (user_id = auth.uid())',
    table_name || '_delete_own', table_name
  );
exception when duplicate_object then
  -- Ya se corrió antes para esta tabla (re-ejecutar la migración no falla).
  null;
end;
$$ language plpgsql;

-- ============================================================================
-- GYM — Calorías
-- ============================================================================

create table if not exists public.gym_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  calorie_goal numeric not null default 2000,
  protein_goal numeric not null default 140,
  carbs_goal numeric not null default 220,
  fat_goal numeric not null default 60,
  water_goal_ml numeric not null default 2000,
  tracked_nutrients jsonb not null default '["azucares","fibra","sodio","grasasSaturadas"]',
  show_remaining boolean not null default true,
  dashboard_prefs jsonb not null default '{"showOtherNutrients":true,"showWeekStrip":true,"showFinishDayButton":true}',
  day_finished_date date,
  drink_overrides jsonb not null default '{}',
  hidden_drink_ids jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
select public.apply_own_rows_rls('gym_settings');

create table if not exists public.logged_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null,
  nombre text not null,
  calorias numeric not null,
  proteina numeric not null,
  carbos numeric not null,
  grasas numeric not null,
  meal text not null check (meal in ('desayuno','almuerzo','cena','snack1','snack2')),
  logged_date date not null default current_date,
  logged_at timestamptz not null default now(),
  cantidad numeric,
  porcion_nombre text,
  gramos numeric,
  photo_url text,
  cooked_state text check (cooked_state in ('cocido','crudo')),
  activo boolean not null default true,
  source text check (source in ('escaner-ia')),
  orden integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists logged_foods_user_date_meal_idx on public.logged_foods (user_id, logged_date, meal, orden);
select public.apply_own_rows_rls('logged_foods');

create table if not exists public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  meal text not null check (meal in ('desayuno','almuerzo','cena','snack1','snack2')),
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('meal_templates');

create table if not exists public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  marca text,
  categoria text not null,
  porcion text not null,
  peso_gramos numeric,
  calorias numeric not null,
  proteina numeric not null,
  carbos numeric not null,
  grasas numeric not null,
  grasas_saturadas numeric,
  grasas_trans numeric,
  colesterol numeric,
  sodio numeric,
  fibra numeric,
  azucares numeric,
  azucares_anadidos numeric,
  micronutrientes jsonb,
  photo_url text,
  barcode text,
  porciones jsonb,
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('custom_foods');

create table if not exists public.favorite_foods (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);
select public.apply_own_rows_rls('favorite_foods');

create table if not exists public.custom_portions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id text not null,
  nombre text not null,
  gramos numeric not null
);
select public.apply_own_rows_rls('custom_portions');

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  foto text,
  porciones integer not null default 1,
  tiempo_prep_min integer not null default 0,
  tipos jsonb not null default '[]',
  ingredientes jsonb not null default '[]',
  instrucciones jsonb not null default '[]',
  totales jsonb not null default '{}',
  favorito boolean not null default false,
  fuente text check (fuente in ('manual','foto','enlace','ia')),
  enlace text,
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('recipes');

create table if not exists public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ml numeric not null,
  logged_at timestamptz not null default now(),
  drink_id text,
  drink_nombre text,
  drink_emoji text
);
create index if not exists water_entries_user_idx on public.water_entries (user_id, logged_at);
select public.apply_own_rows_rls('water_entries');

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_date date not null,
  grupo_muscular text not null,
  ejercicios jsonb not null default '[]',
  completado boolean not null default false,
  nombre text,
  duration_seconds integer,
  routine_id text,
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('workout_sessions');

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  ejercicios jsonb not null default '[]',
  times_completed integer not null default 0,
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('routines');

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  contexto text,
  categoria text,
  notas text,
  dias jsonb not null default '[]',
  activo boolean not null default false,
  days_per_week integer,
  mins_per_session integer,
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('training_plans');

create table if not exists public.gym_workout_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_plan_id uuid references public.training_plans (id) on delete set null,
  weekly_plan jsonb not null default '[]',
  excluded_from_global_rank jsonb not null default '[]',
  streak integer not null default 0,
  last_workout_completed_date date,
  kegel_level integer not null default 1,
  kegel_streak integer not null default 0,
  kegel_last_session_date date,
  kegel_total_sessions integer not null default 0,
  updated_at timestamptz not null default now()
);
select public.apply_own_rows_rls('gym_workout_state');

create table if not exists public.custom_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  categoria text not null,
  musculo_primario text,
  musculos_secundarios jsonb not null default '[]',
  equipo text,
  nivel text,
  instrucciones jsonb not null default '[]',
  imagen text,
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('custom_exercises');

create table if not exists public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kg numeric not null,
  entry_date date not null
);
select public.apply_own_rows_rls('weight_entries');

-- ============================================================================
-- HÁBITOS
-- ============================================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'media' check (priority in ('alta','media','baja')),
  due_date date,
  time_slot integer,
  is_completed boolean not null default false,
  subtasks jsonb not null default '[]',
  tags jsonb not null default '[]',
  color text,
  icon text,
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('tasks');

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  color text,
  frequency text not null default 'diario' check (frequency in ('diario','semanal')),
  streak integer not null default 0,
  completed_dates jsonb not null default '[]',
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('habits');

create table if not exists public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  start_hour integer not null,
  end_hour integer not null,
  color text,
  icon text,
  title text not null
);
select public.apply_own_rows_rls('time_blocks');

create table if not exists public.notion_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  icon text,
  blocks jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
select public.apply_own_rows_rls('notion_pages');

create table if not exists public.kanban_columns (
  user_id uuid not null references auth.users (id) on delete cascade,
  column_id text not null check (column_id in ('por-hacer','en-progreso','hecho')),
  title text not null,
  task_ids jsonb not null default '[]',
  primary key (user_id, column_id)
);
select public.apply_own_rows_rls('kanban_columns');

-- ============================================================================
-- OUTFIT
-- ============================================================================

create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  color text,
  season text not null default 'todo' check (season in ('verano','invierno','todo')),
  image_url text,
  times_worn integer not null default 0,
  last_worn date,
  cost numeric,
  date_added date not null default current_date
);
select public.apply_own_rows_rls('clothing_items');

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  item_ids jsonb not null default '[]',
  occasion text not null check (occasion in ('casual','formal','deporte','fiesta')),
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('outfits');

create table if not exists public.weekly_outfit_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start_date date not null,
  day_outfits jsonb not null default '{}',
  unique (user_id, week_start_date)
);
select public.apply_own_rows_rls('weekly_outfit_plans');

-- ============================================================================
-- FINANZAS
-- ============================================================================

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  color text,
  type text not null check (type in ('ingreso','gasto'))
);
select public.apply_own_rows_rls('finance_categories');

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('ingreso','gasto')),
  amount numeric not null,
  category_id text not null,
  note text,
  entry_date date not null,
  currency text not null default 'PEN' check (currency in ('PEN','USD','EUR')),
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on public.transactions (user_id, entry_date);
select public.apply_own_rows_rls('transactions');

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null,
  monthly_limit numeric not null,
  budget_month text not null,
  unique (user_id, category_id, budget_month)
);
select public.apply_own_rows_rls('budgets');

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  deadline date,
  icon text,
  color text
);
select public.apply_own_rows_rls('savings_goals');

-- ============================================================================
-- PAZ MENTAL
-- ============================================================================

create table if not exists public.meditation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_type text not null check (session_type in ('guiada','respiracion','libre')),
  duration integer not null,
  session_date date not null,
  sounds_used jsonb not null default '[]'
);
select public.apply_own_rows_rls('meditation_sessions');

create table if not exists public.mood_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  level integer not null check (level between 1 and 5),
  emoji text,
  note text,
  gratitude_items jsonb not null default '[]'
);
select public.apply_own_rows_rls('mood_entries');

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  title text not null,
  content text not null default '',
  mood integer check (mood between 1 and 5),
  tags jsonb not null default '[]'
);
select public.apply_own_rows_rls('journal_entries');

create table if not exists public.anger_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  trigger text,
  intensity integer check (intensity between 1 and 10),
  technique text,
  outcome text
);
select public.apply_own_rows_rls('anger_episodes');

create table if not exists public.skincare_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  product_type text,
  condition text not null check (condition in ('Acné','Rosácea','Manchas','General')),
  is_active boolean not null default true,
  effectiveness integer check (effectiveness between 1 and 5)
);
select public.apply_own_rows_rls('skincare_products');

create table if not exists public.skincare_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  product_ids jsonb not null default '[]',
  skin_condition integer check (skin_condition between 1 and 5),
  notes text
);
select public.apply_own_rows_rls('skincare_logs');

create table if not exists public.assistant_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  sent_at timestamptz not null default now(),
  suggested_href text,
  suggested_label text
);
select public.apply_own_rows_rls('assistant_chat_messages');

-- ============================================================================
-- VOZ & COMUNICACIÓN
-- ============================================================================

create table if not exists public.voice_recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text,
  entry_date date not null,
  duration_sec integer not null,
  note text
);
select public.apply_own_rows_rls('voice_recordings');

create table if not exists public.voice_lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  entry_date date not null,
  primary key (user_id, lesson_id)
);
select public.apply_own_rows_rls('voice_lesson_progress');

create table if not exists public.body_language_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  entry_date date not null,
  quiz_score integer,
  quiz_total integer,
  primary key (user_id, lesson_id)
);
select public.apply_own_rows_rls('body_language_progress');
