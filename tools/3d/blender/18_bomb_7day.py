# BOMBA (GYM) — 7 etapas. Trabaja sobre la COPIA (`originales_copia/Bomba.blend`), nunca sobre el original.
# Licencia/origen del asset original: UNVERIFIED (el archivo no trae texto de licencia; texturas de circuito con rutas de otra máquina).
# El original tiene 1.6 millones de triángulos evaluados (cables Array+Screw+Curve+Subsurf, dinamitas con Subsurf 3, 46 instancias de
# colecciones): se hornea con subdivisión mínima, se realizan las instancias y se decima. Materiales planos = adaptación de prototipo.
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/Bomba.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/bomb_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/bomb_7day.manifest.json"
DAY_NAMES = ["Base", "Dinamita", "Cintas", "Circuito", "Reloj", "Cables", "Luces"]
CAP = 1700          # triángulos máximos por objeto después de hornear

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 24
scene.render.engine = "BLENDER_EEVEE"
report = {}
O = bpy.data.objects
include_everything()
for o in list(O):
    if o.animation_data:
        o.animation_data_clear()
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
bpy.context.view_layer.update()


def tris(ob):
    return sum(max(len(p.vertices) - 2, 1) for p in ob.data.polygons) if ob and ob.type == "MESH" else 0


def decimate(ob, ratio):
    if ob is None or ob.type != "MESH" or len(ob.data.polygons) < 80 or ratio >= 0.98:
        return
    if ob.data.users > 1:
        ob.data = ob.data.copy()
    m = ob.modifiers.new("Dec", "DECIMATE")
    m.ratio = max(ratio, 0.02)
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=m.name)


# Plano emisor de luz (Emitter, 6.9 x 4 m) de la escena original: no es parte de la figura.
if "Plane" in O:
    bpy.data.objects.remove(O["Plane"], do_unlink=True)

# ---------------------------------------------------------------- instancias de colección → objetos reales
for o in [x for x in O if x.type == "EMPTY" and x.instance_type == "COLLECTION" and x.instance_collection]:
    o.select_set(True)
try:
    bpy.ops.object.duplicates_make_real()
except Exception as e:
    report["make_real_error"] = str(e)
for o in list(O):
    o.select_set(False)
for o in [x for x in O if x.type == "EMPTY"]:
    bpy.data.objects.remove(o, do_unlink=True)
for o in list(O):
    if o.parent:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
bpy.context.view_layer.update()
report["objects_after_real"] = len([x for x in O if x.type in ("MESH", "CURVE")])

# ---------------------------------------------------------------- curvas con grosor (cables finos) → malla
for o in [x for x in O if x.type == "CURVE" and (x.data.bevel_depth > 0 or x.data.extrude > 0 or x.data.bevel_object)]:
    o.data.bevel_resolution = min(o.data.bevel_resolution, 1)
    o.data.resolution_u = min(o.data.resolution_u, 4)
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
        bpy.ops.object.convert(target="MESH")
bpy.context.view_layer.update()

# ---------------------------------------------------------------- hornear con subdivisión mínima
for o in [x for x in O if x.type == "MESH"]:
    for m in o.modifiers:
        if m.type == "SUBSURF":
            m.levels = 1 if o.name.startswith("TNT") else 0
            m.render_levels = m.levels
        elif m.type == "SCREW":
            m.steps = 8
            m.render_steps = 8
    apply_modifiers(o)
bpy.context.view_layer.update()
# Curvas restantes (guías de los cables, círculo auxiliar) y otros: fuera
for o in [x for x in O if x.type in ("CURVE", "FONT", "SURFACE", "CAMERA", "LIGHT")]:
    bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in O if o.type == "MESH" and len(o.data.polygons) > 0]
for o in [x for x in O if x.type == "MESH" and len(x.data.polygons) == 0]:
    bpy.data.objects.remove(o, do_unlink=True)
report["tris_baked"] = sum(tris(o) for o in meshes)
def cap_of(n):
    if n.startswith("Bolt"):
        return 240            # ~46 tornillos repetidos (18 mil triángulos cada uno en el original)
    if n.startswith(("Led", "Capacitor", "Transistor", "Resistor", "Chip", "Cube", "Fuse", "Clock")):
        return 600
    return CAP


for o in meshes:
    cap = cap_of(o.name)
    if tris(o) > cap:
        decimate(o, cap / tris(o))
    if o.name.startswith("TNT") or o.name.startswith("Cable") or o.name.startswith("Tape"):
        for p in o.data.polygons:
            p.use_smooth = True
bpy.context.view_layer.update()
report["tris_after_decimate"] = sum(tris(o) for o in meshes)

