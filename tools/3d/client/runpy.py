"""Uso: uv run python runpy.py <archivo.py> [timeout]  — envía el archivo a Blender vía execute_python
(pasa por el filtro de seguridad del addon) e imprime el `result`.

Soporta `# @include ruta/relativa.py` (una línea sola): se reemplaza por el contenido de ese archivo, para
compartir la librería de etapas (lib_stages.py) entre los scripts de cada figura."""
import sys, json, os, re
sys.path.insert(0, r"C:\Erick\herramientas\blender-mcp\src")
from blendermcp.connection import BlenderConnection


def expand(path: str, depth: int = 0) -> str:
    base = os.path.dirname(os.path.abspath(path))
    out = []
    for line in open(path, encoding="utf-8").read().split("\n"):
        m = re.match(r"^# @include (.+?)\s*$", line)
        if m and depth < 4:
            out.append(expand(os.path.join(base, m.group(1)), depth + 1))
        else:
            out.append(line)
    return "\n".join(out)


path = sys.argv[1]
timeout = float(sys.argv[2]) if len(sys.argv) > 2 else 900
code = expand(path)
c = BlenderConnection()
c.connect()
try:
    r = c.send_command("execute_python", {"code": code}, timeout=timeout)
    print(json.dumps(r.get("result"), ensure_ascii=False, indent=None, default=str)[:200000])
except Exception as e:
    print("ERROR:", e)
