# CUERPO DE RANGOS DESDE LO PINTADO A MANO — rangos_cuerpo_PINTAR.blend -> acabado + GLB.
#
#   blender -b --python tools/3d/blender/71_rango_cuerpo_pintado.py
#
# Entrada : biblioteca de assets/rangos/trabajo/rangos_cuerpo_PINTAR.blend  (NO se modifica)
#           MaleBASE con 15 materiales RG_* pintados por caras a mano (ambos lados).
# Salida  : biblioteca de assets/rangos/trabajo/rangos_cuerpo_ACABADO.blend  (look con el color del rango)
#           biblioteca de assets/rangos/trabajo/control_acabado_*.png        (renders de control)
#           public/models/rango_cuerpo_m_001_meshopt.glb                     (mismo nombre que ya usa la app)
#
# QUÉ HACE
#   1. Región de cada cara = material pintado (RG_cuello_trapecio -> Cuello, RG_base -> Neutro).
#   2. Pesos por vértice (_REGA.._REGD, mismo orden que 70_rango_cuerpo.py / REGION_KEYS): fracción del área de las
#      caras de cada región que tocan el vértice + unas pasadas de suavizado => el límite entre músculos es una curva lisa.
#   3. Distancia de cada vértice al borde más cercano entre regiones (Dijkstra por las aristas, en metros) y con ella,
#      por vértice, el atributo _RIM (FLOAT_COLOR):
#        R = multiplicador de color: ~0 (negro) justo en el borde, subiendo suave hasta 1 hacia adentro (borde NEGRO
#            DIFUMINADO) x una sombra/brillo sutil que oscurece levemente hacia el borde y aclara hacia el centro del
#            músculo (distinta para cada grupo, porque depende del tamaño de cada región).
#        G = máscara de brillo (pico en el centro de cada músculo) — toque sutil de especular.
#        B = solo la sombra suave (sin el borde), por si se quiere usar aparte.
#   4. Look en Blender: atributos de color preview_<rango> (hierro, cobre, plata, oro, platino, esmeralda, diamante,
#      campeón, simétrico) = color del rango x _RIM.R, y material que los muestra. Renders de control.
#   5. GLB Meshopt: pesos + _RIM. El cuerpo queda de frente a +Z (glTF), 1.84 m, pies en y=0 (como el modelo anterior).
import bpy, os, json, math, shutil, time, heapq
import numpy as np

ROOT = "C:/Erick/app movil/vida-total-web/"
SRC = ROOT + "biblioteca de assets/rangos/trabajo/rangos_cuerpo_PINTAR.blend"
OUT_BLEND = ROOT + "biblioteca de assets/rangos/trabajo/rangos_cuerpo_ACABADO%s.blend" % os.environ.get("VT_OUT_TAG", "")
PREVIEW = ROOT + "biblioteca de assets/rangos/trabajo/control_acabado" + os.environ.get("VT_OUT_TAG", "")
EXPORT_DIR = ROOT + "biblioteca de assets/_trabajo/export/"
GLB_TMP = EXPORT_DIR + "rango_cuerpo_m_001_meshopt.glb"
GLB_PREV = EXPORT_DIR + "rango_cuerpo_m_001_meshopt_ANTERIOR.glb"
GLB_OUT = ROOT + os.environ.get("VT_GLB_OUT", "public/models/rango_cuerpo_m_001_meshopt.glb")
os.makedirs(EXPORT_DIR, exist_ok=True)

