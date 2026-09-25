# CASA — 7 etapas. Trabaja sobre la COPIA (`originales_copia/casa.blend`), nunca sobre el original.
# Licencia del asset original: UNVERIFIED. Los colores/materiales y el jardín son variaciones de prototipo
# (cambiarlos NO convierte el asset en propio).
# @include lib_stages.py

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/casa.blend"
DST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/house_progression.blend"
MANIFEST = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/house_7day.manifest.json"
DAY_NAMES = ["Base", "Estructura", "Paredes", "Techo", "Ventanas y puertas", "Detalles", "Casa completa"]

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 24
scene.render.engine = "BLENDER_EEVEE"
report = {}
O = bpy.data.objects

# ---------------------------------------------------------------- limpieza del original
# Desemparentar conservando la transformación (los cortes crean objetos nuevos sin padre).
for o in list(O):
    if o.parent:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
bpy.context.view_layer.update()
# El agua de la piscina usa un modificador Ocean (50 mil polígonos): se hornea plana y se fusiona.
pool = O["Cube.011"]
pool.modifiers.clear()
dissolve_flat(pool)
# La escalera de la piscina lleva Subsurf (58 mil polígonos evaluados): se quita el modificador.
for m in list(O["Cylinder.038"].modifiers):
    O["Cylinder.038"].modifiers.remove(m)
# Animaciones de puertas del original: no se usan (las etapas llevan las suyas).
for o in list(O):
    if o.animation_data:
        o.animation_data_clear()
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

# La casa está girada ~45° en el archivo original: se gira todo el conjunto para alinearlo a los ejes (así la losa
# base y el encuadre quedan limpios). Se busca el ángulo que minimiza el rectángulo que la contiene.
pts = []
for o in O:
    if o.type == "MESH" and o.name in ("Walls", "Cube.007", "Planks", "Window.012"):
        for v in o.data.vertices:
            pts.append(o.matrix_world @ v.co)
best = (1e18, 0.0)
for deg in range(0, 90):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    xs = [p.x * ca + p.y * sa for p in pts]
    ys = [-p.x * sa + p.y * ca for p in pts]
    area = (max(xs) - min(xs)) * (max(ys) - min(ys))
    if area < best[0]:
        best = (area, a)
theta = best[1]
pc = sum(pts, Vector()) / len(pts)
Rz = Matrix.Rotation(-theta, 4, "Z")
T1 = Matrix.Translation(pc)
T0 = Matrix.Translation(-pc)
for o in O:
    if o.type in ("MESH", "LIGHT"):
        o.matrix_world = T1 @ Rz @ T0 @ o.matrix_world
bpy.context.view_layer.update()
report["aligned_deg"] = round(math.degrees(theta), 1)

# ---------------------------------------------------------------- materiales limpios (paleta contenida)
ov = {
    "Face": dict(color=(0.80, 0.77, 0.70), rough=0.85),          # muros: blanco cálido
    "Parquet": dict(color=(0.30, 0.19, 0.11), rough=0.7),        # piso interior
    "Metal": dict(color=(0.045, 0.048, 0.055), rough=0.45, metallic=0.85),   # marcos oscuros
    "Chrome": dict(color=(0.62, 0.64, 0.67), rough=0.25, metallic=0.9),
    "Glass_Mat": dict(color=(0.30, 0.52, 0.66), rough=0.05, alpha=0.32),
    "Planks": dict(color=(0.36, 0.24, 0.14), rough=0.8),         # deck
    "Stucco": dict(color=(0.55, 0.52, 0.47), rough=0.95),        # cimentación
    "DarkRed": dict(color=(0.30, 0.07, 0.06), rough=0.55),
    "Water": dict(color=(0.10, 0.42, 0.58), rough=0.08),
    "Material.016": dict(color=(0.6, 0.62, 0.65), rough=0.3, metallic=0.9),  # escalera de la piscina
}
mesh_objs = [o for o in O if o.type == "MESH"]
flatten_materials(mesh_objs, overrides=ov)
flat = lambda n, c, r=0.9, m=0.0: flat_mat("VT_" + n, c, r, m)
grass_m = flat("GardenGrass", (0.13, 0.27, 0.085), 0.95)
soil_m = flat("GardenSoil", (0.11, 0.075, 0.055), 0.95)
leaf_a, leaf_b = flat("LeafA", (0.07, 0.22, 0.09)), flat("LeafB", (0.10, 0.27, 0.10))
trunk_m = flat("Trunk", (0.15, 0.085, 0.05))

