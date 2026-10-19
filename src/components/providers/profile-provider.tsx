"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Profile } from "@/lib/types/profile";
import { allModulesEnabled, type ModuleAccessMap } from "@/lib/account/modules";
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

const EMPTY_ACCOUNT: AccountState = {
  modules: allModulesEnabled(),
  subscription: null,
  payment: { qrPayload: null, amountLabel: null, instructions: null },
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
