"""Árbol procedural para la pantalla de pago (QR). Obra propia: generado por este script, sin assets de terceros.

Se corre SIN el MCP, en línea de comandos:
  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python tools/3d/blender/40_payment_tree.py

Qué hace: genera troncos/ramas (tubos cónicos recursivos) con textura de corteza + normal map, y copas de HOJAS COMO TARJETAS con
alfa (pocos triángulos, aspecto realista), con tono por vértice y normales suavizadas hacia fuera de la copa. Exporta un GLB con
Meshopt (misma compresión que el resto de la biblioteca) a biblioteca de assets/_trabajo/export y a public/models.
Todo es determinista (semilla fija). Objetivo móvil: ~15-25k triángulos, texturas 512/256 px.

Contrato del GLB para el runtime (src/lib/3d/payment-figure.ts):
  nodo "Tree"  -> la figura. Altura ≈ 3.6 unidades, base en y = 0 (Y-up al exportar).
  nodo "Leaves" y "Bark" son mallas hijas; las hojas usan alphaMode MASK.
"""
import bpy, bmesh, math, random, os
import numpy as np
from mathutils import Vector, Matrix

SEED = 7
OUT_DIR = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\export"
PUBLIC = r"C:\Erick\app movil\vida-total-web\public\models"
NAME = "tree_payment_001"
random.seed(SEED)
import tempfile
TMP_TEX = tempfile.mkdtemp(prefix="vt_tree_tex_")
rng = np.random.default_rng(SEED)

