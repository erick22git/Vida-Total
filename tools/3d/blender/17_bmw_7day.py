# BMW M6 (GYM) — 7 etapas. Trabaja sobre la COPIA (`originales_copia/BMW.blend`), nunca sobre el original.
# El archivo trae este texto (autor "Fred C. M'ule jr. (tyrant monkey)"): "You may use the file in both commercial or non-commercial use and are
# free to modify it and share it ... I ask that you only give me credit". Es una declaración DENTRO del archivo, no verificada en su fuente
# y con atribución obligatoria: licencia = UNVERIFIED hasta comprobarla. Pintura azul, materiales planos y base = adaptaciones.
# Reducción: 795 mil triángulos evaluados → menos de 90 mil (Subsurf a nivel 0/1 + Decimate). Se quitan suelo de 50 m, luces, cámara y logos en curva.
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/BMW.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/bmw_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/bmw_7day.manifest.json"
DAY_NAMES = ["Base", "Chasis", "Ruedas", "Carrocería", "Techo y cristales", "Interior", "Luces y detalles"]
BUDGET_TRIS = 85000

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
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
for o in [x for x in O if x.type in ("CAMERA", "LIGHT", "CURVE", "FONT", "EMPTY")]:
    bpy.data.objects.remove(o, do_unlink=True)
# "BMWBody" (arcilla) es un casco de referencia que coincide con la pintura: se ve a través de ella (z-fighting) → fuera.
if "BMWBody" in O:
    bpy.data.objects.remove(O["BMWBody"], do_unlink=True)
if "Plane" in O:
    bpy.data.objects.remove(O["Plane"], do_unlink=True)          # suelo de 50 m
bpy.context.view_layer.update()


def tris(ob):
    return sum(max(len(p.vertices) - 2, 1) for p in ob.data.polygons) if ob and ob.type == "MESH" else 0


def decimate(ob, ratio):
    if ob is None or ob.type != "MESH" or len(ob.data.polygons) < 120 or ratio >= 0.98:
        return
    m = ob.modifiers.new("Dec", "DECIMATE")
    m.ratio = max(ratio, 0.03)
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=m.name)


# ---------------------------------------------------------------- clasificación
def has(n, *keys):
    return any(k in n for k in keys)


def role(o):
    n = o.name
    if has(n, "Tire", "Tread", "Rim", "Wheel", "BrakeDisc", "Brake.", "Brake", "valve"):
        return "wheel"
    if has(n, "BWMFloor", "BMWBody", "BMWRadiator", "BMWAirDam"):
        return "chassis"
    if has(n, "Door", "Fender", "Sideskirting", "bumper", "Bumper", "BMWBoot", "BMWHood", "Watersquirt") and not has(n, "Logo", "Light"):
        return "paint"
    if has(n, "Roof", "Window", "WindScreen", "Glass", "Seal", "Seam"):
        return "glass"
    if has(n, "Seat", "Dash", "Steering", "Lining", "Mirror.") or n == "BMWMirror" or n == "BMWMirrorPlate":
        return "interior"
    return "detail"


# ---------------------------------------------------------------- hornear con subdivisión mínima
meshes = [o for o in O if o.type == "MESH"]
for o in meshes:
    for m in o.modifiers:
        if m.type == "SUBSURF":
            # La pintura/cristal/chasis conservan su subdivisión (al bajarla la pintura se encoge y deja ver el chasis por debajo).
            if role(o) in ("wheel", "interior", "detail"):
                tyre = "Tire" in o.name and "Tread" not in o.name
                m.levels = 0 if tyre else min(m.levels, 1)
                m.render_levels = m.levels
    apply_modifiers(o)
bpy.context.view_layer.update()
meshes = [o for o in O if o.type == "MESH" and len(o.data.polygons) > 0]
for o in [x for x in O if x.type == "MESH" and len(x.data.polygons) == 0]:
    bpy.data.objects.remove(o, do_unlink=True)
report["tris_baked"] = sum(tris(o) for o in meshes)

