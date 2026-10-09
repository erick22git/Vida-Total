"use client";

/**
 * Isla dinámica — un solo componente para notificaciones (useNotify) Y la entrada/salida de la
 * mascota (Adenda del prompt). Montar UNA vez (layout del dashboard). Estados: oculta → compacta
 * (píldora) → expandida (card negra) → colapsa y se esconde. Ver docs/diseno.md, sección
 * "Notificaciones e isla" (tabla de equivalencias con expo-dynamic-notifications, MIT, y los valores
 * exactos usados acá).
 */
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, MessageSquare, ShieldQuestion, Trophy, X } from "lucide-react";
import { useNotifyStore, type NotifyItem, type NotifyType } from "@/lib/store/notifyStore";
import { playEvent } from "@/lib/sound/sound-manager";
import { haptic } from "@/lib/haptics/haptic";
import { useEffectiveReduceMotion } from "@/lib/store/preferencesStore";
import { useMascotUi } from "@/lib/store/mascotUiStore";
import { useMascotMood } from "@/components/agente/mascot-dock";
import { Mascot } from "@/components/agente/mascot";

// Tamaños de la píldora/card: puertos de expo-dynamic-notifications (MIT, 650 Industries/Expo) — ver
// docs/diseno.md para la tabla completa de equivalencias Reanimated -> web.
const ISLAND_W = 126;
const ISLAND_H = 37.33;
const DEFAULT_LOW_DURATION_MS = 3600; // igual que la referencia (root `duration` por defecto)
const SWIPE_UP_OFFSET = 50;
const SWIPE_UP_VELOCITY = 500;

const ICONS: Record<NotifyType, typeof Bell> = {
  reminder: Bell,
  goal: Trophy,
  error: AlertTriangle,
  "agent-result": CheckCircle2,
  "agent-message": MessageSquare,
  permission: ShieldQuestion,
};

function soundForShow(item: NotifyItem): Parameters<typeof playEvent>[0] {
  if (item.type === "error") return "error";
  if (item.type === "permission") return "permission-prompt";
  if (item.type === "goal") return "goal-reached";
  return "notification-appear";
}

function TypeIcon({ type }: { type: NotifyType }) {
  const Icon = ICONS[type];
  return <Icon size={16} className="text-white/80 shrink-0" />;
}

