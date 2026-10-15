"use client";

/**
 * Único punto que toca `window.speechSynthesis` (Web Speech API, nativa del navegador — sin
 * backend, sin dependencia nueva, 100% local, mismo criterio de privacidad del resto del
 * documento). La decisión de qué decir vive en `voice-feedback.ts` (puro, testeado sin esto).
 */
export function speak(text: string, lang = "es-ES") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  // Corta la frase anterior si todavía no terminó — en reps rápidas, acumular frases en cola las
  // deja sonando fuera de tiempo (anunciando "3" cuando ya vas en la 6).
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1.1;
  window.speechSynthesis.speak(utterance);
}
