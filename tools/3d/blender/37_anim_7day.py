# ISLAND ANIMATION → figura de 7 etapas. Parte de `_trabajo/islandanim_reduced.blend` (paso 36, ya decimado). Nunca toca el original.
# Licencia/origen: UNVERIFIED (sin texto de licencia en el archivo). Adaptaciones: materiales planos (texturas de 4096 px fuera),
# vegetación colocada por script (el original usaba partículas), sin océano procedural ni plano de nubes, animación de tiburón/tortuga/
# aves congelada en la pose del fotograma 1.
# @include lib_stages.py
from mathutils.bvhtree import BVHTree

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/islandanim_reduced.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/islandanim_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/islandanim_7day.manifest.json"
DAY_NAMES = ["Estanque", "Montañas y fondo", "Arena", "Palmeras", "Pinos", "Fauna marina", "Aves"]
K = 6.0 / 61.0            # la escena mide ~61 m: se lleva a ~6 unidades como las demás figuras

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 24
scene.render.engine = "BLENDER_EEVEE"
O = bpy.data.objects
include_everything()
bpy.context.view_layer.update()
report = {}
rng = random.Random(7)

# 1) Coordenadas mundiales dentro de la malla (cada objeto con datos propios)
for o in [x for x in O if x.type == "MESH"]:
    if o.data.users > 1:
        o.data = o.data.copy()
    o.data.transform(o.matrix_world)
    o.matrix_world = Matrix.Identity(4)
bpy.context.view_layer.update()


def bb(o):
    return bbox_world(o)


# 2) Materiales planos (con ajustes por nombre)
ov = {
    "palm tree trunk": dict(color=(0.42, 0.28, 0.14), rough=0.9),
    "branches/trunk": dict(color=(0.36, 0.25, 0.12), rough=0.9),
    "leaves": dict(color=(0.16, 0.50, 0.16), rough=0.8),
    "Sand": dict(color=(0.86, 0.76, 0.55), rough=0.95),
    "Diffuse": dict(color=(0.50, 0.57, 0.65), rough=0.5),
    "Diffuse Eye": dict(color=(0.03, 0.03, 0.03), rough=0.3),
    "EP_Turtle_Mat.001": dict(color=(0.38, 0.50, 0.30), rough=0.7),
    "Eye.001": dict(color=(0.03, 0.03, 0.03), rough=0.3),
    "Eye Outer.001": dict(color=(0.9, 0.9, 0.85), rough=0.4),
    "Material.007": dict(color=(0.95, 0.95, 0.95), rough=0.8),
    "Material.008": dict(color=(0.16, 0.16, 0.20), rough=0.8),
}
meshes = [o for o in O if o.type == "MESH"]
flatten_materials(meshes, overrides=ov, sat=1.0)
report["cyl_mats"] = [s.material.name for s in O["Cylinder"].material_slots if s.material]

# Estanque: agua translúcida (se ve el fondo y los animales)
cyl = O["Cylinder"]
water = flat_mat("VT_Water", (0.10, 0.55, 0.85), 0.12, alpha=0.38)
cyl.data.materials.clear()
cyl.data.materials.append(water)
for p in cyl.data.polygons:
    p.material_index = 0
# Fondo (sin material en el original)
seabed = flat_mat("VT_Seabed", (0.72, 0.65, 0.48), 0.95)
for n in ("Landscape.002", "Landscape.003"):
    O[n].data.materials.clear()
    O[n].data.materials.append(seabed)

# Montañas: material por altura (el original usa un shader procedural)
zmats = [flat_mat("VT_Lowland", (0.42, 0.62, 0.25), 0.9), flat_mat("VT_Forest", (0.20, 0.45, 0.20), 0.9),
         flat_mat("VT_Rock", (0.46, 0.42, 0.38), 0.95), flat_mat("VT_Snow", (0.95, 0.96, 0.98), 0.7)]
