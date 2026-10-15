"use client";

/**
 * Único punto que toca `window.speechSynthesis` (Web Speech API, nativa del navegador — sin
 * backend, sin dependencia nueva, 100% local, mismo criterio de privacidad del resto del
 * documento). La decisión de qué decir vive en `voice-feedback.ts` (puro, testeado sin esto).
 *
 * Dos problemas reales encontrados en la prueba real (no hablaba nada):
 * 1. Muchos navegadores de celular (sobre todo Android) exigen que el PRIMER `speak()` de la
 *    página ocurra dentro de un gesto real del usuario (un tap) — si el primero que se intenta es
 *    automático (disparado por el conteo de reps, sin que el usuario haya tocado nada todavía), el
 *    navegador lo descarta en silencio, sin error. `unlockVoice()` existe para resolver justo eso:
 *    se llama una vez desde el primer tap real en la pantalla.
 * 2. Forzar `lang="es-ES"` falla en silencio si el dispositivo no tiene esa voz instalada (común:
 *    solo tiene "es-US" o ningún español). Ahora se busca una voz en español ya instalada
 *    (cualquier variante) y, si no hay ninguna, se deja que el navegador use su voz por defecto en
 *    vez de forzar un idioma que no existe ahí.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesListenerAttached = false;

function refreshVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  cachedVoices = window.speechSynthesis.getVoices();
  if (!voicesListenerAttached) {
    voicesListenerAttached = true;
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      cachedVoices = window.speechSynthesis.getVoices();
    });
  }
}

function spanishVoice(): SpeechSynthesisVoice | undefined {
  if (cachedVoices.length === 0) refreshVoices();
  return cachedVoices.find((v) => v.lang.toLowerCase().startsWith("es"));
}

export function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  // Corta la frase anterior si todavía no terminó — en reps rápidas, acumular frases en cola las
  // deja sonando fuera de tiempo (anunciando "3" cuando ya vas en la 6).
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = spanishVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  // Sin voz en español instalada: se deja sin forzar `lang` — el navegador usa su voz por
  // defecto en vez de fallar en silencio por pedir un idioma que no tiene.
  utterance.rate = 1.1;
  window.speechSynthesis.speak(utterance);
}

/** Llamar UNA vez, dentro de un gesto real del usuario (un tap), antes de que el primer `speak()`
 * automático pueda ocurrir — "desbloquea" la síntesis de voz en los navegadores que lo exigen. */
export function unlockVoice() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  refreshVoices();
  const utterance = new SpeechSynthesisUtterance(" ");
  utterance.volume = 0;
  window.speechSynthesis.speak(utterance);
}