TARGET_HEIGHT = 1.84      # m (igual que el modelo anterior del repo)
SMOOTH_PASSES = 6         # suavizado de pesos
# Borde oscuro. Se pueden sobreescribir con variables de entorno (VT_RIM_WIDTH, ...) para probar sin editar el archivo.
RIM_WIDTH = float(os.environ.get("VT_RIM_WIDTH", 0.034))      # m: ancho del degradado del borde (por lado)
RIM_BLUR_PASSES = int(os.environ.get("VT_RIM_BLUR", 4))       # difumina el degradado
RIM_FLOOR = float(os.environ.get("VT_RIM_FLOOR", 0.42))       # multiplicador MÍNIMO en el borde (0 = negro puro)
SHADE_MIN = float(os.environ.get("VT_SHADE_MIN", 0.88))       # sombra sutil: multiplicador hacia el borde (1.0 = centro)
RIM_PLATEAU = float(os.environ.get("VT_RIM_PLATEAU", 0.003))  # m: meseta oscura fina justo en el borde
OUT_TAG = os.environ.get("VT_OUT_TAG", "")                    # sufijo para no pisar la salida al probar
REGIONS = [
    "Pecho", "Espalda", "Hombros", "Biceps",
    "Triceps", "Antebrazo", "Abdomen", "Gluteos",
    "Cuadriceps", "Femoral", "Aductores", "Abductores",
    "Pantorrilla", "Cuello", "Neutro",
]
MAT_TO_REGION = {
    "RG_pecho": "Pecho", "RG_hombros": "Hombros", "RG_biceps": "Biceps", "RG_triceps": "Triceps",
    "RG_antebrazo": "Antebrazo", "RG_abdomen": "Abdomen", "RG_espalda": "Espalda",
    "RG_cuello_trapecio": "Cuello", "RG_gluteos": "Gluteos", "RG_cuadriceps": "Cuadriceps",
    "RG_femoral": "Femoral", "RG_aductores": "Aductores", "RG_abductores": "Abductores",
    "RG_pantorrilla": "Pantorrilla", "RG_base": "Neutro",
}
# Colores de rango (src/lib/gym/rank-config.ts)
RANKS = {
    "hierro": "#8a8a95", "cobre": "#a26244", "plata": "#92a0b1", "oro": "#c09148", "platino": "#8fe3d9",
    "esmeralda": "#2ecc71", "diamante": "#7dd3fc", "campeon": "#a855f7", "simetrico": "#facc15",
}
SKIN_HEX = "#51545d"
NEUTRO = REGIONS.index("Neutro")


def hex_lin(h):
    c = [int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5)]
    return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c])


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


# ═══════════════ 1. LEER LO PINTADO ═══════════════
bpy.ops.wm.open_mainfile(filepath=SRC)
ob = bpy.data.objects["MaleBASE"]
dg = bpy.context.evaluated_depsgraph_get()
ev = ob.evaluated_get(dg)
me_e = ev.to_mesh()
nv, npoly, nloop = len(me_e.vertices), len(me_e.polygons), len(me_e.loops)
assert nloop == 3 * npoly, "se esperaban solo triángulos"

co = np.empty(nv * 3, dtype=np.float64)
me_e.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)
mw = np.array(ob.matrix_world)
cw = co @ mw[:3, :3].T + mw[:3, 3]

cv = np.empty(nloop, dtype=np.int64)
me_e.loops.foreach_get("vertex_index", cv)
faces = cv.reshape(-1, 3)
mi = np.empty(npoly, dtype=np.int64)
me_e.polygons.foreach_get("material_index", mi)
mat_names = [m.name for m in ob.data.materials]
face_region = np.array([REGIONS.index(MAT_TO_REGION[mat_names[k]]) for k in mi])
uv_layer = me_e.uv_layers[0] if me_e.uv_layers else None
uv = None
if uv_layer is not None:
    uv = np.empty(nloop * 2, dtype=np.float32)
    uv_layer.uv.foreach_get("vector", uv)
    uv = uv.reshape(-1, 2)
ev.to_mesh_clear()
print("##PINTADO verts", nv, "tris", npoly, "caras por región",
      {r: int((face_region == i).sum()) for i, r in enumerate(REGIONS)})

# Orientación: el modelo mira a +X con los brazos en ±Y. Se gira -90º en Z para que mire a -Y (= +Z en glTF),
# brazos en X (como el modelo anterior), pies en 0 y 1.84 m de alto.
x_new, y_new, z_new = cw[:, 1], -cw[:, 0], cw[:, 2]
s = TARGET_HEIGHT / (z_new.max() - z_new.min())
x_new = (x_new - (x_new.min() + x_new.max()) / 2) * s
y_new = y_new * s
z_new = (z_new - z_new.min()) * s
P = np.stack([x_new, y_new, z_new], axis=1)
print("##ESCALA", round(float(s), 5), "bbox", P.min(0).round(3).tolist(), P.max(0).round(3).tolist())

# ═══════════════ 2. PESOS POR VÉRTICE ═══════════════
a, b, c = P[faces[:, 0]], P[faces[:, 1]], P[faces[:, 2]]
area = 0.5 * np.linalg.norm(np.cross(b - a, c - a), axis=1)
N = len(REGIONS)
Wraw = np.zeros((nv, N))
for k in range(3):
    np.add.at(Wraw, (faces[:, k], face_region), area)
Wraw /= np.maximum(Wraw.sum(axis=1, keepdims=True), 1e-12)
border = Wraw.max(axis=1) < 0.999          # vértices donde tocan caras de más de una región
dom = Wraw.argmax(axis=1)

ea = np.concatenate([faces[:, 0], faces[:, 1], faces[:, 2]])
eb = np.concatenate([faces[:, 1], faces[:, 2], faces[:, 0]])
lo, hi = np.minimum(ea, eb), np.maximum(ea, eb)
key = np.unique(lo.astype(np.int64) * nv + hi)
elo, ehi = key // nv, key % nv
elen = np.linalg.norm(P[elo] - P[ehi], axis=1)
ea2, eb2 = np.concatenate([elo, ehi]), np.concatenate([ehi, elo])
deg = np.bincount(ea2, minlength=nv).astype(np.float64)


