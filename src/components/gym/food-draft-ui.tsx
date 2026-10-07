"use client";

/** Piezas de interfaz compartidas por Lista, Escáner y Voz para un alimento ya resuelto (ver `lib/nutrition/draft-item.ts`). */
import { useState } from "react";
import { BookOpen, ChevronDown, Clock, Plus } from "lucide-react";
import { draftFromResult, draftNuevo, type DraftItem } from "@/lib/nutrition/draft-item";
import { resolveCandidate, type Candidate, type ResolverIndex } from "@/lib/nutrition/food-resolver";
import { cn } from "@/lib/utils";

/** Gramos editables: el texto se escribe libremente y solo se confirma un número válido (> 0). 16 px: sin zoom en iOS. */
export function GramsInput({ value, onChange, className }: { value: number; onChange: (g: number) => void; className?: string }) {
  const [text, setText] = useState(String(Math.round(value * 10) / 10));
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-white/[0.08] glass-specular-ring pl-3 pr-2 focus-within:shadow-[var(--glass-specular-strong)]", className)}>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        aria-label="Gramos"
        onChange={(e) => {
          const t = e.target.value.replace(",", ".");
          if (!/^\d*\.?\d*$/.test(t)) return;
          setText(t);
          const n = parseFloat(t);
          if (Number.isFinite(n) && n > 0) onChange(n);
        }}
        onBlur={() => setText(String(Math.round(value * 10) / 10))}
        className="w-14 bg-transparent py-1.5 text-base text-white text-right outline-none"
      />
      <span className="text-xs text-white/45">g</span>
    </span>
  );
}

/** Chip con el alimento elegido; al tocarlo se despliegan las alternativas (y "Crear nuevo"). */
export function FoodChip({
  item,
  idx,
  usage,
  onReplace,
  onOpenChange,
}: {
  item: DraftItem;
  idx: ResolverIndex;
  usage: Map<string, number>;
  onReplace: (next: DraftItem) => void;
  /** Para que quien lo contiene se eleve por encima de lo de abajo mientras el menú está abierto. */
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const setOpen = (v: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(open) : v;
    setOpenState(next);
    onOpenChange?.(next);
  };
  const currentId = item.foodId ?? item.recipeId;
  const alternatives = item.candidates.filter((c) => !(c.id === currentId && c.kind === (item.tipo === "receta" ? "receta" : "alimento")));
  const canChange = item.tipo !== "nuevo" || item.candidates.length > 0;

  function pick(c: Candidate) {
    const r = resolveCandidate(item.texto, c, item.candidates, idx, { gramos: item.gramos, usage });
    const next = draftFromResult(item.meal, item.texto, r, item.id);
    if (next) onReplace({ ...next, gramos: item.gramos });
    setOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <button
        onClick={() => canChange && setOpen((v) => !v)}
        className={cn(
          "max-w-full inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-white",
          item.tipo === "nuevo" || item.tipo === "ia" ? "bg-amber-400/15 text-amber-200" : "bg-white/[0.08]",
          canChange ? "cursor-pointer" : "cursor-default",
        )}
      >
        {item.tipo === "receta" && <BookOpen size={13} className="shrink-0 text-white/60" />}
        <span className="truncate">{item.nombre}</span>
        {item.tipo === "nuevo" && <span className="text-[10px] uppercase shrink-0">nuevo</span>}
        {item.tipo === "ia" && <span className="text-[10px] uppercase shrink-0">estimado IA</span>}
        {canChange && <ChevronDown size={13} className="shrink-0 text-white/40" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-64 max-w-[80vw] rounded-2xl glass-panel shadow-2xl overflow-hidden" style={{ background: "#151515" }}>
          {alternatives.map((c) => (
            <button key={`${c.kind}-${c.id}`} onClick={() => pick(c)} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-white/[0.08] cursor-pointer border-b border-white/[0.06] last:border-b-0">
              {c.kind === "receta" ? <BookOpen size={14} className="text-white/50 shrink-0" /> : <Clock size={14} className="text-white/40 shrink-0" />}
              <span className="text-sm text-white/90 truncate flex-1 min-w-0">{c.nombre}</span>
            </button>
          ))}
          {item.tipo !== "nuevo" && (
            <button
              onClick={() => {
                onReplace(draftNuevo(item.meal, item.texto, item.gramos, item.candidates, item.id));
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-white/[0.08] cursor-pointer border-t border-white/[0.06]"
            >
              <Plus size={14} className="text-white/50 shrink-0" />
              <span className="text-sm text-white truncate">Crear nuevo “{item.texto}”</span>
            </button>
          )}
          {alternatives.length === 0 && item.tipo === "nuevo" && <p className="px-3.5 py-2.5 text-xs text-white/45">Sin alternativas.</p>}
        </div>
      )}
    </div>
  );
}
