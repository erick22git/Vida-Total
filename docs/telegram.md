# Agente por Telegram — guía paso a paso

El mismo agente de la app (mismo prompt, mismos agentes, mismas herramientas y mismos permisos) te atiende por **Telegram** con el **bot oficial** (Bot API). No usa tu número de teléfono ni librerías que automatizan cuentas de usuario: creas un bot con @BotFather y le escribes desde tu cuenta personal.

> Este repositorio es **público**. Ningún token, clave ni número real va en el repo: todo está en variables de entorno del servidor, y `.env.example` solo trae valores falsos.

## Cómo funciona

```
Tú ──Telegram──▶ Bot ──HTTPS──▶ /api/telegram/webhook (producción, Vercel)
                                  │ 1. verifica la cabecera X-Telegram-Bot-Api-Secret-Token (si no coincide: 401)
                                  │ 2. deduplica por update_id (tabla telegram_updates)
                                  │ 3. chat vinculado → tu usuario (telegram_links); si no, mensaje neutro y ningún dato
                                  │ 4. elige agente: /comida /tareas /entreno → palabras clave → pantalla → clasificación corta
                                  │ 5. política del canal "telegram" + agente (Groq) con SOLO las herramientas de ese agente
                                  ▼
                        Supabase (service role; todas las consultas filtran por tu user_id)
```

- **Agentes** (`src/lib/agent/agents.ts`): General (lecturas y delega), Nutrición (comida y agua), Entrenamiento (solo lectura), Organización (tareas y notas), Recordatorios (sin chat). Cada uno ve únicamente sus herramientas.
- **Atajos**: `/comida`, `/tareas`, `/entreno` fijan el agente (puedes seguir con tu mensaje: `/comida arroz 150 g`; a secas hacen una consulta por defecto). `/ayuda` los lista.
- **Vincular** es de la lista «nunca automático»: solo desde la app. El código es de **un solo uso**, vale 10 minutos y en la base solo se guarda su hash. Cualquier otra cuenta que escriba al bot recibe un mensaje neutro.
- **Permisos**: Telegram es más estricto que la app (desactivado hasta vincular, techo «preguntar siempre»). El **Auto total no existe en Telegram**. Las confirmaciones salen con botones: *Permitir / Denegar / Siempre* y, con varias acciones, un plan con *Aprobar todo / Paso a paso / Cancelar*.
- **Entradas**: texto; **notas de voz** (se transcriben en el servidor con Whisper de Groq; lo que dices tú es una orden confiable); **archivos de texto** pequeños (`.txt .md .csv .json`, ≤ 100 KB) y **mensajes reenviados** son *dato no confiable*: toda escritura posterior pide confirmación. Las fotos todavía no.
- **Cómo se aplican los cambios**: crear (agua, comida, tarea, nota) inserta filas **nuevas**; completar una tarea cambia una columna; **editar** algo existente se encola en `agent_commands` y la app lo aplica al abrirse. Así nunca se pisa una edición hecha en el teléfono.

## Orden correcto (haz los pasos en este orden)

### Paso 1 — Crear el bot
1. En Telegram abre **@BotFather** → `/newbot` → elige nombre y usuario (termina en `bot`).
2. Guarda el **token** (`123456789:AA…`). **Es una contraseña**: no lo pegues en chats ni en el repo.
3. Apunta el **usuario del bot** (sin `@`).

✅ *Cómo comprobarlo:* BotFather responde «Done! Congratulations…» y te da el token.

### Paso 2 — Aplicar el SQL en Supabase
1. Dashboard → **SQL Editor → New query**. (Antes deben estar las migraciones 0001–0008: ver `docs/migraciones-pendientes.md`.)
2. Pega `supabase/aplicar-agente.sql` y **Run** (es aditivo, idempotente y va en una transacción).
3. Pega `supabase/verificar-agente.sql` y **Run**.

✅ *Cómo comprobarlo:* en el resultado de `verificar-agente.sql` todas las filas salen `existe = true`, `rls_activo = true`, `politicas_ok = true` y `migracion_completa = true`.

> **Avisos de RLS (esperados):** las tablas `telegram_link_codes`, `telegram_updates`, `agent_pending` y `agent_chat_state` solo las usa el servidor. Tienen RLS activado y una política «denegar todo» para el navegador. Sin esa política, el *Security Advisor* de Supabase mostraría el aviso «RLS enabled, no policy»; con ella no debería marcar nada.

### Paso 3 — Variables de entorno en Vercel
Vercel → tu proyecto → **Settings → Environment Variables** (marca *Production*; sin prefijo `NEXT_PUBLIC_`):

