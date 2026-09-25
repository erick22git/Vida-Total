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
    // iOS solo desbloquea el audio al SOLTAR el dedo (touchend/click), no al
    // apoyarlo — por eso se escuchan varios eventos y no solo pointerdown.
    const unlock = () => unlockAudio();
    const events = ["pointerdown", "pointerup", "touchend", "click"] as const;
    events.forEach((e) => window.addEventListener(e, unlock, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  useAnimationEvent((e) => {
    switch (e.type) {
      case "check.press-start":
        playSound("press");
        haptic("light");
        break;
      case "habit.progress":
        playSound("navigation");
        haptic("medium");
        break;
      case "habit.completed":
        playSound("complete");
        haptic("success");
        break;
      case "habit.levelUp":
        playSound("level-up");
        haptic("milestone");
        break;
      case "habit.milestone":
      case "streak.milestone":
        playSound("milestone");
        haptic("milestone");
        break;
      case "habit.swipeNext":
      case "habit.swipePrevious":
      case "habit.viewChange":
        playSound("navigation");
        haptic("light");
        break;
    }
  });
}
