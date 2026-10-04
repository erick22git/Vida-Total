# CUERPO PARA RANGOS (hombre) -> GLB con una pieza por región muscular.
#
#   blender -b --python tools/3d/blender/70_rango_cuerpo.py
#
# Entrada (SOLO LECTURA, nunca se guarda sobre ella): `biblioteca de assets/rangos/BlenRig4_01_NickZ.blend`
#   (único .blend de esa carpeta: personaje BlenRig 4 "NickZ", cuerpo H_M_A_nickZ).
# Trabaja sobre una COPIA: guarda `biblioteca de assets/_trabajo/rango_cuerpo_m.blend` y exporta
#   `public/models/rango_cuerpo_m_001_meshopt.glb` (+ un render de control por región en _trabajo/export).
#
# Qué hace:
#  1. Lee el cuerpo YA deformado (pose actual, modificadores evaluados; la subdivisión Multires está apagada en la
#     vista, así que se usa la malla base) y los segmentos del esqueleto en esa pose.
#  2. Reparte cada vértice en una REGIÓN según la taxonomía real del dataset (Pecho, Espalda, Hombros, Biceps, Triceps,
#     Antebrazo, Abdomen, Gluteos, Cuadriceps, Femoral, Aductores, Abductores, Pantorrilla + Neutro para cabeza, manos
#     y pies). La malla es lisa y NO trae músculos separados: las regiones salen de geometría (hueso más cercano,
#     posición a lo largo del hueso y hacia dónde mira la superficie), no de grupos de vértices (los 127 grupos del
#     archivo son de dedos, pies y cara, no del torso).
#  3. Una pieza (objeto) y un material por región, con normales suaves tomadas del cuerpo ENTERO (sin costuras).
#  4. Exporta GLB con Meshopt: sin esqueleto, sin animación, sin luces ni cámaras; nodos `reg_<Región>`.
import bpy, os, json, math, shutil, time
from mathutils import Vector

ROOT = "C:/Erick/app movil/vida-total-web/"
SRC = ROOT + "biblioteca de assets/rangos/BlenRig4_01_NickZ.blend"
WORK = ROOT + "biblioteca de assets/_trabajo/rango_cuerpo_m.blend"
EXPORT_DIR = ROOT + "biblioteca de assets/_trabajo/export/"
GLB_TMP = EXPORT_DIR + "rango_cuerpo_m_001_meshopt.glb"
GLB_OUT = ROOT + "public/models/rango_cuerpo_m_001_meshopt.glb"
PREVIEW = EXPORT_DIR + "rango_cuerpo_m_regiones"
os.makedirs(EXPORT_DIR, exist_ok=True)
SUBDIV = 1  # niveles de subdivisión del cuerpo (1 = ~40 000 triángulos)

REGIONS = ["Pecho", "Espalda", "Hombros", "Biceps", "Triceps", "Antebrazo", "Abdomen", "Gluteos", "Cuadriceps",
           "Femoral", "Aductores", "Abductores", "Pantorrilla", "Neutro"]
PREVIEW_COLORS = {  # solo para el render de control
    "Pecho": (0.90, 0.25, 0.25), "Espalda": (0.25, 0.45, 0.90), "Hombros": (0.95, 0.75, 0.20), "Biceps": (0.20, 0.80, 0.50),
    "Triceps": (0.60, 0.30, 0.85), "Antebrazo": (0.95, 0.50, 0.15), "Abdomen": (0.95, 0.90, 0.35), "Gluteos": (0.90, 0.35, 0.65),
    "Cuadriceps": (0.20, 0.75, 0.85), "Femoral": (0.50, 0.65, 0.20), "Aductores": (0.75, 0.55, 0.40), "Abductores": (0.40, 0.40, 0.90),
    "Pantorrilla": (0.30, 0.90, 0.30), "Neutro": (0.55, 0.55, 0.55),
}

# ---------------------------------------------------------------- 1) leer el cuerpo evaluado y el esqueleto
bpy.ops.wm.open_mainfile(filepath=SRC)
src_hash = None
body = bpy.data.objects["H_M_A_nickZ"]
arm = bpy.data.objects["blenrig"]
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg)
me_ev = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
mw = body.matrix_world
# Una subdivisión (Catmull-Clark) para que los bordes entre regiones salgan finos en vez de escalonados, y la
# superficie más lisa. Se hace sobre una copia temporal del cuerpo ya evaluado.
_tmp_ob = bpy.data.objects.new("_tmp_sub", me_ev)
bpy.context.scene.collection.objects.link(_tmp_ob)
_sub = _tmp_ob.modifiers.new("sub", "SUBSURF")
_sub.levels = SUBDIV
_sub.render_levels = SUBDIV
bpy.context.view_layer.update()
dg2 = bpy.context.evaluated_depsgraph_get()
me_ev = bpy.data.meshes.new_from_object(_tmp_ob.evaluated_get(dg2), preserve_all_data_layers=False, depsgraph=dg2)
verts = [tuple(mw @ v.co) for v in me_ev.vertices]
polys = [tuple(p.vertices) for p in me_ev.polygons]
bw = arm.matrix_world


