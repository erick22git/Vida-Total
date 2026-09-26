import { redirect } from "next/navigation";

/** La antigua pantalla "Timeline" ahora es la Agenda: se conserva la ruta para no romper enlaces guardados. */
export default function TimelineRedirect() {
  redirect("/habitos/agenda");
}
