# MOLINO — 7 etapas. Trabaja sobre la COPIA (`originales_copia/molino.blend`), nunca sobre el original.
# Licencia del asset original: UNVERIFIED. Paleta, base y entorno son variaciones de prototipo (no lo hacen propio).
# El original es un solo cuerpo + aspas sin materiales: aquí se corta por alturas/islas para poder construirlo por partes.
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/molino.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/windmill_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/windmill_7day.manifest.json"
DAY_NAMES = ["Base", "Cimientos", "Cuerpo", "Techo", "Aspas", "Detalles", "Molino completo"]

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
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
O["lopatky"].modifiers.clear()      # armadura vacía del original
bpy.context.view_layer.update()

flat = lambda n, c, r=0.85, m=0.0, **kw: flat_mat("VT_" + n, c, r, m, **kw)
M_STONE = flat("Stone", (0.36, 0.33, 0.30), 0.95)
M_PLASTER_LO = flat("PlasterLo", (0.66, 0.59, 0.47), 0.9)
M_PLASTER_HI = flat("PlasterHi", (0.74, 0.68, 0.55), 0.9)
M_ROOF = flat("Roof", (0.33, 0.15, 0.11), 0.8)
M_WOOD = flat("Wood", (0.17, 0.105, 0.07), 0.85)
M_CANVAS = flat("Canvas", (0.83, 0.77, 0.62), 0.95)
M_GRASS = flat("MillGrass", (0.13, 0.27, 0.085), 0.95)
M_SOIL = flat("MillSoil", (0.11, 0.075, 0.055), 0.95)
M_LEAF_A, M_LEAF_B = flat("MillLeafA", (0.07, 0.22, 0.09)), flat("MillLeafB", (0.10, 0.27, 0.10))
M_TRUNK = flat("MillTrunk", (0.15, 0.085, 0.05))
M_ROCK = flat("MillRock", (0.26, 0.255, 0.25), 0.9)
M_LANTERN = flat("Lantern", (1.0, 0.82, 0.4), 0.4, emission=(1.0, 0.75, 0.25), emission_strength=5.0)

# ---------------------------------------------------------------- cuerpo: islas → bandas de altura
islands = split_islands(O["mlyn"], "Mill")
main = max(islands, key=lambda o: len(o.data.polygons))
small = [o for o in islands if o is not main]
report["mlyn_islands"] = len(islands)
bands = split_by_axis(main, 2, [2.4, 4.6, 6.3], "MillBody")     # cimientos / cuerpo bajo / cuerpo alto / techo
mats = [M_STONE, M_PLASTER_LO, M_PLASTER_HI, M_ROOF]
for b, m in zip(bands, mats):
    if b:
        for slot in b.material_slots:
            slot.material = m
foundation_small, detail_small = [], []
for o in small:
    _, mxo = bbox_world(o)
    for slot in o.material_slots:
        slot.material = M_WOOD
    (foundation_small if mxo.z < 2.3 else detail_small).append(o)
# Unir detalles pequeños en pocos grupos (menos draw calls): por altura
def bucket(objs, zs):
    groups = [[] for _ in range(len(zs) + 1)]
    for o in objs:
        z = bbox_world(o)[0].z
        groups[sum(1 for c in zs if z >= c)].append(o)
    return groups
detail_groups = [join_objects(g, f"MillDetail_{i}") for i, g in enumerate(bucket(detail_small, [3.0, 4.4])) if g]
found_groups = [join_objects(foundation_small, "MillFoundation")] if foundation_small else []

# ---------------------------------------------------------------- aspas: mástiles (madera) y velas (lona)
blades_isl = split_islands(O["lopatky"], "Blade")
struts = [o for o in blades_isl if len(o.data.polygons) >= 6]
sails = [o for o in blades_isl if len(o.data.polygons) < 6]
for o in struts:
    for slot in o.material_slots:
        slot.material = M_WOOD
