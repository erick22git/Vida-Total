import bpy, mathutils, math, random, json

DST = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\landscape_progression_prototype.blend"
bpy.ops.wm.open_mainfile(filepath=DST)
scene = bpy.context.scene
scene.render.fps = 24
report = {}

# ---------------------------------------------------------------- umbrales de progreso
# progreso (repeticiones) a partir del cual cada etapa aparece.
THRESHOLDS = [0, 1, 5, 10, 20, 30, 40, 50, 60]
WINDOW = 44          # frames entre el inicio de una etapa y la siguiente en la línea de tiempo de demo
def W(k):            # frame de inicio de la transición a la etapa k (k >= 1)
    return 1 + WINDOW * (k - 1)

# ---------------------------------------------------------------- materiales planos PBR (viajan a GLB)
def flat_mat(name, color, rough=0.7, metallic=0.0, emission=None):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (*color, 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    if emission:
        p.inputs["Emission Color"].default_value = (*emission, 1.0)
        p.inputs["Emission Strength"].default_value = 4.0
    nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
    return m

VARIANTS = {
    "Pine":  [(0.075, 0.30, 0.035), (0.06, 0.24, 0.03), (0.10, 0.34, 0.045), (0.085, 0.27, 0.05)],
    "Rock":  [(0.15, 0.15, 0.148), (0.13, 0.13, 0.13), (0.17, 0.165, 0.16), (0.11, 0.11, 0.11)],
    "Wood":  [(0.15, 0.075, 0.035), (0.12, 0.06, 0.03), (0.17, 0.09, 0.04)],
    "Grass": [(0.10, 0.32, 0.03), (0.13, 0.38, 0.04), (0.08, 0.27, 0.03)],
}
variant_mats = {k: [flat_mat(f"VT_{k}_{i}", c, rough=0.85 if k != "Rock" else 0.9) for i, c in enumerate(cols)] for k, cols in VARIANTS.items()}

def swap_variant(ob, base_names):
    """Sustituye materiales procedurales (ObjectInfo->ColorRamp) por una variante plana según el hash del nombre."""
    n = 0
    for slot in ob.material_slots:
        mat = slot.material
        if mat and mat.name in base_names:
            key = base_names[mat.name]
            variants = variant_mats[key]
            slot.material = variants[abs(hash(ob.name)) % len(variants)]
            n += 1
    return n

# suelo verde, orilla marrón, agua azul sin transmisión
gm = bpy.data.materials["Ground"]; gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.055, 0.22, 0.03, 1)
gm.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.92
gw = bpy.data.materials["Ground.W"]; gw.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.10, 0.125, 0.03, 1)
wm = bpy.data.materials["Water"]
wp = wm.node_tree.nodes["Principled BSDF"]
wp.inputs["Base Color"].default_value = (0.08, 0.42, 0.82, 1)
wp.inputs["Transmission Weight"].default_value = 0.0
wp.inputs["Roughness"].default_value = 0.12

BASE = {"Pine": "Pine", "Rock": "Rock", "Wood": "Wood", "Grass": "Grass"}
swapped = 0
for ob in bpy.data.objects:
    if ob.type == "MESH":
        swapped += swap_variant(ob, BASE)
report["material_slots_swapped"] = swapped

# ---------------------------------------------------------------- selección de objetos por etapa
def is_tile(ob):
    return ob.get("vt_role") != "template" and ob.matrix_world.translation.x > -8

tile_objs = [o for o in bpy.data.objects if o.type in ("MESH",) and is_tile(o)]
by_name = {o.name: o for o in tile_objs}

trees = []
for o in tile_objs:
    if o.name.startswith("Pine") and o.parent is None:
        trees.append(o)
tree_kids = {t.name: sorted(t.children_recursive, key=lambda c: c.matrix_world.translation.z) for t in trees}
tree_member_names = set(t.name for t in trees) | {c.name for kids in tree_kids.values() for c in kids}

stage_of = {}          # nombre -> etapa
anim_of = {}           # nombre -> tipo de animación
stage_of["Ground"] = 0; anim_of["Ground"] = "static"
for n in ("Plane", "Cube"):
    stage_of[n] = 1; anim_of[n] = "rise"
