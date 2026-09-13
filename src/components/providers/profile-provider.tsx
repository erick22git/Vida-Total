"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Profile } from "@/lib/types/profile";

/**
 * Contexto simple para exponer el `profile` (tabla `profiles`, ver
 * supabase/migrations/0001_admin_foundation.sql) cargado server-side en
 * src/app/(dashboard)/layout.tsx al resto del árbol de cliente — así el
 * futuro panel de administrador y cualquier otro componente pueden leer
 * rol/bloqueo/módulos sin tener que volver a pedirlo a Supabase ni
 * recibirlo por prop-drilling manual.
 *
 * `profile` puede ser `null` en el instante en que el layout no logró
 * cargarlo (p.ej. Supabase inalcanzable) — los consumidores deben tratar
 * ese caso como "sin info de perfil todavía", nunca como error fatal (la
 * sesión ya fue validada aparte, en el layout).
 */
const ProfileContext = createContext<Profile | null>(null);

export function ProfileProvider({ profile, children }: { profile: Profile | null; children: ReactNode }) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
