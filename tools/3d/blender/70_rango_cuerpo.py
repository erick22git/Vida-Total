# CUERPO PARA RANGOS — HumanBaseMale.blend → GLB con 14 regiones musculares.
#
#   blender -b --python tools/3d/blender/70_rango_cuerpo.py
#
# Modelo: biblioteca de assets/rangos/HumanBaseMale.blend
#   Malla: MaleBASE (325 k verts, muy musculoso).  Armadura: Armature (28 huesos).
#   Orientación: frente = +X, brazos a lo largo de ±Y, arriba = +Z, simetría Y = 0.
#   Licencia: UNVERIFIED / publishable: false (origen no declarado en el archivo).
#   El modelo anterior (BlenRig4_01_NickZ.blend) fue reemplazado por el dueño sin aviso;
#   a partir de ahora cualquier cambio de modelo se reportará antes de implementar.
#
# MÉTODO
#   1. Decimar a ~42 k triángulos.
#   2. Clasificar SOLO en el semiplano Y >= 0 (lado L), con dos técnicas:
#      a. Polígonos 2D en el plano (Y, Z) para músculos del tronco (test ray-casting).
#      b. Proximidad al hueso + dirección de la normal para extremidades.
#   3. Espejo exacto al lado Y < 0 (misma región, mismo color).
#   4. Limpieza de islas: conserva solo el componente conexo más grande por región.
#   5. Suavizar pesos por vértice (8 pasadas).
#   6. Exportar GLB Meshopt con 4 atributos FLOAT_COLOR (_REGA.._REGD).
#
import bpy, os, json, math, shutil, time
from mathutils import Vector
import numpy as np

ROOT       = "C:/Erick/app movil/vida-total-web/"
SRC        = ROOT + "biblioteca de assets/rangos/HumanBaseMale.blend"
WORK       = ROOT + "biblioteca de assets/_trabajo/rango_cuerpo_m.blend"
EXPORT_DIR = ROOT + "biblioteca de assets/_trabajo/export/"
GLB_TMP    = EXPORT_DIR + "rango_cuerpo_m_001_meshopt.glb"
GLB_OUT    = ROOT + "public/models/rango_cuerpo_m_001_meshopt.glb"
PREVIEW    = EXPORT_DIR + "rango_cuerpo_m_regiones"
os.makedirs(EXPORT_DIR, exist_ok=True)

DECIMATE_RATIO = 0.065   # 651 k polys → ~42 k tris
SMOOTH_PASSES  = 8

# 14 regiones + Neutro = 15; se empaquetan en 4 atributos FLOAT_COLOR (16 canales).
# Canal spare = 15 (siempre 0).
REGIONS = [
    "Pecho", "Espalda", "Hombros", "Biceps",          # _REGA  0-3
    "Triceps", "Antebrazo", "Abdomen", "Gluteos",      # _REGB  4-7
    "Cuadriceps", "Femoral", "Aductores", "Abductores", # _REGC  8-11
    "Pantorrilla", "Cuello", "Neutro",                 # _REGD  12-14
]
PREVIEW_COLORS = {
    "Pecho":       (0.90, 0.25, 0.25), "Espalda":    (0.25, 0.45, 0.90),
    "Hombros":     (0.95, 0.75, 0.20), "Biceps":     (0.20, 0.80, 0.50),
    "Triceps":     (0.60, 0.30, 0.85), "Antebrazo":  (0.95, 0.50, 0.15),
    "Abdomen":     (0.95, 0.90, 0.35), "Gluteos":    (0.90, 0.35, 0.65),
    "Cuadriceps":  (0.20, 0.75, 0.85), "Femoral":    (0.50, 0.65, 0.20),
    "Aductores":   (0.75, 0.55, 0.40), "Abductores": (0.40, 0.40, 0.90),
    "Pantorrilla": (0.30, 0.90, 0.30), "Cuello":     (0.85, 0.55, 0.85),
    "Neutro":      (0.55, 0.55, 0.55),
}

