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
