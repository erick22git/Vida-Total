"use client";

import { motion } from "framer-motion";
import { Sun } from "lucide-react";
import { WEATHER_ICON_MAP } from "@/lib/outfit-utils";
import type { WeatherCondition } from "@/lib/types/outfit";

const CONDITION_COLORS: Record<WeatherCondition, string> = {
  soleado: "#f59e0b",
  nublado: "#9ca3af",
  lluvioso: "#3b82f6",
  nevado: "#93c5fd",
  ventoso: "#5eead4",
};

export function WeatherIcon({
  icon,
  condition,
  size = 24,
}: {
  icon: string;
  condition: WeatherCondition;
  size?: number;
}) {
  const Icon = WEATHER_ICON_MAP[icon] ?? Sun;
  const color = CONDITION_COLORS[condition];

  if (condition === "soleado") {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        style={{ display: "inline-flex" }}
      >
        <Icon size={size} style={{ color }} />
      </motion.div>
    );
  }
  if (condition === "nublado" || condition === "ventoso") {
    return (
      <motion.div
        animate={{ x: [0, 4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ display: "inline-flex" }}
      >
        <Icon size={size} style={{ color }} />
      </motion.div>
    );
  }
  if (condition === "lluvioso") {
    return (
      <motion.div
        animate={{ y: [0, 3, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        style={{ display: "inline-flex" }}
      >
        <Icon size={size} style={{ color }} />
      </motion.div>
    );
  }
  return (
    <motion.div
      animate={{ rotate: [0, 15, -15, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      style={{ display: "inline-flex" }}
    >
      <Icon size={size} style={{ color }} />
    </motion.div>
  );
}
