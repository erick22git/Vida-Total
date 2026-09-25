import bpy, mathutils

SRC = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\originales_copia\Bosque.blend"
DST = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\landscape_progression_prototype.blend"

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
report = {}

def ensure_coll(name):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
    return c

# 1) Marcar plantillas (moldes fuera de la baldosa: x < -8). NO se mueven: las partículas
#    las siguen instanciando desde sus colecciones originales.
tpl_names = []
for ob in bpy.data.objects:
    if ob.type in ("CAMERA", "LIGHT"):
        continue
    if ob.matrix_world.translation.x < -8:
        ob["vt_role"] = "template"
        tpl_names.append(ob.name)
report["templates"] = len(tpl_names)

# 2) Decimar plantillas de hierba y aplicar el modificador.
n_dec = 0
for ob in bpy.data.objects:
    if ob.name.startswith("Grass") and ob.type == "MESH" and ob.get("vt_role") == "template":
        for m in list(ob.modifiers):
            if m.type == "DECIMATE":
                m.ratio = 0.14
                with bpy.context.temp_override(object=ob, active_object=ob):
                    bpy.ops.object.modifier_apply(modifier=m.name)
                n_dec += 1
report["grass_decimated"] = n_dec

# 3) Partículas -> objetos reales (conteos reducidos para móvil).
ground = bpy.data.objects["Ground"]
counts = {"Grass": 240, "Rocks": 24, "Bran": 60}
for ps in ground.particle_systems:
    if ps.name in counts:
        ps.settings.count = counts[ps.name]
for m in ground.modifiers:
    if m.type == "PARTICLE_SYSTEM":
        m.show_viewport = True
bpy.context.view_layer.update()
before = set(o.name for o in bpy.data.objects)
bpy.ops.object.select_all(action="DESELECT")
ground.select_set(True)
bpy.context.view_layer.objects.active = ground
bpy.ops.object.duplicates_make_real(use_base_parent=False, use_hierarchy=False)
new_objs = [o for o in bpy.data.objects if o.name not in before]
for _o in new_objs:
    if "vt_role" in _o.keys():
        del _o["vt_role"]
report["real_instances_created"] = len(new_objs)
for m in list(ground.modifiers):
    if m.type == "PARTICLE_SYSTEM":
        ground.modifiers.remove(m)

grass_c = ensure_coll("GEN_grass")
pebbles_c = ensure_coll("GEN_pebbles")
twigs_c = ensure_coll("GEN_twigs")
kinds = {"grass": 0, "pebbles": 0, "twigs": 0, "other": []}
def relink(ob, coll):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    coll.objects.link(ob)
for ob in new_objs:
    key = ob.name.split(".")[0]
    if key.startswith("Grass"):
        relink(ob, grass_c); kinds["grass"] += 1
    elif key.startswith("rock"):
        relink(ob, pebbles_c); kinds["pebbles"] += 1
    elif key.startswith("Vert"):
        relink(ob, twigs_c); kinds["twigs"] += 1
    else:
        kinds["other"].append(ob.name)
kinds["other"] = kinds["other"][:10]
report["kinds"] = kinds
report["sample_new"] = [o.name for o in new_objs[:6]]
report["sample_shared_mesh"] = len({o.data.name for o in new_objs if o.type == "MESH"})
bpy.ops.wm.save_as_mainfile(filepath=DST)
result = report
