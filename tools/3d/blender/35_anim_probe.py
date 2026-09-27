# Sonda (sin render): instancias de partículas y bbox evaluado del océano en Island Animation. Solo lectura.
# @include lib_stages.py
bpy.ops.wm.open_mainfile(filepath="__SRC__")
include_everything()
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
cnt = {}
sample = {}
for inst in dg.object_instances:
    if inst.is_instance and inst.particle_system is not None:
        n = inst.object.original.name
        cnt[n] = cnt.get(n, 0) + 1
        if n not in sample:
            m = inst.matrix_world
            sample[n] = [[round(v, 2) for v in m.translation], [round(v, 2) for v in m.to_scale()]]
        sample.setdefault(n + "_emitters", set()).add(inst.parent.name if inst.parent else None)
sample = {k: (sorted(v, key=str) if isinstance(v, set) else v) for k, v in sample.items()}
oc = bpy.data.objects["Plane.002"]
ev = oc.evaluated_get(dg)
me = ev.to_mesh()
res = {"instances": cnt, "sample": sample, "ocean_polys": len(me.polygons), "ocean_tris": sum(len(p.vertices) - 2 for p in me.polygons)}
zs = [v.co.z for v in me.vertices]
xs = [ (oc.matrix_world @ v.co).x for v in me.vertices]; ys = [(oc.matrix_world @ v.co).y for v in me.vertices]
res["ocean_bbox"] = [round(min(xs), 1), round(max(xs), 1), round(min(ys), 1), round(max(ys), 1), round(min(zs), 2), round(max(zs), 2)]
res["ocean_loc"] = [round(v, 1) for v in oc.matrix_world.translation]
res["ocean_scale"] = [round(v, 2) for v in oc.scale]
m = oc.modifiers["Ocean"] if "Ocean" in oc.modifiers else oc.modifiers[0]
res["ocean_mod"] = {k: getattr(m, k) for k in ("resolution", "spatial_size", "wave_scale", "choppiness", "time", "repeat_x", "repeat_y", "geometry_mode") if hasattr(m, k)}
ev.to_mesh_clear()
res["images"] = [(i.name, i.size[0], i.size[1]) for i in bpy.data.images if i.size[0] > 1024][:20]
# tris por plantilla original
res["templates"] = {n: sum(len(p.vertices) - 2 for p in bpy.data.objects[n].data.polygons) for n in ("Cottenwood Tree", "Palm Tree", "Rush")}
result = res
