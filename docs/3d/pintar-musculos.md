# Pintar regiones musculares en Blender

Archivo de trabajo: `biblioteca de assets/rangos/trabajo/rangos_cuerpo_PINTAR.blend`

---

## Antes de abrir

- El archivo ya está en **Edit Mode → selección por caras → vista Solid con Color=Material**.
- La malla tiene **78 120 triángulos** (decimada desde ~651k).
- El original de alta resolución está en la colección oculta `HiRes_ORIGINAL`.
- Hay un normal map de 2048×2048 horneado del hi-res al lo-res, empaquetado en el .blend.

---

## Materiales disponibles

| Material             | Color viewport |
|----------------------|----------------|
| RG_pecho             | rojo           |
| RG_hombros           | naranja        |
| RG_biceps            | amarillo       |
| RG_triceps           | verde          |
| RG_antebrazo         | cian           |
| RG_abdomen           | azul           |
| RG_espalda           | índigo         |
| RG_cuello_trapecio   | morado         |
| RG_gluteos           | rosa           |
| RG_cuadriceps        | lima           |
| RG_femoral           | marrón         |
| RG_aductores         | cian claro     |
| RG_abductores        | ámbar          |
| RG_pantorrilla       | naranja oscuro |
| RG_base              | gris (base)    |

Todas las caras empiezan asignadas a **RG_base**. Pinta encima.

---

## Flujo de pintura

### 1. Abrir el archivo
```
Archivo → Abrir → rangos_cuerpo_PINTAR.blend
```
Ya entra en Edit Mode con selección de caras.

### 2. Seleccionar caras de una región

| Acción | Atajo |
|--------|-------|
| Click simple cara | `Click izquierdo` |
| Añadir cara a selección | `Shift+Click` |
| Seleccionar conectadas (útil para un músculo completo) | `L` sobre la cara |
| Caja de selección | `B` |
| Lazo | `Ctrl+Click arrastrar` |
| Seleccionar todo / nada | `A` |
| Seleccionar por ángulo (para zonas planas) | `Shift+G → Normal` |

Tip: activa **Radiografía** (`Alt+Z`) para seleccionar caras de la cara posterior sin rotar la vista.

### 3. Asignar material

1. En el panel de **Propiedades → Materiales** (icono esfera), selecciona el material de la región (ej. `RG_pecho`).
2. Clic en **Asignar** (botón bajo la lista).
3. La cara cambia de color inmediatamente en la vista.

Atajo rápido: abre el menú **Material** con `F3` → escribe "asignar" → aparece "Assign Material Slot".

### 4. Pintar solo un lado

Pinta **un solo lado** (derecho o izquierdo — el que prefieras). Al terminar usa el script `espejar_materiales` para copiar al otro lado automáticamente.

### 5. Espejar al terminar un músculo (o al final)

1. Ve a **Editor de Texto** (`Shift+F11` o cambia el tipo de área).
2. Selecciona el texto `espejar_materiales` en el menú desplegable.
3. Pulsa `Alt+P` para ejecutar.
4. El script detecta qué lado tiene más caras pintadas y copia al otro.
   - No sobrescribe caras ya pintadas en el destino.

### 6. Referencia visual

Las imágenes de control están en la misma carpeta:
- `control_frente.png` — vista frontal con colores de material
- `control_espalda.png` — vista posterior

---

## Atajos de viewport útiles

| Acción | Atajo |
|--------|-------|
| Rotar vista | `Click medio arrastrar` |
| Hacer zoom | `Rueda ratón` |
| Vista frente | `Numpad 1` |
| Vista espalda | `Ctrl+Numpad 1` |
| Vista lateral | `Numpad 3` |
| Vista superior | `Numpad 7` |
| Centrar en selección | `Numpad punto .` |
| Alternar radiografía | `Alt+Z` |
| Guardar | `Ctrl+S` |

---

## Al terminar

Cuando hayas pintado todas las regiones, dile al asistente: **"terminé de pintar"**

El asistente ejecutará la parte C:
1. Espejará los materiales al lado sin pintar (si no lo hiciste manualmente).
2. Validará que cada región tenga caras asignadas.
3. Exportará el GLB con Meshopt para la app.

---

## Notas técnicas

- **No muevas ni reescales el mesh** — el bake de normales está alineado a la posición actual.
- Si cierras sin guardar, al reabrir Blender preguntará si restaurar — di que sí.
- El script `espejar_materiales` es idempotente: puedes ejecutarlo varias veces, no duplica trabajo.
