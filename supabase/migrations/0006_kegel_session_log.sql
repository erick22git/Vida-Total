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
