import sys, json
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection
DST = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\landscape_progression_prototype.blend"
OUT = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\previews"
code = f'''
import bpy, time
bpy.ops.wm.open_mainfile(filepath={DST!r})
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = 1280
sc.render.resolution_y = 720
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.eevee.taa_render_samples = 48
frames = {{0: 0}}
for k in range(1, 9):
    frames[k] = 1 + 44 * (k - 1) + 42
t = time.time()
for k, f in frames.items():
    sc.frame_set(f)
    sc.render.filepath = {OUT!r} + "\\preview_stage_" + str(k) + ".png"
    bpy.ops.render.render(write_still=True)
result = {{"seconds": round(time.time() - t, 1), "frames": frames}}
'''
c = BlenderConnection(); c.connect()
print(c.send_command("execute_python", {"code": code}, timeout=1800)["result"])
