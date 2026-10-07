# Avisos del agente (app y Telegram)

Qué avisa: **tarea o subtarea con recordatorio**, **rutina próxima**, **agua** (si vas por debajo del ritmo), **comidas sin registrar** y **resumen diario** (opcional). Todo se configura en **Tu cuenta → Agente y permisos → Avisos** y está **apagado por defecto**.

## Cómo está armado

```
programador (cada minuto) ──POST──▶ /api/agent/tick  (Authorization: Bearer CRON_SECRET)
                                      │ por cada usuario con avisos activados:
                                      │   dueNotifications(estado, ahora, config, enviados)   ← función PURA con pruebas
                                      │   guarda cada aviso en agent_notification_log (única por usuario+clave = sin duplicados)
                                      ├──▶ Telegram (si lo vinculaste): mensaje con botones «Hecho / Posponer 10 min / +250 ml / Entendido»
                                      └──▶ dentro de la app: banner con los mismos botones (cuando la tienes abierta)
```

- **La lógica de «qué toca avisar ahora»** vive en `src/lib/agent/notifications.ts` (pura, 43 pruebas en `tools/agent/notifications_test.ts`) y no sabe nada del programador: sirve igual con cualquiera.
- **Anti-spam**: interruptor general, horario silencioso (por defecto 22:30–07:00; los avisos que caen dentro no salen), un aviso por clave (nunca se repite), «Posponer» máximo 3 veces, mínimo entre avisos de agua (150 min por defecto), tope diario (10) y como mucho 3 avisos por pasada.
- **Telegram**: el bot solo puede escribirle a quien ya inició la conversación (vinculó la cuenta). Los botones «Hecho» y «+250 ml» pasan por los límites, el apagado y la lista «nunca automático». «Hecho» de una **subtarea** edita algo existente, así que se encola y la app lo aplica al abrirse (ver `docs/telegram.md`).
- **Zona horaria**: la app guarda tu zona en la configuración; el servidor (UTC) calcula «hoy» y «la hora» para ti con ella.

## Elegir el programador (comparación)

| Opción | ¿Avisa con tu PC apagada? | Costo / límite | Veredicto |
|---|---|---|---|
| **n8n en tu PC** | **No**: solo corre mientras la PC y n8n están encendidos | Gratis | Sirve para **probar**, no para producción |
| **n8n en un servidor** | Sí | Necesita un servidor siempre encendido (VPS, Railway, Render…). **Vercel no puede alojar n8n**: es serverless, sin proceso permanente | Posible, pero es otra pieza que mantener |
| **Cron de Vercel** | Sí | **Hobby: una vez al día** (y con ±59 min de imprecisión); **Pro: cada minuto**. Verificado en la documentación de Vercel | Solo si pasas a Pro |
| **Supabase `pg_cron` + `pg_net`** | Sí | Extensiones estándar de Supabase; pueden correr cada minuto. (No pude confirmar en la documentación, en esta sesión, que estén habilitadas en tu plan: se activan en *Database → Extensions*.) | ✅ **Elegida** |

**Elegida: Supabase `pg_cron` + `pg_net` → `/api/agent/tick`.** Es gratis, no depende de tu PC ni de un servidor extra, tiene precisión de minuto y el aviso sale aunque la app esté cerrada. El endpoint es **agnóstico**: n8n (nodo *Schedule* + nodo *HTTP Request* con el mismo encabezado), Vercel Cron (`vercel.json`, si pasas a Pro) o `curl` funcionan igual sin tocar código.

### Despliegue (pasos manuales)
1. Aplica `supabase/aplicar-agente.sql` (SQL Editor de Supabase) y comprueba con `supabase/verificar-agente.sql`.
2. En Vercel agrega `CRON_SECRET` (aleatorio, ≥ 24 caracteres; p. ej. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) y vuelve a desplegar.
3. En Supabase → **Database → Extensions** activa `pg_cron` y `pg_net`.
4. Abre `supabase/scheduler-tick.sql.example`, cambia el dominio (**el de producción**, no una URL de preview) y el secreto **solo en el SQL Editor** (no en el archivo ni en el repo) y ejecútalo.
5. Activa los avisos en la app. Comprueba con `select * from cron.job_run_details order by start_time desc limit 10;` y, en la app, con una tarea de hoy con recordatorio en 2 minutos.

