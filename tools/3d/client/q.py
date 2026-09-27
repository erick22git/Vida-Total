import sys, json
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection
code = open(sys.argv[1], encoding="utf-8").read()
c = BlenderConnection(); c.connect()
r = c.send_command("execute_python", {"code": code}, timeout=600)
print(json.dumps(r.get("result"), ensure_ascii=False, default=str)[:20000])
