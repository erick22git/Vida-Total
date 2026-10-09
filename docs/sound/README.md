# Sonido — fuentes y licencias

Dos sistemas de sonido conviven a propósito:

- **`src/lib/sound/sound-engine.ts`** (viejo, sin cambios de alcance): sintetizado 100% con Web Audio
  (osciladores), usado por Hábitos/Kegel/descanso (`press`, `complete`, `milestone`, `level-up`,
  `navigation`, `error`, `rest-end`, `kegel-*`). Esta fase le agregó dos funciones nuevas,
  **también sintetizadas** (`playWaterPour`, `playWaterSplash` — ver más abajo, agua sigue PROVISIONAL).
- **`src/lib/sound/sound-manager.ts`** (nuevo de esta fase): reproduce archivos reales vía `howler`,
  mapeados en `public/sounds/manifest.json` (evento → 1-3 variantes + volumen + variación de tono).
  Apagado por defecto (`usePreferencesStore.soundEnabled`); nada se carga (ni `howler` ni el
  manifiesto) hasta que se prende y hay un primer gesto (`unlockSoundManager()`).

## Tabla de sonidos

Todos los archivos reales son **CC0** (Kenney.nl) — no requieren atribución, pero se las damos de
todas formas. "Variantes" = cuántos archivos distintos tiene el evento (se elige uno al azar en cada
reproducción, con ±tono aleatorio). Tamaño total en disco (ogg+mp3, las 70 variantes reales): **~382 KB**
(bajo el presupuesto de 400 KB).

| Evento (manifest) | Dónde suena hoy | Variantes | Archivo origen (Kenney) | Fuente | Autor | Licencia | Fecha | Modificaciones |
|---|---|---|---|---|---|---|---|---|
| `button-tap` | Botones rápidos de Agua, toggle de agregar bebida | 3 | `click1/2/3.ogg` | [kenney.nl/assets/ui-audio](https://kenney.nl/assets/ui-audio) | Kenney Vleugels (kenney.nl) | CC0 1.0 | pack publicado 2017-10-28 | Transcodificado a OGG Vorbis 44.1kHz + MP3 64kbps (ya venía en OGG; se re-empaquetó solo para generar el MP3 de respaldo) |
| `picker-step` | Rueda de gramos (`DigitWheel`, Calorías) | 3 | `tick_001/002/004.ogg` | [kenney.nl/assets/interface-sounds](https://kenney.nl/assets/interface-sounds) | Kenney | CC0 1.0 | pack 1.0, 2020-02-11 | Igual que arriba |
| `carousel-change` | Carrusel del buscador y de páginas de nutrientes (`useSwipeCarousel`) | 3 | `select_001/002/003.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `scroll-snap` | (manifiesto listo; sin punto de enganche todavía — ver «Pendientes») | 1 | `select_004.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `screen-enter` / `modal-open` / `notification-appear` (alias, mismo archivo) | `GlassModal` y `Sheet` (Agenda) al abrir | 3 | `open_001/002/003.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `task-complete` | Hábito completado (`useHabitFeedback`) | 3 | `confirmation_001/002/003.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `milestone` / `goal-reached` (alias) | Hito de hábito/racha; meta de calorías cumplida (confeti) | 1 | `bong_001.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `add-item` | Agregar un alimento (botón "Agregar" en Calorías) | 3 | `drop_001/002/003.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `modal-close` / `notification-dismiss` (alias) | `GlassModal` y `Sheet` al cerrar | 3 | `close_001/002/003.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `notification-expand` | Isla dinámica: píldora → card | 3 | `maximize_001/002/003.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `notification-collapse` | Isla dinámica: card → píldora | 3 | `minimize_001/002/003.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `permission-prompt` | Notificación de permiso del agente (Permitir/Denegar/Siempre) | 3 | `question_001/002/003.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `error` | Error de pantalla en Calorías (`error.tsx`) | 3 | `error_001/003/005.ogg` | ídem | Kenney | CC0 1.0 | 2020-02-11 | ídem |
| `water-pour` | **PROVISIONAL** — vaso de Agua, chorro al agregar | — | — | — | — | — | — | Sintetizado (`playWaterPour`, ruido blanco filtrado pasa-banda, Web Audio). No se encontró un CC0 de agua cayendo en el tiempo disponible — ver «Pendientes». |
| `water-splash` | **PROVISIONAL** — vaso de Agua, salpicón al tocar el nivel | — | — | — | — | — | — | Sintetizado (`playWaterSplash`, ruido pasa-alto + "plink" tonal). Mismo motivo que arriba. |

Los eventos del motor viejo (`press`, `complete`, `milestone`, `level-up`, `navigation`, `rest-end`,
`kegel-*`) **no se tocaron**: siguen sintetizados tal cual estaban, fuera del alcance de esta fase
salvo donde `useHabitFeedback` migró explícitamente a los nuevos (`button-tap`, `task-complete`,
`milestone`) según la lista de eventos pedida.

## Grabaciones propias sugeridas (si el usuario quiere grabar)

Para reemplazar el agua (lo único provisional), lo más simple y con mejor resultado sería que el
usuario grabe él mismo con el micrófono del teléfono:
1. **Chorro de agua** (3-5 s): grifo o botella sirviendo en un vaso, sin música de fondo ni eco fuerte.
2. **Salpicón** (una toma corta, <1 s): dedo o cuchara tocando agua en un vaso, varias tomas para
   tener variantes.

Un archivo mono, 44.1kHz, normalizado a un pico de -3dB aprox., recortado al sonido (sin silencio
largo alrededor) alcanza. Al tenerlo: reemplazar la entrada del evento en `manifest.json` (agregar
`files`, quitar `synth: "provisional"`) y copiar el archivo a `public/sounds/` en OGG + MP3.

## Fuentes evaluadas y descartadas

- **Mixkit, Pixabay Audio**: prohíben redistribuir el archivo de audio suelto fuera de su plataforma
  (solo permiten usarlo embebido en el proyecto final, no en un repo público de código) — no se usó
  ninguno.
- **Freesound**: tiene audios CC0 reales, pero requiere filtrar manualmente por licencia por archivo
  (no hay un pack curado); con el tiempo disponible, los packs de Kenney cubrieron todos los eventos
  salvo agua con una licencia más simple de verificar (CC0 de pack completo, no por archivo).
- **Sonniss GDC packs**: su licencia por pack varía (algunos packs sí son de redistribución libre,
  otros no) — no se bajó ninguno porque los de Kenney ya cubrían la lista completa.
- **BBC Sound Effects (RemArc)** y **CC-BY-NC/CC-BY-SA**: excluidos por instrucción explícita (no
  compatibles con un repo público de uso comercial/sin restricción de atribución compleja).

## Pendientes

- `scroll-snap` tiene archivo y entrada en el manifiesto pero **no está conectado a ningún snap point
  real todavía** (scroll continuo no debe sonar, solo los puntos de ajuste — no se encontró, en el
  tiempo de esta fase, un único lugar compartido donde todos los "snap" del proyecto pasen; cada
  carrusel/rueda tiene su propio código). Conectarlo requiere identificar snap points página por
  página.
- `water-pour`/`water-splash` siguen sintetizados (ver tabla). Reemplazar en cuanto haya un archivo
  real (grabación propia o un CC0 encontrado después).
- Cobertura de eventos: esta fase conectó un conjunto representativo (ver tabla "Dónde suena hoy"),
  no CADA botón/entrada de pantalla de la app — el sistema (manifiesto + `playEvent`) queda listo
  para conectar el resto incrementalmente sin tocar `public/sounds/`.
