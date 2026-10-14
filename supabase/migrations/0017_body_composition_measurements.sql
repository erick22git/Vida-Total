-- ============================================================================
-- 0017 — body_composition_entries / body_measurement_entries (PROPUESTA, NO aplicada)
--
-- SOLO ADITIVA e idempotente. Requiere 0002 (usa public.apply_own_rows_rls).
--
-- Hueco que cubre: el perfil avanzado de Entrenamiento (composición corporal de báscula de
-- bioimpedancia y perímetros corporales, con historial por fecha — `bodyCompositionHistory` /
-- `bodyMeasurementHistory` en src/lib/store/gymStore.ts) solo vive en el dispositivo y se pierde al
-- cambiar de teléfono o limpiar el navegador, igual que `gym_profile` (0010).
--
-- Igual que 0010: para que sirva falta escribir el sync en src/lib/sync/gym-sync.ts; esa parte NO
-- está hecha. Cada medición es una fila nueva (nunca se actualiza una existente): el historial se
-- arma por fecha para poder graficar tendencia.
-- ============================================================================

create table if not exists public.body_composition_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  grasa_pct numeric check (grasa_pct is null or (grasa_pct >= 0 and grasa_pct <= 100)),
  masa_muscular_pct numeric check (masa_muscular_pct is null or (masa_muscular_pct >= 0 and masa_muscular_pct <= 100)),
  grasa_visceral numeric,
  agua_pct numeric check (agua_pct is null or (agua_pct >= 0 and agua_pct <= 100)),
  masa_osea_kg numeric check (masa_osea_kg is null or masa_osea_kg > 0),
  metabolismo_basal_kcal numeric check (metabolismo_basal_kcal is null or metabolismo_basal_kcal > 0),
  photo_url text, -- data URL, mismo criterio que progress_photos.photo_url; sin cálculo automático todavía
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('body_composition_entries');

create table if not exists public.body_measurement_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  cuello_cm numeric check (cuello_cm is null or cuello_cm > 0),
  pecho_cm numeric check (pecho_cm is null or pecho_cm > 0),
  cintura_cm numeric check (cintura_cm is null or cintura_cm > 0),
  cadera_cm numeric check (cadera_cm is null or cadera_cm > 0),
  brazo_relajado_cm numeric check (brazo_relajado_cm is null or brazo_relajado_cm > 0),
  brazo_contraido_cm numeric check (brazo_contraido_cm is null or brazo_contraido_cm > 0),
  muslo_cm numeric check (muslo_cm is null or muslo_cm > 0),
  pantorrilla_cm numeric check (pantorrilla_cm is null or pantorrilla_cm > 0),
  created_at timestamptz not null default now()
);
select public.apply_own_rows_rls('body_measurement_entries');
