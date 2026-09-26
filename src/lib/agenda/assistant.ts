import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { iconForTitle, normalizeText } from "./icons";

/**
 * Interfaz del asistente de la Agenda (SOLO DISEÑO por ahora: no hay IA real).
 * `AgendaAssistant` es el contrato al que se conectará una IA de verdad; hoy `previewAssistant` es un intérprete
 * de reglas muy simple, claramente rotulado como vista previa, para poder ver todos los estados de la interfaz.
 */
export interface AgendaSuggestion {
  title: string;
  icon: string;
  /** yyyy-MM-dd */
  date: string;
  startMin: number | null;
  durationMin: number;
  /** Cómo se interpretó cada parte (para mostrarlo en la tarjeta). */
  reading: { date: string; time: string };
}

export interface AgendaAssistant {
  id: string;
  /** Texto que se muestra al usuario sobre lo que es. */
  label: string;
  /** `false` mientras no haya IA real detrás. */
  real: boolean;
  suggest(text: string, today: Date): Promise<AgendaSuggestion | null>;
}

const WEEKDAYS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

export function interpretPhrase(text: string, today: Date): AgendaSuggestion | null {
  let t = ` ${normalizeText(text)} `;
  if (t.trim().length < 3) return null;
  let date = today;
  let dateWord = "hoy";
  if (/ pasado manana /.test(t)) { date = addDays(today, 2); dateWord = "pasado mañana"; t = t.replace(" pasado manana ", " "); }
  else if (/ manana /.test(t)) { date = addDays(today, 1); dateWord = "mañana"; t = t.replace(" manana ", " "); }
  else if (/ hoy /.test(t)) { t = t.replace(" hoy ", " "); }
  else {
    const wd = Object.keys(WEEKDAYS).find((w) => t.includes(` ${w} `));
    if (wd) {
      const diff = (WEEKDAYS[wd] - today.getDay() + 7) % 7 || 7;
      date = addDays(today, diff);
      dateWord = wd;
      t = t.replace(` ${wd} `, " ");
    }
  }
  let startMin: number | null = null;
  const m = /\b(?:a las |a la |las )?(\d{1,2})(?::(\d{2}))?\s*(am|pm|h)?\b/.exec(t.replace(/\bde la (manana|tarde|noche)\b/, (_x, p) => (p === "manana" ? "am" : "pm")));
  if (m && /(a las|a la|:|am|pm)/.test(m[0])) {
    let h = +m[1];
    const mi = m[2] ? +m[2] : 0;
    if (m[3] === "pm" && h < 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    if (!m[3] && /tarde|noche/.test(t) && h < 12) h += 12;
    if (h < 24 && mi < 60) {
      startMin = h * 60 + mi;
      t = t.replace(m[0], " ").replace(/\b(de la )?(manana|tarde|noche)\b/, " ");
    }
  }
  const title = t
    .replace(/\b(quiero|necesito|tengo que|debo|voy a|me gustaria|recuerdame|agendar|agenda|programar|poner|hacer|a|el|la|los|las|de|para)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return null;
  // Recupera las tildes/ñ del texto original (el análisis se hizo sobre el texto sin tildes).
  const original = new Map(text.split(/\s+/).map((w) => [normalizeText(w.replace(/[^\p{L}\p{N}]/gu, "")), w.replace(/[^\p{L}\p{N}]/gu, "")] as const));
  const restored = title.split(" ").map((w) => original.get(w) ?? w).join(" ").toLowerCase();
  const nice = restored.charAt(0).toUpperCase() + restored.slice(1);
  const dur = /entren|gym|gimnasio|clase|estudi/.test(title) ? 60 : 30;
  return {
    title: nice,
    icon: iconForTitle(title),
    date: format(date, "yyyy-MM-dd"),
    startMin,
    durationMin: dur,
    reading: { date: `${dateWord}${dateWord === "hoy" || dateWord === "mañana" ? "" : ""} · ${format(date, "EEE d MMM", { locale: es }).replace(/\./g, "")}`, time: startMin === null ? "Sin hora" : `${Math.floor(startMin / 60)}:${String(startMin % 60).padStart(2, "0")}` },
  };
}

export const previewAssistant: AgendaAssistant = {
  id: "preview",
  label: "Vista previa · todavía sin IA real",
  real: false,
  suggest: async (text, today) => {
    await new Promise((r) => setTimeout(r, 900)); // estado "pensando" visible
    return interpretPhrase(text, today);
  },
};

let current: AgendaAssistant = previewAssistant;
export const getAssistant = () => current;
/** Punto de enganche futuro: aquí se registrará el asistente con IA real. */
export const setAssistant = (a: AgendaAssistant) => {
  current = a;
};
