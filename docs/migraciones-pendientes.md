# Migraciones de Supabase: estado, orden y verificación

Nada de esto se ejecutó contra producción. Todo el SQL se revisó con el parser de PostgreSQL (sintaxis), pero **no se corrió contra una base real**: usa primero `verificar-migraciones.sql`.

## 1. Migraciones del repo (`supabase/migrations/`)

| # | Qué crea o cambia | Estado |
|---|---|---|
| 0001 `admin_foundation` | Tablas `profiles`, `user_module_access`, `admin_audit_log`; funciones `handle_new_user`, `is_admin`; trigger `on_auth_user_created` (en `auth.users`); 10 policies con nombre propio. **No es re-ejecutable** (`create policy`/`create trigger` sin IF NOT EXISTS). | Se da por aplicada (login y panel admin funcionan). Confírmalo con la verificación. |
| 0002 `module_data_sync` | Función `apply_own_rows_rls(tabla)` y 36 tablas de datos por usuario (Gym, Hábitos, Outfit, Finanzas, Paz mental, Voz), con RLS "solo tus filas" (4 policies cada una) y 3 índices. | Se da por aplicada. |
| 0003 `progress_photos` | Columna `gym_workout_state.plan_history`; tabla `progress_photos` + RLS. | **Pendiente (confirmar)** |
| 0004 `habits_extended` | 9 columnas en `habits` (`category_id, type, goal, unit, scheduled_days, reminder, mission, mastered, milestones_unlocked`); tablas `habit_completions` y `habit_routines` + índice + RLS. | **Pendiente** |
| 0005 `habit_progress_source` | Columna `habits.source_id` + índice parcial. | **Pendiente (confirmar)** |
| 0006 `kegel_session_log` | Tabla `kegel_session_log` (unique `nulls not distinct`, requiere PostgreSQL 15+, Supabase lo cumple) + índice + RLS. El código todavía **no la usa**. | Pendiente, opcional |
| 0007 `habit_routines_dias_semana` | Columnas `habit_routines.dias_semana` (int[]) y `ends_at` (date). | **Pendiente** |
| 0008 `recipes_verificado` | Columna `recipes.verificado boolean not null default false`. No marca ninguna fila como verificada. | **Pendiente** |
| 0009 `logged_foods_recipe_id` | **Propuesta.** `logged_foods.recipe_id uuid` (sin FK) + índice parcial. | No aplicar todavía (ver sección 5) |
| 0010 `gym_profile` | **Propuesta.** Tabla `gym_profile` (perfil corporal, una fila por usuario) + RLS. | No aplicar todavía |
| 0011 `water_goal_default` | **Propuesta, reemplazada por 0016** (el mismo cambio va dentro de 0016; no hace falta aplicar las dos). | No aplicar |

"Pendiente (confirmar)" = lo más probable es que falte, pero `verificar-migraciones.sql` lo dice con certeza.

## 2. Cómo correrlas (SQL Editor de Supabase)

1. Dashboard → tu proyecto → **SQL Editor → New query**.
2. Pega **`supabase/verificar-migraciones.sql`** y **Run**. Es solo lectura. Verás una fila por objeto con `existe` y `migracion_completa`. Filtra `existe = false` para ver lo que falta.
   - Esperado: 0001 y 0002 en `true`; 0003–0008 muestran qué falta; 0009–0011 en `false` (son propuestas).
3. Haz un **respaldo** si hay datos que te importan (Dashboard → Database → Backups; o `pg_dump`). Las migraciones son aditivas, pero es buena costumbre.
4. Pega **`supabase/aplicar-pendientes.sql`** y **Run**. Aplica 0003 a 0008 en orden, dentro de una transacción (todo o nada) y se puede repetir sin problema. Si 0001/0002 no están, aborta con un mensaje claro y no cambia nada.
5. Vuelve a correr `verificar-migraciones.sql`: 0003–0008 deben salir `migracion_completa = true`.
6. Abre la app, mueve un hábito/receta y revisa la consola del navegador: no deben aparecer `[gym-sync] … falló` ni `[habits-sync] … falló`.

Si tu base ya tiene algunas de 0003–0008, no importa: lo que existe se salta. Si prefieres no crear `kegel_session_log` todavía, borra el bloque 0006 de ese archivo antes de correrlo (no depende de nada y nada depende de él).

## 3. Cómo comprobar el resultado (a mano)

