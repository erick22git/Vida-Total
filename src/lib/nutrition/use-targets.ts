"use client";

import { useMemo } from "react";
import { useGymStore } from "@/lib/store/gymStore";
import { getNutrientTargets, type TargetProfile, type TargetsResult } from "./nutrient-targets";

/** Perfil para las metas: sexo, edad y peso del perfil de entrenamiento y la meta calórica guardada. */
export function useTargetProfile(): TargetProfile {
  const gymProfile = useGymStore((s) => s.gymProfile);
  const kcal = useGymStore((s) => s.calorieGoal);
  const sexo = gymProfile?.sexo;
  const edad = gymProfile?.edad;
  const pesoKg = gymProfile?.pesoKg;
  const dias = gymProfile?.diasPorSemana ?? 0;
  const nivel = gymProfile?.nivelActividad;
  const entrena = dias >= 2 || nivel === "moderado" || nivel === "intenso" || nivel === "muy_intenso";
  return useMemo(() => ({ sexo, edad, pesoKg, kcal, entrena }), [sexo, edad, pesoKg, kcal, entrena]);
}

export function useNutrientTargets(): TargetsResult {
  const perfil = useTargetProfile();
  return useMemo(() => getNutrientTargets(perfil), [perfil]);
}
