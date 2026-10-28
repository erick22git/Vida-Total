import { NextResponse } from "next/server";

// Server-only: estima el volumen (ml) de un vaso/botella/termo a partir de una foto.
// Reutiliza el mismo proveedor que el escáner de comidas (Groq, visión) — solo cambia el prompt.
// Body: { imageBase64: string }  →  { name: string, ml: number, confidence: "alta"|"media"|"baja", note?: string }
// Errores: { error: "no_api_key" | "invalid_image" | "rate_limit" | "parse_failed" | "unknown" }

export interface MeasuredVessel {
  name: string;
  ml: number;
  confidence: "alta" | "media" | "baja";
  note?: string;
}

const PLACEHOLDER_KEY = "TU_API_KEY_AQUI";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3.8-27b";
const GROQ_TIMEOUT_MS = 13000;

const PROMPT = `Eres un experto en medir recipientes de bebida a partir de una foto.
Identifica el recipiente principal (vaso, taza, botella, termo, shaker, jarra, lata...) y estima la CAPACIDAD TOTAL en mililitros, no solo lo que contiene ahora.

Método: usa las etiquetas visibles (ml, oz, L) si existen; si no, reconoce el modelo/formato comercial típico (lata 355 ml, botella PET 500 ml/600 ml/1 L, termo 500 ml/750 ml/1 L, shaker 600-700 ml, vaso de vidrio 250-350 ml); si no, compara su altura y diámetro con una mano, mesa u objetos conocidos. Si hay líquido visible y la capacidad total es dudosa, indica en "note" cuánto contiene aproximadamente.

Responde EXCLUSIVAMENTE con JSON válido, sin markdown ni texto extra:
{ "name": "nombre corto en español (ej. Vaso de vidrio)", "ml": number, "confidence": "alta" | "media" | "baja", "note": "frase corta opcional" }

Si no hay ningún recipiente visible responde { "name": "", "ml": 0, "confidence": "baja" }.`;

function clean(text: string): string {
  let c = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (c.startsWith("```")) c = c.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return c.trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || apiKey === PLACEHOLDER_KEY) return NextResponse.json({ error: "no_api_key" }, { status: 500 });

  let body: { imageBase64?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  const img = body.imageBase64;
  if (!img || typeof img !== "string") return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  const dataUrl = /^data:image\/[a-zA-Z+.-]+;base64,/.test(img) ? img : `data:image/jpeg;base64,${img}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_MODEL,
        temperature: 0.2,
        max_tokens: 300,
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: dataUrl } }] }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return NextResponse.json({ error: "no_api_key" }, { status: 401 });
      if (res.status === 429 || res.status === 498) return NextResponse.json({ error: "rate_limit" }, { status: 429 });
      if (res.status === 413 || res.status === 400 || res.status === 422) return NextResponse.json({ error: "invalid_image" }, { status: 400 });
      return NextResponse.json({ error: "unknown" }, { status: 502 });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return NextResponse.json({ error: "parse_failed" }, { status: 502 });
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(clean(content));
    } catch {
      return NextResponse.json({ error: "parse_failed" }, { status: 502 });
    }
    const ml = Math.round(Number(parsed.ml));
    if (!Number.isFinite(ml) || ml <= 0 || ml > 5000) return NextResponse.json({ error: "parse_failed" }, { status: 502 });
    const conf = parsed.confidence;
    const out: MeasuredVessel = {
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim().slice(0, 40) : "Mi vaso",
      ml,
      confidence: conf === "alta" || conf === "media" || conf === "baja" ? conf : "media",
      note: typeof parsed.note === "string" ? parsed.note.slice(0, 160) : undefined,
    };
    return NextResponse.json(out);
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    console.error("[api/water/measure]", aborted ? "timeout" : "failed");
    return NextResponse.json({ error: "unknown" }, { status: aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