```sql
-- columnas nuevas
select table_name, column_name from information_schema.columns
where table_schema='public' and (
  (table_name='gym_workout_state' and column_name='plan_history') or
  (table_name='habits' and column_name in ('category_id','type','goal','unit','scheduled_days','reminder','mission','mastered','milestones_unlocked','source_id')) or
  (table_name='habit_routines' and column_name in ('dias_semana','ends_at')) or
  (table_name='recipes' and column_name='verificado'));
-- policies de las tablas nuevas
select tablename, policyname from pg_policies
where schemaname='public' and tablename in ('progress_photos','habit_completions','habit_routines','kegel_session_log') order by 1,2;
-- ninguna receta quedó verificada por la migración (debe dar 0)
select count(*) from public.recipes where verificado;
```

## 4. Qué falla en el código ya desplegado mientras no se apliquen

Los datos **locales** nunca se pierden: lo que falla es la **sincronización** (queda una advertencia en consola y la app sigue). Los datos solo se quedan en ese dispositivo.

| Falta | Efecto |
|---|---|
| **0003** | `upsertGymWorkoutState` envía `plan_history` en **cada** guardado: si la columna no existe falla **todo** el upsert de `gym_workout_state` (plan activo, plan semanal, racha, nivel/racha de Kegel, historial de planes dejan de sincronizar entre dispositivos). Las fotos de progreso mensuales (`progress_photos`) tampoco suben. |
| **0004** | `habitToRow` envía las 9 columnas nuevas en cada alta: **los hábitos nuevos no se insertan** y las ediciones que tocan esas columnas fallan (el reintento sin columna solo cubre `source_id`). `habit_completions` (valores por día de hábitos de cantidad/tiempo) y `habit_routines` (rutinas de la agenda, incluidas las de Mi Rutina) no se sincronizan. |
| **0005** | Está contemplada: el código reintenta sin `source_id`. Solo se pierde el vínculo hábito ↔ agua/calorías/entreno en otro dispositivo (vuelve al valor por defecto de la categoría). Funciona **solo si 0004 está aplicada**; sin 0004 el error nombra otra columna y el reintento no sirve. |
| **0006** | Ninguno: el código define las funciones de Kegel pero no las llama. |
| **0007** | `routineToRow` envía `dias_semana` y `ends_at` en cada guardado: **ninguna rutina se sincroniza** (incluye los días de la semana de las rutinas reales). Requiere 0004. |
| **0008** | La verificación de recetas va en su propia escritura, así que falla sola sin romper nada más. La verificación queda solo local y, al volver a iniciar sesión, el servidor (que manda en filas existentes) puede dejarla en "sin verificar". |

## 5. Huecos de esquema detectados (migraciones nuevas, sin aplicar)

Comparé cada `*Row` del código de sync con las columnas del SQL (finanzas, outfit, hábitos, gym, recetas, tareas, páginas, columnas kanban, etc.): **no falta ninguna columna** fuera de las migraciones pendientes de arriba. Las tablas de Paz mental y Voz usan filas sin tipo (no las pude contrastar columna a columna). Huecos reales:

1. **`logged_foods.recipe_id`** → `0009`. `LoggedFood.recipeId` (alimentos que vienen de expandir una receta) solo vive en local. Se propone un uuid **sin FK** a propósito: una FK haría fallar el insert si la receta aún no se sincronizó. Falta además mapearlo en `LoggedFoodRow` (código, no incluido).
2. **Perfil corporal sin tabla** → `0010 gym_profile`. `gymProfile` (peso, altura, sexo, edad, actividad, objetivo, modo PRO, perfil de entrenamiento) y `onboardingCompleted` no se sincronizan: se pierden al cambiar de teléfono. Falta escribir su sync (código, no incluido). Detalle en `docs/plan/relacion-modulos.md`.
3. **Default de agua** → `0011`. App 2500 ml vs. SQL 2000 ml.
4. Sin hueco, pero a tener en cuenta: `finance_categories` existe y el código no la usa; `kegel_session_log` existe (0006) y el código no la llama.

## 6. Cómo revertir cada una

Ten un respaldo antes: **revertir borra datos** de lo que se creó. Solo hazlo si la migración causó un problema; dejarlas aplicadas es inofensivo (son aditivas).

