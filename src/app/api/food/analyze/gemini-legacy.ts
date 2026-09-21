// ARCHIVADO (2026-09): proveedor Gemini Vision. Deshabilitado porque las keys que
// genera la cuenta ahora vienen con formato "AQ." y la API responde 401
// ACCESS_TOKEN_TYPE_UNSUPPORTED. Se conserva por si Google lo arregla y se quiere
// volver a ofrecer como alternativa o fallback: basta con importar
// `analyzeWithGemini` desde route.ts (mismo contrato de entrada/salida).
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import type { AnalyzedFoodItem } from "./route";

// Server-only route: recognizes foods in a photo taken from the Escáner
// (modo Foto) using Gemini Vision. Never expose GEMINI_API_KEY to the client.
//
// Request body: { imageBase64: string }
// `imageBase64` is expected to be a full data URL (e.g. "data:image/jpeg;base64,...."),
// exactly what `canvas.toDataURL("image/jpeg", ...)` produces in the browser —
// this keeps the frontend simple (no manual stripping before sending) since we
// strip the "data:...;base64," prefix here before handing raw base64 to Gemini.
//
// Response (success): { items: AnalyzedFoodItem[] }
// Response (error): { error: "no_api_key" | "invalid_image" | "rate_limit" | "parse_failed" | "unknown" }

const PLACEHOLDER_KEY = "TU_API_KEY_AQUI";

// Latest stable Gemini Flash model available in the family at the time this was
// written (multimodal, vision-capable, fast/cheap — ideal for this use case).
// If Google ships a newer default Flash alias, update this constant.
const MODEL_NAME = "gemini-2.5-flash";

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

function stripDataUrlPrefix(imageBase64: string): { mimeType: string; data: string } {
  const match = /^data:(image\/[a-zA-Z+.-]+);base64,([\s\S]*)$/.exec(imageBase64);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  // Already raw base64 with no data URL prefix — assume JPEG (matches what the
  // scanner captures via canvas.toDataURL("image/jpeg", ...)).
  return { mimeType: "image/jpeg", data: imageBase64 };
}

function cleanJsonFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  return cleaned.trim();
}

export async function analyzeWithGemini(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === PLACEHOLDER_KEY) {
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

  const { mimeType, data } = stripDataUrlPrefix(body.imageBase64);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const result = await model.generateContent([
      { text: PROMPT },
      { inlineData: { mimeType, data } },
    ]);

    const text = result.response.text();
    const cleaned = cleanJsonFences(text);

    let parsed: { items?: AnalyzedFoodItem[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("[api/food/analyze] failed to parse Gemini response as JSON", err, cleaned);
      return NextResponse.json({ error: "parse_failed" }, { status: 502 });
    }

    if (!Array.isArray(parsed.items)) {
      return NextResponse.json({ error: "parse_failed" }, { status: 502 });
    }

    return NextResponse.json({ items: parsed.items });
  } catch (err: unknown) {
    const rawMessage = err instanceof Error ? err.message : String(err);
    // Defensive redaction: never let the raw API key reach logs or the client,
    // even if a future SDK version echoes the request URL/headers in an error.
    const message = rawMessage.split(apiKey).join("[redacted]");
    console.error("[api/food/analyze] Gemini request failed", message);

    // 401/403 here means the key is present but rejected by Google (revoked,
    // malformed, wrong credential type, etc.) — treat it the same as a
    // missing key from the client's perspective ("IA no configurada",
    // fall back to manual entry), distinct from rate limits or parse errors.
    if (/\b401\b|\b403\b|unauthorized|unauthenticated|api_key_invalid|permission_denied/i.test(message)) {
      return NextResponse.json({ error: "no_api_key" }, { status: 401 });
    }

    if (/429|rate.?limit|quota|resource_exhausted/i.test(message)) {
      return NextResponse.json({ error: "rate_limit" }, { status: 429 });
    }

    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
}
