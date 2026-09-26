import { createRoot } from "react-dom/client";
import HabitPage from "C:/Erick/app movil/vida-total-web/src/app/(dashboard)/habitos/habito/page";
import { HabitSourceBridge } from "C:/Erick/app movil/vida-total-web/src/components/habitos/habit-source-bridge";
import { useHabitsStore } from "C:/Erick/app movil/vida-total-web/src/lib/store/habitsStore";
import { useHabitPromptStore } from "C:/Erick/app movil/vida-total-web/src/lib/habits/habit-prompts";
import { emitProgressEvent } from "C:/Erick/app movil/vida-total-web/src/lib/progress/event-bus";
(window as any).store = useHabitsStore;
(window as any).prompts = useHabitPromptStore;
(window as any).emitProgressEvent = emitProgressEvent;
// El bridge (en la app real vive en el layout del dashboard) + la pantalla real del hábito.
createRoot(document.getElementById("root")!).render(
  <>
    <HabitSourceBridge />
    <HabitPage />
  </>,
);
