"""Bosque de 7 días: reparte las piezas en 7 etapas (una por día), anima cada construcción y deja el
archivo listo para exportar como figura aislada (sin fondo, sin luces, sin cámara).

Ejecutar SIEMPRE después de 01_prepare_landscape.py (parte del archivo que ese guarda).
"""
import bpy, mathutils, math, random, json, hashlib

DST = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\landscape_progression_prototype.blend"
MANIFEST = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\forest_7day.manifest.json"
bpy.ops.wm.open_mainfile(filepath=DST)
scene = bpy.context.scene
scene.render.fps = 24
report = {}

TOTAL_STAGES = 7
DAY_NAMES = ["terreno", "agua", "rocas", "pasto", "primeros árboles", "más árboles y detalles", "escena completa"]
WINDOW = 44
def W(k):  # frame de inicio de la construcción del día k (1..7) en la línea de tiempo de demostración
    return 1 + WINDOW * (k - 1)

# ------------------------------------------------------------------ materiales limpios (PBR plano, paleta contenida)
def flat_mat(name, color, rough=0.7, metallic=0.0, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
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
    "Pine":  [(0.060, 0.205, 0.075), (0.050, 0.175, 0.065), (0.078, 0.235, 0.085), (0.066, 0.195, 0.095)],
    "Rock":  [(0.24, 0.235, 0.228), (0.20, 0.198, 0.195), (0.27, 0.262, 0.25), (0.17, 0.168, 0.165)],
    "Wood":  [(0.155, 0.088, 0.052), (0.13, 0.072, 0.042), (0.175, 0.10, 0.058)],
    "Grass": [(0.115, 0.285, 0.070), (0.145, 0.320, 0.078), (0.095, 0.245, 0.068)],
}
variant_mats = {k: [flat_mat(f"VT_{k}_{i}", c, rough=0.9 if k in ("Rock", "Wood") else 0.85) for i, c in enumerate(cols)] for k, cols in VARIANTS.items()}
BASE = {"Pine": "Pine", "Rock": "Rock", "Wood": "Wood", "Grass": "Grass"}
swapped = 0
for ob in bpy.data.objects:
    if ob.type == "MESH":
        for slot in ob.material_slots:
            if slot.material and slot.material.name in BASE:
                vs = variant_mats[BASE[slot.material.name]]
                slot.material = vs[int(hashlib.md5(ob.name.encode()).hexdigest(), 16) % len(vs)]
                swapped += 1
report["material_slots_swapped"] = swapped

def set_bsdf(mat_name, **kw):
    n = bpy.data.materials[mat_name].node_tree.nodes["Principled BSDF"]
    for k, v in kw.items():
        n.inputs[k].default_value = v
set_bsdf("Ground", **{"Base Color": (0.100, 0.225, 0.070, 1), "Roughness": 0.95})
set_bsdf("Ground.W", **{"Base Color": (0.125, 0.195, 0.072, 1), "Roughness": 0.95})
set_bsdf("Ground2", **{"Base Color": (0.095, 0.062, 0.045, 1), "Roughness": 0.9})
set_bsdf("Ground.V", **{"Base Color": (0.100, 0.088, 0.056, 1), "Roughness": 0.95})
set_bsdf("Water", **{"Base Color": (0.085, 0.36, 0.53, 1), "Transmission Weight": 0.0, "Roughness": 0.14})

# ------------------------------------------------------------------ clasificación
def is_tile(ob):
    return ob.get("vt_role") != "template" and ob.matrix_world.translation.x > -8

tile_objs = [o for o in bpy.data.objects if o.type == "MESH" and is_tile(o)]
by_name = {o.name: o for o in tile_objs}
trees = sorted([o for o in tile_objs if o.name.startswith("Pine") and o.parent is None], key=lambda o: o.name)
tree_kids = {t.name: sorted(t.children_recursive, key=lambda c: c.matrix_world.translation.z) for t in trees}

# ------------------------------------------------------------------ reutilizar mallas idénticas (menos memoria y menos draw calls)
def mhash(me):
    h = hashlib.md5()
    for v in me.vertices:
        h.update(("%.4f,%.4f,%.4f;" % tuple(v.co)).encode())
    return h.hexdigest()

