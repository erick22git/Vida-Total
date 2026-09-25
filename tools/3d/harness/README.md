# Harness de verificación en navegador

Sirve para probar la escena y la página real de Hábitos en un Chromium con WebGL **sin iniciar sesión** (la app real exige login).

- `scene_only_entry.ts`: solo `ProgressiveSceneRenderer` en dos paneles (fondo claro/oscuro) → verifica transparencia y draw calls.
- `app_entry.tsx`: monta la **página real** `habitos/habito/page.tsx`; `next-navigation-stub.ts` reemplaza `next/navigation`.
- `build_css.mjs`: genera el CSS de Tailwind (copiar a la raíz del proyecto para que resuelva `postcss`, ejecutar y borrar).
- `serve.mjs <carpeta> <carpeta de modelos>`: servidor estático (puerto 4174).

Pasos (desde la raíz del proyecto; los archivos se copian a una carpeta temporal DENTRO del proyecto para que resuelvan `node_modules`):
```
mkdir .harness_tmp && copy app_entry.tsx + next-navigation-stub.ts  .harness_tmp\   (renombrar app_entry.tsx → entry.tsx)
node_modules\.bin\esbuild .harness_tmp\entry.tsx --bundle --format=iife --outfile=<salida>\entry.js ^
   --tsconfig=tsconfig.json --alias:next/navigation=./.harness_tmp/next-navigation-stub.ts ^
   --define:process.env.NODE_ENV="\"development\"" --loader:.webp=dataurl
```
Abrir `http://localhost:4174/?id=h-agua&debug3d=1`. Borrar `.harness_tmp` al terminar. Las rutas dentro de los archivos son las de esta máquina.
