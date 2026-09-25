# Exportación común a las figuras (se incluye con `# @include lib_export.py`). Requiere lib_stages.py incluida antes.
import os, time


def export_figure(blend_path, out_dir, name, clutter_kinds=("pop", "drop_small"), procedural_prefixes=None):
    """Abre `blend_path`, deja la escena en su estado final, normaliza el tiempo de cada clip a t=0 y exporta
    SOLO la colección STAGES (sin luces/cámaras/fondo) a GLB crudo, Meshopt y Draco."""
    bpy.ops.wm.open_mainfile(filepath=blend_path)
    scene = bpy.context.scene
    res = {}
    scene.frame_set(scene.frame_end)
    for o in bpy.data.objects:
        if o.get("vt_no_export"):
            o.hide_viewport = True
        for k in ("ant_landscape",):
            if k in o.keys():
                del o[k]
    # Piezas animadas en runtime (detalle): sin pista NLA.
    clutter = [o for o in bpy.data.objects if "vt_stage" in o.keys() and o["vt_anim"] in clutter_kinds]
    for o in clutter:
        if o.animation_data:
            o.animation_data_clear()
    res["procedural_objects"] = len(clutter)
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
                                    kp.co.x -= W(k)
                                    kp.handle_left.x -= W(k)
                                    kp.handle_right.x -= W(k)
                                fc.update()
                nm = st.name
                extrap = st.extrapolation
                tr.strips.remove(st)
                ns = tr.strips.new(nm, int(round(act.frame_range[0])), act)
                ns.extrapolation = extrap
                shifted += 1
    res["strips_rebased"] = shifted
    scene.frame_set(scene.frame_end)
    bpy.context.view_layer.update()

    def do_export(fname, extra):
        path = os.path.join(out_dir, fname)
        t = time.time()
        kw = dict(filepath=path, export_format="GLB", collection="STAGES", export_apply=True, export_yup=True,
                  export_extras=True, export_lights=False, export_cameras=False, export_materials="EXPORT",
                  export_animations=True, export_animation_mode="NLA_TRACKS", export_force_sampling=True,
                  export_optimize_animation_size=True, use_visible=True)
        kw.update(extra)
        r = bpy.ops.export_scene.gltf(**kw)
        res[fname] = {"op": list(r), "seconds": round(time.time() - t, 1), "mb": round(os.path.getsize(path) / 1e6, 3)}

    do_export(name + ".glb", {})
    do_export(name + "_meshopt.glb", {"export_meshopt_compression_enable": True})
    do_export(name + "_draco.glb", {"export_draco_mesh_compression_enable": True, "export_draco_mesh_compression_level": 6})
    return res
