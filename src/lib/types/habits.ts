export type TaskPriority = "alta" | "media" | "baja";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string; // ISO date string (yyyy-MM-dd)
  timeSlot?: number; // hour of day 0-23, used by the timeline view
  isCompleted: boolean;
  subtasks: Subtask[];
  tags: string[];
  color: string;
  icon: string; // lucide icon name, resolved via HABIT_ICON_MAP
}

export type HabitFrequency = "diario" | "semanal";

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  streak: number;
  completedDates: string[]; // ISO date strings (yyyy-MM-dd)
}

export interface TimeBlock {
  id: string;
  taskId?: string;
  startHour: number;
  endHour: number;
  color: string;
  icon: string;
  title: string;
}

export type NotionBlockType = "text" | "checklist" | "heading";

export interface NotionChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface NotionBlock {
  id: string;
  type: NotionBlockType;
  content: string; // for text/heading; unused (kept "") for checklist
  items?: NotionChecklistItem[]; // used when type === "checklist"
}

export interface NotionPage {
  id: string;
  title: string;
  icon: string;
  blocks: NotionBlock[];
}

export type KanbanColumnId = "por-hacer" | "en-progreso" | "hecho";

export interface KanbanColumn {
  id: KanbanColumnId;
  title: string;
  taskIds: string[];
}