def bone(name):
    pb = arm.pose.bones[name]
    return (bw @ pb.head, bw @ pb.tail)


SEG = {}
SEG["torso"] = (bone("pelvis")[0], bone("spine_3")[1], 0.19)
SEG["pelvis"] = (bone("pelvis")[0], bone("pelvis")[1], 0.17)
SEG["neck"] = (bone("neck_1")[0], bone("neck_3")[1], 0.06)
SEG["head"] = (bone("head")[0], bone("head")[1], 0.11)
for s in ("L", "R"):
    SEG["clavi." + s] = (bone("clavi." + s)[0], bone("clavi." + s)[1], 0.035)
    SEG["arm." + s] = (bone("arm." + s)[0], bone("forearm." + s)[0], 0.065)
    SEG["forearm." + s] = (bone("forearm." + s)[0], bone("hand_fk." + s)[0], 0.05)
    SEG["hand." + s] = (bone("hand_fk." + s)[0], bone("hand_fk." + s)[1] + (bone("hand_fk." + s)[1] - bone("hand_fk." + s)[0]) * 3, 0.045)
    SEG["thigh." + s] = (bone("thigh." + s)[0], bone("calf." + s)[0], 0.10)
    SEG["calf." + s] = (bone("calf." + s)[0], bone("foot." + s)[0], 0.065)
    SEG["foot." + s] = (bone("foot." + s)[0], bone("foot." + s)[1], 0.05)

# ---------------------------------------------------------------- 2) normales suaves del cuerpo entero
tmp = bpy.data.meshes.new("tmp_full")
tmp.from_pydata(verts, [], polys)
tmp.update()
vnormals = [tuple(v.normal) for v in tmp.vertices]
# Centro de la malla en cada altura (para decidir frente/espalda en los costados): el cuerpo mira hacia -Y.
Y_AXIS = -0.045


def seg_param(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.dot(ab))))
    return t, (a + ab * t - p).length


def classify(i):
    p = Vector(verts[i])
    n = Vector(vnormals[i])
    best = None
    for name, (a, b, r) in SEG.items():
        t, d = seg_param(p, a, b)
        score = d / r
        if best is None or score < best[0]:
            best = (score, name, t)
    _, name, t = best
    side = name.split(".")[1] if "." in name else ("L" if p.x >= 0 else "R")
    s = 1.0 if p.x >= 0 else -1.0
    base = name.split(".")[0]
    z = p.z
    front = n.y < -0.2 or (abs(n.y) <= 0.2 and p.y < Y_AXIS)

    if base == "head" or z > 1.62:
        return "Neutro"
    if base == "neck":
        return "Hombros"
    if base == "clavi":
        base = "torso"  # la clavícula se reparte con las mismas reglas de altura que el tronco
    if base == "hand" or base == "foot":
        return "Neutro"
    if base == "forearm":
        return "Antebrazo"
    if base == "arm":
        if t < 0.42:
            return "Hombros"  # deltoides
        return "Biceps" if n.y < 0 else "Triceps"
    if base == "calf":
        return "Pantorrilla"
    if base == "thigh":
        n_in = -n.x * s
        n_out = n.x * s
        if n.y > 0.15 and z > 0.84:
            return "Gluteos"
        if n_in > 0.38 and 0.08 < t < 0.8:
            return "Aductores"
        if n_out > 0.6 and t < 0.40:
            return "Abductores"
        return "Cuadriceps" if n.y < 0 else "Femoral"
    if base == "pelvis":
        if z <= 1.07:
            if not front:
                return "Gluteos"
            return "Abdomen" if z > 0.97 else "Neutro"
    # torso (y pelvis alta): los límites son LÍNEAS de altura, así los bordes salen rectos
    if z >= (1.48 if front else 1.40):
        return "Hombros"  # trapecio, clavículas y base del cuello (el trapecio baja más por la espalda)
    if z >= 1.27:
        return "Pecho" if front else "Espalda"
    if z >= 1.06 and not front:
        return "Espalda"
    if z >= 1.06:
        return "Abdomen"
    if not front and z > 0.84:
        return "Gluteos"
    return "Abdomen" if (front and z > 0.97) else "Neutro"


reg_of_vert = [classify(i) for i in range(len(verts))]

# ---------------------------------------------------------------- 3) regiones por polígono + limpieza de manchas
poly_reg = []
for pv in polys:
    cnt = {}
    for vi in pv:
        cnt[reg_of_vert[vi]] = cnt.get(reg_of_vert[vi], 0) + 1
    poly_reg.append(max(cnt.items(), key=lambda kv: kv[1])[0])
