"""Tronco y ramas del árbol del QR de pago, versión 5 (la copa NO va en el GLB: la arma la app, un racimo de hojas por módulo oscuro de la matriz del QR, con las hojas de 47_payment_leaves.py). Antes: copa ORGÁNICA (racimos de hojas redondeados e irregulares con huecos), tronco con corteza
texturizada y ramas que asoman entre el follaje. Blanco / negro / grises (sin verde). Obra propia. Línea de comandos:

  "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background --python tools/3d/blender/45_payment_tree_organic.py

Contrato del GLB (src/lib/3d/payment-figures.ts): nodo `Tree` (Y arriba, base en y = 0); hijos `Bark` (estático) y `lobe_00..lobe_NN`
(racimos con su pivote en el origen; la app los mece con el viento). Hereda el esqueleto, la corteza y el tubo de 42_payment_tree_v2.py.
"""
import bpy, math, random, os, tempfile, json, struct, shutil
import numpy as np
from mathutils import Vector, Matrix

SEED = 31
NAME = "trunk_payment_001"
ROOT = r"C:\Erick\app movil\vida-total-web"
OUT_DIR = os.path.join(ROOT, "biblioteca de assets", "_trabajo", "export")
PUBLIC = os.path.join(ROOT, "public", "models")
PREVIEW = os.environ.get("VT_PREVIEW", os.path.join(tempfile.gettempdir(), "vt_trunk_preview.png"))
random.seed(SEED)
rng = np.random.default_rng(SEED)
TMP_TEX = tempfile.mkdtemp(prefix="vt_tree4_tex_")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ── texturas (numpy) ────────────────────────────────────────────────────────
def fbm(h, w, octaves, stretch_y=1.0, seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros((h, w))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        gh, gw = max(2, int((4 * 2**o) / stretch_y)), 4 * 2**o
        g = r.random((gh + 1, gw + 1))
        g[-1, :], g[:, -1] = g[0, :], g[:, 0]
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
    img.colorspace_settings.name = "Non-Color"  # ver nota en 40_payment_tree.py: el espacio real se asigna al recargar
    img.pixels.foreach_set(arr[::-1].astype(np.float32).ravel())
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
    ridges = fbm(size, size, 5, stretch_y=0.18, seed=1)
    fine = fbm(size, size, 6, stretch_y=1.0, seed=2)
    height = np.clip(0.7 * ridges + 0.3 * fine, 0, 1)
    t = (height - height.min()) / (height.max() - height.min())
    g = 0.06 + 0.34 * t  # grises: surcos oscuros, crestas más claras
    g *= 0.86 + 0.28 * fbm(size, size, 3, seed=3)
    col = np.repeat(g[..., None], 3, axis=2)
    albedo = np.concatenate([col, np.ones((size, size, 1))], axis=2)
    gy, gx = np.gradient(height)
    n = np.stack([-gx * 6.0, gy * 6.0, np.ones_like(height)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    normal = np.concatenate([n * 0.5 + 0.5, np.ones((size, size, 1))], axis=2)
    return make_image("bark_albedo", albedo), make_image("bark_normal", normal, srgb=False)


def pbr_material(name, albedo, normal=None, rough=0.85, alpha_clip=False, vertex_color=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = albedo
    color_out = tex.outputs["Color"]
    if vertex_color:
        # El tono por hoja va en el atributo de color del vértice y multiplica a la textura (igual que hace el visor glTF).
        attr = nt.nodes.new("ShaderNodeAttribute")
        attr.attribute_name = "Col"
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(tex.outputs["Color"], mix.inputs["A"])
        nt.links.new(attr.outputs["Color"], mix.inputs["B"])
        color_out = mix.outputs["Result"]
    nt.links.new(color_out, bsdf.inputs["Base Color"])
    if alpha_clip:
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        for attr_name, val in (("blend_method", "CLIP"), ("alpha_threshold", 0.5), ("shadow_method", "CLIP")):
            try:
                setattr(mat, attr_name, val)
            except Exception:
                pass
        try:
            mat.surface_render_method = "DITHERED"
        except Exception:
            pass
        mat.use_backface_culling = True
    if normal is not None:
        ntex = nt.nodes.new("ShaderNodeTexImage")
        ntex.image = normal
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = 1.0
        nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


# ── esqueleto (tronco + ramas) ──────────────────────────────────────────────
branches = []
tips = []


def rot_axis(v, axis, ang):
    return Matrix.Rotation(ang, 3, axis) @ v


def grow(start, direction, length, radius, level, max_level, n_children_override=None):
    pts = [(start.copy(), radius)]
    p, d = start.copy(), direction.normalized()
    steps = 6 if level == 0 else (5 if level < 2 else 4)
    seg = length / steps
    for i in range(steps):
        wob = Vector((random.uniform(-1, 1), random.uniform(-0.3, 0.6), random.uniform(-1, 1))) * (0.07 + 0.045 * level)
        d = (d + wob + Vector((0, 0.06 if level else 0.02, 0))).normalized()
        p = p + d * seg
        r = radius * (1 - 0.84 * (i + 1) / steps) if level < max_level else radius * (1 - 0.7 * (i + 1) / steps)
        pts.append((p.copy(), max(r, 0.0045)))
    branches.append(pts)
    if level >= max_level:
        tips.append((p.copy(), d.copy(), level))
        return
    n_children = n_children_override or {0: 4, 1: 4, 2: 3}.get(level, 2)
    spin = random.uniform(0, math.tau)
    for k in range(n_children):
        t = random.uniform(0.62, 0.97) if level == 0 else random.uniform(0.45, 0.95)
        idx = min(int(t * steps), steps)
        base, br = pts[idx]
        ang = spin + k * (math.tau / n_children) + random.uniform(-0.35, 0.35)
        out = d.cross(Vector((0.3, 1.0, 0.2))).normalized()
        out = rot_axis(out, d, ang)
        tilt = random.uniform(0.62, 1.0) if level == 0 else random.uniform(0.5, 0.95)
        cd = (d * math.cos(tilt) + out * math.sin(tilt)).normalized()
        grow(base, cd, length * random.uniform(0.56, 0.74), br * random.uniform(0.55, 0.7), level + 1, max_level)
    if level in (0, 1):
        grow(p, d + Vector((random.uniform(-0.2, 0.2), 0.1, random.uniform(-0.2, 0.2))), length * 0.58, pts[-1][1] * 1.25, level + 1, max_level)
    else:
        tips.append((p.copy(), d.copy(), level))


grow(Vector((0, 0, 0)), Vector((0.05, 1.0, 0.03)), 2.55, 0.37, 0, 3)

SIDES = 12


def tube_geometry(branches):
    verts, faces, uvs = [], [], []
    for bi, pts in enumerate(branches):
        base_idx = len(verts)
        ring_n = len(pts)
        up = Vector((0, 0, 1))
        for i, (p, r) in enumerate(pts):
            if i == 0:
                tang = pts[1][0] - p
            elif i == ring_n - 1:
                tang = p - pts[i - 1][0]
            else:
                tang = pts[i + 1][0] - pts[i - 1][0]
            tang.normalize()
            if abs(tang.dot(up)) > 0.95:
                up = Vector((1, 0, 0))
            side = tang.cross(up).normalized()
            up2 = side.cross(tang).normalized()
            flare = 1.0
            if bi == 0 and i == 0:
                flare = 1.45
            if bi == 0 and i == 1:
                flare = 1.12
            for s in range(SIDES + 1):
                a = s / SIDES * math.tau
                wobble = 1 + 0.07 * math.sin(a * 3 + i) + 0.04 * math.sin(a * 7 + i * 2)
                verts.append(p + (side * math.cos(a) + up2 * math.sin(a)) * r * flare * wobble)
        for i in range(ring_n - 1):
            for s in range(SIDES):
                a = base_idx + i * (SIDES + 1) + s
                faces.append((a, a + 1, a + SIDES + 2, a + SIDES + 1))
        seg_v = [0.0]
        for i in range(1, ring_n):
            seg_v.append(seg_v[-1] + (pts[i][0] - pts[i - 1][0]).length / max(pts[i][1] * 2 * math.pi, 0.02))
        for i in range(ring_n - 1):
            for s in range(SIDES):
                u0, u1 = s / SIDES, (s + 1) / SIDES
                v0, v1 = seg_v[i] * 0.55, seg_v[i + 1] * 0.55
                uvs.extend([(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    return verts, faces, uvs


def build_object(name, verts, faces, uvs, material, smooth=True, colors=None, custom_normals=None, uv_per_vertex=None, location=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    if uv_per_vertex is not None:
        for li, loop in enumerate(mesh.loops):
            uv.data[li].uv = uv_per_vertex[loop.vertex_index]
    else:
        for li in range(len(mesh.loops)):
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
    if location is not None:
        obj.location = location
    scene.collection.objects.link(obj)
    return obj



bark_albedo, bark_normal = bark_images()
bark_mat = pbr_material("VT_TreeBark", bark_albedo, bark_normal, rough=0.9)


# El tronco va a ESCALA REAL de la escena (el tablero mide 7.2 unidades): la app no lo reescala. Sube hasta la copa (que arranca a ~2.3
# de altura y llega a ~5.6) y las ramas se abren por dentro de ella.
grow(Vector((0, 0, 0)), Vector((0.03, 1.0, 0.02)), 3.2, 0.30, 0, 2)
SIDES = 12
bverts, bfaces, buvs = tube_geometry(branches)
bark_mat = pbr_material("VT_TreeBark", bark_albedo, bark_normal, rough=0.9)
bark_obj = build_object("Bark", bverts, bfaces, buvs, bark_mat)
root = bpy.data.objects.new("Tree", None)
scene.collection.objects.link(root)
bark_obj.parent = root
root.rotation_euler = (math.radians(90), 0, 0)  # se construyó con Y arriba (como glTF)
print(f"[trunk] ramas={len(branches)} puntas={len(tips)} alto_max={max(t[0].y for t in tips):.2f}")

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
print("[trunk] exportado:", out_path, os.path.getsize(out_path) // 1024, "KB")
os.makedirs(PUBLIC, exist_ok=True)
shutil.copy(out_path, os.path.join(PUBLIC, NAME + "_meshopt.glb"))
