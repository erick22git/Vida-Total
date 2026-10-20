"""Árbol del QR de pago, versión 2 (referencia: castaño de Indias en escala de grises, vista isométrica). Obra propia, sin assets
de terceros. Se corre en línea de comandos (el servidor del MCP de Blender no estaba activo):

  "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background --python tools/3d/blender/42_payment_tree_v2.py

Qué cambia respecto de la v1 (40_payment_tree.py):
  - PALETA ESTRICTA BLANCO/NEGRO/GRISES (nada de verde): hojas, corteza y hojarasca en escala de grises.
  - Hojas PALMEADAS (7 folíolos con nervio central) en vez de una hoja simple: el aspecto del castaño de la referencia.
  - La copa se parte en LÓBULOS (cada uno es un nodo `lobe_NN` con su propio pivote) para que la app los mueva con el viento:
    el movimiento se hace en el navegador, nodo por nodo (sirve igual en WebGPU y en WebGL, no depende de un shader a medida).
  - Tronco más grueso con raíces que abren en la base, hojarasca en el piso y hojas pegadas al tronco (como en la referencia).
Contrato del GLB (src/lib/3d/payment-figures.ts): nodo `Tree` (Y arriba, base en y=0); hijos `Bark`, `Litter` (estáticos) y
`lobe_00..lobe_NN` (pivote en su origen; se mecen). Hojas con alphaMode MASK. Todo determinista (semilla fija).
"""
import bpy, math, random, os, tempfile, json, struct, shutil
import numpy as np
from mathutils import Vector, Matrix

SEED = 11
NAME = "tree_payment_002"
ROOT = r"C:\Erick\app movil\vida-total-web"
OUT_DIR = os.path.join(ROOT, "biblioteca de assets", "_trabajo", "export")
PUBLIC = os.path.join(ROOT, "public", "models")
PREVIEW = os.environ.get("VT_PREVIEW", os.path.join(tempfile.gettempdir(), "vt_tree_preview.png"))
random.seed(SEED)
rng = np.random.default_rng(SEED)
TMP_TEX = tempfile.mkdtemp(prefix="vt_tree2_tex_")

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


def palmate_leaf_image(size=256):
    """Hoja palmeada: 7 folíolos (obovados) que salen de la base; escala de grises; alfa para recortar."""
    ys, xs = np.mgrid[0:size, 0:size]
    # origen del peciolo: centro-abajo; v hacia arriba (y de imagen invertido)
    u = (xs + 0.5) / size * 2 - 1
    v = 1 - (ys + 0.5) / size * 2          # 1 arriba, -1 abajo
    ox, oy = 0.0, -0.88                     # base de los folíolos
    alpha = np.zeros((size, size))
    shade = np.zeros((size, size))
    angles = [-68, -46, -23, 0, 23, 46, 68]
    lengths = [0.95, 1.20, 1.45, 1.62, 1.45, 1.20, 0.95]
    widths = [0.17, 0.21, 0.25, 0.27, 0.25, 0.21, 0.17]   # semiancho máximo de cada folíolo
    for ang, L, Wm in zip(angles, lengths, widths):
        a = math.radians(ang)
        dx, dy = u - ox, v - oy
        # coordenadas locales del folíolo: t a lo largo (0 base .. 1 punta), s a lo ancho
        t = (dx * math.sin(a) + dy * math.cos(a)) / L
        s = (dx * math.cos(a) - dy * math.sin(a))
        tt = np.clip(t, 0, 1)
        half = Wm * (tt ** 0.6) * ((1 - tt) ** 0.45) / 0.488  # obovado: más ancho hacia la punta
        half = half * (1 + 0.05 * np.sin(tt * 38 + ang))      # serrado suave del borde
        inside = (t > 0.04) & (t < 1.0) & (np.abs(s) < half)
        edge = np.clip((half - np.abs(s)) / 0.03, 0, 1)
        a_new = np.where(inside, edge, 0)
        vein = np.exp(-(s / 0.02) ** 2) * (t > 0.04)
        lateral = (np.exp(-(((np.abs(s) / 0.06 + tt * 3.0) % 1.0 - 0.5) / 0.09) ** 2)) * 0.5 * inside
        sh = 0.66 + 0.18 * tt + 0.20 * vein + 0.08 * lateral
        take = a_new > alpha
        alpha = np.where(take, a_new, alpha)
        shade = np.where(take, sh, shade)
    # peciolo
    pet = (np.abs(u - ox) < 0.03) & (v < oy + 0.05) & (v > -0.99)
    alpha = np.where(pet, 1.0, alpha)
    shade = np.where(pet & (alpha > 0), 0.62, shade)
    shade = shade * (0.86 + 0.26 * fbm(size, size, 4, seed=5))
    g = np.clip(shade, 0, 1)
    col = np.repeat(g[..., None], 3, axis=2)
    col = np.where(alpha[..., None] > 0, col, 0.5)  # relleno gris neutro fuera de la hoja: el mip no sangra
    arr = np.concatenate([col, alpha[..., None]], axis=2)
    return make_image("leaf_albedo", arr)


