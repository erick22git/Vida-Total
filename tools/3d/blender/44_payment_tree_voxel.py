"""Árbol de bloques (pixelado) del QR de pago, versión 3. Referencia: árbol "voxel" de la segunda imagen (copa de cubitos con huecos,
tronco visible con ramas), pero en BLANCO / NEGRO / GRISES. Obra propia, sin assets de terceros. Línea de comandos:

  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python tools/3d/blender/44_payment_tree_voxel.py

Contrato del GLB (src/lib/3d/payment-figures.ts): nodo `Tree` (Y arriba, base en y = 0, centrado en x/z); hijos `Bark` (tronco y ramas,
estático) y `lobe_00..lobe_NN` (pedazos de copa con su pivote en el origen: la app los mece con el viento). Sin texturas: el tono va
por vértice (atributo `Col`), caras planas (aspecto de cubos). Todo determinista (semilla fija).
"""
import bpy, math, random, os, tempfile, shutil
from mathutils import Vector

SEED = 23
NAME = "tree_payment_003"
ROOT = r"C:\Erick\app movil\vida-total-web"
OUT_DIR = os.path.join(ROOT, "biblioteca de assets", "_trabajo", "export")
PUBLIC = os.path.join(ROOT, "public", "models")
PREVIEW = os.environ.get("VT_PREVIEW", os.path.join(tempfile.gettempdir(), "vt_tree_voxel_preview.png"))
random.seed(SEED)
U = 0.25  # lado de un cubito, en unidades del GLB

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def noise(x, y, z):
    """Ruido de valor barato y determinista (sin dependencias) para romper la silueta de la copa."""
    h = math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + SEED) * 43758.5453
    return h - math.floor(h)


# ── tronco: base ensanchada (raíces), fuste de 2x2 que sube y se parte en ramas ───────────────
trunk = {}  # (x, y, z) -> tono


def put_trunk(x, y, z, tone):
    trunk[(x, y, z)] = tone


TRUNK_TOP = 10
for x in (-1, 0, 1, 2):          # raíces: 4x4 sin las esquinas lejanas, a ras de piso
    for z in (-1, 0, 1, 2):
        if (x in (-1, 2)) and (z in (-1, 2)):
            continue
        put_trunk(x, 0, z, 0.04 + 0.06 * random.random())
for y in range(1, TRUNK_TOP + 1):
    for x in (0, 1):
        for z in (0, 1):
            put_trunk(x, y, z, 0.05 + 0.12 * random.random() + (0.03 if y > 4 else 0))
# raíces que salen a los lados, bajas
for (x, z) in ((-1, 0), (2, 1), (1, -1), (0, 2)):
    put_trunk(x, 1, z, 0.05 + 0.08 * random.random())

# ramas en escalera (4 direcciones principales + diagonales) que entran en la copa
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)]
random.shuffle(DIRS)
branch_ends = []
for (dx, dz) in DIRS[:6]:
    ox, oz = (1 if dx > 0 else 0), (1 if dz > 0 else 0)
    length = random.randint(3, 5)
    x, y, z = ox, TRUNK_TOP - 1, oz
    for i in range(1, length + 1):
        x += dx
        z += dz
        if i % 1 == 0:
            y += 1 if i % 2 == 0 or i == 1 else 0
        put_trunk(x, y, z, 0.06 + 0.12 * random.random())
    branch_ends.append((x, y, z))

# ── copa: unión de elipsoides con borde ruidoso y huecos, hueca por dentro (no se ve) ────────
CX, CZ = 0.5, 0.5
blobs = [(CX, 16.2, CZ, 7.2, 5.0)]  # (cx, cy, cz, rxz, ry)
for (ex, ey, ez) in branch_ends:
    blobs.append((ex + 0.5, ey + 3.4, ez + 0.5, 3.8, 3.2))
blobs.append((CX + 1.2, 20.2, CZ - 0.6, 3.6, 2.8))
blobs.append((CX - 2.0, 13.0, CZ + 2.5, 3.0, 2.2))

