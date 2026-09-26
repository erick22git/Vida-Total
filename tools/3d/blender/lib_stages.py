# Librería compartida por los scripts de cada figura (se incluye con `# @include lib_stages.py`).
# NO se ejecuta sola. Define: materiales planos, cortes de mallas, generadores simples (losa, arbustos, pinos),
# reparto por etapas, animaciones de construcción (mismas recetas que el Bosque) y utilidades de render.
import bpy, bmesh, mathutils, math, random, hashlib, json
from mathutils import Vector, Euler, Matrix

TOTAL_STAGES = 7
WINDOW = 44


def W(k):
    """Fotograma de inicio de la construcción de la etapa k (1..7) en la línea de tiempo de demostración."""
    return 1 + WINDOW * (k - 1)


# ------------------------------------------------------------------ materiales
def flat_mat(name, color, rough=0.7, metallic=0.0, emission=None, alpha=1.0, emission_strength=3.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    p.inputs["Alpha"].default_value = alpha
    if emission:
        p.inputs["Emission Color"].default_value = (emission[0], emission[1], emission[2], 1.0)
        p.inputs["Emission Strength"].default_value = emission_strength
    nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    if alpha < 1.0:
        try:
            m.surface_render_method = "BLENDED"
        except Exception:
            pass
    return m


def image_average(img):
    """Color medio (lineal) de una imagen, sin tocar la original."""
    try:
        c = img.copy()
        c.scale(8, 8)
        px = list(c.pixels)
        bpy.data.images.remove(c)
        n = len(px) // 4
        return (sum(px[i * 4] for i in range(n)) / n, sum(px[i * 4 + 1] for i in range(n)) / n, sum(px[i * 4 + 2] for i in range(n)) / n)
    except Exception:
        return None


def original_look(mat):
    """(color, rugosidad, metálico, emisión|None, alpha) que mejor resume un material original."""
    color, rough, metal, emis, alpha = (0.5, 0.5, 0.5), 0.7, 0.0, None, 1.0
    if mat is None:
        return color, rough, metal, emis, alpha
    color = tuple(mat.diffuse_color[:3])
    if mat.use_nodes and mat.node_tree:
        for n in mat.node_tree.nodes:
            if n.bl_idname == "ShaderNodeBsdfPrincipled":
                inp = n.inputs["Base Color"]
                if inp.is_linked:
                    src = inp.links[0].from_node
                    avg = image_average(src.image) if getattr(src, "image", None) else None
                    if avg:
                        color = avg
                    else:
                        color = tuple(inp.default_value[:3])
                else:
                    color = tuple(inp.default_value[:3])
                rough = n.inputs["Roughness"].default_value
                metal = n.inputs["Metallic"].default_value
                alpha = n.inputs["Alpha"].default_value
                es = n.inputs["Emission Strength"].default_value if "Emission Strength" in n.inputs else 0
                if es > 0:
                    ec = n.inputs["Emission Color"]
                    if not ec.is_linked and sum(ec.default_value[:3]) > 0.05:
                        emis = tuple(ec.default_value[:3])
                    elif ec.is_linked and getattr(ec.links[0].from_node, "image", None):
                        emis = image_average(ec.links[0].from_node.image)   # pantallas: brillo del color medio
                break
            if n.bl_idname == "ShaderNodeBsdfDiffuse":
                color = tuple(n.inputs["Color"].default_value[:3])
            if n.bl_idname == "ShaderNodeEmission":
                emis = tuple(n.inputs["Color"].default_value[:3])
                color = emis
    return color, rough, metal, emis, alpha


def tint(color, sat=1.0, val=1.0, lift=0.0):
    c = mathutils.Color(color)
    c.s = min(max(c.s * sat, 0.0), 1.0)
    c.v = min(max(c.v * val + lift, 0.0), 1.0)
    return (c.r, c.g, c.b)


def dedupe_materials(objs, step=0.035):
    """Une materiales planos casi idénticos (mismo color redondeado, rugosidad, metal, emisión, alpha) en uno solo:
    menos materiales = menos draw calls."""
    canon = {}
    merged = 0
    for ob in objs:
        if ob.type != "MESH":
            continue
        for slot in ob.material_slots:
            m = slot.material
            if not m or not m.use_nodes:
                continue
            p = next((n for n in m.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled"), None)
            if p is None:
                continue
            c = p.inputs["Base Color"].default_value
            e = p.inputs["Emission Strength"].default_value
            ec = p.inputs["Emission Color"].default_value
            key = (round(c[0] / step), round(c[1] / step), round(c[2] / step), round(p.inputs["Roughness"].default_value * 5), round(p.inputs["Metallic"].default_value * 4), round(p.inputs["Alpha"].default_value * 4),
                   round(e), round(ec[0] / step) if e > 0 else 0, round(ec[1] / step) if e > 0 else 0)
            if key not in canon:
                canon[key] = m
            elif canon[key] is not m:
                slot.material = canon[key]
                merged += 1
    return merged


def flatten_materials(objs, overrides=None, sat=0.85, val=1.0, prefix="VT_", merge=True):
    """Sustituye TODOS los materiales de `objs` por PBR plano derivado del original.
    `overrides`: {nombre_material_original: dict(color=, rough=, metallic=, emission=, alpha=)}."""
    overrides = overrides or {}
    cache = {}
    n = 0
    for ob in objs:
        if ob.type != "MESH":
            continue
        for slot in ob.material_slots:
            src = slot.material
            if slot.link != "DATA":
                src = slot.material or (ob.data.materials[slot.slot_index] if slot.slot_index < len(ob.data.materials) else None)
                slot.link = "DATA"
            key = src.name if src else "_none"
            if key not in cache:
                ov = overrides.get(key)
                if ov:
                    m = flat_mat(prefix + key, ov["color"], ov.get("rough", 0.7), ov.get("metallic", 0.0), ov.get("emission"), ov.get("alpha", 1.0), ov.get("emission_strength", 3.0))
                else:
                    c, r, mt, em, al = original_look(src)
                    m = flat_mat(prefix + key, tint(c, sat, val), max(r, 0.35), mt, em, al)
                cache[key] = m
            slot.material = cache[key]
            n += 1
    if merge:
        dedupe_materials(objs)
    return n


# ------------------------------------------------------------------ geometría
def _mw(o):
    # Sin padre, matrix_basis es la transformación real aunque el objeto sea nuevo (matrix_world se actualiza tarde).
    return o.matrix_basis if o.parent is None else o.matrix_world


def bbox_world(o):
    mw = _mw(o)
    pts = [mw @ Vector(c) for c in o.bound_box]
    return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))


def relink(ob, coll):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)