# ═══════════════════════════════════════════════════════════════════════════════
# 1. CARGAR, DECIMAR Y EXTRAER GEOMETRÍA
# ═══════════════════════════════════════════════════════════════════════════════
bpy.ops.wm.open_mainfile(filepath=SRC)
body    = bpy.data.objects["MaleBASE"]
arm_obj = bpy.data.objects["Armature"]

for m in list(body.modifiers):
    if m.type == "DATA_TRANSFER":
        body.modifiers.remove(m)
dec = body.modifiers.new("Dec_VT", "DECIMATE")
dec.ratio = DECIMATE_RATIO
dec.use_collapse_triangulate = True
bpy.context.view_layer.update()

dg   = bpy.context.evaluated_depsgraph_get()
ev   = body.evaluated_get(dg)
me_d = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
mw   = body.matrix_world
mw3  = mw.to_3x3()

verts_raw  = [(mw @ v.co).to_tuple()          for v in me_d.vertices]
normals_raw = [(mw3 @ v.normal).normalized().to_tuple() for v in me_d.vertices]
polys_raw  = [tuple(p.vertices)               for p in me_d.polygons]

# Centrar: pies en z=0, centrado en Y
zmin = min(v[2] for v in verts_raw)
cy   = sum(v[1] for v in verts_raw) / len(verts_raw)
verts   = [(v[0], v[1] - cy, v[2] - zmin) for v in verts_raw]
normals = normals_raw  # las normales no se trasladan

# Posiciones mundo de los huesos (centradas en Y e Z)
bw = arm_obj.matrix_world
def bseg(name):
    b = arm_obj.data.bones[name]
    h = bw @ b.head_local
    t = bw @ b.tail_local
    return (h.x, h.y - cy, h.z - zmin), (t.x, t.y - cy, t.z - zmin)

# Huesos clave (en coordenadas centradas)
HUM_L_H, HUM_L_T  = bseg("Humerus_L")
HUM_R_H, HUM_R_T  = bseg("Humerus_R")
SHO_L_H, SHO_L_T  = bseg("Shoulder_L")
SHO_R_H, SHO_R_T  = bseg("Shoulder_R")
FEM_L_H, FEM_L_T  = bseg("Femur_L")
FEM_R_H, FEM_R_T  = bseg("Femur_R")
TIB_L_H, TIB_L_T  = bseg("Tibia_L")
TIB_R_H, TIB_R_T  = bseg("Tibia_R")
FORE_L_H, FORE_L_T = bseg("Forearm_L")
FORE_R_H, FORE_R_T = bseg("Forearm_R")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. UTILIDADES
# ═══════════════════════════════════════════════════════════════════════════════

def seg_t_dist(px, py, pz, ax, ay, az, bx, by, bz):
    """Parámetro t ∈ [0,1] y distancia al punto más cercano del segmento."""
    dx, dy, dz = bx - ax, by - ay, bz - az
    denom = dx*dx + dy*dy + dz*dz
    if denom < 1e-12:
        return 0.0, math.sqrt((px-ax)**2 + (py-ay)**2 + (pz-az)**2)
    t = max(0.0, min(1.0, ((px-ax)*dx + (py-ay)*dy + (pz-az)*dz) / denom))
    cx_, cy_, cz_ = ax + t*dx, ay + t*dy, az + t*dz
    return t, math.sqrt((px-cx_)**2 + (py-cy_)**2 + (pz-cz_)**2)

def pip(y, z, poly):
    """Point-in-polygon 2D (ray casting en el plano Y-Z)."""
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        yi, zi = poly[i]
        yj, zj = poly[j]
        if ((zi > z) != (zj > z)) and y < (yj - yi) * (z - zi) / max(1e-12, zj - zi) + yi:
            inside = not inside
        j = i
    return inside

