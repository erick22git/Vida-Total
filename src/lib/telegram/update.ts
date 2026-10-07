/**
 * Lectura segura de un "update" de Telegram. PURA: lo que llega del webhook es entrada no confiable, así que aquí se valida
 * la forma y se recortan los tamaños antes de que nada más lo toque.
 */

export interface InboundBase {
  updateId: number;
  chatId: number;
  fromId: number;
  username?: string;
  /** Solo se atiende el chat privado con el bot (nada de grupos ni canales). */
  isPrivate: boolean;
}

export type Inbound =
  | (InboundBase & { kind: "text"; text: string; forwarded: boolean })
  | (InboundBase & { kind: "voice"; fileId: string; durationSec: number; fileSize: number })
  | (InboundBase & { kind: "document"; fileId: string; fileName: string; mime: string; fileSize: number; caption: string; forwarded: boolean })
  | (InboundBase & { kind: "photo"; caption: string })
  | (InboundBase & { kind: "callback"; callbackId: string; data: string; messageId: number })
  | (InboundBase & { kind: "unsupported" });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) ? v : null);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

export const MAX_TEXT = 2000;

export function parseUpdate(raw: unknown): Inbound | null {
  if (!isObj(raw)) return null;
  const updateId = num(raw.update_id);
  if (updateId === null) return null;

  if (isObj(raw.callback_query)) {
    const cq = raw.callback_query;
    const from = isObj(cq.from) ? cq.from : null;
    const msg = isObj(cq.message) ? cq.message : null;
    const chat = msg && isObj(msg.chat) ? msg.chat : null;
    const fromId = from ? num(from.id) : null;
    const chatId = chat ? num(chat.id) : null;
    const messageId = msg ? num(msg.message_id) : null;
    if (fromId === null || chatId === null || messageId === null || typeof cq.id !== "string") return null;
    return {
      kind: "callback",
      updateId,
      chatId,
      fromId,
      username: from ? str(from.username, 64) || undefined : undefined,
      isPrivate: chat?.type === "private",
      callbackId: cq.id.slice(0, 64),
      data: str(cq.data, 64),
      messageId,
    };
  }

  const m = isObj(raw.message) ? raw.message : null;
  if (!m) return null;
  const chat = isObj(m.chat) ? m.chat : null;
  const from = isObj(m.from) ? m.from : null;
  const chatId = chat ? num(chat.id) : null;
  const fromId = from ? num(from.id) : null;
  if (chatId === null || fromId === null || from?.is_bot === true) return null;
  const base: InboundBase = { updateId, chatId, fromId, username: str(from?.username, 64) || undefined, isPrivate: chat?.type === "private" };
  const forwarded = m.forward_origin !== undefined || m.forward_date !== undefined || m.forward_from !== undefined;

  if (typeof m.text === "string") return { ...base, kind: "text", text: m.text.slice(0, MAX_TEXT), forwarded };
  if (isObj(m.voice) || isObj(m.audio)) {
    const v = (isObj(m.voice) ? m.voice : m.audio) as Record<string, unknown>;
    if (typeof v.file_id !== "string") return { ...base, kind: "unsupported" };
    return { ...base, kind: "voice", fileId: v.file_id.slice(0, 200), durationSec: num(v.duration) ?? 0, fileSize: num(v.file_size) ?? 0 };
  }
  if (isObj(m.document)) {
    const d = m.document;
    if (typeof d.file_id !== "string") return { ...base, kind: "unsupported" };
    return { ...base, kind: "document", fileId: d.file_id.slice(0, 200), fileName: str(d.file_name, 120), mime: str(d.mime_type, 80), fileSize: num(d.file_size) ?? 0, caption: str(m.caption, MAX_TEXT), forwarded };
  }
  if (Array.isArray(m.photo)) return { ...base, kind: "photo", caption: str(m.caption, MAX_TEXT) };
  return { ...base, kind: "unsupported" };
}

// ───────────── Comandos y botones ─────────────

/** "/start ABC123" → { cmd: "start", arg: "ABC123" }. Quita el "@bot" del comando. */
export function parseCommand(text: string): { cmd: string; arg: string } | null {
  const m = /^\/([a-zA-Z_]{1,32})(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text.trim());
  return m ? { cmd: m[1].toLowerCase(), arg: (m[2] ?? "").trim() } : null;
}

/** callback_data (máx. 64 bytes): "<tipo>:<id>:<acción>[:<n>]". */
export type CallbackAction =
  | { type: "plan"; id: string; action: "all" | "step" | "cancel" }
  | { type: "step"; id: string; index: number; action: "ok" | "skip" | "always" };

export const encodeCallback = (c: CallbackAction): string => (c.type === "plan" ? `p:${c.id}:${c.action}` : `s:${c.id}:${c.index}:${c.action}`);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function decodeCallback(data: string): CallbackAction | null {
  const p = data.split(":");
  if (p[0] === "p" && p.length === 3 && UUID.test(p[1]) && (p[2] === "all" || p[2] === "step" || p[2] === "cancel")) return { type: "plan", id: p[1], action: p[2] };
  if (p[0] === "s" && p.length === 4 && UUID.test(p[1]) && /^\d{1,2}$/.test(p[2]) && (p[3] === "ok" || p[3] === "skip" || p[3] === "always")) {
    return { type: "step", id: p[1], index: Number(p[2]), action: p[3] };
  }
  return null;
}

// ───────────── Código de vinculación ─────────────

/** Sin 0/O/1/I/L para que no se confunda al teclearlo. */
export const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LINK_CODE_LENGTH = 8;
export const LINK_CODE_TTL_MS = 10 * 60_000;

export function isWellFormedCode(code: string): boolean {
  return code.length === LINK_CODE_LENGTH && [...code].every((ch) => LINK_CODE_ALPHABET.includes(ch));
}
export const normalizeCode = (raw: string) => raw.trim().toUpperCase().replace(/[\s-]/g, "");

/** Cortes de mensaje de Telegram: máx. 4096 caracteres. */
export function chunkMessage(text: string, max = 3800): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max / 2) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest) out.push(rest);
  return out;
}