def new_coll(name, parent):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if name not in [x.name for x in parent.children]:
        parent.children.link(c)
    return c


def _new_object_from_bm(bm, name, src_obj):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    for m in src_obj.data.materials:
        me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    o.matrix_world = src_obj.matrix_world
    for c in src_obj.users_collection:
        c.objects.link(o)
    return o


def split_by_axis(obj, axis, cuts, base_name=None):
    """Parte una malla en bandas según el centro de cada cara (coordenada mundial en `axis`: 0=x,1=y,2=z).
    Devuelve una lista (una entrada por banda, None si quedó vacía). Elimina el objeto original."""
    base_name = base_name or obj.name
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    mw = obj.matrix_world
    bands = [[] for _ in range(len(cuts) + 1)]
    for f in bm.faces:
        c = (mw @ f.calc_center_median())[axis]
        b = sum(1 for cut in cuts if c >= cut)
        bands[b].append(f.index)
    out = []
    for i, idxs in enumerate(bands):
        if not idxs:
            out.append(None)
            continue
        bm2 = bm.copy()
        bm2.faces.ensure_lookup_table()
        keep = set(idxs)
        bmesh.ops.delete(bm2, geom=[f for f in bm2.faces if f.index not in keep], context="FACES")
        bmesh.ops.delete(bm2, geom=[v for v in bm2.verts if not v.link_faces], context="VERTS")
        out.append(_new_object_from_bm(bm2, f"{base_name}_b{i}", obj))
        bm2.free()
    bm.free()
    bpy.data.objects.remove(obj, do_unlink=True)
    return out


