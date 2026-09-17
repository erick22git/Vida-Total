"use client";

import Link from "next/link";
import {
  BarChart3,
  CalendarRange,
  ChevronRight,
  MapPin,
  Shirt,
  Sparkles,
} from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { WeatherIcon } from "@/components/outfit/weather-icon";
import { WEATHER_CONDITION_LABELS } from "@/lib/outfit-utils";
import { useOutfitStore } from "@/lib/store/outfitStore";
import { getWeatherForDate } from "@/lib/data/weather";

export default function OutfitHubPage() {
  const clothingItems = useOutfitStore((s) => s.clothingItems);
  const outfits = useOutfitStore((s) => s.outfits);
  const today = new Date();
  const weather = getWeatherForDate(today);

  const sections = [
    {
      href: "/outfit/armario",
      icon: Shirt,
      title: "Mi Armario",
      desc: `${clothingItems.length} prenda${clothingItems.length === 1 ? "" : "s"} registradas`,
    },
    {
      href: "/outfit/crear",
      icon: Sparkles,
      title: "Crear Outfit",
      desc: `${outfits.length} outfit${outfits.length === 1 ? "" : "s"} guardados`,
    },
    {
      href: "/outfit/plan-semanal",
      icon: CalendarRange,
      title: "Plan Semanal",
      desc: "Organiza tu semana según el clima",
    },
    {
      href: "/outfit/estadisticas",
      icon: BarChart3,
      title: "Estadísticas",
      desc: "Analiza el uso de tu armario",
    },
  ];

  return (
    // El fondo de foto ya lo pone outfit/layout.tsx (compartido por todas
    // las pantallas de Outfit).
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 pt-2">
        <p className="text-white/50 text-sm md:text-base">Módulo</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight flex items-center gap-2">
          <Shirt style={{ color: "var(--outfit)" }} /> Outfit
        </h1>
      </header>

      <GlassCard accentColor="var(--outfit)" glow className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-sm text-white/55">
            <MapPin size={13} />
            Hoy
          </div>
          <p className="text-4xl font-semibold">
            {weather.temp}°<span className="text-lg font-normal text-white/40">C</span>
          </p>
          <p className="text-sm text-white/60">{WEATHER_CONDITION_LABELS[weather.condition]}</p>
        </div>
        <WeatherIcon icon={weather.icon} condition={weather.condition} size={64} />
      </GlassCard>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <GlassCard accentColor="var(--outfit)" glow className="flex flex-col gap-4 h-full">
              <div className="flex items-center justify-between">
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-2xl"
                  style={{ background: "var(--outfit)22" }}
                >
                  <s.icon size={20} style={{ color: "var(--outfit)" }} />
                </div>
                <ChevronRight size={18} className="text-white/30" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-lg font-semibold">{s.title}</p>
                <p className="text-sm text-white/55">{s.desc}</p>
              </div>
            </GlassCard>
          </Link>
        ))}
      </section>
    </div>
  );
}