# ---------------------------------------------------------------- materiales planos
ov = {
    "TNT.red": dict(color=(0.5, 0.05, 0.04), rough=0.55),
    "TNT.bone": dict(color=(0.82, 0.74, 0.56), rough=0.8),
    "Tape.black": dict(color=(0.03, 0.03, 0.035), rough=0.7),
    "Cable.black": dict(color=(0.03, 0.03, 0.035), rough=0.6),
    "Cable.Red": dict(color=(0.75, 0.04, 0.03), rough=0.6),
    "Emitter.Red": dict(color=(1.0, 0.05, 0.03), rough=0.3, emission=(1.0, 0.05, 0.03), emission_strength=5.0),
    "Emitter": dict(color=(1.0, 0.05, 0.03), rough=0.3, emission=(1.0, 0.05, 0.03), emission_strength=3.0),
    "Metal.connector": dict(color=(0.7, 0.72, 0.75), rough=0.3, metallic=0.9),
    "Screen": dict(color=(0.02, 0.08, 0.03), rough=0.3, emission=(0.1, 1.0, 0.25), emission_strength=1.5),
    "Pastic.transparent.Red": dict(color=(1.0, 0.1, 0.05), rough=0.25, emission=(1.0, 0.08, 0.04), emission_strength=4.0),
    "CIrcuit1.base": dict(color=(0.05, 0.28, 0.1), rough=0.6),
    "CIrcuit1.base.001": dict(color=(0.05, 0.28, 0.1), rough=0.6),
    "CIrcuit2.base": dict(color=(0.05, 0.3, 0.12), rough=0.6),
    "Base.brown": dict(color=(0.32, 0.17, 0.06), rough=0.7),
}
flatten_materials(meshes, overrides=ov, sat=1.0, merge=True)

# ---------------------------------------------------------------- clasificación por nombre
def stage_of(n):
    if n.startswith("Cube.001") or n.startswith("Led"):
        return 7, "glow"
    if n.startswith("Base"):
        return 1, "terrain"
    if n.startswith("TNT"):
        idx = int(n.split(".")[1]) if "." in n and n.split(".")[1].isdigit() else 0
        return (2, "grow") if idx <= 3 else (3, "grow")
    if n.startswith("Tape"):
        return 3, "spin_in"
    if n.startswith("Clock") or n.startswith("Fuse"):
        return 5, "slide"
    if n.startswith("Cable") or n.startswith("NurbsPath") or n.startswith("Cylinder"):
        return 6, "grow"
    return 4, "pop"


by_stage = {}
for o in meshes:
    stg, kind = stage_of(o.name)
    by_stage.setdefault((stg, kind), []).append(o)
report["counts"] = {f"{k[0]}:{k[1]}": len(v) for k, v in by_stage.items()}

allmn = Vector((1e9,) * 3); allmx = Vector((-1e9,) * 3)
for o in meshes:
    a, b = bbox_world(o)
    allmn = Vector((min(allmn.x, a.x), min(allmn.y, a.y), min(allmn.z, a.z)))
    allmx = Vector((max(allmx.x, b.x), max(allmx.y, b.y), max(allmx.z, b.z)))
cx, cy = (allmn.x + allmx.x) / 2, (allmn.y + allmx.y) / 2
report["bbox"] = [[round(v, 2) for v in allmn], [round(v, 2) for v in allmx]]

# Unir por etapa y zona (menos draw calls); la dinamita queda con un objeto por cartucho
placed = []
for (stg, kind), objs in sorted(by_stage.items()):
    if stg in (2, 3) and kind == "grow":
        for o in objs:
            placed.append((o, stg, kind))
    elif stg == 1:
        j = join_objects(objs, "BoardBase")
        placed.append((j, stg, kind))
    else:
        for i, j in enumerate(cluster_join(objs, 3.0, f"S{stg}_{kind}")):
            placed.append((j, stg, kind))

m_top = flat_mat("VT_Plinth", (0.14, 0.14, 0.16), 0.7)
m_side = flat_mat("VT_PlinthSide", (0.05, 0.05, 0.06), 0.8)
slab = make_slab("Base", (allmx.x - allmn.x) + 0.6, (allmx.y - allmn.y) + 0.6, 0.3, m_top, m_side, top_z=allmn.z - 0.02, bevel=0.06, center=(cx, cy))

st = Stager(scene)
st.place(slab, 1, "terrain")
for o, stg, kind in placed:
    st.place(o, stg, kind)
report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items and o.users_collection]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items and o.users_collection:
        st.discard(o)

report["animated"] = schedule(st, center=Vector((cx, cy, 0)))
preview_lighting(scene)
cam = setup_transparent_scene(scene, (cx, cy, (allmn.z + allmx.z) / 2), (-0.56, -0.64, 0.5))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
report["tris_final"] = sum(tris(o) for o in O if "vt_stage" in o.keys())
report["stages"] = write_manifest(MANIFEST, "bomb_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
