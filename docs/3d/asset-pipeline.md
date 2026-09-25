# Pipeline de assets 3D

Cómo entra un asset, se prepara, se divide en etapas, se anima, se exporta, se registra y llega a la app.
Los scripts reales están en `tools/3d/` (leer su README) y se ejecutan sobre Blender vía el MCP (`blender-mcp.md`).

## 0. Reglas fijas

- **Nunca** se edita ni se mueve el original. Se trabaja sobre una copia en `biblioteca de assets/_trabajo/`.
- La carpeta `biblioteca de assets/` está en `.gitignore` (es pesada); el repo guarda docs y scripts, no los `.blend`/GLB.
- Ningún asset externo entra sin `source`, `license`, `author`, `originalFile` en el registro (`asset-registry.json`).

## 1. Ingreso

1. El archivo original se deja intacto en `biblioteca de assets/<MÓDULO>/<familia>/`.
2. Se registra su huella (`sha256`) para poder demostrar después que no cambió.
3. Se copia a `_trabajo/originales_copia/`.
4. **Inspección** (`tools/3d/blender/analyze_blend.py`): formato/versión de guardado, objetos por tipo, polígonos (crudos y evaluados), colecciones, jerarquía, materiales (y qué nodos usan), texturas (tamaño, empaquetadas o externas), cámaras, luces, animaciones, dependencias externas, bounding box.
5. **Render de referencia** de cada original (`previews_originales/`) para juzgar estética con el mismo motor.
6. **Evaluación** (`asset-evaluation.md`): estética *y* viabilidad técnica. No se elige solo por estética.
7. **Licencia**: se pregunta el origen; si no se puede verificar, el asset queda `license: "UNVERIFIED"` y **no se publica** (sí se puede prototipar localmente).

## 2. Preparación (script `01_prepare_landscape.py`)

Objetivo: dejar solo lo que va a la escena, con geometría real.

- **Plantillas** (moldes usados por partículas, fuera de la baldosa) se marcan `vt_role = "template"` y luego se apartan a `_TEMPLATES_not_exported`.
- **Partículas → objetos reales**: los sistemas de pelo/partículas no viajan a GLB. Se reducen los conteos (móvil) y se convierten en instancias reales (`duplicates_make_real`), que comparten malla.
  - Ojo: los objetos copiados heredan las propiedades personalizadas de la plantilla (`vt_role`); hay que borrarla.
  - Ojo: en segundo plano las partículas vienen desactivadas en el viewport (`show_viewport = False`); hay que activarlas antes de convertirlas.
- **Decimación** de las plantillas pesadas (pasto: ratio 0.3) y se aplica el modificador antes de duplicar.
- **Fuera de export**: volúmenes de niebla y fondos (`_NOT_EXPORTED`).

## 3. Materiales

glTF solo entiende PBR plano. Los materiales procedurales (`ObjectInfo → ColorRamp`) se exportan como gris. Por eso:

- Se crean **variantes planas** `VT_<Familia>_<n>` (p. ej. `VT_Pine_0…3`) con colores dirigidos a mano y se asignan por hash del nombre.
- El agua pierde `Transmission` (no es barato en móvil) y queda color + rugosidad baja.
- Luces "falsas" del original (p. ej. las de debajo del agua) se animan o se quitan en la previsualización; **en runtime las luces las pone la app**.
- Cuando el asset sí traiga texturas: máximo 2K, atlas por familia, WebP/KTX2 (ver `performance.md`).

## 4. División en etapas (script `02_build_stages_and_animation.py`)

1. Se elige una **secuencia propia del asset** (no se impone la misma a todos). Para el bosque:

   | Etapa | Umbral de progreso | Contenido | Montaje (`vt_anim`) |
   |---|---|---|---|
   | STAGE_0 | 0 | terreno (baldosa) | `static` |
   | STAGE_1 | 1 | río / lago | `rise` |
   | STAGE_2 | 5 | rocas (14) | `drop` |
   | STAGE_3 | 10 | pasto (600) | `pop` (runtime) |
   | STAGE_4 | 20 | pinos chicos (7) | `tree_trunk` + `tree_layer` |
   | STAGE_5 | 30 | pinos medianos (6) | ídem |
   | STAGE_6 | 40 | pinos grandes (6) | ídem |
   | STAGE_7 | 50 | detalle: hongos, ramitas, guijarros, más pasto | `pop`, `drop_small` |
   | STAGE_8 | 60 | ambiente: luciérnagas + luz cálida (hito final) | `firefly` |

   Los umbrales siguen la narración pedida (día 1 primera construcción, 5, 10, 20, 30, 40, 50, 60). Se pueden cambiar sin rehacer el asset: viven en el registro, no en el `.blend`.

