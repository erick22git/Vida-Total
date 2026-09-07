import type { SetType } from "@/lib/types";

export const SET_TYPE_META: Record<
  SetType,
  { label: string; short: string; color: string }
> = {
  normal: { label: "Normal", short: "•", color: "#9a9aa5" },
  calentamiento: { label: "Calentamiento", short: "W", color: "#f59e0b" },
  descendente: { label: "Descendente", short: "D", color: "#a855f7" },
  fallo: { label: "Al Fallo", short: "F", color: "#ef4444" },
};

export const SET_TYPES: SetType[] = ["normal", "calentamiento", "descendente", "fallo"];
