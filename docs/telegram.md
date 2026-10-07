# Agente por Telegram

El mismo agente de la app (mismo prompt, mismas herramientas, mismos permisos) puede atenderte por **Telegram** con el **bot oficial** (Bot API). No usa tu número de teléfono ni librerías que automatizan cuentas de usuario: creas un bot con @BotFather y le escribes desde tu cuenta personal.

> Este repositorio es **público**. Ningún token, clave ni número real va en el repo: todo está en variables de entorno del servidor y `.env.example` solo trae valores falsos.

## Cómo funciona (resumen)

```
Tú ──Telegram──▶ Bot ──HTTPS──▶ /api/telegram/webhook (Vercel)
                                   │ 1. verifica X-Telegram-Bot-Api-Secret-Token
                                   │ 2. deduplica por update_id (telegram_updates)
                                   │ 3. chat vinculado → tu usuario (telegram_links); si no, mensaje neutro
                                   │ 4. política del canal "telegram" + agente (Groq)
                                   ▼
                         Supabase (service role, siempre filtrando por tu user_id)
```

- **Vincular**: la app genera un código de **un solo uso** (8 caracteres, vale 10 minutos; en la base solo se guarda su hash). Lo mandas al bot (`/start CÓDIGO`, o con el botón «Abrir en Telegram»). Cualquier otra cuenta que escriba al bot recibe un mensaje neutro y ningún dato. Vincular y desvincular **solo se pueden desde la app** (están en la lista «nunca automático»); el bot no desvincula.
- **Permisos**: Telegram es más estricto por defecto (canal desactivado hasta vincular, techo «preguntar siempre»). El **Auto total no se puede activar desde Telegram**: solo existe en la app, y aunque lo tengas activo en la app, Telegram sigue preguntando. Las confirmaciones salen con botones: *Permitir / Denegar / Siempre* y, si hay varias acciones, un **plan** con *Aprobar todo / Paso a paso / Cancelar*. «Siempre» solo afecta al canal Telegram y nunca a la lista fija.
- **Entradas**: texto; **notas de voz** (se descargan con `getFile` y se transcriben en el servidor con Whisper de Groq; lo que dices tú es una orden confiable); **archivos de texto** pequeños (`.txt .md .csv .json`, ≤ 100 KB) — su contenido es *dato no confiable*: todo lo que el agente quiera cambiar después de leerlo pide confirmación aunque estés en auto; **mensajes reenviados** igual. Las **fotos** todavía no (para comidas usa el escáner de la app).

## Cómo se aplican los comandos (decisión de diseño)

El estado de la app vive en `localStorage` **y** en Supabase, y se mezcla por `id` sin reemplazar. Para no pisar nada:

| Acción por Telegram | Qué hace el servidor | Por qué es seguro |
|---|---|---|
| **Crear**: agua, comida, tarea, nota | Inserta una fila **nueva** con id propio | No puede chocar con nada; la app la recoge en su siguiente sincronización |
| **Completar** una tarea | Cambia **una columna** (`is_completed`) | No toca el resto de la fila |
| **Editar** algo que ya existe (título, fechas, subtareas, notas) | **No escribe en la tabla**: encola en `agent_commands` | La app (que tiene el estado completo) lo aplica con sus acciones de negocio y lo marca; así nunca se pierde una edición hecha en el teléfono |

La app, al abrirse o volver a primer plano (`AgentInboxApplier`), aplica la bandeja y, si hubo acciones nuevas desde Telegram, vuelve a traer los datos con la hidratación «merge» de siempre.

Lo hecho por Telegram queda en `agent_action_log` y aparece en **Agente y permisos → Historial**, con **Deshacer** cuando se puede.

## Pasos manuales (tú)

### 1. Crear el bot
1. En Telegram abre **@BotFather** → `/newbot` → elige nombre y usuario (termina en `bot`).
2. BotFather te da el **token** (`123456789:AA…`). **Es una contraseña**: no lo pegues en chats ni en el repo.
3. (Opcional) `/setprivacy`, `/setdescription`, `/setuserpic`.

