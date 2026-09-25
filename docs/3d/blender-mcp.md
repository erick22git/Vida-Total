# Blender MCP — instalación, uso y límites verificados

Fecha de verificación: 2026-09-25 · Windows 11 · **Blender 5.2.0 LTS** (`C:\Program Files\Blender Foundation\Blender 5.2`).

## 1. Qué se eligió y por qué

**`kleer001/blender-mcp`** (MIT). Compara así con `teamipc/blender-mcp` (según sus README):

| | kleer001 | teamipc |
|---|---|---|
| Herramientas | 175 tipadas, 25 áreas (objetos, materiales, shader nodes, **Geometry Nodes**, modificadores, **animación**, rigging, física, partículas, compositing, cámara, luces, **render**, **import/export**, colecciones…) | Objetos, materiales, ejecutar código Python, descargas de Poly Haven/Sketchfab, generación con IA |
| Geometry Nodes / animación / render | Herramientas dedicadas | Solo vía código |
| Assets externos | No | Sí (Poly Haven, Sketchfab) |
| Blender declarado | 4.0+ (probado en 4.2.5) | 3.0+ |
| Conexión con Claude Code | `.mcp.json` en el repo | `claude mcp add blender uvx blender-mcp` |

Se usó kleer001 por cobertura de Geometry Nodes/animación/render/exportación. **teamipc queda como complemento** si más adelante se quiere descargar de Poly Haven/Sketchfab desde Blender (siempre verificando licencia).

**Compatibilidad real con Blender 5.2**: el README solo declara pruebas en 4.2.5, pero en esta fase se comprobó que el addon arranca en 5.2.0, responde (`ping`), consulta la escena, abre `.blend`, ejecuta Python, renderiza y exporta GLB.

## 2. Instalación realizada

```powershell
# 1) uv (gestor de Python que usa el MCP)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 2) MCP fuera del repo de la app
git clone https://github.com/kleer001/blender-mcp C:\Erick\herramientas\blender-mcp
cd C:\Erick\herramientas\blender-mcp
uv sync
```

- **Addon**: la carpeta `blender_addon` se copió a `%APPDATA%\Blender Foundation\Blender\5.2\scripts\addons\blender_addon` y se activó (queda guardado en las preferencias).
- **Claude Code**: `.mcp.json` en la raíz del proyecto (ignorado por git porque lleva rutas de esta máquina):
  ```json
  { "mcpServers": { "blender": { "command": "C:\\Users\\aly_n\\.local\\bin\\uv.exe",
      "args": ["run", "--directory", "C:\\Erick\\herramientas\\blender-mcp", "blender-mcp"] } } }
  ```
  Las herramientas `mcp__blender__*` aparecen **al abrir una sesión nueva** de Claude Code en el proyecto (y hay que aprobar el servidor del proyecto).

## 3. Cómo arrancar Blender para que responda

El MCP es solo un relevo: necesita un servidor dentro de Blender (puerto **9334**).

| Modo | Comando | Uso |
|---|---|---|
| GUI (manual) | En Blender: barra lateral 3D (tecla **N**) → pestaña **MCP** → **Start Server** | trabajar viendo el viewport |
| Headless | `blender --background --python C:\Erick\herramientas\blender-mcp\scripts\headless_server.py -- --port 9334` | automatización, render y export sin ventana |

Comprobar que responde (Python, desde la carpeta del MCP):
```powershell
uv run python -c "import sys; sys.path.insert(0,'src'); from blendermcp.connection import BlenderConnection as B; c=B(); print(c.connect()); print(c.send_command('ping',{}))"
```
Esperado: `5.2.0` y `{'status': 'ok', 'blender_version': '5.2.0'}`.
Desde Claude Code (sesión nueva): pedir "consulta la escena actual de Blender" (`get_scene_info`).

Solo puede haber **un** Blender escuchando en 9334. Si se abre el GUI con el servidor mientras hay uno headless, detener el headless primero.

## 4. Capacidades comprobadas

| Capacidad | Resultado |
|---|---|
| Consultar la escena (`get_scene_info`) | OK (objetos, colecciones, materiales, fps, motor) |
| Abrir/importar un archivo | OK (`open_mainfile` sobre los 5 `.blend`, guardados con Blender 2.67 a 3.3) |
| Inspeccionar objetos / colecciones / materiales / animaciones | OK (scripts `analyze_blend.py`) |
| Ejecutar operaciones | OK (`execute_python`; también `duplicates_make_real`, keyframes, NLA, colecciones) |
| Renderizar | OK (EEVEE 5.2 en segundo plano: 1–9 s por fotograma a 1280×720; Cycles CPU: 70–135 s a 960×540) |
| Vídeo | OK (H.264 MP4, 960×540, 24 fps, 380 fotogramas) |
| Geometry Nodes | Herramientas presentes (`create_geonodes_modifier`, `connect_geonodes`…); en esta fase **no se usaron** porque lo que llega a GLB son transformaciones (ver `scene-progression.md`) |
| Exportar GLB/GLTF | OK (`export_scene.gltf`, con Meshopt y Draco) |

## 4b. Límites y trampas encontradas

- **Filtro de seguridad de `execute_python`**: bloquea `__import__`, `subprocess`, `socket`, `urllib`, `requests`, `os.remove`, `shutil.move`, `sys.exit`, `exit(`… Es correcto: hay que escribir el código sin esos patrones (`import` normal sí se permite). Los scripts de `tools/3d/` los respetan.
- **Tiempo límite de 300 s por comando** en el addon: operaciones largas (vídeo, exportar con muchas animaciones) siguen ejecutándose en Blender aunque el cliente reciba "Command timed out". Comprobar el archivo de salida, no la respuesta. Exportar con 1 500 objetos animados tardó ~11 min; sin animar el detalle, 33 s.
- **API de Blender 5.x** (cambios que rompían scripts de versiones anteriores):
  - Vídeo: `image_settings.media_type = "VIDEO"` antes de `file_format = "FFMPEG"`.
  - Acciones "por capas": `action.layers[i].strips[j].channelbags[k].fcurves` (ya no existe `action.fcurves`).
  - Motor EEVEE: `BLENDER_EEVEE` (único identificador).
  - `ParticleSettings.display_percentage` (no `display_percent`).
- **Partículas en segundo plano**: `show_viewport` viene `False`; `duplicates_make_real` no crea nada hasta activarlo.
- **`execute_python` ejecuta en un espacio con `bpy`, `mathutils` y `result`** (el valor de `result` es la respuesta). Un `open_mainfile` dentro del código reemplaza toda la escena.
- **Seguridad**: `execute_python` ejecuta código arbitrario en Blender. Guardar el trabajo antes de usarlo y no exponer el puerto 9334 fuera de `localhost`.

## 5. Uso como herramienta de producción

Sí: inspeccionar, abrir assets, crear colecciones, separar piezas, crear materiales, animar, configurar cámara, renderizar previews, probar exportación, automatizar tareas repetitivas.
No: sustituir la arquitectura de la app. Los scripts viven en `tools/3d/` y se pueden reejecutar sobre cualquier asset.
