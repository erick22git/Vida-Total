# Gemini Vision (Escáner de foto) — cómo activarlo

## Diagnóstico confirmado

El código en `src/app/api/food/analyze/route.ts` ya hace todo lo que se pidió:
identifica cada alimento por separado, estima gramos por referencias visuales,
devuelve JSON estricto (sin texto extra) con `name`/`estimatedGrams`/
`confidence`/`calories`/`protein`/`carbs`/`fat`, y ya distingue en la UI
(`src/app/(dashboard)/gym/calorias/escaner/page.tsx`) entre los 4 casos:
`no_api_key` ("Reconocimiento IA no disponible"), `rate_limit` ("Límite de
análisis alcanzado"), `network`/`timeout` ("Sin conexión" / "tardó demasiado")
y `unknown`. Cada uno con su propio mensaje y botón de acción (reintentar,
completar manualmente, o buscar manualmente).

**El único problema real es la API key.** Las dos veces que se probó, el
valor pegado en `GEMINI_API_KEY` tenía forma de token OAuth
(`AQ.Ab8RN6Kd...`), no de API key de AI Studio. Confirmado con una prueba en
vivo: Google devuelve `401 ACCESS_TOKEN_TYPE_UNSUPPORTED`, que la ruta ya
traduce a `no_api_key` (por eso el mensaje "no está configurada" — no es que
falte la variable, es que el valor no es del tipo correcto).

Una API key válida de Gemini/AI Studio **siempre empieza con `AIzaSy`**.

## Pasos para generar la key correcta

1. Entra a **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**
   con tu cuenta de Google (puede ser cualquier cuenta, no tiene que ser la
   misma con la que usas la app).
2. Click en **"Create API key"**.
3. Si te pregunta por un proyecto de Google Cloud, puedes dejar que cree uno
   nuevo automáticamente ("Create API key in new project") — no hace falta
   configurar nada más ahí.
4. Copia la key generada. Debe verse así: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
   (empieza con `AIzaSy`, ~39 caracteres en total).

## Dónde pegarla

Hacen falta **dos lugares distintos** — son independientes, pegarla en uno
no afecta al otro:

### 1. Local (`.env.local`)

Abre `.env.local` en la raíz del proyecto y reemplaza el valor de:

```
GEMINI_API_KEY=AIzaSy...tu_key_real_aqui
```

(Sin comillas, sin espacios. Si la línea no existe, agrégala.)

### 2. Vercel (producción)

1. Ve a [vercel.com](https://vercel.com) → tu proyecto **Vida Total**.
2. **Settings** → **Environment Variables**.
3. Busca `GEMINI_API_KEY` en la lista:
   - Si ya existe, click en los 3 puntos → **Edit** → pega el nuevo valor → **Save**.
   - Si no existe, **Add New** → Key: `GEMINI_API_KEY`, Value: la key → marca
     los 3 entornos (Production, Preview, Development) → **Save**.
4. **Importante:** cambiar una variable de entorno en Vercel **no** actualiza
   el sitio ya desplegado — hace falta un **Redeploy** (Deployments → el
   último deploy → menú "..." → **Redeploy**) para que el cambio tome efecto.

## Cómo confirmar que funcionó

Una vez pegada en ambos lugares (y redeployado en Vercel), abre el Escáner
en modo Foto y toma una foto de comida. Si sigue sin funcionar, avísame con
el mensaje EXACTO que aparece — con la key ya corregida, cualquier error que
quede sería uno nuevo, no el mismo de antes.