def dedupe(objs):
    masters = {}
    shared = 0
    for o in objs:
        mods = tuple((m.type, round(getattr(m, "thickness", 0.0), 4)) for m in o.modifiers)
        key = (mhash(o.data), mods)
        if key not in masters:
            o.data = o.data.copy()               # malla propia para poder hornear los modificadores
            for m in list(o.modifiers):          # se hornean los modificadores en la malla maestra
                with bpy.context.temp_override(object=o, active_object=o):
                    bpy.ops.object.modifier_apply(modifier=m.name)
            masters[key] = o
        else:
            for m in list(o.modifiers):
                o.modifiers.remove(m)
            o.data = masters[key].data
            shared += 1
    return len(masters), shared

cones = [c for kids in tree_kids.values() for c in kids]
report["dedupe_cones"] = dedupe(cones)
report["dedupe_trunks"] = dedupe(trees)

# ------------------------------------------------------------------ reparto por día
stage_of, anim_of = {}, {}
def put(name, stage, anim):
    stage_of[name] = stage; anim_of[name] = anim

put("Ground", 1, "terrain")
for n in ("Plane", "Cube"):
    put(n, 2, "rise")
rocks = sorted(n for n in by_name if n.startswith("rock.") and by_name[n].users_collection and by_name[n].users_collection[0].name != "GEN_pebbles")
for n in rocks:
    put(n, 3, "drop")
pebbles = sorted(o.name for o in tile_objs if o.users_collection and o.users_collection[0].name == "GEN_pebbles")
for n in pebbles:
    put(n, 3, "drop_small")

grass = sorted(o.name for o in tile_objs if o.users_collection and o.users_collection[0].name == "GEN_grass")
rng = random.Random(11)
order = grass[:]
rng.shuffle(order)
n_g = len(order)
first_patch, main_patch = int(n_g * 0.08), int(n_g * 0.70)
for i, n in enumerate(order):
    if i < first_patch:
        put(n, 1, "pop")          # primera zona natural (día 1)
    elif i < main_patch:
        put(n, 4, "pop")          # pasto (día 4)
    else:
        put(n, 7, "pop")          # vegetación final (día 7)

pine_day = {"Pine3": 5, "Pine2": 5, "Pine1": 6}
for t in trees:
    d = pine_day[t.name.split(".")[0]]
    put(t.name, d, "tree_trunk"); t["vt_group"] = t.name
    for c in tree_kids[t.name]:
        put(c.name, d, "tree_layer"); c["vt_group"] = t.name
for o in tile_objs:
    if o.name.startswith("Mushroom") or o.name in ("Circle", "Circle.111"):
        put(o.name, 6, "pop")
    elif o.users_collection and o.users_collection[0].name == "GEN_twigs":
        put(o.name, 6, "drop_small")
for _n in grass:
    by_name[_n].scale = by_name[_n].scale * 1.6       # las matas se leen mejor a esta escala
report["unassigned_tile_meshes"] = [o.name for o in tile_objs if o.name not in stage_of][:10]

# ------------------------------------------------------------------ colecciones
def new_coll(name, parent):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if name not in [x.name for x in parent.children]:
        parent.children.link(c)
    return c
stages_root = new_coll("STAGES", scene.collection)
stage_colls = {k: new_coll(f"STAGE_{k}", stages_root) for k in range(1, TOTAL_STAGES + 1)}
tpl_coll = new_coll("_TEMPLATES_not_exported", scene.collection)
notexp = new_coll("_NOT_EXPORTED", scene.collection)
def relink(ob, coll):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)

# luciérnagas (día 7)
random.seed(7)
fire_mat = flat_mat("VT_Firefly", (1.0, 0.82, 0.38), rough=0.4, emission=(1.0, 0.78, 0.30))
fire_objs = []
for i in range(14):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.026, location=(random.uniform(-2.5, 2.5), random.uniform(-2.5, 2.5), random.uniform(0.6, 2.0)))
    f = bpy.context.active_object
    f.name = f"Firefly.{i:02d}"
    f.data.materials.append(fire_mat)
    put(f.name, 7, "firefly")
    fire_objs.append(f)

for ob in bpy.data.objects:
    if ob.name in stage_of:
        k = stage_of[ob.name]
        relink(ob, stage_colls[k])
        ob["vt_stage"] = k
        ob["vt_anim"] = anim_of[ob.name]
    elif ob.get("vt_role") == "template":
        relink(ob, tpl_coll)
    elif ob.name in ("Cube.001", "Plane.001"):
        relink(ob, notexp); ob["vt_role"] = "not_exported"
# El volumen del agua ('Cube') no viaja a GLB.
if "Cube" in bpy.data.objects:
    bpy.data.objects["Cube"]["vt_no_export"] = True

