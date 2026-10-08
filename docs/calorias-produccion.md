# Calorías: diagnóstico del fallo «solo en producción» y cómo reproducirlo

Síntoma reportado: en `/gym/calorias/editar/[id]`, en producción (vida-total.vercel.app) no se podía cambiar de página en la sección de nutrientes y no se veía el contenido; en local sí.

## Qué se comprobó

1. **¿Hay commits sin subir?** `git log origin/main..HEAD` estaba **vacío** antes de estos cambios: nada de lo anterior se quedó local, y la pantalla ya estaba en `main`. Producción sirve archivos de commits recientes (p. ej. `/ranks/zafiro-1-384.webp` → 200), así que los despliegues no están atascados.
2. **Reproducción con `next build` + `next start`** y datos sembrados (ver abajo), sin sesión real. La versión **anterior** de la pantalla en modo producción:
   - Cambiar de página **sí** funcionaba con un clic en los puntos y no daba errores de hidratación ni de consola.
   - Pero **no tenía deslizamiento vertical**: solo la rueda del ratón (`onWheel`) y puntos de 16 px. En una PC con ratón se ve «funciona»; en un teléfono, no hay rueda y los puntos son difíciles de acertar.
   - La página de micronutrientes tenía **14 filas o más** y no había alto máximo ni scroll (la pantalla es `fixed` con `overflow-hidden`): empujaba hacia abajo el anillo, los gramos y los botones, que quedaban fuera de la pantalla. Con los datos completos de USDA que hay en producción pasa; con los pocos datos de pruebas locales no.
3. **Otras causas posibles, descartadas en la build local:** variables de entorno (la pantalla no lee ninguna), `'use client'`/Suspense atascado (`loading.tsx` resolvió bien), redirecciones del proxy de sesión (con sesión de prueba entra directo) y errores de consola (ninguno).

## Qué se corrigió
- Bloque de nutrientes de **altura fija**, páginas por capacidad y **deslizamiento vertical** con `touch-action: none` (sin eso el navegador se queda con el gesto vertical y manda `pointercancel`). Detalle en el commit de la Fase 3.
- Se añadió `src/app/(dashboard)/gym/calorias/error.tsx`: si una pantalla de Calorías falla en el navegador, muestra «No se pudo mostrar esta pantalla» con «Reintentar» en vez de quedar en blanco, y registra solo el **nombre** del error y su `digest` (sin mensaje ni datos personales).

## Lo que no se pudo verificar
- Un **teléfono real** (el deslizamiento se probó con arrastre de ratón en el navegador integrado) y los **datos reales** del usuario en Supabase.
- Los **logs de Vercel**. Si el síntoma persiste con el despliegue nuevo, hace falta la consola y la pestaña *Network* del navegador del teléfono (o el `digest` que ahora se escribe en la consola al fallar).

## Cómo reproducir una build de producción sin sesión real
Todo ocurre en tu PC; usa un Supabase **falso** (`tools/dev/mock-supabase.cjs`, devuelve un usuario de prueba y listas vacías; no lleva ningún secreto).

```bash
node tools/dev/mock-supabase.cjs                                   # 1) Supabase falso en :54321
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next build
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next start -p 3100
```

2) Abre `http://localhost:3100/login` y pega esto en la consola (crea la cookie de sesión de prueba y siembra dos alimentos):

```js
const b64 = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const uid = "00000000-0000-4000-8000-000000000001", now = Math.floor(Date.now() / 1000);
const jwt = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: uid, aud: "authenticated", role: "authenticated", exp: now + 86400 }) + ".sig";
const user = { id: uid, aud: "authenticated", role: "authenticated", email: "prueba-local@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
document.cookie = "sb-localhost-auth-token=base64-" + b64({ access_token: jwt, token_type: "bearer", expires_in: 86400, expires_at: now + 86400, refresh_token: "r", user }) + "; path=/; max-age=86400";
localStorage.setItem("vida-total-uid", uid);
const ts = Date.now();
localStorage.setItem("vida-total-gym-store::" + uid, JSON.stringify({ version: 6, state: { loggedFoods: [
  { id: "e1", foodId: "arroz-blanco", nombre: "Arroz blanco", calorias: 130, proteina: 2.7, carbos: 28, grasas: 0.3, meal: "almuerzo", timestamp: ts, gramos: 100, cookedState: "cocido", activo: true },
  { id: "e2", foodId: "pechuga-pollo", nombre: "Pechuga de pollo", calorias: 165, proteina: 31, carbos: 0, grasas: 3.6, meal: "almuerzo", timestamp: ts + 1, gramos: 100, cookedState: "crudo", activo: true },
] } }));
location.href = "/gym/calorias/editar/arroz-blanco?meal=almuerzo&entryId=e1";
```

Notas: la primera carga reemplaza el estado sembrado con la respuesta vacía del Supabase falso (vuelve a pegar el bloque si ves «Agregar» en vez de «Actualizar»). Si el panel del navegador está en segundo plano, las animaciones (framer-motion) se quedan a medias hasta que se muestra.