2. Cada objeto se **enlaza** a la colección `STAGES/STAGE_k` y recibe propiedades personalizadas:
   `vt_stage`, `vt_anim`, `vt_unlock_at`, `vt_delay_frames`, y `vt_group` (p. ej. el árbol al que pertenece una copa).
3. Los árboles conservan su **jerarquía** (tronco → 5 copas) porque el montaje va por fragmentos.

## 5. Animación de construcción

Técnica elegida (ver la comparación en `scene-progression.md`, sección "Técnicas evaluadas"): **keyframes por objeto en una pista NLA por etapa** + procedural en runtime para el detalle repetitivo. Geometry Nodes queda para *generar* variaciones (dispersión, ramas), no para revelar, porque **no viaja a GLB**.

| `vt_anim` | Qué hace | Duración |
|---|---|---|
| `rise` | el agua sube y se expande desde el lecho | 1.0 s |
| `drop` | la roca cae, golpea (squash), se asienta | ~0.5 s + escalonado (1.2 fr) |
| `tree_trunk` | el tronco crece desde el suelo con overshoot | 0.3 s |
| `tree_layer` | cada copa cae, gira y encaja, de abajo hacia arriba | 0.4 s c/u, escalonadas |
| `pop` | brota con rebote, en onda según la distancia al centro | 0.45 s + hasta 0.5 s de onda |
| `firefly` | asciende y se enciende | 0.8 s |

Total de una etapa normal: **≈ 1.0–1.3 s**. El hito (STAGE_8) dura ~1.8 s.

## 6. Exportación (script `03_export_glb.py`)

Parámetros que importan (Blender 5.2):

- `collection="STAGES"`, `export_apply=True` (aplica solidify/subsurf), `export_yup=True`, `export_extras=True`.
- `export_animation_mode="NLA_TRACKS"` → **un clip glTF por pista** (`STAGE_1…8`).
- **Normalizar el tiempo**: las pistas viven separadas en la línea de tiempo (44 fotogramas entre etapas). Para que cada clip empiece en t = 0 hay que **desplazar las claves de la acción**, no la tira NLA (mover la tira rompe el muestreo del exportador: probado, produce clips planos y 5× más pesados).
- Sin luces ni cámaras; el volumen de agua (`Cube`) no se exporta.
- Variantes: `.glb` (referencia), `_meshopt.glb` (recomendada), `_draco.glb`.

Resultado medido del prototipo: 3.34 MB → **2.03 MB (Meshopt)** → 1.36 MB (Draco).

## 7. Verificación (obligatoria antes de dar un asset por bueno)

`tools/3d/verify/inspect_glb.mjs` y `verify_glb.mjs` cargan el GLB con el **mismo `GLTFLoader` de three.js** que usa R3F y comprueban:

- Que carga (crudo y Meshopt) y que el número de meshes/triángulos coincide con Blender.
- Escala/orientación: la baldosa mide 6 × 6 m, altura 2.93 m, eje Y arriba.
- `userData.vt_*` presentes en todos los nodos; nodos por etapa correctos.
- Clips: 7 (`STAGE_1…8`; el 3 no tiene clip a propósito), todos empiezan en t = 0, duraciones 0.8–1.8 s.
- Muestreo de `STAGE_4`: el tronco pasa de escala ~0.05 a la escala de reposo y las copas de 0 a 1, y **el estado final coincide con la pose de reposo** (con `LoopOnce` + `clampWhenFinished`).

Falta (necesita navegador/GPU): verificar visualmente en WebGL y medir FPS reales en un teléfono.

## 8. Registro

Cada asset (original y derivado) va en `docs/3d/asset-registry.json` con: `id, name, module, category, source, license, author, originalFile, workingFile, format, polyCount, stages, animation, preview, glb, mobileReady`. El registro es **la** fuente de umbrales y del mapeo de módulos.

## 9. Llegada a React Three Fiber (futuro, no implementado)

1. `useGLTF(url)` con Meshopt (drei lo trae).
2. Agrupar por `userData.vt_stage`; visibilidad = `stage <= currentStage` (las piezas de etapas futuras `visible=false`).
3. Reproducir `STAGE_k` con `AnimationMixer` (`LoopOnce`, `clampWhenFinished`) cuando `currentStage` sube a `k`.
4. Instanciar en runtime las mallas compartidas (`InstancedMesh`) y animar el detalle (`pop`, `drop_small`) con `vt_delay_frames`.
5. Luces, niebla, fondo y cámara por asset desde el registro.
6. Cargar solo en la vista que lo necesita (mismo patrón que `Crystal3D`: `next/dynamic`, sin SSR).

Pasos manuales de la fase: definir la licencia de cada original, elegir el estilo final (ver "criterio visual" en `asset-evaluation.md`) y probar en un dispositivo real.
