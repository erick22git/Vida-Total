# CUARTO — 7 etapas. Trabaja sobre la COPIA (`originales_copia/cuarto.blend`), nunca sobre el original.
# Licencia del asset original: UNVERIFIED. Materiales planos (sin texturas), agrupación de piezas y reparto por
# etapas son adaptaciones de prototipo (NO lo convierten en un asset propio).
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/cuarto.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/room_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/room_7day.manifest.json"
DAY_NAMES = ["Base", "Paredes", "Piso", "Muebles", "Decoración", "Iluminación", "Cuarto completo"]

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

# ---------------------------------------------------------------- fuera lo que no es el cuarto
for n in ("Plane.021",):                       # suelo infinito de 200 m
    if n in O:
        bpy.data.objects.remove(O[n], do_unlink=True)
for o in [x for x in O if x.type in ("CAMERA", "LIGHT")]:
    bpy.data.objects.remove(o, do_unlink=True)

# Curvas sueltas (cables muy finos): se descartan (no aportan a la silueta y solo suman objetos).
report["curves_removed"] = len([x for x in O if x.type in ("CURVE", "FONT", "SURFACE")])
for o in [x for x in O if x.type in ("CURVE", "FONT", "SURFACE")]:
    bpy.data.objects.remove(o, do_unlink=True)

# ---------------------------------------------------------------- geometría pesada
def decimate(ob, ratio):
    if ob.type == "MESH" and len(ob.data.polygons) > 40:
        m = ob.modifiers.new("Dec", "DECIMATE")
        m.ratio = ratio
        with bpy.context.temp_override(object=ob, active_object=ob):
            bpy.ops.object.modifier_apply(modifier=m.name)

for o in [x for x in O if x.type == "MESH"]:
    for m in o.modifiers:
        if m.type == "SUBSURF":
            m.levels = 1; m.render_levels = 1
        elif m.type == "NODES":
            pass
    bad = [m for m in o.modifiers if m.type == "NODES"]
    for m in bad:
        o.modifiers.remove(m)
    apply_modifiers(o)
big = sorted([o for o in O if o.type == "MESH"], key=lambda o: -len(o.data.polygons))[:3]
report["heaviest_before"] = [(o.name, len(o.data.polygons)) for o in big]
for o in big:
    if len(o.data.polygons) > 4000:
        decimate(o, max(0.03, 2500 / len(o.data.polygons)))
report["heaviest_after"] = [(o.name, len(o.data.polygons)) for o in big]

# ---------------------------------------------------------------- materiales planos (sin texturas)
meshes = [o for o in O if o.type == "MESH"]
n_img = len(bpy.data.images)
ov = {
    "Material.034": dict(color=(0.33, 0.34, 0.40), rough=0.9),      # tela de los sofás
    "Material.036": dict(color=(0.30, 0.30, 0.33), rough=0.9),      # paredes
    "Material.030": dict(color=(0.26, 0.15, 0.085), rough=0.6),     # piso de madera
}
flatten_materials(meshes, overrides=ov, sat=0.95)
report["images_in_file"] = n_img

# ---------------------------------------------------------------- cascarón: suelo / paredes
shell = O["Plane"]
parts = split_by_material(shell, "Shell")
floor_o, wall_o = None, None
for mi, o in parts.items():
    nz = sum(p.normal.z for p in o.data.polygons) / max(len(o.data.polygons), 1)
    if nz > 0.5:
        floor_o = o
    else:
        wall_o = o
if floor_o is None or wall_o is None:
    ks = list(parts.values())
    floor_o, wall_o = ks[0], ks[-1]
report["shell"] = {"floor_polys": len(floor_o.data.polygons), "wall_polys": len(wall_o.data.polygons)}
fmn, fmx = bbox_world(floor_o)
wmn, wmx = bbox_world(wall_o)
allmn = Vector((min(fmn.x, wmn.x), min(fmn.y, wmn.y), min(fmn.z, wmn.z)))
allmx = Vector((max(fmx.x, wmx.x), max(fmx.y, wmx.y), max(fmx.z, wmx.z)))

# ---------------------------------------------------------------- agrupar por colección y por tamaño
meshes = [o for o in O if o.type == "MESH" and o not in (floor_o, wall_o)]
def coll(o):
    return o.users_collection[0].name if o.users_collection else ""
chair_names = [o.name for o in meshes if coll(o) == "chair"]
chair = join_objects([O[n] for n in chair_names], "Chair") if chair_names else None
meshes = [o for o in O if o.type == "MESH" and o not in (floor_o, wall_o)]

def is_emissive(o):
    for s in o.material_slots:
        if s.material and s.material.node_tree:
            for n in s.material.node_tree.nodes:
                if n.bl_idname == "ShaderNodeBsdfPrincipled" and n.inputs["Emission Strength"].default_value > 0.5:
                    return True
    return False

def size_of(o):
    a, b = bbox_world(o)
    return max(b.x - a.x, b.y - a.y, b.z - a.z), a, b

large, medium, small = [], [], []
for o in meshes:
    sz, a, b = size_of(o)
    if sz >= 1.3:
        large.append(o)
    elif sz >= 0.5:
        medium.append(o)
    else:
        small.append(o)
report["sizes"] = {"large": len(large), "medium": len(medium), "small": len(small)}
emissive_small = [o for o in small if is_emissive(o)]
plain_small = [o for o in small if not is_emissive(o)]
med_clusters = cluster_join(medium, 2.6, "Decor")
small_clusters = cluster_join(plain_small, 2.2, "Detail")
glow_clusters = cluster_join(emissive_small, 2.6, "Glow")
# Presupuesto móvil: los grupos pesados se simplifican (sin borrar piezas).
for grp in med_clusters + small_clusters + glow_clusters + large:
    n = len(grp.data.polygons)
    if n > 3500:
        decimate(grp, max(0.35, 3500 / n))
report["poly_after_decimate"] = sum(len(o.data.polygons) for o in med_clusters + small_clusters + glow_clusters + large)

# ---------------------------------------------------------------- base propia (plinto de diorama)
plinth_top = allmn.z - 0.02
m_plinth = flat_mat("VT_Plinth", (0.10, 0.10, 0.11), 0.85)
m_plinth_side = flat_mat("VT_PlinthSide", (0.06, 0.06, 0.07), 0.85)
cx, cy = (allmn.x + allmx.x) / 2, (allmn.y + allmx.y) / 2
slab = make_slab("Base", (allmx.x - allmn.x) + 0.8, (allmx.y - allmn.y) + 0.8, 0.5, m_plinth, m_plinth_side, top_z=plinth_top, bevel=0.06, center=(cx, cy))

# ---------------------------------------------------------------- reparto
st = Stager(scene)
st.place(slab, 1, "terrain")
st.place(wall_o, 2, "grow")
st.place(floor_o, 3, "rise")
for o in large:
    st.place(o, 4, "drop")
if chair:
    st.place(chair, 4, "drop")
for o in med_clusters:
    st.place(o, 5, "pop")
for o in small_clusters:
    st.place(o, 6, "pop")
for o in glow_clusters:
    st.place(o, 7, "glow")
report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items:
        st.discard(o)

# ---------------------------------------------------------------- animación + escena transparente
report["animated"] = schedule(st, center=Vector((cx, cy, 0)))
preview_lighting(scene, sun_energy=3.0, world_color=(0.5, 0.5, 0.55), world_strength=1.0)
cam = setup_transparent_scene(scene, (cx, cy, 2.0), (-0.56, -0.64, 0.53))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
report["stages"] = write_manifest(MANIFEST, "room_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