# ═══════════════════════════════════════════════════════════════════════════════
# 3. POLÍGONOS 2D (en coordenadas Y, Z del modelo centrado)
#    Se definen en el semiplano Y >= 0 (lado L) y se espejan.
#    Coordenadas clave confirmadas por la inspección de huesos:
#      Shoulder_L:  Y=0.393, Z=2.980    Humerus_L head: Y=0.393, Z=2.980
#      Humerus_L tail (codo): Y=0.812, Z=2.571
#      Bone.026 (pecho medio): Z=2.980–3.347    Bone.003 (abs): Z=2.766–2.980
#      Femur_L head (cadera): Y=0.172, Z=1.871   tail (rodilla): Y=0.330, Z=1.087
# ═══════════════════════════════════════════════════════════════════════════════

# ── TRONCO FRONTAL (vista desde +X, cara n.x > 0) ───────────────────────────

# Pecho: fan desde esternón hasta pliegue axilar, de clavícula a costilla baja.
POLY_PECHO = [
    (0.00, 3.24),   # unión esternoclavicular (medial arriba)
    (0.29, 3.21),   # clavícula lateral
    (0.40, 3.06),   # surco deltopectoral arriba
    (0.36, 2.90),   # pliegue axilar
    (0.18, 2.87),   # borde inferior del pectoral (lateral)
    (0.00, 2.93),   # xifoides / esternón bajo
]

# Abdomen: de la base del pectoral a la pelvis (recto + oblicuos).
POLY_ABDOMEN = [
    (0.00, 2.93),   # xifoides
    (0.18, 2.87),   # borde pec inferior
    (0.25, 2.65),   # oblicuo superior
    (0.23, 2.43),   # oblicuo medio
    (0.21, 2.15),   # ligamento inguinal
    (0.10, 1.97),   # pubis
    (0.00, 1.97),   # línea media baja
]

# ── TRONCO POSTERIOR (vista desde −X, cara n.x < 0) ─────────────────────────

# Espalda: incluye TODA la espalda: trapecio, dorsal, lumbar, romboides.
# Cuello queda solo para la columna de cuello propiamente (< 0.14 en Y).
POLY_ESPALDA = [
    (0.00, 3.35),   # columna cervical (bajo la base del cráneo)
    (0.38, 3.25),   # trapecio superior lateral
    (0.44, 3.05),   # borde posterior del deltoides / trapecio
    (0.42, 2.93),   # borde lat superior del dorsal
    (0.38, 2.43),   # dorsal cintura
    (0.26, 2.10),   # lumbar lateral
    (0.00, 2.10),   # sacro
]

# Glúteos: de la cresta ilíaca al pliegue glúteo.
POLY_GLUTEOS = [
    (0.00, 2.10),   # sacro / glúteo medial arriba
    (0.24, 2.10),   # cresta ilíaca lateral
    (0.40, 2.00),   # glúteo mayor arriba lateral
    (0.39, 1.72),   # pliegue glúteo lateral
    (0.18, 1.70),   # pliegue glúteo medial
    (0.00, 1.85),   # isquion / glúteo bajo medial
]

# ── CUELLO / TRAPECIO SUPERIOR (envuelve cuello y nuca) ──────────────────────
# Se aplica a caras con Z > 3.10 que no sean cabeza (Z < 3.48),
# con Y < 0.28 (no incluye deltoides).
Z_CUELLO_MIN  = 3.06
Z_CUELLO_MAX  = 3.47
Y_CUELLO_MAX  = 0.14   # cuello frontal muy estrecho; trapecio se maneja en Espalda
Z_CABEZA_MIN  = 3.47   # por encima = Neutro (cabeza)

