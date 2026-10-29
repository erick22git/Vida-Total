"use client";

/**
 * Perfil estilo Instagram (mismas posiciones y espacios, con el fondo/colores de la app):
 *  - Arriba: avatar con aro + 3 cifras (Entrenos · Racha · Récords).
 *  - Descripción: nombre, objetivo y líneas con tu peso, meta, altura e IMC.
 *  - Botones: Peso · Escaneo · Fotos · ⌄ (Editar perfil, Rangos, Récords).
 *  - "Historias": tu progreso con fotos por fecha (un círculo por mes) y, debajo, tus fotos destacadas.
 *  - Pestañas (como Publicaciones/Reels/Etiquetas): Entrenamientos · Gráficas · Récords · Fotos.
 * Todo con acentos en blanco.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Image as ImageIcon,
  LineChart as LineChartIcon,
  Plus,
  Scale,
  Scan,
  Search,
  Star,
  Trophy,
} from "lucide-react";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useGymStore } from "@/lib/store/gymStore";
import { useAllExercises } from "@/components/gym/exercise-picker";
import { getAllPersonalRecords } from "@/lib/gym-utils";
import { RankIcon } from "@/components/gym/rank-icon";
import { useRankProfile } from "@/lib/gym/use-rank";
import { MONO_FONT } from "@/lib/ui/mono-font";
import { cn } from "@/lib/utils";
import type { WorkoutSession } from "@/lib/types";

type Tab = "entrenos" | "graficas" | "records" | "fotos";
type Range = "7" | "30" | "90" | "todo" | "custom";

const RANGES: { key: Range; label: string }[] = [
  { key: "7", label: "7 días" },
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
  { key: "todo", label: "Todo" },
  { key: "custom", label: "Fechas" },
];

const CARD = "rounded-2xl bg-white/[0.05]";

export default function ProfilePage() {
  const sessions = useGymStore((s) => s.sessions);
  const streak = useGymStore((s) => s.streak);
  const gymProfile = useGymStore((s) => s.gymProfile);
  const weightEntries = useGymStore((s) => s.weightEntries);
  const photos = useGymStore((s) => s.progressPhotos);
  const featured = useGymStore((s) => s.featuredPhotoMonths);
  const allExercises = useAllExercises();
  const { profile: rankProfile } = useRankProfile();
  const [tab, setTab] = useState<Tab>("entrenos");
  const [moreOpen, setMoreOpen] = useState(false);

  const records = useMemo(() => getAllPersonalRecords(sessions), [sessions]);
  const peso = weightEntries[0]?.kg ?? gymProfile?.pesoKg;
  const meta = gymProfile?.pesoObjetivoKg;
  const altura = gymProfile?.alturaCm;
  const imc = peso && altura ? Math.round((peso / (altura / 100) ** 2) * 10) / 10 : null;
  const sortedPhotos = useMemo(() => [...photos].sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1)), [photos]);
  const featuredPhotos = sortedPhotos.filter((p) => featured.includes(p.monthKey));
  const avatar = sortedPhotos[0]?.photoUrl;
  const general = rankProfile?.general.rank;

  return (
    <div className="flex flex-col gap-4 pb-10">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento" aria-label="Volver" className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={22} />
        </Link>
        <h1 className="flex-1 text-[15px] uppercase tracking-[0.14em]" style={MONO_FONT}>
          Mi perfil
        </h1>
        <Link href="/gym/entrenamiento/configurar-perfil?volver=/gym/entrenamiento/perfil" className="text-xs font-semibold text-white/70">
          Editar
        </Link>
      </header>

      {/* Avatar + cifras */}
      <div className="flex items-center gap-5">
        <div className="shrink-0 rounded-full p-[3px]" style={{ background: "conic-gradient(from 200deg, #ffffff, #8a8a95, #ffffff)" }}>
          <div className="w-[84px] h-[84px] rounded-full overflow-hidden border-[3px] border-black bg-white/10 flex items-center justify-center">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="Tu foto de progreso más reciente" className="w-full h-full object-cover" />
            ) : (
              <Dumbbell size={30} className="text-white/60" />
            )}
          </div>
        </div>
        <div className="flex-1 grid grid-cols-3 text-center">
          <StatCol value={sessions.length} label="Entrenos" />
          <StatCol value={streak} label="Racha" />
          <StatCol value={records.length} label="Récords" />
        </div>
      </div>

      {/* Descripción */}
      <div className="flex flex-col gap-0.5 text-[13px] leading-snug">
        <p className="font-semibold text-white flex items-center gap-1.5">
          Atleta
          {general && <RankIcon tierKey={general.tier.key} level={general.level} size={18} />}
        </p>
        <p className="text-white/45">
          {general ? `Rango ${general.label}` : "Sin rango todavía"}
          {gymProfile?.experiencia ? ` · ${EXPERIENCIA[gymProfile.experiencia]}` : ""}
        </p>
        {peso && (
          <p className="text-white/85">
            ⚖️ {peso} kg{meta ? ` → meta ${meta} kg` : ""}
            {altura ? ` · 📏 ${(altura / 100).toFixed(2)} m` : ""}
            {imc ? ` · IMC ${imc}` : ""}
          </p>
        )}
        {gymProfile?.objetivo && <p className="text-white/85">🎯 {gymProfile.objetivo}</p>}
        {!peso && <p className="text-white/45">Agrega tu peso para completar tu descripción.</p>}
        {sessions[0] && <p className="text-white/45">Último entreno: {format(new Date(sessions[0].date), "d MMM", { locale: es })}</p>}
      </div>

      {/* Botones */}
      <div className="flex gap-1.5">
        <ProfileButton href="/gym/entrenamiento/perfil/peso" icon={Scale} label="Peso" />
        <ProfileButton href="/gym/entrenamiento/escaneo" icon={Scan} label="Escaneo" />
        <ProfileButton href="/gym/entrenamiento/perfil/fotos" icon={Camera} label="Fotos" />
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="Más opciones"
          aria-expanded={moreOpen}
          className="w-11 shrink-0 rounded-lg bg-white/[0.08] flex items-center justify-center cursor-pointer"
        >
          <ChevronDown size={16} className={cn("transition-transform", moreOpen && "rotate-180")} />
        </button>
      </div>
      {moreOpen && (
        <div className="flex gap-1.5">
          <ProfileButton href="/gym/entrenamiento/configurar-perfil?volver=/gym/entrenamiento/perfil" icon={Dumbbell} label="Editar perfil" />
          <ProfileButton href="/gym/entrenamiento/rango" icon={Star} label="Rangos" />
          <ProfileButton href="/gym/entrenamiento/perfil/records" icon={Trophy} label="Récords" />
        </div>
      )}

      {/* "Historias": progreso por fechas y destacadas */}
      <Stories title="Mi progreso" items={sortedPhotos.map((p) => ({ id: p.id, url: p.photoUrl, label: format(new Date(`${p.monthKey}-01`), "MMM yy", { locale: es }) }))} addHref="/gym/entrenamiento/perfil/fotos" />
      {featuredPhotos.length > 0 && (
        <Stories title="Destacadas" items={featuredPhotos.map((p) => ({ id: p.id, url: p.photoUrl, label: format(new Date(`${p.monthKey}-01`), "MMM yy", { locale: es }) }))} />
      )}

      {/* Pestañas */}
      <div className="grid grid-cols-4 border-b border-white/10 -mx-4">
        <TabIcon active={tab === "entrenos"} onClick={() => setTab("entrenos")} icon={Dumbbell} label="Entrenamientos" />
        <TabIcon active={tab === "graficas"} onClick={() => setTab("graficas")} icon={LineChartIcon} label="Gráficas" />
        <TabIcon active={tab === "records"} onClick={() => setTab("records")} icon={Trophy} label="Récords" />
        <TabIcon active={tab === "fotos"} onClick={() => setTab("fotos")} icon={ImageIcon} label="Fotos" />
      </div>

      {tab === "entrenos" && <WorkoutsTab sessions={sessions} />}
      {tab === "graficas" && <ChartsTab sessions={sessions} />}
      {tab === "records" && (
        <div className="flex flex-col gap-2">
          {records.length === 0 && <p className="text-sm text-white/40 text-center py-8">Aún no hay récords personales.</p>}
          {records.slice(0, 20).map((pr) => {
            const ex = allExercises.find((e) => e.id === pr.exerciseId);
            return (
              <div key={pr.sessionId + pr.exerciseId} className={cn(CARD, "flex items-center gap-3 px-4 py-3")}>
                <Trophy size={16} className="text-white/70 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{ex?.nombre ?? pr.exerciseId}</p>
                  <p className="text-xs text-white/45">
                    {pr.peso} kg × {pr.reps} · {format(new Date(pr.date), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === "fotos" && (
        <div className="grid grid-cols-3 gap-0.5 -mx-4">
          {sortedPhotos.map((p) => (
            <Link key={p.id} href="/gym/entrenamiento/perfil/fotos" className="relative aspect-square bg-white/[0.06] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photoUrl} alt="" className="w-full h-full object-cover" />
              <span className="absolute bottom-1 left-1 text-[10px] font-semibold text-white bg-black/55 rounded px-1">
                {format(new Date(`${p.monthKey}-01`), "MMM yy", { locale: es })}
              </span>
            </Link>
          ))}
          <Link href="/gym/entrenamiento/perfil/fotos" className="aspect-square bg-white/[0.04] flex flex-col items-center justify-center gap-1 text-white/50 text-xs">
            <Plus size={20} /> Subir foto
          </Link>
        </div>
      )}
    </div>
  );
}

const EXPERIENCIA: Record<string, string> = {
  menos_6m: "Menos de 6 meses",
  "6m_2a": "6 meses a 2 años",
  "2_5a": "2 a 5 años",
  mas_5a: "Más de 5 años",
};

function StatCol({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-[17px] font-bold text-white tabular-nums">{value}</p>
      <p className="text-[12px] text-white/55">{label}</p>
    </div>
  );
}

function ProfileButton({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link href={href} className="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.08] py-2 text-[13px] font-semibold text-white active:scale-[0.97] transition-transform">
      <Icon size={14} /> <span className="truncate">{label}</span>
    </Link>
  );
}

function Stories({ title, items, addHref }: { title: string; items: { id: string; url: string; label: string }[]; addHref?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/40" style={MONO_FONT}>
        {title}
      </p>
      <div className="flex gap-3.5 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        {addHref && (
          <Link href={addHref} className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]">
            <span className="w-[62px] h-[62px] rounded-full border border-dashed border-white/35 flex items-center justify-center text-white/70">
              <Plus size={22} />
            </span>
            <span className="text-[11px] text-white/70">Nueva</span>
          </Link>
        )}
        {items.map((it) => (
          <Link key={it.id} href="/gym/entrenamiento/perfil/fotos" className="flex flex-col items-center gap-1.5 shrink-0 w-[68px]">
            <span className="w-[66px] h-[66px] rounded-full p-[2px] bg-gradient-to-br from-white to-white/30">
              <span className="block w-full h-full rounded-full overflow-hidden border-2 border-black bg-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt="" className="w-full h-full object-cover" />
              </span>
            </span>
            <span className="text-[11px] text-white/80 capitalize truncate max-w-full">{it.label}</span>
          </Link>
        ))}
        {items.length === 0 && !addHref && <p className="text-xs text-white/40">Aún no hay destacadas.</p>}
      </div>
    </div>
  );
}

function TabIcon({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} aria-pressed={active} className={cn("flex justify-center py-3 border-b-2 cursor-pointer transition-colors", active ? "border-white text-white" : "border-transparent text-white/40")}>
      <Icon size={22} />
    </button>
  );
}

/** Entrenamientos: filtros por fecha y búsqueda, agrupados por mes en secciones desplegables. */
function WorkoutsTab({ sessions }: { sessions: WorkoutSession[] }) {
  const [range, setRange] = useState<Range>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const now = new Date();
    let lo: Date | null = null;
    let hi: Date | null = null;
    if (range === "7" || range === "30" || range === "90") lo = startOfDay(subDays(now, Number(range) - 1));
    if (range === "custom") {
      if (from) lo = startOfDay(new Date(`${from}T00:00:00`));
      if (to) hi = endOfDay(new Date(`${to}T00:00:00`));
    }
    const text = q.trim().toLowerCase();
    return [...sessions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((s) => {
        const d = new Date(s.date);
        if (lo && d < lo) return false;
        if (hi && d > hi) return false;
        if (text && !(s.nombre ?? s.grupoMuscular).toLowerCase().includes(text)) return false;
        return true;
      });
  }, [sessions, range, from, to, q]);

  const byMonth = useMemo(() => {
    const m = new Map<string, WorkoutSession[]>();
    for (const s of filtered) {
      const k = format(new Date(s.date), "yyyy-MM");
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [filtered]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer border", range === r.key ? "bg-white text-black border-white" : "border-white/15 text-white/65")}
          >
            {r.label}
          </button>
        ))}
      </div>
      {range === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className={cn(CARD, "flex flex-col gap-0.5 px-3 py-2 text-[11px] text-white/45")}>
            Desde
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-base text-white outline-none [color-scheme:dark]" />
          </label>
          <label className={cn(CARD, "flex flex-col gap-0.5 px-3 py-2 text-[11px] text-white/45")}>
            Hasta
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-base text-white outline-none [color-scheme:dark]" />
          </label>
        </div>
      )}
      <label className={cn(CARD, "flex items-center gap-2 px-3 py-2")}>
        <Search size={15} className="text-white/40" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre" className="flex-1 bg-transparent text-base text-white outline-none placeholder:text-white/30" />
      </label>

      <p className="text-xs text-white/40">
        {filtered.length} {filtered.length === 1 ? "entrenamiento" : "entrenamientos"}
      </p>

      {byMonth.length === 0 && <p className="text-sm text-white/40 text-center py-8">No hay entrenamientos en este filtro.</p>}
      {byMonth.map(([month, list]) => {
        const isClosed = closed.has(month);
        return (
          <div key={month} className="flex flex-col gap-2">
            <button
              onClick={() =>
                setClosed((prev) => {
                  const n = new Set(prev);
                  if (n.has(month)) n.delete(month);
                  else n.add(month);
                  return n;
                })
              }
              aria-expanded={!isClosed}
              className="flex items-center justify-between py-1 cursor-pointer"
            >
              <span className="text-sm font-semibold capitalize text-white/85">{format(new Date(`${month}-01`), "MMMM yyyy", { locale: es })}</span>
              <span className="flex items-center gap-2 text-xs text-white/45">
                {list.length}
                <ChevronDown size={16} className={cn("transition-transform", !isClosed && "rotate-180")} />
              </span>
            </button>
            {!isClosed &&
              list.map((s) => (
                <Link key={s.id} href={`/gym/entrenamiento/perfil/entrenamiento/${s.id}`} className={cn(CARD, "flex items-center gap-3 px-4 py-3")}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.nombre ?? s.grupoMuscular}</p>
                    <p className="text-xs text-white/45">
                      {format(new Date(s.date), "EEE d MMM, HH:mm", { locale: es })} · {s.durationSeconds ? `${Math.round(s.durationSeconds / 60)} min` : "—"}
                      {s.incompleteSets ? ` · ${s.incompleteSets} sin hacer` : ""}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-white/30" />
                </Link>
              ))}
          </div>
        );
      })}
    </div>
  );
}

