# ESQUELETO (GYM) — 7 etapas. Trabaja sobre la COPIA (`originales_copia/esqueleto.blend`), nunca sobre el original.
# El archivo trae el texto "Manny the Mannequin by Gord Goodwin ... This rig may be used for any purpose." (declaración dentro del
# archivo, NO verificada en la fuente): se conserva como evidencia y la licencia queda UNVERIFIED. Material y base = adaptaciones.
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/esqueleto.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/skeleton_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/skeleton_7day.manifest.json"
DAY_NAMES = ["Base", "Piernas", "Pelvis", "Columna", "Caja torácica", "Brazos", "Cráneo"]

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 24
scene.render.engine = "BLENDER_EEVEE"
report = {}
O = bpy.data.objects
bpy.context.view_layer.update()

meshes = [o for o in O if o.type == "MESH"]
for o in meshes:
    apply_modifiers(o)                       # armadura (pose actual) + subdivisión → malla
bpy.context.view_layer.update()
for o in [x for x in O if x.type == "ARMATURE"]:
    bpy.data.objects.remove(o, do_unlink=True)

# Todo el esqueleto a ~4.2 m de alto con los pies en z = 0 (las animaciones de construcción trabajan en metros).
allmn = Vector((1e9,) * 3); allmx = Vector((-1e9,) * 3)
for o in meshes:
    o.parent = None
    for v in o.data.vertices:
        p = o.matrix_world @ v.co
        allmn = Vector((min(allmn.x, p.x), min(allmn.y, p.y), min(allmn.z, p.z)))
        allmx = Vector((max(allmx.x, p.x), max(allmx.y, p.y), max(allmx.z, p.z)))
k = 4.2 / (allmx.z - allmn.z)
cx, cy = (allmn.x + allmx.x) / 2, (allmn.y + allmx.y) / 2
report["scale"] = round(k, 4)
M = Matrix.Scale(k, 4) @ Matrix.Translation((-cx, -cy, -allmn.z))
for o in meshes:
    o.data.transform(M @ o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
    for p in o.data.polygons:
        p.use_smooth = True
bpy.context.view_layer.update()

bone = flat_mat("VT_Bone", (0.86, 0.80, 0.66), 0.55)
for o in meshes:
    o.data.materials.clear()
    o.data.materials.append(bone)

by = {o.name: o for o in meshes}
plinth_top, _ = -0.03, 0
m_top = flat_mat("VT_Plinth", (0.14, 0.14, 0.16), 0.75)
m_side = flat_mat("VT_PlinthSide", (0.05, 0.05, 0.06), 0.85)
slab = make_slab("Base", 2.5, 1.7, 0.3, m_top, m_side, top_z=plinth_top, bevel=0.06, center=(0.0, 0.0))

st = Stager(scene)
st.place(slab, 1, "terrain")
st.place(by["BONES_LEG.L"], 2, "grow")
st.place(by["BONES_LEG.R"], 2, "grow")
st.place(by["BONES_PELVIS"], 3, "drop")
st.place(by["BONES_SPINE"], 4, "grow")
st.place(by["BONES_RIBCAGE"], 5, "drop")
st.place(by["BONES_ARM.L"], 6, "slide")
st.place(by["BONES_ARM.R"], 6, "slide")
st.place(by["BONES_HEAD"], 7, "spin_in")
report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items:
        st.discard(o)

report["animated"] = schedule(st, center=Vector((0, 0, 0)))
preview_lighting(scene)
cam = setup_transparent_scene(scene, (0, 0, 2.1), (-0.3, -0.85, 0.28))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
report["tris"] = sum(sum(max(len(p.vertices) - 2, 1) for p in o.data.polygons) for o in O if "vt_stage" in o.keys())
report["stages"] = write_manifest(MANIFEST, "skeleton_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
