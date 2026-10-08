/** Uso del modelo en Telegram (`/uso`, «cuántos tokens tengo»): barras de porcentaje. Funciones puras con pruebas. */

export interface GroqLimits {
  model: string;
  reqLimit: number;
  reqRemaining: number;
  tokLimit: number;
  tokRemaining: number;
  resetReq: string;
  resetTok: string;
}

/** Lee los encabezados x-ratelimit-* de Groq. `get` devuelve el valor de un encabezado o null. */
export function parseGroqLimits(model: string, get: (name: string) => string | null): GroqLimits | null {
  const n = (k: string) => {
    const v = Number(get(k));
    return Number.isFinite(v) && get(k) !== null ? v : null;
  };
  const reqLimit = n("x-ratelimit-limit-requests");
  const reqRemaining = n("x-ratelimit-remaining-requests");
  const tokLimit = n("x-ratelimit-limit-tokens");
  const tokRemaining = n("x-ratelimit-remaining-tokens");
  if (reqLimit === null || reqRemaining === null || tokLimit === null || tokRemaining === null) return null;
  return { model, reqLimit, reqRemaining, tokLimit, tokRemaining, resetReq: get("x-ratelimit-reset-requests") ?? "", resetTok: get("x-ratelimit-reset-tokens") ?? "" };
}

/** Barra de 10 casillas para un porcentaje 0-100. */
export function bar(pct: number): string {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const full = Math.round(p / 10);
  return "▓".repeat(full) + "░".repeat(10 - full);
}

const fmt = (n: number) => (n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const usedPct = (limit: number, remaining: number) => (limit > 0 ? ((limit - remaining) / limit) * 100 : 0);
const warn = (p: number) => (p >= 90 ? " 🔴" : p >= 70 ? " 🟠" : "");

export interface TodayUsage {
  calls: number;
  rateLimited: number;
  fallbacks: number;
}

export function renderUsage(l: GroqLimits | null, today: TodayUsage | null): string {
  const lines: string[] = ["📊 Uso del modelo"];
  if (l) {
    const pr = usedPct(l.reqLimit, l.reqRemaining);
    const pt = usedPct(l.tokLimit, l.tokRemaining);
    lines.push(`Modelo: ${l.model} (Groq, plan gratuito)`, "");
    lines.push(`Peticiones del día: ${bar(pr)} ${Math.round(pr)}%${warn(pr)}`);
    lines.push(`   ${fmt(l.reqLimit - l.reqRemaining)} de ${fmt(l.reqLimit)} usadas · se reinicia en ${l.resetReq || "—"}`);
    lines.push(`Tokens este minuto: ${bar(pt)} ${Math.round(pt)}%${warn(pt)}`);
    lines.push(`   ${fmt(l.tokLimit - l.tokRemaining)} de ${fmt(l.tokLimit)} · se libera en ${l.resetTok || "—"}`);
  } else {
    lines.push("No pude leer los límites del proveedor ahora mismo.");
  }
  if (today) lines.push("", `Tus llamadas hoy: ${today.calls}${today.rateLimited ? ` · ${today.rateLimited} frenadas por límite` : ""}${today.fallbacks ? ` · ${today.fallbacks} con modelo ligero` : ""}`);
  lines.push("", "Sí hay límite: el plan gratuito permite unos 8.000 tokens por minuto y 1.000 peticiones al día. Si te pasas, espero unos segundos o uso un modelo más ligero. Cada respuesta gasta unos 2.000–4.000 tokens.");
  return lines.join("\n");
}

/** ¿El mensaje pregunta por tokens / cuota / límite del modelo? */
export function asksAboutUsage(text: string): boolean {
  const t = text.toLowerCase();
  return /\btokens?\b/.test(t) || /(l[ií]mite|cuota|consumo|uso)\s+(del\s+)?(modelo|agente|ia|groq)/.test(t) || /cu[aá]nto\s+(me\s+)?(queda|llevo\s+gastado|he\s+gastado)\s+(del?\s+)?(modelo|ia|groq|tokens?)/.test(t);
}
