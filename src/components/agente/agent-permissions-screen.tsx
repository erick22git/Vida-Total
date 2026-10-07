"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Lock, Power, ShieldAlert, Undo2, Zap } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { GlassModal } from "@/components/glass/glass-modal";
import { AutoTotalBadge, useAutoTotalActive } from "@/components/agente/auto-total-badge";
import { TelegramLinkCard } from "@/components/agente/telegram-link-card";
import { NEVER_AUTO } from "@/lib/agent/never-auto";
import { exposedTools } from "@/lib/agent/tools/registry";
import { undoRecord } from "@/lib/agent/actions/undo";
import { levelFor } from "@/lib/agent/config";
import { AGENT_MODULES, MODULE_LABEL, type AgentModule, type AutoTotalDuration, type Channel, type ToolLevel } from "@/lib/agent/types";
import { getAgentSessionId, hydrateAgentStore, useAgentStore } from "@/lib/store/agentStore";
import { getCurrentUserId } from "@/lib/store/user-scope";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const CONFIRM_PHRASE = "SALTAR PERMISOS";
const KIND_LABEL = { read: "Lectura", write: "Escritura", destructive: "Borrado", config: "Configuración" } as const;
const LEVELS: Array<{ v: ToolLevel; label: string }> = [
  { v: "ask", label: "Preguntar" },
  { v: "allow", label: "Permitir" },
  { v: "block", label: "Bloquear" },
];
const DURATIONS: Array<{ v: AutoTotalDuration; label: string }> = [
  { v: "session", label: "Esta sesión" },
  { v: "hour", label: "1 hora" },
  { v: "until_off", label: "Hasta que lo apague" },
];

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="w-12 h-7 rounded-full relative cursor-pointer shrink-0"
      style={{ background: on ? "#34d399" : "#3a3a3d" }}
    >
      <span className="absolute top-1 w-5 h-5 rounded-full transition-all bg-white" style={{ left: on ? "calc(100% - 1.5rem)" : "0.25rem" }} />
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="px-1">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {hint && <p className="text-xs text-white/45">{hint}</p>}
      </div>
      <GlassCard accentColor="var(--gym)" className="flex flex-col gap-3" interactive={false}>
        {children}
      </GlassCard>
    </section>
  );
}

function NumberField({ label, value, min, max, step = 1, onChange, suffix }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-white/80">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="w-24 rounded-xl bg-white/[0.07] px-3 py-2 text-right text-sm text-white outline-none"
        />
        {suffix && <span className="text-xs text-white/45 w-8">{suffix}</span>}
      </span>
    </label>
  );
}

