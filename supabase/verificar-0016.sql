-- ============================================================================
-- verificar-0016.sql — SOLO LECTURA
--
-- Dice si la migración 0016 ya está en la base: las columnas nuevas de custom_foods. No crea, modifica ni borra nada: solo
-- consulta el catálogo y cuenta filas. Se puede correr las veces que quieras en el SQL Editor de Supabase.
--
-- Cómo leer el resultado:
--   existe = true  → la columna está (debe ser true en las dos).   false → corre supabase/aplicar-0016.sql
--   migracion_completa = true → todo listo.
-- ============================================================================

with esperadas(columna, tipo) as (
  values ('perfil_extra', 'jsonb'), ('updated_at', 'timestamp with time zone')
),
estado as (
  select
    e.columna,
    e.tipo as tipo_esperado,
    c.data_type as tipo_real,
    (c.column_name is not null) as existe,
    (c.data_type = e.tipo) as tipo_ok
  from esperadas e
  left join information_schema.columns c
    on c.table_schema = 'public' and c.table_name = 'custom_foods' and c.column_name = e.columna
)
select
  columna,
  existe,
  tipo_real,
  coalesce(tipo_ok, false) as tipo_ok,
  bool_and(existe and coalesce(tipo_ok, false)) over () as migracion_completa
from estado
order by columna;

-- ----------------------------------------------------------------------------
-- Informativo: cuántos alimentos propios hay y cuántos ya guardan el perfil completo (solo si las columnas existen).
-- Si la migración no está aplicada, esta consulta falla con «column does not exist»: es lo esperado, aplica primero.
-- ----------------------------------------------------------------------------
select
  count(*) as alimentos_propios,
  count(perfil_extra) as con_perfil_extra,
  count(*) filter (where perfil_extra ? 'cocido') as con_cocido,
  count(updated_at) as con_fecha
from public.custom_foods;
