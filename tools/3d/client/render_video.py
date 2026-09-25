import sys
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection
DST = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\landscape_progression_prototype.blend"
OUT = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\previews\preview_growth"
code = f'''
import bpy, time
bpy.ops.wm.open_mainfile(filepath={DST!r})
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = 960
sc.render.resolution_y = 540
sc.render.resolution_percentage = 100
sc.eevee.taa_render_samples = 16
sc.render.fps = 24
sc.render.image_settings.media_type = "VIDEO"
sc.render.image_settings.file_format = "FFMPEG"
sc.render.ffmpeg.format = "MPEG4"
sc.render.ffmpeg.codec = "H264"
sc.render.ffmpeg.constant_rate_factor = "MEDIUM"
sc.render.filepath = {OUT!r}
t = time.time()
bpy.ops.render.render(animation=True)
result = {{"seconds": round(time.time() - t, 1), "frames": [sc.frame_start, sc.frame_end]}}
'''
c = BlenderConnection(); c.connect()
print(c.send_command("execute_python", {"code": code}, timeout=3300)["result"])
