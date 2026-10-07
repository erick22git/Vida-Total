/**
 * Cliente mínimo de la Bot API oficial de Telegram. SOLO SERVIDOR: el token (TELEGRAM_BOT_TOKEN) nunca va al navegador ni
 * al repositorio. Sin librerías de terceros (nada que automatice cuentas de usuario).
 */
import { chunkMessage } from "./update";

export interface InlineButton {
  text: string;
  callback_data: string;
}

const token = () => process.env.TELEGRAM_BOT_TOKEN;
export const telegramConfigured = () => !!token() && token() !== "TU_TOKEN_AQUI";

async function call<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const t = token();
  if (!t) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${t}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      console.warn(`[telegram] ${method} falló: ${json.description ?? res.status}`);
      return null;
    }
    return json.result ?? null;
  } catch (err) {
    console.warn(`[telegram] ${method} lanzó una excepción:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Envía un texto (partido si es largo). Los botones van en el último trozo. */
export async function sendMessage(chatId: number, text: string, buttons?: InlineButton[][]): Promise<void> {
  const parts = chunkMessage(text.trim() || "…");
  for (let i = 0; i < parts.length; i++) {
    const last = i === parts.length - 1;
    await call("sendMessage", {
      chat_id: chatId,
      text: parts[i],
      disable_web_page_preview: true,
      ...(last && buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
  }
}

export const answerCallback = (callbackId: string, text?: string) => call("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text: text.slice(0, 180) } : {}) });

/** Reemplaza el texto de un mensaje (y quita o cambia los botones). */
export const editMessage = (chatId: number, messageId: number, text: string, buttons?: InlineButton[][]) =>
  call("editMessageText", { chat_id: chatId, message_id: messageId, text: text.slice(0, 3900), reply_markup: { inline_keyboard: buttons ?? [] } });

export const sendTyping = (chatId: number) => call("sendChatAction", { chat_id: chatId, action: "typing" });

/** Descarga un archivo del usuario. Devuelve null si pesa más de `maxBytes` o falla. */
export async function downloadFile(fileId: string, maxBytes: number): Promise<{ data: Uint8Array; path: string } | null> {
  const info = await call<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  if (!info?.file_path || (info.file_size ?? 0) > maxBytes) return null;
  try {
    const res = await fetch(`https://api.telegram.org/file/bot${token()}/${info.file_path}`);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > maxBytes ? null : { data: buf, path: info.file_path };
  } catch {
    return null;
  }
}
