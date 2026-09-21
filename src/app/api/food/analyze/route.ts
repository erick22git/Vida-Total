import { NextResponse } from "next/server";

// Server-only route: recognizes foods in a photo taken from the Escáner
// (modo Foto) using Groq (OpenAI-compatible chat completions with vision).
// Never expose GROQ_API_KEY to the client.
//
// Request body: { imageBase64: string }
// `imageBase64` is expected to be a full data URL (e.g. "data:image/jpeg;base64,...."),
// exactly what `canvas.toDataURL("image/jpeg", ...)` produces in the browser.
// Groq accepts data URLs directly in `image_url.url`, so no stripping is needed.
//
// Response (success): { items: AnalyzedFoodItem[] }
// Response (error): { error: "no_api_key" | "invalid_image" | "rate_limit" | "parse_failed" | "unknown" }
//
// The previous Gemini Vision implementation is archived in ./gemini-legacy.ts
// (same contract) in case Google fixes the "AQ." key bug and we want it back
// as an alternative or fallback.

export interface AnalyzedFoodItem {
  name: string;
  estimatedGrams: number;
  confidence: "alta" | "media" | "baja";
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const PLACEHOLDER_KEY = "TU_API_KEY_AQUI";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Vision-capable model listed in https://console.groq.com/docs/vision (checked
// 2026-09-21). meta-llama/llama-4-scout-17b-16e-instruct is no longer listed.
// Override without redeploying code via the GROQ_VISION_MODEL env var.
const DEFAULT_MODEL = "qwen/qwen3.8-27b";

// Must stay below ANALYZE_TIMEOUT_MS (15s) in escaner/page.tsx so the server
// answers with a clean error before the client aborts.
const GROQ_TIMEOUT_MS = 13000;

const PROMPT = `Eres un experto en nutrición. Analiza la imagen y encuentra TODOS los alimentos visibles en el plato o la escena.

Para cada alimento que identifiques, estima su porción comparando con referencias visuales comunes en la imagen (tamaño del plato, tamaño de una mano o cubierto, envases reconocibles, etc.) y calcula valores nutricionales realistas para esa porción estimada.

Responde EXCLUSIVAMENTE con un JSON válido (sin bloques de código markdown, sin texto adicional antes o después) con exactamente este formato:

{
  "items": [
    {
      "name": "string en español",
      "estimatedGrams": number,
      "confidence": "alta" | "media" | "baja",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number
    }
  ]
}

Si no identificas ningún alimento en la imagen, responde con { "items": [] }.`;

function normalizeDataUrl(imageBase64: string): string {
  if (/^data:image\/[a-zA-Z+.-]+;base64,/.test(imageBase64)) return imageBase64;
  // Raw base64 with no prefix — assume JPEG (what the scanner captures).
  return `data:image/jpeg;base64,${imageBase64}`;
}

/** Removes reasoning blocks (<think>…</think>) and markdown fences some models add. */
function cleanModelText(text: string): string {
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  return cleaned.trim();
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function toItem(raw: unknown): AnalyzedFoodItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (!name) return null;
  const confidence =
    r.confidence === "alta" || r.confidence === "media" || r.confidence === "baja"
      ? r.confidence
      : "media";
  return {
    name,
    estimatedGrams: toNumber(r.estimatedGrams),
    confidence,
    calories: toNumber(r.calories),
    protein: toNumber(r.protein),
    carbs: toNumber(r.carbs),
    fat: toNumber(r.fat),
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey || apiKey === PLACEHOLDER_KEY) {
    return NextResponse.json({ error: "no_api_key" }, { status: 500 });
  }

  let body: { imageBase64?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  if (!body.imageBase64 || typeof body.imageBase64 !== "string") {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  const model = process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: normalizeDataUrl(body.imageBase64) } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      console.error(`[api/food/analyze] Groq responded ${res.status}`, detail);

      // Codes per https://console.groq.com/docs/errors
      // 401/403: key missing, invalid or not allowed → "IA no configurada".
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ error: "no_api_key" }, { status: 401 });
      }
      // 429 (rate/quota) and 498 (flex tier capacity) → try again later.
      if (res.status === 429 || res.status === 498) {
        return NextResponse.json({ error: "rate_limit" }, { status: 429 });
      }
      // 413 (payload too large) or 400/422 (unreadable image) → bad image.
      if (res.status === 413 || res.status === 400 || res.status === 422) {
        return NextResponse.json({ error: "invalid_image" }, { status: 400 });
      }
      // 404 (model gone), 5xx, 499 → generic failure.
      return NextResponse.json({ error: "unknown" }, { status: 502 });
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json({ error: "parse_failed" }, { status: 502 });
    }

    const cleaned = cleanModelText(content);
    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("[api/food/analyze] failed to parse Groq response as JSON", err, cleaned);
      return NextResponse.json({ error: "parse_failed" }, { status: 502 });
    }

    if (!Array.isArray(parsed.items)) {
      return NextResponse.json({ error: "parse_failed" }, { status: 502 });
    }

    const items = parsed.items.map(toItem).filter((i): i is AnalyzedFoodItem => i !== null);
    return NextResponse.json({ items });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("[api/food/analyze] Groq request timed out");
      return NextResponse.json({ error: "unknown" }, { status: 504 });
    }
    // The key only travels in the Authorization header, but redact defensively.
    const rawMessage = err instanceof Error ? err.message : String(err);
    console.error("[api/food/analyze] Groq request failed", rawMessage.split(apiKey).join("[redacted]"));
    return NextResponse.json({ error: "unknown" }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }
}
