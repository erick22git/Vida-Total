# Licencias de imágenes de ejercicios

El repositorio es público: solo se agregan imágenes con licencia libre confirmada en la página de origen. La atribución también se muestra en la ficha del ejercicio (`imagenCredito` en `src/lib/data/exercises.json`).

| Ejercicio (`id`) | Archivo | Origen | Autor | Licencia | Notas |
|---|---|---|---|---|---|
| `press-inclinado-maquina` | `public/exercises/gifs/press-inclinado-maquina.jpg` | [Wikimedia Commons: Chest Incline.jpg](https://commons.wikimedia.org/wiki/File:Chest_Incline.jpg) (hallada vía Openverse) | Aliva Sahoo | CC BY-SA 4.0 | Redimensionada a 850 px y recomprimida; es una adaptación y se comparte con la misma licencia. Foto de la máquina, sin persona. |
| `press-frances-mancuernas` | `public/exercises/gifs/press-frances-mancuernas.svg` | [Wikimedia Commons: Lying triceps extension with dumbbells 1.svg](https://commons.wikimedia.org/wiki/File:Lying_triceps_extension_with_dumbbells_1.svg) | Everkinetic (everkinetic.com) | CC BY-SA 3.0 | Sin modificar. Es una ilustración, no una foto: se ve distinta al resto del catálogo. |

## Ejercicios sin imagen libre (no se usó nada dudoso)

Se buscó en Wikimedia Commons y en Openverse (filtro de uso comercial). No hay una imagen libre y del ejercicio correcto para:

- `extension-muneca-barra`, `remo-yates`, `jalon-agarre-supino`, `fondos-asistidos-maquina`, `extension-triceps-polea-horizontal`: sin resultados útiles.
- `press-pecho-cable-sentado`, `press-declinado-maquina`: solo había fotos de un press de pecho plano en máquina, no el ejercicio exacto.
- `aperturas-inclinadas-polea`, `aperturas-inclinadas-maquina`: solo había cruces en polea planos y contractora (pec deck), que son otros ejercicios.

No se tomaron imágenes de sitios de fitness comerciales (Muscle & Strength, Bodybuilding.com, etc.).

Las imágenes anteriores del catálogo (`public/exercises/gifs/*.jpg`, 161 archivos) no tienen su licencia documentada en el repositorio; esa verificación sigue pendiente y no se hizo en esta tarea.
