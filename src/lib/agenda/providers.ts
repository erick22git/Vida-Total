/**
 * Orígenes desde los que la Agenda puede traer calendarios y recordatorios.
 * Solo se ofrecen como "disponibles" los que hoy funcionan de verdad en una web (archivo .ics). Los demás quedan
 * declarados con el motivo, para conectarlos después sin rehacer la pantalla: cada proveedor solo debe producir
 * `ParsedItem[]` (ver `ics.ts`) y entregarlos a `importCalendar` del store.
 */
export interface CalendarProvider {
  id: string;
  label: string;
  description: string;
  /** ¿Funciona hoy? */
  available: boolean;
  /** Si no está disponible: por qué. */
  reason?: string;
  /** Qué permisos pide. */
  permissions: string;
}

export const CALENDAR_PROVIDERS: CalendarProvider[] = [
  {
    id: "ics-file",
    label: "Archivo .ics",
    description: "Exporta tu calendario o recordatorios desde Google, Apple u Outlook e impórtalo aquí.",
    available: true,
    permissions: "Ninguno: solo lee el archivo que eliges.",
  },
  {
    id: "google",
    label: "Google Calendar",
    description: "Sincronización automática de una cuenta de Google.",
    available: false,
    reason: "Necesita iniciar sesión con Google (OAuth) y un servidor propio: llega en una fase posterior.",
    permissions: "Lectura de tus calendarios.",
  },
  {
    id: "device",
    label: "Calendario y Recordatorios del teléfono",
    description: "Lee directamente lo que tienes en tu dispositivo.",
    available: false,
    reason: "Una página web no puede leer el calendario del teléfono; requiere la app instalada.",
    permissions: "Acceso completo al calendario y a Recordatorios.",
  },
];

/** Colores que se asignan, en orden, a cada calendario importado. */
export const CALENDAR_COLORS = ["#6C9FD8", "#79B247", "#F5C037", "#DA4650", "#0E8A5F", "#B58AF0"];
