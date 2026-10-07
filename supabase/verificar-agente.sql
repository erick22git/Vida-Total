-- ============================================================================
-- verificar-agente.sql — SOLO LECTURA
--
-- Dice si las migraciones del agente (0012 a 0015) ya están en la base y si cada tabla nueva tiene RLS activado. No crea,
-- modifica ni borra nada: solo consulta el catálogo. Se puede correr las veces que quieras en el SQL Editor de Supabase.
--
-- Cómo leer el resultado (una fila por objeto esperado):
--   existe      true = ya está · false = falta (corre supabase/aplicar-agente.sql)
--   rls_activo  true = la tabla tiene RLS activado (debe ser true en TODAS las tablas del agente)
--   politicas   cuántas políticas tiene (las 4 tablas «solo servidor» deben tener 1: la de «denegar todo»)
-- Al final, un resumen por migración (migracion_completa) y el estado de las extensiones del programador de avisos.
-- ============================================================================

with
tablas(migracion, tabla, politicas_esperadas) as (
  values
  ('0012','agent_settings',4),
  ('0012','agent_action_log',4),
  ('0012','agent_llm_usage',4),
  ('0014','telegram_links',2),
  ('0014','telegram_link_codes',1),
  ('0014','telegram_updates',1),
  ('0014','agent_pending',1),
  ('0014','agent_chat_state',1),
  ('0014','agent_commands',2),
  ('0015','agent_notification_log',2)
),
tabla_estado as (
  select
    t.migracion, 'tabla'::text as tipo, t.tabla as objeto,
    (c.oid is not null) as existe,
    coalesce(c.relrowsecurity, false) as rls_activo,
    (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t.tabla) as politicas,
    t.politicas_esperadas
  from tablas t
  left join pg_class c on c.relname = t.tabla and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
),
columnas(migracion, tabla, columna) as (
  values ('0013','tasks','reminder')
),
columna_estado as (
  select
    k.migracion, 'columna'::text as tipo, k.tabla || '.' || k.columna as objeto,
    exists (select 1 from information_schema.columns x where x.table_schema = 'public' and x.table_name = k.tabla and x.column_name = k.columna) as existe,
    true as rls_activo,
    0::bigint as politicas,
    0 as politicas_esperadas
  from columnas k
),
todo as (
  select * from tabla_estado
  union all
  select * from columna_estado
)
select
  migracion,
  tipo,
  objeto,
  existe,
  case when tipo = 'tabla' then rls_activo else null end as rls_activo,
  case when tipo = 'tabla' then politicas else null end as politicas,
  case when tipo = 'tabla' then (politicas >= politicas_esperadas) else null end as politicas_ok,
  bool_and(existe and (tipo <> 'tabla' or (rls_activo and politicas >= politicas_esperadas))) over (partition by migracion) as migracion_completa
from todo
order by migracion, tipo, objeto;

-- ----------------------------------------------------------------------------
-- Extensiones del programador de avisos (informativo; se activan en Database → Extensions).
-- ----------------------------------------------------------------------------
select e.name as extension, (i.extname is not null) as instalada, e.default_version as version_disponible
from (values ('pg_cron'), ('pg_net')) as v(name)
join pg_available_extensions e on e.name = v.name
left join pg_extension i on i.extname = e.name;