bark_albedo, bark_normal = bark_images()
leaf_albedo = palmate_leaf_image()


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


bark_mat = pbr_material("VT_TreeBark", bark_albedo, bark_normal, rough=0.92)
leaf_mat = pbr_material("VT_TreeLeaf", leaf_albedo, None, rough=0.62, alpha_clip=True, vertex_color=True)

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


bverts, bfaces, buvs = tube_geometry(branches)
bark_obj = build_object("Bark", bverts, bfaces, buvs, bark_mat)

# ── copa: lóbulos (grupos de puntas) con hojas palmeadas ────────────────────
def farthest_points(points, k):
    chosen = [max(range(len(points)), key=lambda i: points[i].y)]
    dist = [(p - points[chosen[0]]).length for p in points]
    while len(chosen) < k:
        j = max(range(len(points)), key=lambda i: dist[i])
        chosen.append(j)
        dist = [min(dist[i], (points[i] - points[j]).length) for i in range(len(points))]
    return chosen


# Lóbulos de la copa: solo puntas altas (el tronco queda a la vista abajo, como en la referencia) + algunos laterales bajos.
tip_pts = [t[0] for t in tips if t[0].y >= 2.95 or (t[0].y >= 2.45 and (abs(t[0].x) > 0.9 or abs(t[0].z) > 0.9))]
K = min(20, len(tip_pts))
centers_idx = farthest_points(tip_pts, K)
groups = [[] for _ in range(K)]
for i, p in enumerate(tip_pts):
    gi = min(range(K), key=lambda g: (p - tip_pts[centers_idx[g]]).length)
    groups[gi].append(p)

canopy_center = sum(tip_pts, Vector()) / len(tip_pts)
canopy_center.y -= 0.25
LEAF_SIZE = 0.62          # ancho de la hoja palmeada (unidades del árbol)
LEAVES_PER_LOBE = 64

lobe_objs = []
total_leaf_count = 0


def leaf_quad(pos, axis_y, n, size, shade_val, out_normal):
    """Hoja = grilla 3x3 de vértices (plegada por el nervio y caída hacia la punta). Devuelve verts, uvs, colores, normales."""
    axis_x = axis_y.cross(n).normalized()
    hw, hh = size / 2, size * 0.58
    verts, uvs, cols, norms = [], [], [], []
    for r in range(2):
        t = float(r)
        for c in range(3):
            x = (c - 1)  # -1, 0, 1
            p = pos + axis_y * (t * hh * 2) + axis_x * (x * hw) + n * (abs(x) * hw * 0.22) + Vector((0, -1, 0)) * (t * hh * 0.40)
            verts.append(p)
            uvs.append((c / 2, t))
            cols.append((shade_val, shade_val, shade_val))
            norms.append(out_normal)
    return verts, uvs, cols, norms