def neighbor_avg(arr):
    acc = np.zeros_like(arr)
    np.add.at(acc, ea2, arr[eb2])
    return acc / np.maximum(deg, 1)[:, None] if arr.ndim == 2 else acc / np.maximum(deg, 1)


W = Wraw.copy()
for _ in range(SMOOTH_PASSES):
    W = 0.5 * W + 0.5 * neighbor_avg(W)

# ═══════════════ 3. DISTANCIA AL BORDE (Dijkstra por aristas) ═══════════════
order = np.argsort(ea2, kind="stable")
nbr = eb2[order].tolist()
wgt = np.concatenate([elen, elen])[order].tolist()
start = np.concatenate([[0], np.cumsum(np.bincount(ea2, minlength=nv))]).tolist()
# El borde se toma de los pesos YA suavizados (margen entre las dos regiones más fuertes): así los dientes de la
# pintura a mano no se vuelven dientes en el degradado, y el borde cae entre vértices (precisión sub-arista).
top2 = np.sort(W, axis=1)[:, -2:]
margin = top2[:, 1] - top2[:, 0]
seed = margin < 0.35
dist = [float("inf")] * nv
heap = []
for v in np.where(seed)[0].tolist():
    dist[v] = float(margin[v]) * 0.012
    heap.append((dist[v], v))
heapq.heapify(heap)
while heap:
    d0, v = heapq.heappop(heap)
    if d0 > dist[v]:
        continue
    for j in range(start[v], start[v + 1]):
        u = nbr[j]
        nd = d0 + wgt[j]
        if nd < dist[u]:
            dist[u] = nd
            heapq.heappush(heap, (nd, u))
d = np.array(dist)
d[~np.isfinite(d)] = d[np.isfinite(d)].max()
print("##BORDE vértices de borde", int(seed.sum()), "dist max", round(float(d.max()), 3))

# Por región: profundidad típica (p95) => el degradado nunca se come un músculo chico.
dmax = np.zeros(N)
for r in range(N):
    m = dom == r
    dmax[r] = np.percentile(d[m], 95) if m.any() else 0.0
wr = np.array([min(RIM_WIDTH, max(0.004, 0.30 * dmax[r])) for r in range(N)])
print("##PROFUNDIDAD p95 (cm)", {REGIONS[r]: round(float(dmax[r]) * 100, 1) for r in range(N)})

rim = smoothstep((d - RIM_PLATEAU) / wr[dom]) ** 1.25   # meseta fina y luego el degradado
rim = RIM_FLOOR + (1.0 - RIM_FLOOR) * rim
for _ in range(RIM_BLUR_PASSES):
    rim = 0.5 * rim + 0.5 * neighbor_avg(rim)

g = smoothstep(d / np.maximum(0.9 * dmax[dom], 1e-6))   # 0 en el borde, 1 en el centro del músculo
g[dom == NEUTRO] = 1.0
for _ in range(2):
    g = 0.5 * g + 0.5 * neighbor_avg(g)
shade = SHADE_MIN + (1.0 - SHADE_MIN) * g
shine = np.where(dom == NEUTRO, 0.0, g ** 2)
R = np.clip(rim * shade, 0.0, 1.0)
RIMATTR = np.stack([R, shine, shade, np.ones(nv)], axis=1).astype(np.float32)
band = d < 0.02
print("##OSCURIDAD borde min(R)=%.3f  oscuridad máx=%.1f%%  media en banda<2cm=%.1f%%  media en banda<4cm=%.1f%%" % (
    float(R.min()), 100 * (1 - float(R.min())), 100 * float((1 - R[band]).mean()), 100 * float((1 - R[d < 0.04]).mean())))

# ═══════════════ 4. ESCENA NUEVA CON EL CUERPO ═══════════════
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = bpy.data.collections.new("BODY")
scene.collection.children.link(col)

me = bpy.data.meshes.new("cuerpo")
me.from_pydata([tuple(p) for p in P.tolist()], [], [tuple(f) for f in faces.tolist()])
me.update()
try:
    me.shade_smooth()
except Exception:
    for p in me.polygons:
        p.use_smooth = True
if uv is not None:
    ul = me.uv_layers.new(name="UVMap")
    ul.uv.foreach_set("vector", uv.ravel())

