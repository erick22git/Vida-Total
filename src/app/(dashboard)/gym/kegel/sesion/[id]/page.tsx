"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { KegelSessionScreen } from "@/components/gym/kegel-session-screen";
import { getKegelSession } from "@/lib/gym/kegel-plan";

export default function KegelSesionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const def = getKegelSession(id);
  if (!def) notFound();
  return <KegelSessionScreen def={def} />;
}
