"use client";

/**
 * Simplified front/back human body silhouette where each muscle zone can be
 * tinted according to a 0-1 intensity value. Used by the AI plan wizard (as a
 * small decorative icon) and the global body map (large, interactive).
 */
export type BodyZone =
  | "hombros"
  | "pecho"
  | "biceps"
  | "abdomen"
  | "cuadriceps"
  | "gemelos"
  | "espalda"
  | "triceps"
  | "gluteos"
  | "isquios"
  | "trapecio"
  | "antebrazos";

const BASE_COLOR = "255,255,255";

function zoneFill(intensities: Partial<Record<BodyZone, number>> | undefined, zone: BodyZone, accent = "91,141,239") {
  const v = intensities?.[zone] ?? 0;
  if (v <= 0) return `rgba(${BASE_COLOR},0.10)`;
  const alpha = 0.18 + v * 0.55;
  return `rgba(${accent},${alpha})`;
}

export function BodySilhouetteFront({
  intensities,
  accent = "91,141,239",
  size = 120,
  onZoneClick,
}: {
  intensities?: Partial<Record<BodyZone, number>>;
  accent?: string;
  size?: number;
  onZoneClick?: (zone: BodyZone) => void;
}) {
  const z = (zone: BodyZone) => zoneFill(intensities, zone, accent);
  const click = (zone: BodyZone) => () => onZoneClick?.(zone);
  return (
    <svg viewBox="0 0 120 220" width={size} height={(size / 120) * 220} fill="none">
      {/* head */}
      <circle cx="60" cy="18" r="14" fill="rgba(255,255,255,0.14)" />
      {/* trapecio */}
      <path d="M40 34 L60 30 L80 34 L74 46 L46 46 Z" fill={z("trapecio")} onClick={click("trapecio")} />
      {/* shoulders */}
      <ellipse cx="34" cy="52" rx="12" ry="10" fill={z("hombros")} onClick={click("hombros")} />
      <ellipse cx="86" cy="52" rx="12" ry="10" fill={z("hombros")} onClick={click("hombros")} />
      {/* chest */}
      <path d="M44 46 H76 V80 H44 Z" fill={z("pecho")} onClick={click("pecho")} />
      {/* biceps */}
      <rect x="20" y="58" width="12" height="34" rx="5" fill={z("biceps")} onClick={click("biceps")} />
      <rect x="88" y="58" width="12" height="34" rx="5" fill={z("biceps")} onClick={click("biceps")} />
      {/* forearms */}
      <rect x="18" y="94" width="11" height="30" rx="5" fill={z("antebrazos")} onClick={click("antebrazos")} />
      <rect x="91" y="94" width="11" height="30" rx="5" fill={z("antebrazos")} onClick={click("antebrazos")} />
      {/* abdomen */}
      <rect x="46" y="82" width="28" height="38" rx="4" fill={z("abdomen")} onClick={click("abdomen")} />
      {/* quads */}
      <rect x="42" y="124" width="16" height="46" rx="6" fill={z("cuadriceps")} onClick={click("cuadriceps")} />
      <rect x="62" y="124" width="16" height="46" rx="6" fill={z("cuadriceps")} onClick={click("cuadriceps")} />
      {/* calves */}
      <rect x="43" y="174" width="14" height="34" rx="6" fill={z("gemelos")} onClick={click("gemelos")} />
      <rect x="63" y="174" width="14" height="34" rx="6" fill={z("gemelos")} onClick={click("gemelos")} />
    </svg>
  );
}

export function BodySilhouetteBack({
  intensities,
  accent = "91,141,239",
  size = 120,
  onZoneClick,
}: {
  intensities?: Partial<Record<BodyZone, number>>;
  accent?: string;
  size?: number;
  onZoneClick?: (zone: BodyZone) => void;
}) {
  const z = (zone: BodyZone) => zoneFill(intensities, zone, accent);
  const click = (zone: BodyZone) => () => onZoneClick?.(zone);
  return (
    <svg viewBox="0 0 120 220" width={size} height={(size / 120) * 220} fill="none">
      <circle cx="60" cy="18" r="14" fill="rgba(255,255,255,0.14)" />
      <path d="M40 34 L60 30 L80 34 L74 46 L46 46 Z" fill={z("trapecio")} onClick={click("trapecio")} />
      <ellipse cx="34" cy="52" rx="12" ry="10" fill={z("hombros")} onClick={click("hombros")} />
      <ellipse cx="86" cy="52" rx="12" ry="10" fill={z("hombros")} onClick={click("hombros")} />
      {/* back */}
      <path d="M44 46 H76 V90 H44 Z" fill={z("espalda")} onClick={click("espalda")} />
      {/* triceps */}
      <rect x="20" y="58" width="12" height="34" rx="5" fill={z("triceps")} onClick={click("triceps")} />
      <rect x="88" y="58" width="12" height="34" rx="5" fill={z("triceps")} onClick={click("triceps")} />
      <rect x="18" y="94" width="11" height="30" rx="5" fill={z("antebrazos")} onClick={click("antebrazos")} />
      <rect x="91" y="94" width="11" height="30" rx="5" fill={z("antebrazos")} onClick={click("antebrazos")} />
      {/* glutes */}
      <rect x="45" y="92" width="30" height="26" rx="8" fill={z("gluteos")} onClick={click("gluteos")} />
      {/* hamstrings */}
      <rect x="42" y="120" width="16" height="46" rx="6" fill={z("isquios")} onClick={click("isquios")} />
      <rect x="62" y="120" width="16" height="46" rx="6" fill={z("isquios")} onClick={click("isquios")} />
      <rect x="43" y="174" width="14" height="34" rx="6" fill={z("gemelos")} onClick={click("gemelos")} />
      <rect x="63" y="174" width="14" height="34" rx="6" fill={z("gemelos")} onClick={click("gemelos")} />
    </svg>
  );
}
