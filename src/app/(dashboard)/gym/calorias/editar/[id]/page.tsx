"use client";

import { use } from "react";
import { FoodDetailScreen } from "@/components/gym/food-detail-screen";

export default function EditarAlimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <FoodDetailScreen id={id} mode="editar" />;
}
