# DIORAMA 2 (GYM/Agua) — 7 etapas. Trabaja sobre la COPIA (`originales_copia/diorama 2.blend`), nunca sobre el original.
# Licencia/origen: UNVERIFIED (el archivo no trae texto de licencia). El original es monocromo (7 materiales grises 0.8): la paleta
# (arena, agua, roca, plantas, madera) es una ADAPTACIÓN de prototipo asignada por pieza.
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/diorama 2.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/diorama_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/diorama_7day.manifest.json"
DAY_NAMES = ["Plato de piedra", "Arena y agua", "Rocas", "Plantas", "Barca y escalera", "Guijarros y rocas menores", "Brotes"]

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 24
scene.render.engine = "BLENDER_EEVEE"
report = {}
O = bpy.data.objects
include_everything()
for o in list(O):
    if o.parent:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    if o.animation_data:
        o.animation_data_clear()
for o in [x for x in O if x.type in ("CAMERA", "LIGHT")]:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()
for o in [x for x in O if x.type == "MESH"]:
    apply_modifiers(o)                          # 20 objetos con Mirror
bpy.context.view_layer.update()


def nm(*names):
    return [O[n] for n in names if n in O]


def paint(objs, color, rough=0.8, metallic=0.0, name="VT_paint"):
    m = flat_mat(name, color, rough, metallic)
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(m)
        for p in o.data.polygons:
            p.use_smooth = True


cube = lambda a, b: nm(*[f"Cube.{i:03d}" for i in range(a, b + 1)])
dish = nm("Circle")
sand = nm("Plane")
water = nm("Plane.001")
rocks_big = nm("Cube.001", "Cube.002", "Cube.003", "Cube.004")
plants_a = nm("Plane.005", "Plane.007")
plants_b = nm("Plane.002", "Plane.006")
boat = nm("Cube", "Plane.003", "Plane.004")
rocks_small = nm("Cube.024", "Cube.025", "Cube.026")
pebbles = cube(5, 23)

paint(dish, (0.50, 0.55, 0.60), 0.7, name="VT_Dish")
paint(sand, (0.86, 0.76, 0.54), 0.95, name="VT_Sand")
paint(water, (0.20, 0.56, 0.68), 0.15, name="VT_Water")
paint(rocks_big + rocks_small + pebbles, (0.52, 0.52, 0.55), 0.9, name="VT_Rock")
paint(plants_a + plants_b, (0.24, 0.62, 0.30), 0.85, name="VT_Leaf")
paint(boat, (0.58, 0.38, 0.22), 0.8, name="VT_Wood")

st = Stager(scene)
for o in dish:
    st.place(o, 1, "terrain")
for o in sand + water:
    st.place(o, 2, "rise")
for o in rocks_big:
    st.place(o, 3, "drop")
for o in plants_a:
    st.place(o, 4, "grow")
for o in boat:
    st.place(o, 5, "slide")
for o in rocks_small + pebbles:
    st.place(o, 6, "drop_small")
for o in plants_b:
    st.place(o, 7, "grow")

report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items:
        st.discard(o)

mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
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
report["tris"] = sum(sum(max(len(p.vertices) - 2, 1) for p in o.data.polygons) for o in O if "vt_stage" in o.keys() and o.type == "MESH")
report["objects"] = sum(1 for o in O if "vt_stage" in o.keys())
report["stages"] = write_manifest(MANIFEST, "diorama_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