# ── PIERNA: cuádriceps, femoral, aductores, abductores ───────────────────────
# Rodilla: Y~0.330, Z~1.087  Cadera: Y~0.172, Z~1.871
POLY_CUAD = [
    (0.08, 1.92),   # cadera frontal medial
    (0.46, 1.87),   # cadera frontal lateral ampliada
    (0.50, 1.09),   # rodilla frontal lateral
    (0.18, 1.09),   # rodilla frontal medial
]
POLY_FEMORAL = [
    (0.08, 1.92),
    (0.46, 1.85),
    (0.50, 1.09),
    (0.18, 1.09),
]
# Aductores: franja medial del muslo (Y < 0.26).
# Sin condición de normal para evitar fragmentación.
POLY_ADUCTOR = [
    (0.05, 1.87),   # ingle arriba
    (0.26, 1.87),
    (0.28, 1.09),
    (0.07, 1.09),
]
# Abductores: cara externa del muslo superior.
POLY_ABDUCTOR = [
    (0.36, 1.87),
    (0.50, 1.82),
    (0.52, 1.40),
    (0.38, 1.40),
]

# Pantorrilla: cara posterior de la pierna baja.
# Definida por hueso Tibia + normal posterior (n.x < -0.10).
Z_PANT_MIN = TIB_L_T[2]  # talón ~0.17
Z_PANT_MAX = TIB_L_H[2]  # rodilla ~1.09

# ═══════════════════════════════════════════════════════════════════════════════
# 4. FUNCIÓN DE CLASIFICACIÓN (solo para Y >= 0)
# ═══════════════════════════════════════════════════════════════════════════════

def classify_yplus(i):
    """Clasifica el vértice i asumiendo que pertenece al semiplano Y >= 0."""
    px, py, pz = verts[i]
    nx, ny, nz = normals[i]
    ay = abs(py)   # coordenada Y absoluta (este semiplano)

    # ── Cabeza ────────────────────────────────────────────────────────────────
    if pz >= Z_CABEZA_MIN:
        return "Neutro"

    # ── Pies ──────────────────────────────────────────────────────────────────
    if pz < 0.18:
        return "Neutro"

    # ── EXTREMIDADES (siempre antes que cuello/polígonos de tronco) ─────────

    # Manos: a partir de donde termina el antebrazo en adelante
    if ay > FORE_L_T[1] - 0.05:
        return "Neutro"

    # Shoulder bone proximity → Hombros  (clavícula + acromion)
    t_sho, d_sho = seg_t_dist(px, ay, pz, *SHO_L_H, *SHO_L_T)
    if d_sho < 0.10:
        return "Hombros"

    # Humerus: el radio cubre la superficie del músculo (~0.12-0.18 del hueso)
    t_hum, d_hum = seg_t_dist(px, ay, pz, *HUM_L_H, *HUM_L_T)
    if d_hum < 0.18:
        # Deltoides: proximal 50% del húmero (incluye toda la inserción en V)
        if t_hum < 0.50:
            return "Hombros"
        # Biceps (cara anterior: n.x > 0) / Triceps (cara posterior: n.x < 0)
        return "Biceps" if nx >= 0.0 else "Triceps"

    # Antebrazo
    t_fore, d_fore = seg_t_dist(px, ay, pz, *FORE_L_H, *FORE_L_T)
    if d_fore < 0.09:
        return "Antebrazo"

    # Femur (radio ampliado para cubrir el vasto lateral ~0.24 del eje)
    t_fem, d_fem = seg_t_dist(px, ay, pz, *FEM_L_H, *FEM_L_T)
    if d_fem < 0.26:
        # Gluteos: posterior superior (máxima prioridad)
        if nx < 0 and pip(ay, pz, POLY_GLUTEOS):
            return "Gluteos"
        # Clasificar por cara dominante del muslo (polígono establece la zona)
        in_thigh = pip(ay, pz, POLY_CUAD) or pip(ay, pz, POLY_FEMORAL)
        in_aduc  = pip(ay, pz, POLY_ADUCTOR) and ay < 0.27
        in_abdu  = pip(ay, pz, POLY_ABDUCTOR) and ay > 0.33
        if in_thigh or in_aduc or in_abdu:
            # Cara medial (ny fortemente negativo para el lado L) → Aductores
            if in_aduc and ny < -0.22:
                return "Aductores"
            # Cara lateral externa → Abductores
            if in_abdu and ny > 0.22:
                return "Abductores"
            # Frente / espalda
            return "Cuadriceps" if nx >= 0.0 else "Femoral"
        return "Cuadriceps" if nx >= 0.0 else "Femoral"

    # Tibia (radio ampliado para cubrir el soleo lateral)
    t_tib, d_tib = seg_t_dist(px, ay, pz, *TIB_L_H, *TIB_L_T)
    if d_tib < 0.16:
        return "Pantorrilla" if nx < -0.04 else "Neutro"

    # Fallback zona pierna lateral que escapó los radios de hueso
    # (solo por DEBAJO del pliegue glúteo para no comer glúteos/abdomen)
    if 0.18 < pz < 1.70:
        if pz > TIB_L_H[2]:   # muslo
            return "Cuadriceps" if nx >= 0 else "Femoral"
        else:                  # pierna baja
            return "Pantorrilla" if nx < 0 else "Neutro"

    # ── CUELLO (solo después de descartar extremidades) ───────────────────────
    fy = ay

    # Solo el cilindro estrecho del cuello propiamente
    if Z_CUELLO_MIN < pz < Z_CABEZA_MIN and fy < Y_CUELLO_MAX:
        return "Cuello"

    # ── TRONCO: polígonos 2D ──────────────────────────────────────────────────
    # Frente del tronco
    if nx >= 0:
        if pip(fy, pz, POLY_PECHO):
            return "Pecho"
        if pip(fy, pz, POLY_ABDOMEN):
            return "Abdomen"
        if pz > 2.80 and fy < 0.42:
            return "Pecho"
        if pz > 2.00 and fy < 0.30:
            return "Abdomen"

    # Espalda del tronco
    if nx < 0:
        if pip(fy, pz, POLY_ESPALDA):
            return "Espalda"
        if pip(fy, pz, POLY_GLUTEOS):
            return "Gluteos"

    # Capuchón del deltoides — DESPUÉS de los polígonos (Pecho/Espalda tomaron prioridad)
    # Solo vértices claramente laterales que no cayeron en ningún otro tronco
    if 2.85 < pz < 3.18 and 0.36 < fy < 0.72:
        return "Hombros"

    # Laterales / transiciones del tronco (sin importar nx)
    if pz > 2.80:
        return "Pecho" if nx >= 0 else "Espalda"
    if pz > 2.00:
        return "Abdomen" if nx >= 0 else "Espalda"
    if pz > 1.70:
        return "Abdomen" if nx >= 0 else "Gluteos"

    return "Neutro"