for gi, pts_g in enumerate(groups):
    c = sum(pts_g, Vector()) / len(pts_g)
    spread = max(0.55, math.sqrt(sum(((p - c).length ** 2) for p in pts_g) / len(pts_g)) * 1.15)
    rx, ry = spread * 1.15 + 0.35, spread * 0.70 + 0.28
    # pivote del lóbulo: hacia el tronco/ramas (abajo y adentro): el mecido se ve como una rama que se dobla en su base
    pivot = Vector((c.x * 0.55, c.y - ry * 0.9, c.z * 0.55))
    lv, lf, luv, lcol, lnorm = [], [], [], [], []
    for _ in range(LEAVES_PER_LOBE):
        # muestreo en la cáscara del elipsoide (80 %) o en el interior (20 %)
        d = Vector((random.gauss(0, 1), random.gauss(0, 1), random.gauss(0, 1))).normalized()
        k = 1.0 - (random.random() ** 2.2) * (0.35 if random.random() < 0.8 else 0.95)
        pos = c + Vector((d.x * rx, d.y * ry, d.z * rx)) * k
        if pos.y < 2.45:  # nada por debajo de la copa: el tronco queda a la vista
            pos.y = 2.45 + (2.45 - pos.y) * 0.25
        out_n = (pos - canopy_center).normalized()
        n = (out_n * 0.55 + Vector((0, 1, 0)) * 0.55 + Vector((random.gauss(0, 0.28), random.gauss(0, 0.28), random.gauss(0, 0.28)))).normalized()
        # eje de la hoja: tangente al plano, apunta hacia afuera
        ref = out_n - n * out_n.dot(n)
        if ref.length < 0.05:
            ref = Vector((random.uniform(-1, 1), 0, random.uniform(-1, 1)))
        axis_y = (ref.normalized() + Vector((random.gauss(0, 0.45), random.gauss(0, 0.2), random.gauss(0, 0.45)))).normalized()
        axis_y = (axis_y - n * axis_y.dot(n)).normalized()
        size = LEAF_SIZE * random.uniform(0.78, 1.22)
        # tono: arriba y afuera más claro; el interior y el lado de abajo, oscuros (como en la referencia)
        upness = max(0.0, min(1.0, (pos.y - 1.5) / 4.2))
        outness = k
        shade_val = max(0.30, min(1.0, 0.50 + 0.38 * upness * outness + 0.20 * max(0.0, n.y) + random.uniform(-0.12, 0.12)))
        base = len(lv)
        vs, us, cs, ns = leaf_quad(pos - pivot, axis_y, n, size, shade_val, (out_n * 0.75 + n * 0.25).normalized())
        lv.extend(vs)
        luv.extend(us)
        lcol.extend(cs)
        lnorm.extend(ns)
        for cc in range(2):
            a = base + cc
            lf.append((a, a + 1, a + 4, a + 3))          # cara de arriba
            lf.append((a + 3, a + 4, a + 1, a))          # cara de atrás (misma normal hacia afuera: sin envés oscuro)
        total_leaf_count += 1
    obj = build_object(f"lobe_{gi:02d}", lv, lf, None, leaf_mat, colors=lcol, custom_normals=lnorm, uv_per_vertex=luv, location=pivot)
    lobe_objs.append(obj)

# ── hojarasca en el piso + hojas pegadas al tronco (estáticas) ──────────────
lv, lf, luv, lcol, lnorm = [], [], [], [], []


def add_leaf(pos, n, axis_y, size, shade_val, out_n):
    base = len(lv)
    vs, us, cs, ns = leaf_quad(pos, axis_y, n, size, shade_val, out_n)
    lv.extend(vs); luv.extend(us); lcol.extend(cs); lnorm.extend(ns)
    for cc in range(2):
        a = base + cc
        lf.append((a, a + 1, a + 4, a + 3))
        lf.append((a + 3, a + 4, a + 1, a))


for _ in range(70):  # hojarasca sobre el piso
    a = random.uniform(0, math.tau)
    rr = random.uniform(0.35, 1.55)
    pos = Vector((math.cos(a) * rr, 0.035, math.sin(a) * rr))
    ay = Vector((math.cos(a + random.uniform(-1, 1)), 0, math.sin(a + random.uniform(-1, 1)))).normalized()
    add_leaf(pos, Vector((0, 1, 0)), ay, random.uniform(0.16, 0.30), random.uniform(0.2, 0.7), Vector((0, 1, 0)))
for _ in range(16):  # hojas bajas pegadas al tronco (trepadora)
    a = random.uniform(0, math.tau)
    h = random.uniform(0.05, 1.05)
    rr = 0.34 - 0.10 * h + 0.06
    pos = Vector((math.cos(a) * rr, h, math.sin(a) * rr))
    out_n = Vector((math.cos(a), 0.25, math.sin(a))).normalized()
    ay = (Vector((0, 1, 0)) * 0.5 + out_n * 0.5 + Vector((random.gauss(0, 0.3), 0, random.gauss(0, 0.3)))).normalized()
    ay = (ay - out_n * ay.dot(out_n)).normalized()
    add_leaf(pos, out_n, ay, random.uniform(0.20, 0.34), random.uniform(0.25, 0.75), out_n)
litter_obj = build_object("Litter", lv, lf, None, leaf_mat, colors=lcol, custom_normals=lnorm, uv_per_vertex=luv)

# ── montículo de tierra bajo el árbol (estático, gris muy oscuro) ───────────
gverts, gfaces = [Vector((0, 0.10, 0))], []
R = 1.15
RINGS, SEG = 5, 28
for ri in range(1, RINGS + 1):
    rr = R * ri / RINGS
    hh = 0.10 * (1 - (ri / RINGS) ** 2)
    for s in range(SEG):
        a = s / SEG * math.tau
        gverts.append(Vector((math.cos(a) * rr * (1 + 0.07 * math.sin(a * 5)), hh, math.sin(a) * rr * (1 + 0.07 * math.cos(a * 4)))))
for s in range(SEG):
    gfaces.append((0, 1 + s, 1 + (s + 1) % SEG))
