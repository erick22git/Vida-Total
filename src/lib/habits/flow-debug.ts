import { create } from "zustand";

/**
 * Diagnóstico del flujo Gym → Hábitos (SOLO desarrollo: en producción `flowTrace` no hace nada).
 *
 *   EVENT → HABIT → SOURCE → PENDING ACTION → ROUTE → TARGET → CHECK
 *
 * Cada paso se anota con ✓/✗ y un detalle; se ve en la consola (`[GYM→HÁBITOS]`) y en el panel `sim` del layout.
 */
export type FlowStep = "EVENT" | "HABIT" | "SOURCE" | "PENDING ACTION" | "ROUTE" | "TARGET" | "CHECK";

export interface FlowTraceLine {
  step: FlowStep;
  ok: boolean;
  detail: string;
  at: number;
}

interface FlowDebugState {
  lines: FlowTraceLine[];
  push: (line: FlowTraceLine) => void;
  clear: () => void;
}

const MAX_LINES = 40;

export const useFlowDebugStore = create<FlowDebugState>((set) => ({
  lines: [],
  push: (line) => set((s) => ({ lines: [...s.lines, line].slice(-MAX_LINES) })),
  clear: () => set({ lines: [] }),
}));

export function flowTrace(step: FlowStep, ok: boolean, detail = ""): void {
  if (process.env.NODE_ENV === "production") return;
  useFlowDebugStore.getState().push({ step, ok, detail, at: Date.now() });
  console.info(`[GYM→HÁBITOS] ${ok ? "✓" : "✗"} ${step}${detail ? ` · ${detail}` : ""}`);
}