def split_islands(obj, base_name=None):
    """Una malla nueva por cada isla de caras conectadas. Elimina el original."""
    base_name = base_name or obj.name
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    seen, islands = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, comp = [f], []
        seen.add(f.index)
        while stack:
            cur = stack.pop()
            comp.append(cur.index)
            for e in cur.edges:
                for lf in e.link_faces:
                    if lf.index not in seen:
                        seen.add(lf.index)
                        stack.append(lf)
        islands.append(comp)
    out = []
    for i, idxs in enumerate(islands):
        bm2 = bm.copy()
        bm2.faces.ensure_lookup_table()
        keep = set(idxs)
        bmesh.ops.delete(bm2, geom=[f for f in bm2.faces if f.index not in keep], context="FACES")
        bmesh.ops.delete(bm2, geom=[v for v in bm2.verts if not v.link_faces], context="VERTS")
        out.append(_new_object_from_bm(bm2, f"{base_name}_i{i:03d}", obj))
        bm2.free()
    bm.free()
    bpy.data.objects.remove(obj, do_unlink=True)
    return out


def join_objects(objs, name):
    """Une varios objetos en uno (varios materiales → varias ranuras). Devuelve el objeto resultante."""
    objs = [o for o in objs if o and o.type == "MESH"]
    if not objs:
        return None
    if len(objs) == 1:
        objs[0].name = name
        return objs[0]
    bpy.context.view_layer.update()  # los objetos recién creados no están en el view layer hasta actualizar
    for o in list(bpy.context.view_layer.objects):
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    res = bpy.context.view_layer.objects.active
    res.name = name
    return res


def apply_modifiers(ob):
    """Hornea los modificadores de un objeto en su malla."""
    if not ob.modifiers:
        return
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)


def make_slab(name, size_x, size_y, thickness, top_mat, side_mat, top_z=0.0, bevel=0.06, center=(0.0, 0.0)):
    """Losa base de diorama (geometría propia): caja con bisel; cara superior con `top_mat`, resto `side_mat`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size_x
        v.co.y *= size_y
        v.co.z = (v.co.z + 0.5) * thickness + top_z - thickness  # la cara superior queda en top_z
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES")
    me = bpy.data.meshes.new(name)
    me.materials.append(top_mat)
    me.materials.append(side_mat)
    for f in bm.faces:
        f.material_index = 0 if f.normal.z > 0.9 else 1
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = (center[0], center[1], 0)
    bpy.context.scene.collection.objects.link(o)
    return o


def make_bush(name, loc, radius, mat, squash=0.75, seed=0):
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=radius)
    for v in bm.verts:
        v.co.z *= squash
        v.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * radius * 0.12
        v.co.z = max(v.co.z, -radius * 0.1)
    me = bpy.data.meshes.new(name)
    me.materials.append(mat)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(name, me)
    o.location = (loc[0], loc[1], loc[2] + radius * squash * 0.55)
    bpy.context.scene.collection.objects.link(o)
    return o


def make_pine(name, loc, height, leaf_mat, trunk_mat, layers=4, seed=0):
    """Pino low-poly propio: tronco + `layers` conos apilados, todo en un solo objeto (2 materiales)."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    trunk_h = height * 0.22
    r0 = height * 0.30
    geo = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=height * 0.05, radius2=height * 0.04, depth=trunk_h)
    for v in geo["verts"]:
        v.co.z += trunk_h / 2
    trunk_faces = {f for v in geo["verts"] for f in v.link_faces}
    for f in trunk_faces:
        f.material_index = 1
    z = trunk_h * 0.8
    for i in range(layers):
        k = 1 - i / layers
        r = r0 * (0.35 + 0.65 * k)
        h = height * 0.34 * (0.8 + 0.2 * k)
        g = bmesh.ops.create_cone(bm, cap_ends=True, segments=7, radius1=r, radius2=r * 0.05, depth=h)
        for v in g["verts"]:
            v.co.z += z + h / 2
            v.co.x += rnd.uniform(-0.01, 0.01) * height
        z += h * 0.58
        for f in {f for v in g["verts"] for f in v.link_faces}:
            f.material_index = 0
    me = bpy.data.meshes.new(name)
    me.materials.append(leaf_mat)
    me.materials.append(trunk_mat)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.rotation_euler.z = rnd.uniform(0, 6.28)
    bpy.context.scene.collection.objects.link(o)
    return o


def make_box(name, center, size, mat):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    me = bpy.data.meshes.new(name)
    me.materials.append(mat)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = (center[0], center[1], center[2] + size[2] / 2)
    bpy.context.scene.collection.objects.link(o)
    return o


def make_cylinder(name, center, radius, height, mat, segments=10):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=height)
    me = bpy.data.meshes.new(name)
    me.materials.append(mat)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = (center[0], center[1], center[2] + height / 2)
    bpy.context.scene.collection.objects.link(o)
    return o


