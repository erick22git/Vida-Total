# ISLAND ANIMATION — paso 1: reducción de geometría sobre la COPIA (`originales_copia/Island Animation.blend`), nunca el original.
# Hornea modificadores, quita lo que no es escenografía (cámaras, luces, caja de fondo, plano de nubes, océano procedural de 41 mil tris
# casi plano: wave_scale 0.01), decima palmeras/terrenos/animales y guarda `islandanim_reduced.blend` para diseñar las etapas.
# @include lib_stages.py
bpy.ops.wm.open_mainfile(filepath="__SRC__")
include_everything()
O = bpy.data.objects
for o in list(O):
    if o.parent and o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers):
        pass
    elif o.parent:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
bpy.context.view_layer.update()
report = {"removed": []}


def tris(o):
    return sum(max(len(p.vertices) - 2, 1) for p in o.data.polygons)


for n in ("Cube", "cloud plane", "Plane.002"):
    if n in O:
        report["removed"].append(n)
        bpy.data.objects.remove(O[n], do_unlink=True)
for o in [x for x in O if x.type in ("CAMERA", "LIGHT", "EMPTY")]:
    bpy.data.objects.remove(o, do_unlink=True)
for o in O:
    if o.type == "MESH":
        for ps in list(o.particle_systems):
            pass
        for m in list(o.modifiers):
            if m.type == "PARTICLE_SYSTEM":
                o.modifiers.remove(m)
bpy.context.view_layer.update()


def bake(o):
    """Aplica todos los modificadores (armadura en su pose actual, subdivisión, desplazamiento, bisel)."""
    if o.type == "MESH" and o.modifiers:
        apply_modifiers(o)


def decimate_to(o, target):
    t = tris(o)
    if t <= target:
        return t
    m = o.modifiers.new("dec", "DECIMATE")
    m.ratio = max(target / t, 0.005)
    apply_modifiers(o)
    return tris(o)


meshes = [o for o in O if o.type == "MESH"]
before = {o.name: tris(o) for o in meshes}
seen = set()
for o in meshes:
    bake(o)
bpy.context.view_layer.update()
after_bake = {o.name: tris(o) for o in meshes}
# Armaduras: ya no hacen falta (pose horneada)
bpy.context.view_layer.update()
for o in [x for x in O if x.type == "ARMATURE"]:
    for c in list(o.children):
        mw = c.matrix_world.copy()          # conserva la posición mundial al soltar el padre
        c.parent = None
        c.matrix_world = mw
    bpy.data.objects.remove(o, do_unlink=True)
report["before"] = before
report["after_bake"] = after_bake

TARGETS = {"Landscape": 9000, "Landscape.001": 7000, "Landscape.002": 1500, "Landscape.003": 1500, "Plane": 1800, "Cylinder": 500,
           "Carribean_Reef_Shark": 3500, "body": 3500, "eyes": 300}
for o in [x for x in O if x.type == "MESH"]:
    if o.name.startswith("Palm Tree"):
        t = 1400
    elif o.name in ("Cottenwood Tree",):
        t = 900
    elif o.name == "Rush":
        t = 300
    elif o.name.startswith("Plane.0"):
        t = 96
    else:
        t = TARGETS.get(o.name, 1000)
    decimate_to(o, t)
report["final"] = {o.name: tris(o) for o in O if o.type == "MESH"}
report["total_tris"] = sum(report["final"].values())
report["mesh_users"] = {o.name: o.data.users for o in O if o.type == "MESH" and o.name.startswith("Palm")}
bpy.ops.wm.save_as_mainfile(filepath="C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/islandanim_reduced.blend")
result = report
