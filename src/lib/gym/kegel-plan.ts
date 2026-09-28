/**
 * Plan diario de Kegel (rediseño estilo Not Boring). Cinco sesiones al día; cada una se hace con la misma pantalla
 * de sesión y, al terminar su tiempo, queda marcada como cumplida ese día. Un día está "cumplido" cuando las cinco lo están.
 */
export type KegelSessionKind = "libro" | "pesa" | "loto";

/** Una fase del ciclo (p.ej. CONTRAE 3 s → SUELTA 3 s). `amp` = qué tan arriba va la onda (0–1). */
export interface KegelPhase {
  label: string;
  seconds: number;
  amp: number;
}

export interface KegelSessionDef {
  id: string;
  title: string;
  icon: KegelSessionKind;
  durationSec: number;
  phases: KegelPhase[];
}

const CONTRAE_SUELTA: KegelPhase[] = [
  { label: "CONTRAE", seconds: 3, amp: 1 },
  { label: "SUELTA", seconds: 3, amp: 0.15 },
];

export const KEGEL_SESSIONS: KegelSessionDef[] = [
  { id: "sesion-1", title: "Sesión 1", icon: "libro", durationSec: 240, phases: CONTRAE_SUELTA },
  { id: "sesion-2", title: "Sesión 2", icon: "libro", durationSec: 240, phases: CONTRAE_SUELTA },
  { id: "sesion-3", title: "Sesión 3", icon: "libro", durationSec: 240, phases: CONTRAE_SUELTA },
  {
    id: "ejercicios",
    title: "5 Ejercicios",
    icon: "pesa",
    durationSec: 285,
    phases: [
      { label: "CONTRAE", seconds: 5, amp: 1 },
      { label: "SUELTA", seconds: 3, amp: 0.15 },
    ],
  },
  {
    id: "respiracion",
    title: "4-7-8 Respiración",
    icon: "loto",
    durationSec: 190,
    phases: [
      { label: "INHALA", seconds: 4, amp: 1 },
      { label: "SOSTÉN", seconds: 7, amp: 1 },
      { label: "EXHALA", seconds: 8, amp: 0.15 },
    ],
  },
];

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} sec`;
  return s === 0 ? `${m} min` : `${m} min ${s} sec`;
}

export function getKegelSession(id: string): KegelSessionDef | undefined {
  return KEGEL_SESSIONS.find((s) => s.id === id);
}
