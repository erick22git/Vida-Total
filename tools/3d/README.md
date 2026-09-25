# tools/3d — taller de assets 3D

Scripts con los que se preparó el prototipo `landscape_bosque_001`. Documentación completa en `docs/3d/`.

> Las rutas dentro de los scripts son **de esta máquina** (`C:\Erick\...`). Si cambian, buscar `C:\\Erick` y ajustar.

## Requisitos
- Blender 5.2 con el addon de `kleer001/blender-mcp` activado y un servidor escuchando en el puerto 9334 (ver `docs/3d/blender-mcp.md`).
- `uv` (para ejecutar los clientes Python) y Node 20 (para verificar GLB).

## Orden de uso

```powershell
cd C:\Erick\herramientas\blender-mcp

# 0) (una vez) servidor headless
blender --background --python scripts\headless_server.py -- --port 9334

# 1) preparar (partículas → objetos, materiales planos, colecciones de plantillas)
uv run python <repo>\tools\3d\client\runpy.py <repo>\tools\3d\blender\01_prepare_landscape.py 600
# 2) etapas + animación (SIEMPRE después del 1: el 2 parte del archivo que guarda el 1)
uv run python <repo>\tools\3d\client\runpy.py <repo>\tools\3d\blender\02_build_stages_and_animation.py 900
# 3) previews y vídeo
uv run python <repo>\tools\3d\client\render_stages.py
uv run python <repo>\tools\3d\client\render_video.py          # ~8 min; el comando "expira" a los 300 s pero Blender termina
# 4) exportar GLB (crudo, Meshopt, Draco)
uv run python <repo>\tools\3d\client\runpy.py <repo>\tools\3d\blender\03_export_glb.py 280
# 5) verificar
node <repo>\tools\3d\verify\inspect_glb.mjs  <glb>
node <repo>\tools\3d\verify\verify_glb.mjs   <glb>     # carga con GLTFLoader y muestrea STAGE_4
node <repo>\tools\3d\verify\mesh_use.mjs     <glb>     # draw calls estimados
node <repo>\tools\3d\verify\stage_tris.mjs   <glb>     # triángulos por etapa
```

Análisis de un `.blend` nuevo: `client\run_analysis.py` (usa `blender\analyze_blend.py`) y `client\render_originals.py`.

## Notas
- `execute_python` del addon rechaza ciertos patrones (`__import__`, `subprocess`, `socket`, `exit(`…): los scripts están escritos para respetarlo.
- Los pasos 1 y 2 **no son reejecutables por separado**: cada corrida de 2 vuelve a animar sobre el archivo ya animado. Reejecutar siempre 1 → 2.
- El paso 3 (`03_export_glb.py`) no guarda el `.blend`: modifica la escena en memoria solo para exportar.
