"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Rows3 } from "lucide-react";
import { useHabitsStore } from "@/lib/store/habitsStore";
import {
  HABIT_ICON_MAP,
  formatHour,
  timelineHours,
} from "@/lib/habits-utils";
import { TimeBlockModal } from "@/components/habitos/time-block-modal";

const ROW_HEIGHT = 72;

export default function TimelinePage() {
  const timeBlocks = useHabitsStore((s) => s.timeBlocks);
  const updateTimeBlock = useHabitsStore((s) => s.updateTimeBlock);
  const hours = timelineHours();
  const startHour = hours[0];
  const containerRef = useRef<HTMLDivElement>(null);
  const currentHourRef = useRef<HTMLDivElement>(null);
  const [modalHour, setModalHour] = useState<number | null>(null);
  const now = new Date();
  const currentHour = now.getHours();

  useEffect(() => {
    currentHourRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  function handleDragEnd(id: string, block: { startHour: number; endHour: number }, offsetY: number) {
    const deltaHours = Math.round(offsetY / ROW_HEIGHT);
    if (deltaHours === 0) return;
    const duration = block.endHour - block.startHour;
    let newStart = block.startHour + deltaHours;
    newStart = Math.max(startHour, Math.min(hours[hours.length - 1] + 1 - duration, newStart));
    updateTimeBlock(id, { startHour: newStart, endHour: newStart + duration });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/habitos" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Rows3 size={20} style={{ color: "var(--habitos)" }} /> Timeline
        </h1>
      </header>

      <p className="text-sm text-white/45">
        Toca una hora vacía para crear un bloque. Arrastra un bloque para reubicarlo.
      </p>

      <div
        ref={containerRef}
        className="relative w-full md:max-w-2xl"
        style={{ height: hours.length * ROW_HEIGHT }}
      >
        {hours.map((h) => {
          const isPast = h < currentHour;
          const isNow = h === currentHour;
          return (
            <div
              key={h}
              ref={isNow ? currentHourRef : undefined}
              onClick={() => setModalHour(h)}
              className="absolute left-0 right-0 flex items-start gap-3 border-t border-white/[0.08] cursor-pointer hover:bg-white/[0.02] transition-colors"
              style={{
                top: (h - startHour) * ROW_HEIGHT,
                height: ROW_HEIGHT,
                opacity: isPast ? 0.4 : 1,
              }}
            >
              <span
                className="w-16 shrink-0 text-xs pt-1.5 pl-1"
                style={{ color: isNow ? "var(--habitos)" : "rgba(255,255,255,0.35)" }}
              >
                {formatHour(h)}
              </span>
              {isNow && (
                <div
                  className="absolute left-16 right-0 top-0 h-[2px]"
                  style={{ background: "var(--habitos)", boxShadow: "0 0 8px var(--habitos)" }}
                />
              )}
            </div>
          );
        })}

        <div className="absolute left-16 right-0 top-0 bottom-0 pointer-events-none">
          {timeBlocks
            .filter((b) => b.startHour >= startHour)
            .map((b) => {
              const Icon = HABIT_ICON_MAP[b.icon] ?? Rows3;
              const top = (b.startHour - startHour) * ROW_HEIGHT;
              const height = Math.max(40, (b.endHour - b.startHour) * ROW_HEIGHT - 6);
              return (
                <motion.div
                  key={b.id}
                  drag="y"
                  dragMomentum={false}
                  dragElastic={0.15}
                  onDragEnd={(_, info) => handleDragEnd(b.id, b, info.offset.y)}
                  className="glass-surface absolute left-0 right-2 rounded-2xl px-3 py-2 flex items-center gap-2 pointer-events-auto cursor-grab active:cursor-grabbing"
                  style={{
                    top,
                    height,
                    borderColor: `${b.color}55`,
                    boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 24px ${b.color}33`,
                  }}
                  whileDrag={{ scale: 1.03, zIndex: 20 }}
                >
                  <div
                    className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                    style={{ background: `${b.color}33` }}
                  >
                    <Icon size={14} style={{ color: b.color }} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-white truncate">{b.title}</span>
                    <span className="text-[11px] text-white/45">
                      {formatHour(b.startHour)} - {formatHour(b.endHour)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
        </div>
      </div>

      {modalHour !== null && (
        <TimeBlockModal
          open={modalHour !== null}
          onClose={() => setModalHour(null)}
          startHour={modalHour}
        />
      )}

      <button
        onClick={() => setModalHour(currentHour)}
        className="fixed bottom-24 md:bottom-8 right-6 flex items-center justify-center w-14 h-14 rounded-full cursor-pointer z-30"
        style={{
          background: "var(--habitos)",
          boxShadow: "0 4px 24px var(--habitos)77",
        }}
      >
        <Plus size={24} className="text-white" />
      </button>
    </div>
  );
}