# ── escena limpia ───────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ── texturas procedurales (numpy) ───────────────────────────────────────────
def fbm(h, w, octaves, stretch_y=1.0, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        gh, gw = max(2, int((4 * 2**o) / stretch_y)), 4 * 2**o
        g = r.random((gh + 1, gw + 1))
        g[-1, :], g[:, -1] = g[0, :], g[:, 0]  # tileable
        ys, xs = np.linspace(0, gh, h, endpoint=False), np.linspace(0, gw, w, endpoint=False)
        y0, x0 = ys.astype(int), xs.astype(int)
        fy, fx = (ys - y0)[:, None], (xs - x0)[None, :]
        fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
        a, b = g[np.ix_(y0, x0)], g[np.ix_(y0, x0 + 1)]
        c, d = g[np.ix_(y0 + 1, x0)], g[np.ix_(y0 + 1, x0 + 1)]
        out += amp * (a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy)
        total += amp
        amp *= 0.5
    return out / total


def make_image(name, arr, srgb=True):
    h, w, _ = arr.shape
    img = bpy.data.images.new(name, w, h, alpha=True)
    # OJO: cambiar el espacio de color de una imagen generada DESPUÉS de cargarle los píxeles los borra (queda en negro).
    # Se carga y guarda como Non-Color (sin conversión: los valores ya están en sRGB de pantalla) y el espacio de color
    # real se asigna al recargar el PNG desde disco.
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(arr[::-1].astype(np.float32).ravel())  # Blender: origen abajo-izquierda
    img.update()
    path = os.path.join(TMP_TEX, name + ".png")
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    loaded = bpy.data.images.load(path)
    loaded.name = name
    loaded.colorspace_settings.name = "sRGB" if srgb else "Non-Color"
    loaded.pack()
    return loaded


def bark_images(size=512):
    # surcos verticales: ruido muy estirado en Y + ruido fino
    ridges = fbm(size, size, 5, stretch_y=0.18, seed=1)
    fine = fbm(size, size, 6, stretch_y=1.0, seed=2)
    height = np.clip(0.7 * ridges + 0.3 * fine, 0, 1)
    t = (height - height.min()) / (height.max() - height.min())
    dark, light = np.array([0.13, 0.085, 0.05]), np.array([0.42, 0.30, 0.20])
    col = dark[None, None, :] * (1 - t[..., None]) + light[None, None, :] * t[..., None]
    col *= (0.88 + 0.24 * fbm(size, size, 3, seed=3))[..., None]
    albedo = np.concatenate([col, np.ones((size, size, 1))], axis=2)
    # normal map desde el relieve
    gy, gx = np.gradient(height)
    k = 6.0
    n = np.stack([-gx * k, gy * k, np.ones_like(height)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    normal = np.concatenate([n * 0.5 + 0.5, np.ones((size, size, 1))], axis=2)
    return make_image("bark_albedo", albedo), make_image("bark_normal", normal, srgb=False)


def leaf_image(size=256):
    ys, xs = np.mgrid[0:size, 0:size]
    u, v = (xs + 0.5) / size * 2 - 1, (ys + 0.5) / size * 2 - 1  # [-1,1]; v hacia abajo
    # hoja apuntando hacia arriba (v = -1 es la punta): ancho máximo cerca del 40 % inferior
    t = (v + 1) / 2  # 0 punta .. 1 base
    half_w = np.sin(np.clip(t, 0, 1) ** 0.65 * math.pi) * 0.72 * (1 - 0.15 * t)
    mask = (np.abs(u) < half_w) & (t > 0.02) & (t < 0.985)
    edge = np.clip((half_w - np.abs(u)) / 0.06, 0, 1)
    alpha = np.where(mask, edge, 0)
    vein = np.exp(-(u / 0.035) ** 2) * (t > 0.05)
    side = np.exp(-(((np.abs(u) - 0.25 * (t - 0.1)) % 0.38 - 0.19) / 0.03) ** 2) * (np.abs(u) < half_w) * 0.25
    base = np.array([0.16, 0.40, 0.10])
    tint = 0.85 + 0.3 * fbm(size, size, 4, seed=5)
    col = base[None, None, :] * tint[..., None]
    col = col * (1 - 0.35 * (vein + side)[..., None]) + np.array([0.25, 0.45, 0.14]) * (0.35 * (vein + side)[..., None])
    arr = np.concatenate([col, alpha[..., None]], axis=2)
    arr[..., :3] = np.clip(arr[..., :3], 0, 1)
    # el RGB fuera de la hoja se rellena con verde para que el mip no sangre gris
    arr[..., :3] = np.where(alpha[..., None] > 0, arr[..., :3], base[None, None, :])
    return make_image("leaf_albedo", arr)


bark_albedo, bark_normal = bark_images()
leaf_albedo = leaf_image()


# ── materiales ──────────────────────────────────────────────────────────────
def pbr_material(name, albedo, normal=None, rough=0.85, alpha_clip=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = albedo
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha_clip:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        for attr, val in (("blend_method", "CLIP"), ("alpha_threshold", 0.5), ("shadow_method", "CLIP")):
            try:
                setattr(mat, attr, val)
            except Exception:
                pass
        try:
            mat.surface_render_method = "DITHERED"
        except Exception:
            pass
        mat.use_backface_culling = True  # las hojas llevan su cara de atrás en la geometría
    if normal is not None:
        ntex = nt.nodes.new("ShaderNodeTexImage")
        ntex.image = normal
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = 1.0
        nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


bark_mat = pbr_material("VT_TreeBark", bark_albedo, bark_normal, rough=0.92)
leaf_mat = pbr_material("VT_TreeLeaf", leaf_albedo, None, rough=0.7, alpha_clip=True)

# ── esqueleto del árbol ─────────────────────────────────────────────────────
branches = []  # cada rama: lista de (punto, radio)
tips = []      # (punto, dirección, nivel) donde van hojas


def rot_axis(v, axis, ang):
    return Matrix.Rotation(ang, 3, axis) @ v


def grow(start, direction, length, radius, level, max_level):
    """Rama curvada con tropismo hacia arriba; hijas en espiral."""
    pts = [(start.copy(), radius)]
    p, d = start.copy(), direction.normalized()
    steps = 5 if level < 2 else 4
    seg = length / steps
    for i in range(steps):
        wob = Vector((random.uniform(-1, 1), random.uniform(-0.3, 0.6), random.uniform(-1, 1))) * (0.10 + 0.04 * level)
        d = (d + wob + Vector((0, 0.07 if level else 0.03, 0))).normalized()
        p = p + d * seg
        r = radius * (1 - 0.88 * (i + 1) / steps) if level < max_level else radius * (1 - 0.7 * (i + 1) / steps)
        pts.append((p.copy(), max(r, 0.004)))
    branches.append(pts)
    if level >= max_level:
        tips.append((p.copy(), d.copy(), level))
        return
    n_children = {0: 6, 1: 4, 2: 3}.get(level, 2)
    spin = random.uniform(0, math.tau)
    for k in range(n_children):
        t = random.uniform(0.45, 0.95) if level else random.uniform(0.38, 0.88)
        idx = min(int(t * steps), steps)
        base, br = pts[idx]
        ang = spin + k * (math.tau / n_children) + random.uniform(-0.4, 0.4)
        out = d.cross(Vector((0.3, 1.0, 0.2))).normalized()
        out = rot_axis(out, d, ang)
        tilt = random.uniform(0.55, 1.0) if level == 0 else random.uniform(0.5, 0.95)
        cd = (d * math.cos(tilt) + out * math.sin(tilt)).normalized()
        grow(base, cd, length * random.uniform(0.55, 0.72), br * random.uniform(0.55, 0.7), level + 1, max_level)
    # la rama continúa hacia la punta con una hija más (copa llena)
    if level in (0, 1):
        grow(p, d + Vector((random.uniform(-0.2, 0.2), 0.1, random.uniform(-0.2, 0.2))), length * 0.55, pts[-1][1] * 1.3, level + 1, max_level)
    else:
        tips.append((p.copy(), d.copy(), level))


# tronco: ligeramente inclinado y con curvatura
grow(Vector((0, 0, 0)), Vector((0.06, 1.0, 0.04)), 1.7, 0.17, 0, 3)

# ── malla de corteza: tubos con anillos ─────────────────────────────────────
SIDES = 10


def tube_geometry(branches):
    verts, faces, uvs = [], [], []
    for pts in branches:
        base_idx = len(verts)
        ring_n = len(pts)
        # marco a lo largo de la rama
        up = Vector((0, 0, 1))
        acc_len = 0.0
        for i, (p, r) in enumerate(pts):
            if i == 0:
                tang = (pts[1][0] - p)
            elif i == ring_n - 1:
                tang = (p - pts[i - 1][0])
            else:
                tang = (pts[i + 1][0] - pts[i - 1][0])
            tang.normalize()
            if abs(tang.dot(up)) > 0.95:
                up = Vector((1, 0, 0))
            side = tang.cross(up).normalized()
            up2 = side.cross(tang).normalized()
            flare = 1.0
            if i == 0 and pts is branches[0]:
                flare = 1.55  # ensanche de raíces
            if i > 0:
                acc_len += (p - pts[i - 1][0]).length
            for s in range(SIDES + 1):
                a = s / SIDES * math.tau
                wobble = 1 + 0.06 * math.sin(a * 3 + i)
                verts.append(p + (side * math.cos(a) + up2 * math.sin(a)) * r * flare * wobble)
        for i in range(ring_n - 1):
            for s in range(SIDES):
                a = base_idx + i * (SIDES + 1) + s
                b = a + 1
                c = a + SIDES + 2
                d = a + SIDES + 1
                faces.append((a, b, c, d))
        # UVs: u alrededor, v a lo largo (en unidades de longitud / diámetro para no estirar la textura)
        seg_v = [0.0]
        for i in range(1, ring_n):
            seg_v.append(seg_v[-1] + (pts[i][0] - pts[i - 1][0]).length / max(pts[i][1] * 2 * math.pi, 0.02))
        for i in range(ring_n - 1):
            for s in range(SIDES):
                u0, u1 = s / SIDES, (s + 1) / SIDES
                v0, v1 = seg_v[i] * 0.55, seg_v[i + 1] * 0.55
                uvs.extend([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    return verts, faces, uvs


def build_object(name, verts, faces, uvs, material, smooth=True, colors=None, custom_normals=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    for li, loop in enumerate(mesh.loops):
        uv.data[li].uv = uvs[li]
    if smooth:
        mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    if colors is not None:
        attr = mesh.color_attributes.new(name="Col", type="BYTE_COLOR", domain="POINT")
        for vi, c in enumerate(colors):
            attr.data[vi].color = (*c, 1.0)
    if custom_normals is not None:
        try:
            mesh.normals_split_custom_set_from_vertices([tuple(n) for n in custom_normals])
        except Exception as e:
            print("normales personalizadas no disponibles:", e)
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


bverts, bfaces, buvs = tube_geometry(branches)
bark_obj = build_object("Bark", bverts, bfaces, buvs, bark_mat)

# ── hojas: tarjetas con alfa en racimos, con tono por vértice y normales hacia fuera de la copa ───
all_tips = [t for t in tips]
canopy_pts = [t[0] for t in all_tips]
center = sum(canopy_pts, Vector()) / len(canopy_pts)
center.y -= 0.35  # hacia donde "miran" las normales: un poco por debajo del centro de la copa
leaf_verts, leaf_faces, leaf_uvs, leaf_cols, leaf_norms = [], [], [], [], []
LEAF_W, LEAF_H = 0.34, 0.46
for tip, d, level in all_tips:
    for _ in range(26):
        pos = tip + Vector((random.gauss(0, 0.30), random.gauss(0, 0.22), random.gauss(0, 0.30)))
        # orientación: eje de la hoja (punta) aleatorio hacia arriba/afuera
        axis_y = Vector((random.uniform(-1, 1), random.uniform(-0.2, 1), random.uniform(-1, 1))).normalized()
        ref = Vector((0, 0, 1)) if abs(axis_y.z) < 0.9 else Vector((1, 0, 0))
        axis_x = axis_y.cross(ref).normalized()
        n = axis_x.cross(axis_y).normalized()
        scale = random.uniform(0.75, 1.25)
        hw, hh = LEAF_W * scale / 2, LEAF_H * scale / 2
        # base de la hoja en pos, punta hacia axis_y; dos quads levemente doblados por el nervio central
        v00 = pos - axis_x * hw
        v01 = pos + axis_x * hw
        v11 = pos + axis_y * (hh * 2) + axis_x * hw
        v10 = pos + axis_y * (hh * 2) - axis_x * hw
        base = len(leaf_verts)
        leaf_verts.extend([v00, v01, v11, v10])
        leaf_faces.append((base, base + 1, base + 2, base + 3))
        leaf_uvs.extend([(0, 0), (1, 0), (1, 1), (0, 1)])  # base abajo (v=0), punta arriba (v=1)
        # Cara de atrás real (en vez de doble cara por material): las dos caras comparten la normal hacia afuera de la copa,
        # así el envés no se ve oscuro por la normal invertida y se puede usar culling.
        leaf_faces.append((base + 3, base + 2, base + 1, base))
        leaf_uvs.extend([(0, 1), (1, 1), (1, 0), (0, 0)])
        shade = random.uniform(0.62, 1.0) * (0.78 + 0.22 * min(1.0, (pos.y) / 3.4))
        tintc = (shade * random.uniform(0.9, 1.05), shade, shade * random.uniform(0.7, 0.95))
        for _v in range(4):
            leaf_cols.append(tintc)
        outward = (pos - center).normalized()
        for _v in range(4):
            leaf_norms.append((outward * 0.8 + n * 0.2).normalized())

leaf_obj = build_object(
    "Leaves", leaf_verts, leaf_faces, leaf_uvs, leaf_mat, smooth=True, colors=leaf_cols, custom_normals=leaf_norms
)

# ── pequeño montículo de tierra y raíces para que se apoye ──────────────────
gverts, gfaces, guvs = [], [], []
R = 1.25
rings = 5
gverts.append(Vector((0, 0.11, 0)))
for ri in range(1, rings + 1):
    rr = R * ri / rings
    hh = 0.11 * (1 - (ri / rings) ** 2) + 0.0
    for s in range(24):
        a = s / 24 * math.tau
        gverts.append(Vector((math.cos(a) * rr * (1 + 0.06 * math.sin(a * 5)), hh, math.sin(a) * rr * (1 + 0.06 * math.cos(a * 4)))))
for s in range(24):
    gfaces.append((0, 1 + s, 1 + (s + 1) % 24))
for ri in range(1, rings):
    for s in range(24):
        a = 1 + (ri - 1) * 24 + s
        b = 1 + (ri - 1) * 24 + (s + 1) % 24
        c = 1 + ri * 24 + (s + 1) % 24
        d = 1 + ri * 24 + s
        gfaces.append((a, d, c, b))
guvs = [(0.5 + gverts[i].x / (2 * R), 0.5 + gverts[i].z / (2 * R)) for f in gfaces for i in f]
ground_mat = bpy.data.materials.new("VT_TreeGround")
ground_mat.use_nodes = True
gb = ground_mat.node_tree.nodes["Principled BSDF"]
gb.inputs["Base Color"].default_value = (0.045, 0.032, 0.02, 1)
gb.inputs["Roughness"].default_value = 1.0
ground_obj = build_object("Ground", gverts, gfaces, guvs, ground_mat)

# ── agrupar bajo un nodo "Tree" ─────────────────────────────────────────────
root = bpy.data.objects.new("Tree", None)
scene.collection.objects.link(root)
for o in (bark_obj, leaf_obj, ground_obj):
    o.parent = root

# Blender es Z-up; el exportador convierte a Y-up. Hay que rotar el árbol para que "arriba" (Y en este script) sea Z de Blender.
# Se generó con Y como arriba a propósito (coincide con glTF), así que se compensa la conversión del exportador con +X 90°.
root.rotation_euler = (math.radians(90), 0, 0)

tri_count = sum(len(o.data.polygons) * 2 for o in (bark_obj, leaf_obj, ground_obj))
_all = [v for o in (bark_obj, leaf_obj, ground_obj) for v in (o.matrix_world @ Vector(c) for c in o.bound_box)]
print("[tree] bbox x:%.2f..%.2f y(arriba):%.2f..%.2f z:%.2f..%.2f" % (min(v.x for v in _all), max(v.x for v in _all), min(v.z for v in _all), max(v.z for v in _all), min(v.y for v in _all), max(v.y for v in _all)))
print(f"[tree] ramas={len(branches)} puntas={len(tips)} tris≈{tri_count} hojas={len(leaf_faces)}")

# ── exportar ────────────────────────────────────────────────────────────────
os.makedirs(OUT_DIR, exist_ok=True)
out_path = os.path.join(OUT_DIR, NAME + "_meshopt.glb")
kwargs = dict(
    filepath=out_path,
    export_format="GLB",
    use_selection=False,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_vertex_color="ACTIVE",
    export_cameras=False,
    export_lights=False,
    export_yup=True,
    export_image_format="WEBP" if False else "AUTO",
    export_meshopt_compression_enable=True,
)
try:
    bpy.ops.export_scene.gltf(**kwargs)
except TypeError as e:  # nombres de opción distintos según versión
    print("opciones no reconocidas, reintentando mínimas:", e)
    for k in ("export_vertex_color", "export_meshopt_compression_enable", "export_image_format"):
        kwargs.pop(k, None)
    bpy.ops.export_scene.gltf(**kwargs)
def patch_alpha_mask(path, material_name="VT_TreeLeaf", cutoff=0.5):
    """El exportador deja las hojas en alphaMode BLEND (se ordenan mal con tantas tarjetas). Se pasa a MASK (recorte con
    umbral), que escribe profundidad y se ve limpio. Solo se reescribe el JSON del GLB; el bloque binario no cambia."""
    import json, struct
    data = open(path, "rb").read()
    magic, ver, _total = struct.unpack("<III", data[:12])
    jlen, jtype = struct.unpack("<II", data[12:20])
    doc = json.loads(data[20:20 + jlen])
    for m in doc["materials"]:
        if m.get("name") == material_name:
            m["alphaMode"] = "MASK"
            m["alphaCutoff"] = cutoff
    raw = json.dumps(doc, separators=(",", ":")).encode()
    raw += b" " * ((4 - len(raw) % 4) % 4)
    rest = data[20 + jlen:]
    out = struct.pack("<III", magic, ver, 12 + 8 + len(raw) + len(rest)) + struct.pack("<II", len(raw), jtype) + raw + rest
    open(path, "wb").write(out)


patch_alpha_mask(out_path)
print("[tree] exportado:", out_path, os.path.getsize(out_path) // 1024, "KB")
os.makedirs(PUBLIC, exist_ok=True)
import shutil
shutil.copy(out_path, os.path.join(PUBLIC, NAME + "_meshopt.glb"))
