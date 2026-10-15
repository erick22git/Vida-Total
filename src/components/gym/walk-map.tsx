"use client";

/**
 * Mapa de la caminata (sección "Agente de nutrición" → pestaña de caminata, pedido: "un mapa que ya
 * esté hecho y armado, pero gratis"). Leaflet + mosaicos de OpenStreetMap: gratis, sin API key, sin
 * tope de uso para un uso personal normal (la política de OSM pide no abusar del servicio público,
 * nada más). Se carga solo del lado del cliente (`dynamic(..., {ssr:false})` en quien lo use) porque
 * Leaflet necesita `window`.
 *
 * Usa `circleMarker` (dibujado en SVG) en vez del ícono de pin por defecto de Leaflet para evitar el
 * problema conocido de Leaflet + bundlers modernos (el ícono por defecto busca sus imágenes con una
 * ruta que Next.js no resuelve igual) — no hace falta ningún asset de imagen aparte.
 */
import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@/lib/geo/walk-tracking";

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816]; // sin puntos todavía: cae en algún lado razonable, se recentra apenas hay GPS real

function RecenterOnLatest({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const last = points[points.length - 1];
    map.setView([last.lat, last.lng], map.getZoom() < 14 ? 16 : map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length]);
  return null;
}

export function WalkMap({ points }: { points: GeoPoint[] }) {
  const latLngs = points.map((p) => [p.lat, p.lng] as [number, number]);
  const start = latLngs[0];
  const last = latLngs[latLngs.length - 1];

  return (
    <div className="w-full h-56 rounded-2xl overflow-hidden border border-white/10">
      <MapContainer center={last ?? DEFAULT_CENTER} zoom={16} scrollWheelZoom={false} style={{ width: "100%", height: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {latLngs.length > 1 && <Polyline positions={latLngs} pathOptions={{ color: "var(--gym, #22c55e)", weight: 4 }} />}
        {start && <CircleMarker center={start} radius={6} pathOptions={{ color: "#fff", fillColor: "#22c55e", fillOpacity: 1 }} />}
        {last && latLngs.length > 1 && <CircleMarker center={last} radius={7} pathOptions={{ color: "#fff", fillColor: "#3b82f6", fillOpacity: 1 }} />}
        <RecenterOnLatest points={points} />
      </MapContainer>
    </div>
  );
}
