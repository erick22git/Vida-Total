-- ============================================================================
-- 0010 — gym_profile (PROPUESTA, NO aplicada)
--
-- SOLO ADITIVA e idempotente. Requiere 0002 (usa public.apply_own_rows_rls).
--
-- Hueco que cubre: `gymProfile` / `onboardingCompleted` (src/lib/store/gymStore.ts, interface GymProfile) no tienen
-- ninguna tabla: el perfil corporal (peso, altura, sexo, edad, actividad, objetivo, modo PRO, perfil de
-- entrenamiento) solo vive en el dispositivo y se pierde al cambiar de teléfono o limpiar el navegador.
-- Ver docs/plan/relacion-modulos.md (sección 3).
--
-- Una fila por usuario. Todas las columnas de datos son opcionales (el perfil se llena de a pedazos). Las sincronización
-- debe hacerse con merge por campo (updateGymProfileFields), nunca reemplazando la fila entera con vacíos.
-- Para que sirva falta escribir el sync en src/lib/sync/gym-sync.ts; esa parte NO está hecha.
-- ============================================================================

create table if not exists public.gym_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  peso_kg numeric check (peso_kg is null or peso_kg > 0),
  altura_cm numeric check (altura_cm is null or altura_cm > 0),
  lesiones text,
  objetivo text,
  sexo text check (sexo is null or sexo in ('hombre','mujer')),
  edad integer check (edad is null or edad > 0),
  nivel_actividad text check (nivel_actividad is null or nivel_actividad in ('sedentario','ligero','moderado','intenso','muy_intenso')),
  objetivo_calorico text check (objetivo_calorico is null or objetivo_calorico in ('perder','mantener','ganar')),
  intensidad_objetivo text,
  modo_pro boolean,
  grasa_corporal_pct numeric,
  metodo_grasa_corporal text check (metodo_grasa_corporal is null or metodo_grasa_corporal in ('manual','navy')),
  medida_cuello_cm numeric,
  medida_cintura_cm numeric,
  medida_cadera_cm numeric,
  experiencia text check (experiencia is null or experiencia in ('menos_6m','6m_2a','2_5a','mas_5a')),
  dias_por_semana integer,
  minutos_por_sesion integer,
  equipo text check (equipo is null or equipo in ('gimnasio','mancuernas','peso_corporal')),
  intensidad_entrenamiento text check (intensidad_entrenamiento is null or intensidad_entrenamiento in ('ligera','moderada','alta')),
  onboarding_completed boolean not null default false,
  updated_at timestamptz not null default now()
);
select public.apply_own_rows_rls('gym_profile');
