"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Profile } from "@/lib/types/profile";
import { defaultModuleAccess, type ModuleAccessMap } from "@/lib/account/modules";
import { DEFAULT_PLANS } from "@/lib/subscription-plans";
import type { PaymentSettings } from "@/lib/account/load-account";
import type { SubscriptionInfo } from "@/lib/subscription";

/**
 * Contexto simple para exponer el `profile` (tabla `profiles`, ver
 * supabase/migrations/0001_admin_foundation.sql) cargado server-side en
 * src/app/(dashboard)/layout.tsx al resto del árbol de cliente — así el
 * panel de administrador y cualquier otro componente pueden leer
 * rol/bloqueo/módulos sin tener que volver a pedirlo a Supabase ni
 * recibirlo por prop-drilling manual.
 *
 * `profile` puede ser `null` en el instante en que el layout no logró
 * cargarlo (p.ej. Supabase inalcanzable) — los consumidores deben tratar
 * ese caso como "sin info de perfil todavía", nunca como error fatal (la
 * sesión ya fue validada aparte, en el layout).
 *
 * `account` agrega lo que depende de ese perfil: módulos habilitados, estado de suscripción y datos de pago.
 */
export interface AccountState {
  modules: ModuleAccessMap;
  subscription: SubscriptionInfo | null;
  payment: PaymentSettings;
}

// Default restrictivo (mismo criterio que `defaultModuleAccess`), no "todo habilitado": esto solo se
// usaría si algún día se monta `<ProfileProvider>` sin pasarle `account` explícito (hoy no pasa — el
// único uso real, `(dashboard)/layout.tsx`, siempre pasa uno) — mejor fallar cerrado que abierto.
const EMPTY_ACCOUNT: AccountState = {
  modules: defaultModuleAccess(),
  subscription: null,
  payment: { qrPayload: null, amountLabel: null, instructions: null, plans: DEFAULT_PLANS },
};

const ProfileContext = createContext<Profile | null>(null);
const AccountContext = createContext<AccountState>(EMPTY_ACCOUNT);

export function ProfileProvider({
  profile,
  account,
  children,
}: {
  profile: Profile | null;
  account?: AccountState;
  children: ReactNode;
}) {
  return (
    <ProfileContext.Provider value={profile}>
      <AccountContext.Provider value={account ?? EMPTY_ACCOUNT}>{children}</AccountContext.Provider>
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}

export function useAccount() {
  return useContext(AccountContext);
}
