"""Uso: uv run python render_figure_days.py <archivo.blend> <carpeta_salida> — RGBA de cada día (0 = vacío, 1..7)."""
import sys
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection
blend = sys.argv[1].replace("\\", "/")
out = sys.argv[2].replace("\\", "/")
code = f'''
import bpy, os, time
os.makedirs("{out}", exist_ok=True)
bpy.ops.wm.open_mainfile(filepath="{blend}")
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = 1000
sc.render.resolution_y = 1000
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.eevee.taa_render_samples = 40
frames = {{0: 0}}
for k in range(1, 8):
    frames[k] = 1 + 44 * (k - 1) + (48 if k == 7 else 42)
t = time.time()
for k, f in frames.items():
    sc.frame_set(f)
    sc.render.filepath = os.path.join("{out}", "day_" + str(k) + ".png")
    bpy.ops.render.render(write_still=True)
result = {{"seconds": round(time.time() - t, 1), "frames": frames}}
'''
c = BlenderConnection(); c.connect()
print(c.send_command("execute_python", {"code": code}, timeout=1800)["result"])