rocks = [n for n in by_name if n.startswith("rock.") and by_name[n].users_collection and by_name[n].users_collection[0].name != "GEN_pebbles"]
for n in rocks:
    stage_of[n] = 2; anim_of[n] = "drop"

grass = sorted([o.name for o in tile_objs if o.users_collection and o.users_collection[0].name == "GEN_grass"])
for i, n in enumerate(grass):
    stage_of[n] = 3 if i % 2 == 0 else 7
    anim_of[n] = "pop"
pine_stage = {"Pine3": 4, "Pine2": 5, "Pine1": 6}
for t in trees:
    st = pine_stage[t.name.split(".")[0]]
    stage_of[t.name] = st; anim_of[t.name] = "tree_trunk"
    t["vt_group"] = t.name
    for c in tree_kids[t.name]:
        stage_of[c.name] = st; anim_of[c.name] = "tree_layer"; c["vt_group"] = t.name
for o in tile_objs:
    if o.name.startswith("Mushroom") or o.name in ("Circle", "Circle.111"):
        stage_of[o.name] = 7; anim_of[o.name] = "pop"
    elif o.users_collection and o.users_collection[0].name in ("GEN_twigs", "GEN_pebbles"):
        stage_of[o.name] = 7; anim_of[o.name] = "drop_small"

# fuera de etapas (fuera del export): plantillas, fondo, caja de niebla
unassigned = [o.name for o in tile_objs if o.name not in stage_of]
report["unassigned_tile_meshes"] = unassigned[:20]

# ---------------------------------------------------------------- colecciones STAGES
def new_coll(name, parent):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if name not in [x.name for x in parent.children]:
        parent.children.link(c)
    return c
stages_root = new_coll("STAGES", scene.collection)
stage_colls = [new_coll(f"STAGE_{k}", stages_root) for k in range(9)]
tpl_coll = new_coll("_TEMPLATES_not_exported", scene.collection)
notexp = new_coll("_NOT_EXPORTED", scene.collection)

def relink(ob, coll):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)

for ob in bpy.data.objects:
    if ob.name in stage_of:
        k = stage_of[ob.name]
        relink(ob, stage_colls[k])
        ob["vt_stage"] = k
        ob["vt_anim"] = anim_of[ob.name]
        ob["vt_unlock_at"] = THRESHOLDS[k]
    elif ob.get("vt_role") == "template":
        relink(ob, tpl_coll)
    elif ob.name in ("Cube.001", "Plane.001"):
        relink(ob, notexp); ob["vt_role"] = "not_exported"
# El resto de vacíos de colecciones antiguas: se conservan (cámara/luces).

# ---------------------------------------------------------------- luciérnagas (etapa 8)
random.seed(7)
fire_mat = flat_mat("VT_Firefly", (1.0, 0.85, 0.35), rough=0.4, emission=(1.0, 0.8, 0.25))
fire_objs = []
for i in range(16):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.028, location=(random.uniform(-2.6, 2.6), random.uniform(-2.6, 2.6), random.uniform(0.5, 2.0)))
    f = bpy.context.active_object
    f.name = f"Firefly.{i:02d}"
    f.data.materials.append(fire_mat)
    relink(f, stage_colls[8])
    f["vt_stage"] = 8; f["vt_anim"] = "firefly"; f["vt_unlock_at"] = THRESHOLDS[8]
    stage_of[f.name] = 8; anim_of[f.name] = "firefly"
    fire_objs.append(f)

# ---------------------------------------------------------------- animación (una pista NLA por etapa)
def snapshot(ob):
    return {"loc": ob.location.copy(), "rot": ob.rotation_euler.copy(), "sc": ob.scale.copy()}

def key(ob, frame, loc=None, rot=None, sc=None):
    if loc is not None:
        ob.location = loc; ob.keyframe_insert("location", frame=frame)
    if rot is not None:
        ob.rotation_euler = rot; ob.keyframe_insert("rotation_euler", frame=frame)
    if sc is not None:
        ob.scale = sc; ob.keyframe_insert("scale", frame=frame)

