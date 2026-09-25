"""Exporta la figura del bosque a GLB: SOLO la colección STAGES (sin luces, cámaras, fondo ni niebla).
Un clip por día (STAGE_1..STAGE_7), normalizado para empezar en t = 0. El detalle repetitivo (pasto, guijarros,
ramitas) NO lleva clip: el runtime lo anima con las propiedades vt_anim / vt_delay_frames.
No guarda el .blend (modifica la escena solo en memoria para exportar)."""
import bpy, os, time
DST = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\landscape_progression_prototype.blend"
OUT = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\export"
NAME = "forest_progression_001"
bpy.ops.wm.open_mainfile(filepath=DST)
res = {}
scene = bpy.context.scene
# Las transformaciones base de cada nodo del GLB son las evaluadas en el fotograma actual: hay que exportar
# con la escena en su ESTADO FINAL (todo construido); los clips llevan la construcción.
scene.frame_set(scene.frame_end)
def W(k): return 1 + 44 * (k - 1)

cube = bpy.data.objects.get("Cube")          # volumen del agua: no exportable
if cube:
    cube.hide_viewport = True
for o in bpy.data.objects:                   # ruido de otros addons
    if "ant_landscape" in o.keys():
        del o["ant_landscape"]

clutter = [o for o in bpy.data.objects if "vt_stage" in o.keys() and o["vt_anim"] in ("pop", "drop_small")]
for o in clutter:
    if o.animation_data:
        o.animation_data_clear()
res["clutter_without_clip"] = len(clutter)

shifted = 0
for o in bpy.data.objects:
    ad = o.animation_data
    if not ad:
        continue
    for tr in ad.nla_tracks:
        if not tr.name.startswith("STAGE_"):
            continue
        k = int(tr.name.split("_")[1])
        for st in list(tr.strips):
            act = st.action
            for layer in act.layers:
                for lstrip in layer.strips:
                    for cb in lstrip.channelbags:
                        for fc in cb.fcurves:
                            for kp in fc.keyframe_points:
                                kp.co.x -= W(k); kp.handle_left.x -= W(k); kp.handle_right.x -= W(k)
                            fc.update()
            name = st.name
            tr.strips.remove(st)
            ns = tr.strips.new(name, int(round(act.frame_range[0])), act)
            ns.extrapolation = "HOLD_FORWARD" if k == 7 and o.name == "Ground" else "HOLD"
            shifted += 1
res["strips_rebased"] = shifted
scene.frame_set(scene.frame_end)
bpy.context.view_layer.update()

def do_export(name, extra):
    path = os.path.join(OUT, name)
    t = time.time()
    kw = dict(filepath=path, export_format="GLB", collection="STAGES", export_apply=True, export_yup=True,
              export_extras=True, export_lights=False, export_cameras=False, export_materials="EXPORT",
              export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
              export_optimize_animation_size=True, use_visible=True)
    kw.update(extra)
    r = bpy.ops.export_scene.gltf(**kw)
    res[name] = {"op": list(r), "seconds": round(time.time() - t, 1), "mb": round(os.path.getsize(path) / 1e6, 3)}

do_export(NAME + ".glb", {})
do_export(NAME + "_meshopt.glb", {"export_meshopt_compression_enable": True})
do_export(NAME + "_draco.glb", {"export_draco_mesh_compression_enable": True, "export_draco_mesh_compression_level": 6})
result = res
