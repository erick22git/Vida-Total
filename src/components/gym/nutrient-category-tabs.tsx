"use client";

/**
 * Rediseño Calorías: las 4 categorías de nutrientes de la referencia (imagen 3 del pedido) —
 * Principales / A limitar / Micronutrientes / Otros — con los 4 íconos de abajo para cambiar entre
 * ellas y el contador "n/4" al lado. Vive debajo del `CalorieGaugeDisplay` en la vista de
 * nutrientes (`NutrientDetailView`) — acá viven los macros, no se repiten en ningún otro lado.
 */
import { useState } from "react";
import { Dna, Leaf, Atom, Droplet } from "lucide-react";
import { MacroColumn, MACRO_COLORS } from "@/components/gym/calorie-arc-visual";
import { ViewDots } from "@/components/habitos/view-dots";
import { NUTRIENT_LABELS, NUTRIENT_SECTIONS, type TrackableNutrient } from "@/lib/types";
import { MONO_FONT } from "@/lib/ui/mono-font";
import type { NutrientCoverage } from "@/lib/food-utils";

const TABS = [
  { key: "principales", label: "Principales", icon: Dna },
  { key: "limitar", label: "A limitar", icon: Leaf },
  { key: "micro", label: "Micronutrientes", icon: Atom },
  { key: "otros", label: "Otros", icon: Droplet },
] as const;

/** Cómo mostrar un nutriente según cuántos alimentos del día traen dato: ninguno = "sin dato", algunos = "datos incompletos". */
function coverageNote(c: NutrientCoverage | undefined): { noData: boolean; note?: string } {
  if (!c || c.de === 0) return { noData: false };
  if (c.con === 0) return { noData: true };
  if (c.con < c.de) return { noData: false, note: `datos incompletos · ${c.con} de ${c.de}` };
  return { noData: false };
}

function NutrientBar({ label, value, goal, unit, cov }: { label: string; value: number; goal: number; unit: string; cov?: NutrientCoverage }) {
  const { noData, note } = coverageNote(cov);
  const pct = noData ? 0 : goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/80">{label}</span>
        <span className="text-white/50 tabular-nums">
          {noData ? (
            "sin dato"
          ) : (
            <>
              {Math.round(value * 10) / 10} / {goal}
              {unit}
            </>
          )}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "rgba(255,255,255,0.85)", opacity: note ? 0.45 : 1 }} />
      </div>
      {note && <span className="text-[10px] text-white/35">{note}</span>}
    </div>
  );
}

const MICRO_SECTIONS = NUTRIENT_SECTIONS.filter((s) => s.label === "Vitaminas" || s.label === "Minerales");

export function NutrientCategoryTabs({
  totals,
  otherNutrientTotals,
  proteinGoal,
  carbsGoal,
  fatGoal,
  coverage,
  viewIndex = 1,
  viewCount = 3,
}: {
  totals: { proteina: number; carbos: number; grasas: number };
  otherNutrientTotals: Partial<Record<TrackableNutrient, number>>;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  coverage?: Record<string, NutrientCoverage>;
  viewIndex?: number;
  viewCount?: number;
}) {
  const [tab, setTab] = useState(0);
  const nutrient = (key: TrackableNutrient) => otherNutrientTotals[key] ?? 0;
  const cov = (key: string) => coverage?.[key];

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex-1 min-h-[92px] flex flex-col justify-center">
        {tab === 0 && (
          <div className="grid grid-cols-4 gap-2">
            <MacroColumn label="Proteína" value={totals.proteina} goal={proteinGoal} color={MACRO_COLORS.proteina} compact />
            <MacroColumn label="Carbs" value={totals.carbos} goal={carbsGoal} color={MACRO_COLORS.carbos} compact />
            <MacroColumn label="Grasas" value={totals.grasas} goal={fatGoal} color={MACRO_COLORS.grasas} compact />
            <MacroColumn label="Fibra" value={nutrient("fibra")} goal={NUTRIENT_LABELS.fibra.goal} color="#a78bfa" compact {...coverageNote(cov("fibra"))} />
          </div>
        )}
        {tab === 1 && (
          <div className="flex flex-col gap-2.5">
            <NutrientBar label="Azúcares añadidos" value={nutrient("azucaresAnadidos")} goal={NUTRIENT_LABELS.azucaresAnadidos.goal} unit={NUTRIENT_LABELS.azucaresAnadidos.unit} cov={cov("azucaresAnadidos")} />
            <NutrientBar label="Grasas trans" value={nutrient("grasasTrans")} goal={NUTRIENT_LABELS.grasasTrans.goal} unit={NUTRIENT_LABELS.grasasTrans.unit} cov={cov("grasasTrans")} />
            <NutrientBar label="Grasas saturadas" value={nutrient("grasasSaturadas")} goal={NUTRIENT_LABELS.grasasSaturadas.goal} unit={NUTRIENT_LABELS.grasasSaturadas.unit} cov={cov("grasasSaturadas")} />
            <NutrientBar label="Sodio" value={nutrient("sodio")} goal={NUTRIENT_LABELS.sodio.goal} unit={NUTRIENT_LABELS.sodio.unit} cov={cov("sodio")} />
          </div>
        )}
        {tab === 2 && (
          <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1" style={{ touchAction: "pan-y" }}>
            {MICRO_SECTIONS.map((section) => (
              <div key={section.label} className="flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-[0.1em] text-white/40" style={MONO_FONT}>
                  {section.label}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {section.keys.map((key) => (
                    <MacroColumn key={key} label={NUTRIENT_LABELS[key].label} value={nutrient(key)} goal={NUTRIENT_LABELS[key].goal} color="#38bdf8" compact {...coverageNote(cov(key))} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 3 && (
          <div className="flex flex-col gap-2.5">
            <NutrientBar label="Carbs netos" value={nutrient("carbsNetos")} goal={NUTRIENT_LABELS.carbsNetos.goal} unit={NUTRIENT_LABELS.carbsNetos.unit} cov={cov("carbsNetos")} />
            <NutrientBar label="Azúcares" value={nutrient("azucares")} goal={NUTRIENT_LABELS.azucares.goal} unit={NUTRIENT_LABELS.azucares.unit} cov={cov("azucares")} />
            <NutrientBar label="Alcohol" value={nutrient("alcohol")} goal={NUTRIENT_LABELS.alcohol.goal || 1} unit={NUTRIENT_LABELS.alcohol.unit} cov={cov("alcohol")} />
          </div>
        )}
      </div>

      {/* Controles abajo de todo: el contador "n/4" arriba de los íconos y los 3 puntos de la vista a la derecha. */}
      <div className="mt-auto flex flex-col items-center gap-2 pb-2">
        <span className="text-[11px] text-white/35 tabular-nums" style={MONO_FONT}>
          {tab + 1}/{TABS.length}
        </span>
        <div className="relative w-full flex items-center justify-center">
          <div className="flex items-center gap-2">
            {TABS.map(({ key, icon: Icon }, i) => (
              <button
                key={key}
                onClick={() => setTab(i)}
                aria-label={TABS[i].label}
                aria-current={tab === i}
                className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                style={{ background: tab === i ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)" }}
              >
                <Icon size={18} className={tab === i ? "text-white" : "text-white/45"} />
              </button>
            ))}
          </div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2">
            <ViewDots index={viewIndex} count={viewCount} />
          </div>
        </div>
      </div>
    </div>
  );
}
