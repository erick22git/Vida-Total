/**
 * Registro de figuras 3D seleccionables para la pantalla de pago. Hoy solo existe el árbol; para sumar otra (casa, molino…)
 * se agrega una entrada con su GLB y se elige con `figureId`. Contrato mínimo del GLB: nodo raíz con la figura apoyada en y = 0,
 * Y arriba. Los nodos hijos llamados `lobe_*` (si existen) se mecen con el viento (cada uno rota alrededor de su propio origen).
 * El piso NO viene en el GLB: la escena lo arma desde la matriz del QR (ver `payment-scene.ts`), así se adapta al tamaño real.
 */
export interface PaymentFigureDef {
  id: string;
  label: string;
  url: string;
  /** Matas de pasto (variantes `tuft_*`) que se instancian en los bordes del piso. */
  grassUrl: string;
  /** Ancho de la copa/figura en las unidades del GLB, para escalarla al tablero. */
  width: number;
  /** Alto aproximado de la figura (unidades del GLB), para encuadrar la cámara. */
  height: number;
  /** Licencia / origen, para quien revise el repositorio (ver docs/3d/asset-registry.json). */
  license: string;
}

export const PAYMENT_FIGURES: Record<string, PaymentFigureDef> = {
  tree: {
    id: "tree",
    label: "Árbol",
    url: "/models/tree_payment_002_meshopt.glb",
    grassUrl: "/models/grass_tuft_payment_001_meshopt.glb",
    width: 5.6,
    height: 5.9,
    license: "Obra propia: generado con Blender 5.2 por tools/3d/blender/42_payment_tree_v2.py y 43_payment_grass.py",
  },
};

export const DEFAULT_PAYMENT_FIGURE = "tree";
