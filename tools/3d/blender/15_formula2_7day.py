# FORMULA 2 (GYM) — 7 etapas. Trabaja sobre la COPIA (`originales_copia/Formula 2.blend`), nunca sobre el original.
# Licencia/origen del asset original: UNVERIFIED (el archivo no trae texto de licencia). El modelo es un único cuerpo
# (Geometry Nodes) con 12 materiales: se hornea, se decima y se reparte por material y por zona (morro / centro / trasera).
# Color rojo de carrocería, pintura y base propia = adaptaciones de prototipo (NO lo convierten en un asset propio).
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/Formula 2.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/formula2_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/formula2_7day.manifest.json"
DAY_NAMES = ["Base", "Chasis", "Ruedas", "Carrocería", "Morro y alerón delantero", "Trasera y alerón", "Cabina y detalles"]

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 24
scene.render.engine = "BLENDER_EEVEE"
report = {}
O = bpy.data.objects
for o in [x for x in O if x.type in ("CAMERA", "LIGHT")]:
    bpy.data.objects.remove(o, do_unlink=True)
for o in list(O):
    if o.animation_data:
        o.animation_data_clear()
bpy.context.view_layer.update()


def decimate(ob, ratio):
    if ob is None or ob.type != "MESH" or len(ob.data.polygons) < 60:
        return
    m = ob.modifiers.new("Dec", "DECIMATE")
    m.ratio = ratio
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=m.name)


def tris(ob):
    return sum(max(len(p.vertices) - 2, 1) for p in ob.data.polygons) if ob else 0


# ---------------------------------------------------------------- hornear (Auto Smooth → malla) y materiales planos
body_src, tyre_src = O["Cube"], [O["Cylinder"], O["Cylinder.003"]]
for o in [body_src] + tyre_src:
    apply_modifiers(o)
bpy.context.view_layer.update()
report["tris_raw"] = tris(body_src) + sum(tris(t) for t in tyre_src)

ov = {
    "Body": dict(color=(0.58, 0.045, 0.04), rough=0.32, metallic=0.25),
    "Dark": dict(color=(0.05, 0.05, 0.058), rough=0.55, metallic=0.3),
    "Dark 2": dict(color=(0.06, 0.06, 0.07), rough=0.5, metallic=0.35),
    "Seat": dict(color=(0.03, 0.03, 0.035), rough=0.85),
    "Front Wing": dict(color=(0.07, 0.07, 0.08), rough=0.4, metallic=0.4),
    "Exhaust": dict(color=(0.55, 0.42, 0.30), rough=0.35, metallic=0.9),
    "Mirror": dict(color=(0.72, 0.74, 0.78), rough=0.15, metallic=0.9),
    "Brakelamp": dict(color=(0.1, 0.1, 0.1), rough=0.5),
    "Brakelamp Glass": dict(color=(1.0, 0.05, 0.05), rough=0.3, emission=(1.0, 0.05, 0.03), emission_strength=4.0),
    "Caliper": dict(color=(0.62, 0.64, 0.68), rough=0.3, metallic=0.85),
    "Caliper 2": dict(color=(0.05, 0.05, 0.06), rough=0.5, metallic=0.4),
    "Caliper 3": dict(color=(1.0, 0.72, 0.08), rough=0.4),
    "Tyres": dict(color=(0.035, 0.035, 0.04), rough=0.9),
    "Rims": dict(color=(0.7, 0.72, 0.75), rough=0.28, metallic=0.85),
}
flatten_materials([body_src] + tyre_src, overrides=ov, sat=1.0, merge=False)

# ---------------------------------------------------------------- cortes
parts = split_by_material(body_src, "Car")
by_name = {}
for mi, ob in parts.items():
    slot_names = [s.material.name for s in ob.material_slots if s.material]
    # el material real de estas caras: el de la ranura `mi` original
    by_name[mi] = ob
