# Cuerpo de rangos: acabado desde lo pintado a mano

Script: `tools/3d/blender/71_rango_cuerpo_pintado.py` (`blender -b --python tools/3d/blender/71_rango_cuerpo_pintado.py`, ~12 s).

- **Entrada** (no se modifica): `biblioteca de assets/rangos/trabajo/rangos_cuerpo_PINTAR.blend`, con los 15 materiales `RG_*` pintados por caras.
- **Salida**:
  - `biblioteca de assets/rangos/trabajo/rangos_cuerpo_ACABADO.blend`: el look. Atributos de color `preview_<rango>` (hierro, cobre, plata, oro, platino, esmeralda, diamante, campeón, simétrico); se cambia el activo en Propiedades de datos > Atributos de color.
  - `control_acabado_<vista>_<rango>.png`: renders de control.
  - `public/models/rango_cuerpo_m_001_meshopt.glb` (948 KB, 39 k vértices / 78 k triángulos). La versión anterior queda en `biblioteca de assets/_trabajo/export/..._ANTERIOR.glb`.

## Qué trae el GLB
- `_REGA.._REGD`: pesos por región (mismo orden que `REGION_KEYS`; `RG_cuello_trapecio` → Cuello, `RG_base` → Neutro).
- `_RIM` (nuevo): `R` = multiplicador de color (borde oscuro difuminado de ~3,4 cm por lado, con 3 mm de meseta oscura, por una sombra suave que oscurece hacia el borde y aclara hacia el centro de cada músculo); `G` = máscara de brillo (pico en el centro del músculo); `B` = solo la sombra suave.
- Orientación: de frente a +Z, 1,84 m, pies en y = 0 (igual que el modelo anterior).

## En la app
`src/lib/3d/rank-body.ts` lee `_RIM` (atributo `rimA`): `diffuse = colorDeRegión × R`, y suma un brillo sutil con `G`. Si el GLB no trae `_RIM` (versiones viejas) no hay borde y todo se ve como antes.

## Parámetros (arriba del script)
`RIM_WIDTH` (ancho del degradado), `RIM_BLUR_PASSES` (difuminado), `RIM_FLOOR` (el borde no es negro puro), `SHADE_MIN` (cuánto se oscurece hacia el borde), `SMOOTH_PASSES` (suavizado de los pesos). Los músculos chicos (aductores, abductores) acortan solos el degradado para no quedar negros.

## Valores actuales del borde (más suave)
`RIM_WIDTH = 0.034`, `RIM_BLUR_PASSES = 4`, `RIM_FLOOR = 0.42`, `SHADE_MIN = 0.88`, `RIM_PLATEAU = 0.003`. Frente a la versión anterior (0.02 / 0.30 / 0.80): ~36 % menos oscuridad máxima, ~34 % menos oscuridad media en la banda de 2 cm. Con variables de entorno `VT_RIM_WIDTH`, `VT_RIM_FLOOR`, `VT_SHADE_MIN`, `VT_RIM_PLATEAU` se prueba sin editar el script.

## Materiales por rango (acabado realista)
Definidos en `src/lib/gym/rank-config.ts` (`RANK_MATERIALS`, `NO_RANK_MATERIAL`): por rango `base`, `light`, `shade`, `shine`, `rough`, `tint` (tinte del reflejo), y opcionales `irid` (iridiscencia, Diamante) e `inner` (luz interior, Esmeralda/Campeón). El shader de `rank-body.ts` mezcla sombra → base → luz según orientación, centro del músculo (`_RIM.g`) y sombra horneada, y suma un reflejo de entorno falso (gradiente + softbox de estudio) con fresnel. Sin texturas, sin draw calls extra, sin aumento del GLB (cuatro `vec4[15]` de uniforms).

## Licencia (importante)
El GLB deriva de `HumanBaseMale.blend` (BlenderKit), cuya **licencia NO está verificada**. En `asset-registry.json` la entrada `rango_cuerpo_m_001` mantiene `license: "UNVERIFIED"` y `publishable: false`. No tratar este GLB como publicable ni redistribuible hasta verificar la fuente y licencia. Los `.blend` y la carpeta "biblioteca de assets" no se suben al repositorio.