/** Gráficas: volumen por día (semana / mes) comparado con el período anterior de verdad. */
function ChartsTab({ sessions }: { sessions: WorkoutSession[] }) {
  const [days, setDays] = useState<7 | 30>(7);

  const { data, total, changePct } = useMemo(() => {
    const volOf = (day: Date) =>
      sessions
        .filter((s) => format(new Date(s.date), "yyyy-MM-dd") === format(day, "yyyy-MM-dd"))
        .reduce((sum, s) => sum + s.ejercicios.reduce((a, e) => a + e.sets.filter((x) => x.completado).reduce((b, x) => b + x.peso * x.reps, 0), 0), 0);
    const now = new Date();
    const cur = Array.from({ length: days }, (_, i) => subDays(now, days - 1 - i));
    const prev = Array.from({ length: days }, (_, i) => subDays(now, 2 * days - 1 - i));
    const data = cur.map((d) => ({ date: format(d, days === 7 ? "EEEEEE" : "d", { locale: es }), volumen: Math.round(volOf(d)) }));
    const total = data.reduce((a, d) => a + d.volumen, 0);
    const prevTotal = prev.reduce((a, d) => a + volOf(d), 0);
    return { data, total, changePct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null };
  }, [sessions, days]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {([7, 30] as const).map((d) => (
          <button key={d} onClick={() => setDays(d)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-semibold cursor-pointer border", days === d ? "bg-white text-black border-white" : "border-white/15 text-white/65")}>
            {d === 7 ? "Semana" : "Mes"}
          </button>
        ))}
        <span className="ml-auto text-xs text-white/55">
          {total.toLocaleString()} kg{changePct !== null ? ` · ${changePct >= 0 ? "+" : ""}${changePct} % vs. anterior` : ""}
        </span>
      </div>
      <div className="h-44 rounded-2xl bg-white/[0.04] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 12, fontSize: 12, color: "#fff" }} formatter={(v) => [`${v} kg`, "Volumen"]} />
            <Area type="monotone" dataKey="volumen" stroke="#ffffff" fill="url(#volFill)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <Link href="/gym/entrenamiento/perfil/peso" className={cn(CARD, "flex items-center justify-between px-4 py-3 text-sm text-white")}>
        <span className="flex items-center gap-2">
          <Scale size={16} /> Ver gráfica de peso
        </span>
        <ChevronRight size={15} className="text-white/35" />
      </Link>
    </div>
  );
}
