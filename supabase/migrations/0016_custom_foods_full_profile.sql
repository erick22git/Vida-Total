-- 0016 — custom_foods: perfil completo + fecha de edición, y default de la meta de agua (NO aplicada). Única migración de esta tanda.
--
-- Idempotente (add column if not exists / set default). Sin DROP, DELETE ni UPDATE de filas. Requiere 0002.
--
-- Por qué: la tabla solo tiene columnas para parte del perfil de un alimento, así que al sincronizar se perdían las grasas
-- mono/poliinsaturadas, omega-3/6, agua, ceniza, alcohol, EPA/DHA, el perfil COCIDO completo y las marcas
-- verificado / configurado / estadoDefault / unSoloEstado / fdcIdCrudo. Esta migración agrega UNA columna JSON con todo eso y la
-- fecha de la última edición (para decidir qué lado gana al fusionar). Los micronutrientes nuevos (biotina, yodo, cromo,
-- molibdeno, flúor, cloruro) NO necesitan columna: ya viajan dentro de `micronutrientes` (jsonb).
--
-- Retrocompatible: la app detecta si estas columnas existen; si no, guarda sin ellas y no pierde nada local.
-- Orden: se puede aplicar ANTES o DESPUÉS de subir el código nuevo.

alter table public.custom_foods
  add column if not exists perfil_extra jsonb;

-- Sin default ni NOT NULL a propósito: las filas que ya existen quedan en null (la app las trata como «sin fecha» y gana el
-- dato local), en vez de aparecer todas como «editadas ahora».
alter table public.custom_foods
  add column if not exists updated_at timestamptz;

-- Meta de agua por defecto: la columna remota usa 2000 ml y la app 2500 ml (src/lib/store/gymStore.ts). La DRI (agua total 3,7 L
-- hombres / 2,7 L mujeres; ~81 % como bebidas ≈ 3,0 L y 2,2 L) deja 2000 ml por debajo de lo observado en ambos sexos y 2500 ml
-- cerca del punto medio (2,6 L), así que el valor de la app es el respaldado y se alinea el SQL. Solo cambia el DEFAULT para
-- filas NUEVAS: no toca ninguna fila existente ni ninguna meta ya guardada. Reemplaza a 0011 (no hace falta aplicar las dos).
alter table public.gym_settings
  alter column water_goal_ml set default 2500;

comment on column public.custom_foods.perfil_extra is
  'Resto del perfil sin columna propia: grasasMonoinsaturadas, grasasPoliinsaturadas, omega3Ala, omega6Linoleico, agua, ceniza, alcohol, epa, dha, epaDha (mg), cocido (perfil completo), verificado, configurado, estadoDefault, unSoloEstado, fdcIdCrudo. Un 0 es un dato; una clave ausente es «sin dato».';
comment on column public.custom_foods.updated_at is
  'Última edición hecha en la app (la manda el cliente). Decide qué lado gana al fusionar datos locales y remotos.';
