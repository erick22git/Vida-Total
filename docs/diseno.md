# Documento de diseño — Vida Total

Documento vivo: **cada cambio de diseño actualiza este archivo** (regla desde la auditoría de
librerías + sonido + modales negros + notificaciones, 2026-10-09).

## Principios y tokens

- **Negro, sin vidrio, para lo que se despliega sobre el contenido** (modales, notificaciones, panel
  de la mascota). Las tarjetas y botones del contenido normal (Glass*) se quedan como están — esto
  NO es un rediseño de toda la app, solo de lo que se "despliega encima".
- Colores reutilizados de la mascota y la Agenda:
  | Token | Valor | Uso |
  |---|---|---|
  | Fondo del panel | `#0b0b0c` | `ExpandSheet`, `MascotDock`, `DynamicIsland` expandida |
  | Borde del panel | `rgba(255,255,255,0.09)` | idem |
  | Sombra del panel | `0 18px 60px rgba(0,0,0,0.75)` | idem |
  | Backdrop | `rgba(0,0,0,0.6–0.7)` | detrás de cualquier panel desplegado |
  | Superficie Agenda | `#1c1c1e` | fondo de pantallas de Agenda (sin cambios) |
  | Tarjeta Agenda | `#2b2b2e` | `Sheet` de Agenda (sin cambios, ver abajo) |
  | Chip | `#3b3b3f` | chips/pills oscuros |
  | Botón claro | `#f4f4f5` | CTA primario sobre fondo negro, cuando hace falta contraste fuerte |
- Radios grandes en lo que se despliega: `32px` (`rounded-[32px]` / `rounded-t-[32px]`).
- Tipografía: la mono existente (`MONO_FONT`, `var(--font-geist-mono)`) para headers/labels en
  mayúscula; el resto, la fuente por defecto de la app.
- Movimiento: `framer-motion` en todo el proyecto (no se agregó ninguna otra librería de animación).
  `prefers-reduced-motion` (resuelto siempre vía `useEffectiveReduceMotion()`,
  `src/lib/store/preferencesStore.ts`) reduce TODO lo nuevo de esta fase a un fundido simple, sin
  mover ni escalar nada.

## Modales desplegables

### Librería investigada: libraries.dev (Jakubantalik)

