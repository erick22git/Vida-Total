"""Uso: uv run python render_proto.py <out.png> [frame] [ancho] [alto] [samples]
Renderiza el prototipo (ya abierto o desde disco si open=1) con EEVEE."""
import sys, os, json
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection

DST = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\landscape_progression_prototype.blend"
out = sys.argv[1]
frame = int(sys.argv[2]) if len(sys.argv) > 2 else 1
w = int(sys.argv[3]) if len(sys.argv) > 3 else 960
h = int(sys.argv[4]) if len(sys.argv) > 4 else 540
samples = int(sys.argv[5]) if len(sys.argv) > 5 else 24
reopen = os.environ.get("REOPEN", "0") == "1"

code = f'''
import bpy, time
if {reopen!r}:
    bpy.ops.wm.open_mainfile(filepath={DST!r})
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = {w}
sc.render.resolution_y = {h}
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = {out!r}
try:
    sc.eevee.taa_render_samples = {samples}
except Exception:
    pass
sc.frame_set({frame})
t = time.time()
bpy.ops.render.render(write_still=True)
result = {{"seconds": round(time.time() - t, 1), "frame": {frame}}}
'''
c = BlenderConnection()
c.connect()
r = c.send_command("execute_python", {"code": code}, timeout=1200)
print(json.dumps(r.get("result")))
