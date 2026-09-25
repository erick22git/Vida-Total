# tools/3d — taller de assets 3D

Scripts con los que se preparó el **Bosque de 7 días** (`forest_progression_001`; el prototipo de 9 etapas quedó como `legacy_*`). Documentación completa en `docs/3d/` (empezar por `forest-7-days.md`).

> Las rutas dentro de los scripts son **de esta máquina** (`C:\Erick\...`). Si cambian, buscar `C:\\Erick` y ajustar.

## Requisitos
- Blender 5.2 con el addon de `kleer001/blender-mcp` activado y un servidor escuchando en el puerto 9334 (ver `docs/3d/blender-mcp.md`).
- `uv` (para ejecutar los clientes Python) y Node 20 (para verificar GLB).

## Orden de uso

```powershell
cd C:\Erick\herramientas\blender-mcp

# 0) (una vez) servidor headless
blender --background --python scripts\headless_server.py -- --port 9334

# 1) preparar (partículas → objetos, materiales, colecciones de plantillas)
uv run python <repo>\tools\3d\client\runpy.py <repo>\tools\3d\blender\01_prepare_landscape.py 600
# 2) 7 etapas (una por día) + animación + figura aislada (SIEMPRE después del 1: parte del archivo que guarda el 1)
uv run python <repo>\tools\3d\client\runpy.py <repo>\tools\3d\blender\02_build_7_day_stages.py 900
# 3) renders RGBA de cada día y comprobación de transparencia
uv run python <repo>\tools\3d\client\render_days.py
uv run --with pillow python <repo>\tools\3d\client\alpha_sheet.py <carpeta previews_7dias> <salida.png>
# 4) exportar GLB (crudo, Meshopt, Draco): solo la colección STAGES, sin luces/cámaras/fondo
uv run python <repo>\tools\3d\client\runpy.py <repo>\tools\3d\blender\03_export_forest_glb.py 280
# 5) verificar el GLB
node <repo>\tools\3d\verify\inspect_glb.mjs  <glb>
node <repo>\tools\3d\verify\mesh_use.mjs     <glb>     # draw calls sin instanciar
node <repo>\tools\3d\verify\stage_tris.mjs   <glb>     # triángulos por etapa
# 6) copiar el GLB Meshopt a public\models\forest_progression_001_meshopt.glb (ignorado por git)
```

Verificación en navegador (escena + página real de Hábitos): `harness/README.md`.
Análisis de un `.blend` nuevo: `client\run_analysis.py` (usa `blender\analyze_blend.py`) y `client\render_originals.py`.

## Notas
- `execute_python` del addon rechaza ciertos patrones (`__import__`, `subprocess`, `socket`, `exit(`…): los scripts están escritos para respetarlo.
- **1 y 2 no son reejecutables por separado**: cada corrida de 2 vuelve a animar sobre el archivo ya animado. Reejecutar siempre 1 → 2.
- `03_export_forest_glb.py` no guarda el `.blend`: modifica la escena en memoria solo para exportar. Exporta con la escena en su estado final; aun así el GLB guarda en cada nodo la pose INICIAL (escala 0) y la pose final sale del último fotograma del clip (el runtime lo resuelve en `captureRestFromClips`).
- Los comandos largos (vídeo, exportar) "expiran" a los 300 s en el cliente aunque Blender termine: comprobar el archivo de salida.
- `verify/verify_glb.mjs` es del prototipo de 9 etapas (muestrea `STAGE_4`); para el bosque de 7 días la comprobación real se hizo en el navegador.

## Las otras cuatro figuras (Castillo, Casa, Molino, Cuarto)
Compartidos: `blender/lib_stages.py` (materiales planos, cortes, etapas, animación) y `blender/lib_export.py`.
Construir (sobre la COPIA de cada original): `10_house_7day.py`, `11_windmill_7day.py`, `12_castle_7day.py`, `13_room_7day.py`.
Exportar GLB: `20_export_house.py`, `21_export_windmill.py`, `22_export_castle.py`, `23_export_room.py`.
Cliente: `client/runpy.py` (admite `# @include`), `render_figure_days.py`. Verificar: `verify/glb_report.mjs`, `verify/collection_test.ts`.
Resumen y métricas: `docs/3d/habit-figures.md`.