def set_origin(ob, where="center"):
    """Mueve el ORIGEN del objeto al centro de su caja (o al centro de su base) sin mover la geometría.
    Necesario para que escalar/girar una pieza no la lance desde un origen lejano. Sin padre."""
    if ob.type != "MESH" or ob.parent:
        return
    mn, mx = bbox_world(ob)
    c = (mn + mx) / 2
    if where == "bottom":
        c.z = mn.z
    d_local = _mw(ob).inverted() @ c
    ob.data.transform(Matrix.Translation(-d_local))
    ob.location = c


# ------------------------------------------------------------------ reparto por etapas
class Stager:
    """Reparte objetos en las 7 etapas y calcula retardos escalonados de abajo hacia arriba."""

    def __init__(self, scene):
        self.scene = scene
        self.root = new_coll("STAGES", scene.collection)
        self.colls = {k: new_coll(f"STAGE_{k}", self.root) for k in range(1, TOTAL_STAGES + 1)}
        self.notexp = new_coll("_NOT_EXPORTED", scene.collection)
        self.items = {}  # nombre -> (stage, anim)

    def place(self, ob, stage, anim):
        if ob is None:
            return
        if ob.type == "MESH" and anim != "static":
            set_origin(ob, "bottom" if anim == "grow" else "center")
        relink(ob, self.colls[stage])
        ob["vt_stage"] = stage
        ob["vt_anim"] = anim
        self.items[ob.name] = (stage, anim)

    def discard(self, ob):
        if ob is None:
            return
        relink(ob, self.notexp)
        ob["vt_role"] = "not_exported"
        ob.hide_render = True
        ob.hide_viewport = True

    def objects_of(self, stage):
        return [bpy.data.objects[n] for n, (s, _) in self.items.items() if s == stage and n in bpy.data.objects]


# ------------------------------------------------------------------ animación (mismas recetas que el Bosque)
def snapshot(ob):
    return {"loc": ob.location.copy(), "rot": ob.rotation_euler.copy(), "sc": ob.scale.copy()}


def key(ob, frame, loc=None, rot=None, sc=None):
    if loc is not None:
        ob.location = loc
        ob.keyframe_insert("location", frame=frame)
    if rot is not None:
        ob.rotation_euler = rot
        ob.keyframe_insert("rotation_euler", frame=frame)
    if sc is not None:
        ob.scale = sc
        ob.keyframe_insert("scale", frame=frame)


def restore(ob, s):
    ob.location = s["loc"]
    ob.rotation_euler = s["rot"]
    ob.scale = s["sc"]


def mul(v, s):
    return Vector((v[0] * s[0], v[1] * s[1], v[2] * s[2]))


def add(v, d):
    return Vector((v[0] + d[0], v[1] + d[1], v[2] + d[2]))


def rot_add(e, d):
    return Euler((e[0] + d[0], e[1] + d[1], e[2] + d[2]), e.order)


def push_to_nla(ob, stage, extrap="HOLD"):
    ad = ob.animation_data
    act = ad.action
    if act is None:
        return
    act.name = f"{ob.name}__STAGE_{stage}"
    track = ad.nla_tracks.new()
    track.name = f"STAGE_{stage}"
    strip = track.strips.new(act.name, int(math.floor(act.frame_range[0])), act)
    strip.extrapolation = extrap
    ad.action = None


