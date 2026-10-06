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