mat_of = {}
for mi, ob in by_name.items():
    idx = ob.data.polygons[0].material_index if len(ob.data.polygons) else 0
    mat_of[mi] = ob.material_slots[idx].material.name if idx < len(ob.material_slots) and ob.material_slots[idx].material else str(mi)
report["material_map"] = {str(k): v for k, v in mat_of.items()}


def find(prefix):
    for mi, n in mat_of.items():
        if n.replace("VT_", "").startswith(prefix):
            return by_name[mi]
    return None


def find_exact(*names):
    outs = []
    for mi, n in mat_of.items():
        if n.replace("VT_", "") in names:
            outs.append(by_name[mi])
    return outs


body = find_exact("Body")[0]
dark2 = find_exact("Dark 2")[0]
front_wing = find_exact("Front Wing")[0]
dark = find_exact("Dark")[0]
brake_dark = find_exact("Caliper 2")[0]
calipers = find_exact("Caliper")
details_src = find_exact("Seat", "Exhaust", "Mirror", "Brakelamp", "Brakelamp Glass", "Caliper 3")

# La carrocería blanca se reparte: trasera / centro / morro (por x de cada cara).
b_rear, b_mid, b_nose = split_by_axis(body, 0, [-2.3, 2.5], "Body")
d_rear, d_main = split_by_axis(dark2, 0, [-3.0], "Chassis")
for ob, r in ((b_rear, 0.6), (b_mid, 0.55), (b_nose, 0.6), (d_rear, 0.6), (d_main, 0.6), (front_wing, 0.5), (brake_dark, 0.6)):
    decimate(ob, r)

# Ruedas: 4 islas (cada una con neumático + llanta)
tyres_all = join_objects(tyre_src, "Tyres")
wheels = split_islands(tyres_all, "Wheel")
report["wheels"] = len(wheels)
for w in wheels:
    decimate(w, 0.5)
chassis_parts = [o for o in (d_main, dark) if o]
chassis = join_objects(chassis_parts, "Chassis") if chassis_parts else None
details = join_objects(details_src, "Details")
brakes = join_objects([o for o in ([brake_dark] + calipers) if o], "Brakes")
rear_all = join_objects([o for o in (b_rear, d_rear) if o], "Rear")

# ---------------------------------------------------------------- base propia
allmn = Vector((1e9,) * 3); allmx = Vector((-1e9,) * 3)
for o in [chassis, b_mid, b_nose, front_wing, rear_all] + wheels:
    a, b = bbox_world(o)
    allmn = Vector((min(allmn.x, a.x), min(allmn.y, a.y), min(allmn.z, a.z)))
    allmx = Vector((max(allmx.x, b.x), max(allmx.y, b.y), max(allmx.z, b.z)))
cx, cy = (allmn.x + allmx.x) / 2, (allmn.y + allmx.y) / 2
m_top = flat_mat("VT_Plinth", (0.15, 0.15, 0.17), 0.7)
m_side = flat_mat("VT_PlinthSide", (0.06, 0.06, 0.07), 0.8)
slab = make_slab("Base", (allmx.x - allmn.x) + 0.9, (allmx.y - allmn.y) + 0.7, 0.35, m_top, m_side, top_z=allmn.z - 0.02, bevel=0.08, center=(cx, cy))

# ---------------------------------------------------------------- reparto
st = Stager(scene)
st.place(slab, 1, "terrain")
st.place(chassis, 2, "grow")
st.place(brakes, 3, "pop")
for w in wheels:
    st.place(w, 3, "drop")
st.place(b_mid, 4, "grow")
st.place(b_nose, 5, "slide")
st.place(front_wing, 5, "slide")
st.place(rear_all, 6, "grow")
st.place(details, 7, "glow")
report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items:
        st.discard(o)

report["animated"] = schedule(st, center=Vector((cx, cy, 0)))
preview_lighting(scene)
cam = setup_transparent_scene(scene, (cx, cy, 1.0), (0.62, -0.6, 0.45))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
report["tris_final"] = sum(tris(o) for o in O if "vt_stage" in o.keys())
report["stages"] = write_manifest(MANIFEST, "formula2_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