# ------------------------------------------------------------------ animación (una pista NLA por día)
def snapshot(ob): return {"loc": ob.location.copy(), "rot": ob.rotation_euler.copy(), "sc": ob.scale.copy()}
def key(ob, frame, loc=None, rot=None, sc=None):
    if loc is not None:
        ob.location = loc; ob.keyframe_insert("location", frame=frame)
    if rot is not None:
        ob.rotation_euler = rot; ob.keyframe_insert("rotation_euler", frame=frame)
    if sc is not None:
        ob.scale = sc; ob.keyframe_insert("scale", frame=frame)
def restore(ob, s): ob.location = s["loc"]; ob.rotation_euler = s["rot"]; ob.scale = s["sc"]
def mul(v, s): return mathutils.Vector((v[0] * s[0], v[1] * s[1], v[2] * s[2]))
def add(v, d): return mathutils.Vector((v[0] + d[0], v[1] + d[1], v[2] + d[2]))
def rot_add(e, d): return mathutils.Euler((e[0] + d[0], e[1] + d[1], e[2] + d[2]), e.order)

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

def animate(ob, stage, t0, kind):
    s = snapshot(ob)
    ob.animation_data_create()
    ob.animation_data.action = None
    if kind == "terrain":          # la baldosa emerge girando y se asienta
        key(ob, t0, loc=add(s["loc"], (0, 0, -0.7)), rot=rot_add(s["rot"], (0, 0, -0.6)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, -0.7)), rot=rot_add(s["rot"], (0, 0, -0.6)), sc=mul(s["sc"], (0.35, 0.35, 0.02)))
        key(ob, t0 + 12, loc=add(s["loc"], (0, 0, 0.06)), rot=rot_add(s["rot"], (0, 0, 0.05)), sc=mul(s["sc"], (1.04, 1.04, 1.06)))
        key(ob, t0 + 18, loc=add(s["loc"], (0, 0, -0.012)), rot=rot_add(s["rot"], (0, 0, -0.01)), sc=mul(s["sc"], (0.995, 0.995, 0.98)))
        key(ob, t0 + 24, loc=s["loc"], rot=s["rot"], sc=s["sc"])
    elif kind == "celebrate":      # pulso final de la baldosa
        key(ob, t0, loc=s["loc"], sc=s["sc"])
        key(ob, t0 + 6, loc=add(s["loc"], (0, 0, 0.05)), sc=mul(s["sc"], (1.012, 1.012, 1.05)))
        key(ob, t0 + 14, loc=s["loc"], sc=s["sc"])
    elif kind == "rise":           # el agua sube y se expande
        key(ob, t0, loc=add(s["loc"], (0, 0, -0.35)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, -0.35)), sc=mul(s["sc"], (0.55, 0.55, 0.02)))
        key(ob, t0 + 16, loc=add(s["loc"], (0, 0, 0.03)), sc=mul(s["sc"], (1.04, 1.04, 1.05)))
        key(ob, t0 + 24, loc=s["loc"], sc=s["sc"])
    elif kind in ("drop", "drop_small"):
        h = 1.4 if kind == "drop" else 0.8
        key(ob, t0, loc=add(s["loc"], (0, 0, h)), rot=rot_add(s["rot"], (0.6, 0.4, 0.7)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, h)), rot=rot_add(s["rot"], (0.6, 0.4, 0.7)), sc=s["sc"])
        key(ob, t0 + 7, loc=add(s["loc"], (0, 0, -0.03)), rot=s["rot"], sc=mul(s["sc"], (1.12, 1.12, 0.82)))
        key(ob, t0 + 10, loc=s["loc"], rot=s["rot"], sc=mul(s["sc"], (0.97, 0.97, 1.04)))
        key(ob, t0 + 13, loc=s["loc"], rot=s["rot"], sc=s["sc"])
    elif kind == "pop":
        key(ob, t0, sc=(0, 0, 0))
        key(ob, t0 + 6, sc=mul(s["sc"], (1.25, 1.25, 1.25)))
        key(ob, t0 + 9, sc=mul(s["sc"], (0.94, 0.94, 0.94)))
        key(ob, t0 + 11, sc=s["sc"])
    elif kind == "tree_trunk":
        h = ob.dimensions.z
        key(ob, t0, loc=add(s["loc"], (0, 0, -h * 0.49)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, -h * 0.49)), sc=mul(s["sc"], (1, 1, 0.02)))
        key(ob, t0 + 5, loc=add(s["loc"], (0, 0, h * 0.04)), sc=mul(s["sc"], (1, 1, 1.08)))
        key(ob, t0 + 7, loc=s["loc"], sc=s["sc"])
    elif kind == "tree_layer":
        key(ob, t0, loc=add(s["loc"], (0, 0, 0.5)), rot=rot_add(s["rot"], (0, 0, -1.2)), sc=(0, 0, 0))
        key(ob, t0 + 1, loc=add(s["loc"], (0, 0, 0.5)), rot=rot_add(s["rot"], (0, 0, -1.2)), sc=mul(s["sc"], (0.4, 0.4, 0.4)))
        key(ob, t0 + 7, loc=add(s["loc"], (0, 0, -0.03)), rot=rot_add(s["rot"], (0, 0, 0.08)), sc=mul(s["sc"], (1.1, 1.1, 0.9)))
        key(ob, t0 + 10, loc=s["loc"], rot=s["rot"], sc=s["sc"])
    elif kind == "firefly":
        key(ob, t0, loc=add(s["loc"], (0, 0, -0.5)), sc=(0, 0, 0))
        key(ob, t0 + 14, loc=s["loc"], sc=mul(s["sc"], (1.5, 1.5, 1.5)))
        key(ob, t0 + 20, loc=add(s["loc"], (0, 0, 0.08)), sc=s["sc"])
    push_to_nla(ob, stage, "HOLD_FORWARD" if kind == "celebrate" else "HOLD")
    restore(ob, s)