for n in ("Landscape", "Landscape.001"):
    o = O[n]
    o.data.materials.clear()
    for m in zmats:
        o.data.materials.append(m)
    for p in o.data.polygons:
        z = sum(o.data.vertices[i].co.z for i in p.vertices) / len(p.vertices)
        p.material_index = 0 if z < 2.0 else 1 if z < 8.0 else 2 if z < 13.0 else 3
        p.use_smooth = True


# 3) Palmeras y árboles: mallas compartidas (instanciables) + colocación por script
def bottom_center(o):
    a, b = bb(o)
    return Vector(((a.x + b.x) / 2, (a.y + b.y) / 2, a.z)), b.z - a.z


def make_master(o):
    bc, h = bottom_center(o)
    o.data.transform(Matrix.Translation(-bc))
    o.matrix_world = Matrix.Identity(4)
    return h


palm_master = O["Palm Tree"]
cotton = O["Cottenwood Tree"]      # 230 mil tris de hojas sueltas: no decima bien; se sustituye por pinos low-poly propios (lib_stages.make_pine)
tree_master = make_pine("pine_master", (0, 0, 0), 5.0, flat_mat("VT_PineLeaf", (0.13, 0.42, 0.16), 0.85), flat_mat("VT_PineTrunk", (0.35, 0.24, 0.12), 0.9), layers=4, seed=3)
tree_master.rotation_euler = (0, 0, 0)
rush = O["Rush"]
real_palms = [O[n] for n in sorted(O.keys()) if n.startswith("Palm Tree.")]
palm_data = palm_master.data
tree_data = tree_master.data
ph = make_master(palm_master)
for o in real_palms:
    bc, h = bottom_center(o)
    s = h / ph * 2.0                     # palmeras algo más grandes que en el original para que se lean
    old = o.data
    o.data = palm_data
    if old.users == 0:
        bpy.data.meshes.remove(old)
    o.location = bc
    o.rotation_euler = (0, 0, rng.uniform(0, math.tau))
    o.scale = (s, s, s)
report["palms"] = len(real_palms)

# raycast a las montañas para colocar árboles
dg = bpy.context.evaluated_depsgraph_get()
bvhs = [(n, BVHTree.FromObject(O[n], dg)) for n in ("Landscape", "Landscape.001")]
mins = Vector((min(bb(O[n])[0].x for n, _ in bvhs), min(bb(O[n])[0].y for n, _ in bvhs), 0))
maxs = Vector((max(bb(O[n])[1].x for n, _ in bvhs), max(bb(O[n])[1].y for n, _ in bvhs), 40))
taken = [o.location.copy() for o in real_palms]
trees = []
tries = 0
while len(trees) < 8 and tries < 3000:
    tries += 1
    x, y = rng.uniform(mins.x, maxs.x), rng.uniform(mins.y, maxs.y)
    best = None
    for n, t in bvhs:
        hit = t.ray_cast(Vector((x, y, 60)), Vector((0, 0, -1)))
        if hit[0] is not None and (best is None or hit[0].z > best[0].z):
            best = hit
    if best is None:
        continue
    loc, nrm = best[0], best[1]
    if not (1.5 < loc.z < 9.5) or nrm.z < 0.8:
        continue
    if any((loc - t2).length < 4.0 for t2 in taken):
        continue
    taken.append(loc.copy())
    ob = bpy.data.objects.new(f"tree_{len(trees):02d}", tree_data)
    scene.collection.objects.link(ob)
    s = rng.uniform(0.9, 1.4)
    ob.location = loc
    ob.rotation_euler = (0, 0, rng.uniform(0, math.tau))
    ob.scale = (s, s, s)
    trees.append(ob)
report["trees"] = len(trees)
report["tree_tries"] = tries
# plantillas fuera
for o in (palm_master, tree_master, rush, cotton):
    bpy.data.objects.remove(o, do_unlink=True)

