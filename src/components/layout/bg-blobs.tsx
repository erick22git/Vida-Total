"use client";

import { usePathname } from "next/navigation";

type Blob = { width: number; height: number; top?: string; bottom?: string; left?: string; right?: string; background: string };

const MODULE_BLOBS: Record<string, Blob[]> = {
  gym: [
    { width: 480, height: 480, top: "-10%", left: "-10%", background: "var(--gym)" },
    { width: 380, height: 380, bottom: "-10%", right: "-10%", background: "var(--gym-2)" },
  ],
  habitos: [
    { width: 480, height: 480, top: "-10%", left: "-10%", background: "var(--habitos)" },
    { width: 380, height: 380, bottom: "-10%", right: "-10%", background: "var(--habitos)" },
  ],
  outfit: [
    { width: 480, height: 480, top: "-10%", left: "-10%", background: "var(--outfit)" },
    { width: 380, height: 380, bottom: "-10%", right: "-10%", background: "var(--outfit)" },
  ],
  "paz-mental": [
    { width: 480, height: 480, top: "-10%", left: "-10%", background: "var(--paz-mental)" },
    { width: 380, height: 380, bottom: "-10%", right: "-10%", background: "var(--paz-mental)" },
  ],
  finanzas: [
    { width: 480, height: 480, top: "-10%", left: "-10%", background: "var(--finanzas)" },
    { width: 380, height: 380, bottom: "-10%", right: "-10%", background: "var(--finanzas)" },
  ],
  voz: [
    { width: 480, height: 480, top: "-10%", left: "-10%", background: "var(--voz)" },
    { width: 380, height: 380, bottom: "-10%", right: "-10%", background: "var(--voz)" },
  ],
};

const HOME_BLOBS: Blob[] = [
  { width: 480, height: 480, top: "-10%", left: "-10%", background: "var(--gym)" },
  { width: 420, height: 420, top: "20%", right: "-15%", background: "var(--habitos)" },
  { width: 380, height: 380, bottom: "-10%", left: "10%", background: "var(--outfit)" },
];

export function BgBlobs() {
  const pathname = usePathname();
  const segment = pathname?.split("/").filter(Boolean)[0] ?? "";
  const blobs = MODULE_BLOBS[segment] ?? HOME_BLOBS;

  return (
    <div className="bg-blobs" aria-hidden="true">
      {blobs.map((b, i) => (
        <div
          key={i}
          className="bg-blob"
          style={{
            width: b.width,
            height: b.height,
            top: b.top,
            bottom: b.bottom,
            left: b.left,
            right: b.right,
            background: b.background,
          }}
        />
      ))}
    </div>
  );
}
