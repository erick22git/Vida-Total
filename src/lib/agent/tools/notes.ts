/** Herramientas del agente: notas (páginas del Workspace de Hábitos). Solo metadatos y validación. */
import { asArgs, isErr, optText, reqString, type Args, type ToolMeta, type Validation } from "./meta";

const fail = (error: string): Validation => ({ ok: false, error });
export const MAX_CHECK_ITEMS = 20;

function checklist(a: Args, key: string): string[] | { error: string } | undefined {
  const v = a[key];
  if (v === undefined || v === null) return undefined;
  if (!Array.isArray(v) || v.length > MAX_CHECK_ITEMS || v.some((s) => typeof s !== "string" || !s.trim() || s.length > 200)) {
    return { error: `"${key}" debe ser una lista de hasta ${MAX_CHECK_ITEMS} textos cortos.` };
  }
  return (v as string[]).map((s) => s.trim());
}

export const NOTE_TOOLS: ToolMeta[] = [
  {
    name: "note_list",
    module: "notas",
    label: "Ver notas",
    description: "Lista las notas del usuario (título y un fragmento, máx. 20), o busca por texto.",
    kind: "read",
    exposed: true,
    taints: true,
    parameters: {
      type: "object",
      properties: { buscar: { type: "string", description: "Texto a buscar en título o contenido." } },
      additionalProperties: false,
    },
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const q = optText(a, "buscar", 100);
      if (isErr(q)) return fail(q.error);
      return { ok: true, args: q ? { buscar: q } : {} };
    },
  },
  {
    name: "note_create",
    module: "notas",
    label: "Crear nota",
    description: "Crea una nota con título, texto opcional y una lista de checks opcional.",
    kind: "write",
    exposed: true,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        text: { type: "string" },
        checklist: { type: "array", items: { type: "string" } },
      },
      required: ["title"],
      additionalProperties: false,
    },
    batchSize: (a) => 1 + (Array.isArray(a.checklist) ? a.checklist.length : 0),
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const title = reqString(a, "title", 120);
      if (isErr(title)) return fail(title.error);
      const text = optText(a, "text", 5000);
      if (isErr(text)) return fail(text.error);
      const list = checklist(a, "checklist");
      if (list && !Array.isArray(list)) return fail(list.error);
      return { ok: true, args: { title, ...(text ? { text } : {}), ...(list && list.length ? { checklist: list } : {}) } };
    },
  },
  {
    name: "note_update",
    module: "notas",
    label: "Editar nota",
    description: "Cambia el título de una nota o le agrega texto / checks al final (no borra lo que ya tiene).",
    kind: "write",
    exposed: true,
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        appendText: { type: "string" },
        appendChecklist: { type: "array", items: { type: "string" } },
      },
      required: ["id"],
      additionalProperties: false,
    },
    batchSize: (a) => 1 + (Array.isArray(a.appendChecklist) ? a.appendChecklist.length : 0),
    validate: (raw) => {
      const a = asArgs(raw);
      if (!a) return fail("Argumentos inválidos.");
      const id = reqString(a, "id", 80);
      if (isErr(id)) return fail(id.error);
      const out: Args = { id };
      if (a.title !== undefined) {
        const t = reqString(a, "title", 120);
        if (isErr(t)) return fail(t.error);
        out.title = t;
      }
      const text = optText(a, "appendText", 5000);
      if (isErr(text)) return fail(text.error);
      if (text) out.appendText = text;
      const list = checklist(a, "appendChecklist");
      if (list && !Array.isArray(list)) return fail(list.error);
      if (list && list.length) out.appendChecklist = list;
      if (Object.keys(out).length === 1) return fail("No hay nada que cambiar.");
      return { ok: true, args: out };
    },
  },
];