for o in sails:
    for slot in o.material_slots:
        slot.material = M_CANVAS
hub = max(blades_isl, key=lambda o: len(o.data.polygons))
hub_center = (bbox_world(hub)[0] + bbox_world(hub)[1]) / 2
blade_wood = join_objects(struts, "BladesWood")
blade_sail = join_objects(sails, "BladesSail")

# ---------------------------------------------------------------- base propia + entorno generado
allm = [o for o in O if o.type == "MESH"]
mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
for o in allm:
    a, b = bbox_world(o)
    mn = Vector((min(mn.x, a.x), min(mn.y, a.y), min(mn.z, a.z))); mx = Vector((max(mx.x, b.x), max(mx.y, b.y), max(mx.z, b.z)))
cx, cy = 0.0, 0.0
half = 8.2
slab = make_slab("Base", half * 2, half * 2, 0.9, M_GRASS, M_SOIL, top_z=-0.62, bevel=0.15, center=(cx, cy))
env = []
rnd = random.Random(9)
for i, (px, py, h) in enumerate([(-6.2, 5.6, 6.5), (6.6, 4.8, 5.2), (-5.8, -6.4, 5.8), (6.0, -5.6, 7.0), (0.5, 7.0, 4.6)]):
    env.append(make_pine(f"Pine.{i:02d}", (px, py, -0.62), h, M_LEAF_A, M_TRUNK, layers=4, seed=i))
for i in range(11):
    a = rnd.uniform(0, 6.283); r = rnd.uniform(4.6, 7.2)
    env.append(make_bush(f"Bush.{i:02d}", (math.cos(a) * r, math.sin(a) * r, -0.62), rnd.uniform(0.45, 0.8), M_LEAF_A if i % 2 else M_LEAF_B, seed=i))
rocks = []
for i in range(6):
    a = 0.4 + i * 1.0; r = rnd.uniform(3.6, 4.4)
    b = make_bush(f"Rock.{i:02d}", (math.cos(a) * r, math.sin(a) * r, -0.62), rnd.uniform(0.3, 0.55), M_ROCK, squash=0.7, seed=20 + i)
    rocks.append(b)
lantern = make_bush("Lantern", (2.9, -2.9, -0.62 + 1.0), 0.16, M_LANTERN, squash=1.0, seed=3)
post = make_box("LanternPost", (2.9, -2.9, -0.62), (0.12, 0.12, 1.0), M_WOOD)

# ---------------------------------------------------------------- reparto por etapa
st = Stager(scene)
st.place(slab, 1, "terrain")
if bands[0]:
    st.place(bands[0], 2, "grow")
for g in found_groups:
    st.place(g, 2, "pop")
for r in rocks:
    st.place(r, 2, "drop_small")
if bands[1]:
    st.place(bands[1], 3, "grow")
if bands[2]:
    st.place(bands[2], 4, "grow")
if bands[3]:
    st.place(bands[3], 4, "spin_in")
# aspas: el pivote es el buje (eje horizontal a lo largo de X)
for o in (blade_wood, blade_sail):
    o.data.transform(Matrix.Translation(-(o.matrix_world.inverted() @ hub_center)))
    o.location = hub_center
    st.items[o.name] = (5, "blades")
    relink(o, st.colls[5]); o["vt_stage"] = 5; o["vt_anim"] = "blades"
for g in detail_groups:
    st.place(g, 6, "pop")
st.place(post, 6, "pop")
for e in env:
    st.place(e, 7, "pop")
st.place(lantern, 7, "glow")
report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items:
        st.discard(o)

# ---------------------------------------------------------------- animación + escena transparente
report["animated"] = schedule(st, center=Vector((0, 0, 0)))
cam = setup_transparent_scene(scene, (0, 0, 3.5), (-0.56, -0.64, 0.53))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
report["stages"] = write_manifest(MANIFEST, "windmill_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
