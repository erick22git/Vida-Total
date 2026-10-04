/**
 * Íconos de línea (propios) de los 8 grupos de la pantalla de Rango: silueta, brazos, piernas, espalda, pecho, glúteos,
 * abdomen y hombros/cuello. Trazo simple con `currentColor`, para que hereden el color de quien los use.
 */
const PATHS: Record<string, React.ReactNode> = {
  cuerpo: (
    <>
      <circle cx="24" cy="9" r="4.2" />
      <path d="M15 20c3-2.2 6-3 9-3s6 .8 9 3l2.4 13M15 20l-2.4 13M19.5 22v20M28.5 22v20M19.5 42h-3.5M28.5 42H32" />
    </>
  ),
  brazos: (
    <path d="M10 37c-.5-9 4-16 11-18 3.5-1 4.5-3.5 4.5-6.5 5 .5 10 4.5 11 10.5.8 5-2 9-6 9-3 0-3.5 2.5-5.5 5-2.5 3-8 4.5-12 3-1.5-.5-2.7-1.5-3-3z" />
  ),
  piernas: <path d="M17.5 6h13l-1.8 18 3.3 18h-6.2l-1.8-14-1.8 14H16l3.3-18z" />,
  espalda: (
    <>
      <path d="M13.5 10h21l3.5 11-3.5 23h-21L10 21z" />
      <path d="M24 10v34M17.5 17l5.5 8M30.5 17L25 25" />
    </>
  ),
  pecho: (
    <>
      <path d="M11 11h26l2.5 9-5 7H13.5l-5-7z" />
      <path d="M24 11v16M15 20.5h7M26 20.5h7" />
    </>
  ),
  gluteos: (
    <>
      <path d="M24 11c-8.5 0-14.5 6-14.5 14 0 6.5 6.5 10.5 14.5 6.5 8 4 14.5 0 14.5-6.5 0-8-6-14-14.5-14z" />
      <path d="M24 15v17" />
    </>
  ),
  abdomen: (
    <>
      <path d="M14 7h20l-2.2 34H16.2z" />
      <path d="M24 7v34M15.2 17.5h17.6M15.8 26h16.4M16.3 34h15.4" />
    </>
  ),
  hombros: (
    <>
      <path d="M24 5.5c-3.2 0-5.5 3-5.5 6.5v4.5c-6.5 1.2-11.5 3.5-13.5 8.5h38c-2-5-7-7.3-13.5-8.5V12c0-3.5-2.3-6.5-5.5-6.5z" />
      <path d="M10 25l-2.5 14M38 25l2.5 14" />
    </>
  ),
};

export function MuscleGroupIcon({ group, size = 26, className }: { group: string; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {PATHS[group] ?? PATHS.cuerpo}
    </svg>
  );
}
