"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { firstFreeStart, useAgendaStore } from "@/lib/agenda/store";
import { toISODate } from "@/lib/agenda/time";
import type { AgendaTask } from "@/lib/agenda/types";
import { haptic } from "@/lib/haptics/haptic";
import { ActionButton, Chip } from "./agenda-sheets";
import { DatePickerSheet } from "./pickers";
import { Sheet } from "./sheet";
import { TimeAndDuration } from "./time-duration";

/** Asigna día y hora a una tarea de la Bandeja: al confirmar pasa a la línea de tiempo (solo entonces cambia algo). */
export function ScheduleSheet({ open, onClose, task }: { open: boolean; onClose: () => void; task: AgendaTask | null }) {
  const tasks = useAgendaStore((s) => s.tasks);
  const step = useAgendaStore((s) => s.timeStep);
  const presets = useAgendaStore((s) => s.durationPresets);
  const updateTask = useAgendaStore((s) => s.updateTask);
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [start, setStart] = useState<number | null>(null);
  const [dur, setDur] = useState<number>(task?.durationMin ?? 30);
  const [picking, setPicking] = useState(false);
  const startAt = start ?? firstFreeStart(tasks, date, step, dur);
  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));
  const other = date !== today && date !== tomorrow;
  return (
    <Sheet open={open && !!task} onClose={onClose} title="Programar" maxHeight="90%">
      {task && (
        <>
          <p className="text-[19px] font-extrabold mb-3 px-1 truncate">{task.title}</p>
          <div className="flex flex-wrap gap-2 mb-2" role="radiogroup" aria-label="Día">
            <Chip selected={date === today} onClick={() => { setDate(today); setStart(null); }}>Hoy</Chip>
            <Chip selected={date === tomorrow} onClick={() => { setDate(tomorrow); setStart(null); }}>Mañana</Chip>
            <Chip selected={other} onClick={() => setPicking(true)}>{other ? format(new Date(`${date}T12:00:00`), "EEE d MMM", { locale: es }).replace(/\./g, "") : "Elegir día"}</Chip>
          </div>
          <TimeAndDuration startMin={startAt} durationMin={dur} step={step} presets={presets} onStart={setStart} onDuration={setDur} />
          <div className="mt-5">
            <ActionButton
              onClick={() => {
                updateTask(task.id, { date, startMin: startAt, durationMin: dur, allDay: false });
                haptic("success");
                onClose();
              }}
            >
              Añadir a la línea de tiempo
            </ActionButton>
          </div>
          <DatePickerSheet open={picking} onClose={() => setPicking(false)} value={date} onPick={(d) => { if (d) { setDate(d); setStart(null); } }} />
        </>
      )}
    </Sheet>
  );
}
