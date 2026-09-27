# MEDIDOR DE ENERGÍA (Sketchfab «Energy Meter - Open Gauges», digitalurban, CC-BY 4.0) → gráfico de calorías.
# Importa el FBX ORIGINAL (solo lectura) en una escena vacía y trabaja sobre lo importado. Se descartan cámara, luz, suelo (Cube), engranajes y
# soportes internos (no se ven detrás del dial). El dial usa una textura PROPIA (61_meter_dial_texture.py), no `Energy_(1).png`.
#
# Nodos que el runtime espera (dial de radio 1, centrado en el origen, mirando a +Z de glTF):
#   soporte (placa trasera), marco (montura del cristal), dial (disco con la textura), aguja (origen en el eje: el runtime gira su Z), cristal.
# Blender 5.2: el importador de FBX escribe lamp.cycles.cast_shadow (propiedad retirada) → se recrea como propiedad ficticia.
# @include lib_stages.py
import os, math, addon_utils
BASE = "C:/Erick/app movil/vida-total-web/biblioteca de assets/GYM/calorias/contador/"
TEX = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/meter_dial.png"
OUT = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/export/gauge_meter_001"
bpy.ops.wm.read_factory_settings(use_empty=True)
try:
    addon_utils.enable("cycles", default_set=False)
except Exception:
    pass
bpy.context.scene.render.engine = "CYCLES"
_l = bpy.data.lights.new("_t", "POINT")
_cls = type(_l.cycles)
try:
    if hasattr(_cls, "cast_shadow"):
        delattr(_cls, "cast_shadow")
except Exception:
    pass
_cls.cast_shadow = bpy.props.BoolProperty(default=True)
bpy.data.lights.remove(_l)
bpy.ops.import_scene.fbx(filepath=BASE + "source/WindGauge_SmallerTest v1.fbx")
bpy.context.view_layer.update()
O = bpy.data.objects

# 0) el FBX trae una acción sobre la aguja que reescribe su posición al evaluar: se elimina
for o in O:
    o.animation_data_clear()
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# 1) geometría a coordenadas mundiales, sin padres
for o in [x for x in O if x.type == "MESH"]:
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix.Identity(4)
keep = {"Body1": "soporte", "Body1.004": "marco", "Body2.001": "dial", "Body1.003": "aguja", "Body1.005": "cristal"}
for o in list(O):
    if o.type != "MESH" or o.name not in keep:
        bpy.data.objects.remove(o, do_unlink=True)
for o, nn in [(o, keep[o.name]) for o in O]:
    o.name = nn
    o.data.name = nn
bpy.context.view_layer.update()

# 2) centro y radio del dial → dial de radio 1 en el origen
dv = [v.co.copy() for v in O["dial"].data.vertices]
cx = (min(v.x for v in dv) + max(v.x for v in dv)) / 2
cy = (min(v.y for v in dv) + max(v.y for v in dv)) / 2
R = (max(v.x for v in dv) - min(v.x for v in dv)) / 2
zc = (min(v.z for v in dv) + max(v.z for v in dv)) / 2
for o in O:
    o.data.transform(Matrix.Scale(1 / R, 4) @ Matrix.Translation((-cx, -cy, -zc)))
# aguja de doble punta: se recorta la cola (queda un contrapeso corto) para que no cruce la etiqueta viva del centro-abajo
import bmesh
bm = bmesh.new(); bm.from_mesh(O["aguja"].data)
cut = bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces), plane_co=(0.15, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
edges = [g for g in cut["geom_cut"] if isinstance(g, bmesh.types.BMEdge)]
bmesh.ops.holes_fill(bm, edges=edges, sides=0)
bm.to_mesh(O["aguja"].data); bm.free()
# UV planar del dial (el disco no trae mapeo útil)
me = O["dial"].data
uv = me.uv_layers.active or me.uv_layers.new(name="UVMap")
for poly in me.polygons:
    for li in poly.loop_indices:
        co = me.vertices[me.loops[li].vertex_index].co
        uv.data[li].uv = (co.x / 2 + 0.5, co.y / 2 + 0.5)

ag = O["aguja"]

# 4) materiales propios (sencillos)
img = bpy.data.images.load(TEX)
img.pack()
m_dial = bpy.data.materials.new("VT_MeterDial")
m_dial.use_nodes = True
nt = m_dial.node_tree
p = next(n for n in nt.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
nt.links.new(tex.outputs["Color"], p.inputs["Base Color"])
p.inputs["Roughness"].default_value = 0.55
p.inputs["Metallic"].default_value = 0.0
mats = {
    "soporte": flat_mat("VT_MeterBody", (0.08, 0.085, 0.10), 0.5, 0.2),
    "marco": flat_mat("VT_MeterFrame", (0.55, 0.58, 0.62), 0.35, 0.9),
    "aguja": flat_mat("VT_MeterNeedle", (0.85, 0.10, 0.08), 0.35),
    "cristal": flat_mat("VT_MeterGlass", (0.9, 0.95, 1.0), 0.05, alpha=0.10),
}
for name, ob in ((o.name, o) for o in O):
    ob.data.materials.clear()
    ob.data.materials.append(m_dial if name == "dial" else mats[name])
    for pl in ob.data.polygons:
        pl.use_smooth = True

# 5) el dial mira a +Z de glTF: rotar +90° sobre X (Blender z → glTF z tras export_yup); aguja: origen en (0,0,z) ya es el eje
for o in O:
    o.data.transform(Matrix.Rotation(math.radians(90), 4, "X"))
    o.data.update()
# origen de la aguja = su eje: tras la rotación el grosor va en Y de Blender (glTF z = −Y)
ys = [v.co.y for v in ag.data.vertices]
ay = (min(ys) + max(ys)) / 2
ag.data.transform(Matrix.Translation((0, -ay, 0)))
ag.location = (0, ay, 0)
bpy.context.view_layer.update()

rep = {"R": R, "tris": {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in O}}
rep["bbox"] = {o.name: [[round(min((o.matrix_world @ v.co)[i] for v in o.data.vertices), 3) for i in range(3)],
                        [round(max((o.matrix_world @ v.co)[i] for v in o.data.vertices), 3) for i in range(3)]] for o in O}
bpy.ops.wm.save_as_mainfile(filepath="C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/gauge_meter.blend")
for o in bpy.context.view_layer.objects:
    o.select_set(False)
sel = [x for x in O if x.type == "MESH"]
wins = list(bpy.context.window_manager.windows)
res = {}
for suffix, extra in (("", {}), ("_meshopt", {"export_meshopt_compression_enable": True})):
    kw = dict(filepath=OUT + suffix + ".glb", export_format="GLB", use_selection=False, export_apply=True, export_yup=True, export_extras=True,
              export_lights=False, export_cameras=False, export_materials="EXPORT", export_animations=False,
              export_image_format="JPEG", export_jpeg_quality=88)
    kw.update(extra)
    with bpy.context.temp_override(window=wins[0] if wins else None, active_object=sel[0], selected_objects=sel, selected_editable_objects=sel):
        bpy.ops.export_scene.gltf(**kw)
    res[suffix or "raw"] = round(os.path.getsize(OUT + suffix + ".glb") / 1e6, 3)
rep["glb_mb"] = res
result = rep
