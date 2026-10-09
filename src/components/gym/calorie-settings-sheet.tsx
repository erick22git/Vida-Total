"use client";

/**
 * Panel de ajustes de Calorías, abierto con el ícono de "sliders" (arriba a la derecha, presente en
 * las 3 vistas de la home nueva). Acá vive TODO lo de editar/configurar que antes estaba suelto en
 * el `CalorieArcCard` (ya borrado): ver restante, meta de calorías, macros, qué gráfico mostrar e
 * historial — más el acceso a Progreso. Ya NO hay acceso a Racha desde acá (se llega solo tocando
 * el fuego dentro de la vista de racha, o de la franja de los 7 días).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, TrendingUp, Check } from "lucide-react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { GlassInput } from "@/components/glass/glass-input";
import { GlassButton } from "@/components/glass/glass-button";
import { GAUGES } from "@/lib/3d/gauge-registry";
import { useGymStore } from "@/lib/store/gymStore";
import { useCalorieChartPref, type CalorieChartKind } from "@/lib/gym/calorie-chart-pref";
import { calcCalorieGoal } from "@/lib/gym/calorie-calc";
import { evaluateAdaptiveCalories } from "@/lib/gym/calorie-adaptive";
import { MONO_FONT } from "@/lib/ui/mono-font";

const CHART_OPTIONS: { id: CalorieChartKind; label: string }[] = [
  { id: "arc", label: "Arco" },
  { id: "canister", label: GAUGES.canister.name },
  { id: "meter", label: GAUGES.meter.name },
  { id: "battery", label: GAUGES.battery.name },
];

import { useTargetProfile } from "@/lib/nutrition/use-targets";
import { getNutrientTargets, macrosVsMeta, reviewCalorieGoal, suggestMacros } from "@/lib/nutrition/nutrient-targets";

export function CalorieSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const calorieGoal = useGymStore((s) => s.calorieGoal);
  const proteinGoal = useGymStore((s) => s.proteinGoal);
  const carbsGoal = useGymStore((s) => s.carbsGoal);
  const fatGoal = useGymStore((s) => s.fatGoal);
  const showRemaining = useGymStore((s) => s.showRemaining);
  const toggleShowRemaining = useGymStore((s) => s.toggleShowRemaining);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const weightEntries = useGymStore((s) => s.weightEntries);
  const loggedFoods = useGymStore((s) => s.loggedFoods);
  const adaptiveDismissed = useGymStore((s) => s.adaptiveDismissed);
  const dismissAdaptiveSuggestion = useGymStore((s) => s.dismissAdaptiveSuggestion);
  const [chartKind, setChartKind] = useCalorieChartPref();

  // Ajuste adaptativo (Fase 3): solo se puede evaluar si ya se configuró la meta con la
  // calculadora (necesitamos el TDEE calculado por fórmula para comparar contra el real).
  const adaptive = useMemo(() => {
    const p = gymProfile;
    if (!p?.sexo || !p.edad || !p.pesoKg || !p.alturaCm || !p.nivelActividad || !p.objetivoCalorico || !p.intensidadObjetivo) {
      return null;
    }
    const calc = calcCalorieGoal({
      sexo: p.sexo,
      pesoKg: p.pesoKg,
      alturaCm: p.alturaCm,
      edad: p.edad,
      nivelActividad: p.nivelActividad,
      objetivoCalorico: p.objetivoCalorico,
      intensidadObjetivo: p.intensidadObjetivo,
      grasaCorporalPct: p.modoPro ? p.grasaCorporalPct : undefined,
    });
    return evaluateAdaptiveCalories({ weightEntries, loggedFoods, calorieGoal, calculatedTDEE: calc.tdee });
  }, [gymProfile, weightEntries, loggedFoods, calorieGoal]);

  const showSuggestion =
    adaptive?.status === "suggestion" &&
    adaptive.suggestedCalorieGoal !== undefined &&
    adaptiveDismissed?.goal !== adaptive.suggestedCalorieGoal;

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [macroModalOpen, setMacroModalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const waterGoalMl = useGymStore((s) => s.waterGoalMl);
  const perfilMetas = useTargetProfile();
  const sugerencia = useMemo(() => {
    const completo = !!perfilMetas.sexo && !!perfilMetas.edad && !!perfilMetas.pesoKg;
    if (!completo) return null;
    const macros = suggestMacros({ ...perfilMetas, kcal: calorieGoal });
    return {
      macros,
      piso: reviewCalorieGoal(perfilMetas.sexo, calorieGoal),
      actual: macrosVsMeta(calorieGoal, proteinGoal, carbsGoal, fatGoal),
    };
  }, [perfilMetas, calorieGoal, proteinGoal, carbsGoal, fatGoal]);
  const aguaSug = useMemo(() => getNutrientTargets(perfilMetas).targets.aguaBebidas, [perfilMetas]);
  const [calorieInput, setCalorieInput] = useState(String(calorieGoal));
  const [proteinInput, setProteinInput] = useState(String(proteinGoal));
  const [carbsInput, setCarbsInput] = useState(String(carbsGoal));
  const [fatInput, setFatInput] = useState(String(fatGoal));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] text-white overflow-y-auto"
          style={{ background: "var(--app-bg)" }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex flex-col gap-5 px-4 pb-10 max-w-md mx-auto">
            <header className="flex items-center gap-3 pt-[max(env(safe-area-inset-top),16px)]">
              <button
                onClick={onClose}
                aria-label="Cerrar ajustes"
                className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                style={{ background: "#0d0d0d" }}
              >
                <ChevronLeft size={22} strokeWidth={2.6} />
              </button>
              <h1 className="text-[15px] uppercase tracking-[0.12em]" style={MONO_FONT}>
                Ajustes de Calorías
              </h1>
            </header>

            <button
              onClick={() => {
                onClose();
                router.push("/gym/calorias/progreso");
              }}
              className="flex items-center justify-center gap-1.5 cursor-pointer bg-white/[0.06] hover:bg-white/[0.12] transition-colors rounded-2xl py-3"
            >
              <TrendingUp size={14} className="text-white/70" />
              <span className="text-xs font-semibold text-white/80">Ver progreso</span>
            </button>

            {showSuggestion && adaptive?.suggestedCalorieGoal !== undefined && (
              <div className="flex flex-col gap-2.5 rounded-2xl p-4" style={{ background: "#0d0d0d" }}>
                <span className="text-[10px] uppercase tracking-[0.1em] text-white/40" style={MONO_FONT}>
                  Ajuste sugerido
                </span>
                <p className="text-xs text-white/70">{adaptive.mensaje}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      useGymStore.setState({ calorieGoal: adaptive.suggestedCalorieGoal! });
                      dismissAdaptiveSuggestion(adaptive.suggestedCalorieGoal!);
                    }}
                    className="flex-1 rounded-full py-2.5 text-xs font-semibold cursor-pointer bg-white text-black"
                  >
                    Aceptar ({adaptive.suggestedCalorieGoal} kcal)
                  </button>
                  <button
                    onClick={() => dismissAdaptiveSuggestion(adaptive.suggestedCalorieGoal!)}
                    className="flex-1 rounded-full py-2.5 text-xs font-medium cursor-pointer text-white/50 bg-white/[0.06]"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {adaptive?.status === "insufficient_data" && (
              <p className="text-[11px] text-white/35 px-1 -mt-1">{adaptive.mensaje}</p>
            )}

            <div className="flex flex-col gap-1">
              <button
                onClick={toggleShowRemaining}
                className="w-full flex items-center justify-between text-left px-3.5 py-3 rounded-xl text-sm text-white/85 hover:bg-white/[0.06] cursor-pointer"
              >
                Ver restante
                {showRemaining && <Check size={14} className="text-white" />}
              </button>
              <button
                onClick={() => {
                  setCalorieInput(String(calorieGoal));
                  setGoalModalOpen(true);
                }}
                className="w-full text-left px-3.5 py-3 rounded-xl text-sm text-white/85 hover:bg-white/[0.06] cursor-pointer"
              >
                <span className="flex items-center justify-between">
                  Configuración de calorías
                  <span className="text-white/45 tabular-nums">{calorieGoal} kcal</span>
                </span>
              </button>
              <button
                onClick={() => {
                  setProteinInput(String(proteinGoal));
                  setCarbsInput(String(carbsGoal));
                  setFatInput(String(fatGoal));
                  setMacroModalOpen(true);
                }}
                className="w-full text-left px-3.5 py-3 rounded-xl text-sm text-white/85 hover:bg-white/[0.06] cursor-pointer"
              >
                Configurar macros
              </button>
              <button
                onClick={() => setReviewOpen(true)}
                className="w-full text-left px-3.5 py-3 rounded-xl text-sm text-white/85 hover:bg-white/[0.06] cursor-pointer"
              >
                Revisar sugerencia de macros
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/40 px-1 mb-1" style={MONO_FONT}>
                Gráfico del contador
              </p>
              {CHART_OPTIONS.map((o) => {
                const available = o.id === "arc" || GAUGES[o.id].available;
                return (
                  <button
                    key={o.id}
                    disabled={!available}
                    onClick={() => setChartKind(o.id)}
                    className="w-full flex items-center justify-between text-left px-3.5 py-3 rounded-xl text-sm text-white/85 hover:bg-white/[0.06] cursor-pointer disabled:cursor-default disabled:text-white/35 disabled:hover:bg-transparent"
                    role="menuitemradio"
                    aria-checked={chartKind === o.id}
                  >
                    {o.label}
                    {!available ? <span className="text-[10px]">próximamente</span> : chartKind === o.id && <Check size={14} className="text-white" />}
                  </button>
                );
              })}
              <p className="w-full text-left px-3.5 py-3 text-sm text-white/35 cursor-default">Historial (próximamente)</p>
            </div>
          </div>

          <ExpandSheet open={goalModalOpen} onClose={() => setGoalModalOpen(false)} title="Configuración de calorías">
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setGoalModalOpen(false);
                  onClose();
                  router.push("/gym/calorias/configurar-calorias");
                }}
                className="w-full text-center rounded-2xl py-3 text-sm font-semibold cursor-pointer bg-white/[0.08] hover:bg-white/[0.14] transition-colors"
              >
                Calcular con mis datos (BMR/TDEE)
              </button>
              <GlassInput
                type="number"
                inputMode="numeric"
                value={calorieInput}
                onChange={(e) => setCalorieInput(e.target.value)}
                placeholder="Meta diaria de kcal"
              />
              <GlassButton
                className="w-full"
                onClick={() => {
                  const v = parseInt(calorieInput, 10);
                  if (v > 0) useGymStore.setState({ calorieGoal: v });
                  setGoalModalOpen(false);
                }}
              >
                Guardar
              </GlassButton>
            </div>
          </ExpandSheet>

          <ExpandSheet open={reviewOpen} onClose={() => setReviewOpen(false)} title="Revisar sugerencia">
            {!sugerencia ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-white/70">
                  Para sugerir un reparto necesitamos tu sexo, edad y peso. Complétalos en el perfil y vuelve aquí.
                </p>
                <GlassButton
                  className="w-full"
                  onClick={() => {
                    setReviewOpen(false);
                    onClose();
                    router.push("/gym/calorias/configurar-calorias");
                  }}
                >
                  Completar mis datos
                </GlassButton>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-white/55 leading-relaxed">
                  Tu meta de {calorieGoal} kcal no cambia. Esto es solo una referencia: la proteína sale de g por kg de peso y el resto
                  reparte la meta (4 kcal por g de proteína y carbos, 9 por g de grasa).
                </p>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 text-sm tabular-nums">
                  <span />
                  <span className="text-[10px] uppercase text-white/40 text-right">Ahora</span>
                  <span className="text-[10px] uppercase text-white/40 text-right">Sugerido</span>
                  <span className="text-white/75">Proteína</span>
                  <span className="text-right text-white/60">{proteinGoal} g</span>
                  <span className="text-right text-white">{sugerencia.macros.proteinaG} g</span>
                  <span className="text-white/75">Carbohidratos</span>
                  <span className="text-right text-white/60">{carbsGoal} g</span>
                  <span className="text-right text-white">{sugerencia.macros.carbosG} g</span>
                  <span className="text-white/75">Grasas</span>
                  <span className="text-right text-white/60">{fatGoal} g</span>
                  <span className="text-right text-white">{sugerencia.macros.grasasG} g</span>
                  <span className="text-white/45 text-xs">Suman</span>
                  <span className="text-right text-xs text-white/45">{Math.round(sugerencia.actual.kcalMacros)} kcal</span>
                  <span className="text-right text-xs text-white/45">{Math.round(sugerencia.macros.kcalMacros)} kcal</span>
                </div>
                {sugerencia.actual.difiere && (
                  <p className="text-xs text-white/55">
                    Tus macros actuales suman {Math.round(sugerencia.actual.kcalMacros)} kcal, un {Math.round(sugerencia.actual.difierePct)} % distinto de tu meta.
                  </p>
                )}
                {sugerencia.piso.mensaje && <p className="text-xs text-white/55">{sugerencia.piso.mensaje}</p>}
                {sugerencia.macros.avisos.map((a) => (
                  <p key={a} className="text-xs text-white/45">{a}</p>
                ))}
                <p className="text-[10px] text-white/35">Valores de referencia generales (DRI, ISSN), no consejo médico.</p>
                <GlassButton
                  className="w-full"
                  onClick={() => {
                    useGymStore.setState({
                      proteinGoal: sugerencia.macros.proteinaG,
                      carbsGoal: sugerencia.macros.carbosG,
                      fatGoal: sugerencia.macros.grasasG,
                    });
                    setReviewOpen(false);
                  }}
                >
                  Aplicar estos macros
                </GlassButton>
                <button onClick={() => setReviewOpen(false)} className="w-full rounded-2xl py-3 text-sm text-white/70 bg-white/[0.06] cursor-pointer">
                  Dejar como está
                </button>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
              <p className="text-sm font-semibold text-white/85">Meta de agua (bebidas)</p>
              <p className="text-xs text-white/55 leading-relaxed">
                La DRI fija el agua <b className="text-white/75">total</b> (bebidas + la de los alimentos); lo observado es que ~81 % viene de bebidas, y de ahí sale la
                sugerencia. {aguaSug.generico ? "Sin sexo y edad es un punto medio entre hombre y mujer. " : ""}Tu meta guardada: {waterGoalMl} ml · sugerida:{" "}
                <b className="text-white">{aguaSug.objetivo} ml</b>.
              </p>
              {waterGoalMl !== aguaSug.objetivo ? (
                <GlassButton
                  className="w-full"
                  onClick={() => {
                    useGymStore.setState({ waterGoalMl: aguaSug.objetivo });
                  }}
                >
                  Usar {aguaSug.objetivo} ml como meta de agua
                </GlassButton>
              ) : (
                <p className="text-xs text-white/45">Tu meta de agua ya coincide con la sugerencia.</p>
              )}
              <p className="text-[10px] text-white/35">Valores de referencia generales (DRI, 2005), no consejo médico. No cambia tus registros de agua.</p>
            </div>
          </ExpandSheet>

          <ExpandSheet open={macroModalOpen} onClose={() => setMacroModalOpen(false)} title="Configurar macros">
            <div className="flex flex-col gap-3">
              <LabeledInput label="Proteína (g)" value={proteinInput} onChange={setProteinInput} />
              <LabeledInput label="Carbohidratos (g)" value={carbsInput} onChange={setCarbsInput} />
              <LabeledInput label="Grasas (g)" value={fatInput} onChange={setFatInput} />
              <GlassButton
                className="w-full"
                onClick={() => {
                  const p = parseInt(proteinInput, 10);
                  const c = parseInt(carbsInput, 10);
                  const f = parseInt(fatInput, 10);
                  useGymStore.setState({
                    ...(p > 0 ? { proteinGoal: p } : {}),
                    ...(c > 0 ? { carbsGoal: c } : {}),
                    ...(f > 0 ? { fatGoal: f } : {}),
                  });
                  setMacroModalOpen(false);
                }}
              >
                Guardar
              </GlassButton>
            </div>
          </ExpandSheet>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-white/50">{label}</span>
      <GlassInput type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
