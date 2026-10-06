/**
 * Datos semilla de las rutinas reales del usuario.
 * IDs estables — no cambiar, son la clave de idempotencia en importMiRutina().
 *
 * Convención diasSemana: Date.getDay() — 0=dom, 1=lun, 2=mar, 3=mié, 4=jue, 5=vie, 6=sáb
 *
 * categoryId mapea a HABIT_CATEGORIES en src/lib/data/habit-categories.ts:
 *   "comida"  → Utensils verde
 *   "gym"     → Dumbbell coral
 *   "estudio" → GraduationCap cyan
 *   "higiene" → Heart rosa
 */
import type { HabitRoutine } from "@/lib/types/habits";

const NOW = 0; // se sustituye con Date.now() en el store; en seed es un placeholder

export const SEED_RUTINAS: Omit<HabitRoutine, "createdAt">[] = [
  // ─── Semana lun-vie: comidas + rutina mañana ─────────────────────────────
  {
    id: "seed-semana-lun-vie",
    nombre: "Semana (lun-vie)",
    diasSemana: [1, 2, 3, 4, 5],
    endsAt: undefined,
    completedDates: [],
    streak: 0,
    milestonesUnlocked: [],
    items: [
      {
        id: "seed-sw-despertar",
        hora: "07:00",
        label: "Despertar · bañarme · cocinar",
        durationMin: 60,
        categoryId: "higiene",
        diasSemana: undefined,
        completedDates: [],
      },
      {
        id: "seed-sw-desayuno",
        hora: "08:00",
        label: "Desayunar · alistarme",
        durationMin: 60,
        categoryId: "comida",
        diasSemana: undefined,
        completedDates: [],
      },
      {
        id: "seed-sw-almuerzo",
        hora: "13:00",
        label: "Almuerzo",
        durationMin: 60,
        categoryId: "comida",
        diasSemana: undefined,
        completedDates: [],
      },
      {
        id: "seed-sw-cena",
        hora: "20:00",
        label: "Cena · dormir",
        durationMin: 60,
        categoryId: "comida",
        diasSemana: undefined,
        completedDates: [],
      },
    ],
  },

  // ─── Sábado ──────────────────────────────────────────────────────────────
  {
    id: "seed-sabado",
    nombre: "Sábado",
    diasSemana: [6],
    endsAt: undefined,
    completedDates: [],
    streak: 0,
    milestonesUnlocked: [],
    items: [
      {
        id: "seed-sab-despertar",
        hora: "06:30",
        label: "Despertar · bañarme · cocinar",
        durationMin: 60,
        categoryId: "higiene",
        diasSemana: undefined,
        completedDates: [],
      },
      {
        id: "seed-sab-salir",
        hora: "07:30",
        label: "Salir",
        durationMin: 30,
        categoryId: "movilidad",
        diasSemana: undefined,
        completedDates: [],
      },
      {
        id: "seed-sab-curex",
        hora: "08:00",
        label: "Curex",
        durationMin: 300,
        categoryId: "estudio",
        diasSemana: undefined,
        completedDates: [],
      },
    ],
  },

  // ─── Gym (lun-vie, cada día su grupo muscular) ────────────────────────────
  {
    id: "seed-gym",
    nombre: "Gym",
    diasSemana: [1, 2, 3, 4, 5],
    endsAt: undefined,
    completedDates: [],
    streak: 0,
    milestonesUnlocked: [],
    items: [
      {
        id: "seed-gym-lun",
        hora: "18:00",
        label: "Pecho, hombro, tríceps",
        durationMin: 120,
        categoryId: "gym",
        diasSemana: [1],
        completedDates: [],
      },
      {
        id: "seed-gym-mar",
        hora: "16:00",
        label: "Cuádriceps, gemelos",
        durationMin: 120,
        categoryId: "gym",
        diasSemana: [2],
        completedDates: [],
      },
      {
        id: "seed-gym-mie",
        hora: "18:00",
        label: "Espalda, bíceps, antebrazo",
        durationMin: 120,
        categoryId: "gym",
        diasSemana: [3],
        completedDates: [],
      },
      {
        id: "seed-gym-jue",
        hora: "18:00",
        label: "Femoral, gemelos",
        durationMin: 120,
        categoryId: "gym",
        diasSemana: [4],
        completedDates: [],
      },
      {
        id: "seed-gym-vie",
        hora: "16:00",
        label: "Todo torso",
        durationMin: 120,
        categoryId: "gym",
        diasSemana: [5],
        completedDates: [],
      },
    ],
  },

  // ─── Clases (lun-vie, por día) ────────────────────────────────────────────
  {
    id: "seed-clases",
    nombre: "Clases",
    diasSemana: [1, 2, 3, 4, 5],
    endsAt: undefined, // dejar vacío; el usuario lo llenará al terminar el semestre
    completedDates: [],
    streak: 0,
    milestonesUnlocked: [],
    items: [
      // Lunes
      {
        id: "seed-cl-lun-sis421",
        hora: "09:00",
        label: "SIS421 IA II · Pacheco · GT1 · B202",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [1],
        completedDates: [],
      },
      {
        id: "seed-cl-lun-sis258",
        hora: "14:00",
        label: "SIS258 Sistemas Distribuidos · Montellano · G1 · B205",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [1],
        completedDates: [],
      },
      {
        id: "seed-cl-lun-sis256",
        hora: "16:00",
        label: "SIS256 rep. Tec. y Des. Web · Montellano · G1 · B006",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [1],
        completedDates: [],
      },
      // Martes
      {
        id: "seed-cl-mar-com350",
        hora: "11:00",
        label: "COM350 Arquitectura de Software · Montellano · G1 · E102",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [2],
        completedDates: [],
      },
      {
        id: "seed-cl-mar-adm100",
        hora: "14:00",
        label: "ADM100 · O. Velasco · G2 · B008",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [2],
        completedDates: [],
      },
      // Miércoles
      {
        id: "seed-cl-mie-com350",
        hora: "09:00",
        label: "COM350 Arquitectura de Software · Montellano · G1 · E102",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [3],
        completedDates: [],
      },
      {
        id: "seed-cl-mie-sis256",
        hora: "16:00",
        label: "SIS256 rep. · Montellano · GT1 · C002",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [3],
        completedDates: [],
      },
      // Jueves
      {
        id: "seed-cl-jue-sis258",
        hora: "16:00",
        label: "SIS258 Sistemas Distribuidos · Montellano · G1 · E102",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [4],
        completedDates: [],
      },
      // Viernes
      {
        id: "seed-cl-vie-sis421",
        hora: "09:00",
        label: "SIS421 IA II · Pacheco · GL1 · B202",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [5],
        completedDates: [],
      },
      {
        id: "seed-cl-vie-adm100",
        hora: "14:00",
        label: "ADM100 · O. Velasco · G2 · C101",
        durationMin: 120,
        categoryId: "estudio",
        diasSemana: [5],
        completedDates: [],
      },
    ],
  },
];

export { NOW };
