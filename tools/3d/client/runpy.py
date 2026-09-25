"""Uso: uv run python runpy.py <archivo.py> [timeout]  — envía el archivo a Blender vía execute_python
(pasa por el filtro de seguridad del addon) e imprime el `result`."""
import sys, json, os
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection

path = sys.argv[1]
timeout = float(sys.argv[2]) if len(sys.argv) > 2 else 900
code = open(path, encoding="utf-8").read()
c = BlenderConnection()
c.connect()
try:
    r = c.send_command("execute_python", {"code": code}, timeout=timeout)
    print(json.dumps(r.get("result"), ensure_ascii=False, indent=None, default=str)[:200000])
except Exception as e:
    print("ERROR:", e)
