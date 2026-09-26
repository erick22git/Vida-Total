# PUENTE (jardín japonés con pagoda) — 7 etapas. Trabaja sobre la COPIA (`originales_copia/puente.blend`), nunca sobre el original.
# Licencia/origen del asset original: UNVERIFIED (el archivo no trae texto de licencia). Colores planos y reparto por etapas son
# adaptaciones de prototipo (NO lo convierten en un asset propio).
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/puente.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/bridge_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/bridge_7day.manifest.json"
DAY_NAMES = ["Base", "Terreno", "Río y estanque", "Puente", "Pagoda", "Árboles y cerezo", "Rocas y linterna"]

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 24
scene.render.engine = "BLENDER_EEVEE"
report = {}
O = bpy.data.objects
for o in list(O):
    if o.parent:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    if o.animation_data:
        o.animation_data_clear()
bpy.context.view_layer.update()

for o in [x for x in O if x.type in ("CAMERA", "LIGHT")]:
    bpy.data.objects.remove(o, do_unlink=True)
# Sin material (ayudante de la escena original) o vacío: fuera.
for n in ("Icosphere", "Cube.004"):
    if n in O:
        bpy.data.objects.remove(O[n], do_unlink=True)

n_img = len(bpy.data.images)
ov = {
    "screen": dict(color=(1.0, 0.86, 0.6), rough=0.6, emission=(1.0, 0.78, 0.42), emission_strength=1.2),   # pantallas de papel de la pagoda
    "Material.013": dict(color=(0.09, 0.26, 0.62), rough=0.15),      # agua
    "Material.004": dict(color=(0.11, 0.30, 0.09), rough=0.95),      # pasto
    "Material.012": dict(color=(0.46, 0.48, 0.51), rough=0.9),       # piedra (arco, muro del río)
    "Material.016": dict(color=(0.46, 0.48, 0.51), rough=0.9),       # piedra (estanque, pagoda)
}
meshes = [o for o in O if o.type == "MESH"]
flatten_materials(meshes, overrides=ov, sat=0.95)
report["images_in_file"] = n_img

st = Stager(scene)
plan = {
    "Plane.001": (1, "terrain"), "Plane.002": (1, "terrain"),
    "Plane": (2, "rise"),
    "Plane.003": (3, "rise"), "Cylinder": (3, "rise"),
    "BRIDGE": (4, "grow"),
    "PAGODA": (5, "grow"),
    "tree": (6, "grow"), "fir clump": (6, "grow"), "cherry tree": (6, "grow"),
    "cherry tree.001": (6, "pop"), "cherry tree.002": (6, "pop"), "cherry tree.003": (6, "pop"), "cherry tree.004": (6, "pop"),
    "rock cluster": (7, "drop_small"), "Icosphere.001": (7, "drop_small"), "Icosphere.002": (7, "drop_small"), "Icosphere.003": (7, "drop_small"),
    "STORM LANTERN": (7, "glow"),
}
for o in meshes:
    if o.name in plan:
        stage, anim = plan[o.name]
        st.place(o, stage, anim)
report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items:
        st.discard(o)

mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
for o in O:
    if "vt_stage" in o.keys():
        a, b = bbox_world(o)
        mn = Vector((min(mn.x, a.x), min(mn.y, a.y), min(mn.z, a.z))); mx = Vector((max(mx.x, b.x), max(mx.y, b.y), max(mx.z, b.z)))
cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
report["animated"] = schedule(st, center=Vector((cx, cy, 0)))
preview_lighting(scene)
cam = setup_transparent_scene(scene, (cx, cy, (mn.z + mx.z) / 2), (-0.56, -0.64, 0.53))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
report["stages"] = write_manifest(MANIFEST, "bridge_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