# ---------------------------------------------------------------- materiales planos
ov = {
    "CarPaint": dict(color=(0.02, 0.07, 0.36), rough=0.22, metallic=0.55),
    "car paint": dict(color=(0.02, 0.07, 0.36), rough=0.22, metallic=0.55),
    "carbonfibre": dict(color=(0.035, 0.035, 0.04), rough=0.4, metallic=0.3),
    "shinychrome": dict(color=(0.78, 0.8, 0.83), rough=0.15, metallic=0.95),
    "WindscreenGlass": dict(color=(0.16, 0.22, 0.27), rough=0.05, alpha=0.4),
    "HeadLightGlass": dict(color=(0.85, 0.87, 0.9), rough=0.08, alpha=0.55),
    "HeadLightGlass01": dict(color=(0.85, 0.87, 0.9), rough=0.08, alpha=0.55),
    "HeadLight": dict(color=(1.0, 0.96, 0.82), rough=0.3, emission=(1.0, 0.94, 0.75), emission_strength=3.0),
    "LightGlass": dict(color=(1.0, 0.96, 0.82), rough=0.3, emission=(1.0, 0.94, 0.75), emission_strength=2.5),
    "tiresidewall": dict(color=(0.03, 0.03, 0.033), rough=0.9),
    "tire": dict(color=(0.028, 0.028, 0.03), rough=0.92),
    "WheelRim": dict(color=(0.7, 0.72, 0.76), rough=0.25, metallic=0.9),
    "brakeDisc": dict(color=(0.42, 0.43, 0.46), rough=0.4, metallic=0.9),
    "brake clipper": dict(color=(0.75, 0.05, 0.05), rough=0.45),
    "grillmetal": dict(color=(0.04, 0.04, 0.045), rough=0.35, metallic=0.7),
    "LEATHER": dict(color=(0.05, 0.04, 0.035), rough=0.75),
    "WindowSeal": dict(color=(0.02, 0.02, 0.022), rough=0.85),
    "Seal": dict(color=(0.02, 0.02, 0.022), rough=0.85),
    "mattefloor": dict(color=(0.05, 0.05, 0.055), rough=0.8),
    "clay": dict(color=(0.09, 0.09, 0.1), rough=0.8),
    "LogoBlue": dict(color=(0.1, 0.32, 0.9), rough=0.4),
    "LogoWhite": dict(color=(0.9, 0.9, 0.92), rough=0.4),
    "LogoBlack": dict(color=(0.02, 0.02, 0.02), rough=0.4),
    "LogoSilver": dict(color=(0.7, 0.72, 0.75), rough=0.3, metallic=0.8),
}
flatten_materials(meshes, overrides=ov, sat=1.0, merge=True)
red = flat_mat("VT_TailLight", (0.9, 0.03, 0.03), 0.3, emission=(1.0, 0.03, 0.02), emission_strength=2.5)
for n in ("BMWRearLight", "BWMRearParkinglight", "BMWIndicator"):
    if n in O:
        o = O[n]
        o.data.materials.clear()
        o.data.materials.append(red)

groups = {"wheel": [], "chassis": [], "paint": [], "glass": [], "interior": [], "detail": []}
for o in meshes:
    groups[role(o)].append(o)
report["roles"] = {k: len(v) for k, v in groups.items()}

# ---------------------------------------------------------------- presupuesto de triángulos
# La pintura y los cristales se tocan poco (la decimación fuerte rompe paneles espejados); lo que no se ve (interior, discos de freno,
# rejillas) y las ruedas se reducen mucho.
RATIO = {"paint": 0.6, "glass": 0.3, "chassis": 0.5, "wheel": 0.15, "interior": 0.22, "detail": 0.2}
for k, objs in groups.items():
    for o in objs:
        decimate(o, RATIO[k] if tris(o) > 600 else 1.0)
bpy.context.view_layer.update()
report["tris_after_decimate"] = sum(tris(o) for o in meshes)
report["tris_by_role"] = {k: sum(tris(o) for o in v) for k, v in groups.items()}

# ---------------------------------------------------------------- unir por etapa (menos draw calls)
allmn = Vector((1e9,) * 3); allmx = Vector((-1e9,) * 3)
for o in meshes:
    a, b = bbox_world(o)
    allmn = Vector((min(allmn.x, a.x), min(allmn.y, a.y), min(allmn.z, a.z)))
    allmx = Vector((max(allmx.x, b.x), max(allmx.y, b.y), max(allmx.z, b.z)))
cx, cy = (allmn.x + allmx.x) / 2, (allmn.y + allmx.y) / 2
report["bbox"] = [[round(v, 2) for v in allmn], [round(v, 2) for v in allmx]]

# Ruedas: 4 grupos por cuadrante
quad = {}
for o in groups["wheel"]:
    a, b = bbox_world(o)
    c = (a + b) / 2
    quad.setdefault((c.x > cx, c.y > cy), []).append(o)
wheels = [join_objects(v, f"Wheel_{i}") for i, v in enumerate(quad.values())]
chassis = join_objects(groups["chassis"], "Chassis")
paint = join_objects(groups["paint"], "Paint")
glass = join_objects(groups["glass"], "Glass")
interior = join_objects(groups["interior"], "Interior")
detail = join_objects(groups["detail"], "Detail")
p_parts = split_by_axis(paint, 0, [cx - 1.6, cx + 1.6], "Paint") if paint else []
g_parts = split_by_axis(glass, 0, [cx]) if glass else []

m_top = flat_mat("VT_Plinth", (0.14, 0.14, 0.16), 0.7)
m_side = flat_mat("VT_PlinthSide", (0.05, 0.05, 0.06), 0.8)
slab = make_slab("Base", (allmx.x - allmn.x) + 1.0, (allmx.y - allmn.y) + 0.8, 0.35, m_top, m_side, top_z=allmn.z - 0.02, bevel=0.08, center=(cx, cy))

st = Stager(scene)
st.place(slab, 1, "terrain")
st.place(chassis, 2, "grow")
for w in wheels:
    st.place(w, 3, "drop")
for p, kind in zip(p_parts, ("slide", "grow", "slide")):
    st.place(p, 4, kind)
for g in g_parts:
    st.place(g, 5, "spin_in")
st.place(interior, 6, "pop")
st.place(detail, 7, "glow")
report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items and o.users_collection]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items and o.users_collection:
        st.discard(o)

report["animated"] = schedule(st, center=Vector((cx, cy, 0)))
preview_lighting(scene)
cam = setup_transparent_scene(scene, (cx, cy, 0.7), (-0.62, -0.6, 0.42))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
report["tris_final"] = sum(tris(o) for o in O if "vt_stage" in o.keys())
report["stages"] = write_manifest(MANIFEST, "bmw_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