canopy = set()
MIN_Y = 11  # por debajo queda el tronco a la vista
for (bx, by, bz, rxz, ry) in blobs:
    for x in range(int(bx - rxz) - 1, int(bx + rxz) + 2):
        for y in range(int(by - ry) - 1, int(by + ry) + 2):
            for z in range(int(bz - rxz) - 1, int(bz + rxz) + 2):
                if y < MIN_Y:
                    continue
                d = math.sqrt(((x + 0.5 - bx) / rxz) ** 2 + ((y + 0.5 - by) / ry) ** 2 + ((z + 0.5 - bz) / rxz) ** 2)
                if d < 1.0 - 0.34 * noise(x, y, z):
                    canopy.add((x, y, z))

occupied = set(canopy) | set(trunk)


def neighbors(p):
    x, y, z = p
    return [(x + 1, y, z), (x - 1, y, z), (x, y + 1, z), (x, y - 1, z), (x, y, z + 1), (x, y, z - 1)]


# fuera lo de adentro (invisible) y, de la superficie, huecos al azar: el aspecto "pixelado" con claros de la referencia
shell = [p for p in canopy if any(n not in canopy for n in neighbors(p))]
shell = [p for p in shell if random.random() > 0.17]
canopy = set(shell)
occupied = set(canopy) | set(trunk)

ys = [p[1] for p in canopy]
ymin_c, ymax_c = min(ys), max(ys)


def leaf_tone(p):
    h = (p[1] - ymin_c) / max(1, ymax_c - ymin_c)  # 0 abajo .. 1 arriba
    r = random.random()
    base = 0.36 + 0.46 * h
    # tres tonos de "pixel" para que los cubitos se distingan entre sí
    if r < 0.28:
        base -= 0.16
    elif r > 0.80:
        base += 0.12
    return max(0.28, min(0.97, base + random.uniform(-0.05, 0.05)))


# ── lóbulos: la copa se parte en pedazos (cada uno se mece con su propio pivote) ─────────────
pts = sorted(canopy)
K = 14
centers = [max(pts, key=lambda p: p[1])]
dist = {p: (Vector(p) - Vector(centers[0])).length for p in pts}
while len(centers) < K:
    nxt = max(pts, key=lambda p: dist[p])
    centers.append(nxt)
    for p in pts:
        dist[p] = min(dist[p], (Vector(p) - Vector(nxt)).length)
groups = [[] for _ in range(K)]
for p in pts:
    gi = min(range(K), key=lambda g: (Vector(p) - Vector(centers[g])).length)
    groups[gi].append(p)

mat = bpy.data.materials.new("VT_VoxelTree")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.88
bsdf.inputs["Metallic"].default_value = 0.0
attr = nt.nodes.new("ShaderNodeAttribute")
attr.attribute_name = "Col"
nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])

FACES = [
    ((1, 0, 0), [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)]),
    ((-1, 0, 0), [(0, 0, 1), (0, 1, 1), (0, 1, 0), (0, 0, 0)]),
    ((0, 1, 0), [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)]),
    ((0, -1, 0), [(0, 0, 1), (0, 0, 0), (1, 0, 0), (1, 0, 1)]),
    ((0, 0, 1), [(1, 0, 1), (1, 1, 1), (0, 1, 1), (0, 0, 1)]),
    ((0, 0, -1), [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)]),
]
# tono por cara: arriba más claro, abajo más oscuro (refuerza el volumen aunque la luz sea pareja)
FACE_GAIN = {(0, 1, 0): 1.0, (1, 0, 0): 0.86, (-1, 0, 0): 0.80, (0, 0, 1): 0.88, (0, 0, -1): 0.78, (0, -1, 0): 0.62}


def voxels_object(name, cells, tone_of, origin):
    """Malla de cubitos (solo las caras visibles) con el tono en el atributo `Col`; coordenadas relativas a `origin` (el pivote)."""
    verts, faces, cols = [], [], []
    ox, oy, oz = origin
    for p in cells:
        tone = tone_of(p)
        for (nrm, quad) in FACES:
            if (p[0] + nrm[0], p[1] + nrm[1], p[2] + nrm[2]) in occupied:
                continue
            base = len(verts)
            for (dx, dy, dz) in quad:
                verts.append(((p[0] + dx - 0.5 - ox) * U, (p[1] + dy - oy) * U, (p[2] + dz - 0.5 - oz) * U))
                g = max(0.02, min(1.0, tone * FACE_GAIN[nrm]))
                cols.append((g, g, g))
            faces.append((base, base + 1, base + 2, base + 3))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.polygons.foreach_set("use_smooth", [False] * len(mesh.polygons))
    ca = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
    for vi, c in enumerate(cols):
        ca.data[vi].color = (*c, 1.0)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = ((ox) * U, (oy) * U, (oz) * U)
    scene.collection.objects.link(obj)
    return obj, len(faces)


