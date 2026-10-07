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
1. Aplica las migraciones `0012` y `0015` (SQL Editor de Supabase).
2. En Vercel agrega `CRON_SECRET` (aleatorio, ≥ 24 caracteres; p. ej. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) y vuelve a desplegar.
3. En Supabase → **Database → Extensions** activa `pg_cron` y `pg_net`.
4. Abre `supabase/scheduler-tick.sql.example`, cambia la URL y el secreto **solo en el SQL Editor** (no en el archivo ni en el repo) y ejecútalo.
5. Activa los avisos en la app. Comprueba con `select * from cron.job_run_details order by start_time desc limit 10;` y, en la app, con una tarea de hoy con recordatorio en 2 minutos.

### Probar sin esperar (local o producción)
```bash
curl -X POST https://tu-app.vercel.app/api/agent/tick -H "Authorization: Bearer $CRON_SECRET"
# → {"users":1,"sent":1,"telegram":1,"errors":0}   (sin secreto: 401)
```

### Si usas n8n (primero local, luego en un servidor)
Un flujo de dos nodos basta: **Schedule Trigger** (cada minuto) → **HTTP Request** (`POST` a `/api/agent/tick`, encabezado `Authorization: Bearer <CRON_SECRET>`). En local apunta a `http://localhost:3000` con la app corriendo; cuando lo muevas a un servidor, solo cambias la URL. Mientras n8n esté solo en tu PC, **no avisa con la PC apagada** — por eso la opción elegida es `pg_cron`.

## Notificaciones push web (solo investigación, no implementado)
- Se haría con un **Service Worker** + la **Push API** + claves **VAPID** (la librería habitual es `web-push`) y una tabla de suscripciones por dispositivo.
- **Android/Chrome y escritorio**: funciona desde el navegador, con permiso del usuario.
- **iPhone/iPad (iOS 16.4+)**: **solo funciona si la app web está instalada en la pantalla de inicio** («Añadir a pantalla de inicio»/PWA) y el permiso se pide desde un gesto del usuario dentro de esa app instalada; en Safari normal no hay push.
- Haría falta un `manifest.webmanifest`, íconos y un service worker (hoy no hay PWA). Por eso queda como siguiente paso opcional; mientras tanto el canal fiable en iPhone es **Telegram**.