export function AgentPermissionsScreen() {
  const config = useAgentStore((s) => s.config);
  const history = useAgentStore((s) => s.history);
  const setConfig = useAgentStore((s) => s.setConfig);
  const setKill = useAgentStore((s) => s.setKillSwitch);
  const { active: autoActive } = useAutoTotalActive();
  const [channel, setChannel] = useState<Channel>("app");
  const [autoOpen, setAutoOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [duration, setDuration] = useState<AutoTotalDuration>("hour");

  useEffect(() => {
    const uid = getCurrentUserId();
    if (uid) hydrateAgentStore(uid).catch(() => {});
  }, []);

  const byModule = useMemo(() => {
    const out = new Map<AgentModule, ReturnType<typeof exposedTools>>();
    for (const t of exposedTools()) out.set(t.module, [...(out.get(t.module) ?? []), t]);
    return out;
  }, []);

  const startAuto = () => {
    setConfig((c) => ({ ...c, autoTotal: { duration, startedAt: Date.now(), sessionId: getAgentSessionId() } }));
    setAutoOpen(false);
    setPhrase("");
  };

  return (
    <div className="flex flex-col gap-5 pb-10">
      <header className="flex items-center gap-2 pt-1">
        <Link href="/" aria-label="Volver" className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.06] shrink-0">
          <ChevronLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Agente y permisos</h1>
          <p className="text-xs text-white/50">Qué puede hacer tu agente, dónde y hasta cuánto.</p>
        </div>
      </header>

      <AutoTotalBadge className="self-start" />

      {/* Apagado total */}
      <button
        onClick={() => setKill(!config.killSwitch)}
        className={cn(
          "rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer min-h-[48px]",
          config.killSwitch ? "bg-emerald-500/90 text-black" : "bg-red-500/15 text-red-200 border border-red-400/30",
        )}
      >
        <Power size={16} />
        {config.killSwitch ? "Agente APAGADO · tocar para encender" : "Apagar el agente por completo"}
      </button>

      <Section title="Modo" hint="Cómo decide el agente cuándo preguntarte.">
        {([
          ["ask_always", "Preguntar siempre", "Pregunta todo salvo lo que marcaste «Permitir» en la tabla de abajo."],
          ["auto_safe", "Auto en lo seguro", "Las lecturas pasan solas; las escrituras solo si las marcaste «Permitir»."],
        ] as const).map(([v, t, d]) => (
          <button
            key={v}
            onClick={() => setConfig((c) => ({ ...c, mode: v }))}
            className={cn("text-left rounded-2xl p-3 border cursor-pointer", config.mode === v ? "border-emerald-400/60 bg-emerald-400/10" : "border-white/10 bg-white/[0.03]")}
            aria-pressed={config.mode === v}
          >
            <p className="text-sm font-medium">{t}</p>
            <p className="text-xs text-white/55">{d}</p>
          </button>
        ))}
        <div className="rounded-2xl p-3 border border-red-400/30 bg-red-500/[0.06] flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-red-300" />
            <p className="text-sm font-medium">Auto total (saltar permisos)</p>
          </div>
          <p className="text-xs text-white/55">
            Solo en la app, nunca por Telegram. Caduca solo. La lista «nunca automático» sigue pidiendo confirmación.
          </p>
          {autoActive ? (
            <button onClick={() => useAgentStore.getState().stopAutoTotal()} className="rounded-xl bg-red-500 text-white text-sm font-medium py-2.5 cursor-pointer">
              Apagar Auto total ahora
            </button>
          ) : (
            <button onClick={() => setAutoOpen(true)} className="rounded-xl bg-red-500/20 text-red-100 text-sm font-medium py-2.5 cursor-pointer">
              Activar…
            </button>
          )}
        </div>
      </Section>

      <Section title="Herramientas por módulo" hint="Nivel de cada herramienta, por canal.">
        <div className="flex gap-1.5">
          {(["app", "telegram"] as Channel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={cn("flex-1 rounded-xl py-2 text-sm cursor-pointer", channel === c ? "bg-white/15 text-white" : "bg-white/[0.04] text-white/55")}
            >
              {c === "app" ? "App" : "Telegram"}
            </button>
          ))}
        </div>
        {[...byModule.entries()].map(([mod, tools]) => (
          <div key={mod} className="flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-wide text-white/40">{MODULE_LABEL[mod]}</p>
            {tools.map((t) => {
              const locked = (t.neverAuto?.length ?? 0) > 0 || t.kind === "destructive" || t.kind === "config";
              const level = levelFor(config, channel, t.name);
              return (
                <div key={t.name} className="flex flex-col gap-1.5 rounded-xl bg-white/[0.03] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm">{t.label}</p>
                    <span className="text-[10px] rounded-full bg-white/10 px-2 py-0.5 text-white/60">{KIND_LABEL[t.kind]}</span>
                  </div>
                  {locked ? (
                    <p className="text-[11px] text-amber-200/80 flex items-center gap-1"><Lock size={11} /> Siempre pregunta</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      {LEVELS.map((l) => (
                        <button
                          key={l.v}
                          aria-pressed={level === l.v}
                          onClick={() => setConfig((c) => ({ ...c, levels: { ...c.levels, [channel]: { ...c.levels[channel], [t.name]: l.v } } }))}
                          className={cn(
                            "rounded-lg py-1.5 text-xs cursor-pointer",
                            level === l.v ? (l.v === "block" ? "bg-red-500/30 text-red-100" : l.v === "allow" ? "bg-emerald-500/30 text-emerald-100" : "bg-white/20 text-white") : "bg-white/[0.05] text-white/50",
                          )}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {byModule.size === 0 && <p className="text-xs text-white/50">Todavía no hay herramientas activas.</p>}
      </Section>

      <Section title="Restricciones">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Solo lectura (todos los canales)</span>
          <Toggle on={config.readOnly} onChange={(v) => setConfig((c) => ({ ...c, readOnly: v }))} label="Solo lectura" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm">Módulos permitidos</p>
          <div className="flex flex-wrap gap-1.5">
            {AGENT_MODULES.filter((m) => m !== "sistema").map((m) => {
              const on = config.allowedModules.includes(m);
              return (
                <button
                  key={m}
                  aria-pressed={on}
                  onClick={() => setConfig((c) => ({ ...c, allowedModules: on ? c.allowedModules.filter((x) => x !== m) : [...c.allowedModules, m] }))}
                  className={cn("rounded-full px-3 py-1.5 text-xs cursor-pointer", on ? "bg-emerald-500/25 text-emerald-100" : "bg-white/[0.05] text-white/45")}
                >
                  {MODULE_LABEL[m]}
                </button>
              );
            })}
          </div>
        </div>
        <NumberField label="Agua máxima por acción" value={config.limits.waterMaxMl} min={50} max={5000} step={50} suffix="ml" onChange={(n) => setConfig((c) => ({ ...c, limits: { ...c.limits, waterMaxMl: n } }))} />
        <NumberField label="Calorías máximas por entrada" value={config.limits.caloriesMaxPerEntry} min={50} max={5000} step={50} suffix="kcal" onChange={(n) => setConfig((c) => ({ ...c, limits: { ...c.limits, caloriesMaxPerEntry: n } }))} />
        <NumberField label="Más de N elementos = por lotes" value={config.limits.maxBatch} min={1} max={5} onChange={(n) => setConfig((c) => ({ ...c, limits: { ...c.limits, maxBatch: n } }))} />
        <NumberField label="Escrituras por hora" value={config.writesPerHour} min={1} max={120} onChange={(n) => setConfig((c) => ({ ...c, writesPerHour: n }))} />
        <NumberField label="Escrituras por día" value={config.writesPerDay} min={1} max={600} step={10} onChange={(n) => setConfig((c) => ({ ...c, writesPerDay: n }))} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Horario silencioso</span>
          <Toggle on={config.quietHours.enabled} onChange={(v) => setConfig((c) => ({ ...c, quietHours: { ...c.quietHours, enabled: v } }))} label="Horario silencioso" />
        </div>
        {config.quietHours.enabled && (
          <div className="flex items-center gap-2 text-sm">
            <input type="time" value={config.quietHours.from} onChange={(e) => e.target.value && setConfig((c) => ({ ...c, quietHours: { ...c.quietHours, from: e.target.value } }))} className="rounded-xl bg-white/[0.07] px-3 py-2 text-white outline-none" />
            <span className="text-white/50">a</span>
            <input type="time" value={config.quietHours.to} onChange={(e) => e.target.value && setConfig((c) => ({ ...c, quietHours: { ...c.quietHours, to: e.target.value } }))} className="rounded-xl bg-white/[0.07] px-3 py-2 text-white outline-none" />
          </div>
        )}
      </Section>

      <Section title="Canales" hint="Telegram es más estricto por defecto.">
        <TelegramLinkCard />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Agente en la app</span>
          <Toggle on={config.channels.app.enabled} onChange={(v) => setConfig((c) => ({ ...c, channels: { ...c.channels, app: { ...c.channels.app, enabled: v } } }))} label="Canal app" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Agente por Telegram</span>
          <Toggle on={config.channels.telegram.enabled} onChange={(v) => setConfig((c) => ({ ...c, channels: { ...c.channels, telegram: { ...c.channels.telegram, enabled: v } } }))} label="Canal Telegram" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Telegram solo lectura</span>
          <Toggle on={config.channels.telegram.readOnly} onChange={(v) => setConfig((c) => ({ ...c, channels: { ...c.channels, telegram: { ...c.channels.telegram, readOnly: v } } }))} label="Telegram solo lectura" />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Telegram: lecturas automáticas</span>
          <Toggle
            on={config.channels.telegram.maxMode === "auto_safe"}
            onChange={(v) => setConfig((c) => ({ ...c, channels: { ...c.channels, telegram: { ...c.channels.telegram, maxMode: v ? "auto_safe" : "ask_always" } } }))}
            label="Telegram lecturas automáticas"
          />
        </div>
      </Section>

      <Section title="Nunca automático" hint="Fijo en el código: ni Auto total ni «Permitir siempre» lo saltan.">
        <ul className="flex flex-col gap-2">
          {NEVER_AUTO.map((n) => (
            <li key={n.code} className="flex gap-2 text-sm">
              <ShieldAlert size={15} className="text-amber-300 shrink-0 mt-0.5" />
              <span>
                {n.titulo}
                <span className="block text-xs text-white/45">{n.porque}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Historial de acciones" hint="Lo que hizo el agente (app y Telegram), con deshacer cuando se puede.">
        {history.length === 0 && <p className="text-xs text-white/50">Todavía no hizo nada.</p>}
        {history.slice(0, 40).map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <div className="min-w-0 flex-1">
              <p className={cn("truncate", r.undone && "line-through text-white/40", !r.ok && "text-red-300")}>{r.summary}</p>
              <p className="text-[11px] text-white/40">
                {format(r.at, "d MMM HH:mm")} · {r.channel === "app" ? "App" : "Telegram"}
              </p>
            </div>
            {r.undo && !r.undone && (
              <button onClick={() => undoRecord(r)} className="rounded-xl bg-white/10 px-3 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer min-h-[38px]">
                <Undo2 size={13} /> Deshacer
              </button>
            )}
          </div>
        ))}
      </Section>

      <GlassModal open={autoOpen} onClose={() => setAutoOpen(false)} title="Activar Auto total">
        <div className="flex flex-col gap-3 py-1">
          <div className="rounded-2xl bg-red-500/10 border border-red-400/30 p-3 text-sm text-red-100">
            <p className="font-semibold mb-1">Advertencia</p>
            El agente podrá crear, editar y registrar cosas sin preguntarte (tareas, notas, agua, comidas). No se salta la lista «nunca
            automático» (hábitos, borrar, lotes, permisos, Telegram, contenido no confiable). Verás una insignia roja permanente y podrás
            apagarlo cuando quieras.
          </div>
          <div className="grid gap-1.5">
            {DURATIONS.map((d) => (
              <button key={d.v} onClick={() => setDuration(d.v)} aria-pressed={duration === d.v} className={cn("rounded-xl py-2.5 text-sm cursor-pointer", duration === d.v ? "bg-white/20" : "bg-white/[0.05] text-white/60")}>
                {d.label}
              </button>
            ))}
          </div>
          <label className="text-xs text-white/60">
            Para confirmar escribe: <b className="text-white">{CONFIRM_PHRASE}</b>
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} autoCapitalize="characters" className="mt-1 w-full rounded-xl bg-white/[0.07] px-3 py-2.5 text-sm text-white outline-none" />
          </label>
          <button disabled={phrase.trim().toUpperCase() !== CONFIRM_PHRASE} onClick={startAuto} className="rounded-xl bg-red-500 text-white py-3 text-sm font-semibold disabled:opacity-30 cursor-pointer">
            Activar Auto total
          </button>
        </div>
      </GlassModal>
    </div>
  );
}
