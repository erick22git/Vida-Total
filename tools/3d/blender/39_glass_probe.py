# Sonda del vaso: deja solo "Circle" (el vaso), hornea sus modificadores y lo renderiza; informa la forma (radio por altura, espesor).
# @include lib_stages.py
bpy.ops.wm.open_mainfile(filepath="C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/vaso de agua.blend")
include_everything()
bpy.context.view_layer.update()
O = bpy.data.objects
g = O["Circle"]
info = {"mods": [(m.type, m.name) for m in g.modifiers], "scale": [round(v, 3) for v in g.scale], "loc": [round(v, 2) for v in g.location], "mats": [s.material.name for s in g.material_slots if s.material]}
for m in g.modifiers:
    if m.type == "FLUID":
        info["fluid_type"] = m.fluid_type
    if m.type == "SOLIDIFY":
        info["solidify"] = m.thickness
for o in list(O):
    if o is not g:
        bpy.data.objects.remove(o, do_unlink=True)
for m in list(g.modifiers):
    if m.type == "FLUID":
        g.modifiers.remove(m)
apply_modifiers(g)
bpy.context.view_layer.update()
# perfil radial: para cada altura, radio min/max de los vértices
vs = [v.co for v in g.data.vertices]
import math
zs = sorted({round(v.z, 1) for v in vs})
prof = []
for z in zs[:: max(1, len(zs) // 14)]:
    rs = [math.hypot(v.x, v.y) for v in vs if abs(v.z - z) < 0.06]
    if rs:
        prof.append([z, round(min(rs), 2), round(max(rs), 2)])
info["profile"] = prof
info["tris"] = sum(len(p.vertices) - 2 for p in g.data.polygons)
info["z"] = [min(v.z for v in vs), max(v.z for v in vs)]
mat = flat_mat("VT_Glass", (0.85, 0.93, 1.0), 0.05, alpha=0.3)
g.data.materials.clear(); g.data.materials.append(mat)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
preview_lighting(scene)
cam = setup_transparent_scene(scene, (0, 0, 2.7), (-0.5, -0.8, 0.35))
fit_camera(scene, cam, [g])
scene.render.filepath = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/previews_originales/vaso_glass.png"
bpy.ops.render.render(write_still=True)
result = info
