"use client";

import { Suspense } from "react";
import { CaloriasSkeleton } from "@/components/gym/calorias-skeleton";
import { MealHomeScreen } from "@/components/gym/meal-home-screen";

export default function CaloriasPage() {
  return (
    <Suspense fallback={<CaloriasSkeleton />}>
      <MealHomeScreen />
    </Suspense>
  );
}
