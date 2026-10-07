/** Transcripción de notas de voz de Telegram con Whisper de Groq. SOLO SERVIDOR (GROQ_API_KEY). */

const URL_ = "https://api.groq.com/openai/v1/audio/transcriptions";
export const MAX_VOICE_BYTES = 3 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 90;

export async function transcribeVoice(data: Uint8Array, filename = "voz.ogg"): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key || key === "TU_API_KEY_AQUI" || data.byteLength === 0 || data.byteLength > MAX_VOICE_BYTES) return null;
  const form = new FormData();
  form.append("file", new Blob([data as BlobPart], { type: "audio/ogg" }), filename);
  form.append("model", process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo");
  form.append("language", "es");
  form.append("response_format", "json");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { text?: string };
    const text = (json.text ?? "").trim();
    return text ? text.slice(0, 1500) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
