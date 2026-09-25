"use client";

import { useEffect } from "react";
import { useAnimationEvent } from "@/lib/animations/use-animation-engine";
import { playSound, unlockAudio } from "@/lib/sound/sound-engine";
import { haptic } from "@/lib/haptics/haptic";

/**
 * Traduce los eventos del Animation Engine a sonido + háptico en la pantalla
 * de un hábito. Los eventos los emiten las business actions y los gestos;
 * ninguno de ellos sabe qué suena o vibra — todo se decide acá.
 * Además desbloquea el audio en el primer gesto (política de autoplay).
 */
export function useHabitFeedback() {
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useAnimationEvent((e) => {
    switch (e.type) {
      case "check.press-start":
        playSound("press");
        haptic("light");
        break;
      case "habit.completed":
        playSound("complete");
        haptic("success");
        break;
      case "streak.milestone":
        playSound("milestone");
        haptic("milestone");
        break;
      case "habit.swipeNext":
      case "habit.swipePrevious":
        playSound("navigation");
        haptic("light");
        break;
    }
  });
}
