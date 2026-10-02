"use client";

import { useEffect } from "react";
import { useThemePref } from "@/lib/ui/theme-pref";

/** Refleja la preferencia de tema en `<html data-theme>`. El script inline de app/layout.tsx ya lo
 * pone antes de pintar (sin parpadeo); esto lo mantiene al día cuando se cambia en vivo. */
export function ThemeApplier() {
  const [mode] = useThemePref();
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);
  return null;
}