def animate(ob, stage, t0, kind, extrap="HOLD"):
    """Keyframes de construcción de `ob` a partir del fotograma t0. La pose final es la que tenía el objeto."""
    s = snapshot(ob)
    ob.animation_data_create()
    ob.animation_data.action = None
    mn, mx = bbox_world(ob)
    height = max(mx.z - mn.z, 0.01)
    bottom_off = mn.z - _mw(ob).translation.z  # distancia (mundial) de la base al origen
    if kind == "static":
        return
    if kind == "rise":          # sube y se expande (agua, suelo)
        key(ob, t0, loc=add(s["loc"], (0, 0, -0.35)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, -0.35)), sc=mul(s["sc"], (0.55, 0.55, 0.02)))
        key(ob, t0 + 16, loc=add(s["loc"], (0, 0, 0.03)), sc=mul(s["sc"], (1.04, 1.04, 1.05)))
        key(ob, t0 + 24, loc=s["loc"], sc=s["sc"])
    elif kind == "terrain":     # la base emerge girando y se asienta
        key(ob, t0, loc=add(s["loc"], (0, 0, -0.7)), rot=rot_add(s["rot"], (0, 0, -0.6)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, -0.7)), rot=rot_add(s["rot"], (0, 0, -0.6)), sc=mul(s["sc"], (0.35, 0.35, 0.02)))
        key(ob, t0 + 12, loc=add(s["loc"], (0, 0, 0.06)), rot=rot_add(s["rot"], (0, 0, 0.05)), sc=mul(s["sc"], (1.04, 1.04, 1.06)))
        key(ob, t0 + 18, loc=add(s["loc"], (0, 0, -0.012)), rot=rot_add(s["rot"], (0, 0, -0.01)), sc=mul(s["sc"], (0.995, 0.995, 0.98)))
        key(ob, t0 + 24, loc=s["loc"], rot=s["rot"], sc=s["sc"])
    elif kind == "grow":        # crece desde su base (muros, torres, cuerpos)
        def z_fix(k):  # mantiene la base fija al escalar en z
            return add(s["loc"], (0, 0, (1 - k) * bottom_off))
        key(ob, t0, loc=z_fix(0.0), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=z_fix(0.02), sc=mul(s["sc"], (0.96, 0.96, 0.02)))
        key(ob, t0 + 10, loc=z_fix(1.07), sc=mul(s["sc"], (1.0, 1.0, 1.07)))
        key(ob, t0 + 14, loc=z_fix(0.98), sc=mul(s["sc"], (1.0, 1.0, 0.98)))
        key(ob, t0 + 17, loc=s["loc"], sc=s["sc"])
    elif kind in ("drop", "drop_small"):
        h = 1.4 if kind == "drop" else 0.8
        key(ob, t0, loc=add(s["loc"], (0, 0, h)), rot=rot_add(s["rot"], (0.6, 0.4, 0.7)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, h)), rot=rot_add(s["rot"], (0.6, 0.4, 0.7)), sc=s["sc"])
        key(ob, t0 + 7, loc=add(s["loc"], (0, 0, -0.03)), rot=s["rot"], sc=mul(s["sc"], (1.12, 1.12, 0.82)))
        key(ob, t0 + 10, loc=s["loc"], rot=s["rot"], sc=mul(s["sc"], (0.97, 0.97, 1.04)))
        key(ob, t0 + 13, loc=s["loc"], rot=s["rot"], sc=s["sc"])
    elif kind == "spin_in":     # cae girando y encaja (techos, aspas, piezas grandes)
        key(ob, t0, loc=add(s["loc"], (0, 0, 0.9)), rot=rot_add(s["rot"], (0, 0, -1.2)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, 0.9)), rot=rot_add(s["rot"], (0, 0, -1.2)), sc=mul(s["sc"], (0.4, 0.4, 0.4)))
        key(ob, t0 + 9, loc=add(s["loc"], (0, 0, -0.05)), rot=rot_add(s["rot"], (0, 0, 0.08)), sc=mul(s["sc"], (1.1, 1.1, 0.92)))
        key(ob, t0 + 13, loc=s["loc"], rot=s["rot"], sc=s["sc"])
    elif kind == "slide":       # entra deslizando desde un lado con overshoot (puertas, muebles grandes)
        d = Vector((0.9, 0, 0))
        key(ob, t0, loc=add(s["loc"], d), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], d), sc=mul(s["sc"], (0.5, 0.5, 0.5)))
        key(ob, t0 + 9, loc=add(s["loc"], -0.06 * d), sc=mul(s["sc"], (1.05, 1.05, 1.05)))
        key(ob, t0 + 13, loc=s["loc"], sc=s["sc"])
    elif kind == "pop":
        key(ob, t0, sc=(0, 0, 0))
        key(ob, t0 + 6, sc=mul(s["sc"], (1.25, 1.25, 1.25)))
        key(ob, t0 + 9, sc=mul(s["sc"], (0.94, 0.94, 0.94)))
        key(ob, t0 + 11, sc=s["sc"])
    elif kind == "blades":      # las aspas giran hasta su lugar
        key(ob, t0, rot=rot_add(s["rot"], (-2.4, 0, 0)), sc=(0, 0, 0))
        key(ob, t0 + 1, rot=rot_add(s["rot"], (-2.4, 0, 0)), sc=mul(s["sc"], (0.3, 0.3, 0.3)))
        key(ob, t0 + 12, rot=rot_add(s["rot"], (0.18, 0, 0)), sc=mul(s["sc"], (1.06, 1.06, 1.06)))
        key(ob, t0 + 17, rot=s["rot"], sc=s["sc"])
    elif kind == "glow":        # se enciende (lámparas / luciérnagas)
        key(ob, t0, loc=add(s["loc"], (0, 0, -0.3)), sc=(0, 0, 0))
        key(ob, t0 + 14, loc=s["loc"], sc=mul(s["sc"], (1.5, 1.5, 1.5)))
        key(ob, t0 + 20, loc=add(s["loc"], (0, 0, 0.05)), sc=s["sc"])
    push_to_nla(ob, stage, extrap)
    restore(ob, s)


