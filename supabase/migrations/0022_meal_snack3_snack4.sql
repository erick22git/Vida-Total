-- Snack 3 y Snack 4: la app ahora permite hasta 4 snacks al día (antes solo snack1 y snack2).
-- Sin esto, registrar un alimento en snack3/snack4 falla al sincronizar con Supabase (check de la columna meal).
alter table public.logged_foods drop constraint if exists logged_foods_meal_check;
alter table public.logged_foods
  add constraint logged_foods_meal_check
  check (meal in ('desayuno','almuerzo','cena','snack1','snack2','snack3','snack4'));

alter table public.meal_templates drop constraint if exists meal_templates_meal_check;
alter table public.meal_templates
  add constraint meal_templates_meal_check
  check (meal in ('desayuno','almuerzo','cena','snack1','snack2','snack3','snack4'));
