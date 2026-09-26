# Inspección de un .blend (copia de trabajo). Edita PATH antes de enviar (o usa client/inspect_new.py).
# Informa: objetos por tipo, polígonos, materiales, texturas, modificadores, animación, jerarquía, cuerpos por tamaño y
# cualquier pista de origen/licencia (textos, propiedades personalizadas, nombres de imágenes).
import bpy, collections, math
from mathutils import Vector

PATH = "__PATH__"
bpy.ops.wm.open_mainfile(filepath=PATH)
O = bpy.data.objects
dg = bpy.context.evaluated_depsgraph_get()
res = {"file": PATH.split("/")[-1].split("\\")[-1], "version": list(bpy.data.version)}
res["objects"] = dict(collections.Counter(o.type for o in O))
res["collections"] = [(c.name, len(c.objects)) for c in bpy.data.collections]
res["materials"] = len(bpy.data.materials)
res["images"] = [(i.name, i.size[0], i.size[1], i.filepath[-40:]) for i in bpy.data.images if i.name not in ("Render Result", "Viewer Node")][:40]
res["actions"] = len(bpy.data.actions)
res["texts"] = [(t.name, t.as_string()[:300]) for t in bpy.data.texts][:5]
res["custom_props"] = [(o.name, {k: str(o[k])[:60] for k in o.keys() if not k.startswith("_")}) for o in O if [k for k in o.keys() if not k.startswith("_")]][:10]
res["scene_props"] = {k: str(bpy.context.scene[k])[:80] for k in bpy.context.scene.keys() if not k.startswith("_")}
res["lights"] = [(o.name, o.data.type) for o in O if o.type == "LIGHT"]
res["cameras"] = len([o for o in O if o.type == "CAMERA"])
res["world"] = bpy.context.scene.world.name if bpy.context.scene.world else None

tot_tris = 0
rows = []
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in O:
    if o.type not in ("MESH", "CURVE", "FONT", "SURFACE", "META"):
        continue
    ev = o.evaluated_get(dg)
    try:
        me = ev.to_mesh()
    except Exception:
        continue
    tris = sum(max(len(p.vertices) - 2, 1) for p in me.polygons)
    corners = [o.matrix_world @ Vector(c) for c in o.bound_box]
    a = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    b = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    if o.visible_get() or True:
        mn = Vector((min(mn.x, a.x), min(mn.y, a.y), min(mn.z, a.z)))
        mx = Vector((max(mx.x, b.x), max(mx.y, b.y), max(mx.z, b.z)))
    tot_tris += tris
    rows.append({"n": o.name, "t": o.type, "tris": tris, "mods": [m.type for m in o.modifiers], "mats": [s.material.name for s in o.material_slots if s.material][:3],
                 "c": o.users_collection[0].name if o.users_collection else "", "parent": o.parent.name if o.parent else None,
                 "size": [round(b.x - a.x, 2), round(b.y - a.y, 2), round(b.z - a.z, 2)], "min": [round(a.x, 2), round(a.y, 2), round(a.z, 2)],
                 "hide": o.hide_viewport or o.hide_render})
    ev.to_mesh_clear()
res["tris_total_eval"] = tot_tris
res["bbox"] = [[round(v, 2) for v in mn], [round(v, 2) for v in mx]]
rows.sort(key=lambda r: -r["tris"])
res["n_mesh_objects"] = len(rows)
res["top_by_tris"] = rows[:120]
res["names_sample"] = [r["n"] for r in rows][:60]
res["modifier_types"] = dict(collections.Counter(m for r in rows for m in r["mods"]))
res["hidden"] = sum(1 for r in rows if r["hide"])
res["with_parent"] = sum(1 for r in rows if r["parent"])
res["material_slots_multi"] = sum(1 for r in rows if len(r["mats"]) > 1)
result = res
