-- 0013 — Tareas: hora de recordatorio opcional.
--
-- NO aplicada todavía: ejecutarla a mano en el SQL Editor de Supabase cuando se decida.
-- SOLO ADITIVA e idempotente. La app solo envía `reminder` cuando una tarea tiene recordatorio, así que hasta aplicarla
-- todo lo demás de las tareas sigue sincronizando igual. (Los recordatorios de SUBTAREAS viajan dentro del jsonb `subtasks`.)
alter table public.tasks
  add column if not exists reminder text check (reminder is null or reminder ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
