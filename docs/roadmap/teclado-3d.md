# Roadmap: teclado 3D propio

Estado: **solo documentado, NO implementado.** No hay código de app ni de Blender en este paso.

## Requisito

Un teclado propio, hecho en Blender con animaciones 3D, que reemplace al del sistema en las pantallas de Calorías (y luego donde convenga), en **tres variantes**:

1. **Letras** (solo alfabeto, espacio, borrar, enter).
2. **Letras y números** (alfabeto + fila numérica / cambio de capa).
3. **Solo números** (para cantidades como gramos: dígitos, coma/punto, borrar, confirmar).

Comportamiento exigido:
- **Sube como un teclado normal** (desde abajo, animado), y baja igual al terminar.
- **Sin zoom y sin distorsión** de la página al abrirse.
- **No ocupa una página completa**: es una hoja inferior, y el contenido de arriba sigue visible y usable (en Buscar, el carrusel debe quedar por encima, igual que hoy con el teclado del sistema).
- Teclas con animación 3D de pulsación; el estilo visual sale de Blender (mismo flujo GLB que el resto del proyecto).

## Lo que ya existe y se reutiliza

- `useKeyboardInset` (`src/lib/ui/use-keyboard-inset.ts`) publica `--vv-h/--vv-top/--kb-h` con el teclado del sistema. Un teclado propio debe publicar **las mismas variables** (con su propia altura) para que Buscar y las demás pantallas no cambien.
- `GramsKeypadSheet` y `NumericKeypad` (`src/components/gym/`) ya son teclados numéricos propios en 2D: son el punto de partida de la variante "solo números".
- Pipeline 3D: Blender → GLB con Meshopt (ver `tools/3d/blender/` y `docs/3d/`).

## Implicaciones técnicas

### 1. Inputs sin teclado del sistema
- Los campos que usen el teclado propio llevan `inputMode="none"` (o `readOnly`) para que el sistema **no** abra el suyo. Con `readOnly` iOS no muestra caret ni deja seleccionar de forma natural; con `inputMode="none"` el caret se mantiene pero hay diferencias entre iOS y Android (probar en ambos; en algunos Android antiguos `inputMode="none"` no se respeta).
- Hay que **evitar que el foco dispare el zoom de iOS**: sigue valiendo la regla de 16 px o más en cualquier input, aunque no abra el teclado.
- Nunca `maximum-scale` ni `user-scalable=no` (se bloquea el zoom del usuario; es un problema de accesibilidad).

### 2. Cursor y edición a mano
- Se pierde la gestión nativa de cursor, selección, doble toque para seleccionar palabra y arrastre de selección. Hay que implementar: posición del cursor, inserción/borrado en el medio, selección por toque largo y mantener-para-repetir en borrar.
- Soporte de composición (IME): un teclado propio no la tiene. Solo servirá para el alfabeto latino directo.

### 3. Se pierde lo que da el teclado del sistema
- **Autocorrección, sugerencias y predicción**: no existen. (Para búsqueda de alimentos no importa: el resolvedor ya tolera errores de tipeo.)
- **Dictado por voz del teclado**: desaparece; ya existe la pantalla Voz como alternativa.
- **Gestor de contraseñas / autocompletado**: no aplica a estos campos; **no usar el teclado propio en login ni en campos sensibles**.
- **Emojis, otros idiomas, teclado de accesibilidad** (Switch Control, teclados braille): no disponibles.

### 4. Accesibilidad
- Cada tecla debe ser un botón real con `aria-label`, orden de tabulación lógico, objetivo táctil ≥ 44 px y soporte de lector de pantalla (VoiceOver/TalkBack); una escena 3D en `<canvas>` por sí sola **no** es accesible.
- Recomendación: la capa interactiva es **HTML/CSS** (botones reales) y el 3D es solo presentación/animación detrás o encima; así el teclado sigue siendo operable con tecnología asistiva y teclado físico.
- Respetar `prefers-reduced-motion` (`usePreferencesStore.reduceMotion`): sin animación de subida/pulsación si está activo.
- Con teclado físico conectado, debe poder escribirse normalmente (no bloquear `keydown`).