export function DynamicIsland() {
  const current = useNotifyStore((s) => s.current);
  const queueLength = useNotifyStore((s) => s.queue.length);
  const expanded = useNotifyStore((s) => s.expanded);
  const setExpanded = useNotifyStore((s) => s.setExpanded);
  const dismissCurrent = useNotifyStore((s) => s.dismissCurrent);
  const reduceMotion = useEffectiveReduceMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  const mascotOpen = useMascotUi((s) => s.open);
  const { mood } = useMascotMood();
  const [mascotPill, setMascotPill] = useState(false);
  const prevMascotOpen = useRef(false);

  // Mascota: al abrirse pasa un instante por la píldora (mini-avatar + su estado) antes de que el
  // panel de chat YA EXISTENTE (MascotDock, sin tocar) termine de entrar — Adenda punto 3.
  useEffect(() => {
    if (mascotOpen && !prevMascotOpen.current) {
      setMascotPill(true);
      const t = setTimeout(() => setMascotPill(false), reduceMotion ? 1 : 420);
      prevMascotOpen.current = mascotOpen;
      return () => clearTimeout(t);
    }
    prevMascotOpen.current = mascotOpen;
  }, [mascotOpen, reduceMotion]);

  // Sonido + háptica al aparecer una notificación nueva (una vez por id).
  const lastSoundedId = useRef<string | null>(null);
  useEffect(() => {
    if (!current || lastSoundedId.current === current.id) return;
    lastSoundedId.current = current.id;
    void playEvent(soundForShow(current));
    haptic(current.priority === "high" ? "milestone" : current.priority === "medium" ? "medium" : "light");
  }, [current]);

  // Solo "low" se oculta sola.
  useEffect(() => {
    if (!current || current.priority !== "low") return;
    const ms = current.durationMs ?? DEFAULT_LOW_DURATION_MS;
    const t = setTimeout(() => dismissCurrent(), ms);
    return () => clearTimeout(t);
  }, [current, dismissCurrent]);

  // Foco al expandir (no es modal: no atrapa Tab, pero anuncia y deja Tab natural hacia las acciones) + Escape para colapsar.
  useEffect(() => {
    if (!expanded || !current) return;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        void playEvent("notification-collapse");
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, current, setExpanded]);

  function handleExpandToggle() {
    const next = !expanded;
    setExpanded(next);
    void playEvent(next ? "notification-expand" : "notification-collapse");
    haptic("light");
  }

  function handleDragEnd(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (current?.priority === "high") return; // permiso del agente: no se descarta con swipe
    if (-info.offset.y > SWIPE_UP_OFFSET || -info.velocity.y > SWIPE_UP_VELOCITY) {
      void playEvent("notification-dismiss");
      haptic("light");
      dismissCurrent();
    }
  }

  const showMascotPill = mascotPill && !current;
  const visible = !!current || showMascotPill;
  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-[max(env(safe-area-inset-top),10px)] z-[70] flex justify-center px-4 pointer-events-none">
      <AnimatePresence>
        <motion.div
          key={current?.id ?? "mascot-pill"}
          drag={!reduceMotion && current && !expanded ? "y" : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.35, bottom: 0 }}
          onDragEnd={handleDragEnd}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.85 }}
          transition={reduceMotion ? { duration: 0.15 } : { type: "spring", damping: 30, stiffness: 360, mass: 0.9 }}
          className="pointer-events-auto overflow-hidden outline-none"
          ref={panelRef}
          tabIndex={-1}
          style={{
            background: "#0b0b0c",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.75)",
            borderRadius: expanded ? 32 : ISLAND_H / 2,
            width: expanded ? "min(calc(100vw - 32px), 396px)" : ISLAND_W,
            minHeight: expanded ? 74 : ISLAND_H,
          }}
          role={current ? "status" : undefined}
          aria-live={current ? (current.priority === "high" ? "assertive" : "polite") : undefined}
        >
          {showMascotPill ? (
            <div className="w-full h-full flex items-center gap-2 px-2.5" aria-label="Vida Total">
              <Mascot mood={mood} size={26} still />
              <span className="text-xs text-white/80 truncate">Vida Total</span>
            </div>
          ) : current && !expanded ? (
            <button
              className="w-full h-full flex items-center gap-2 px-2.5 cursor-pointer"
              onClick={handleExpandToggle}
              aria-label={`Ver notificación: ${current.title}`}
            >
              <TypeIcon type={current.type} />
              <span className="text-xs font-medium text-white truncate flex-1 text-left">{current.title}</span>
              {queueLength > 0 && <span className="text-[10px] text-white/50 shrink-0">+{queueLength}</span>}
            </button>
          ) : current && expanded ? (
            <div className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <TypeIcon type={current.type} />
                  <h3 className="text-sm font-semibold text-white truncate">{current.title}</h3>
                </div>
                {current.priority !== "high" && (
                  <button
                    onClick={() => {
                      void playEvent("notification-collapse");
                      setExpanded(false);
                    }}
                    aria-label="Minimizar"
                    className="text-white/50 hover:text-white cursor-pointer shrink-0"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              {current.message && <p className="text-xs text-white/60">{current.message}</p>}
              {current.actions && current.actions.length > 0 && (
                <div className="flex gap-2 pt-1">
                  {current.actions.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        a.onClick();
                        void playEvent("notification-dismiss");
                        dismissCurrent();
                      }}
                      className="flex-1 rounded-full py-2 text-xs font-semibold cursor-pointer"
                      style={{ background: a.variant === "danger" ? "rgba(239,68,68,0.18)" : "#fff", color: a.variant === "danger" ? "#f87171" : "#000" }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
              {queueLength > 0 && <p className="text-[10px] text-white/35">+{queueLength} más en espera</p>}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
