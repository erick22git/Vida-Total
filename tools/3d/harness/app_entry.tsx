import { createRoot } from "react-dom/client";
import HabitPage from "C:/Erick/app movil/vida-total-web/src/app/(dashboard)/habitos/habito/page";
import { useHabitsStore } from "C:/Erick/app movil/vida-total-web/src/lib/store/habitsStore";
(window as any).store = useHabitsStore;
createRoot(document.getElementById("root")!).render(<HabitPage />);
