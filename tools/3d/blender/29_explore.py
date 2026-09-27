# Exploración: abre una COPIA, aplasta materiales, apaga el override, ilumina y renderiza una vista isométrica RGBA.
# Edita SRC/OUT. Devuelve además color de material por objeto (para decidir el reparto por etapas).
# @include lib_stages.py
SRC = "__SRC__"
OUT = "__OUT__"
bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
O = bpy.data.objects
include_everything()
bpy.context.view_layer.update()
for o in [x for x in O if x.type in ("CAMERA", "LIGHT")]:
    bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in O if o.type == "MESH"]
flatten_materials(meshes, sat=0.95, merge=False)
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for o in meshes:
    a, b = bbox_world(o)
    mn = Vector((min(mn.x, a.x), min(mn.y, a.y), min(mn.z, a.z))); mx = Vector((max(mx.x, b.x), max(mx.y, b.y), max(mx.z, b.z)))
preview_lighting(scene)
cam = setup_transparent_scene(scene, ((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, (mn.z + mx.z) / 2), (-0.56, -0.64, 0.53))
fit_camera(scene, cam, meshes)
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
rows = []
for o in meshes:
    a, b = bbox_world(o)
    m = o.material_slots[0].material if o.material_slots and o.material_slots[0].material else None
    col = None
    if m and m.use_nodes:
        p = next((n for n in m.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled"), None)
        if p: col = [round(x, 2) for x in p.inputs["Base Color"].default_value[:3]]
    rows.append([o.name, len(o.data.polygons), [round(v, 2) for v in a], [round(v, 2) for v in b], col])
result = {"bbox": [list(mn), list(mx)], "rows": rows}
