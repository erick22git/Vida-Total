import { useCallback, useSyncExternalStore } from "react";
import type { GaugeKind } from "@/lib/3d/gauge-registry";

/** Gráfico elegido para las calorías: el arco (código) o uno de los 3 modelos 3D. Se guarda en este dispositivo. */
export type CalorieChartKind = "arc" | GaugeKind;

const KEY = "vt-calorie-chart";
const VALID: CalorieChartKind[] = ["arc", "canister", "meter", "battery"];
const listeners = new Set<() => void>();

function read(): CalorieChartKind {
  try {
    const v = localStorage.getItem(KEY) as CalorieChartKind | null;
    return v && VALID.includes(v) ? v : "arc";
  } catch {
    return "arc";
  }
}

export function useCalorieChartPref(): [CalorieChartKind, (k: CalorieChartKind) => void] {
  const kind = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "arc" as CalorieChartKind,
  );
  const set = useCallback((k: CalorieChartKind) => {
    try {
      localStorage.setItem(KEY, k);
    } catch {
      /* sin almacenamiento: vale solo esta sesión */
    }
    listeners.forEach((l) => l());
  }, []);
  return [kind, set];
}