# ═══════════════════════════════════════════════════════════════════════════════
# 5. CLASIFICAR Y>=0 Y ESPEJEAR A Y<0
# ═══════════════════════════════════════════════════════════════════════════════
nv     = len(verts)
ridx   = {r: i for i, r in enumerate(REGIONS)}
reg_of = ["Neutro"] * nv

# Separar índices por semiplano
yplus_idx  = [i for i in range(nv) if verts[i][1] >= -0.01]
yminus_idx = [i for i in range(nv) if verts[i][1] <  -0.01]

# Clasificar el semiplano Y >= 0
for i in yplus_idx:
    reg_of[i] = classify_yplus(i)

# Construir KD-tree mínimo sobre Y >= 0 para el espejo
yplus_v = np.array([(verts[i][0], verts[i][1], verts[i][2]) for i in yplus_idx])
def nearest_yplus(px, py, pz):
    dist2 = (yplus_v[:, 0] - px)**2 + (yplus_v[:, 1] - abs(py))**2 + (yplus_v[:, 2] - pz)**2
    return yplus_idx[int(np.argmin(dist2))]

print("##MIRROR: clasificando", len(yminus_idx), "vértices Y<0...")
# Para el espejo usamos el punto reflejado (px, -py, pz) → buscar en Y+
for i in yminus_idx:
    px, py, pz = verts[i]
    mir = nearest_yplus(px, -py, pz)
    reg_of[i] = reg_of[mir]