# ---------------------------------------------------------------- cortes (las piezas son grandes: se reparten por altura)
walls = split_by_axis(O["Walls"], 2, [3.1, 5.7], "Walls")          # planta baja / planta alta / cubierta
windows = split_by_axis(O["Window.012"], 2, [3.1], "Windows")      # ventanas planta baja / alta
rails = split_by_axis(O["Guardrail.001"], 2, [3.1], "Rail")        # barandas planta baja / alta

# ---------------------------------------------------------------- base propia (losa de diorama) + jardín generado
allmesh = [o for o in O if o.type == "MESH"]
mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
for o in allmesh:
    a, b = bbox_world(o)
    mn = Vector((min(mn.x, a.x), min(mn.y, a.y), min(mn.z, a.z))); mx = Vector((max(mx.x, b.x), max(mx.y, b.y), max(mx.z, b.z)))
cx, cy = (mn.x + mx.x) / 2, (mn.y + mx.y) / 2
sx, sy = (mx.x - mn.x) + 3.0, (mx.y - mn.y) + 3.0
slab = make_slab("Base", sx, sy, 0.7, grass_m, soil_m, top_z=-0.04, bevel=0.12, center=(cx, cy))
garden = []
rnd = random.Random(5)
for i in range(9):   # arbustos en el borde
    ang = rnd.uniform(0, 6.28)
    ex, ey = sx / 2 - 1.5, sy / 2 - 1.5
    x = cx + max(-ex, min(ex, math.cos(ang) * ex * 1.4))
    y = cy + max(-ey, min(ey, math.sin(ang) * ey * 1.4))
    garden.append(make_bush(f"Bush.{i:02d}", (x, y, -0.04), rnd.uniform(0.7, 1.15), leaf_a if i % 2 else leaf_b, seed=i))
for i, (px, py, h) in enumerate([(-0.44, 0.44, 5.5), (0.42, 0.40, 4.2), (-0.40, -0.42, 4.8), (0.45, -0.40, 6.0)]):
    garden.append(make_pine(f"Pine.{i:02d}", (cx + px * sx, cy + py * sy, -0.04), h, leaf_a, trunk_m, layers=4, seed=i))

# ---------------------------------------------------------------- reparto por etapa
st = Stager(scene)
st.place(slab, 1, "terrain")
st.place(O["Cube.007"], 1, "grow")                       # cimentación
st.place(O["Planks"], 1, "pop")                          # deck
st.place(walls[0], 2, "grow")                            # planta baja
st.place(walls[1], 3, "grow")                            # planta alta
roof_m = flat("Roof", (0.13, 0.14, 0.16), 0.6)
for slot in walls[2].material_slots:
    slot.material = roof_m                                # cubierta en pizarra
st.place(walls[2], 4, "spin_in")                         # cubierta
st.place(O["Weatherboard"], 4, "spin_in")
for n in ("MainDoor", "MainDoorFrame", "DoorDining", "SlidingDoorLiving", "SlideRailLiving"):
    st.place(O[n], 5, "slide")
st.place(windows[0], 5, "pop")
st.place(windows[1], 6, "pop")
st.place(rails[0], 6, "pop"); st.place(rails[1], 6, "pop")
for n in ("MainDoorHandle", "MainDoorWeatherboard", "DoorFrameBathroom", "DoorFrameChild1", "DoorFrameChild2", "DoorFrameParents",
          "DoorToilet", "SlidingDoorBedroom", "SlideRailBedroom", "Guardrail"):
    st.place(O[n], 6, "pop")
st.place(pool, 7, "rise")
st.place(O["Cylinder.038"], 7, "pop")
for g in garden:
    st.place(g, 7, "pop")
report["unassigned"] = [o.name for o in O if o.type == "MESH" and o.name not in st.items]
for o in list(O):
    if o.type == "MESH" and o.name not in st.items:
        st.discard(o)
for o in list(O):
    if o.type in ("LIGHT",):
        o.hide_render = False

# ---------------------------------------------------------------- animación + escena transparente
center = Vector((cx, cy, 0))
report["animated"] = schedule(st, center=center)
cam = setup_transparent_scene(scene, (cx, cy, 2.0), (-0.56, -0.64, 0.53))
fit_camera(scene, cam, [o for o in O if "vt_stage" in o.keys()])
scene.frame_start = 0
scene.frame_end = W(7) + 60
for lo in [o for o in O if o.type == "LIGHT"]:
    lo.data.energy = lo.data.energy * 1.0
report["stages"] = write_manifest(MANIFEST, "house_progression_001", DAY_NAMES, st)
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
