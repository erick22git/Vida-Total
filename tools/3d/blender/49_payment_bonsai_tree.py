"""Árbol bonsái del QR de pago, tomado de `tools/3d/blender qr/Bonsai.blend` (SOLO el árbol: tronco + las 10 nubes de hojas; sin maceta, tierra,
pasto ni rocas). Se corre SOBRE ese .blend:

  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background "tools/3d/blender qr/Bonsai.blend" --python tools/3d/blender/49_payment_bonsai_tree.py

Qué hace:
  - Las hojas del bonsái son partículas (sistema "Leaves", ~2000 por nube). Se "hacen reales" leyendo las instancias del depsgraph y se
    unen en UNA malla por nube: `lobe_00..lobe_09` (con su pivote abajo, para que la app las mece con el viento).
  - El tronco (`Cube`, material Bark) queda como `Bark`. Su textura original (un .jpg de otra máquina) no existe acá: se usa un marrón liso.
  - Las hojas usan la textura propia del .blend (Leaf_5_Color + Leaf_5_Mask) fundidas en un solo PNG con alfa; alphaMode MASK en el GLB.
Contrato del GLB (src/lib/3d/payment-figures.ts): nodo `Tree` (Y arriba, base en y = 0); hijos `Bark` y `lobe_NN`.
"""
import bpy, bmesh, math, os, shutil, tempfile, json, struct
import numpy as np
from mathutils import Vector

NAME = "bonsai_tree_payment_001"
ROOT = r"C:\Erick\app movil\vida-total-web"
OUT_DIR = os.path.join(ROOT, "biblioteca de assets", "_trabajo", "export")
PUBLIC = os.path.join(ROOT, "public", "models")
TMP = tempfile.mkdtemp(prefix="vt_bonsai_")
EMITTERS = [f"Cube.{i:03d}" for i in range(2, 12)]

# ── textura de hoja: color + máscara -> un PNG RGBA ───────────────────────────
col = bpy.data.images["Leaf_5_Color.png"]
msk = bpy.data.images["Leaf_5_Mask.png"]
w, h = col.size
c = np.array(col.pixels[:], dtype=np.float32).reshape(h, w, 4)
m = np.array(msk.pixels[:], dtype=np.float32).reshape(h, w, 4)
rgba = c.copy()
rgba[..., 3] = m[..., 0]
leaf_img = bpy.data.images.new("bonsai_leaf_rgba", w, h, alpha=True)
leaf_img.colorspace_settings.name = "Non-Color"
leaf_img.pixels.foreach_set(rgba.ravel())
leaf_img.update()
leaf_path = os.path.join(TMP, "bonsai_leaf_rgba.png")
leaf_img.filepath_raw = leaf_path
leaf_img.file_format = "PNG"
leaf_img.save()
bpy.data.images.remove(leaf_img)
leaf_img = bpy.data.images.load(leaf_path)
leaf_img.colorspace_settings.name = "sRGB"
leaf_img.pack()

leaf_mat = bpy.data.materials.new("VT_BonsaiLeaf")
leaf_mat.use_nodes = True
nt = leaf_mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = 0.6
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = leaf_img
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
try:
    leaf_mat.surface_render_method = "DITHERED"
except Exception:
    pass
leaf_mat.use_backface_culling = False

bark_mat = bpy.data.materials.new("VT_BonsaiBark")
bark_mat.use_nodes = True
bb = bark_mat.node_tree.nodes["Principled BSDF"]
bb.inputs["Base Color"].default_value = (0.20, 0.14, 0.10, 1.0)
bb.inputs["Roughness"].default_value = 0.9

# ── hojas: las instancias de partículas se juntan en una malla por nube ───────
# el visor muestra solo ~10 % de las partículas: se pide el 100 % (y los hijos de render) antes de evaluar
for pset in bpy.data.particles:
    pset.display_percentage = 100
    if getattr(pset, "child_type", "NONE") != "NONE":
        pset.child_nbr = pset.rendered_child_count
