import bpy, os, time, json
DST = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\landscape_progression_prototype.blend"
OUT = r"C:\Erick\app movil\vida-total-web\biblioteca de assets\_trabajo\export"
bpy.ops.wm.open_mainfile(filepath=DST)
res = {}

def W(k): return 1 + 44 * (k - 1)

# 1) El volumen del agua no viaja a GLB.
cube = bpy.data.objects.get("Cube")
if cube:
    cube["vt_no_export"] = True
    cube.hide_viewport = True

# 2) Propiedades personalizadas basura de otros addons.
for o in bpy.data.objects:
    for k in ("ant_landscape",):
        if k in o.keys():
            del o[k]
for m in bpy.data.meshes:
    for k in ("ant_landscape",):
        if k in m.keys():
            del m[k]

# 3) El detalle instanciado (pasto/guijarros/ramitas) se anima en runtime: sin pista NLA.
clutter = [o for o in bpy.data.objects if "vt_stage" in o.keys() and o["vt_anim"] in ("pop", "drop_small") and o.name.startswith(("Grass", "rock", "Vert"))]
for o in clutter:
    if o.animation_data:
        o.animation_data_clear()
res["clutter_without_clip"] = len(clutter)

# 4) Normalizar tiempo: cada clip STAGE_k empieza en t=0. Se desplazan las CLAVES de la acción (no la tira NLA):
#    el exportador muestrea usando los tiempos de la propia acción.
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
            ns.extrapolation = "HOLD"
            shifted += 1
res["strips_rebased"] = shifted

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

do_export("landscape_bosque_001.glb", {})
do_export("landscape_bosque_001_meshopt.glb", {"export_meshopt_compression_enable": True})
do_export("landscape_bosque_001_draco.glb", {"export_draco_mesh_compression_enable": True, "export_draco_mesh_compression_level": 6})
result = res
