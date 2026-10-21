"""Hojas sueltas para la copa del árbol de pago (compañero de 46_payment_trunk.py). Obra propia. Línea de comandos:

  "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python tools/3d/blender/47_payment_leaves.py

Tres formas (`leaf_0` ovalada, `leaf_1` lanceolada, `leaf_2` redondeada), cada una con la base en el origen, apuntando a +Z (Y arriba),
plegada por el nervio y caída hacia la punta. A ESCALA REAL de la escena (el tablero mide 7.2 unidades; una hoja ~0.18). Tono por
vértice en gris (base oscura -> punta clara, nervio más claro): la app lo multiplica por un verde distinto por racimo. La app las
INSTANCIA (InstancedMesh) sobre un punto por módulo oscuro de la matriz del QR: el GLB solo trae la forma de la hoja.
"""
import bpy, math, os, shutil
from mathutils import Vector

NAME = "leaves_payment_001"
ROOT = r"C:\Erick\app movil\vida-total-web"
OUT_DIR = os.path.join(ROOT, "biblioteca de assets", "_trabajo", "export")
PUBLIC = os.path.join(ROOT, "public", "models")
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

mat = bpy.data.materials.new("VT_Leaf")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.55
attr = nt.nodes.new("ShaderNodeAttribute")
attr.attribute_name = "Col"
nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
mat.use_backface_culling = False

STATIONS = 6


def leaf(name, L, W, shape):
    verts, cols, norms, faces = [], [], [], []
    for i in range(STATIONS):
        t = i / (STATIONS - 1)
        if shape == "oval":
            w = W * 0.5 * math.sin(math.pi * t ** 0.85) ** 0.9
        elif shape == "lance":
            w = W * 0.42 * math.sin(math.pi * t ** 0.95) ** 1.15
        else:  # redondeada
            w = W * 0.55 * math.sin(math.pi * t ** 0.6) ** 0.8
        z = L * t
        droop = -0.32 * L * t * t
        fold = 0.22 * w
        for xs in (-1, 0, 1):
            x = xs * w
            y = droop + (fold if xs == 0 else 0.0)
            verts.append(Vector((x, y, z)))
            g = 0.50 + 0.50 * t
            if xs == 0:
                g = min(1.0, g + 0.22)
            cols.append((g, g, g))
            norms.append(Vector((0.0, 1.0, -0.25 * t)).normalized())
    for i in range(STATIONS - 1):
        a = i * 3
        for k in range(2):
            faces.append((a + k, a + k + 1, a + k + 4, a + k + 3))
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


objs = [leaf("leaf_0", 0.19, 0.105, "oval"), leaf("leaf_1", 0.23, 0.085, "lance"), leaf("leaf_2", 0.16, 0.115, "round")]
root = bpy.data.objects.new("Leaves", None)
scene.collection.objects.link(root)
for o in objs:
    o.parent = root
root.rotation_euler = (math.radians(90), 0, 0)
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
print("[leaves] exportado:", out_path, os.path.getsize(out_path) // 1024, "KB")
os.makedirs(PUBLIC, exist_ok=True)
shutil.copy(out_path, os.path.join(PUBLIC, NAME + "_meshopt.glb"))
