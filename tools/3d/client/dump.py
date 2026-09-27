import sys, json, os
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection
here = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(here, "explore.py"), encoding="utf-8").read().split("w = r")[0].split("import os")[1] if False else "")
import re
def expand(path, depth=0):
    base = os.path.dirname(os.path.abspath(path)); out = []
    for line in open(path, encoding="utf-8").read().split("\n"):
        m = re.match(r"^# @include (.+?)\s*$", line)
        out.append(expand(os.path.join(base, m.group(1)), depth + 1) if m and depth < 4 else line)
    return "\n".join(out)
w = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo".replace("\\", "/")
code = expand(os.path.join(here, "..", "blender", sys.argv[2] if len(sys.argv) > 2 else "34_anim_dump.py")).replace("__SRC__", f"{w}/originales_copia/{sys.argv[1]}")
c = BlenderConnection(); c.connect()
print(json.dumps(c.send_command("execute_python", {"code": code}, timeout=900)["result"], ensure_ascii=False, default=str))
