# CASTILLO — 7 etapas. Trabaja sobre la COPIA (`originales_copia/castillo abandonado.blend`), nunca sobre el original.
# Licencia del asset original: UNVERIFIED. La paleta diurna, la simplificación de árboles y el reparto por etapas
# son variaciones de prototipo (NO lo convierten en un asset propio).
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/castillo abandonado.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/castle_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/castle_7day.manifest.json"
DAY_NAMES = ["Base", "Muros", "Torres", "Estructura", "Detalles", "Vegetación", "Castillo completo"]

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

# ---------------------------------------------------------------- simplificar lo pesado
def decimate(ob, ratio):
    if ob.type != "MESH" or len(ob.data.polygons) < 40:
        return
    m = ob.modifiers.new("Dec", "DECIMATE")
    m.ratio = ratio
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=m.name)

# Árboles secos: curvas con 1 617 ramas (229 mil polígonos cada una). Se conservan solo las ramas más gruesas
# (se ve el mismo árbol, pero con ~1.5 mil polígonos) y se hornean a malla de sección cuadrada.
trees = []
KEEP = 190
for o in [x for x in O if x.type == "CURVE"]:
    d = o.data
    d.bevel_resolution = 0
    d.resolution_u = 1
    ranked = sorted(range(len(d.splines)), key=lambda i: -max((p.radius for p in d.splines[i].bezier_points), default=0.0))
    drop = set(ranked[KEEP:])
    for i in sorted(drop, reverse=True):
        d.splines.remove(d.splines[i])
    trees.append(o)
bpy.context.view_layer.update()
for o in trees:
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
        bpy.ops.object.convert(target="MESH")
for o in trees:
    o.data.polygons.foreach_set("use_smooth", [False] * len(o.data.polygons))
report["tree_polys_after"] = [len(o.data.polygons) for o in trees]
for o in list(O):
    if o.type == "MESH":
        for m in list(o.modifiers):
            if m.type in ("NODES",):                 # 'Auto Smooth' (solo sombreado)
                o.modifiers.remove(m)
        if o.name == "Cube":
            decimate(o, 0.4)
        elif o.name.startswith("rock_01_GEO") and len(o.data.polygons) > 600:
            decimate(o, 0.5)
        elif o.name.startswith(("Kentucky", "Rye")):
            decimate(o, 0.5)

# Fondos/planos gigantes del original (no pertenecen a la figura): fuera.
backdrops = []
for o in [x for x in O if x.type == "MESH"]:
    a, b = bbox_world(o)
    if max(b.x - a.x, b.y - a.y) > 14.0:
        backdrops.append(o.name)
report["backdrops_removed"] = backdrops
for n in backdrops:
    bpy.data.objects.remove(O[n], do_unlink=True)

# ---------------------------------------------------------------- materiales: paleta diurna limpia
ov = {
    "bricks": dict(color=(0.35, 0.28, 0.23), rough=0.85),
    "tower": dict(color=(0.45, 0.39, 0.33), rough=0.85),
    "ground": dict(color=(0.13, 0.09, 0.06), rough=0.95),
    "ground-top": dict(color=(0.13, 0.27, 0.07), rough=0.95),
    "stones-rocks": dict(color=(0.27, 0.28, 0.30), rough=0.9),
    "stones": dict(color=(0.42, 0.40, 0.38), rough=0.9),
    "wood": dict(color=(0.22, 0.12, 0.07), rough=0.85),
    "Stand": dict(color=(0.13, 0.08, 0.05), rough=0.85),
    "Material.001": dict(color=(0.17, 0.11, 0.08), rough=0.9),      # árboles secos
    "Kentucky Blue": dict(color=(0.14, 0.32, 0.07), rough=0.9),
    "Seed": dict(color=(0.32, 0.38, 0.10), rough=0.9),
    "Seed.001": dict(color=(0.36, 0.35, 0.12), rough=0.9),
    "Seed.002": dict(color=(0.20, 0.36, 0.09), rough=0.9),
    "Material.105": dict(color=(1.0, 0.86, 0.35), rough=0.5, emission=(1.0, 0.72, 0.22), emission_strength=3.0),   # ventanas encendidas
    "Material.106": dict(color=(0.55, 0.06, 0.05), rough=0.7),      # estandarte
    "metal-gate": dict(color=(0.09, 0.09, 0.10), rough=0.5, metallic=0.9),
    "vertexColorShaderBIBase.003": dict(color=(0.30, 0.28, 0.26), rough=0.9),
}
meshes = [o for o in O if o.type == "MESH"]
flatten_materials(meshes, overrides=ov, sat=0.9)

