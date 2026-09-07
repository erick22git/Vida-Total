export interface LibraryPlan {
  id: string;
  nombre: string;
  contexto: string;
  categoria: string;
  daysPerWeek: number;
  minsPerSession: number;
  gradient: string;
}

export const LIBRARY_PLANS: LibraryPlan[] = [
  {
    id: "lib-clasico-estetico",
    nombre: "Clásico y Estético",
    contexto: "Gimnasio comercial · 5 días/semana",
    categoria: "En el Gym",
    daysPerWeek: 5,
    minsPerSession: 65,
    gradient: "linear-gradient(160deg, #f9736255, #a8302222)",
  },
  {
    id: "lib-fuerza-powerbuilding",
    nombre: "Powerbuilding Total",
    contexto: "Gimnasio comercial · 4 días/semana",
    categoria: "En el Gym",
    daysPerWeek: 4,
    minsPerSession: 75,
    gradient: "linear-gradient(160deg, #5b8def55, #1e3a8a22)",
  },
  {
    id: "lib-full-body-express",
    nombre: "Full Body Express",
    contexto: "Gimnasio comercial · 3 días/semana",
    categoria: "En el Gym",
    daysPerWeek: 3,
    minsPerSession: 45,
    gradient: "linear-gradient(160deg, #4ade8055, #14532d22)",
  },
  {
    id: "lib-calistenia-basico",
    nombre: "Dominio Corporal",
    contexto: "Sin equipo · 4 días/semana",
    categoria: "Calistenia",
    daysPerWeek: 4,
    minsPerSession: 50,
    gradient: "linear-gradient(160deg, #a970ff55, #4c1d9522)",
  },
  {
    id: "lib-calistenia-skills",
    nombre: "Habilidades de Suelo",
    contexto: "Parque / Sin equipo · 5 días/semana",
    categoria: "Calistenia",
    daysPerWeek: 5,
    minsPerSession: 60,
    gradient: "linear-gradient(160deg, #f6c74455, #92400e22)",
  },
  {
    id: "lib-en-casa-minimo",
    nombre: "Casa Sin Excusas",
    contexto: "Mancuernas ajustables · 3 días/semana",
    categoria: "En casa",
    daysPerWeek: 3,
    minsPerSession: 35,
    gradient: "linear-gradient(160deg, #22d3ee55, #0e749222)",
  },
  {
    id: "lib-funcional-atletico",
    nombre: "Atlético Funcional",
    contexto: "Gimnasio funcional · 4 días/semana",
    categoria: "Funcional",
    daysPerWeek: 4,
    minsPerSession: 55,
    gradient: "linear-gradient(160deg, #fb923c55, #7c2d1222)",
  },
];

export const PLAN_LIBRARY_CATEGORIES = Array.from(new Set(LIBRARY_PLANS.map((p) => p.categoria)));