dg = bpy.context.evaluated_depsgraph_get()
dg.update()
leaf_src = bpy.data.objects["Plane.001"]
buckets = {n: bmesh.new() for n in EMITTERS}
leaf_me = leaf_src.data
counts = {n: 0 for n in EMITTERS}
for inst in dg.object_instances:
    if not inst.is_instance or inst.parent is None:
        continue
    pname = inst.parent.original.name
    if pname not in buckets:
        continue
    me = bpy.data.meshes.new_from_object(inst.object, depsgraph=dg)
    me.transform(inst.matrix_world)
    buckets[pname].from_mesh(me)
    bpy.data.meshes.remove(me)
    counts[pname] += 1
print("[bonsai] hojas por nube:", counts)

# pivotes: el centro-abajo de cada nube
pivots = {}
for n in EMITTERS:
    ob = bpy.data.objects[n]
    pts = [ob.matrix_world @ Vector(b) for b in ob.bound_box]
    pivots[n] = Vector((sum(p.x for p in pts) / 8, sum(p.y for p in pts) / 8, min(p.z for p in pts) + 0.35 * (max(p.z for p in pts) - min(p.z for p in pts))))

lobes = []
for i, n in enumerate(EMITTERS):
    bm = buckets[n]
    pv = pivots[n]
    bmesh.ops.translate(bm, vec=-pv, verts=bm.verts)
    me = bpy.data.meshes.new(f"lobe_{i:02d}")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(leaf_mat)
    ob = bpy.data.objects.new(f"lobe_{i:02d}", me)
    ob.location = pv
    bpy.context.scene.collection.objects.link(ob)
    lobes.append(ob)

# ── tronco ────────────────────────────────────────────────────────────────────
trunk = bpy.data.objects["Cube"]
trunk.data.materials.clear()
trunk.data.materials.append(bark_mat)
trunk.name = "Bark"
keep = set(lobes) | {trunk}
for ob in list(bpy.data.objects):
    if ob not in keep:
        bpy.data.objects.remove(ob, do_unlink=True)
zmin = min((trunk.matrix_world @ v.co).z for v in trunk.data.vertices)

root = bpy.data.objects.new("Tree", None)
bpy.context.scene.collection.objects.link(root)
for ob in keep:
    ob.parent = root
root.location = (0, 0, -zmin)  # base del tronco en el piso
tris = sum(len(p.vertices) - 2 for ob in keep for p in ob.data.polygons)
print(f"[bonsai] lobulos={len(lobes)} tris={tris}")

os.makedirs(OUT_DIR, exist_ok=True)
out_path = os.path.join(OUT_DIR, NAME + "_meshopt.glb")
kwargs = dict(
    filepath=out_path, export_format="GLB", use_selection=False, export_apply=True, export_texcoords=True, export_normals=True,
    export_cameras=False, export_lights=False, export_yup=True, export_image_format="AUTO", export_meshopt_compression_enable=True,
)
try:
    bpy.ops.export_scene.gltf(**kwargs)
except TypeError as e:
    print("opciones no reconocidas, reintentando mínimas:", e)
    for k in ("export_meshopt_compression_enable", "export_image_format"):
        kwargs.pop(k, None)
    bpy.ops.export_scene.gltf(**kwargs)


def patch_alpha_mask(path, material_name="VT_BonsaiLeaf", cutoff=0.5):
    data = open(path, "rb").read()
    magic, ver, _total = struct.unpack("<III", data[:12])
    jlen, jtype = struct.unpack("<II", data[12:20])
    doc = json.loads(data[20:20 + jlen])
    for mm in doc["materials"]:
        if mm.get("name") == material_name:
            mm["alphaMode"] = "MASK"
            mm["alphaCutoff"] = cutoff
            mm["doubleSided"] = True
    raw = json.dumps(doc, separators=(",", ":")).encode()
    raw += b" " * ((4 - len(raw) % 4) % 4)
    rest = data[20 + jlen:]
    out = struct.pack("<III", magic, ver, 12 + 8 + len(raw) + len(rest)) + struct.pack("<II", len(raw), jtype) + raw + rest
    open(path, "wb").write(out)


patch_alpha_mask(out_path)
print("[bonsai] exportado:", out_path, os.path.getsize(out_path) // 1024, "KB")
os.makedirs(PUBLIC, exist_ok=True)
shutil.copy(out_path, os.path.join(PUBLIC, NAME + "_meshopt.glb"))