for ri in range(1, RINGS):
    for s in range(SEG):
        a = 1 + (ri - 1) * SEG + s
        b = 1 + (ri - 1) * SEG + (s + 1) % SEG
        cc = 1 + ri * SEG + (s + 1) % SEG
        d = 1 + ri * SEG + s
        gfaces.append((a, d, cc, b))
guvs = [(0.5 + gverts[i].x / (2 * R), 0.5 + gverts[i].z / (2 * R)) for f in gfaces for i in f]
ground_mat = bpy.data.materials.new("VT_TreeGround")
ground_mat.use_nodes = True
gb = ground_mat.node_tree.nodes["Principled BSDF"]
gb.inputs["Base Color"].default_value = (0.03, 0.03, 0.03, 1)
gb.inputs["Roughness"].default_value = 1.0
ground_obj = build_object("Ground", gverts, gfaces, guvs, ground_mat)

# ── agrupar bajo `Tree` ─────────────────────────────────────────────────────
root = bpy.data.objects.new("Tree", None)
scene.collection.objects.link(root)
all_objs = [bark_obj, litter_obj, ground_obj] + lobe_objs
for o in all_objs:
    o.parent = root
root.rotation_euler = (math.radians(90), 0, 0)  # el árbol se construye con Y arriba (como glTF): se compensa la conversión del exportador

tri_count = 0
for o in all_objs:
    for p in o.data.polygons:
        tri_count += len(p.vertices) - 2
print(f"[tree2] ramas={len(branches)} puntas={len(tips)} lobulos={len(lobe_objs)} hojas={total_leaf_count} tris≈{tri_count}")

# ── vista previa (para comparar con la referencia) ──────────────────────────
def render_preview(path, res=900):
    # EEVEE se cae en modo headless en esta máquina (sin contexto GPU): la vista previa va con Cycles en CPU, pocas muestras.
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 28
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 3
    scene.render.resolution_x = scene.render.resolution_y = res
    scene.render.film_transparent = False
    w = bpy.data.worlds.new("W")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
    scene.world = w
    # piso claro de prueba
    bpy.ops.mesh.primitive_plane_add(size=9, location=(0, 0, -0.01))
    plane = bpy.context.object
    pm = bpy.data.materials.new("P")
    pm.use_nodes = True
    pm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.92, 0.92, 0.92, 1)
    plane.data.materials.append(pm)
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 4.0
    sun.angle = math.radians(6)
    so = bpy.data.objects.new("Sun", sun)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    scene.collection.objects.link(so)
    cam = bpy.data.cameras.new("Cam")
    cam.type = "ORTHO"
    cam.ortho_scale = 9.4
    co = bpy.data.objects.new("Cam", cam)
    co.location = (9, -9, 9.0)
    co.rotation_euler = (math.radians(58), 0, math.radians(45))
    scene.collection.objects.link(co)
    scene.camera = co
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = path
    scene.render.image_settings.file_format = "PNG"
    try:
        bpy.ops.render.render(write_still=True)
        print("[tree2] preview:", path)
    except Exception as e:
        print("[tree2] preview falló:", e)


if os.environ.get("VT_NO_PREVIEW") != "1":
    render_preview(PREVIEW)
    # fuera lo que solo servía para la vista previa
    for ob in [o for o in bpy.data.objects if o.name in ("Cam", "Sun") or o.name.startswith("Plane")]:
        bpy.data.objects.remove(ob, do_unlink=True)

# ── exportar ────────────────────────────────────────────────────────────────
os.makedirs(OUT_DIR, exist_ok=True)
out_path = os.path.join(OUT_DIR, NAME + "_meshopt.glb")
kwargs = dict(
    filepath=out_path, export_format="GLB", use_selection=False, export_apply=True, export_texcoords=True, export_normals=True,
    export_vertex_color="ACTIVE", export_cameras=False, export_lights=False, export_yup=True, export_image_format="AUTO",
    export_meshopt_compression_enable=True,
)
try:
    bpy.ops.export_scene.gltf(**kwargs)
except TypeError as e:
    print("opciones no reconocidas, reintentando mínimas:", e)
    for k in ("export_vertex_color", "export_meshopt_compression_enable", "export_image_format"):
        kwargs.pop(k, None)
    bpy.ops.export_scene.gltf(**kwargs)


def patch_alpha_mask(path, material_name="VT_TreeLeaf", cutoff=0.5):
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
print("[tree2] exportado:", out_path, os.path.getsize(out_path) // 1024, "KB")
os.makedirs(PUBLIC, exist_ok=True)
shutil.copy(out_path, os.path.join(PUBLIC, NAME + "_meshopt.glb"))
