import { useEffect, useState } from "react";

/** Hora actual que se refresca sola (para llenar los bloques según avanza el reloj). */
export function useNow(intervalMs = 20_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
