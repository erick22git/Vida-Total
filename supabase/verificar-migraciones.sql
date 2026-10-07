-- ============================================================================
-- verificar-migraciones.sql — SOLO LECTURA
--
-- Dice qué objetos de cada migración YA existen en la base. No crea, modifica ni borra nada: solo consulta
-- information_schema, pg_indexes, pg_policies, pg_class y pg_proc. Se puede correr las veces que quieras en el
-- SQL Editor de Supabase (pega todo y "Run").
--
-- Cómo leer el resultado (una fila por objeto esperado):
--   existe             true = ya está en la base · false = falta
--   migracion_completa true = TODOS los objetos de esa migración existen (no hace falta correrla)
-- Para ver solo lo que falta, agrega al final:  where not existe   (o filtra la columna en la grilla).
--
-- 0001–0008 son las que están en el repo y el código ya usa. 0009–0011 son PROPUESTAS (no aplicadas, y el código
-- todavía no las usa): que salgan en false es lo esperado.
-- ============================================================================

with
-- Tablas con las 4 policies estándar "<tabla>_{select,insert,update,delete}_own" (public.apply_own_rows_rls).
rls_tables(migracion, tabla) as (
  values
  ('0002','gym_settings'),('0002','logged_foods'),('0002','meal_templates'),('0002','custom_foods'),
  ('0002','favorite_foods'),('0002','custom_portions'),('0002','recipes'),('0002','water_entries'),
  ('0002','workout_sessions'),('0002','routines'),('0002','training_plans'),('0002','gym_workout_state'),
  ('0002','custom_exercises'),('0002','weight_entries'),('0002','tasks'),('0002','habits'),
  ('0002','time_blocks'),('0002','notion_pages'),('0002','kanban_columns'),('0002','clothing_items'),
  ('0002','outfits'),('0002','weekly_outfit_plans'),('0002','finance_categories'),('0002','transactions'),
  ('0002','budgets'),('0002','savings_goals'),('0002','meditation_sessions'),('0002','mood_entries'),
  ('0002','journal_entries'),('0002','anger_episodes'),('0002','skincare_products'),('0002','skincare_logs'),
  ('0002','assistant_chat_messages'),('0002','voice_recordings'),('0002','voice_lesson_progress'),
  ('0002','body_language_progress'),
  ('0003','progress_photos'),
  ('0004','habit_completions'),('0004','habit_routines'),
  ('0006','kegel_session_log'),
  ('0010','gym_profile')
),
ops(op) as (values ('select'),('insert'),('update'),('delete')),
esperado(migracion, tipo, tabla, objeto) as (
  -- tablas
  select migracion, 'tabla', tabla, null from rls_tables
  union all
  values
  ('0001','tabla','profiles',null),('0001','tabla','user_module_access',null),('0001','tabla','admin_audit_log',null),
  -- funciones y triggers
  ('0001','funcion','handle_new_user',null),('0001','funcion','is_admin',null),
  ('0001','trigger','on_auth_user_created',null),
  ('0002','funcion','apply_own_rows_rls',null),
  -- policies de 0001 (nombres propios)
  ('0001','politica','profiles','profiles_select_own_or_admin'),
  ('0001','politica','profiles','profiles_update_own_basic_fields'),
  ('0001','politica','profiles','profiles_update_admin_full'),
  ('0001','politica','profiles','profiles_insert_admin'),
  ('0001','politica','user_module_access','module_access_select_own_or_admin'),
  ('0001','politica','user_module_access','module_access_write_admin'),
  ('0001','politica','user_module_access','module_access_update_admin'),
  ('0001','politica','user_module_access','module_access_delete_admin'),
  ('0001','politica','admin_audit_log','audit_log_select_admin'),
  ('0001','politica','admin_audit_log','audit_log_insert_admin'),
  -- índices
  ('0002','indice','logged_foods','logged_foods_user_date_meal_idx'),
  ('0002','indice','water_entries','water_entries_user_idx'),
  ('0002','indice','transactions','transactions_user_date_idx'),
  ('0004','indice','habit_completions','habit_completions_user_habit_date_idx'),
  ('0005','indice','habits','habits_user_source_idx'),
  ('0006','indice','kegel_session_log','kegel_session_log_user_idx'),
  ('0009','indice','logged_foods','logged_foods_recipe_idx'),
  -- restricciones
  ('0006','restriccion','kegel_session_log','kegel_session_log_unique'),
  -- columnas agregadas por migraciones posteriores
  ('0003','columna','gym_workout_state','plan_history'),
  ('0004','columna','habits','category_id'),('0004','columna','habits','type'),('0004','columna','habits','goal'),
  ('0004','columna','habits','unit'),('0004','columna','habits','scheduled_days'),('0004','columna','habits','reminder'),
  ('0004','columna','habits','mission'),('0004','columna','habits','mastered'),
  ('0004','columna','habits','milestones_unlocked'),
  ('0005','columna','habits','source_id'),
  ('0007','columna','habit_routines','dias_semana'),('0007','columna','habit_routines','ends_at'),
  ('0008','columna','recipes','verificado'),
  ('0009','columna','logged_foods','recipe_id'),
  -- valor por defecto
  ('0011','default','gym_settings','water_goal_ml=2500')
  union all
  -- policies estándar de cada tabla con RLS por usuario
  select t.migracion, 'politica', t.tabla, t.tabla || '_' || o.op || '_own'
  from rls_tables t cross join ops o
),
resultado as (
  select
    e.migracion, e.tipo, e.tabla, e.objeto,
    case e.tipo
      when 'tabla' then exists (
        select 1 from information_schema.tables x
        where x.table_schema = 'public' and x.table_name = e.tabla)
      when 'columna' then exists (
        select 1 from information_schema.columns x
        where x.table_schema = 'public' and x.table_name = e.tabla and x.column_name = e.objeto)
      when 'indice' then exists (
        select 1 from pg_indexes x
        where x.schemaname = 'public' and x.tablename = e.tabla and x.indexname = e.objeto)
      when 'politica' then exists (
        select 1 from pg_policies x
        where x.schemaname = 'public' and x.tablename = e.tabla and x.policyname = e.objeto)
      when 'funcion' then exists (
        select 1 from information_schema.routines x
        where x.routine_schema = 'public' and x.routine_name = e.tabla)
      when 'trigger' then exists (
        select 1 from information_schema.triggers x
        where x.trigger_name = e.tabla)
      when 'restriccion' then exists (
        select 1 from information_schema.table_constraints x
        where x.constraint_schema = 'public' and x.table_name = e.tabla and x.constraint_name = e.objeto)
      when 'default' then exists (
        select 1 from information_schema.columns x
        where x.table_schema = 'public' and x.table_name = e.tabla
          and x.column_name = split_part(e.objeto, '=', 1)
          and x.column_default is not null
          and x.column_default like split_part(e.objeto, '=', 2) || '%')
    end as existe
  from esperado e
)
select
  migracion,
  tipo,
  tabla,
  coalesce(objeto, '') as objeto,
  existe,
  bool_and(existe) over (partition by migracion) as migracion_completa
from resultado
order by migracion, tipo, tabla, objeto;
