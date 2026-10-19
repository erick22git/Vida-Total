"use client";

/**
 * Preferencia (solo de este dispositivo) de si la mascota lee en voz alta los avisos de admin —
 * usuario nuevo, comprobante de pago, pedido de módulo (los 3 `kind` de `agent_notification_log` que
 * la migración 0019 reserva para notificar a los admins). Encendido por default: son los avisos que el
 * admin pidió explícitamente que le "dijera" la mascota.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { userScopedLocalStorage } from "./scoped-storage";

interface AdminNotifyVoiceState {
  speakEnabled: boolean;
  setSpeakEnabled: (v: boolean) => void;
}

export const useAdminNotifyVoiceStore = create<AdminNotifyVoiceState>()(
  persist(
    (set) => ({
      speakEnabled: true,
      setSpeakEnabled: (v) => set({ speakEnabled: v }),
    }),
    {
      name: "vida-total-admin-notify-voice",
      storage: createJSONStorage(() => userScopedLocalStorage("vida-total-admin-notify-voice")),
    },
  ),
);
