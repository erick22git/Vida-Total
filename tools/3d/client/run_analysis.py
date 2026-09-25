import sys, json, os
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection

here = os.path.dirname(os.path.abspath(__file__))
body = open(os.path.join(here, "blender_analyze_body.py"), encoding="utf-8").read()
src_dir = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\originales_copia"
out_dir = os.path.join(here, "analysis")
os.makedirs(out_dir, exist_ok=True)

c = BlenderConnection()
c.connect()
files = sys.argv[1:] or sorted(f for f in os.listdir(src_dir) if f.endswith(".blend"))
for f in files:
    path = os.path.join(src_dir, f)
    code = body.replace("__PATH__", repr(path))
    try:
        res = c.send_command("execute_python", {"code": code}, timeout=600)
    except Exception as e:
        res = {"error": str(e)}
    with open(os.path.join(out_dir, f + ".json"), "w", encoding="utf-8") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=1, default=str)
    print("done", f, "keys" if isinstance(res, dict) else "", list(res)[:3] if isinstance(res, dict) else res)
