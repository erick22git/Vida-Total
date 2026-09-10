"use client";

import { useState } from "react";
import { DrinkPickerModal } from "@/components/gym/drink-picker-modal";
import { DrinkVolumeSheet } from "@/components/gym/drink-volume-sheet";
import { DrinkSettingsModal } from "@/components/gym/drink-settings-modal";
import { DrinkEditModal } from "@/components/gym/drink-edit-modal";
import type { DrinkOption } from "@/lib/data/drinks";

type Step = "pick" | "volume" | "settings" | "edit";

export function AddDrinkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<Step>("pick");
  const [pickedDrink, setPickedDrink] = useState<DrinkOption | null>(null);
  const [editingDrink, setEditingDrink] = useState<DrinkOption | null>(null);

  function handleClose() {
    setStep("pick");
    setPickedDrink(null);
    setEditingDrink(null);
    onClose();
  }

  return (
    <>
      <DrinkPickerModal
        open={open && step === "pick"}
        onClose={handleClose}
        onPick={(drink) => {
          setPickedDrink(drink);
          setStep("volume");
        }}
        onOpenSettings={() => setStep("settings")}
      />
      <DrinkVolumeSheet
        key={pickedDrink?.id ?? "none"}
        open={open && step === "volume"}
        onClose={handleClose}
        drink={pickedDrink}
      />
      <DrinkSettingsModal
        open={open && step === "settings"}
        onClose={() => setStep("pick")}
        onEditDrink={(drink) => {
          setEditingDrink(drink);
          setStep("edit");
        }}
      />
      <DrinkEditModal
        key={editingDrink?.id ?? "none"}
        open={open && step === "edit"}
        onClose={() => setStep("settings")}
        drink={editingDrink}
      />
    </>
  );
}
