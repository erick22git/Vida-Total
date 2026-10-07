# Agente: permisos y lista «nunca automático»

Código: `src/lib/agent/` (`permissions.ts`, `never-auto.ts`, `config.ts`, `plan.ts`). Pruebas: `node tools/3d/verify/run_ts.mjs tools/agent/permissions_test.ts`.
Pantalla: **Tu cuenta → Agente y permisos** (`/configuracion/agente`).

## Cómo decide el agente (en el servidor y en el cliente)

1. Herramienta desconocida, **apagado total** o canal apagado → **denegar**.
2. Nivel de la herramienta = **bloquear** → denegar.
3. **Solo lectura** (global o del canal) y la herramienta escribe → denegar.
4. Módulo no permitido → denegar.
5. Argumentos inválidos o límite superado (agua máx. por acción, calorías máx. por entrada) → denegar.
6. Tope de escrituras por hora / por día → denegar.
7. **Lista «nunca automático»** (abajo) → **preguntar siempre**, sin ofrecer «permitir siempre».
8. Según el modo efectivo:
   - **Preguntar siempre** (por defecto): solo pasa sin preguntar lo que marcaste «Permitir» en esa herramienta; todo lo demás pregunta, incluso las lecturas.
   - **Auto en lo seguro**: las lecturas pasan solas; las escrituras solo si están en «Permitir».
   - **Auto total** («saltar permisos»): todo pasa salvo bloqueadas, restricciones y la lista fija. Solo en la app, con advertencia + frase de confirmación escrita, duración (esta sesión / 1 hora / hasta que lo apague), insignia roja permanente y botón de apagado inmediato. **Nunca** vale para Telegram y nunca se sube a Supabase.

Al pedir permiso salen tres respuestas, como en Claude Code: **Permitir esta vez**, **Permitir siempre esta herramienta** (guarda el nivel «Permitir» solo para ese canal) y **Denegar**.

## Lista «NUNCA AUTOMÁTICO» (fija en código, ni en Auto total)

| Código | Qué | Por qué |
|---|---|---|
| `habit_complete` | Marcar hábitos como completados | Regla del producto: un hábito se cumple porque lo hiciste tú. |
| `delete_data` | Borrar datos | No se deshace del todo. |
| `batch` | Acciones por lotes de más de N elementos (N = 3 por defecto; se puede bajar, nunca pasar de 5) | Un error se multiplica. |
| `change_permissions` | Cambiar los permisos del agente | El agente no se da permisos a sí mismo. |
| `change_agent_config` | Cambiar la configuración del agente | Modos, límites, canales y apagado son tuyos. |
| `telegram_link` | Vincular o desvincular Telegram | Decide quién puede hablarle a tu agente. Solo desde la app. |
| `untrusted_origin` | Cualquier acción disparada por contenido no confiable | Una nota, un archivo o un mensaje ajeno son datos, no órdenes. |

Desde **Telegram**, `change_permissions`, `change_agent_config` y `telegram_link` ni siquiera se ofrecen: se deniegan.

## Contenido no confiable

Si una orden surge después de leer un archivo, una nota o un mensaje ajeno, la llamada se marca `origin: "untrusted"` y **toda escritura pide confirmación**, aunque esté en auto. Las lecturas no se frenan. El servidor marca el origen: cualquier turno que haya leído notas, archivos o texto ajeno (resultado de `note_list`/`task_list`, documentos de Telegram, etc.) queda `untrusted` para el resto del turno.

## Restricciones

Solo lectura · módulos permitidos · agua máx. y calorías máx. por entrada · N de lotes · tope de escrituras por hora y por día · horario silencioso (para avisos) · política por canal (app / Telegram, más estricta por defecto en Telegram: desactivado, techo «preguntar siempre»).

## Dónde vive la configuración

Local (por usuario, `vida-total-agent`) y en Supabase (`agent_settings`, migración `0012`, **sin aplicar**) para que el servidor aplique las mismas reglas. El servidor siempre vuelve a **sanear** lo que lee (`sanitizeConfig`): recorta números a topes duros, descarta niveles/módulos desconocidos y no acepta jamás `autoTotal`.