### 2. Aplicar las migraciones (no se aplican solas)
En el SQL Editor de Supabase, en este orden y solo después de `0003`–`0008`:
`0012_agent_settings.sql`, `0013_tasks_reminder.sql`, `0014_telegram_agent.sql` (y `0015` si usas avisos, ver `docs/notificaciones.md`). Todas son aditivas e idempotentes. Ver `docs/migraciones-pendientes.md`.

### 3. Variables de entorno en Vercel
Vercel → tu proyecto → **Settings → Environment Variables** (Production y Preview). Valores reales, solo ahí:

| Variable | Qué es |
|---|---|
| `TELEGRAM_BOT_TOKEN` | El token de BotFather |
| `TELEGRAM_BOT_USERNAME` | Usuario del bot, sin `@` |
| `TELEGRAM_WEBHOOK_SECRET` | Cadena larga y aleatoria (≥ 32 caracteres). Genera una con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya la tienes (solo servidor) |
| `GROQ_API_KEY` | Ya la tienes (agente, escáner y notas de voz) |
| `APP_PUBLIC_URL` | `https://tu-app.vercel.app` (solo para el script de webhook) |

Vuelve a desplegar para que las tome. Copia los mismos nombres en tu `.env.local` para probar en local (`.env.example` muestra la lista con valores falsos).

### 4. Registrar el webhook
Con las variables en `.env.local`:

```bash
npx tsx tools/telegram/set-webhook.ts
```

Registra `APP_PUBLIC_URL/api/telegram/webhook` con tu `secret_token`. Para comprobar: `npx tsx tools/telegram/set-webhook.ts --info` (muestra la URL y los últimos errores; no muestra el secreto).

### 5. Vincular
En la app: **Tu cuenta → Agente y permisos → Canales → Vincular Telegram** → toca **Abrir @tu_bot** (o manda `/start CÓDIGO` al bot). Verás «✅ Vinculado» en el chat y el estado «Vinculado» en la app. Vincular activa el canal de Telegram; los permisos siguen en «preguntar».

### Pruebas en local (sin webhook)
Telegram no acepta `localhost`. Con `npm run dev` corriendo:

```bash
npx tsx tools/telegram/poll.ts
```

Hace long polling (`getUpdates`) y reenvía cada update a `http://localhost:3000/api/telegram/webhook` con el mismo `secret_token`, así el flujo es idéntico. **Si lo usas, el webhook de producción queda quitado**: vuelve a registrarlo con `set-webhook.ts` al terminar.

## Qué probar en el celular
1. Vincula y escribe «hola» → responde.
2. «registra 250 ml de agua» → te pregunta con botones → *Permitir* → «✓ Agua +250 ml» → en la app aparece en el historial y en Agua (al abrirla).
3. «crea una tarea para mañana a las 9 con 2 subtareas» → plan → *Aprobar todo*.
4. Nota de voz: «anota en una nota: comprar leche» → te muestra lo que entendió y sigue el flujo.
5. «come 2 huevos y arroz» sin decir cuál arroz → te pregunta cuál (no inventa alimentos).
6. En la app, **Agente y permisos → apagar** → el bot responde que está desactivado.

## Seguridad
- El webhook responde **401** sin el `secret_token` correcto (comparación en tiempo constante).
- Solo se atiende el **chat privado** con el bot (grupos y canales se ignoran).
- La **service role** se usa solo en el servidor y **todas** las consultas filtran por `user_id`.
- `agent_pending`, `telegram_link_codes`, `telegram_updates` y `agent_chat_state` tienen RLS activa sin políticas: el navegador no puede leerlas ni escribirlas.
- Límites: ráfaga por chat, topes de escrituras por hora/día, límites de agua y calorías por acción, y la lista «nunca automático» (ver `docs/agente-nunca-automatico.md`).

## Qué no se pudo verificar sin tu bot
La conexión real con Telegram (necesita tu token) y las respuestas del modelo (necesitan `GROQ_API_KEY` en el servidor). Todo lo demás —lectura de updates, comandos, botones, código de vinculación, plan paso a paso, zonas horarias y permisos— tiene pruebas automáticas (`tools/agent/*_test.ts`).
