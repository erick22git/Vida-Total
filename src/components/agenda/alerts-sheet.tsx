"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ALERT_PRESETS, alertLabel, clampOffset, MAX_ALERTS, newAlert } from "@/lib/agenda/alerts";
import type { AgendaAlert } from "@/lib/agenda/types";
import { ActionButton, Chip, ModeRow } from "./agenda-sheets";
import { CARD, CHIP, Sheet } from "./sheet";

const UNITS = [
  { key: "min", label: "minutos", mult: 1 },
  { key: "h", label: "horas", mult: 60 },
  { key: "d", label: "días", mult: 1440 },
] as const;

/**
 * Alertas de una tarea (varias): crear, cambiar y quitar. Solo es CONFIGURACIÓN: se guarda con la tarea.
 * La entrega real de avisos en el teléfono llega en otra fase (ver `alertTimes` en src/lib/agenda/alerts.ts).
 */
export function AlertsSheet({ open, onClose, alerts, onChange, allDay }: { open: boolean; onClose: () => void; alerts: AgendaAlert[]; onChange: (a: AgendaAlert[]) => void; allDay: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("20");
  const [unit, setUnit] = useState<(typeof UNITS)[number]["key"]>("min");
  const close = () => {
    setEditing(null);
    setCustom(false);
    onClose();
  };
  const apply = (offsetMin: number) => {
    const off = clampOffset(offsetMin);
    if (editing === "new") onChange([...alerts, newAlert(off)]);
    else onChange(alerts.map((a) => (a.id === editing ? { ...a, offsetMin: off } : a)));
    setEditing(null);
    setCustom(false);
  };
  const customMin = Math.max(0, Math.floor(Number(amount) || 0)) * (UNITS.find((u) => u.key === unit)?.mult ?? 1);
  const current = alerts.find((a) => a.id === editing)?.offsetMin;
  return (
    <Sheet open={open} onClose={close} title="Alertas" maxHeight="88%">
      {editing === null ? (
        <>
          {alerts.length === 0 && (
            <p className="text-[16px] font-semibold mb-3 px-1" style={{ color: "rgba(255,255,255,0.55)" }}>
              Esta tarea no tiene alertas.
            </p>
          )}
          <div className="flex flex-col gap-2.5" data-testid="alert-list">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 h-14 pl-5 pr-3 rounded-full" style={{ background: "#232326" }}>
                <button aria-label={`Cambiar alerta: ${alertLabel(a.offsetMin)}`} onClick={() => setEditing(a.id)} className="flex-1 text-left text-[18px] font-bold cursor-pointer">
                  {alertLabel(a.offsetMin)}
                </button>
                <button aria-label={`Quitar alerta: ${alertLabel(a.offsetMin)}`} onClick={() => onChange(alerts.filter((x) => x.id !== a.id))} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer" style={{ background: CHIP }}>
                  <X size={18} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
          {alerts.length < MAX_ALERTS && (
            <div className="mt-3">
              <ActionButton onClick={() => setEditing("new")}>Añadir alerta</ActionButton>
            </div>
          )}
          <p className="text-[13px] font-semibold mt-4 px-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            {allDay ? "En tareas de todo el día se cuenta desde las 8:00. " : ""}Tu configuración ya se guarda con la tarea. El aviso en el teléfono llegará en la siguiente fase.
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Cuándo avisar">
            {ALERT_PRESETS.map((m) => (
              <ModeRow key={m} selected={!custom && current === m} onClick={() => apply(m)}>
                {alertLabel(m)}
              </ModeRow>
            ))}
            <ModeRow selected={custom} onClick={() => setCustom(true)}>
              Personalizado
            </ModeRow>
          </div>
          {custom && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <input inputMode="numeric" aria-label="Cantidad" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 3))} className="w-20 h-12 rounded-full text-center text-[19px] font-extrabold outline-none" style={{ background: "#232326" }} />
                {UNITS.map((u) => (
                  <Chip key={u.key} selected={unit === u.key} onClick={() => setUnit(u.key)}>
                    {u.label}
                  </Chip>
                ))}
              </div>
              <div className="mt-3">
                <ActionButton onClick={() => apply(customMin)} disabled={customMin > 7 * 1440}>
                  Aceptar · {alertLabel(customMin)}
                </ActionButton>
              </div>
            </>
          )}
          <button
            onClick={() => {
              setEditing(null);
              setCustom(false);
            }}
            className="w-full h-12 mt-3 rounded-full text-[16px] font-bold cursor-pointer"
            style={{ background: CARD, color: "rgba(255,255,255,0.8)" }}
          >
            Cancelar
          </button>
        </>
      )}
    </Sheet>
  );
}
