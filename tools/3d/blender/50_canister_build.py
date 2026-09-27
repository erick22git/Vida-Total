# BOTE DE GRITOS (Scream Canister) → gráfico de calorías. Importa el FBX ORIGINAL (`GYM/calorias/Bote de gritos/source/...fbx`, solo lectura) en
# una escena vacía y trabaja sobre lo importado: el original no se modifica.
#
# LICENCIA: asset de Monsters, Inc. (Disney/Pixar). Es un modelo de REFERENCIA/PROTOTIPO: NO comercial y NO publicable tal cual. Debe reemplazarse
# por un modelo propio antes de cualquier lanzamiento comercial (ver docs/3d/asset-registry.json y asset-evaluation.md).
#
# Estructura resultante (nombres de nodo que el runtime espera):
#   cuerpo      cilindro amarillo (z < 3.65) con las texturas originales reducidas
#   tapa        tapa superior (z >= 3.65), cortada del mismo cuerpo
#   placa       PLATE_LOW: marco de la ventana (+/−, «MAX SCREAM CAPACITY»)
#   fondo       recuadro oscuro detrás del indicador (sustituye a SCREAM-O-METER_LOW, cuya barra roja horneada no se puede controlar)
#   indicador   barra de energía, origen en su base: el runtime la escala en Y (0..1) y le pone el color/emisión (material ENERGY)
#   aguja       marcador triangular a la derecha de la ventana: el runtime lo sube y baja
#   cristal     cristal translúcido delante de la ventana
# Texturas: 4096 px → base 1024, normal 1024, rugosidad/metálico 512 (el exportador las junta en una ORM).
# @include lib_stages.py
import os, bmesh
BASE = "C:/Erick/app movil/vida-total-web/biblioteca de assets/GYM/calorias/Bote de gritos/"
OUT = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/export/gauge_canister_001"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=BASE + "source/Monsters_inc_canister_low.fbx")
bpy.context.view_layer.update()
O = bpy.data.objects

# 1) texturas: los PNG del FBX apuntan a nombres largos; los reales están abreviados (_Bas/_Nor/_Rou/_Met)
short = {"BaseColor": ("Bas", 1024), "Normal": ("Nor", 1024), "Roughness": ("Rou", 512), "Metalness": ("Met", 512)}
for im in bpy.data.images:
    for k, (v, px) in short.items():
        if k in im.name:
            im.filepath = BASE + "textures/Monsters.inc_canister_low_Material.001_%s.png" % v
            im.reload()
            im.scale(px, px)
            im.pack()
report = {"images": [(i.name[-24:], i.size[0]) for i in bpy.data.images]}

# 2) geometría a coordenadas mundiales, sin padres
for o in [x for x in O if x.type == "MESH"]:
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix.Identity(4)
bpy.context.view_layer.update()
can, plate, meter = O["CANISTER_LOW"], O["PLATE_LOW"], O["SCREAM-O-METER_LOW"]
bpy.data.objects.remove(meter, do_unlink=True)   # su barra roja está horneada en la textura: se sustituye por fondo + indicador propios


def split_z(ob, z_cut, upper_name):
    """Devuelve (objeto inferior = ob, objeto superior nuevo) cortando por caras según la altura de su centro."""
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    up = bmesh.new(); up.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z >= z_cut], context="FACES")
    up.faces.ensure_lookup_table()
    bmesh.ops.delete(up, geom=[f for f in up.faces if f.calc_center_median().z < z_cut], context="FACES")
    for b in (bm, up):
        b.verts.ensure_lookup_table()
        bmesh.ops.delete(b, geom=[v for v in b.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(me); bm.free()
    me2 = bpy.data.meshes.new(upper_name)
    up.to_mesh(me2); up.free()
    for m in me.materials:
        me2.materials.append(m)
    o2 = bpy.data.objects.new(upper_name, me2)
    bpy.context.scene.collection.objects.link(o2)
    return ob, o2


cuerpo, tapa = split_z(can, 3.65, "tapa")
cuerpo.name = "cuerpo"
plate.name = "placa"
report["tris"] = {"cuerpo": sum(len(p.vertices) - 2 for p in cuerpo.data.polygons), "tapa": sum(len(p.vertices) - 2 for p in tapa.data.polygons),
                  "placa": sum(len(p.vertices) - 2 for p in plate.data.polygons)}

# 3) piezas nuevas del indicador (delante de la placa, que está en y ≈ -1.05)
Z0, Z1 = 1.68, 3.02          # recorrido de la barra
XW = 0.085                   # medio ancho de la barra
Y_FRONT = -1.052


def box(name, cx, cy, z0, z1, hx, hy, mat):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 2 * hx + cx, v.co.y * 2 * hy + cy, (v.co.z + 0.5) * (z1 - z0) + z0))
    me = bpy.data.meshes.new(name)
    me.materials.append(mat)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