### 5. Texto especial
- **ñ y tildes**: deben estar en la variante de letras (ñ como tecla propia; tildes con mantener-pulsado sobre la vocal o tecla muerta). Los datos están normalizados sin tildes, pero el texto que ve y guarda el usuario no.
- Mayúsculas: tecla de mayúscula (toque = una letra, doble toque = fijar), y mayúscula automática al inicio si el campo lo pide.
- **Pegar texto**: sin menú nativo no hay "Pegar". Hay que ofrecer un botón propio (lee `navigator.clipboard.readText()`, requiere permiso/gesto en iOS) o aceptar pegar solo en campos donde se permita.
- Separador decimal según idioma (coma/punto) en la variante numérica.

### 6. Rendimiento en móvil
- Un `<canvas>` WebGL con three.js sube el costo: más memoria, batería y riesgo de caída de cuadros justo al escribir (donde la latencia se nota más). La app ya carga three.js en otras pantallas (calibre, agua, rango); este teclado no debe sumar otra escena pesada.
- Presupuesto sugerido: GLB del teclado < 300 KB (Meshopt), una sola malla instanciada por tecla, texturas pequeñas, **sin sombras en tiempo real ni post-proceso**.
- Cargarlo en diferido (`dynamic import`), crear el contexto WebGL **una sola vez** y reutilizarlo entre pantallas, y pausar el render cuando está oculto.
- Fallback: si WebGL falla, el dispositivo es de gama baja o `reduceMotion` está activo → teclado 2D con las mismas variantes (HTML/CSS).
- Medir antes de adoptar: latencia pulsación→letra (objetivo < 50 ms), FPS al escribir rápido y consumo en un teléfono de gama media.

### 7. Integración con el layout
- La hoja inferior debe empujar el contenido igual que el teclado del sistema: publicar `--kb-h`/`--vv-h` y ocupar solo su altura.
- iOS: al no abrirse el teclado del sistema no hay `visualViewport` que cambie; el propio teclado debe ser quien actualice las variables.
- Evitar que el navegador haga scroll para "mostrar" el input enfocado: el contenedor ya es `fixed` y de la altura visible.
- Gestos de sistema (barra de inicio de iOS, gesto atrás de Android) no deben chocar con las teclas de los bordes: margen seguro `env(safe-area-inset-bottom)`.

## Plan por fases (cuando se decida hacerlo)

1. **Prototipo 2D de las 3 variantes** en HTML/CSS (sin 3D) para fijar layout, cursor, ñ/tildes, pegar y accesibilidad. Probar en iPhone y Android.
2. **Contrato de altura**: que publique las mismas variables CSS que `useKeyboardInset`.
3. **Modelo en Blender**: teclas con animación de pulsación, exportación GLB/Meshopt, presupuesto de peso.
4. **Render 3D como capa de presentación** sobre los botones reales, con fallback 2D.
5. **Medición en dispositivo** (latencia, FPS, batería) y decisión de adoptar o no.
6. **Despliegue gradual**: primero la variante numérica (gramos), luego letras y números.

## Riesgos principales

- Perder funciones del teclado del sistema que el usuario da por sentadas (pegar, dictado, autocorrección).
- Accesibilidad (un canvas no es accesible por sí solo).
- Rendimiento y batería en gama baja.
- Comportamiento distinto de `inputMode="none"` entre navegadores.
- Mantener dos teclados (3D y fallback 2D) sincronizados.

## Decisión recomendada (mía)

Empezar por la **variante numérica** (gramos): es donde más ayuda un teclado propio y donde casi no se pierde nada, y el `GramsKeypadSheet` ya existe. Dejar el teclado de letras para después de medir.
