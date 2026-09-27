# Volcado de estructura de una copia (Island Animation): objetos, colecciones, padres, modificadores, sistemas de partículas, acciones.
# @include lib_stages.py
bpy.ops.wm.open_mainfile(filepath="__SRC__")
include_everything()
bpy.context.view_layer.update()
O = bpy.data.objects
rows = []
for o in O:
    r = {"n": o.name, "t": o.type, "c": [c.name for c in o.users_collection], "p": o.parent.name if o.parent else None,
         "mods": [(m.type, m.name) for m in o.modifiers], "hide": [o.hide_viewport, o.hide_render]}
    if o.type == "MESH":
        r["polys"] = len(o.data.polygons)
        a, b = bbox_world(o)
        r["min"] = [round(v, 1) for v in a]; r["max"] = [round(v, 1) for v in b]
        r["mats"] = [s.material.name for s in o.material_slots if s.material][:3]
        r["ps"] = [(p.settings.name, p.settings.count, p.settings.type, p.settings.instance_object.name if p.settings.instance_object else None, p.settings.instance_collection.name if p.settings.instance_collection else None) for p in o.particle_systems]
    if o.type == "ARMATURE":
        r["bones"] = len(o.data.bones)
        r["act"] = o.animation_data.action.name if o.animation_data and o.animation_data.action else None
    if o.type == "EMPTY":
        r["inst"] = o.instance_collection.name if o.instance_collection else None
        r["loc"] = [round(v, 1) for v in o.matrix_world.translation]
    rows.append(r)
result = {"rows": rows, "collections": [(c.name, [x.name for x in c.objects][:6], len(c.objects), [ch.name for ch in c.children]) for c in bpy.data.collections],
          "actions": [(a.name, [round(v) for v in a.frame_range]) for a in bpy.data.actions][:60], "frame": [bpy.context.scene.frame_start, bpy.context.scene.frame_end],
          "ocean": [(o.name, m.resolution, m.spatial_size) for o in O for m in o.modifiers if m.type == "OCEAN"]}