| Variable | Qué es | Cómo obtenerla |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot | BotFather |
| `TELEGRAM_BOT_USERNAME` | Usuario del bot, sin `@` | BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Secreto de ≥ 32 caracteres | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CRON_SECRET` | Secreto del programador de avisos (≥ 24) | igual, con `randomBytes(24)` |
| `GROQ_API_KEY` | Clave del modelo | ya la tienes |
| `GROQ_AGENT_MODEL` | (opcional) modelo del agente | por defecto `openai/gpt-oss-120b` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role | ya la tienes |
| `APP_PUBLIC_URL` | Dominio de **producción**, `https://…` sin barra final | tu dominio |

Copia los mismos nombres en tu `.env.local` si vas a probar en local (`.env.example` muestra la lista con valores falsos).

✅ *Cómo comprobarlo:* tras **volver a desplegar**, `Settings → Environment Variables` las lista (los valores quedan ocultos).

### Paso 4 — Subir el código y desplegar a producción
El webhook necesita un endpoint **público**: el código tiene que estar en `main` y desplegado (`git push origin main`; Vercel despliega solo).

✅ *Cómo comprobarlo:* sin el secreto, el webhook rechaza:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://TU-DOMINIO/api/telegram/webhook -d '{}'
# → 401
```

### Paso 5 — Registrar el webhook
En tu PC, con `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` y `APP_PUBLIC_URL` en el entorno o en `.env.local`:

```bash
node scripts/telegram-set-webhook.mjs
```

Registra `APP_PUBLIC_URL/api/telegram/webhook` con tu `secret_token` y muestra `getWebhookInfo`. (`--info` solo consulta; `--delete` lo quita.)

✅ *Cómo comprobarlo:* `getWebhookInfo` muestra tu URL, `actualizaciones pend.: 0` y «último error: (ninguno)».

### Paso 6 — Vincular
En la app: **menú → mascota → Ajustes → Telegram → Vincular** (o *Agente y permisos → Canales*). Toca **Abrir @tu_bot** (o manda `/start CÓDIGO`).

✅ *Cómo comprobarlo:* el bot responde «✅ Vinculado» y la app pasa a «Vinculado».

### Paso 7 — Probar en el celular
1. «hola» → responde.
2. «registra 250 ml de agua» → te pregunta con botones → *Permitir* → «✓ Agua +250 ml».
3. `/tareas` → lista tus tareas pendientes. `/comida` → calorías y agua de hoy. `/entreno` → qué toca hoy.
4. «crea una tarea para mañana a las 9 con 2 subtareas» → plan → *Aprobar todo*.
5. Nota de voz: «anota en una nota: comprar leche».
6. «comí arroz» (ambiguo) → te pregunta cuál; no inventa alimentos.
7. En la app, apaga el agente → el bot dice que está desactivado.

## Probar sin Telegram (en tu PC)

Con `npm run dev` corriendo y `TELEGRAM_WEBHOOK_SECRET` y `CRON_SECRET` en `.env.local`:

```bash
node scripts/telegram-simulate.mjs                    # seguridad + mensaje + botón + update repetido
node scripts/telegram-simulate.mjs --code ABCD2345    # además simula /start con el código que muestra la app
```

Comprueba que el webhook y `/api/agent/tick` responden **401** sin su secreto, que con el `secret_token` correcto aceptan un mensaje y un botón en línea, y que un **update repetido** se reconoce como duplicado (`dup`: eso exige haber aplicado la migración 0014). Los mensajes que salgan hacia el chat simulado no llegan a ningún teléfono.

Para hablar con tu bot real desde tu PC (Telegram no acepta `localhost`): `node scripts/telegram-set-webhook.mjs --delete` y `npx tsx tools/telegram/poll.ts` (long polling que reenvía a tu servidor local con el mismo secreto). Al terminar, vuelve a correr el Paso 5.

## Seguridad
- Webhook: **401** sin el `secret_token` correcto (comparación en tiempo constante); solo atiende el chat **privado**.
- La service role solo se usa en el servidor y **todas** las consultas filtran por `user_id`.
- `telegram_link_codes`, `telegram_updates`, `agent_pending` y `agent_chat_state`: RLS activo + «denegar todo» para el navegador.
- Límites: ráfaga por chat, topes de escrituras por hora/día, agua y calorías por acción, lista «nunca automático» (`docs/agente-nunca-automatico.md`) y mínimo privilegio por agente.
- Si sospechas que se filtró el token: BotFather → `/revoke`, actualiza `TELEGRAM_BOT_TOKEN` en Vercel y repite el Paso 5.

## Qué no se puede verificar sin tu bot
La conexión real con Telegram (necesita tu token) y la deduplicación contra la base real (necesita la migración 0014 aplicada). El modelo sí se probó con la clave real (`node tools/3d/verify/run_ts.mjs tools/agent/live_llm_check.ts`).