center = mathutils.Vector((0, 0, 0))
def tree_index(t, day):
    return sorted(x.name for x in trees if stage_of[x.name] == day).index(t.name)

n_anim = 0
for ob in list(bpy.data.objects):
    if ob.name not in stage_of:
        continue
    k, kind = stage_of[ob.name], anim_of[ob.name]
    t0, d = W(k), 0.0
    if kind == "drop":
        d = rocks.index(ob.name) * 1.2
    elif kind in ("drop_small", "pop"):
        d = min((ob.matrix_world.translation.xy - center.xy).length / 4.3, 1.0) * 12
    elif kind == "tree_trunk":
        d = tree_index(ob, k) * 0.9
    elif kind == "tree_layer":
        d = tree_index(bpy.data.objects[ob["vt_group"]], k) * 0.9 + 5 + tree_kids[ob["vt_group"]].index(ob) * 1.6
    elif kind == "firefly":
        d = fire_objs.index(ob) * 1.5
    ob["vt_delay_frames"] = round(d, 1)
    animate(ob, k, int(round(t0 + d)), kind)
    n_anim += 1
# pulso de celebración del día 7 sobre la baldosa (segunda pista del mismo objeto)
ground = bpy.data.objects["Ground"]
animate(ground, 7, W(7) + 30, "celebrate")
report["animated_objects"] = n_anim

# luces bajo el agua (solo previsualización en Blender): entran con el agua, el runtime pone las suyas
for nm in ("Area.002", "Area.003", "Area.004"):
    lo = bpy.data.objects.get(nm)
    if lo:
        e0 = lo.data.energy
        lo.data.energy = e0 * 0.03; lo.data.keyframe_insert("energy", frame=W(2) - 1)
        lo.data.energy = e0 * 0.03; lo.data.keyframe_insert("energy", frame=W(2) + 6)
        lo.data.energy = e0; lo.data.keyframe_insert("energy", frame=W(2) + 26)

# ------------------------------------------------------------------ render con transparencia y cámara
for c in (notexp, tpl_coll):
    c.hide_render = True      # fondo azul, niebla volumétrica y plantillas NO se renderizan ni se exportan
    c.hide_viewport = True
scene.render.film_transparent = True
scene.view_settings.exposure = -0.35
scene.render.image_settings.color_mode = "RGBA"
cam = bpy.data.objects["MasterCamera"]
target = mathutils.Vector((0.0, 0.0, 0.7))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 100
scene.camera = cam
scene.frame_start = 0
scene.frame_end = W(7) + 60

counts = {}
for ob in bpy.data.objects:
    if "vt_stage" in ob.keys():
        counts[int(ob["vt_stage"])] = counts.get(int(ob["vt_stage"]), 0) + 1
report["objects_per_day"] = dict(sorted(counts.items()))
report["windows"] = {k: W(k) for k in range(1, TOTAL_STAGES + 1)}

manifest = {"asset": "forest_progression_001", "totalStages": TOTAL_STAGES, "dayNames": DAY_NAMES, "stages": {}}
for ob in bpy.data.objects:
    if "vt_stage" in ob.keys():
        manifest["stages"].setdefault(int(ob["vt_stage"]), []).append({"name": ob.name, "anim": ob["vt_anim"], "delay": ob.get("vt_delay_frames", 0)})
with open(MANIFEST, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False)

bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