m_dark = flat_mat("VT_GaugeBack", (0.03, 0.03, 0.035), 0.6)
m_energy = flat_mat("ENERGY", (0.13, 0.77, 0.37), 0.25, emission=(0.13, 0.77, 0.37), emission_strength=2.2)   # el runtime cambia color y emisión
m_glass = flat_mat("VT_GaugeGlass", (0.85, 0.93, 1.0), 0.05, alpha=0.18)
m_needle = flat_mat("VT_GaugeNeedle", (0.98, 0.98, 0.95), 0.4)
fondo = box("fondo", 0, Y_FRONT - 0.004, Z0 - 0.04, Z1 + 0.04, XW + 0.02, 0.004, m_dark)
indic = box("indicador", 0, Y_FRONT - 0.014, Z0, Z1, XW, 0.010, m_energy)
cristal = box("cristal", 0, Y_FRONT - 0.03, Z0 - 0.05, Z1 + 0.05, XW + 0.03, 0.006, m_glass)
# aguja: prisma triangular que apunta a la ventana, en el borde derecho
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=3, radius1=0.055, radius2=0.055, depth=0.02)
for v in bm.verts:
    v.co = Vector((v.co.z, v.co.y, v.co.x))       # eje del prisma a lo largo de Y de la placa
    v.co += Vector((0.168, Y_FRONT - 0.024, 0))
me = bpy.data.meshes.new("aguja")
me.materials.append(m_needle)
bm.to_mesh(me); bm.free()
aguja = bpy.data.objects.new("aguja", me)
bpy.context.scene.collection.objects.link(aguja)
# origen de la aguja en su centro, en z = Z0 (el runtime la mueve entre Z0 y Z1)
ax = Vector((0.168, Y_FRONT - 0.024, 0))
aguja.data.transform(Matrix.Translation(-ax))
aguja.location = Vector((ax.x, ax.y, Z0))
# origen del indicador en su base: la geometría ya empieza en Z0; se sube el origen a Z0 para escalar hacia arriba
indic.data.transform(Matrix.Translation((0, 0, -Z0)))
indic.location = Vector((0, 0, Z0))
indic["vt_range"] = json.dumps({"z0": Z0, "z1": Z1})
aguja["vt_range"] = json.dumps({"z0": Z0, "z1": Z1})

# 4) materiales del cuerpo: se dejan los del FBX (texturas reducidas); ENERGY es el emisivo que controla el color
for o in (cuerpo, tapa, plate, fondo, indic, cristal, aguja):
    for p in o.data.polygons:
        p.use_smooth = True
report["nodes"] = [o.name for o in O if o.type == "MESH"]

# 5) exportar (GLB crudo y meshopt); texturas como JPEG para bajar el peso
bpy.ops.wm.save_as_mainfile(filepath="C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/gauge_canister.blend")
for o in bpy.context.view_layer.objects:
    o.select_set(False)
for o in [x for x in O if x.type == "MESH"]:
    o.select_set(True)
wins = list(bpy.context.window_manager.windows)
res = {}
for suffix, extra in (("", {}), ("_meshopt", {"export_meshopt_compression_enable": True})):
    kw = dict(filepath=OUT + suffix + ".glb", export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_extras=True,
              export_lights=False, export_cameras=False, export_materials="EXPORT", export_animations=False,
              export_image_format="JPEG", export_jpeg_quality=85)
    kw.update(extra)
    sel = [x for x in O if x.type == "MESH"]
    with bpy.context.temp_override(window=wins[0] if wins else None, active_object=sel[0], selected_objects=sel, selected_editable_objects=sel):
        bpy.ops.export_scene.gltf(**kw)
    res[suffix or "raw"] = round(os.path.getsize(OUT + suffix + ".glb") / 1e6, 3)
report["glb_mb"] = res
result = report
