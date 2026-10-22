"""
Inspección completa: posiciones mundo de huesos + bounding box de la malla decimada.
Ejecutar: blender -b --python tools/3d/blender/70b_inspect_world.py
"""
import bpy, math

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/rangos/HumanBaseMale.blend"
bpy.ops.wm.open_mainfile(filepath=SRC)

body    = bpy.data.objects["MaleBASE"]
arm_obj = bpy.data.objects["Armature"]

# decimar brevemente para obtener las proporciones reales de la malla final
for m in list(body.modifiers):
    if m.type == "DATA_TRANSFER":
        body.modifiers.remove(m)
dec = body.modifiers.new("Dec", "DECIMATE")
dec.ratio = 0.065
dec.use_collapse_triangulate = True

bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg)
me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
mw = body.matrix_world
verts_w = [mw @ v.co for v in me.vertices]

xs = [v.x for v in verts_w]
ys = [v.y for v in verts_w]
zs = [v.z for v in verts_w]
print(f"##BBOX x=[{min(xs):.3f}, {max(xs):.3f}] y=[{min(ys):.3f}, {max(ys):.3f}] z=[{min(zs):.3f}, {max(zs):.3f}]")
print(f"##VERTS {len(verts_w)}  TRIS (polys) {len(me.polygons)}")

# posiciones mundo de cada hueso
bw = arm_obj.matrix_world
print("##BONES (world space):")
for bone in sorted(arm_obj.data.bones, key=lambda b: b.name):
    h = bw @ bone.head_local
    t = bw @ bone.tail_local
    print(f"##B {bone.name:<16} head=({h.x:+.3f},{h.y:+.3f},{h.z:+.3f})  tail=({t.x:+.3f},{t.y:+.3f},{t.z:+.3f})")
