"""Uso: uv run python explore.py <nombre.blend> <out.png> — render de exploración (blender/29_explore.py) de una copia."""
import sys, json
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from blendermcp.connection import BlenderConnection
import os
here = os.path.dirname(os.path.abspath(__file__))
def expand(path, depth=0):
    import re
    base = os.path.dirname(os.path.abspath(path)); out = []
    for line in open(path, encoding="utf-8").read().split("\n"):
        m = re.match(r"^# @include (.+?)\s*$", line)
        out.append(expand(os.path.join(base, m.group(1)), depth + 1) if m and depth < 4 else line)
    return "\n".join(out)
w = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo".replace("\\", "/")
code = expand(os.path.join(here, "..", "blender", "29_explore.py")).replace("__SRC__", (sys.argv[1].replace("\\","/") if ":" in sys.argv[1] else f"{w}/originales_copia/{sys.argv[1]}")).replace("__OUT__", sys.argv[2].replace("\\", "/"))
c = BlenderConnection(); c.connect()
r = c.send_command("execute_python", {"code": code}, timeout=900)["result"]
print(json.dumps(r, ensure_ascii=False, default=str)[:30000])
