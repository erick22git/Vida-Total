"use client";

import { useState } from "react";
import { Check, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { hexToHsl, hslToHex, MAX_PRESETS, normalizeHex, readableInk } from "@/lib/agenda/colors";
import { AGENDA_COLORS } from "@/lib/agenda/icons";
import { useAgendaStore } from "@/lib/agenda/store";
import { CHIP } from "./sheet";

const DOT = 34;
const RING = "0 0 0 3px #232326, 0 0 0 5px #fff";

/**
 * Editor de un color: campo HEX que funciona de verdad (#FFF, ffcc00, #FFCC00…) + tono/saturación/brillo + selector nativo.
 * `initial` = el color con el que arranca; `presetToEdit` = si se está editando un preset (permite actualizar/eliminar).
 */
export function ColorEditor({
  initial, presetToEdit, onUse, onDone,
}: { initial: string; presetToEdit?: string | null; onUse?: (hex: string) => void; onDone: () => void }) {
  const presets = useAgendaStore((s) => s.colorPresets);
  const addPreset = useAgendaStore((s) => s.addColorPreset);
  const updatePreset = useAgendaStore((s) => s.updateColorPreset);
  const removePreset = useAgendaStore((s) => s.removeColorPreset);
  const start = normalizeHex(initial) ?? "#FFFFFF";
  const [text, setTextRaw] = useState(start);
  const [color, setColor] = useState(start);
  // El campo HEX y la vista previa van juntos: un HEX válido actualiza el color; uno a medias no lo cambia.
  const setText = (v: string) => {
    setTextRaw(v);
    const n = normalizeHex(v);
    if (n) setColor(n);
  };
  const [msg, setMsg] = useState("");
  const hsl = hexToHsl(color);
  const valid = normalizeHex(text) !== null;

  const setHsl = (h: number, s: number, l: number) => {
    setText(hslToHex(h, s, l));
  };

  return (
    <div className="rounded-3xl p-4 mb-4" style={{ background: "#1d1d20" }} data-testid="color-editor">
      <div className="flex items-center gap-3 mb-3">
        <span aria-hidden className="w-12 h-12 rounded-full shrink-0" style={{ background: color, boxShadow: "0 0 0 2px rgba(255,255,255,0.35)" }} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Código HEX"
          aria-invalid={!valid}
          placeholder="#FFFFFF"
          maxLength={7}
          className="flex-1 min-w-0 h-12 px-4 rounded-full bg-[#2b2b2e] outline-none text-[18px] font-extrabold tracking-wide uppercase"
          style={{ boxShadow: valid ? undefined : "inset 0 0 0 2px #ff453a" }}
        />
        <input type="color" aria-label="Selector de color" value={color.toLowerCase()} onChange={(e) => setText(e.target.value.toUpperCase())} className="w-12 h-12 rounded-full bg-transparent cursor-pointer shrink-0" />
      </div>
      {[
        { k: "Tono", v: hsl.h, max: 360, set: (n: number) => setHsl(n, hsl.s || 80, hsl.l || 50), bg: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" },
        { k: "Saturación", v: hsl.s, max: 100, set: (n: number) => setHsl(hsl.h, n, hsl.l), bg: `linear-gradient(90deg, ${hslToHex(hsl.h, 0, hsl.l)}, ${hslToHex(hsl.h, 100, hsl.l)})` },
        { k: "Brillo", v: hsl.l, max: 100, set: (n: number) => setHsl(hsl.h, hsl.s, n), bg: `linear-gradient(90deg,#000,${hslToHex(hsl.h, hsl.s, 50)},#fff)` },
      ].map((r) => (
        <label key={r.k} className="flex items-center gap-3 mb-2 text-[13px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
          <span className="w-[72px]">{r.k}</span>
          <input type="range" min={0} max={r.max} value={r.v} aria-label={r.k} onChange={(e) => r.set(+e.target.value)} className="flex-1 h-2 rounded-full appearance-none cursor-pointer" style={{ background: r.bg }} />
        </label>
      ))}
      <div className="flex flex-wrap gap-2 mt-3">
        {onUse && (
          <button disabled={!valid} onClick={() => { onUse(color); onDone(); }} className="h-11 px-5 rounded-full text-[15px] font-extrabold cursor-pointer disabled:opacity-40" style={{ background: "#fff", color: "#111" }}>
            Usar este color
          </button>
        )}
        {presetToEdit ? (
          <>
            <button disabled={!valid} onClick={() => { updatePreset(presetToEdit, color); setMsg("Preset actualizado"); onDone(); }} className="h-11 px-5 rounded-full text-[15px] font-extrabold cursor-pointer disabled:opacity-40" style={{ background: CHIP }}>
              Actualizar preset
            </button>
            <button onClick={() => { removePreset(presetToEdit); onDone(); }} className="flex items-center gap-1.5 h-11 px-4 rounded-full text-[15px] font-extrabold cursor-pointer" style={{ background: CHIP, color: "#ff453a" }}>
              <Trash2 size={16} /> Eliminar
            </button>
          </>
        ) : (
          <button
            disabled={!valid}
            onClick={() => {
              if (presets.length >= MAX_PRESETS) return setMsg(`Ya tienes ${MAX_PRESETS} presets. Elimina alguno para guardar otro.`);
              addPreset(color);
              setMsg("Guardado en tu paleta");
              onDone();
            }}
            className="h-11 px-5 rounded-full text-[15px] font-extrabold cursor-pointer disabled:opacity-40"
            style={{ background: CHIP }}
          >
            Guardar como preset
          </button>
        )}
        <button onClick={onDone} className="h-11 px-4 rounded-full text-[15px] font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.6)" }}>
          Cancelar
        </button>
      </div>
      {!valid && <p role="alert" className="text-[13px] font-semibold mt-2" style={{ color: "#ff453a" }}>Escribe un HEX válido, por ejemplo #FFCC00.</p>}
      {msg && <p role="status" className="text-[13px] font-semibold mt-2" style={{ color: "rgba(255,255,255,0.6)" }}>{msg}</p>}
    </div>
  );
}

/** Fila de colores: los de fábrica + los presets propios. Con `manage` se editan/eliminan en lugar de elegirse. */
export function PaletteRow({ value, onPick, manage, onEditPreset }: { value?: string; onPick?: (hex: string) => void; manage?: boolean; onEditPreset?: (hex: string) => void }) {
  const presets = useAgendaStore((s) => s.colorPresets);
  const removePreset = useAgendaStore((s) => s.removeColorPreset);
  const Dot = ({ hex, custom }: { hex: string; custom?: boolean }) => (
    <span className="relative">
      <button
        role="radio"
        aria-checked={value?.toLowerCase() === hex.toLowerCase()}
        aria-label={`${custom ? "Preset" : "Color"} ${hex}`}
        data-preset={custom ? hex : undefined}
        onClick={() => (manage && custom ? onEditPreset?.(hex) : onPick?.(hex))}
        className="rounded-full cursor-pointer flex items-center justify-center"
        style={{ width: DOT, height: DOT, background: hex, boxShadow: value?.toLowerCase() === hex.toLowerCase() ? RING : hex === "#FFFFFF" ? "inset 0 0 0 1px rgba(255,255,255,0.2)" : undefined, color: readableInk(hex) }}
      >
        {manage && custom && <Pencil size={13} strokeWidth={3} />}
      </button>
      {manage && custom && (
        <button aria-label={`Eliminar preset ${hex}`} onClick={() => removePreset(hex)} className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full flex items-center justify-center cursor-pointer" style={{ background: "#ff453a", color: "#fff" }}>
          <X size={11} strokeWidth={4} />
        </button>
      )}
    </span>
  );
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap items-center gap-x-3 gap-y-3">
      {AGENDA_COLORS.map((c) => (
        <Dot key={c} hex={c} />
      ))}
      {presets.length > 0 && <span aria-hidden className="w-px h-6 mx-0.5" style={{ background: "rgba(255,255,255,0.2)" }} />}
      {presets.map((c) => (
        <Dot key={c} hex={c} custom />
      ))}
    </div>
  );
}

