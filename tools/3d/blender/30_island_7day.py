# ISLA FLOTANTE (Island.blend, GYM/Agua) — 7 etapas. Trabaja sobre la COPIA (`originales_copia/Island.blend`), nunca sobre el original.
# Licencia/origen: UNVERIFIED (el archivo no trae texto de licencia). Colores planos y reparto por etapas = adaptaciones de prototipo.
# Nota: la colección "Collection 1" (la isla) viene con render desactivado en el original; `include_everything` la activa.
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/Island.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/island_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/island_7day.manifest.json"
DAY_NAMES = ["Roca flotante", "Pasto", "Cascada y rocas", "Árboles", "Cabaña y puente", "Molino y detalles", "Nubes"]

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
bpy.context.view_layer.update()
for o in [x for x in O if x.type in ("CAMERA", "LIGHT")]:
    bpy.data.objects.remove(o, do_unlink=True)
for o in [x for x in O if x.type == "MESH"]:
    apply_modifiers(o)
bpy.context.view_layer.update()

ov = {"Material.050": dict(color=(0.97, 0.97, 1.0), rough=0.9)}       # nubes
meshes = [o for o in O if o.type == "MESH"]
flatten_materials(meshes, overrides=ov, sat=0.95)


def group_near(objs, thr):
    """Agrupa objetos por cercanía de sus centros (unión-búsqueda). Devuelve listas de objetos."""
    cen = []
    for o in objs:
        a, b = bbox_world(o); cen.append((a + b) / 2)
    par = list(range(len(objs)))
    def f(i):
        while par[i] != i:
            par[i] = par[par[i]]; i = par[i]
        return i
    for i in range(len(objs)):
        for j in range(i + 1, len(objs)):
            if (cen[i] - cen[j]).length < thr:
                par[f(i)] = f(j)
    g = {}
    for i, o in enumerate(objs):
        g.setdefault(f(i), []).append(o)
    return list(g.values())


def N(prefix, a, b):
    return [O[f"{prefix}.{i:03d}"] for i in range(a, b + 1) if f"{prefix}.{i:03d}" in O]


def nm(*names):
    return [O[n] for n in names if n in O]


# La cascada que cae bajo la isla mide 4 m (más que la isla): se acorta a ~1.5 m para que la figura llene el cuadro.
_w = O["Cube.002"]
_w.data.transform(_w.matrix_basis); _w.matrix_basis = Matrix.Identity(4)
_top = max(v.co.z for v in _w.data.vertices)
for v in _w.data.vertices:
    v.co.z = _top + (v.co.z - _top) * 0.38
bpy.context.view_layer.update()

cube = lambda a, b: nm(*[f"Cube.{i:03d}" for i in range(a, b + 1)])
# Etapa 1: roca flotante (cuerpo + rocas de abajo)
base = nm("Icosphere.054", "Icosphere.087", "Icosphere.088", "Icosphere.089", "Icosphere.090", "Icosphere.091")
grass = nm("Cylinder", "Cylinder.001")
water = nm("Cube.001", "Cylinder.002", "Cube.002", "Cube", "Icosphere.085")
trunks = nm("Cube.006", "Cube.007", "Cube.009", "Cube.010")
leaves = cube(11, 25)
house = nm("Cube.028", "Cylinder.005", "Mball.009", "Cube.008", "Cylinder.003", "Cylinder.004", "Cylinder.007", "Icosphere", "Cube.005")
mill = nm("Cylinder.006", "Cylinder.009", "Cylinder.008")
poles = nm("Cube.003", "Cube.004", "Cube.026", "Cube.027", "Cube.029", "Cube.030", "Cube.031", "Cube.032", "Cube.051", "Sphere")
sprouts = cube(33, 50)
clouds = cube(52, 83)

st = Stager(scene)
# Nubes y brotes se unen antes (menos draw calls)
cloud_objs = [join_objects(g, f"cloud_{i:02d}") for i, g in enumerate(group_near(clouds, 1.6))]
leaf_objs = [join_objects(g, f"leaves_{i:02d}") for i, g in enumerate(group_near(leaves, 0.55))]
sprout_obj = join_objects(sprouts, "sprouts")

# Cuenta oficial (los que no estén aquí se descartan y se informan)
st.place(O["Icosphere.054"], 1, "terrain")
for o in nm("Icosphere.087", "Icosphere.088", "Icosphere.089", "Icosphere.090", "Icosphere.091"):
    st.place(o, 1, "grow")
for o in grass:
    st.place(o, 2, "rise")
for o in nm("Cube", "Icosphere.085"):
    st.place(o, 3, "drop_small")
for o in nm("Cube.001", "Cylinder.002"):
    st.place(o, 3, "rise")
st.place(O["Cube.002"], 3, "grow")
for o in trunks:
    st.place(o, 4, "grow")
for o in leaf_objs:
    st.place(o, 4, "pop")
for o in nm("Cube.028", "Cylinder.005", "Mball.009", "Cylinder.007", "Icosphere"):
    st.place(o, 5, "drop")
for o in nm("Cube.008", "Cylinder.003", "Cylinder.004", "Cube.005"):
    st.place(o, 5, "slide")
for o in mill:
    st.place(o, 6, "spin_in")
for o in poles:
    st.place(o, 6, "drop_small")
st.place(sprout_obj, 6, "pop")
for o in cloud_objs:
    st.place(o, 7, "drop")
    # las nubes del original quedan muy lejos: se acercan un 30% al centro de la isla para que el cuadro no quede vacío
    o.location.x = 0.4 + (o.location.x - 0.4) * 0.7
    o.location.y = 0.0 + (o.location.y - 0.0) * 0.7

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
report["stages"] = write_manifest(MANIFEST, "island_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
