import sys, os, json, time
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection
base = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo"
os.makedirs(base + r"\previews_originales", exist_ok=True)
c = BlenderConnection(); c.connect()
for f in sys.argv[1:]:
    p = base + "\originales_copia\\" + f
    out = base + "\previews_originales\\" + f.replace(".blend", ".png")
    code = f'''
import bpy, time
bpy.ops.wm.open_mainfile(filepath={p!r})
sc = bpy.context.scene
sc.render.resolution_x = 960
sc.render.resolution_y = 540
sc.render.resolution_percentage = 100
sc.render.filepath = {out!r}
sc.render.image_settings.file_format = "PNG"
t = time.time()
eng = sc.render.engine
if eng == "CYCLES":
    sc.cycles.samples = 32
    sc.cycles.device = "CPU"
else:
    try:
        sc.eevee.taa_render_samples = 32
    except Exception:
        pass
bpy.ops.render.render(write_still=True)
result = {{"engine": eng, "seconds": round(time.time() - t, 1), "camera": sc.camera.name if sc.camera else None}}
'''
    try:
        r = c.send_command("execute_python", {"code": code}, timeout=900)
        print(f, r)
    except Exception as e:
        print(f, "ERR", e)
