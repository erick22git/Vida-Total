"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "@/components/providers/profile-provider";
import { useGymStore } from "@/lib/store/gymStore";
import { getCurrentUserId } from "@/lib/store/user-scope";

/**
 * Lleva a cada módulo SU formulario la primera vez que la persona entra a ese módulo (no en el onboarding inicial, que ya no pide
 * datos de salud). Solo se conecta desde afuera: no toca nada de la lógica interna de Calorías ni de Entrenamiento.
 *
 *  - Calorías  (`/gym/calorias`):     si faltan los datos de la calculadora -> `/gym/calorias/configurar-calorias`.
 *  - Entrenamiento (`/gym/entrenamiento`): si falta el perfil de entrenamiento -> `/gym/entrenamiento/configurar-perfil`.
 *
 * Una sola vez por sesión y por módulo (el formulario tiene su "X": si lo cierra, no se lo vuelve a empujar hasta otra sesión).
 * Solo entra si el módulo está habilitado y solo cuando la pantalla de entrada del módulo es la ruta exacta.
 */
const FORMS: { path: string; key: "gym_calorias" | "gym_entrenamiento"; form: string }[] = [
  { path: "/gym/calorias", key: "gym_calorias", form: "/gym/calorias/configurar-calorias" },
  { path: "/gym/entrenamiento", key: "gym_entrenamiento", form: "/gym/entrenamiento/configurar-perfil" },
];

export function FirstUseForms() {
  const pathname = usePathname();
  const router = useRouter();
  const { modules } = useAccount();
  const profile = useGymStore((s) => s.gymProfile);

  const caloriesDone = !!(profile?.sexo && profile.edad && profile.pesoKg && profile.alturaCm && profile.nivelActividad && profile.objetivoCalorico && profile.intensidadObjetivo);
  const trainingDone = !!(profile?.experiencia && profile.diasPorSemana && profile.equipo);

  useEffect(() => {
    const entry = FORMS.find((f) => f.path === pathname);
    if (!entry || !modules[entry.key]) return;
    const done = entry.key === "gym_calorias" ? caloriesDone : trainingDone;
    if (done) return;
    const flag = `vt_firstuse_${getCurrentUserId() ?? "anon"}_${entry.key}`;
    try {
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
    } catch {
      return; // sin sessionStorage no se arriesga un bucle de redirecciones
    }
    router.push(entry.form);
  }, [pathname, modules, caloriesDone, trainingDone, router]);

  return null;
}
