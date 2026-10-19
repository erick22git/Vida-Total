# Usuarios, suscripción, QR de pago y tutorial guiado

Qué hay, cómo funciona y qué NO hace. Todo lo nuevo sigue el diseño negro de `docs/diseno.md` (fondo #000, superficies #1c1c1e / #2b2b2e, botón claro #f4f4f5, sin vidrio).

## 1. Lo que ya existía y se reutilizó (auditoría previa)

- Roles `user` / `admin`, perfil, vigencia (`access_from` / `access_until`) y bloqueo (`is_blocked`): `supabase/migrations/0001_admin_foundation.sql`.
- Módulos por usuario (`user_module_access`), bitácora de auditoría, «entrar como este usuario» y el panel `/admin`.
- La mascota 2D (`components/agente/mascot.tsx`, con ánimos y trajes por agente) y su panel que baja desde arriba (`mascot-dock.tsx`, pestaña de ajustes).
- El panel de admin guardaba los toggles de módulos pero **la navegación del usuario no los leía**: eso es lo que se cerró.

## 2. Qué se agregó

| Pieza | Dónde |
|---|---|
| Módulos habilitados en la navegación (Sidebar y BottomNav) y bloqueo de la ruta de un módulo deshabilitado | `lib/account/modules.ts`, `components/account/module-access-gate.tsx`, `components/nav/*` |
| Estado de suscripción (activa / pendiente / vencida + próximo pago) | `lib/subscription.ts` |
| Pantalla de pago que reemplaza a los módulos cuando la suscripción está vencida o bloqueada | `components/pago/payment-gate.tsx`, aplicada en `app/(dashboard)/layout.tsx` |
| Árbol 3D tocable → transición → QR plano | `lib/3d/payment-scene.ts`, `lib/3d/payment-figures.ts`, `public/models/tree_payment_001_meshopt.glb` |
| QR: leer imagen → guardar texto → regenerar SVG | `lib/qr/qr.ts` (usa `@zxing/library`, ya instalada, y `qrcode`, nueva) |
| Subir comprobante y confirmar a mano | `lib/admin/payments.ts`, `components/admin/payment-admin.tsx` (`/admin/pagos`), `components/admin/subscription-card.tsx` (detalle de usuario) |
| Formulario inicial de usuario nuevo | `components/onboarding/onboarding-wizard.tsx` |
| Tutorial narrado por la mascota | `components/tutorial/guided-tour.tsx`, `lib/tutorial/steps.ts`, `lib/store/tourStore.ts` |
| Base de datos (migración **0018**, sin aplicar todavía) | `supabase/migrations/0018_suscripciones_onboarding.sql` |
| Dónde se configura todo | Mascota → Ajustes: «Tutorial guiado» (todos) y «Administración» → Usuarios / QR de pago (solo admin) |

## 3. Lo que NO es automático (importante)

**El pago se confirma a mano.** El QR es de una transferencia bancaria: no hay pasarela, webhook ni API que avise cuando llega el dinero, y no se simuló ninguna. El flujo es: el usuario transfiere → sube su comprobante → un admin lo ve en `/admin/pagos` (o en el detalle del usuario) y aprueba. Al aprobar: `access_until` pasa a **un mes después de hoy o de su vencimiento actual, lo que sea posterior**, `is_blocked` vuelve a `false`, el comprobante queda `aprobado` y se escribe en la bitácora.

**El bloqueo es de interfaz, no de datos.** Cuando la suscripción está vencida, el layout muestra la pantalla de pago en lugar de la app; los módulos deshabilitados se ocultan y su ruta muestra un aviso. Los datos siguen protegidos por RLS como antes, pero este bloqueo **no cierra la API de Supabase**: alguien técnico que llame a la API directamente seguiría leyendo SUS propios datos. Si hace falta un corte duro, habría que sumarlo en RLS.

**Cambio de criterio respecto de antes:** la 0001 y `getAccountNotice` decían que «bloquear nunca corta el acceso» (solo un banner). Ahora corta, por pedido explícito. Un admin nunca queda fuera de su app. Quien no tiene `access_until` (todos los usuarios actuales) sigue con acceso indefinido: desplegar esto no bloquea a nadie.

## 4. Estados de suscripción

| Estado | Condición |
|---|---|
| activa | no bloqueada y sin `access_until` vencido (o rol admin) |
| pendiente | acceso cortado y hay un comprobante `pendiente` sin revisar |
| vencida | acceso cortado y sin comprobante pendiente |

## 5. Regla del QR (no negociable)

1. El admin sube la imagen del QR de su banco en `/admin/pagos`.
2. Se **decodifica** con `@zxing/library` (es un código QR, no OCR de texto); se prueban varias resoluciones.
3. Se guarda el **texto exacto** en `app_settings.payment_qr_payload`. La imagen original nunca se guarda ni se muestra.
4. Cada vez que se muestra, se regenera como **SVG plano** (negro sobre blanco opaco, zona de silencio de 4 módulos, sin gradientes, transparencias ni filtros) y se coloca como overlay HTML **encima** de la escena 3D, jamás dentro de ella: no recibe luz, sombras ni post-procesado.
5. El panel de admin hace una **prueba de ida y vuelta**: rasteriza el SVG regenerado, lo vuelve a decodificar y compara con el texto original antes de guardar.
6. Corrección de errores: nivel **M** sin logo. Si algún día se superpone un logo: nivel **H** y que cubra como máximo el 20–25 % del área.

## 6. Árbol 3D

- Generado con `tools/3d/blender/40_payment_tree.py` en Blender 5.2 **por línea de comandos** (el servidor del MCP de Blender no estaba activo en esta sesión; el script no lo necesita). Obra propia: sin assets de terceros (registrada en `docs/3d/asset-registry.json`).
- ~26.800 triángulos, 3 materiales PBR, hojas como tarjetas con alfa (cara de atrás real, normales hacia afuera de la copa), corteza con normal map, todo procedural (numpy). GLB con Meshopt (~0,9 MB).
- Render: `WebGPURenderer` (`three/webgpu`, que cae solo a WebGL2) y, si falla la importación o la inicialización, `WebGLRenderer`. Se verificó en Chrome de escritorio con WebGPU activo; **no se probó en un celular real**. El proyecto no usa React Three Fiber en ningún lado, por eso se usó three.js directo, como el resto de `lib/3d`.
- Interacción: arrastrar gira; un toque sobre el árbol (raycast; los huecos entre hojas no cuentan) lanza una transición de ~0,9 s (acercamiento + fundido; 0,26 s con «reducir movimiento») y recién entonces aparece el QR.
- **Figura intercambiable:** `lib/3d/payment-figures.ts` es un registro (`id`, `url`, altura, foco y distancia de cámara). Para otra figura se agrega una entrada y se pasa `figureId` a `PaymentGate`.
- Si el GLB no carga se muestra una figura simple y se avisa por consola: nunca se finge el modelo.

## 7. Onboarding y tutorial

- **Formulario inicial:** 3 pasos (datos, objetivo, entrenamiento) antes de cualquier módulo. No crea campos nuevos: escribe en `gymProfile` del store con `saveGymProfile` (el mismo que Perfil de entrenamiento; marca `onboardingCompleted`) y calcula la meta con `calcCalorieGoal` (la misma fórmula de Calorías). Intensidad por defecto: «estándar» para mantener, «moderado» para perder o ganar.
- **Tutorial:** burbujas con la mascota que se mueve hasta cada bloque, lo señala con una flecha y habla. Empieza con una burbuja que pregunta antes de mover nada. Cubre **Calorías** (comida actual, puntos, el «+» y su mantener-presionado, vistas hacia arriba, ajustes), **buscar alimento** y **Entrenamiento** (qué toca hoy, cómo se registra una serie y sus tipos, ajustes). Los demás módulos no llevan tutorial.
- **Cómo encuentra los bloques sin tocar los módulos congelados:** por `aria-label` / `placeholder` que ya existen. Si algún día cambia uno, el paso no rompe nada: muestra la burbuja centrada sin resaltar.
- Se marca como visto (`profiles.tutorial_seen` + localStorage) al terminar **o saltarlo**; no reaparece solo. Se reactiva desde la mascota → Ajustes → «Tutorial guiado».
- Usuarios que ya existían: la migración deja `onboarding_done` y `tutorial_seen` en `true` para ellos; solo ven esto los registros nuevos.

## 8. Migración 0018: aplicar antes de usar pagos

Aditiva e idempotente. Crea `app_settings`, `payment_requests`, el bucket privado `comprobantes` y las columnas `profiles.onboarding_done` / `tutorial_seen`. La app funciona **antes y después**: sin la migración, el layout trata onboarding y tutorial como hechos, la pantalla de pago no muestra QR («el administrador todavía no cargó el QR») y `/admin/pagos` avisa que falta aplicarla. Aplicar: Dashboard de Supabase → SQL Editor → pegar `supabase/migrations/0018_suscripciones_onboarding.sql` → Run.

## 9. Pendientes y límites

- Personalización de la mascota (apariencia / trajes por módulo) desde Configuración: **no se hizo**. Ya existen trajes por agente y activar/desactivar el agente en el mismo panel.
- Tutorial: las selecciones se comprobaron en un arnés con bloques de prueba (posición, flecha, burbuja arriba/abajo, burbuja centrada) y contra el código de las pantallas; **no se recorrió con las pantallas reales** porque requieren sesión iniciada.
- Aviso de vencimiento anticipado (p. ej. 3 días antes) y recordatorios push: no hay.
- El bloqueo no es de RLS (ver §3).

## 10. Corrección (post-lanzamiento): módulos por default, usuarios invisibles, orden onboarding/pago, avisos al admin

Reportado por el usuario: una cuenta nueva (login con Google) veía TODOS los módulos en vez de solo Entrenamiento, y esa cuenta no aparecía en `/admin/usuarios`. Causas y arreglos (migración **0019**, nueva, sin aplicar):

- **Módulo por default invertido.** `buildModuleAccess()` (`lib/account/modules.ts`) arrancaba de "todo habilitado" cuando un usuario no tenía ninguna fila en `user_module_access` — el comentario de la propia migración 0001 lo dejaba como decisión pendiente ("sugerido: enabled=true") y nunca se resolvió. Ahora el default para un usuario SIN filas es **solo `gym_entrenamiento`**; el resto lo habilita el admin a mano. Un admin sigue viendo todo siempre (`(dashboard)/layout.tsx` usa `allModulesEnabled()` cuando `role === "admin"`, nunca depende de esa tabla). **Migración 0019** deja grabado explícitamente "todo habilitado" para cualquier usuario que YA existiera antes de este cambio y nunca tuviera una fila tocada por un admin — para que nadie pierda acceso de golpe al desplegar esto.
- **"No veo la cuenta nueva en el panel"**: la causa más probable es que esa cuenta se haya creado en algún momento en que el trigger `handle_new_user` (0001) no corrió para ella (p. ej. una prueba de antes de que existiera ese trigger) — sin fila en `profiles`, es invisible para `/admin/usuarios` y no se le puede asignar nada. Migración 0019 agrega `ensure_own_profile()` (función de la base, SECURITY DEFINER, pero solo puede crear/tocar la fila del propio `auth.uid()`, nunca la de otro) — el layout la llama automáticamente si detecta que el usuario logueado no tiene perfil, como red de seguridad.
- **Orden onboarding → pago.** Antes se mostraba primero la pantalla de pago y recién después el formulario inicial si la suscripción no estaba vencida. Se invirtió: ahora el formulario (que además pide **nombre de usuario**, columna nueva `profiles.username`, única) va siempre primero; la pantalla de pago es lo último antes de los módulos.
- **Avisos al admin.** Nuevo: usuario nuevo registrado, comprobante de pago subido, pedido de acceso a un módulo (el botón "pídele acceso" de la pantalla de módulo bloqueado ahora hace algo: inserta en `module_requests`). Los tres se notifican reutilizando `agent_notification_log` (0015) con 3 `kind` nuevos — mismo camino que ya usan los recordatorios de tareas/agua (Isla Dinámica). Además, si está activado en Ajustes → Administración → "La mascota te dice los avisos" (toggle, encendido por default), la mascota los lee en voz alta con la misma síntesis de voz que ya usa el entrenador por cámara (`voice-speak.ts`, Web Speech API, nativa del navegador).
- **Telegram: solo admin por ahora.** La tarjeta para vincular Telegram se mostraba a cualquier usuario logueado; ahora es visible solo para `role === "admin"` — los usuarios normales todavía no pueden vincular su cuenta de Telegram (lo dijo explícitamente el usuario: "por ahora solo yo puedo hablarle por Telegram").
- **Aislamiento entre usuarios:** revisado — cada tool del agente (`src/lib/agent/actions/*`, `executor.ts`) recibe el `userId` de la sesión autenticada en cada llamada, sin estado compartido entre usuarios en el proceso del servidor; `telegram_links` tiene una restricción única que impide vincular la misma cuenta de Telegram a dos usuarios de la app. No se encontró mezcla de datos.
- **Nutriólogo sin módulo asignado:** de paso, `/gym/nutriologo` no estaba mapeado a ningún módulo en `moduleForPath` (quedaba como "ruta libre"); ahora cuenta como parte de `gym_calorias`, igual que el resto de Calorías.
- **Qué falta:** la mascota lee los avisos en voz, pero no hay una pantalla dedicada a "ver el historial de avisos" (solo lo que empuja la Isla Dinámica al entrar); "filtros" hoy es un único toggle on/off (los 3 tipos son, por definición, los únicos que le llegan al admin — no hace falta elegir entre ellos). No se tocó el tutorial de Calorías: ya explicaba el scroll vertical y el mantener-presionado.
