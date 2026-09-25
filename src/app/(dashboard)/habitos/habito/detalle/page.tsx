"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { todayISO, useHabitsStore } from "@/lib/store/habitsStore";
import { computeHabitStats, cumulativeSeries } from "@/lib/progress";
import type { Habit } from "@/lib/types/habits";
import { AreaChart } from "@/components/habitos/detail/area-chart";
import { HistoryGrid } from "@/components/habitos/detail/history-grid";
import { AchievementCard, buildAchievements } from "@/components/habitos/detail/achievements";
import { haptic } from "@/lib/haptics/haptic";
import { playSound } from "@/lib/sound/sound-engine";

const MONO = { fontFamily: "var(--font-geist-mono), monospace" } as const;
const DAY_CHIPS = [
  { label: "lun", day: 1 },
  { label: "mar", day: 2 },
  { label: "mié", day: 3 },
  { label: "jue", day: 4 },
  { label: "vie", day: 5 },
  { label: "sáb", day: 6 },
  { label: "dom", day: 0 },
];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const CARD = "#1c1c1c";

const shortDate = (iso: string) => format(new Date(`${iso}T12:00:00`), "d MMM", { locale: es }).replace(".", "");

function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString("es", { hour: "numeric", minute: "2-digit", hour12: true });
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[15px] uppercase tracking-[0.14em] text-white/70 mt-8 mb-3 px-1" style={MONO}>
      {children}
    </h2>
  );
}

function RowButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full h-14 rounded-2xl px-5 flex items-center justify-between text-[17px] cursor-pointer active:scale-[0.99] transition-transform"
      style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, sub, delta }: { label: string; value: number; sub: string; delta?: number }) {
  return (
    <div className="rounded-3xl py-5 px-3 flex flex-col items-center gap-1 text-center" style={{ background: CARD }}>
      <span className="text-[17px] text-white/70">{label}</span>
      <span className="text-[56px] font-black leading-none tabular-nums my-1">{value}</span>
      <span className="text-[16px] text-white/65">
        {delta !== undefined && <span className="text-[#f5b301] mr-1">{delta >= 0 ? `+${delta}` : delta}</span>}
        {sub}
      </span>
    </div>
  );
}

