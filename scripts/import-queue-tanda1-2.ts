/** Cola de importación masiva — Fase 2 (Tanda 1 + Tanda 2, 182 alimentos aprobados). Cada entrada: id
 * (slug), nombre (español, para la UI), categoria, tanda (1|2), queryCrudo (término de búsqueda en
 * inglés para USDA, estado base/crudo), queryCocido (opcional: término para el estado cocido, si
 * aplica), unSoloEstado (true = no tiene sentido crudo/cocido separado), estadoDefault.
 */
export interface QueueItem {
  id: string;
  nombre: string;
  categoria: string;
  tanda: 1 | 2;
  queryCrudo: string;
  queryCocido?: string;
  unSoloEstado?: boolean;
  estadoDefault?: "crudo" | "cocido";
}

export const QUEUE: QueueItem[] = [
  // ───────────── Proteínas — Tanda 1 ─────────────
  { id: "jamon", nombre: "Jamón cocido", categoria: "Proteína", tanda: 1, queryCrudo: "ham, sliced, regular", unSoloEstado: true, estadoDefault: "cocido" },
  { id: "tocino", nombre: "Tocino", categoria: "Proteína", tanda: 1, queryCrudo: "bacon, pork, raw", queryCocido: "bacon, pork, cooked" },
  { id: "salchicha", nombre: "Salchicha / hot dog", categoria: "Proteína", tanda: 1, queryCrudo: "frankfurter, beef and pork", unSoloEstado: true },
  { id: "chorizo", nombre: "Chorizo", categoria: "Proteína", tanda: 1, queryCrudo: "sausage, chorizo, pork and beef", unSoloEstado: true },
  { id: "mortadela", nombre: "Mortadela", categoria: "Proteína", tanda: 1, queryCrudo: "mortadella, beef and pork", unSoloEstado: true },
  { id: "chuleta-cerdo", nombre: "Chuleta de cerdo", categoria: "Proteína", tanda: 1, queryCrudo: "pork, chop, raw", queryCocido: "pork, chop, cooked, broiled" },
  { id: "costilla-cerdo", nombre: "Costilla de cerdo", categoria: "Proteína", tanda: 1, queryCrudo: "pork, spareribs, raw", queryCocido: "pork, spareribs, cooked, braised" },
  { id: "bistec-res", nombre: "Bistec de res", categoria: "Proteína", tanda: 1, queryCrudo: "beef, round, steak, raw", queryCocido: "beef, round, steak, cooked, grilled" },
  { id: "carne-molida-res", nombre: "Carne molida de res (grasa estándar)", categoria: "Proteína", tanda: 1, queryCrudo: "beef, ground, 80% lean meat / 20% fat, raw", queryCocido: "beef, ground, 80% lean meat / 20% fat, cooked, pan-broiled" },
  { id: "higado-res", nombre: "Hígado de res", categoria: "Proteína", tanda: 1, queryCrudo: "beef, liver, raw", queryCocido: "beef, liver, cooked, pan-fried" },
  { id: "trucha", nombre: "Trucha", categoria: "Proteína", tanda: 1, queryCrudo: "fish, trout, rainbow, raw", queryCocido: "fish, trout, rainbow, cooked, dry heat" },
  { id: "tilapia", nombre: "Tilapia", categoria: "Proteína", tanda: 1, queryCrudo: "fish, tilapia, raw", queryCocido: "fish, tilapia, cooked, dry heat" },
  { id: "sardina-lata", nombre: "Sardina en lata", categoria: "Proteína", tanda: 1, queryCrudo: "fish, sardine, canned in oil, drained", unSoloEstado: true },
  { id: "atun-aceite", nombre: "Atún en aceite", categoria: "Proteína", tanda: 1, queryCrudo: "fish, tuna, canned in oil, drained", unSoloEstado: true },
  { id: "camaron", nombre: "Camarón", categoria: "Proteína", tanda: 1, queryCrudo: "shrimp, raw", queryCocido: "shrimp, cooked, moist heat" },
  { id: "calamar", nombre: "Calamar", categoria: "Proteína", tanda: 1, queryCrudo: "mollusks, squid, mixed species, raw", queryCocido: "mollusks, squid, mixed species, cooked, fried" },
  { id: "pollo-frito-presa", nombre: "Pollo frito (presa)", categoria: "Proteína", tanda: 1, queryCrudo: "chicken, broiler, thigh, meat and skin, cooked, fried, batter", unSoloEstado: true, estadoDefault: "cocido" },
  { id: "alitas-pollo", nombre: "Alitas de pollo", categoria: "Proteína", tanda: 1, queryCrudo: "chicken, broiler, wing, meat and skin, raw", queryCocido: "chicken, broiler, wing, meat and skin, cooked, roasted" },
  { id: "pollo-entero-asado", nombre: "Pollo entero asado", categoria: "Proteína", tanda: 1, queryCrudo: "chicken, broiler, whole, meat and skin, cooked, roasted", unSoloEstado: true, estadoDefault: "cocido" },
  { id: "huevo-codorniz", nombre: "Huevo de codorniz", categoria: "Proteína", tanda: 1, queryCrudo: "egg, quail, whole, raw", unSoloEstado: true },

  // ───────────── Proteínas — Tanda 2 ─────────────
  { id: "pavo-pechuga", nombre: "Pechuga de pavo", categoria: "Proteína", tanda: 2, queryCrudo: "turkey, breast, meat only, raw", queryCocido: "turkey, breast, meat only, cooked, roasted" },
  { id: "pato", nombre: "Pato", categoria: "Proteína", tanda: 2, queryCrudo: "duck, domesticated, meat and skin, raw", queryCocido: "duck, domesticated, meat and skin, cooked, roasted" },
  { id: "conejo", nombre: "Conejo", categoria: "Proteína", tanda: 2, queryCrudo: "rabbit, domesticated, composite, raw", queryCocido: "rabbit, domesticated, composite, cooked, roasted" },
  { id: "bacalao", nombre: "Bacalao", categoria: "Proteína", tanda: 2, queryCrudo: "fish, cod, atlantic, raw", queryCocido: "fish, cod, atlantic, cooked, dry heat" },
  { id: "pulpo", nombre: "Pulpo", categoria: "Proteína", tanda: 2, queryCrudo: "mollusks, octopus, common, raw", queryCocido: "mollusks, octopus, common, cooked, moist heat" },
  { id: "mejillones", nombre: "Mejillones", categoria: "Proteína", tanda: 2, queryCrudo: "mollusks, mussel, blue, raw", queryCocido: "mollusks, mussel, blue, cooked, moist heat" },
  { id: "habas-cocidas", nombre: "Habas cocidas", categoria: "Legumbre", tanda: 2, queryCrudo: "broadbeans, mature seeds, raw", queryCocido: "broadbeans, mature seeds, cooked, boiled" },
  { id: "arvejas-secas", nombre: "Arvejas / guisantes secos", categoria: "Legumbre", tanda: 2, queryCrudo: "peas, mature seeds, split, raw", queryCocido: "peas, mature seeds, split, cooked, boiled" },
  { id: "soya-texturizada", nombre: "Soya texturizada", categoria: "Proteína", tanda: 2, queryCrudo: "soy protein concentrate, produced by acid wash", unSoloEstado: true },
  { id: "seitan", nombre: "Seitán", categoria: "Proteína", tanda: 2, queryCrudo: "seitan", unSoloEstado: true },
  { id: "proteina-soya-polvo", nombre: "Proteína de soya en polvo", categoria: "Suplemento", tanda: 2, queryCrudo: "soy protein isolate", unSoloEstado: true },
  { id: "pate", nombre: "Paté", categoria: "Proteína", tanda: 2, queryCrudo: "pate, liver, not specified", unSoloEstado: true },
  { id: "salami", nombre: "Salami", categoria: "Proteína", tanda: 2, queryCrudo: "salami, pork and beef", unSoloEstado: true },
  { id: "longaniza", nombre: "Longaniza", categoria: "Proteína", tanda: 2, queryCrudo: "sausage, pork, fresh, cooked", unSoloEstado: true, estadoDefault: "cocido" },

  // ───────────── Lácteos — Tanda 1 ─────────────
  { id: "leche-soya", nombre: "Leche de soya", categoria: "Lácteo vegetal", tanda: 1, queryCrudo: "soymilk, unsweetened", unSoloEstado: true },
  { id: "leche-condensada", nombre: "Leche condensada", categoria: "Lácteo", tanda: 1, queryCrudo: "milk, condensed, sweetened, canned", unSoloEstado: true },
  { id: "leche-evaporada", nombre: "Leche evaporada", categoria: "Lácteo", tanda: 1, queryCrudo: "milk, evaporated, canned", unSoloEstado: true },
  { id: "crema-leche", nombre: "Crema de leche", categoria: "Lácteo", tanda: 1, queryCrudo: "cream, heavy whipping", unSoloEstado: true },
  { id: "queso-crema", nombre: "Queso crema", categoria: "Lácteo", tanda: 1, queryCrudo: "cheese, cream", unSoloEstado: true },
  { id: "requeson", nombre: "Requesón", categoria: "Lácteo", tanda: 1, queryCrudo: "cheese, ricotta, whole milk", unSoloEstado: true },
  { id: "queso-cheddar", nombre: "Queso cheddar", categoria: "Lácteo", tanda: 1, queryCrudo: "cheese, cheddar", unSoloEstado: true },

  // ───────────── Lácteos — Tanda 2 ─────────────
  { id: "queso-suizo", nombre: "Queso suizo / gruyère", categoria: "Lácteo", tanda: 2, queryCrudo: "cheese, swiss", unSoloEstado: true },
  { id: "queso-crema-light", nombre: "Queso crema light", categoria: "Lácteo", tanda: 2, queryCrudo: "cheese, cream, fat free", unSoloEstado: true },
  { id: "leche-polvo", nombre: "Leche en polvo", categoria: "Lácteo", tanda: 2, queryCrudo: "milk, dry, whole", unSoloEstado: true },
  { id: "yogur-bebible", nombre: "Yogur bebible", categoria: "Lácteo", tanda: 2, queryCrudo: "yogurt, fruit, drink", unSoloEstado: true },
  { id: "kefir", nombre: "Kéfir", categoria: "Lácteo", tanda: 2, queryCrudo: "kefir, low fat milk", unSoloEstado: true },

  // ───────────── Granos y cereales — Tanda 1 ─────────────
  { id: "cereal-caja", nombre: "Cereal de caja (hojuelas de maíz)", categoria: "Cereal", tanda: 1, queryCrudo: "cereals ready-to-eat, corn flakes", unSoloEstado: true },
  { id: "avena-instantanea", nombre: "Avena instantánea", categoria: "Cereal", tanda: 1, queryCrudo: "cereals, oats, instant, fortified, plain, dry", unSoloEstado: true },
  { id: "trigo-grano", nombre: "Trigo (grano entero)", categoria: "Cereal", tanda: 1, queryCrudo: "wheat, hard red winter", unSoloEstado: true },
  { id: "cebada", nombre: "Cebada", categoria: "Cereal", tanda: 1, queryCrudo: "barley, pearled, raw", queryCocido: "barley, pearled, cooked" },
  { id: "centeno", nombre: "Centeno", categoria: "Cereal", tanda: 1, queryCrudo: "rye, grain", unSoloEstado: true },
  { id: "harina-trigo", nombre: "Harina de trigo", categoria: "Cereal", tanda: 1, queryCrudo: "wheat flour, white, all-purpose, enriched", unSoloEstado: true },
  { id: "pan-integral-molde", nombre: "Pan integral de molde", categoria: "Cereal", tanda: 1, queryCrudo: "bread, whole-wheat, commercially prepared", unSoloEstado: true },
  { id: "arroz-basmati", nombre: "Arroz basmati", categoria: "Cereal", tanda: 1, queryCrudo: "rice, basmati, raw", queryCocido: "rice, basmati, cooked" },
  { id: "arroz-jazmin", nombre: "Arroz jazmín", categoria: "Cereal", tanda: 1, queryCrudo: "rice, white, long-grain, jasmine, raw", queryCocido: "rice, white, long-grain, jasmine, cooked" },
  { id: "maicena", nombre: "Maicena", categoria: "Cereal", tanda: 1, queryCrudo: "cornstarch", unSoloEstado: true },

  // ───────────── Granos y cereales — Tanda 2 ─────────────
  { id: "couscous", nombre: "Couscous", categoria: "Cereal", tanda: 2, queryCrudo: "couscous, dry", queryCocido: "couscous, cooked" },
  { id: "bulgur", nombre: "Bulgur", categoria: "Cereal", tanda: 2, queryCrudo: "wheat, bulgur, dry", queryCocido: "wheat, bulgur, cooked" },
  { id: "harina-maiz-masa", nombre: "Harina de maíz (masa)", categoria: "Cereal", tanda: 2, queryCrudo: "corn flour, masa, enriched, white", unSoloEstado: true },
  { id: "galletas-soda", nombre: "Galletas soda", categoria: "Snack", tanda: 2, queryCrudo: "crackers, saltines", unSoloEstado: true },
  { id: "tostadas-pan", nombre: "Tostadas (pan)", categoria: "Cereal", tanda: 2, queryCrudo: "bread, white, commercially prepared, toasted", unSoloEstado: true },
  { id: "pan-frances", nombre: "Pan francés / baguette", categoria: "Cereal", tanda: 2, queryCrudo: "bread, french or vienna", unSoloEstado: true },
  { id: "polenta", nombre: "Polenta", categoria: "Cereal", tanda: 2, queryCrudo: "polenta, prepared with water, salt", unSoloEstado: true, estadoDefault: "cocido" },
  { id: "mijo", nombre: "Mijo", categoria: "Cereal", tanda: 2, queryCrudo: "millet, raw", queryCocido: "millet, cooked" },

  // ───────────── Verduras — Tanda 1 ─────────────
  { id: "ajo", nombre: "Ajo", categoria: "Verdura", tanda: 1, queryCrudo: "garlic, raw", unSoloEstado: true },
  { id: "apio", nombre: "Apio", categoria: "Verdura", tanda: 1, queryCrudo: "celery, raw", unSoloEstado: true },
  { id: "rabano", nombre: "Rábano", categoria: "Verdura", tanda: 1, queryCrudo: "radishes, raw", unSoloEstado: true },
  { id: "acelga", nombre: "Acelga", categoria: "Verdura", tanda: 1, queryCrudo: "chard, swiss, raw", queryCocido: "chard, swiss, cooked, boiled" },
  { id: "col-repollo", nombre: "Col / repollo", categoria: "Verdura", tanda: 1, queryCrudo: "cabbage, raw", queryCocido: "cabbage, cooked, boiled" },
  { id: "col-rizada-kale", nombre: "Col rizada (kale)", categoria: "Verdura", tanda: 1, queryCrudo: "kale, raw", queryCocido: "kale, cooked, boiled" },
  { id: "esparragos", nombre: "Espárragos", categoria: "Verdura", tanda: 1, queryCrudo: "asparagus, raw", queryCocido: "asparagus, cooked, boiled" },
  { id: "puerro", nombre: "Puerro", categoria: "Verdura", tanda: 1, queryCrudo: "leeks, raw", queryCocido: "leeks, cooked, boiled" },
  { id: "nabo", nombre: "Nabo", categoria: "Verdura", tanda: 1, queryCrudo: "turnips, raw", queryCocido: "turnips, cooked, boiled" },
  { id: "remolacha", nombre: "Remolacha", categoria: "Verdura", tanda: 1, queryCrudo: "beets, raw", queryCocido: "beets, cooked, boiled" },
  { id: "alcachofa", nombre: "Alcachofa", categoria: "Verdura", tanda: 1, queryCrudo: "artichokes, raw", queryCocido: "artichokes, cooked, boiled" },
  { id: "aji-fresco", nombre: "Ají / chile fresco", categoria: "Verdura", tanda: 1, queryCrudo: "peppers, hot chile, raw", unSoloEstado: true },
  { id: "jicama", nombre: "Jícama", categoria: "Verdura", tanda: 1, queryCrudo: "yambean (jicama), raw", unSoloEstado: true },
  { id: "pepino-fresco", nombre: "Pepino", categoria: "Verdura", tanda: 1, queryCrudo: "cucumber, peeled, raw", unSoloEstado: true },

  // ───────────── Verduras — Tanda 2 ─────────────
  { id: "col-morada", nombre: "Col morada", categoria: "Verdura", tanda: 2, queryCrudo: "cabbage, red, raw", queryCocido: "cabbage, red, cooked, boiled" },
  { id: "hinojo", nombre: "Hinojo", categoria: "Verdura", tanda: 2, queryCrudo: "fennel, bulb, raw", unSoloEstado: true },
  { id: "ruibarbo", nombre: "Ruibarbo", categoria: "Verdura", tanda: 2, queryCrudo: "rhubarb, raw", queryCocido: "rhubarb, cooked, boiled" },
  { id: "brotes-soya", nombre: "Brotes de soya", categoria: "Verdura", tanda: 2, queryCrudo: "soybean sprouts, raw", unSoloEstado: true },
  { id: "cebollin", nombre: "Cebollín / cebolla de verdeo", categoria: "Verdura", tanda: 2, queryCrudo: "onions, spring or scallions, raw", unSoloEstado: true },
  { id: "batata", nombre: "Batata", categoria: "Tubérculo", tanda: 2, queryCrudo: "sweet potato, raw", queryCocido: "sweet potato, cooked, boiled" },
  { id: "palmitos", nombre: "Palmitos", categoria: "Verdura", tanda: 2, queryCrudo: "hearts of palm, canned", unSoloEstado: true },
  { id: "zapallito-italiano", nombre: "Zapallito italiano / zucchini", categoria: "Verdura", tanda: 2, queryCrudo: "squash, summer, zucchini, raw", queryCocido: "squash, summer, zucchini, cooked, boiled" },
  { id: "berro", nombre: "Berro", categoria: "Verdura", tanda: 2, queryCrudo: "watercress, raw", unSoloEstado: true },
  { id: "rabanito-mix", nombre: "Rabanito (variedad daikon)", categoria: "Verdura", tanda: 2, queryCrudo: "radishes, oriental, raw", unSoloEstado: true },
  { id: "chile-poblano", nombre: "Chile poblano", categoria: "Verdura", tanda: 2, queryCrudo: "peppers, hot chile, green, raw", unSoloEstado: true },
  { id: "ocra", nombre: "Ocra / quimbombó", categoria: "Verdura", tanda: 2, queryCrudo: "okra, raw", queryCocido: "okra, cooked, boiled" },

  // ───────────── Frutas — Tanda 1 ─────────────
  { id: "arandanos", nombre: "Arándanos", categoria: "Fruta", tanda: 1, queryCrudo: "blueberries, raw", unSoloEstado: true },
  { id: "kiwi", nombre: "Kiwi", categoria: "Fruta", tanda: 1, queryCrudo: "kiwifruit, green, raw", unSoloEstado: true },
  { id: "durazno", nombre: "Durazno / melocotón", categoria: "Fruta", tanda: 1, queryCrudo: "peaches, raw", unSoloEstado: true },
  { id: "limon", nombre: "Limón", categoria: "Fruta", tanda: 1, queryCrudo: "lemons, raw, without peel", unSoloEstado: true },
  { id: "pomelo", nombre: "Pomelo / toronja", categoria: "Fruta", tanda: 1, queryCrudo: "grapefruit, raw, pink and red", unSoloEstado: true },
  { id: "granada", nombre: "Granada", categoria: "Fruta", tanda: 1, queryCrudo: "pomegranates, raw", unSoloEstado: true },
  { id: "higo", nombre: "Higo", categoria: "Fruta", tanda: 1, queryCrudo: "figs, raw", unSoloEstado: true },
  { id: "papaya", nombre: "Papaya", categoria: "Fruta", tanda: 1, queryCrudo: "papayas, raw", unSoloEstado: true },
  { id: "maracuya", nombre: "Maracuyá", categoria: "Fruta", tanda: 1, queryCrudo: "passion-fruit, (granadilla), purple, raw", unSoloEstado: true },
  { id: "ciruela", nombre: "Ciruela", categoria: "Fruta", tanda: 1, queryCrudo: "plums, raw", unSoloEstado: true },
  { id: "cereza", nombre: "Cereza", categoria: "Fruta", tanda: 1, queryCrudo: "cherries, sweet, raw", unSoloEstado: true },
  { id: "guayaba", nombre: "Guayaba", categoria: "Fruta", tanda: 1, queryCrudo: "guavas, common, raw", unSoloEstado: true },

  // ───────────── Frutas — Tanda 2 ─────────────
  { id: "lima", nombre: "Lima", categoria: "Fruta", tanda: 2, queryCrudo: "limes, raw", unSoloEstado: true },
  { id: "mandarina", nombre: "Mandarina", categoria: "Fruta", tanda: 2, queryCrudo: "tangerines, (mandarin oranges), raw", unSoloEstado: true },
  { id: "chirimoya", nombre: "Chirimoya", categoria: "Fruta", tanda: 2, queryCrudo: "sweetsop, (sugar apple), raw", unSoloEstado: true },
  { id: "tuna-fruta", nombre: "Tuna (fruta de cactus)", categoria: "Fruta", tanda: 2, queryCrudo: "prickly pears, raw", unSoloEstado: true },
  { id: "coco", nombre: "Coco", categoria: "Fruta", tanda: 2, queryCrudo: "coconut meat, raw", unSoloEstado: true },
  { id: "datil", nombre: "Dátil", categoria: "Fruta", tanda: 2, queryCrudo: "dates, medjool", unSoloEstado: true },
  { id: "pasas", nombre: "Pasas", categoria: "Fruta", tanda: 2, queryCrudo: "raisins, seedless", unSoloEstado: true },
  { id: "orejones", nombre: "Orejones (fruta deshidratada)", categoria: "Fruta", tanda: 2, queryCrudo: "apricots, dried, sulfured", unSoloEstado: true },
  { id: "mora", nombre: "Mora", categoria: "Fruta", tanda: 2, queryCrudo: "blackberries, raw", unSoloEstado: true },

  // ───────────── Frutos secos y semillas — Tanda 1 ─────────────
  { id: "pistachos", nombre: "Pistachos", categoria: "Fruto seco", tanda: 1, queryCrudo: "nuts, pistachio nuts, raw", unSoloEstado: true },
  { id: "nuez-brasil", nombre: "Nuez de Brasil", categoria: "Fruto seco", tanda: 1, queryCrudo: "nuts, brazilnuts, dried, unblanched", unSoloEstado: true },
  { id: "nuez-macadamia", nombre: "Nuez de macadamia", categoria: "Fruto seco", tanda: 1, queryCrudo: "nuts, macadamia nuts, raw", unSoloEstado: true },
  { id: "avellanas", nombre: "Avellanas", categoria: "Fruto seco", tanda: 1, queryCrudo: "nuts, hazelnuts or filberts, raw", unSoloEstado: true },
  { id: "piñones", nombre: "Piñones", categoria: "Fruto seco", tanda: 1, queryCrudo: "nuts, pine nuts, dried", unSoloEstado: true },
  { id: "semillas-girasol", nombre: "Semillas de girasol", categoria: "Semilla", tanda: 1, queryCrudo: "seeds, sunflower seed kernels, dried", unSoloEstado: true },

  // ───────────── Frutos secos y semillas — Tanda 2 ─────────────
  { id: "semillas-calabaza", nombre: "Semillas de calabaza / zapallo", categoria: "Semilla", tanda: 2, queryCrudo: "seeds, pumpkin and squash seed kernels, dried", unSoloEstado: true },
  { id: "semillas-sesamo", nombre: "Semillas de sésamo / ajonjolí", categoria: "Semilla", tanda: 2, queryCrudo: "seeds, sesame seeds, whole, dried", unSoloEstado: true },
  { id: "tahini", nombre: "Tahini", categoria: "Grasa", tanda: 2, queryCrudo: "tahini", unSoloEstado: true },
  { id: "mantequilla-almendra", nombre: "Mantequilla de almendra", categoria: "Grasa", tanda: 2, queryCrudo: "nuts, almond butter, plain", unSoloEstado: true },
  { id: "mix-frutos-secos", nombre: "Mix de frutos secos", categoria: "Fruto seco", tanda: 2, queryCrudo: "nuts, mixed nuts, dry roasted, with peanuts", unSoloEstado: true },

  // ───────────── Aceites y grasas — Tanda 1 ─────────────
  { id: "aceite-vegetal", nombre: "Aceite vegetal / girasol", categoria: "Grasa", tanda: 1, queryCrudo: "oil, sunflower, linoleic (less than 60%)", unSoloEstado: true },
  { id: "aceite-coco", nombre: "Aceite de coco", categoria: "Grasa", tanda: 1, queryCrudo: "oil, coconut", unSoloEstado: true },
  { id: "aceite-canola", nombre: "Aceite de canola", categoria: "Grasa", tanda: 1, queryCrudo: "oil, canola", unSoloEstado: true },
  { id: "manteca-cerdo", nombre: "Manteca / lard", categoria: "Grasa", tanda: 1, queryCrudo: "lard", unSoloEstado: true },
  { id: "margarina", nombre: "Margarina", categoria: "Grasa", tanda: 1, queryCrudo: "margarine, regular, 80% fat, composite, stick, with salt", unSoloEstado: true },
  { id: "crema-agria", nombre: "Crema agria / sour cream", categoria: "Grasa", tanda: 1, queryCrudo: "sour cream, cultured", unSoloEstado: true },

  // ───────────── Aceites y grasas — Tanda 2 ─────────────
  { id: "ghee", nombre: "Ghee (mantequilla clarificada)", categoria: "Grasa", tanda: 2, queryCrudo: "ghee, clarified butter", unSoloEstado: true },
  { id: "aceite-sesamo", nombre: "Aceite de sésamo", categoria: "Grasa", tanda: 2, queryCrudo: "oil, sesame, salad or cooking", unSoloEstado: true },
  { id: "grasa-cerdo-tocino", nombre: "Grasa de tocino (bacon fat)", categoria: "Grasa", tanda: 2, queryCrudo: "fat, bacon grease", unSoloEstado: true },
  { id: "mayonesa", nombre: "Mayonesa", categoria: "Grasa", tanda: 2, queryCrudo: "mayonnaise, regular", unSoloEstado: true },
  { id: "mantequilla", nombre: "Mantequilla", categoria: "Grasa", tanda: 2, queryCrudo: "butter, without salt", unSoloEstado: true },

  // ───────────── Condimentos y especias (categoría nueva) — Tanda 1 ─────────────
  { id: "sal", nombre: "Sal", categoria: "Condimento", tanda: 1, queryCrudo: "salt, table", unSoloEstado: true },
  { id: "pimienta-negra", nombre: "Pimienta negra", categoria: "Condimento", tanda: 1, queryCrudo: "spices, pepper, black", unSoloEstado: true },
  { id: "comino", nombre: "Comino", categoria: "Condimento", tanda: 1, queryCrudo: "spices, cumin seed", unSoloEstado: true },
  { id: "oregano", nombre: "Orégano", categoria: "Condimento", tanda: 1, queryCrudo: "spices, oregano, dried", unSoloEstado: true },
  { id: "canela", nombre: "Canela", categoria: "Condimento", tanda: 1, queryCrudo: "spices, cinnamon, ground", unSoloEstado: true },
  { id: "pimenton", nombre: "Pimentón / paprika", categoria: "Condimento", tanda: 1, queryCrudo: "spices, paprika", unSoloEstado: true },
  { id: "ajo-polvo", nombre: "Ajo en polvo", categoria: "Condimento", tanda: 1, queryCrudo: "spices, garlic powder", unSoloEstado: true },
  { id: "cebolla-polvo", nombre: "Cebolla en polvo", categoria: "Condimento", tanda: 1, queryCrudo: "spices, onion powder", unSoloEstado: true },
  { id: "vinagre-blanco", nombre: "Vinagre blanco", categoria: "Condimento", tanda: 1, queryCrudo: "vinegar, distilled", unSoloEstado: true },
  { id: "salsa-soya", nombre: "Salsa de soya", categoria: "Condimento", tanda: 1, queryCrudo: "soy sauce made from soy and wheat (shoyu)", unSoloEstado: true },
  { id: "ketchup", nombre: "Kétchup", categoria: "Condimento", tanda: 1, queryCrudo: "catsup", unSoloEstado: true },
  { id: "mostaza", nombre: "Mostaza", categoria: "Condimento", tanda: 1, queryCrudo: "mustard, prepared, yellow", unSoloEstado: true },
  { id: "salsa-picante", nombre: "Salsa picante", categoria: "Condimento", tanda: 1, queryCrudo: "sauce, ready-to-serve, pepper or hot", unSoloEstado: true },

  // ───────────── Condimentos y especias — Tanda 2 ─────────────
  { id: "laurel", nombre: "Laurel", categoria: "Condimento", tanda: 2, queryCrudo: "spices, bay leaf", unSoloEstado: true },
  { id: "curcuma", nombre: "Cúrcuma", categoria: "Condimento", tanda: 2, queryCrudo: "spices, turmeric, ground", unSoloEstado: true },
  { id: "jengibre-fresco", nombre: "Jengibre fresco", categoria: "Condimento", tanda: 2, queryCrudo: "ginger root, raw", unSoloEstado: true },
  { id: "perejil-fresco", nombre: "Perejil fresco", categoria: "Condimento", tanda: 2, queryCrudo: "parsley, fresh", unSoloEstado: true },
  { id: "cilantro-fresco", nombre: "Cilantro fresco", categoria: "Condimento", tanda: 2, queryCrudo: "coriander (cilantro) leaves, raw", unSoloEstado: true },
  { id: "albahaca-fresca", nombre: "Albahaca fresca", categoria: "Condimento", tanda: 2, queryCrudo: "basil, fresh", unSoloEstado: true },
  { id: "nuez-moscada", nombre: "Nuez moscada", categoria: "Condimento", tanda: 2, queryCrudo: "spices, nutmeg, ground", unSoloEstado: true },
  { id: "vainilla-extracto", nombre: "Vainilla (extracto)", categoria: "Condimento", tanda: 2, queryCrudo: "vanilla extract", unSoloEstado: true },
  { id: "caldo-cubo", nombre: "Caldo en cubo", categoria: "Condimento", tanda: 2, queryCrudo: "soup, bouillon cube, beef or chicken, dry", unSoloEstado: true },
  { id: "aderezo-ranch", nombre: "Aderezo ranch", categoria: "Condimento", tanda: 2, queryCrudo: "salad dressing, ranch dressing, regular", unSoloEstado: true },
  { id: "salsa-bbq", nombre: "Salsa barbacoa", categoria: "Condimento", tanda: 2, queryCrudo: "sauce, barbecue", unSoloEstado: true },

  // ───────────── Bebidas — Tanda 1 ─────────────
  { id: "vino-tinto", nombre: "Vino tinto", categoria: "Bebida", tanda: 1, queryCrudo: "alcoholic beverage, wine, table, red", unSoloEstado: true },
  { id: "cerveza-light", nombre: "Cerveza light", categoria: "Bebida", tanda: 1, queryCrudo: "alcoholic beverage, beer, light", unSoloEstado: true },
  { id: "gaseosa-light", nombre: "Gaseosa light / zero", categoria: "Bebida", tanda: 1, queryCrudo: "carbonated beverage, cola, contains caffeine, diet", unSoloEstado: true },
  { id: "agua-tonica", nombre: "Agua tónica", categoria: "Bebida", tanda: 1, queryCrudo: "carbonated beverage, tonic water", unSoloEstado: true },
  { id: "te-negro", nombre: "Té negro", categoria: "Bebida", tanda: 1, queryCrudo: "tea, black, brewed", unSoloEstado: true },
  { id: "te-verde", nombre: "Té verde", categoria: "Bebida", tanda: 1, queryCrudo: "tea, green, brewed", unSoloEstado: true },
  { id: "jugo-manzana", nombre: "Jugo de manzana", categoria: "Bebida", tanda: 1, queryCrudo: "apple juice, canned or bottled, unsweetened", unSoloEstado: true },
  { id: "energizante", nombre: "Energizante (tipo Red Bull)", categoria: "Bebida", tanda: 1, queryCrudo: "energy drink", unSoloEstado: true },

  // ───────────── Bebidas — Tanda 2 ─────────────
  { id: "jugo-uva", nombre: "Jugo de uva", categoria: "Bebida", tanda: 2, queryCrudo: "grape juice, canned or bottled, unsweetened", unSoloEstado: true },
  { id: "limonada", nombre: "Limonada", categoria: "Bebida", tanda: 2, queryCrudo: "lemonade, frozen concentrate, prepared with water", unSoloEstado: true },
  { id: "horchata", nombre: "Horchata", categoria: "Bebida", tanda: 2, queryCrudo: "rice beverage, horchata", unSoloEstado: true },
  { id: "chicha-morada", nombre: "Chicha morada", categoria: "Bebida", tanda: 2, queryCrudo: "purple corn beverage", unSoloEstado: true },
  { id: "cafe-capuchino", nombre: "Café capuchino", categoria: "Bebida", tanda: 2, queryCrudo: "cappuccino, prepared with whole milk", unSoloEstado: true },
  { id: "mate-coca", nombre: "Mate de coca", categoria: "Bebida", tanda: 2, queryCrudo: "coca tea, infusion", unSoloEstado: true },
  { id: "agua-coco", nombre: "Agua de coco", categoria: "Bebida", tanda: 2, queryCrudo: "coconut water", unSoloEstado: true },

  // ───────────── Endulzantes — Tanda 1 ─────────────
  { id: "azucar-blanca", nombre: "Azúcar blanca", categoria: "Endulzante", tanda: 1, queryCrudo: "sugars, granulated", unSoloEstado: true },
  { id: "azucar-morena", nombre: "Azúcar morena", categoria: "Endulzante", tanda: 1, queryCrudo: "sugars, brown", unSoloEstado: true },
  { id: "stevia", nombre: "Stevia", categoria: "Endulzante", tanda: 1, queryCrudo: "stevia, sweetener, granulated", unSoloEstado: true },
  { id: "panela", nombre: "Panela / chancaca", categoria: "Endulzante", tanda: 1, queryCrudo: "sugars, raw cane", unSoloEstado: true },

  // ───────────── Endulzantes — Tanda 2 ─────────────
  { id: "jarabe-maple", nombre: "Jarabe de maple", categoria: "Endulzante", tanda: 2, queryCrudo: "syrups, maple", unSoloEstado: true },
  { id: "edulcorante-sucralosa", nombre: "Edulcorante artificial (sucralosa)", categoria: "Endulzante", tanda: 2, queryCrudo: "sucralose", unSoloEstado: true },
  { id: "jarabe-maiz", nombre: "Jarabe de maíz alto en fructosa", categoria: "Endulzante", tanda: 2, queryCrudo: "syrups, corn, high-fructose", unSoloEstado: true },
];