print("##CLASIFICACION INICIAL OK")

# ═══════════════════════════════════════════════════════════════════════════════
# 6. LIMPIEZA DE ISLAS (BFS por componentes conexos, conservar el mayor)
# ═══════════════════════════════════════════════════════════════════════════════
# Construir adyacencia
adj = [[] for _ in range(nv)]
for pv in polys_raw:
    n_pv = len(pv)
    for k in range(n_pv):
        a, b = pv[k], pv[(k + 1) % n_pv]
        adj[a].append(b)
        adj[b].append(a)

def largest_component(vertices_of_region):
    """Devuelve el set del componente conexo más grande."""
    unvisited = set(vertices_of_region)
    best = set()
    while unvisited:
        start = next(iter(unvisited))
        comp  = set()
        stack = [start]
        while stack:
            v = stack.pop()
            if v in unvisited:
                unvisited.remove(v)
                comp.add(v)
                stack.extend(nb for nb in adj[v] if nb in unvisited)
        if len(comp) > len(best):
            best = comp
    return best

for reg in REGIONS:
    if reg == "Neutro":
        continue
    members = {i for i, r in enumerate(reg_of) if r == reg}
    if len(members) < 10:
        continue
    keep = largest_component(members)
    islands = members - keep
    if islands:
        print(f"##ISLANDS {reg}: {len(islands)} verts en islas → Neutro")
        for i in islands:
            reg_of[i] = "Neutro"

# ═══════════════════════════════════════════════════════════════════════════════
# 7. PESOS POR VÉRTICE Y SUAVIZADO
# ═══════════════════════════════════════════════════════════════════════════════
N  = len(REGIONS)
W  = np.zeros((nv, N), dtype=np.float64)
for i, r in enumerate(reg_of):
    W[i, ridx[r]] = 1.0

ea, eb = [], []
for pv in polys_raw:
    for k in range(len(pv)):
        ea.append(pv[k]); eb.append(pv[(k + 1) % len(pv)])
ea, eb = np.array(ea), np.array(eb)
deg = np.bincount(np.concatenate([ea, eb]), minlength=nv).astype(np.float64)
for _ in range(SMOOTH_PASSES):
    acc = np.zeros_like(W)
    np.add.at(acc, ea, W[eb])
    np.add.at(acc, eb, W[ea])
    W = 0.5 * W + 0.5 * acc / np.maximum(deg, 1)[:, None]

poly_dom = [REGIONS[int(np.argmax(sum(W[vi] for vi in pv)))] for pv in polys_raw]

# ═══════════════════════════════════════════════════════════════════════════════
# 8. ESCENA NUEVA: UNA MALLA CON ATRIBUTOS DE REGIÓN
# ═══════════════════════════════════════════════════════════════════════════════
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col   = bpy.data.collections.new("BODY")
scene.collection.children.link(col)

zmin2 = min(v[2] for v in verts)
cy2   = sum(v[1] for v in verts) / len(verts)
verts_final = [(v[0], v[1] - cy2, v[2] - zmin2) for v in verts]

me = bpy.data.meshes.new("cuerpo")
me.from_pydata(verts_final, [], polys_raw)
me.update()
for p in me.polygons:
    p.use_smooth = True
try:
    me.normals_split_custom_set_from_vertices([Vector(n) for n in normals])
except Exception as e:
    print("##WARN normales:", e)

# 15 regiones en 4 atributos FLOAT_COLOR (16 canales; canal 15 queda en 0)
Wp = np.zeros((nv, 16))
Wp[:, :N] = W
for j, attr_name in enumerate(["_REGA", "_REGB", "_REGC", "_REGD"]):
    ca = me.color_attributes.new(attr_name, "FLOAT_COLOR", "POINT")
    ca.data.foreach_set("color", Wp[:, j*4:(j+1)*4].astype(np.float32).ravel())

