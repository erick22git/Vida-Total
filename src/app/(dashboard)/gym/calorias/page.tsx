"use client";

import { Suspense } from "react";
import { MealHomeScreen } from "@/components/gym/meal-home-screen";

export default function CaloriasPage() {
  return (
    <Suspense fallback={null}>
      <MealHomeScreen />
    </Suspense>
  );
}
