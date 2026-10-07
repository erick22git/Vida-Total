-- 0008 — Recetas: campo `verificado` (igual que en alimentos).
--
-- NO aplicada todavía: ejecutarla a mano en el SQL Editor de Supabase cuando se decida.
-- Hasta entonces la app funciona igual: `verificado` va en su propia escritura (syncRecipeVerified en
-- src/lib/sync/gym-sync.ts) que falla sola si la columna no existe, sin afectar el resto de la receta.
--
-- Importante: `verificado = true` solo debe salir de la acción manual "Verificar" de la app (nunca de un script
-- ni de una migración), por eso el default es false y esta migración no marca ninguna fila.
-- TODO: restringir esa acción al rol admin cuando exista el sistema de roles.

alter table public.recipes
  add column if not exists verificado boolean not null default false;