def restore(ob, snap):
    ob.location = snap["loc"]; ob.rotation_euler = snap["rot"]; ob.scale = snap["sc"]

def vec(*a): return mathutils.Vector(a)
def mul(v, s): return mathutils.Vector((v[0] * s[0], v[1] * s[1], v[2] * s[2]))
def add(v, d): return mathutils.Vector((v[0] + d[0], v[1] + d[1], v[2] + d[2]))
def rot_add(e, d): return mathutils.Euler((e[0] + d[0], e[1] + d[1], e[2] + d[2]), e.order)

def push_to_nla(ob, stage):
    ad = ob.animation_data
    act = ad.action
    if act is None:
        return False
    act.name = f"{ob.name}__STAGE_{stage}"
    track = ad.nla_tracks.new()
    track.name = f"STAGE_{stage}"
    start = int(math.floor(act.frame_range[0]))
    strip = track.strips.new(act.name, start, act)
    strip.extrapolation = "HOLD"
    ad.action = None
    return True

def animate(ob, stage, t0, kind, extra=None):
    """t0 = frame de inicio absoluto de la animación de este objeto."""
    s = snapshot(ob)
    ob.animation_data_create()
    ob.animation_data.action = None
    z0 = s["loc"].z
    if kind == "rise":            # el agua sube y se expande
        key(ob, t0, loc=add(s["loc"], (0, 0, -0.35)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, -0.35)), sc=mul(s["sc"], (0.55, 0.55, 0.02)))
        key(ob, t0 + 16, loc=add(s["loc"], (0, 0, 0.03)), sc=mul(s["sc"], (1.04, 1.04, 1.05)))
        key(ob, t0 + 24, loc=s["loc"], sc=s["sc"])
    elif kind in ("drop", "drop_small"):   # cae, golpea, se asienta (squash & settle)
        h = 1.6 if kind == "drop" else 0.9
        key(ob, t0, loc=add(s["loc"], (0, 0, h)), rot=rot_add(s["rot"], (0.6, 0.4, 0.7)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, h)), rot=rot_add(s["rot"], (0.6, 0.4, 0.7)), sc=s["sc"])
        key(ob, t0 + 7, loc=add(s["loc"], (0, 0, -0.03)), rot=s["rot"], sc=mul(s["sc"], (1.14, 1.14, 0.8)))
        key(ob, t0 + 10, loc=s["loc"], rot=s["rot"], sc=mul(s["sc"], (0.97, 0.97, 1.05)))
        key(ob, t0 + 13, loc=s["loc"], rot=s["rot"], sc=s["sc"])
    elif kind == "pop":           # brota con rebote
        key(ob, t0, sc=(0, 0, 0))
        key(ob, t0 + 6, sc=mul(s["sc"], (1.25, 1.25, 1.25)))
        key(ob, t0 + 9, sc=mul(s["sc"], (0.94, 0.94, 0.94)))
        key(ob, t0 + 11, sc=s["sc"])
    elif kind == "tree_trunk":    # el tronco crece desde el suelo
        h = ob.dimensions.z
        key(ob, t0, loc=add(s["loc"], (0, 0, -h * 0.49)), sc=mul(s["sc"], (1, 1, 0.02)))
        key(ob, t0 + 5, loc=add(s["loc"], (0, 0, h * 0.04)), sc=mul(s["sc"], (1, 1, 1.08)))
        key(ob, t0 + 7, loc=s["loc"], sc=s["sc"])
    elif kind == "tree_layer":    # cada capa de copa cae, gira y encaja (de abajo hacia arriba)
        key(ob, t0, loc=add(s["loc"], (0, 0, 0.55)), rot=rot_add(s["rot"], (0, 0, -1.2)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, 0.55)), rot=rot_add(s["rot"], (0, 0, -1.2)), sc=mul(s["sc"], (0.4, 0.4, 0.4)))
        key(ob, t0 + 7, loc=add(s["loc"], (0, 0, -0.03)), rot=rot_add(s["rot"], (0, 0, 0.08)), sc=mul(s["sc"], (1.12, 1.12, 0.88)))
        key(ob, t0 + 10, loc=s["loc"], rot=s["rot"], sc=s["sc"])
    elif kind == "firefly":
        key(ob, t0, loc=add(s["loc"], (0, 0, -0.5)), sc=(0, 0, 0))
        key(ob, t0 + 14, loc=s["loc"], sc=mul(s["sc"], (1.5, 1.5, 1.5)))
        key(ob, t0 + 20, loc=add(s["loc"], (0, 0, 0.08)), sc=s["sc"])
    push_to_nla(ob, stage)
    restore(ob, s)