```sql
-- 0008
alter table public.recipes drop column if exists verificado;
-- 0007
alter table public.habit_routines drop column if exists dias_semana, drop column if exists ends_at;
-- 0006 (borra el registro de sesiones de Kegel)
drop table if exists public.kegel_session_log;
-- 0005
drop index if exists public.habits_user_source_idx;
alter table public.habits drop column if exists source_id;
-- 0004 (borra valores diarios y rutinas sincronizadas; los datos locales de la app siguen)
drop table if exists public.habit_routines;
drop table if exists public.habit_completions;
alter table public.habits
  drop column if exists category_id, drop column if exists type, drop column if exists goal, drop column if exists unit,
  drop column if exists scheduled_days, drop column if exists reminder, drop column if exists mission,
  drop column if exists mastered, drop column if exists milestones_unlocked;
-- 0003 (borra las fotos de progreso sincronizadas)
drop table if exists public.progress_photos;
alter table public.gym_workout_state drop column if exists plan_history;
-- Propuestas (si llegaras a aplicarlas)
drop index if exists public.logged_foods_recipe_idx;  alter table public.logged_foods drop column if exists recipe_id;   -- 0009
drop table if exists public.gym_profile;                                                                                 -- 0010
alter table public.gym_settings alter column water_goal_ml set default 2000;                                             -- 0011
```

Al revertir, las policies de una tabla borrada desaparecen con ella. Revertir 0003–0007 deja de nuevo al código sin esas columnas: vuelven los fallos de sync de la sección 4.

## 7. Archivos

- `supabase/verificar-migraciones.sql`: solo lectura.
- `supabase/aplicar-pendientes.sql`: 0003–0008, idempotente, en una transacción, sin DROP/DELETE. Es la concatenación literal de los archivos de `migrations/` (si editas uno, regenera este).
- `supabase/migrations/0009`, `0010`, `0011`: propuestas, sin aplicar. Ojo: `supabase db push` las aplicaría si usas el CLI; mueve o renombra esos tres archivos si no quieres que entren.

## 8. Migraciones del agente (0012 a 0015)

Nuevas, **sin aplicar**. Se aplican juntas con `supabase/aplicar-agente.sql` (aditivo, idempotente, una transacción) y se comprueban con `supabase/verificar-agente.sql` (solo lectura). Requieren 0001 y 0002. Detalle y avisos de RLS en `docs/telegram.md` (Paso 2); el programador de avisos, en `docs/notificaciones.md`.

| # | Qué crea |
|---|---|
| 0012 `agent_settings` | `agent_settings`, `agent_action_log`, `agent_llm_usage` (contador de llamadas al modelo) |
| 0013 `tasks_reminder` | `tasks.reminder` |
| 0014 `telegram_agent` | `telegram_links`, `telegram_link_codes`, `telegram_updates`, `agent_pending`, `agent_chat_state`, `agent_commands` |
| 0015 `agent_notifications` | `agent_notification_log` |

## 9. Migración 0016 (campos nuevos del alimento, sync sin pérdida y default de agua)

Nueva, **sin aplicar**. Es la **única** migración de la tanda de Calorías «cierre». Aditiva e idempotente (`add column if not exists`, `set default`), sin DROP, DELETE ni UPDATE de filas, en una transacción.

| Qué hace | Detalle |
|---|---|
| `custom_foods.perfil_extra` (jsonb) | Lleva todo lo que no tenía columna: grasas mono/poliinsaturadas, omega-3/6, agua, ceniza, alcohol, EPA/DHA, el perfil **cocido** completo, `verificado`, `configurado`, `estadoDefault`, `unSoloEstado`, `fdcIdCrudo`. |
| `custom_foods.updated_at` (timestamptz, sin default) | Última edición hecha en la app: decide qué lado gana al fusionar. Las filas que ya existen quedan en `null` (gana el dato local). |
| `gym_settings.water_goal_ml` default **2500** | Alinea el SQL (2000) con la app (2500); respaldo en `docs/ciencia-nutricion.md`. Solo filas nuevas; no cambia metas ya guardadas. |

Los micronutrientes nuevos (biotina, yodo, cromo, molibdeno, flúor, cloruro) **no necesitan columna**: viajan dentro de `micronutrientes` (jsonb).

**Cómo aplicarla** (SQL Editor de Supabase): 1) `supabase/verificar-0016.sql` (solo lectura, debe mostrar `existe = false` antes); 2) `supabase/aplicar-0016.sql`; 3) `verificar-0016.sql` otra vez: `migracion_completa = true` y `default_ok = true`. Si cambias la migración, regenera el script con `node scripts/build-aplicar-0016.mjs`.

**Es retrocompatible:** la app funciona igual **antes y después** de aplicarla. Sin las columnas, guarda sin ellas (y avisa en la consola solo en desarrollo) y no pierde nada local; cuando las aplicas, la siguiente hidratación sube lo que faltaba.
