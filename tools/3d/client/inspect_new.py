"""Uso: uv run python inspect_new.py <nombre.blend> [...]  — inspecciona copias en originales_copia con blender/inspect_asset.py
y guarda el JSON en el directorio de trabajo (biblioteca de assets/_trabajo/inspeccion/)."""
import sys, json, os
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection

here = os.path.dirname(os.path.abspath(__file__))
body = open(os.path.join(here, "..", "blender", "inspect_asset.py"), encoding="utf-8").read()
work = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo"
out_dir = os.path.join(work, "inspeccion")
os.makedirs(out_dir, exist_ok=True)
c = BlenderConnection()
c.connect()
for f in sys.argv[1:]:
    path = os.path.join(work, "originales_copia", f).replace("\\", "/")
    r = c.send_command("execute_python", {"code": body.replace("__PATH__", path)}, timeout=600)
    res = r.get("result")
    with open(os.path.join(out_dir, f + ".json"), "w", encoding="utf-8") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=1, default=str)
    print("OK", f)
