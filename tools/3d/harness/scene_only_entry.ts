import { ProgressiveSceneRenderer } from "C:/Erick/app movil/vida-total-web/src/lib/3d/progressive-scene";
import { FOREST_SCENE } from "C:/Erick/app movil/vida-total-web/src/lib/3d/scene-registry";
const w = window as any;
w.VT = {
  rs: [] as ProgressiveSceneRenderer[],
  async initBoth(opts: { glb: string; reduceMotion?: boolean }) {
    const asset = { ...FOREST_SCENE, glbUrl: opts.glb };
    const out: any[] = [];
    for (const id of ["light", "dark"]) {
      const r = new ProgressiveSceneRenderer(document.getElementById(id)!, asset, { reduceMotion: !!opts.reduceMotion });
      await r.load();
      r.setStage(0);
      r.start();
      this.rs.push(r);
      out.push(r.stats());
    }
    return out;
  },
  setStage(n: number, animate = true) { this.rs.forEach((r: ProgressiveSceneRenderer) => r.setStage(n, { animate })); },
  stats() { return this.rs[0].stats(); },
};