function DetailBody({ habit }: { habit: Habit }) {
  const router = useRouter();
  const updateHabit = useHabitsStore((s) => s.updateHabit);
  const toggleHabitOnDate = useHabitsStore((s) => s.toggleHabitOnDate);
  const removeHabit = useHabitsStore((s) => s.removeHabit);

  const today = todayISO();
  const todayDate = useMemo(() => new Date(`${today}T12:00:00`), [today]);
  const stats = useMemo(
    () => computeHabitStats({ completedDates: habit.completedDates, frequency: habit.frequency }, todayDate),
    [habit.completedDates, habit.frequency, todayDate],
  );
  const series = useMemo(() => cumulativeSeries(habit.completedDates, 90, todayDate), [habit.completedDates, todayDate]);
  const achievements = useMemo(() => {
    const all = buildAchievements(stats.total, stats.bestStreak);
    // Primero los que están en curso (más avanzados primero), al final los completos.
    const inProgress = all.filter((a) => a.progress < 1).sort((a, b) => b.progress - a.progress);
    return [...inProgress, ...all.filter((a) => a.progress >= 1)];
  }, [stats.total, stats.bestStreak]);

  const [scrolled, setScrolled] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(habit.name);
  const [editingHistory, setEditingHistory] = useState(false);
  const [allAchievements, setAllAchievements] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [missionOpen, setMissionOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(habit.goal ?? 1));
  const [unitDraft, setUnitDraft] = useState(habit.unit ?? "vez");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const days = habit.scheduledDays ?? ALL_DAYS;
  const perWeek = days.length;
  const goalLabel =
    habit.type === "cantidad" || habit.type === "tiempo" ? `${habit.goal ?? 1} ${habit.unit ?? ""}`.trim() : "1x / día";

  function commitName() {
    setRenaming(false);
    const n = nameDraft.trim();
    if (n && n !== habit.name) updateHabit(habit.id, { name: n });
    else setNameDraft(habit.name);
  }

  function toggleDay(day: number) {
    const next = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    if (next.length === 0) return; // al menos un día
    haptic("light");
    if (next.length === 7) updateHabit(habit.id, { scheduledDays: undefined, frequency: "diario" });
    else updateHabit(habit.id, { scheduledDays: [...next].sort(), frequency: "semanal" });
  }

  function commitGoal() {
    const goal = Math.max(1, Math.floor(Number(goalDraft)) || 1);
    const unit = unitDraft.trim() || "vez";
    const isTime = /^(min|minutos?)$/i.test(unit);
    const type = isTime ? "tiempo" : goal > 1 || !/^vez(es)?$/i.test(unit) ? "cantidad" : "binario";
    setGoalDraft(String(goal));
    setUnitDraft(unit);
    updateHabit(habit.id, { goal: type === "binario" ? undefined : goal, unit: type === "binario" ? undefined : unit, type });
  }

  return (
    <div
      className="fixed inset-0 z-[45] overflow-y-auto text-white bg-black"
      onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 70)}
    >
      <div className="sticky top-0 z-10 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center px-5 bg-gradient-to-b from-black via-black/90 to-transparent">
        <button
          onClick={() => router.push(`/habitos/habito?id=${encodeURIComponent(habit.id)}`)}
          aria-label="Volver al hábito"
          className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <ChevronLeft size={22} strokeWidth={2.6} />
        </button>
        <span
          className="absolute left-1/2 -translate-x-1/2 text-[22px] font-black truncate max-w-[55%] transition-opacity"
          style={{ opacity: scrolled ? 1 : 0 }}
        >
          {habit.name}
        </span>
      </div>

      <div className="px-5 pb-[max(env(safe-area-inset-bottom),40px)] max-w-[520px] mx-auto">
        <div className="flex items-start justify-between gap-3 mt-2">
          <div className="flex items-center gap-2 min-w-0">
            {renaming ? (
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === "Enter" && commitName()}
                maxLength={40}
                aria-label="Nombre del hábito"
                className="bg-transparent text-[34px] font-black leading-tight outline-none border-b border-white/30 w-full min-w-0"
              />
            ) : (
              <>
                <h1 className="text-[34px] font-black leading-tight truncate">{habit.name}</h1>
                <button onClick={() => setRenaming(true)} aria-label="Editar nombre" className="text-white/60 cursor-pointer shrink-0">
                  <Pencil size={20} />
                </button>
              </>
            )}
          </div>
          <span className="text-[34px] font-black leading-tight tabular-nums">{stats.total}</span>
        </div>
        <p className="mt-1 text-[18px] text-white/55 leading-snug">
          Meta diaria: {goalLabel}
          <br />
          {perWeek}x / semana{habit.reminder ? ` a las ${formatTime(habit.reminder)}` : ""}
        </p>

        <div className="mt-5 rounded-3xl p-4" style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}>
          <AreaChart series={series} today={todayDate} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard label="Esta semana" value={stats.thisWeek} delta={stats.thisWeek - stats.prevWeek} sub="sem. ant." />
          <StatCard label="Este mes" value={stats.thisMonth} delta={stats.thisMonth - stats.prevMonth} sub="mes ant." />
          <StatCard label="Este año" value={stats.thisYear} delta={stats.thisYear - stats.prevYear} sub="año ant." />
          <StatCard label="Reps totales" value={stats.total} sub={stats.firstDate ? `Desde ${shortDate(stats.firstDate)}` : "—"} />
          <StatCard label="Racha actual" value={stats.currentStreak} sub={stats.currentStreakSince ? `Desde ${shortDate(stats.currentStreakSince)}` : "—"} />
          <StatCard label="Mejor racha" value={stats.bestStreak} sub={stats.bestStreakEnd ? shortDate(stats.bestStreakEnd) : "—"} />
        </div>

        <SectionTitle>Historial</SectionTitle>
        <div className="rounded-3xl p-4" style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}>
          <HistoryGrid completedDates={habit.completedDates} todayISO={today} editing={editingHistory} onToggle={(iso) => toggleHabitOnDate(habit.id, iso)} />
        </div>
        <div className="mt-3">
          <RowButton onClick={() => setEditingHistory((v) => !v)}>
            <span>{editingHistory ? "Terminar edición" : "Editar historial"}</span>
            <ChevronRight size={22} className={editingHistory ? "rotate-90 transition-transform" : "transition-transform"} />
          </RowButton>
          {editingHistory && <p className="text-[13px] text-white/45 mt-2 px-1">Toca un día para marcarlo o desmarcarlo.</p>}
        </div>

        <SectionTitle>Logros</SectionTitle>
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-5 px-5">
          {achievements.slice(0, 6).map((a) => (
            <AchievementCard key={a.id} a={a} />
          ))}
        </div>
        <div className="mt-3">
          <RowButton onClick={() => setAllAchievements((v) => !v)}>
            <span>Todos los logros</span>
            <ChevronRight size={22} className={allAchievements ? "rotate-90 transition-transform" : "transition-transform"} />
          </RowButton>
          {allAchievements && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              {achievements.map((a) => (
                <AchievementCard key={a.id} a={a} wide />
              ))}
            </div>
          )}
        </div>

        <SectionTitle>Horario</SectionTitle>
        <div className="rounded-3xl p-5 flex flex-col gap-4" style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-[20px]">Días</span>
          <div className="flex justify-between gap-1.5">
            {DAY_CHIPS.map((c) => {
              const on = days.includes(c.day);
              return (
                <button
                  key={c.day}
                  onClick={() => toggleDay(c.day)}
                  aria-pressed={on}
                  className="flex-1 h-11 rounded-full text-[16px] cursor-pointer"
                  style={{ background: on ? "#f5b301" : "#3a3a3a", color: on ? "#000" : "rgba(255,255,255,0.55)" }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <span className="text-[20px]">Veces</span>
          <div className="flex items-center gap-2 flex-wrap">
            {habit.reminder ? (
              <button
                onClick={() => setTimeOpen((v) => !v)}
                className="h-11 px-5 rounded-full text-[17px] cursor-pointer"
                style={{ background: "#f5b301", color: "#000" }}
              >
                {formatTime(habit.reminder)}
              </button>
            ) : (
              <button
                onClick={() => {
                  updateHabit(habit.id, { reminder: "20:00" });
                  setTimeOpen(true);
                }}
                className="h-11 px-5 rounded-full text-[17px] text-white/55 cursor-pointer"
                style={{ background: "#3a3a3a" }}
              >
                + Añadir
              </button>
            )}
            {timeOpen && habit.reminder && (
              <input
                type="time"
                value={habit.reminder}
                onChange={(e) => e.target.value && updateHabit(habit.id, { reminder: e.target.value })}
                aria-label="Hora del recordatorio"
                className="h-11 rounded-xl bg-white/10 px-3 text-[17px] outline-none [color-scheme:dark]"
              />
            )}
          </div>
        </div>

        <div className="mt-3 rounded-3xl px-5 h-16 flex items-center justify-between" style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-[19px]">Enviar recordatorios</span>
          <button
            role="switch"
            aria-checked={!!habit.reminder}
            aria-label="Enviar recordatorios"
            onClick={() => updateHabit(habit.id, { reminder: habit.reminder ? undefined : "20:00" })}
            className="w-14 h-8 rounded-full relative cursor-pointer transition-colors"
            style={{ background: habit.reminder ? "#f5b301" : "#3a3a3a" }}
          >
            <span
              className="absolute top-1 w-6 h-6 rounded-full bg-white transition-all"
              style={{ left: habit.reminder ? "calc(100% - 1.75rem)" : "0.25rem" }}
            />
          </button>
        </div>
        <p className="text-[12px] text-white/40 mt-2 px-1" style={MONO}>
          Se guarda la hora; los avisos en el celular todavía no están activos.
        </p>

        <div className="mt-3 rounded-3xl p-5 flex flex-col gap-3" style={{ background: CARD, border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-[20px]">Meta diaria</span>
          <div className="grid grid-cols-2 gap-3">
            <input
              inputMode="numeric"
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value.replace(/\D/g, "").slice(0, 3))}
              onBlur={commitGoal}
              aria-label="Meta diaria"
              className="h-16 rounded-2xl bg-[#333] text-center text-[20px] font-semibold outline-none"
            />
            <input
              value={unitDraft}
              onChange={(e) => setUnitDraft(e.target.value.slice(0, 14))}
              onBlur={commitGoal}
              aria-label="Unidad"
              className="h-16 rounded-2xl bg-[#333] text-center text-[20px] font-semibold outline-none"
            />
          </div>
        </div>

        <SectionTitle>Misión</SectionTitle>
        <RowButton onClick={() => setMissionOpen((v) => !v)}>
          <span>{habit.mission ? "Editar propósito" : "Escribir propósito"}</span>
          <ChevronRight size={22} className={missionOpen ? "rotate-90 transition-transform" : "transition-transform"} />
        </RowButton>
        {(missionOpen || habit.mission) && (
          <textarea
            value={habit.mission ?? ""}
            onChange={(e) => updateHabit(habit.id, { mission: e.target.value })}
            placeholder="¿Por qué quieres construir este hábito?"
            rows={3}
            maxLength={280}
            className="mt-3 w-full rounded-2xl p-4 text-[16px] outline-none resize-none placeholder:text-white/30"
            style={{ background: CARD }}
          />
        )}

        <div className="mt-10 flex flex-col gap-4">
          <button
            onClick={() => {
              updateHabit(habit.id, { mastered: !habit.mastered });
              if (!habit.mastered) {
                playSound("level-up");
                haptic("milestone");
              }
            }}
            className="h-16 rounded-full text-[19px] font-semibold cursor-pointer"
            style={{ background: habit.mastered ? "#f5b301" : "#2a2a2a", color: habit.mastered ? "#000" : "#fff", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            {habit.mastered ? "Hábito dominado ✓" : "Hábito dominado"}
          </button>
          <button
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 4000);
                return;
              }
              removeHabit(habit.id);
              router.push("/habitos");
            }}
            className="h-16 rounded-full text-[19px] font-semibold cursor-pointer text-white"
            style={{ background: "#c4272d" }}
          >
            {confirmDelete ? "Toca de nuevo para eliminar" : "Eliminar hábito"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const habits = useHabitsStore((s) => s.habits);
  const habit = habits.find((h) => h.id === params.get("id"));

  if (!habit) {
    return (
      <div className="fixed inset-0 z-[45] bg-black text-white flex flex-col items-center justify-center gap-4">
        <p className="text-white/60">No encontramos ese hábito.</p>
        <button onClick={() => router.push("/habitos")} className="px-5 h-11 rounded-full bg-white text-black font-semibold cursor-pointer">
          Volver a Hábitos
        </button>
      </div>
    );
  }
  return <DetailBody key={habit.id} habit={habit} />;
}

export default function HabitDetailPage() {
  return (
    <Suspense fallback={null}>
      <DetailScreen />
    </Suspense>
  );
}