# 4) Fauna y aves
turtle = join_objects([O["body"], O["eyes"]], "turtle")
shark = O["Carribean_Reef_Shark"]
shark.name = "shark"
birds = [O[n] for n in sorted(O.keys()) if n.startswith("Plane.0")]
# La pose horneada de tortuga y aves perdió su posición (animadas por la armadura): se recentran y se colocan a mano.
ta, tb = bb(turtle)
turtle.data.transform(Matrix.Translation(-(ta + tb) / 2))
turtle.location = Vector((4.6, -10.0, -7.8))                  # donde estaba en el original
turtle.scale = (2.2, 2.2, 2.2)                                 # animales algo más grandes para que se lean tras el agua
sa, sb = bb(shark)
shark_c = (sa + sb) / 2
shark.data.transform(Matrix.Translation(-shark_c))
shark.location = shark_c
shark.scale = (2.2, 2.2, 2.2)
flock_a = join_objects(birds, "flock_0")
fa, fb = bb(flock_a)
flock_a.data.transform(Matrix.Translation(-(fa + fb) / 2))
flock_a.location = Vector((0, 0, 0))
flocks = [flock_a]
for i in (1, 2):
    ob = bpy.data.objects.new(f"flock_{i}", flock_a.data)
    scene.collection.objects.link(ob)
    flocks.append(ob)
for ob, (loc, sc) in zip(flocks, [((8, -2, 17), 6), ((32, 24, 18), 7), ((-12, -16, 16), 6)]):
    ob.location = Vector(loc)
    ob.scale = (sc, sc, sc)
    ob.rotation_euler = (0, 0, rng.uniform(0, math.tau))
report["flocks"] = len(flocks)

# 5) Escala global (~61 → ~6 unidades). Mallas únicas: datos; instancias: ubicaciones.
done = set()
for o in [x for x in O if x.type == "MESH"]:
    if o.data.name in done:
        continue
    done.add(o.data.name)
    o.data.transform(Matrix.Scale(K, 4))
for o in [x for x in O if x.type == "MESH"]:
    if o.name.startswith(("Palm Tree.", "tree_", "turtle", "flock_", "shark")):
        o.location = o.location * K
bpy.context.view_layer.update()

st = Stager(scene)


def place_shared(ob, stage, anim):
    """Como Stager.place pero SIN mover el origen de la malla (que es compartida entre varias instancias)."""
    relink(ob, st.colls[stage])
    ob["vt_stage"] = stage
    ob["vt_anim"] = anim
    st.items[ob.name] = (stage, anim)


st.place(O["Cylinder"], 1, "terrain")
st.place(O["Landscape"], 2, "grow")
st.place(O["Landscape.001"], 2, "grow")
st.place(O["Landscape.002"], 2, "rise")
st.place(O["Landscape.003"], 2, "rise")
st.place(O["Plane"], 3, "rise")
for o in real_palms:
    place_shared(o, 4, "pop")
for o in trees:
    place_shared(o, 5, "pop")
place_shared(turtle, 6, "spin_in")
st.place(shark, 6, "slide")
for o in flocks:
    place_shared(o, 7, "drop_small")

report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items:
        st.discard(o)

mn = Vector((1e9,) * 3)
mx = Vector((-1e9,) * 3)
for o in O:
    if "vt_stage" in o.keys():
        a, b = bbox_world(o)
        mn = Vector((min(mn.x, a.x), min(mn.y, a.y), min(mn.z, a.z)))
        mx = Vector((max(mx.x, b.x), max(mx.y, b.y), max(mx.z, b.z)))
cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
report["bbox"] = [[round(v, 2) for v in mn], [round(v, 2) for v in mx]]
report["animated"] = schedule(st, center=Vector((cx, cy, 0)))
preview_lighting(scene)
cam = setup_transparent_scene(scene, (cx, cy, (mn.z + mx.z) / 2), (-0.56, -0.64, 0.53))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
uniq = {}
for o in O:
    if "vt_stage" in o.keys() and o.type == "MESH":
        uniq[o.data.name] = sum(max(len(p.vertices) - 2, 1) for p in o.data.polygons)
report["tris_unique"] = sum(uniq.values())
report["tris_rendered"] = sum(uniq[o.data.name] for o in O if "vt_stage" in o.keys() and o.type == "MESH")
report["stages"] = write_manifest(MANIFEST, "islandanim_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
