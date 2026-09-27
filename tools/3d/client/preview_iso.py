"""Uso: uv run python preview_iso.py <nombre.blend> <out.png> [dx dy dz] — render EEVEE isométrico de una copia, con luz propia."""
import sys
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection
base = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo"
f, out = sys.argv[1], sys.argv[2]
d = [float(x) for x in sys.argv[3:6]] if len(sys.argv) >= 6 else [-0.6, -0.7, 0.55]
code = f'''
import bpy, math
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath={base + "/originales_copia/" + f!r})
sc = bpy.context.scene; bpy.context.view_layer.update()
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = 960, 640
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = {out!r}
dg = bpy.context.evaluated_depsgraph_get()
mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3)
for o in bpy.data.objects:
    if o.type == "MESH" and not o.hide_render:
        for c in o.bound_box:
            p = o.matrix_basis @ Vector(c)
            mn = Vector(map(min, mn, p)); mx = Vector(map(max, mx, p))
ctr = (mn + mx) / 2; size = (mx - mn).length
for o in list(bpy.data.objects):
    if o.type in ("CAMERA", "LIGHT"): bpy.data.objects.remove(o, do_unlink=True)
sun = bpy.data.objects.new("S", bpy.data.lights.new("S", "SUN")); sun.data.energy = 3
sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
cam = bpy.data.objects.new("C", bpy.data.cameras.new("C")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 60; cam.data.clip_end = 5000; cam.data.clip_start = 0.1
dirv = Vector({d!r}).normalized()
cam.location = ctr + dirv * size * 1.25
cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.35, 0.37, 0.4, 1)
bpy.ops.render.render(write_still=True)
result = {{"ctr": list(ctr), "size": size, "min": list(mn), "max": list(mx)}}
'''
c = BlenderConnection(); c.connect()
print(c.send_command("execute_python", {"code": code}, timeout=600))
