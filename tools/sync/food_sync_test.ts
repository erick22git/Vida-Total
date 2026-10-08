// Pruebas de la sincronización de alimentos propios: ida y vuelta sin pérdida, 0 vs «sin dato», fusión con datos locales más
// nuevos, columnas ausentes en el servidor y que nada pone «verificado» en verdadero.
// Ejecutar: node tools/3d/verify/run_ts.mjs tools/sync/food_sync_test.ts
import { foodToRow, isMissingExtraColumnError, mergeFood, mergeFoodLists, packExtra, patchToRow, rowToFood, stripExtraColumns, writeWithColumnFallback, type CustomFoodRow } from "../../src/lib/sync/food-sync-map";
import type { Food } from "../../src/lib/types";

let fails = 0;
let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) {
    fails++;
    console.log(`  ✗ ${msg}`);
  }
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const asRec = (v: unknown) => v as Record<string, unknown>;

const rico: Food = {
  id: "11111111-1111-4111-8111-111111111111", nombre: "Arroz", categoria: "Granos", porcion: "100 g", pesoGramos: 100,
  calorias: 360, proteina: 7, carbos: 80, grasas: 0.6, fibra: 1.3, grasasTrans: 0, azucares: 0.1,
  grasasMonoinsaturadas: 0.2, grasasPoliinsaturadas: 0.2, omega3Ala: 0, omega6Linoleico: 0.1, agua: 12, ceniza: 0.6, alcohol: 0, epa: 0, dha: 0,
  micronutrientes: { hierro: 0.8, yodo: 0, biotina: 3 },
  cocido: { calorias: 130, proteina: 2.7, carbos: 28, grasas: 0.3, fibra: 0.4, grasasTrans: 0, micronutrientes: { hierro: 0.2 }, fdcId: 169756 },
  verificado: false, configurado: true, estadoDefault: "cocido", unSoloEstado: false, fdcIdCrudo: 168878,
  creadoPorUsuario: true, actualizadoEn: Date.parse("2026-10-08T10:00:00Z"),
};

// ── ida y vuelta ──────────────────────────────────────────────
const row = foodToRow(rico, "u1");
const back = rowToFood(row);
ok(same(back.cocido, rico.cocido), "el perfil cocido (con fdcId) viaja de ida y vuelta");
ok(back.verificado === false && back.configurado === true && back.estadoDefault === "cocido" && back.unSoloEstado === false && back.fdcIdCrudo === 168878, "verificado, configurado, estadoDefault, unSoloEstado y fdcIdCrudo viajan");
ok(back.grasasMonoinsaturadas === 0.2 && back.agua === 12 && back.ceniza === 0.6, "grasas mono/poli, agua y ceniza viajan");
ok(back.grasasTrans === 0 && back.omega3Ala === 0 && back.alcohol === 0 && back.epa === 0 && back.micronutrientes?.yodo === 0, "un 0 real sigue siendo 0 (columna, perfil extra y micronutrientes)");
ok(back.actualizadoEn === rico.actualizadoEn, "la fecha de edición viaja");
const sinDato: Food = { ...rico, grasasTrans: undefined, alcohol: undefined, grasasSaturadas: undefined };
const rowSD = foodToRow(sinDato, "u1");
ok(rowSD.grasas_trans === null && rowSD.grasas_saturadas === null && !("alcohol" in (rowSD.perfil_extra ?? {})), "«sin dato» queda null / se omite, no 0");
const backSD = rowToFood(rowSD);
ok(backSD.grasasTrans === undefined && backSD.alcohol === undefined && backSD.grasasSaturadas === undefined, "«sin dato» vuelve como undefined");
const sinExtras: Food = { ...rico, cocido: undefined, verificado: undefined, configurado: undefined, estadoDefault: undefined, unSoloEstado: undefined, fdcIdCrudo: undefined, grasasMonoinsaturadas: undefined, grasasPoliinsaturadas: undefined, omega3Ala: undefined, omega6Linoleico: undefined, agua: undefined, ceniza: undefined, alcohol: undefined, epa: undefined, dha: undefined };
ok(packExtra(sinExtras) === null, "sin nada extra → perfil_extra null");

// ── fila antigua (servidor sin la migración) ──────────────────
const legacy = stripExtraColumns(row) as CustomFoodRow;
const fromLegacy = rowToFood(legacy);
ok(fromLegacy.cocido === undefined && fromLegacy.verificado === undefined && fromLegacy.actualizadoEn === undefined && fromLegacy.nombre === "Arroz", "una fila sin las columnas nuevas se lee sin romper");

// ── nada pone «verificado» en verdadero ───────────────────────
ok(rowToFood({ ...row, perfil_extra: null }).verificado === undefined, "sin perfil_extra: verificado queda sin definir");
ok(mergeFood({ ...rico, verificado: false }, { ...rico, verificado: undefined }).verificado === false, "la fusión no convierte false/undefined en true");
ok(mergeFood({ ...rico, verificado: undefined }, { ...rico, verificado: undefined }).verificado !== true, "sin verificar en ninguno → no verificado");

// ── fusión: hidratar sobre datos locales más nuevos ───────────
const remotoViejo: Food = { id: rico.id, nombre: "Arroz (viejo)", categoria: "Granos", porcion: "100 g", calorias: 350, proteina: 6, carbos: 79, grasas: 0.5, creadoPorUsuario: true, actualizadoEn: Date.parse("2026-10-01T00:00:00Z") };
const localNuevo: Food = { ...rico, nombre: "Arroz blanco", calorias: 360 };
const m1 = mergeFood(remotoViejo, localNuevo);
ok(m1.nombre === "Arroz blanco" && m1.calorias === 360, "local más nuevo gana los campos en conflicto");
ok(same(m1.cocido, rico.cocido) && m1.fibra === 1.3 && m1.grasasTrans === 0, "y conserva cocido, fibra y el 0 que el remoto no tenía");

