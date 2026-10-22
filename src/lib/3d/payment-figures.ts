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
  /** Hojas sueltas (`leaf_0..2`) que la app instancia sobre un punto por módulo oscuro de la matriz del QR: ESA es la copa. */
  leavesUrl?: string;
  /** Matas de pasto (variantes `tuft_*`) que se instancian en los bordes del piso. */
  grassUrl: string;
  /** Ancho de la figura (informativo: el tronco va a escala real de la escena, no se reescala). */
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
    url: "/models/bonsai_tree_payment_001_meshopt.glb",
    grassUrl: "/models/grass_tuft_payment_002_meshopt.glb",
    width: 6.5,
    height: 5.8,
    license: "Obra propia: árbol del Bonsai.blend (tools/3d/blender qr) por tools/3d/blender/49_payment_bonsai_tree.py y pasto por 48_payment_grass_from_bonsai.py",
  },
};

export const DEFAULT_PAYMENT_FIGURE = "tree";
