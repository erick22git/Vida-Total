"""
Diagnóstico detallado de HumanBaseMale.blend
"""
import bpy, json

SRC = "C:/Erick/app movil/vida-total-web/biblioteca de assets/rangos/HumanBaseMale.blend"
bpy.ops.wm.open_mainfile(filepath=SRC)

print("##OBJECTS", [(o.name, o.type) for o in bpy.data.objects])

# Malla
body = bpy.data.objects["MaleBASE"]
print("##BODY verts:", len(body.data.vertices), "polys:", len(body.data.polygons))
print("##VGROUP_NAMES", [vg.name for vg in body.vertex_groups])

# Armadura
arm_obj = bpy.data.objects.get("Armature")
if arm_obj:
    bones = arm_obj.data.bones
    print("##BONES_COUNT", len(bones))
    for b in sorted(bones, key=lambda x: x.name):
        print("  BONE:", b.name, "head_z:", round(b.head_local.z, 3))

# Shape keys
if body.data.shape_keys:
    print("##SHAPE_KEYS", [kb.name for kb in body.data.shape_keys.key_blocks])
else:
    print("##SHAPE_KEYS none")

# Atributos
print("##ATTRIBUTES", [(a.name, a.domain, a.data_type) for a in body.data.attributes])

# Modificadores
print("##MODIFIERS", [(m.name, m.type) for m in body.modifiers])

# Vertex groups sin filtrar (cuantos hay aunque peso=0)
print("##VGROUPS_ALL", len(body.vertex_groups), [vg.name for vg in body.vertex_groups])