center = mathutils.Vector((0, 0, 0))
n_anim = 0
for ob in list(bpy.data.objects):
    if ob.name not in stage_of:
        continue
    k = stage_of[ob.name]
    kind = anim_of[ob.name]
    if kind == "static":
        continue
    t0 = W(k)
    d = 0
    if kind == "drop":
        d = (rocks.index(ob.name) if ob.name in rocks else 0) * 1.2
    elif kind == "drop_small" or kind == "pop":
        dist = (ob.matrix_world.translation.xy - center.xy).length
        d = min(dist / 4.3, 1.0) * 12
    elif kind == "tree_trunk":
        idx = sorted([t.name for t in trees if stage_of[t.name] == k]).index(ob.name)
        d = idx * 1.4
    elif kind == "tree_layer":
        grp = bpy.data.objects[ob.get("vt_group")]
        idx = sorted([t.name for t in trees if stage_of[t.name] == k]).index(grp.name)
        layer = tree_kids[grp.name].index(ob)
        d = idx * 1.4 + 5 + layer * 2.2
    elif kind == "firefly":
        d = fire_objs.index(ob) * 1.6
    ob["vt_delay_frames"] = round(d, 1)
    animate(ob, k, int(round(t0 + d)), kind)
    n_anim += 1
report["animated_objects"] = n_anim

# Luces "bajo el agua" (Area.002-.004): sin agua queman el lecho del río, así que entran con ella.
for nm in ("Area.002", "Area.003", "Area.004"):
    lo = bpy.data.objects.get(nm)
    if lo:
        e0 = lo.data.energy
        lo.data.energy = e0 * 0.03; lo.data.keyframe_insert("energy", frame=W(1) - 1)
        lo.data.energy = e0 * 0.03; lo.data.keyframe_insert("energy", frame=W(1) + 6)
        lo.data.energy = e0; lo.data.keyframe_insert("energy", frame=W(1) + 26)

# Milestone (etapa 8): pre-visualización de la luz cálida (en GLB la luz la pone el runtime).
for l in [o for o in bpy.data.objects if o.type == "LIGHT"]:
    d = l.data
    if d.animation_data and d.animation_data.action:
        continue  # las luces del río ya tienen su propia animación
    e0 = d.energy
    d.energy = e0; d.keyframe_insert("energy", frame=W(8) - 1)
    d.energy = e0 * 1.35; d.keyframe_insert("energy", frame=W(8) + 30)

cam = bpy.data.objects["MasterCamera"]
cam.data.lens = 88
scene.camera = cam
scene.frame_start = 0
scene.frame_end = W(8) + 70
counts = {}
for ob in bpy.data.objects:
    if "vt_stage" in ob.keys():
        counts[ob["vt_stage"]] = counts.get(ob["vt_stage"], 0) + 1
report["objects_per_stage"] = counts
report["thresholds"] = THRESHOLDS
report["windows"] = {k: W(k) for k in range(1, 9)}

# manifiesto
manifest = {"asset": "landscape_bosque_001", "thresholds": THRESHOLDS, "stages": {}}
for ob in bpy.data.objects:
    if "vt_stage" in ob.keys():
        manifest["stages"].setdefault(int(ob["vt_stage"]), []).append({"name": ob.name, "anim": ob["vt_anim"], "delay": ob.get("vt_delay_frames", 0)})
with open(r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\stage_manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False)

bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