### Probar sin esperar (local o producción)
```bash
curl -X POST https://tu-app.vercel.app/api/agent/tick -H "Authorization: Bearer $CRON_SECRET"
# → {"users":1,"sent":1,"telegram":1,"errors":0}   (sin secreto: 401)
```

### Si usas n8n (primero local, luego en un servidor)
Un flujo de dos nodos basta: **Schedule Trigger** (cada minuto) → **HTTP Request** (`POST` a `/api/agent/tick`, encabezado `Authorization: Bearer <CRON_SECRET>`). En local apunta a `http://localhost:3000` con la app corriendo; cuando lo muevas a un servidor, solo cambias la URL. Mientras n8n esté solo en tu PC, **no avisa con la PC apagada** — por eso la opción elegida es `pg_cron`.

## Cuántas llamadas son y qué límites revisar

Con el programador cada minuto: **60 × 24 × 30 = 43.200 llamadas al mes** a `/api/agent/tick` (≈ 1.440 al día).

| Dónde | Qué cuenta | Estimación | Límite del plan (según la documentación de cada servicio) |
|---|---|---|---|
| **Vercel** — invocaciones | 1 por llamada | 43.200 | Hobby: primeras **1.000.000**/mes → usas ≈ **4 %** |
| **Vercel** — Active CPU | tiempo de CPU de la función | ≈ 0,05–0,1 s por llamada → **0,6–1,2 h** | Hobby: **4 h**/mes → ≈ **15–30 %** (es lo que más conviene vigilar) |
| **Vercel** — memoria provisionada | GB-hora | ≈ 3–4 GB-h | Hobby: **360 GB-h**/mes → ≈ 1 % |
| **Vercel** — duración | máx. por ejecución | un tick tarda < 1 s con un usuario | la ruta declara `maxDuration = 60`; Hobby permite menos (revísalo en *Settings → Functions*) |
| **Vercel** — plan Hobby | uso **no comercial** personal | — | si la app pasa a ser comercial hace falta Pro |
| **Supabase** — `pg_net` | 1 petición/min | 43.200/mes | pensado para ≤ 200 peticiones/s; las respuestas se guardan 6 h (`net._http_response`, unas 360 filas) |
| **Supabase** — `pg_cron` | 1 job | 1 | se recomienda ≤ 8 jobs a la vez y que ninguno dure más de 10 min |
| **Supabase** — base de datos | lecturas por tick | ≈ 8–10 consultas por usuario con avisos activados | revisa *Reports → Database* y el uso de la API en el plan gratuito |
| **Supabase** — proyecto gratuito | inactividad | — | conviene revisar la política de **pausa por inactividad** de tu plan; el tick genera actividad en la API cada minuto |
| **Groq** | — | el tick **no** llama al modelo | sin costo de modelo |

Para gastar menos: baja la frecuencia en `scheduler-tick.sql.example` (p. ej. `*/2 * * * *` = 21.600/mes; los avisos de tarea tienen una ventana de 2 h, así que 2 minutos de retraso no se nota), o quita el aviso de agua/comidas.

## Notificaciones push web (solo investigación, no implementado)
- Se haría con un **Service Worker** + la **Push API** + claves **VAPID** (la librería habitual es `web-push`) y una tabla de suscripciones por dispositivo.
- **Android/Chrome y escritorio**: funciona desde el navegador, con permiso del usuario.
- **iPhone/iPad (iOS 16.4+)**: **solo funciona si la app web está instalada en la pantalla de inicio** («Añadir a pantalla de inicio»/PWA) y el permiso se pide desde un gesto del usuario dentro de esa app instalada; en Safari normal no hay push.
- Haría falta un `manifest.webmanifest`, íconos y un service worker (hoy no hay PWA). Por eso queda como siguiente paso opcional; mientras tanto el canal fiable en iPhone es **Telegram**.
