# Detector de barra/equipo de gym (YOLO liviano) — Fase 1: dataset

Esta carpeta no corre en el repo (no hay GPU ni Python en esta sesión). Son notebooks de
**Google Colab** para armar el dataset y, después, entrenar. Se suben a Colab tal cual y se
corren ahí con GPU T4 gratis — esto reemplaza al script que armaría yo localmente, porque esta
máquina solo tiene una GPU de 2GB (insuficiente) y ni siquiera tiene Python instalado.

## Fuentes públicas usadas (todas CC BY 4.0 — permiten uso comercial, exigen dar crédito)

| Clase | Fuente | Imágenes | Licencia |
|---|---|---|---|
| `barbell` | [barbell-detection-yolov5](https://universe.roboflow.com/computer-vision-1bdzc/barbell-detection-yolov5) (Computer Vision) + [NKUST_Barbell](https://universe.roboflow.com/nkust-airs-lps/nkust_barbell) (NKUST AIRS LPS) | 1712 + 574 = 2286 | CC BY 4.0 |
| `dumbbell` | [Gym_001](https://universe.roboflow.com/ecnu/gym_001) (ECNU) + [Gym_greyscale](https://universe.roboflow.com/gymitemidentifier/gym_greyscale) (GymItemIdentifier) | 1470 + 1904 = 3374 (con solape de otras clases) | CC BY 4.0 |
| `kettlebell` | Gym_greyscale | incluida en las 1904 | CC BY 4.0 |
| `plate` (disco) | Gym_greyscale | incluida en las 1904 | CC BY 4.0 |
| `cable` (polea/máquina) | Gym_greyscale | incluida en las 1904 | CC BY 4.0 |

Atribución requerida por CC BY 4.0 (se repite en `docs/roadmap/vision-entrenador.md` cuando esto
se integre): dataset original de cada autor citado arriba, vía Roboflow Universe.

Se descartó `weight-lifting-bar` (NKUST, 2025) por tener 0 imágenes, y `barbell-tracking-olmop`
(kakann) por tener clases ambiguas (`0, 1, Bar, Barbell, End`) y ningún modelo entrenado como señal
de calidad — no se usa ninguna imagen sacada de ahí.

## Clases que NO existen en ningún dataset público: generadas con Autodistill + Grounding DINO

Ningún dataset público distingue **tipo de barra** (olímpica recta vs. hexagonal de peso muerto vs.
curl/EZ) — todos las etiquetan como `barbell` genérico. En vez de pedir que se grabe y marque a mano
cientos de fotos, se usa [Autodistill](https://github.com/autodistill/autodistill) (open source) con
[Grounding DINO](https://github.com/IDEA-Research/GroundingDINO) como modelo base: se le da una
descripción en texto de cada clase nueva y genera las cajas automáticamente sobre imágenes sin
etiquetar — en este caso, las mismas imágenes de los datasets CC BY ya descargados (no se bajó nada
nuevo de internet sin licencia).

| Clase nueva | Prompt de texto usado (ontology de Autodistill) | Por qué este texto |
|---|---|---|
| `barra_olimpica` | `"straight olympic weightlifting barbell with knurled grip, long metal bar used for squats or bench press"` | Describe forma (recta, larga) + textura (grip rayado) + uso típico, para no confundirla con la curl |
| `barra_hexagonal` | `"hexagonal trap bar for deadlifts, hexagon shaped barbell with handles on both sides"` | La forma hexagonal es el rasgo más distintivo, se nombra primero |
| `barra_curl` | `"short EZ curl bar with zigzag shape for bicep curls"` | "Zigzag" es el término más reconocible para Grounding DINO en este tipo de barra |
| `maquina_polea` (refuerzo de `cable`) | `"cable machine tower with pulley and weight stack in a gym"` | Gym_greyscale tiene pocas imágenes de esta clase; se refuerza con más detecciones sobre el mismo pool de imágenes |

**Importante — esto son pseudo-etiquetas, no verdad verificada a mano.** Autodistill con Grounding
DINO suele acertar bien en objetos con forma/textura distintiva (como estos), pero conviene revisar
una muestra (`inspect_labels.ipynb`, celda final del notebook de Fase 1) antes de entrenar con ellas.
Si alguna clase detecta mal, lo que hay que ajustar es el texto del prompt de esa fila de la tabla —
decime cuál y lo afino.

## Qué corre en Colab (en orden)

1. **`01_assemble_dataset.ipynb`** — Fase 1:
   - Descarga `barbell-detection-yolov5`, `NKUST_Barbell`, `Gym_001`, `Gym_greyscale` vía la API de
     Roboflow (pide tu propia API key gratis de Roboflow — no se guarda ninguna en el repo).
   - Normaliza nombres de clase (ej. `barbell` y `Barbell` con mayúscula distinta en el primer
     dataset cuentan como la misma clase).
   - Corre Autodistill + Grounding DINO sobre el mismo pool de imágenes para las 4 clases nuevas de
     la tabla de arriba, con un umbral de confianza configurable (`box_threshold`, por defecto 0.35).
   - Hace el split train/val/test (70/20/10) **sin mezclar imágenes de un mismo dataset/versión entre
     train y val**, para no inflar el accuracy de forma falsa.
   - Exporta todo en formato YOLO a un único `.zip` descargable, listo para `02_train_yolo.ipynb`.
2. **`02_train_yolo.ipynb`** — Fase 2 (queda preparado, no se corrió todavía): entrena YOLOv8n sobre
   el dataset combinado, con GPU T4 de Colab.

## Pendiente de tu lado

Corré `01_assemble_dataset.ipynb` en Colab con tu API key de Roboflow (gratis, se crea en
roboflow.com) y pasame el resumen final que imprime (cantidad de imágenes por clase, después de
Autodistill). Con ese número real decido si ya alcanza para entrenar o si conviene que grabes
fotos/video propios de tu gimnasio antes de la Fase 2 — no lo puedo decidir sin ver cuántas quedaron
por clase.