edge_polys = {}
for pi, pv in enumerate(polys):
    for k in range(len(pv)):
        e = tuple(sorted((pv[k], pv[(k + 1) % len(pv)])))
        edge_polys.setdefault(e, []).append(pi)
neigh = [set() for _ in polys]
for e, ps in edge_polys.items():
    for a in ps:
        for b in ps:
            if a != b:
                neigh[a].add(b)
for _ in range(3):
    nxt = list(poly_reg)
    for pi in range(len(polys)):
        cnt = {}
        for q in neigh[pi]:
            cnt[poly_reg[q]] = cnt.get(poly_reg[q], 0) + 1
        if cnt:
            r, c = max(cnt.items(), key=lambda kv: kv[1])
            if c > len(neigh[pi]) / 2 and r != poly_reg[pi]:
                nxt[pi] = r
    poly_reg = nxt

# ---------------------------------------------------------------- 4) escena nueva: una pieza por región
src_blend_size = os.path.getsize(SRC)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = bpy.data.collections.new("BODY")
scene.collection.children.link(col)

# pies en z=0 y centrado en x/y (el visor lo encuadra solo)
minz = min(v[2] for v in verts)
cy = sum(v[1] for v in verts) / len(verts)
verts = [(v[0], v[1] - cy, v[2] - minz) for v in verts]

tris_by_region = {}
for reg in REGIONS:
    idx = [pi for pi, r in enumerate(poly_reg) if r == reg]
    if not idx:
        continue
    used = {}
    nv, nvn, nf = [], [], []
    for pi in idx:
        face = []
        for vi in polys[pi]:
            if vi not in used:
                used[vi] = len(nv)
                nv.append(verts[vi])
                nvn.append(vnormals[vi])
            face.append(used[vi])
        nf.append(tuple(face))
    me = bpy.data.meshes.new("reg_" + reg)
    me.from_pydata(nv, [], nf)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    try:
        me.normals_split_custom_set_from_vertices([Vector(n) for n in nvn])
    except Exception as e:  # versiones sin la función: normales automáticas
        print("##WARN normales personalizadas:", e)
    mat = bpy.data.materials.new("region_" + reg)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.62, 0.62, 0.64, 1.0)  # neutro: el visor lo tiñe con el rango
    bsdf.inputs["Roughness"].default_value = 0.55
    mat.diffuse_color = PREVIEW_COLORS[reg] + (1.0,)  # solo para el render de control
    me.materials.append(mat)
    ob = bpy.data.objects.new("reg_" + reg, me)
    col.objects.link(ob)
    ob["vt_region"] = reg
    t = sum(max(0, len(f) - 2) for f in nf)
    tris_by_region[reg] = t

total_tris = sum(tris_by_region.values())
print("##REGIONES", json.dumps(tris_by_region, ensure_ascii=True))
print("##TRIS_TOTAL", total_tris)

# ---------------------------------------------------------------- 5) render de control (colores por región)
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.render.resolution_x, scene.render.resolution_y = 700, 1000
world = bpy.data.worlds.new("w")
world.color = (0.05, 0.05, 0.05)
scene.world = world
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 2.35
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
zmid = (max(v[2] for v in verts)) / 2
for nm, loc, rot in [("frente", (0, -10, zmid), (math.radians(90), 0, 0)),
                     ("espalda", (0, 10, zmid), (math.radians(90), 0, math.radians(180))),
                     ("lado", (10, 0, zmid), (math.radians(90), 0, math.radians(90)))]:
    cam.location, cam.rotation_euler = loc, rot
    scene.render.filepath = PREVIEW + "_" + nm + ".png"
    bpy.ops.render.render(write_still=True)
scene.collection.objects.unlink(cam)

# ---------------------------------------------------------------- 6) guardar la COPIA y exportar el GLB
bpy.ops.wm.save_as_mainfile(filepath=WORK)
for ob in bpy.data.objects:
    ob.select_set(False)
view = bpy.context.view_layer
first = next(o for o in col.objects)
view.objects.active = first
t0 = time.time()
r = bpy.ops.export_scene.gltf(
    filepath=GLB_TMP, export_format="GLB", collection="BODY", export_apply=False, export_yup=True, export_extras=True,
    export_lights=False, export_cameras=False, export_materials="EXPORT", export_animations=False, export_skins=False,
    export_morph=False, export_normals=True, export_meshopt_compression_enable=True, use_visible=True,
)
print("##EXPORT", list(r), round(time.time() - t0, 1), "s", round(os.path.getsize(GLB_TMP) / 1024, 1), "KB")
shutil.copyfile(GLB_TMP, GLB_OUT)
print("##GLB", GLB_OUT)
