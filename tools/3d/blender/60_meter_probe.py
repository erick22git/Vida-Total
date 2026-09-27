# Inspección del FBX del medidor (solo lectura): objetos, tamaños, materiales, texturas.
# @include lib_stages.py
BASE = "C:/Erick/app movil/vida-total-web/biblioteca de assets/GYM/calorias/contador/"
bpy.ops.wm.read_factory_settings(use_empty=True)
import addon_utils
try: addon_utils.enable("cycles", default_set=False)
except Exception as e: print("cycles", e)
bpy.context.scene.render.engine = "CYCLES"
# Blender 5.2: el importador de FBX aún escribe lamp.cycles.cast_shadow (propiedad retirada) → se re-crea como propiedad ficticia
_l = bpy.data.lights.new("_t", "POINT")
_cls = type(_l.cycles)
try:
    if hasattr(_cls, "cast_shadow"): delattr(_cls, "cast_shadow")
except Exception: pass
_cls.cast_shadow = bpy.props.BoolProperty(default=True)
bpy.data.lights.remove(_l)
bpy.ops.import_scene.fbx(filepath=BASE + "source/WindGauge_SmallerTest v1.fbx")
bpy.context.view_layer.update()
rows = []
for o in bpy.data.objects:
    r = [o.name, o.type, o.parent.name if o.parent else None, [round(v, 3) for v in o.location], [round(v, 3) for v in o.dimensions]]
    if o.type == "MESH":
        r += [len(o.data.polygons), [s.material.name if s.material else None for s in o.material_slots]]
    elif o.type == "FONT" or o.type == "CURVE":
        r += [getattr(o.data, "body", None)]
    rows.append(r)
mats = []
for m in bpy.data.materials:
    imgs = [n.image.name for n in m.node_tree.nodes if n.bl_idname == "ShaderNodeTexImage" and n.image] if m.use_nodes else []
    mats.append([m.name, imgs])
result = {"objs": rows, "mats": mats, "imgs": [(i.name, i.filepath, list(i.size)) for i in bpy.data.images], "anim": [a.name for a in bpy.data.actions]}
