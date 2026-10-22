"""Matas de pasto del QR de pago tomadas del diseño de `tools/3d/blender qr/Bonsai.blend` (Plane.003 y Plane.004: los dos manojos de hojas
curvas que el bonsái esparce con su sistema de partículas "Grass"). Se corre SOBRE ese .blend (así las mallas salen de ahí tal cual):

  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background "tools/3d/blender qr/Bonsai.blend" --python tools/3d/blender/48_payment_grass_from_bonsai.py

Qué hace: aplica los modificadores de cada manojo (subdivisión + deformación), lo baja a y = 0 centrado en el origen, lo pasa a Y arriba y a la
escala de la escena (el tablero del QR mide 7.2 unidades: una mata ~0.2 de ancho), y arma 4 variantes (`tuft_0..tuft_3`: los dos originales
más una versión girada/más baja de cada uno). El tono va por vértice en gris (raíz oscura -> punta clara) y la app lo multiplica por un verde
distinto por mata. La FORMA del QR no se toca: la app sigue poniendo una mata por módulo oscuro; esto solo cambia el diseño de la mata.
"""
import bpy, bmesh, math, os, shutil
from mathutils import Matrix, Vector

NAME = "grass_tuft_payment_002"
ROOT = r"C:\Erick\app movil\vida-total-web"
OUT_DIR = os.path.join(ROOT, "biblioteca de assets", "_trabajo", "export")
PUBLIC = os.path.join(ROOT, "public", "models")
SRC = ["Plane.003", "Plane.004"]
TARGET_WIDTH = 0.2

dg = bpy.context.evaluated_depsgraph_get()


def baked(name):
    """Malla con los modificadores aplicados, en coordenadas de mundo, con Z arriba."""
    ob = bpy.data.objects[name]
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, depsgraph=dg)
    me.transform(ob.matrix_world)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return bm


def normalized(bm, yaw=0.0, sx=1.0, sy=1.0, sz=1.0, mirror=False):
    """Base en el origen, Y arriba, ancho ~TARGET_WIDTH."""
    vs = [v.co.copy() for v in bm.verts]
    cx = sum(v.x for v in vs) / len(vs)
    cy = sum(v.y for v in vs) / len(vs)
    zmin = min(v.z for v in vs)
    width = max(max(v.x for v in vs) - min(v.x for v in vs), max(v.y for v in vs) - min(v.y for v in vs))
    k = TARGET_WIDTH / width
    out = bm.copy()
    for v in out.verts:
        p = Vector(((v.co.x - cx) * k * sx, (v.co.y - cy) * k * sz, (v.co.z - zmin) * k * sy))
        if mirror:
            p.x = -p.x
        v.co = p
    # Z arriba -> Y arriba (x, z, -y) y giro alrededor de Y
    rot = Matrix.Rotation(yaw, 4, "Y")
    for v in out.verts:
        v.co = rot @ Vector((v.co.x, v.co.z, -v.co.y))
    if mirror:
        bmesh.ops.reverse_faces(out, faces=out.faces[:])
    return out


bms = [baked(n) for n in SRC]
variants = [
    normalized(bms[0]),
    normalized(bms[1]),
    normalized(bms[0], yaw=math.radians(90), sx=0.9, sy=0.8, sz=0.9, mirror=True),
    normalized(bms[1], yaw=math.radians(45), sx=1.1, sy=0.75, sz=1.1),
]

mat = bpy.data.materials.new("VT_GrassBonsai")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.7
attr = nt.nodes.new("ShaderNodeAttribute")
attr.attribute_name = "Col"
nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
mat.use_backface_culling = False

new_objs = []
tris = 0
for i, bm in enumerate(variants):
    ys = [v.co.y for v in bm.verts]
    ymax = max(ys) or 1.0
    me = bpy.data.meshes.new(f"tuft_{i}")
    bm.to_mesh(me)
    bm.free()
    ca = me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
    for vi, v in enumerate(me.vertices):
        t = max(0.0, min(1.0, v.co.y / ymax))
        g = 0.10 + 0.58 * t
        ca.data[vi].color = (g, g, g, 1.0)
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.materials.append(mat)
    ob = bpy.data.objects.new(f"tuft_{i}", me)
    bpy.context.scene.collection.objects.link(ob)
    new_objs.append(ob)
    tris += sum(len(p.vertices) - 2 for p in me.polygons)

# fuera todo lo del bonsái: solo se exportan las matas nuevas
for ob in list(bpy.data.objects):
    if ob not in new_objs:
        bpy.data.objects.remove(ob, do_unlink=True)
root = bpy.data.objects.new("Grass", None)
bpy.context.scene.collection.objects.link(root)
for ob in new_objs:
    ob.parent = root
root.rotation_euler = (math.radians(90), 0, 0)  # se construyó con Y arriba (como glTF)
print(f"[grass-bonsai] variantes={len(new_objs)} tris={tris}")

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
print("[grass-bonsai] exportado:", out_path, os.path.getsize(out_path) // 1024, "KB")
os.makedirs(PUBLIC, exist_ok=True)
shutil.copy(out_path, os.path.join(PUBLIC, NAME + "_meshopt.glb"))
