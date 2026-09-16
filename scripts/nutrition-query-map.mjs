// Bloque 3/8: mapa manual id-de-alimento -> query en inglés (o fdcId fijo)
// para buscar en USDA FoodData Central (base en inglés, no indexa bien
// nombres en español). `null` = no tiene un equivalente genérico razonable
// en USDA (plato compuesto/regional) — queda marcado "estimado"/revisión
// manual, sin tocar el dato actual.
//
// Valor `{ fdcId }`: para alimentos donde ninguna query de texto es lo
// bastante específica para evitar un mal match de forma confiable (Bloque
// 8 encontró varios: "pan blanco" traía harina cruda, "arroz blanco"
// traía la variedad glutinosa/pegajosa, "champiñones" traía shiitake en
// vez del champiñón blanco común, "empanada" traía frijoles horneados) —
// se fija el fdcId exacto ya verificado a mano en vez de depender de la
// heurística de búsqueda.
export const USDA_QUERY_MAP = {
  "pechuga-pollo": "chicken breast grilled cooked",
  "arroz-blanco": { fdcId: 169753 }, // "Rice, white, long-grain, regular, cooked, enriched, with salt" — antes traía la variedad "glutinous" (pegajosa), que no es el arroz blanco común
  "arroz-integral": "rice brown cooked",
  "crema-arroz": "cream of rice cooked",
  huevo: "egg whole raw",
  "clara-huevo": "egg white raw",
  avena: "oats rolled dry",
  platano: "banana raw",
  // USDA no tiene una entrada "Apples, raw" genérica sin variedad — solo
  // variedades específicas (fuji, gala, honeycrisp, granny smith, red
  // delicious, golden delicious...). Fuji se queda como proxy razonable:
  // las variedades comunes varían entre sí por ~10%, mucho menos que el
  // umbral de corrección del 15%. La app no distingue variedades de
  // manzana, así que no hay una opción "más correcta" sin agregar esa
  // distinción al modelo de datos.
  manzana: "apples fuji with skin raw",
  naranja: "oranges raw navel",
  fresas: "strawberries raw",
  palta: "avocado raw",
  "pan-integral": "bread whole wheat",
  "pan-blanco": { fdcId: 174924 }, // "Bread, white, commercially prepared (includes soft bread crumbs)" — antes traía HARINA cruda ("Flour, bread, white..."), no pan horneado
  "tortilla-maiz": "tortilla corn",
  "papa-cocida": "potato boiled",
  camote: "sweet potato cooked boiled",
  "carne-molida": "beef ground 90% lean raw",
  "lomo-cerdo": { fdcId: 167842 }, // "Pork, fresh, loin, top loin (roasts), boneless, separable lean and fat, cooked, roasted" — antes traía datos CRUDOS ("Pork, loin, boneless, raw"), pero el alimento se sirve cocido
  salmon: "salmon atlantic raw",
  "atun-lata": "tuna canned in water",
  merluza: null, // "hake" no existe como entrada propia en USDA (no es un pescado común en EE.UU.) — las búsquedas devuelven coincidencias irrelevantes (p.ej. tocino horneado)
  tofu: "tofu firm raw",
  lentejas: "lentils cooked boiled",
  garbanzos: "chickpeas cooked boiled",
  "frijoles-negros": "black beans cooked boiled",
  "leche-entera": "milk whole fluid 3.25",
  "leche-descremada": "milk nonfat skim",
  "yogur-griego": "yogurt greek plain",
  "yogur-natural": "yogurt plain whole milk",
  "queso-fresco": "cheese fresh queso fresco",
  "queso-cottage": "cottage cheese",
  almendras: "almonds raw",
  nueces: "walnuts raw",
  mani: "peanuts raw",
  "mantequilla-mani": "peanut butter",
  "aceite-oliva": "olive oil salad cooking",
  brocoli: "broccoli cooked boiled",
  espinaca: "spinach cooked boiled",
  lechuga: "lettuce raw",
  tomate: "tomato raw",
  zanahoria: "carrots raw",
  pepino: "cucumber raw",
  cebolla: "onion raw",
  pimiento: "peppers sweet red raw",
  choclo: "corn sweet yellow cooked",
  quinua: "quinoa cooked",
  pasta: "pasta cooked enriched",
  "pan-pita": "pita bread whole wheat",
  granola: "granola",
  chia: "chia seeds dried",
  linaza: "flaxseed",
  "chocolate-negro": "chocolate dark 70-85% cacao",
  "barra-proteina": null,
  "proteina-whey": null,
  pizza: "pizza cheese regular crust",
  hamburguesa: "hamburger single patty plain",
  "papas-fritas": "french fries fast food",
  "ensalada-cesar": null, // "salad caesar with chicken" solo devuelve el aderezo (Salad dressing, caesar) o productos de marca (McDonald's) — sin equivalente genérico confiable
  "sushi-rolls": "sushi california roll",
  "lomo-saltado": null,
  ceviche: null,
  "aji-gallina": null,
  "caldo-gallina": "chicken soup with rice",
  "tallarines-verdes": null,
  "arroz-con-pollo": "chicken and rice",
  "pollo-a-la-brasa": "chicken roasted whole",
  "jugo-naranja": null, // USDA no tiene un "orange juice, raw" genérico limpio — las búsquedas devuelven cáscara de naranja o baby food
  gaseosa: "cola carbonated beverage",
  cerveza: "beer regular",
  "cafe-negro": "coffee brewed black",
  "cafe-leche": null, // "café con leche" no tiene un equivalente genérico confiable en USDA (las búsquedas devuelven productos irrelevantes: dulces, sustitutos, etc.) — requiere revisión manual
  "pan-con-palta": null,
  "pan-con-huevo": null,
  "tostadas-francesas": "french toast",
  panqueques: "pancakes plain",
  omelette: "omelet egg and cheese",
  "smoothie-frutas": "smoothie fruit",
  "ensalada-frutas": "fruit salad",
  palomitas: "popcorn air popped",
  "galletas-integrales": "crackers whole wheat",
  "yogur-frutas": "yogurt fruit lowfat",
  "quinua-ensalada": null,
  "wrap-pollo": null,
  "sopa-verduras": "soup vegetable chunky ready to serve",
  "pescado-frito": "fish fried",
  anticuchos: null,
  tamal: null,
  empanada: { fdcId: 167660 }, // "Restaurant, Latino, empanadas, beef, prepared" — match directo real; antes la query traía "Beans, baked, canned, with beef" (completamente distinto)
  "causa-rellena": null,
  "papa-a-la-huancaina": null,
  "choclo-con-queso": null,
  helado: "ice cream vanilla",
  "torta-chocolate": "cake chocolate",
  gelatina: "gelatin dessert prepared water",
  miel: "honey",
  mermelada: "jam preserves",
  "leche-almendras": "almond milk unsweetened",
  "leche-avena": "oat milk",
  edamame: "edamame frozen prepared",
  hummus: "hummus",
  aceitunas: null, // la búsqueda sigue trayendo tomate enlatado antes que las aceitunas reales (USDA FDC #169094/#169095) por la heurística de preferir Foundation — requiere revisión manual o forzar el fdcId a mano
  pepinillo: "pickles cucumber",
  champinones: { fdcId: 168537 }, // "Mushrooms, white, cooked, boiled, drained, with salt" — el champiñón blanco común, no shiitake (lo que traía la query de texto). "Salteados" implica algo de aceite que esta entrada (hervido) no captura — igual es mucho más cercano que la especie equivocada.
  berenjena: "eggplant cooked",
  calabaza: "squash winter cooked",
};
