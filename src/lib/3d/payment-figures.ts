/**
 * Registro de figuras 3D seleccionables para la pantalla de pago. Hoy solo existe el árbol; para sumar otra (casa, molino…)
 * se agrega una entrada con su GLB y se elige con `figureId`. El contrato mínimo de un GLB es un nodo raíz con la figura
 * apoyada en y = 0; el resto (cámara, tamaño) se declara acá.
 */
export interface PaymentFigureDef {
  id: string;
  label: string;
  url: string;
  /** Altura aproximada de la figura (unidades del GLB) para encuadrar la cámara. */
  height: number;
  /** Punto (relativo a la base) hacia el que mira la cámara y hacia el que hace el acercamiento al tocarla. */
  focus: [number, number, number];
  /** Distancia de la cámara en reposo. */
  distance: number;
  /** Licencia / origen, para quien revise el repositorio (ver docs/3d/asset-registry.json). */
  license: string;
}

export const PAYMENT_FIGURES: Record<string, PaymentFigureDef> = {
  tree: {
    id: "tree",
    label: "Árbol",
    url: "/models/tree_payment_001_meshopt.glb",
    height: 4.2,
    focus: [0, 2.2, 0],
    distance: 9.6,
    license: "Obra propia: generado por tools/3d/blender/40_payment_tree.py",
  },
};

export const DEFAULT_PAYMENT_FIGURE = "tree";