# ---------------------------------------------------------------- clasificación por rol
def dims(o):
    a, b = bbox_world(o)
    return (b - a), a, b

roles = {}
for o in meshes:
    d, a, b = dims(o)
    mats = [s.material.name for s in o.material_slots if s.material]
    biggest = max(d.x, d.y, d.z)
    c = o.users_collection[0].name if o.users_collection else ""
    if o.name == "Cube":
        r = "terrain"
    elif o.name in [t.name for t in trees]:
        r = "tree"
    elif c == "weeds":
        r = "weed"
    elif o.name.startswith("rock_01_GEO") and biggest > 2.5:
        r = "bigrock"
    elif o.name.startswith("rock_01_GEO"):
        r = "smallstone"
    elif any(m.startswith("VT_tower") for m in mats) and d.z > 3.0:
        r = "tower"
    elif any(m.startswith("VT_bricks") for m in mats) and biggest >= 4.0:
        r = "wall"
    elif a.z > 5.0:
        r = "crown"
    elif any("metal-gate" in m for m in mats):
        r = "gate"
    elif biggest >= 1.0:
        r = "structure"
    else:
        r = "detail"
    roles[o.name] = r
weed_names = [n for n, r in roles.items() if r == "weed"]
meshes = [o for o in meshes if roles[o.name] != "weed"]
for n in weed_names:
    bpy.data.objects.remove(O[n], do_unlink=True)
report["weeds_replaced"] = len(weed_names)
report["roles"] = {k: sum(1 for v in roles.values() if v == k) for k in set(roles.values())}

# Vegetación propia (matas de pasto sobre la baldosa) para la etapa 6.
terr = O["Cube"]
tmn, tmx = bbox_world(terr)
tufts = []
rnd = random.Random(4)
m_tuft = [flat_mat("VT_TuftA", (0.13, 0.30, 0.07), 0.95), flat_mat("VT_TuftB", (0.18, 0.34, 0.09), 0.95)]
for i in range(16):
    for _ in range(40):
        x = rnd.uniform(tmn.x + 0.6, tmx.x - 0.6); y = rnd.uniform(tmn.y + 0.6, tmx.y - 0.6)
        # esquiva el castillo (centro) y los muros
        if math.hypot(x - (tmn.x + tmx.x) / 2, y - (tmn.y + tmx.y) / 2) > 2.6:
            break
    tufts.append(make_bush(f"Tuft.{i:02d}", (x, y, tmx.z - 0.15), rnd.uniform(0.18, 0.32), m_tuft[i % 2], squash=0.7, seed=i))

# ---------------------------------------------------------------- reparto por etapa
st = Stager(scene)
plan = {
    "terrain": (1, "terrain"), "bigrock": (1, "grow"),
    "wall": (2, "grow"),
    "tower": (3, "grow"),
    "structure": (4, "grow"),
    "gate": (5, "slide"), "detail": (5, "pop"), "smallstone": (5, "drop_small"),
    "tree": (6, "grow"), "weed": (6, "pop"),
    "crown": (7, "pop"),
}
for o in meshes:
    stage, anim = plan[roles[o.name]]
    st.place(o, stage, anim)
for t in tufts:
    st.place(t, 6, "pop")
report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items]

# ---------------------------------------------------------------- animación + escena transparente
report["animated"] = schedule(st, center=Vector((0, 0, 0)))
cam = setup_transparent_scene(scene, (0, 0, 2.5), (-0.56, -0.64, 0.53))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
preview_lighting(scene)    # las luces del original (noche azul/roja) no viajan; la vista previa usa un sol neutro
report["stages"] = write_manifest(MANIFEST, "castle_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
