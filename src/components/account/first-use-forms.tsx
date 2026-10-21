"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount, useProfile } from "@/components/providers/profile-provider";
import { useGymStore } from "@/lib/store/gymStore";
import { useSyncReadyStore } from "@/lib/store/syncReadyStore";
import { getCurrentUserId } from "@/lib/store/user-scope";

/**
 * Lleva a cada módulo SU formulario la primera vez que la persona entra a ese módulo (no en el onboarding inicial, que ya no pide
 * datos de salud). Solo se conecta desde afuera: no toca nada de la lógica interna de Calorías ni de Entrenamiento.
 *
 *  - Calorías  (`/gym/calorias`):     si faltan los datos de la calculadora -> `/gym/calorias/configurar-calorias`.
 *  - Entrenamiento (`/gym/entrenamiento`): si falta el perfil -> `/gym/entrenamiento/configurar-perfil` y, después, si no tiene
 *    ninguna rutina -> `/gym/entrenamiento/empezar` (elegir la rutina de principiante sugerida o armar la suya).
 *
 * Reglas que evitan formularios fuera de lugar:
 *  - NUNCA al administrador (la app es suya, no es una cuenta nueva) ni durante una impersonación (modo solo lectura).
 *  - Solo DESPUÉS de traer los datos de la nube: antes el navegador está vacío en cualquier dispositivo nuevo y una cuenta que
 *    ya tenía todo configurado parecía "sin configurar".
 *  - Si la cuenta ya tiene actividad (comidas, pesos, entrenamientos, planes) no se la trata como nueva.
 * Una sola vez por sesión y por módulo (el formulario tiene su "X": si lo cierra, no se lo vuelve a empujar hasta otra sesión).
 */
export function FirstUseForms({ impersonating = false }: { impersonating?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const profileRow = useProfile();
  const { modules } = useAccount();
  const ready = useSyncReadyStore((s) => s.gym);
  const profile = useGymStore((s) => s.gymProfile);
  const loggedFoodsCount = useGymStore((s) => s.loggedFoods.length);
  const weightsCount = useGymStore((s) => s.weightEntries.length);
  const sessionsCount = useGymStore((s) => s.sessions.length);
  const plansCount = useGymStore((s) => s.plans.length);
  const routinesCount = useGymStore((s) => s.routines.length);

  const isAdmin = profileRow?.role === "admin";
  const caloriesProfileDone = !!(profile?.sexo && profile.edad && profile.pesoKg && profile.alturaCm && profile.nivelActividad && profile.objetivoCalorico && profile.intensidadObjetivo);
  const caloriesDone = caloriesProfileDone || loggedFoodsCount > 0 || weightsCount > 0;
  const trainingProfileDone = !!(profile?.experiencia && profile.diasPorSemana && profile.equipo);
  const hasTrainingActivity = sessionsCount > 0 || plansCount > 0 || routinesCount > 0;
  const trainingProfileMissing = !trainingProfileDone && !hasTrainingActivity;
  const routineMissing = !hasTrainingActivity;

  useEffect(() => {
    if (!ready || isAdmin || impersonating) return;

    let target: string | null = null;
    let flagKey = "";
    if (pathname === "/gym/calorias" && modules.gym_calorias && !caloriesDone) {
      target = "/gym/calorias/configurar-calorias";
      flagKey = "gym_calorias";
    } else if (pathname === "/gym/entrenamiento" && modules.gym_entrenamiento) {
      if (trainingProfileMissing) {
        // Al guardar el perfil vuelve directo a elegir la rutina.
        target = "/gym/entrenamiento/configurar-perfil?volver=/gym/entrenamiento/empezar";
        flagKey = "gym_entrenamiento_perfil";
      } else if (routineMissing) {
        target = "/gym/entrenamiento/empezar";
        flagKey = "gym_entrenamiento_rutina";
      }
    }
    if (!target) return;

    const flag = `vt_firstuse_${getCurrentUserId() ?? "anon"}_${flagKey}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
    } catch {
      return; // sin sessionStorage no se arriesga un bucle de redirecciones
    }
    router.push(target);
  }, [pathname, modules, ready, isAdmin, impersonating, caloriesDone, trainingProfileMissing, routineMissing, router]);

  return null;
}
