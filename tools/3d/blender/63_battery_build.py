# BATERÍA SCI-FI → gráfico de calorías. Modelo «Sci Fi Battery» de BlenderKit (Avishka Induwara, licencia BlenderKit «royalty_free»,
# validado), importado por el addon (visual, en el Blender con ventana) y ya guardado en `_trabajo/sci_fi_battery_bk.blend` — no hay FBX/blend
# original de terceros que preservar aquí, este trabajo parte directo de esa copia descargada por el addon.
#
# Estructura (nombres de nodo que el runtime espera):
#   cuerpo   carcasa (metal negro, metal, cobre) — no se controla, solo decorativo
#   nucleo   cristal interior (material «Core», emisivo): el runtime cambia su color/brillo con el nivel
#   anillos  los anillos de cobre en los extremos (material «Light» del propio `cuerpo`, separado en un objeto propio para poder variar su
#            brillo con el nivel sin tocar el resto del cuerpo)
#   cristal  tubo de vidrio exterior
# @include lib_stages.py
import os
SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/sci_fi_battery_bk.blend"
OUT = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/export/gauge_battery_001"
bpy.ops.wm.open_mainfile(filepath=SRC)
O = bpy.data.objects
scene = bpy.context.scene

# 1) geometría a coordenadas mundiales, sin padres ni el empty vacío
for o in [x for x in O if x.type == "MESH"]:
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix.Identity(4)
for o in [x for x in O if x.type == "EMPTY"]:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()

# 2) separar los anillos (material «Light») del resto del cuerpo, para poder variar su brillo por separado
body = O["Body"]
import bmesh
bm = bmesh.new()
bm.from_mesh(body.data)
bm.faces.ensure_lookup_table()
light_idx = [i for i, s in enumerate(body.material_slots) if s.material and s.material.name == "Light"]
light_faces = [f for f in bm.faces if f.material_index in light_idx]
ring_bm = bmesh.new()
for f in light_faces:
    ring_bm_verts = [ring_bm.verts.new(v.co) for v in f.verts]
    ring_bm.faces.new(ring_bm_verts)
bmesh.ops.remove_doubles(ring_bm, verts=ring_bm.verts, dist=1e-6)
bmesh.ops.delete(bm, geom=light_faces, context="FACES")
bm.to_mesh(body.data)
bm.free()
me = bpy.data.meshes.new("anillos")
ring_bm.to_mesh(me)
ring_bm.free()
light_mat = next(s.material for s in body.material_slots if s.material and s.material.name == "Light")
me.materials.append(light_mat)
anillos = bpy.data.objects.new("anillos", me)
bpy.context.scene.collection.objects.link(anillos)

# 3) centrar en X/Y y apoyar en Z=0 (usando el cuerpo, que es el más grande)
ws = [body.matrix_world @ v.co for v in body.data.vertices]
cx = (min(p.x for p in ws) + max(p.x for p in ws)) / 2
cy = (min(p.y for p in ws) + max(p.y for p in ws)) / 2
z0 = min(p.z for p in ws)
T = Matrix.Translation((-cx, -cy, -z0))
for o in (body, O["core"], O["Glass"], anillos):
    o.data.transform(T)
O["core"].name = "nucleo"
O["Glass"].name = "cristal"
bpy.context.view_layer.update()

# 4) materiales propios y con nombre fijo para el runtime (evita depender de nombres importados de BlenderKit)
nucleo = O["nucleo"]
m_core = bpy.data.materials.new("VT_BatteryCore")
m_core.use_nodes = True
p = next(n for n in m_core.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
p.inputs["Base Color"].default_value = (0.05, 0.05, 0.06, 1.0)
p.inputs["Emission Color"].default_value = (0.13, 0.77, 0.37, 1.0)
p.inputs["Emission Strength"].default_value = 0.15
p.inputs["Roughness"].default_value = 0.25
nucleo.data.materials.clear()
nucleo.data.materials.append(m_core)

anillos.data.materials.clear()
m_ring = bpy.data.materials.new("VT_BatteryRing")
m_ring.use_nodes = True
p2 = next(n for n in m_ring.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
p2.inputs["Base Color"].default_value = (0.35, 0.28, 0.15, 1.0)
p2.inputs["Emission Color"].default_value = (0.13, 0.77, 0.37, 1.0)
p2.inputs["Emission Strength"].default_value = 0.1
p2.inputs["Metallic"].default_value = 0.6
p2.inputs["Roughness"].default_value = 0.35
anillos.data.materials.append(m_ring)

# el material «glass» original usa transmisión (vidrio de Cycles), que el glTF no exporta bien: se sustituye por un vidrio simple translúcido
cristal = O["cristal"]
m_glass = bpy.data.materials.new("VT_BatteryGlass")
m_glass.use_nodes = True
p3 = next(n for n in m_glass.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
p3.inputs["Base Color"].default_value = (0.75, 0.85, 0.9, 1.0)
p3.inputs["Roughness"].default_value = 0.05
p3.inputs["Metallic"].default_value = 0.0
p3.inputs["Alpha"].default_value = 0.16
m_glass.blend_method = "BLEND"
cristal.data.materials.clear()
cristal.data.materials.append(m_glass)

# 5) reducir texturas 2K del cuerpo (metal/cobre) a 512 px antes de exportar — bajan el peso sin perder detalle visible a este tamaño
for im in bpy.data.images:
    if im.size[0] >= 1024 and not im.name.startswith("."):
        im.scale(512, 512)
        im.pack()

report = {"tris": {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (body, nucleo, O["cristal"], anillos)}}
report["bbox"] = {o.name: [[round(min((o.matrix_world @ v.co)[i] for v in o.data.vertices), 4) for i in range(3)],
                           [round(max((o.matrix_world @ v.co)[i] for v in o.data.vertices), 4) for i in range(3)]]
                   for o in (body, nucleo, O["cristal"], anillos)}
body.name = "cuerpo"

bpy.ops.wm.save_as_mainfile(filepath="C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/gauge_battery.blend")
for o in bpy.context.view_layer.objects:
    o.select_set(False)
sel = [O["cuerpo"], nucleo, O["cristal"], anillos]
for o in sel:
    o.select_set(True)
wins = list(bpy.context.window_manager.windows)
res = {}
for suffix, extra in (("", {}), ("_meshopt", {"export_meshopt_compression_enable": True})):
    kw = dict(filepath=OUT + suffix + ".glb", export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_extras=True,
              export_lights=False, export_cameras=False, export_materials="EXPORT", export_animations=False,
              export_image_format="JPEG", export_jpeg_quality=88)
    kw.update(extra)
    with bpy.context.temp_override(window=wins[0] if wins else None, active_object=sel[0], selected_objects=sel, selected_editable_objects=sel):
        bpy.ops.export_scene.gltf(**kw)
    res[suffix or "raw"] = round(os.path.getsize(OUT + suffix + ".glb") / 1e6, 3)
report["glb_mb"] = res
result = report