mat = bpy.data.materials.new("cuerpo")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.62, 0.62, 0.64, 1.0)
bsdf.inputs["Roughness"].default_value  = 0.55
me.materials.append(mat)

ob = bpy.data.objects.new("cuerpo", me)
col.objects.link(ob)
ob["vt_regions"] = json.dumps(REGIONS)
ob["vt_note"]    = (
    "Pesos de región en _REGA.._REGD; el shader toma argmax suavizado por píxel. "
    "Modelo: HumanBaseMale.blend (UNVERIFIED/publishable:false)."
)

tris_by = {}
for r, pv in zip(poly_dom, polys_raw):
    tris_by[r] = tris_by.get(r, 0) + max(0, len(pv) - 2)
total_t = sum(max(0, len(pv) - 2) for pv in polys_raw)
print("##REGIONES", json.dumps(tris_by, ensure_ascii=True))
print("##TRIS_TOTAL", total_t, "VERTS", nv)

# ═══════════════════════════════════════════════════════════════════════════════
# 9. RENDER DE CONTROL (colores por región, misma paleta ambos lados)
# ═══════════════════════════════════════════════════════════════════════════════
pal     = np.array([PREVIEW_COLORS[r] for r in REGIONS])
sm      = np.exp((W - W.max(axis=1, keepdims=True)) * 36.0)
sm     /= sm.sum(axis=1, keepdims=True)
prev_rgb = sm @ pal
prev = me.color_attributes.new("preview", "FLOAT_COLOR", "POINT")
prev.data.foreach_set("color", np.hstack([prev_rgb, np.ones((nv, 1))]).astype(np.float32).ravel())
me.color_attributes.active_color = prev

scene.render.engine              = "BLENDER_WORKBENCH"
scene.display.shading.light      = "STUDIO"
scene.display.shading.color_type = "VERTEX"
scene.render.resolution_x, scene.render.resolution_y = 700, 1000
world = bpy.data.worlds.new("w")
world.color = (0.05, 0.05, 0.05)
scene.world  = world
cam_d = bpy.data.cameras.new("cam")
cam_d.type        = "ORTHO"
cam_d.ortho_scale = 2.35
cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam
zmid = max(v[2] for v in verts_final) / 2
for nm, loc, rot in [
    ("frente",  ( 10, 0, zmid), (math.radians(90), 0, math.radians( 90))),
    ("espalda", (-10, 0, zmid), (math.radians(90), 0, math.radians(-90))),
    ("lateral", (  0,10, zmid), (math.radians(90), 0, math.radians(180))),
]:
    cam.location, cam.rotation_euler = loc, rot
    scene.render.filepath = f"{PREVIEW}_{nm}.png"
    bpy.ops.render.render(write_still=True)
scene.collection.objects.unlink(cam)
me.color_attributes.remove(prev)

# ═══════════════════════════════════════════════════════════════════════════════
# 10. GUARDAR Y EXPORTAR GLB MESHOPT
# ═══════════════════════════════════════════════════════════════════════════════
bpy.ops.wm.save_as_mainfile(filepath=WORK)
for ob2 in bpy.data.objects:
    ob2.select_set(False)
bpy.context.view_layer.objects.active = next(o for o in col.objects)
t0 = time.time()
r  = bpy.ops.export_scene.gltf(
    filepath=GLB_TMP, export_format="GLB",
    collection="BODY", export_apply=False, export_yup=True, export_extras=True,
    export_lights=False, export_cameras=False, export_materials="EXPORT",
    export_animations=False, export_skins=False, export_morph=False,
    export_normals=True, export_meshopt_compression_enable=True, use_visible=True,
    export_vertex_color="NONE", export_all_vertex_colors=False, export_attributes=True,
)
print("##EXPORT", list(r), round(time.time()-t0,1), "s",
      round(os.path.getsize(GLB_TMP)/1024,1), "KB")
shutil.copyfile(GLB_TMP, GLB_OUT)
print("##GLB", GLB_OUT)
