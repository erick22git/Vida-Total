# WhatsApp a futuro (solo plan; NO está conectado)

**Idea central:** el canal es una *interfaz*. Hoy hay dos (la app y **Telegram**); WhatsApp sería la tercera **sin cambiar el agente, las herramientas ni los permisos**. Nada de WhatsApp se conecta todavía.

## Qué ya es independiente del canal
| Pieza | Dónde | Qué hay que hacer para WhatsApp |
|---|---|---|
| Agente (prompt + bucle + herramientas) | `src/lib/agent/` | Nada |
| Permisos (modos, niveles, lista «nunca automático», límites, plan) | `src/lib/agent/permissions.ts`, `plan.ts` | Nada. Solo agregar `"whatsapp"` a `Channel` y una política de canal (estricta, como Telegram: desactivada hasta vincular, techo «preguntar siempre», **sin Auto total**) |
| Avisos («qué toca avisar») | `src/lib/agent/notifications.ts` | Nada: devuelve avisos; cada canal los entrega a su manera |
| Ejecución en servidor (filas nuevas directas, ediciones por bandeja) | `src/lib/agent/server/executor.ts` | Nada |

## Qué sería nuevo (el adaptador del canal)
Un adaptador pequeño con la misma forma que el de Telegram (`src/lib/telegram/*` + `src/lib/agent/server/telegram-agent.ts`):

1. **Entrada** → normalizar el mensaje del proveedor a `Inbound` (texto, nota de voz, documento, botón).
2. **Salida** → `sendMessage(chat, texto, botones)`. WhatsApp permite como máximo **3 botones de respuesta** por mensaje (o una lista): el plan paso a paso ya trabaja con 2–3 botones, así que encaja.
3. **Vinculación** → el mismo código de un solo uso generado en la app, enviado como primer mensaje; se guarda el número verificado por el proveedor (nunca se acepta un número escrito por el usuario).
4. **Tablas** → paralelas a `telegram_links` (p. ej. `whatsapp_links`) con RLS igual; `agent_pending`, `agent_commands`, `agent_action_log` y `agent_notification_log` se reutilizan (la columna `channel` solo necesita el valor nuevo).

## Diferencias de WhatsApp que hay que tener presentes
- Se usa la **WhatsApp Business Platform (Cloud API de Meta)**, no librerías que automatizan una cuenta personal (violan los términos y arriesgan el bloqueo del número).
- Requiere una cuenta de empresa, un número dedicado y verificación; hay costos por conversación.
- **Ventana de 24 h**: el bot solo puede responder libremente dentro de las 24 h siguientes al último mensaje del usuario; fuera de ella (avisos programados) hay que usar **plantillas aprobadas por Meta**. Los avisos de tareas/agua tendrían que ser plantillas.
- El webhook de Meta se verifica con un *verify token* y la firma `X-Hub-Signature-256` (equivale al `secret_token` de Telegram).

## Dónde entra n8n
Hay dos formas, y la decisión es de más adelante:
1. **Sin n8n (recomendada):** Meta llama directo a `/api/whatsapp/webhook` (nueva ruta, mismo patrón que la de Telegram) y el adaptador hace el resto. Cero piezas extra.
2. **Con n8n como puente:** n8n recibe el webhook de WhatsApp y lo reenvía a la app (`POST` con un secreto), y/o dispara el programador de avisos (`/api/agent/tick`). **n8n no puede vivir en Vercel** (es un proceso permanente; Vercel es serverless): si se usa, necesita un servidor propio (VPS, Railway, Render…). Mientras n8n corra solo en tu PC, no atiende con la PC apagada.

## Orden sugerido cuando se decida hacerlo
1. Cuenta de Meta Business + número de prueba.
2. Adaptador + ruta de webhook + vinculación por código, con la política de canal estricta.
3. Plantillas para los avisos.
4. Reutilizar las mismas pruebas de permisos agregando `whatsapp` a la matriz (`tools/agent/permissions_test.ts`).