const remotoNuevo: Food = { ...remotoViejo, nombre: "Arroz (editado en otro celular)", calorias: 355, actualizadoEn: Date.parse("2026-10-09T00:00:00Z") };
const localViejo: Food = { ...rico, actualizadoEn: Date.parse("2026-10-02T00:00:00Z") };
const m2 = mergeFood(remotoNuevo, localViejo);
ok(m2.nombre === "Arroz (editado en otro celular)" && m2.calorias === 355, "remoto más nuevo gana los conflictos");
ok(same(m2.cocido, rico.cocido) && m2.verificado === false, "pero el cocido local no se pierde");
ok(m2.actualizadoEn === Date.parse("2026-10-09T00:00:00Z"), "la fecha resultante es la más nueva");

// Un dato remoto vacío nunca pisa uno local.
const remotoVacio: Food = { ...remotoViejo, fibra: undefined, cocido: undefined };
ok(mergeFood(remotoVacio, localNuevo).fibra === 1.3 && mergeFood(remotoVacio, localNuevo).cocido !== undefined, "remoto vacío no pisa el local");
// Un dato local vacío tampoco pierde el remoto.
ok(mergeFood({ ...remotoViejo, cocido: rico.cocido }, { ...localNuevo, cocido: undefined }).cocido !== undefined, "local vacío no borra el remoto");
// Dentro de micronutrientes se fusiona por clave.
const mm = mergeFood({ ...remotoViejo, micronutrientes: { calcio: 9 } }, { ...localNuevo, micronutrientes: { hierro: 0.8 } });
ok(mm.micronutrientes?.calcio === 9 && mm.micronutrientes?.hierro === 0.8, "micronutrientes se fusionan por clave");

const lists = mergeFoodLists([remotoViejo, { ...remotoViejo, id: "r-solo" }], [localNuevo, { ...localNuevo, id: "l-solo" }]);
ok(lists.merged.length === 3 && lists.localOnly.length === 1 && lists.localOnly[0].id === "l-solo", "listas: 1 en ambos, 1 solo remoto, 1 solo local");
ok(lists.needsPush.length === 1 && lists.needsPush[0].id === rico.id, "lo que la fusión trae de más se marca para subir");
ok(mergeFoodLists([rico], [rico]).needsPush.length === 0, "iguales: nada que subir");

// ── patch parcial y fila completa ─────────────────────────────
const p = patchToRow({ nombre: "X", grasasTrans: undefined, calorias: 10 });
ok(p.nombre === "X" && p.grasas_trans === null && p.calorias === 10 && !("perfil_extra" in p), "patch parcial: campo borrado → null; sin perfil_extra");
const pf = patchToRow({}, rico);
ok("perfil_extra" in pf && "updated_at" in pf && !("id" in pf) && !("user_id" in pf) && pf.grasas_trans === 0, "con el alimento fusionado se manda la fila completa");
const pn = patchToRow({ calorias: undefined });
ok(!("calorias" in pn), "una columna obligatoria nunca se manda null");

// ── columnas ausentes en el servidor ──────────────────────────
ok(isMissingExtraColumnError("Could not find the 'perfil_extra' column of 'custom_foods' in the schema cache"), "detecta el error de PostgREST");
ok(isMissingExtraColumnError('column "updated_at" of relation "custom_foods" does not exist'), "detecta el error de Postgres");
ok(!isMissingExtraColumnError("duplicate key value violates unique constraint") && !isMissingExtraColumnError(null), "no confunde otros errores");

async function fallbackTests() {
  const calls: Array<Record<string, unknown>> = [];
  const warns: string[] = [];
  const state = { supported: null as boolean | null };
  const exec = async (r: Record<string, unknown>) => {
    calls.push(r);
    return "perfil_extra" in r ? { error: { message: "Could not find the 'perfil_extra' column of 'custom_foods' in the schema cache" } } : { error: null };
  };
  const r1 = await writeWithColumnFallback(exec, asRec(foodToRow(rico, "u1")), state, (m) => warns.push(m));
  ok(r1.error === null && r1.usedFallback && calls.length === 2 && !("perfil_extra" in calls[1]) && !("updated_at" in calls[1]), "sin columnas: reintenta sin ellas y guarda");
  ok(state.supported === false && warns.length === 1, "recuerda que no existen y avisa una vez");
  const r2 = await writeWithColumnFallback(exec, asRec(foodToRow(rico, "u1")), state, (m) => warns.push(m));
  ok(r2.error === null && calls.length === 3 && !("perfil_extra" in calls[2]) && warns.length === 1, "la siguiente escritura va directo sin ellas (sin volver a avisar)");

  const calls2: Array<Record<string, unknown>> = [];
  const state2 = { supported: null as boolean | null };
  const r3 = await writeWithColumnFallback(async (r) => (calls2.push(r), { error: null }), asRec(foodToRow(rico, "u1")), state2);
  ok(r3.error === null && !r3.usedFallback && calls2.length === 1 && state2.supported === true && "perfil_extra" in calls2[0], "con las columnas: una sola escritura completa");

  const calls3: unknown[] = [];
  const r4 = await writeWithColumnFallback(async (r) => (calls3.push(r), { error: { message: "violates row-level security policy" } }), asRec(foodToRow(rico, "u1")), { supported: null });
  ok(r4.error?.message.includes("row-level") === true && calls3.length === 1 && !r4.usedFallback, "otro error no se reintenta y se devuelve");

  console.log(fails === 0 ? `OK — ${checks} comprobaciones` : `FALLÓ — ${fails} de ${checks}`);
  process.exit(fails === 0 ? 0 : 1);
}
fallbackTests();