def schedule(stager, center=None, step_cap=1.4, max_span=16.0, order="bottom_up"):
    """Retardos escalonados por etapa: abajo→arriba (y de cerca a lejos del centro). Devuelve # de objetos animados."""
    n = 0
    center = center or Vector((0, 0, 0))
    for stage in range(1, TOTAL_STAGES + 1):
        objs = stager.objects_of(stage)
        if not objs:
            continue
        def sort_key(o):
            mn, mx = bbox_world(o)
            return (round(mn.z, 1), (_mw(o).translation.xy - center.xy).length)
        objs.sort(key=sort_key)
        step = min(step_cap, max_span / max(len(objs), 1))
        for i, o in enumerate(objs):
            kind = stager.items[o.name][1]
            if kind in ("static",):
                continue
            d = i * step
            o["vt_delay_frames"] = round(d, 1)
            animate(o, stage, int(round(W(stage) + d)), kind)
            n += 1
    return n


# ------------------------------------------------------------------ escena / render
def setup_transparent_scene(scene, target, direction, lens=95.0, exposure=-0.2, res=1000):
    """Fondo transparente, cámara mirando a `target` desde `direction` (Blender, Z arriba)."""
    for name in ("Camera",):
        pass
    cam_obj = None
    for o in bpy.data.objects:
        if o.type == "CAMERA":
            cam_obj = o
            break
    if cam_obj is None:
        cd = bpy.data.cameras.new("Cam")
        cam_obj = bpy.data.objects.new("Cam", cd)
        scene.collection.objects.link(cam_obj)
    d = Vector(direction).normalized()
    cam_obj.location = Vector(target) + d * 40.0
    cam_obj.rotation_euler = (Vector(target) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    cam_obj.data.lens = lens
    cam_obj.data.clip_end = 500
    scene.camera = cam_obj
    scene.render.film_transparent = True
    # Algunos archivos traen compositor/secuenciador propios (fondos negros): se apagan para la vista previa.
    for attr, val in (("use_nodes", False), ("compositing_node_group", None)):
        try:
            setattr(scene, attr, val)
        except Exception:
            pass
    try:
        scene.render.use_compositing = False
        scene.render.use_sequencer = False
    except Exception:
        pass
    for vl in scene.view_layers:
        vl.material_override = None            # (p. ej. el BMW trae un override tipo arcilla)
        vl.use_pass_combined = True
    scene.view_settings.view_transform = "Standard"

    try:
        scene.render.image_settings.media_type = "IMAGE"
    except Exception:
        pass
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_x = res
    scene.render.resolution_y = res
    scene.view_settings.exposure = exposure
    return cam_obj


def fit_camera(scene, cam_obj, objs, margin=1.12):
    """Ajusta la cámara (misma dirección) para que el estado FINAL de `objs` ocupe ~90% del cuadro cuadrado."""
    pts = []
    for o in objs:
        mn, mx = bbox_world(o)
        for x in (mn.x, mx.x):
            for y in (mn.y, mx.y):
                for z in (mn.z, mx.z):
                    pts.append(Vector((x, y, z)))
    center = sum(pts, Vector()) / len(pts)
    radius = max((p - center).length for p in pts)
    d = cam_obj.rotation_euler.to_quaternion() @ Vector((0, 0, 1))  # de la escena hacia la cámara
    dist = radius * 4.0
    cam_obj.location = center + d * dist
    cam_obj.rotation_euler = (center - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
    cam_obj.data.sensor_width = 36.0
    fov = 2 * math.atan(radius * margin / dist)
    cam_obj.data.lens = 18.0 / math.tan(fov / 2)
    return center, radius


def write_manifest(path, asset_id, day_names, stager):
    manifest = {"asset": asset_id, "totalStages": TOTAL_STAGES, "dayNames": day_names, "stages": {}}
    for ob in bpy.data.objects:
        if "vt_stage" in ob.keys():
            manifest["stages"].setdefault(int(ob["vt_stage"]), []).append({"name": ob.name, "anim": ob["vt_anim"], "delay": ob.get("vt_delay_frames", 0)})
    with open(path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False)
    return {k: len(v) for k, v in sorted(manifest["stages"].items())}


def dissolve_flat(ob, angle=0.02):
    """Fusiona caras coplanares (p. ej. un plano de agua con miles de polígonos → unos pocos)."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.dissolve_limit(bm, angle_limit=angle, verts=list(bm.verts), edges=list(bm.edges))
    bm.to_mesh(ob.data)
    bm.free()


def preview_lighting(scene, sun_energy=3.2, world_color=(0.42, 0.44, 0.48), world_strength=0.9, direction=(-0.5, -0.6, 0.65)):
    """Luz SOLO para las vistas previas de Blender (no se exporta): un sol suave y un ambiente neutro."""
    for o in list(bpy.data.objects):
        if o.type == "LIGHT":
            o.hide_render = True
    ld = bpy.data.lights.new("PreviewSun", "SUN")
    ld.energy = sun_energy
    ld.angle = 0.35
    lo = bpy.data.objects.new("PreviewSun", ld)
    scene.collection.objects.link(lo)
    lo.rotation_euler = (-Vector(direction)).to_track_quat("-Z", "Y").to_euler()
    w = scene.world or bpy.data.worlds.new("PreviewWorld")
    scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    if bg is None:
        bg = w.node_tree.nodes.new("ShaderNodeBackground")
    for l in list(w.node_tree.links):
        w.node_tree.links.remove(l)
    out = [n for n in w.node_tree.nodes if n.bl_idname == "ShaderNodeOutputWorld"]
    out = out[0] if out else w.node_tree.nodes.new("ShaderNodeOutputWorld")
    bg.inputs["Color"].default_value = (world_color[0], world_color[1], world_color[2], 1.0)
    bg.inputs["Strength"].default_value = world_strength
    w.node_tree.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return lo


def split_by_material(obj, base_name=None):
    """Una malla por cada ranura de material (p. ej. suelo vs paredes). Devuelve {índice_de_material: objeto}. Elimina el original."""
    base_name = base_name or obj.name
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    out = {}
    for mi in sorted({f.material_index for f in bm.faces}):
        bm2 = bm.copy()
        bm2.faces.ensure_lookup_table()
        bmesh.ops.delete(bm2, geom=[f for f in bm2.faces if f.material_index != mi], context="FACES")
        bmesh.ops.delete(bm2, geom=[v for v in bm2.verts if not v.link_faces], context="VERTS")
        out[mi] = _new_object_from_bm(bm2, f"{base_name}_m{mi}", obj)
        bm2.free()
    bm.free()
    bpy.data.objects.remove(obj, do_unlink=True)
    return out


def cluster_join(objs, cell, prefix):
    """Une objetos vecinos (celdas de `cell` metros en XY) para bajar draw calls. Devuelve la lista de objetos resultantes."""
    cells = {}
    for o in objs:
        mn, mx = bbox_world(o)
        c = (mn + mx) / 2
        cells.setdefault((int(c.x // cell), int(c.y // cell)), []).append(o)
    out = []
    for i, (k, group) in enumerate(sorted(cells.items())):
        j = join_objects(group, f"{prefix}_{i:02d}")
        if j:
            out.append(j)
    return out


def include_everything():
    """Colecciones excluidas/ocultas del original: se activan para poder trabajar con todo (join/select exigen view layer)."""
    def walk(lc):
        lc.exclude = False
        lc.hide_viewport = False
        for ch in lc.children:
            walk(ch)
    walk(bpy.context.view_layer.layer_collection)
    # objetos que existen en el archivo pero no están enlazados a la escena (colecciones sueltas): se enlazan
    for o in bpy.data.objects:
        if o.name not in bpy.context.scene.objects:
            bpy.context.scene.collection.objects.link(o)
    for o in bpy.data.objects:
        o.hide_viewport = False
        o.hide_render = False
        try:
            o.hide_set(False)
        except Exception:
            pass