Wp = np.zeros((nv, 16))
Wp[:, :N] = W
for j, nm in enumerate(["_REGA", "_REGB", "_REGC", "_REGD"]):
    ca = me.color_attributes.new(nm, "FLOAT_COLOR", "POINT")
    ca.data.foreach_set("color", Wp[:, j * 4:(j + 1) * 4].astype(np.float32).ravel())
cr = me.color_attributes.new("_RIM", "FLOAT_COLOR", "POINT")
cr.data.foreach_set("color", RIMATTR.ravel())

ob2 = bpy.data.objects.new("cuerpo", me)
col.objects.link(ob2)
ob2["vt_regions"] = json.dumps(REGIONS)
ob2["vt_note"] = (
    "Regiones pintadas a mano (rangos_cuerpo_PINTAR.blend). Pesos en _REGA.._REGD; _RIM = (multiplicador con borde negro "
    "difuminado y sombra suave, brillo, sombra). Modelo: HumanBaseMale.blend (UNVERIFIED/publishable:false)."
)

# Preview por rango: color del rango x _RIM.R (+ un toque de brillo), el Neutro queda gris piel.
sm = np.exp((W - W.max(axis=1, keepdims=True)) * 36.0)
sm /= sm.sum(axis=1, keepdims=True)
skin = hex_lin(SKIN_HEX)
for rk, hx in RANKS.items():
    pal = np.array([hex_lin(hx) if i != NEUTRO else skin for i in range(N)])
    base = sm @ pal
    rgb = base * R[:, None] + shine[:, None] * 0.10 * (R[:, None] ** 2)
    ca = me.color_attributes.new(f"preview_{rk}", "FLOAT_COLOR", "POINT")
    ca.data.foreach_set("color", np.hstack([np.clip(rgb, 0, 1), np.ones((nv, 1))]).astype(np.float32).ravel())
me.color_attributes.active_color = me.color_attributes["preview_oro"]

mat = bpy.data.materials.new("cuerpo_look")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "preview_oro"
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.5
me.materials.append(mat)

# ═══════════════ 5. RENDERS DE CONTROL ═══════════════
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "VERTEX"
scene.display.shading.show_specular_highlight = True
scene.render.resolution_x, scene.render.resolution_y = 700, 1000
world = bpy.data.worlds.new("w")
world.color = (0.05, 0.05, 0.05)
scene.world = world
cam_d = bpy.data.cameras.new("cam")
cam_d.type = "ORTHO"
cam_d.ortho_scale = 2.15
cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
zmid = float(P[:, 2].max()) / 2
views = {
    "frente": ((0, -10, zmid), (math.radians(90), 0, 0)),
    "espalda": ((0, 10, zmid), (math.radians(90), 0, math.radians(180))),
    "lateral": ((10, 0, zmid), (math.radians(90), 0, math.radians(90))),
}
renders = [("oro", v) for v in views] + [(rk, "frente") for rk in ("hierro", "diamante", "campeon")]
for rk, vn in renders:
    me.color_attributes.active_color = me.color_attributes[f"preview_{rk}"]
    cam.location, cam.rotation_euler = views[vn]
    scene.render.filepath = f"{PREVIEW}_{vn}_{rk}.png"
    bpy.ops.render.render(write_still=True)
scene.collection.objects.unlink(cam)
me.color_attributes.active_color = me.color_attributes["preview_oro"]

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print("##BLEND", OUT_BLEND)

# ═══════════════ 6. GLB MESHOPT (sin los preview) ═══════════════
for rk in RANKS:
    me.color_attributes.remove(me.color_attributes[f"preview_{rk}"])
me.materials.clear()
mx = bpy.data.materials.new("cuerpo")
mx.use_nodes = True
mx.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.62, 0.64, 1.0)
mx.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.55
me.materials.append(mx)
for o in bpy.data.objects:
    o.select_set(False)
bpy.context.view_layer.objects.active = ob2

if os.path.exists(GLB_OUT) and not os.path.exists(GLB_PREV):
    shutil.copyfile(GLB_OUT, GLB_PREV)
t0 = time.time()
r = bpy.ops.export_scene.gltf(
    filepath=GLB_TMP, export_format="GLB",
    collection="BODY", export_apply=False, export_yup=True, export_extras=True,
    export_lights=False, export_cameras=False, export_materials="EXPORT",
    export_animations=False, export_skins=False, export_morph=False,
    export_normals=True, export_texcoords=False, export_meshopt_compression_enable=True, use_visible=True,
    export_vertex_color="NONE", export_all_vertex_colors=False, export_attributes=True,
)
print("##EXPORT", list(r), round(time.time() - t0, 1), "s", round(os.path.getsize(GLB_TMP) / 1024, 1), "KB")
shutil.copyfile(GLB_TMP, GLB_OUT)
print("##GLB", GLB_OUT)
