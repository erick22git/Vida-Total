"""Matas de pasto para el piso del QR de pago (compañero de 42_payment_tree_v2.py). Obra propia, sin assets de terceros.
Escala de grises (paleta estricta blanco/negro del árbol de pago). Se corre en línea de comandos:

  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python tools/3d/blender/43_payment_grass.py

GLB con 4 variantes (`tuft_0..tuft_3`), cada una con la base en el origen (y = 0, Y arriba). La app las INSTANCIA muchas veces
(InstancedMesh) en los bordes y esquinas del piso y las mece con el viento. Tono por vértice: raíz oscura -> punta clara.
Muy livianas (~100-200 triángulos cada una).
"""
import bpy, math, random, os, json, struct, shutil

NAME = "grass_tuft_payment_001"
ROOT = r"C:\Erick\app movil\vida-total-web"
OUT_DIR = os.path.join(ROOT, "biblioteca de assets", "_trabajo", "export")
PUBLIC = os.path.join(ROOT, "public", "models")
random.seed(5)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

mat = bpy.data.materials.new("VT_Grass")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.75
attr = nt.nodes.new("ShaderNodeAttribute")
attr.attribute_name = "Col"
nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
mat.use_backface_culling = False  # las hojas se ven por las dos caras (doubleSided en el GLB)

from mathutils import Vector


def blade(base, height, width, bend_dir, bend, segs=4):
    """Hoja de pasto: tira angosta que se afina hacia la punta y se curva. Devuelve verts, caras, colores, normales."""
    verts, cols, norms = [], [], []
    side = Vector((-bend_dir.z, 0, bend_dir.x)).normalized()
    for i in range(segs + 1):
        t = i / segs
        w = width * (1 - t) ** 0.8 * 0.5 + (0.0006 if i == segs else 0)
        up = height * t
        out = bend * (t ** 1.7) * height
        center = base + Vector((0, up, 0)) + bend_dir * out
        verts.append(center - side * w)
        verts.append(center + side * w)
        shade = 0.10 + 0.78 * t + random.uniform(-0.05, 0.05)
        cols.extend([(shade, shade, shade)] * 2)
        n = (Vector((0, 1, 0)) * 0.7 + bend_dir * 0.3).normalized()
        norms.extend([n, n])
    faces = []
    for i in range(segs):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    return verts, faces, cols, norms


def build_tuft(name, count, hmin, hmax, wmin, wmax, spread, bend_max):
    verts, faces, cols, norms = [], [], [], []
    for _ in range(count):
        a = random.uniform(0, math.tau)
        r = random.random() ** 0.7 * spread
        base = Vector((math.cos(a) * r, 0, math.sin(a) * r))
        out_dir = Vector((math.cos(a), 0, math.sin(a)))
        h = random.uniform(hmin, hmax) * (1.0 - 0.35 * (r / max(spread, 1e-4)))  # el centro crece más alto
        v, f, c, n = blade(base, h, random.uniform(wmin, wmax), (out_dir + Vector((random.gauss(0, 0.5), 0, random.gauss(0, 0.5)))).normalized(), random.uniform(0.15, bend_max))
        off = len(verts)
        verts.extend(v)
        cols.extend(c)
        norms.extend(n)
        faces.extend([tuple(i + off for i in face) for face in f])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    ca = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
    for vi, c in enumerate(cols):
        ca.data[vi].color = (*c, 1.0)
    try:
        mesh.normals_split_custom_set_from_vertices([tuple(n) for n in norms])
    except Exception as e:
        print("normales personalizadas no disponibles:", e)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


variants = [
    build_tuft("tuft_0", 18, 0.38, 0.62, 0.035, 0.06, 0.07, 0.55),
    build_tuft("tuft_1", 24, 0.30, 0.52, 0.03, 0.05, 0.09, 0.7),
    build_tuft("tuft_2", 14, 0.45, 0.78, 0.04, 0.065, 0.06, 0.4),
    build_tuft("tuft_3", 30, 0.22, 0.42, 0.03, 0.05, 0.12, 0.8),
]
root = bpy.data.objects.new("Grass", None)
scene.collection.objects.link(root)
for o in variants:
    o.parent = root
root.rotation_euler = (math.radians(90), 0, 0)
tris = sum(len(p.vertices) - 2 for o in variants for p in o.data.polygons)
print(f"[grass] variantes={len(variants)} tris={tris}")

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
print("[grass] exportado:", out_path, os.path.getsize(out_path) // 1024, "KB")
os.makedirs(PUBLIC, exist_ok=True)
shutil.copy(out_path, os.path.join(PUBLIC, NAME + "_meshopt.glb"))