Repo: [github.com/Jakubantalik/libraries.dev](https://github.com/Jakubantalik/libraries.dev) — MIT.
Siete paquetes: `border-beam`, `thinking-orbs`, `bot-avatars`, `liquid-gooey`, `voice-glow`,
`metal-fx`, `img-fx`.

**La candidata del prompt (`liquid-gooey`) se descartó — no es el patrón de notificación.**
`liquid-gooey` es morphing de formas tipo "goo" (blobs que se fusionan, `Liquid`/`Liquid.Item`,
props `blur`/`contrast`/`fill`, efectos `morph`/`move`/`melt`/`bend`/`dissolve`). Ninguno de los 7
paquetes del repo implementa una card que se despliega estilo notificación de iPhone — se confirmó
leyendo el README de cada paquete (ver también Fase 1 del prompt). No se instaló ningún paquete de
libraries.dev: nada de código se copió de ahí.

**Por lo tanto: `ExpandSheet` es propio**, siguiendo a mano el patrón de notificación expandible de
iPhone (resorte + fundido + opcional arrastre), no un port de ninguna librería externa.

### Componente: `ExpandSheet`

`src/components/shared/expand-sheet.tsx` — mismo contrato de props que el `GlassModal` que
reemplaza (`open`, `onClose`, `title`, `headerStart`, `children`), para migrar cada caso cambiando
solo el import.

| Propiedad | Valor |
|---|---|
| Fondo del panel | `#0b0b0c` sólido, sin blur |
| Backdrop | `bg-black/70` |
| Radio | `32px` arriba (bottom sheet en mobile) / los 4 lados en desktop |
| Resorte de entrada/salida | `{ type: "spring", damping: 30, stiffness: 360, mass: 0.9 }` |
| Transform de entrada | `opacity 0→1`, `y: 56→0`, `scale: 0.96→1` (se despliega "desde abajo") |
| `prefers-reduced-motion` | Solo `opacity 0→1`, `duration: 0.15` — sin mover ni escalar |
| Arrastrar para cerrar | `drag="y"`, elástico solo hacia abajo (`dragElastic={{top:0, bottom:0.4}}`); cierra a 120px u 600px/s de velocidad |
| Trampa de foco | Propia (sin dependencia nueva): enfoca el primer elemento focuseable al abrir, atrapa Tab/Shift+Tab dentro del panel, devuelve el foco a quien abrió el sheet al cerrar |
| Teclado | `useKeyboardInset()` (ya existía, `src/lib/ui/use-keyboard-inset.ts`) — el panel usa `--vv-h`/`--vv-top` |
| `aria-modal` | `true`, `role="dialog"`, `aria-label` = `title` |
| Escape | Cierra |
| Safe-area | `pb-[max(env(safe-area-inset-bottom),16px)]` en el contenido |
| Sonido/háptica | `playEvent("modal-open"/"modal-close")` + `haptic("light")` al abrir/cerrar (una vez por transición) |

**Qué se diferencia de la "referencia" (libraries.dev):** nada se copia de ahí — no hay referencia
real que seguir, así que no hay diferencia que documentar más allá de "se construyó desde cero".

### GlassModal → ExpandSheet: migración completa

`GlassModal` (`src/components/glass/glass-modal.tsx`, fondo con vidrio/blur + framer-motion) **se
eliminó** — sus 39 usos se migraron a `ExpandSheet` (mismo import, misma lógica, contenido y
formularios intactos). Verificado sin usos restantes (`grep GlassModal` → solo comentarios de
prosa, corregidos).

| Archivo | Qué abre |
|---|---|
| `components/gym/calorie-settings-sheet.tsx` | 3 sheets: Configuración de calorías, Revisar sugerencia de macros, **Configurar macros** |
| `components/gym/exercise-session-builder.tsx` | 4: agregar **ejercicio**, escalera de reps, reemplazar ejercicio, agrupar ejercicios |
| `app/.../gym/entrenamiento/activo/page.tsx` | 5: selector de **ejercicio**, agregar, notas del ejercicio, "próximamente" (IA), uno más |
| `components/nav/user-menu.tsx` | Cuenta / cerrar sesión |
| `app/.../gym/entrenamiento/rango/page.tsx` | Ajustes de la pantalla de Rango |
| `components/gym/recipe-ingredient-picker.tsx` | Selector de ingredientes de **receta** |
| `app/.../gym/calorias/escaner/page.tsx` | Modal del escáner de código de barras |
| `app/.../gym/entrenamiento/rutinas/[routineId]/editar/page.tsx` | Edición de **rutina** |
| `app/.../gym/entrenamiento/rutinas/nueva/page.tsx` | Nueva **rutina** |
| `components/gym/manual-entry-modal.tsx` | Entrada manual de calorías |
| `components/gym/drink-volume-sheet.tsx` | Volumen de bebida (**Agua**) |
| `components/gym/edit-plan-modal.tsx` | Editar planificación |
| `components/gym/exercise-summary-tab.tsx` | Ayuda "Cómo registrar el peso" |
| `components/gym/dropset-weights-modal.tsx` | Pesos de dropset |
| `app/(dashboard)/finanzas/page.tsx` | Modal de Finanzas (resumen) |
| `components/gym/drink-edit-modal.tsx` | Editar bebida (**Agua**) |
| `components/admin/edit-access-dates-modal.tsx` | Fechas de acceso (admin) |
| `components/admin/confirm-modal.tsx` | Confirmación genérica (admin) |
| `app/.../gym/entrenamiento/rutinas/[routineId]/page.tsx` | Renombrar **rutina** |
| `components/habitos/task-modal.tsx` | Tarea de Hábitos |
| `components/outfit/day-outfit-modal.tsx` | Outfit del día |
| `components/outfit/clothing-form-modal.tsx` | Crear/editar prenda |
| `app/(dashboard)/habitos/workspace/page.tsx` | Modal del workspace de Hábitos |
| `components/gym/drink-settings-modal.tsx` | Ajustes de bebidas (**Agua**) |
| `components/gym/drink-picker-modal.tsx` | Elegir bebida (**Agua**) |
| `app/(dashboard)/paz-mental/diario/page.tsx` | Entrada de diario |
| `components/gym/weight-entry-modal.tsx` | Registrar peso |
| `components/gym/create-exercise-modal.tsx` | Crear **ejercicio** |
| `components/gym/rest-duration-modal.tsx` | Duración de descanso |
| `app/.../gym/entrenamiento/rachas/page.tsx` | "¿Cómo funciona la racha?" |
| `app/(dashboard)/finanzas/transacciones/page.tsx` | Modal de transacción |
| `app/(dashboard)/finanzas/metas/page.tsx` | Modal de meta financiera |
| `app/(dashboard)/finanzas/presupuestos/page.tsx` | Modal de presupuesto |
| `app/(dashboard)/paz-mental/ira/page.tsx` | Modal de registro de ira |
| `app/(dashboard)/paz-mental/piel/page.tsx` | Modal de registro de piel |
| `app/.../gym/entrenamiento/activo/racha/page.tsx` | "¿Cómo funciona la racha?" (Entrenamiento) |
| `components/gym/filter-modal.tsx` | Filtros |
| `components/gym/set-type-modal.tsx` | Tipo de serie (**Entrenamiento**) |
| `components/outfit/clothing-detail-modal.tsx` | Detalle de prenda |

Cubre los 7 módulos pedidos explícitamente: Entrenamiento (ejercicios, rutinas, set-type),
Calorías (`calorie-settings-sheet`), macros (dentro del mismo archivo), editar (rutina, planificación,
bebida), Recetas (`recipe-ingredient-picker`), Agua (picker/volumen/ajustes/editar bebida) y Rutinas.

### Lo que NO se tocó (y por qué)

- **`src/components/agenda/sheet.tsx`** (`Sheet` de Agenda): es su propio componente negro
  (`#2b2b2e`, sin vidrio) ya alineado en espíritu con esta fase, pero con una forma distinta
  (variants `y:"100%"→0`, botón "•••" propio, radio `32` ya aplicado) y usado solo dentro del módulo
  de Agenda (6 archivos). No estaba en la lista de módulos pedidos explícitamente (Entrenamiento,
  Calorías, macros, editar, Recetas, Agua, Rutinas) y ya cumple "fondo negro, sin vidrio" — se le
  agregó el mismo gancho de sonido/háptica de abrir/cerrar (Fase 2) pero se dejó sin migrar a
  `ExpandSheet` para no tocar un módulo completo fuera de alcance en esta pasada. Si se quiere
  unificar después, es un cambio acotado (mismo patrón de props).
- **`app/.../gym/calorias/recetas/crear/page.tsx`**: no es un modal — es una pantalla completa
  (`fixed inset-0`) con su propio diseño oscuro ya aplicado (comentario explícito en el archivo:
  "en vez de `GlassModal`"). Queda igual.
- **El panel de la mascota (`MascotDock`)**: ya es negro puro, sin vidrio, con su propio resorte
  (`damping: 32, stiffness: 340`, entra desde arriba). Se dejó TAL CUAL (no se unificó con
  `ExpandSheet`) porque entra desde un borde distinto (arriba, no abajo) y porque la Adenda de la
  Isla Dinámica cambia cómo entra/sale la mascota en un paso aparte — unificarlo ahora se habría
  deshecho en el siguiente paso.

## Notificaciones e isla dinámica

_(completado en la Fase 4 / Adenda — ver más abajo en este mismo documento)_

## Sonido

Ver [`docs/sound/README.md`](../sound/README.md) — manifiesto de eventos, licencias por archivo
(todas CC0, Kenney.nl) y qué sigue sintetizado (agua, provisional).

## Pendientes

- `scroll-snap` (sonido) sin conectar a un snap point real todavía.
- `water-pour`/`water-splash` siguen sintetizados — falta una grabación real o un CC0 encontrado.
- Cobertura de sonido: conjunto representativo conectado, no cada botón de la app (el sistema queda
  listo para conectar el resto incrementalmente).
- Unificar `Sheet` de Agenda y el panel de la mascota con `ExpandSheet` si se decide después.