bark_obj, bark_faces = voxels_object("Bark", sorted(trunk), lambda p: trunk[p], (0, 0, 0))
lobe_objs = []
leaf_faces = 0
for gi, cells in enumerate(groups):
    if not cells:
        continue
    cen = Vector((sum(c[0] for c in cells), sum(c[1] for c in cells), sum(c[2] for c in cells))) / len(cells)
    # pivote: hacia el tronco y más abajo (el mecido se ve como una rama que se dobla en su base)
    pivot = (cen.x * 0.5 + CX * 0.5, max(MIN_Y - 1.0, cen.y - 3.0), cen.z * 0.5 + CZ * 0.5)
    obj, nf = voxels_object(f"lobe_{gi:02d}", cells, leaf_tone, pivot)
    lobe_objs.append(obj)
    leaf_faces += nf

# ── agrupar bajo `Tree`, centrado en x/z ─────────────────────────────────────
root = bpy.data.objects.new("Tree", None)
scene.collection.objects.link(root)
all_objs = [bark_obj] + lobe_objs
for o in all_objs:
    o.parent = root
    o.location = (o.location.x - CX * U, o.location.y, o.location.z - CZ * U)
# se construyó con Y arriba (como glTF): se compensa la conversión del exportador
root.rotation_euler = (math.radians(90), 0, 0)
print(f"[tree3] voxeles tronco={len(trunk)} copa={len(canopy)} lobulos={len(lobe_objs)} caras={bark_faces + leaf_faces}")

# ── vista previa ─────────────────────────────────────────────────────────────
def render_preview(path, res=900):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 3
    scene.render.resolution_x = scene.render.resolution_y = res
    w = bpy.data.worlds.new("W")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    scene.world = w
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, -0.01))
    plane = bpy.context.object
    pm = bpy.data.materials.new("P")
    pm.use_nodes = True
    pm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.9, 0.9, 0.9, 1)
    plane.data.materials.append(pm)
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 3.5
    sun.angle = math.radians(6)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    scene.collection.objects.link(so)
    cam = bpy.data.cameras.new("Cam")
    cam.type = "ORTHO"
    cam.ortho_scale = 10.5
    co = bpy.data.objects.new("Cam", cam)
    co.location = (10, -10, 8.0)
    co.rotation_euler = (math.radians(62), 0, math.radians(45))
    scene.collection.objects.link(co)
    scene.camera = co
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = path
    scene.render.image_settings.file_format = "PNG"
    try:
        bpy.ops.render.render(write_still=True)
        print("[tree3] preview:", path)
    except Exception as e:
        print("[tree3] preview falló:", e)


if os.environ.get("VT_NO_PREVIEW") != "1":
    render_preview(PREVIEW)
    for ob in [o for o in bpy.data.objects if o.name in ("Cam", "Sun") or o.name.startswith("Plane")]:
        bpy.data.objects.remove(ob, do_unlink=True)

# ── exportar ────────────────────────────────────────────────────────────────
os.makedirs(OUT_DIR, exist_ok=True)
out_path = os.path.join(OUT_DIR, NAME + "_meshopt.glb")
kwargs = dict(
    filepath=out_path, export_format="GLB", use_selection=False, export_apply=True, export_texcoords=False, export_normals=True,
    export_vertex_color="ACTIVE", export_cameras=False, export_lights=False, export_yup=True, export_meshopt_compression_enable=True,
)
try:
    bpy.ops.export_scene.gltf(**kwargs)
except TypeError as e:
    print("opciones no reconocidas, reintentando mínimas:", e)
    for k in ("export_vertex_color", "export_meshopt_compression_enable"):
        kwargs.pop(k, None)
    bpy.ops.export_scene.gltf(**kwargs)
print("[tree3] exportado:", out_path, os.path.getsize(out_path) // 1024, "KB")
os.makedirs(PUBLIC, exist_ok=True)
shutil.copy(out_path, os.path.join(PUBLIC, NAME + "_meshopt.glb"))