/** Paleta completa (Ajustes y hoja de color): elegir, crear, guardar como preset, editar, eliminar y restablecer. */
export function PaletteManager({ value, onPick }: { value?: string; onPick?: (hex: string) => void }) {
  const presets = useAgendaStore((s) => s.colorPresets);
  const reset = useAgendaStore((s) => s.resetColorPresets);
  const [editor, setEditor] = useState<{ initial: string; preset: string | null } | null>(null);
  const [manage, setManage] = useState(false);
  return (
    <div>
      <div className="rounded-[26px] p-4 mb-3" style={{ background: "#232326" }}>
        <PaletteRow value={value} onPick={onPick} manage={manage} onEditPreset={(hex) => setEditor({ initial: hex, preset: hex })} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button onClick={() => setEditor({ initial: value ?? "#FFFFFF", preset: null })} className="flex items-center gap-1.5 h-10 px-4 rounded-full text-[14px] font-extrabold cursor-pointer" style={{ background: CHIP }}>
          <Plus size={16} strokeWidth={3} /> Crear color
        </button>
        {presets.length > 0 && (
          <button aria-pressed={manage} onClick={() => setManage((m) => !m)} className="flex items-center gap-1.5 h-10 px-4 rounded-full text-[14px] font-extrabold cursor-pointer" style={{ background: manage ? "#fff" : CHIP, color: manage ? "#111" : "#fff" }}>
            {manage ? <Check size={16} strokeWidth={3} /> : <Pencil size={15} />} {manage ? "Listo" : "Editar presets"}
          </button>
        )}
        {presets.length > 0 && (
          <button onClick={reset} className="flex items-center gap-1.5 h-10 px-4 rounded-full text-[14px] font-bold cursor-pointer" style={{ background: CHIP, color: "rgba(255,255,255,0.75)" }}>
            <RotateCcw size={14} /> Restablecer
          </button>
        )}
        <span className="text-[13px] font-semibold ml-auto" style={{ color: "rgba(255,255,255,0.45)" }}>{presets.length}/{MAX_PRESETS} presets</span>
      </div>
      {editor && <ColorEditor key={`${editor.preset ?? "nuevo"}-${editor.initial}`} initial={editor.initial} presetToEdit={editor.preset} onUse={onPick} onDone={() => setEditor(null)} />}
    </div>
  );
}
