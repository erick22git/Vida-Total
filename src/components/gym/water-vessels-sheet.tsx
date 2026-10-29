"use client";

/** "Mis vasos": los recipientes que se muestran como botones rápidos en Agua (nombre, ml, foto opcional). */
import { useRef, useState } from "react";
import { Camera, ImagePlus, Plus, Trash2 } from "lucide-react";
import { ExpandSheet } from "@/components/shared/expand-sheet";
import { VesselCameraSheet } from "@/components/gym/vessel-camera-sheet";
import { useGymStore } from "@/lib/store/gymStore";
import { MAX_VESSELS, clampVesselMl, resizeImage, type WaterVessel } from "@/lib/gym/water-vessels";

// text-base (16px), no text-sm: por debajo de 16px Safari/Chrome hacen zoom automático al enfocar el campo.
const FIELD = "bg-white/[0.07] rounded-lg px-2.5 py-2 text-base text-white outline-none focus:bg-white/[0.12] min-w-0";

function VesselRow({ v, onChange, onDelete }: { v: WaterVessel; onChange: (p: Partial<WaterVessel>) => void; onDelete: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mlText, setMlText] = useState(String(v.ml));
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-white/[0.05] p-2.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onChange({ foto: await resizeImage(f, 120, 0.7).catch(() => v.foto) });
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        aria-label={`Foto de ${v.nombre}`}
        className="w-12 h-12 rounded-xl bg-white/[0.08] flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
      >
        {v.foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.foto} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImagePlus size={18} className="text-white/45" />
        )}
      </button>
      <input value={v.nombre} onChange={(e) => onChange({ nombre: e.target.value.slice(0, 24) })} className={`${FIELD} flex-1`} aria-label="Nombre del vaso" />
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          inputMode="numeric"
          value={mlText}
          onChange={(e) => {
            setMlText(e.target.value);
            const n = parseFloat(e.target.value);
            if (n > 0) onChange({ ml: clampVesselMl(n) });
          }}
          onBlur={() => setMlText(String(v.ml))}
          className={`${FIELD} w-[5rem] text-right tabular-nums`}
          aria-label="Mililitros"
        />
        <span className="text-xs text-white/45">ml</span>
      </div>
      <button onClick={onDelete} aria-label={`Quitar ${v.nombre}`} className="w-8 h-8 flex items-center justify-center text-white/45 hover:text-red-300 cursor-pointer shrink-0">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function WaterVesselsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const vessels = useGymStore((s) => s.waterVessels);
  const setVessels = useGymStore((s) => s.setWaterVessels);
  const [cameraOpen, setCameraOpen] = useState(false);
  const full = vessels.length >= MAX_VESSELS;

  const update = (id: string, patch: Partial<WaterVessel>) => setVessels(vessels.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const add = (v: Omit<WaterVessel, "id">) => setVessels([...vessels, { ...v, id: `v-${Date.now().toString(36)}` }]);

  return (
    <>
      <ExpandSheet open={open && !cameraOpen} onClose={onClose} title="Mis vasos">
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-xs text-white/50 -mt-1">
            Estos son los botones rápidos de Agua (máx. {MAX_VESSELS}). Pon el nombre, los ml reales y, si quieres, una foto.
          </p>
          {vessels.map((v) => (
            <VesselRow key={v.id} v={v} onChange={(p) => update(v.id, p)} onDelete={() => setVessels(vessels.filter((x) => x.id !== v.id))} />
          ))}
          {vessels.length === 0 && <p className="text-sm text-white/45 text-center py-3">Sin vasos: agrega al menos uno.</p>}
          <div className="grid grid-cols-2 gap-2.5 mt-1">
            <button
              disabled={full}
              onClick={() => add({ nombre: "Mi vaso", ml: 250 })}
              className="flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-medium bg-white/[0.08] text-white cursor-pointer disabled:opacity-40"
            >
              <Plus size={16} /> Añadir vaso
            </button>
            <button
              disabled={full}
              onClick={() => setCameraOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-medium bg-white text-black cursor-pointer disabled:opacity-40"
            >
              <Camera size={16} /> Medir con cámara
            </button>
          </div>
        </div>
      </ExpandSheet>
      <VesselCameraSheet open={cameraOpen} onClose={() => setCameraOpen(false)} onSave={(d) => add({ nombre: d.nombre, ml: d.ml, foto: d.foto })} />
    </>
  );
}
