# VASO (Gym/Agua) v2 — usa el VASO PEQUEÑO de `originales_copia/vaso.blend` (el que puso el dueño el 2026-09-26): de las tres copas/vasos del
# archivo solo se conserva `Circle.004` (el vaso corto y ancho con base acanalada). Se descartan las dos copas de pie (Circle/Circle.001 y
# Circle.002/Circle.003), el líquido de muestra (Circle.005), los cubos de hielo (Cube, Cube.001) y las 3 esferas de burbujas. Trabaja sobre la
# COPIA, nunca el original. El vaso se ALARGA un 30 % en altura (pedido del dueño) y se normaliza a 2 unidades de alto.
# El AGUA no viene del original: se genera en runtime (src/lib/3d/water-glass.ts). El perfil INTERIOR real del vaso se mide aquí y se guarda como
# tabla en la propiedad `vt_profile` del nodo, para que el agua encaje exacto en el vaso.
# Licencia/origen: UNVERIFIED (sin texto de licencia en el archivo; origen no declarado).
# @include lib_stages.py
import os
bpy.ops.wm.open_mainfile(filepath="C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/vaso.blend")
include_everything()
bpy.context.view_layer.update()
O = bpy.data.objects
g = O["Circle.004"]
for o in list(O):
    if o is not g:
        bpy.data.objects.remove(o, do_unlink=True)
for m in list(g.modifiers):
    if m.type == "SUBSURF":
        m.levels = 1
        m.render_levels = 1
apply_modifiers(g)
g.data.transform(g.matrix_basis)
g.matrix_basis = Matrix.Identity(4)
vs = [v.co.copy() for v in g.data.vertices]
cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
cy = (min(v.y for v in vs) + max(v.y for v in vs)) / 2
zmin = min(v.z for v in vs)
g.data.transform(Matrix.Translation((-cx, -cy, -zmin)))
STRETCH = 1.3
g.data.transform(Matrix.Diagonal((1.0, 1.0, STRETCH, 1.0)))
zmax = max(v.co.z for v in g.data.vertices)
K = 2.0 / zmax
g.data.transform(Matrix.Scale(K, 4))
for p in g.data.polygons:
    p.use_smooth = True
vs = [v.co.copy() for v in g.data.vertices]
H = max(v.z for v in vs)
rmax = max(math.hypot(v.x, v.y) for v in vs)
# suelo interior: segunda altura distinta de los vértices cercanos al eje (la primera es el fondo exterior)
axis_z = sorted({round(v.z, 3) for v in vs if math.hypot(v.x, v.y) < 0.15})
floor_z = axis_z[1] if len(axis_z) > 1 else 0.15
# radio interior por altura: mínimo radio de la pared (vértices con r > 0.5·rmax) en cada franja de 0.04
BIN = 0.04
inner = {}
for v in vs:
    r = math.hypot(v.x, v.y)
    if v.z > floor_z + 0.005 and r > 0.5 * rmax * 0.6:
        k = round(v.z / BIN)
        inner[k] = min(inner.get(k, 9), r)
table = []
for k in sorted(inner):
    z = k * BIN
    if z >= floor_z and z <= H - 0.02:
        table.append([round(z, 3), round(inner[k], 4)])
# el borde superior queda ~0.02 por debajo del labio
# suavizado (media móvil de 3) para que el agua no herede el ruido de la malla
sm = []
for i, (z, r) in enumerate(table):
    a = [table[j][1] for j in range(max(0, i - 1), min(len(table), i + 2))]
    sm.append([z, round(sum(a) / len(a), 4)])
prof = {"floorZ": round(floor_z, 3), "topZ": round(H - 0.03, 3), "inner": sm, "height": round(H, 3), "rMax": round(rmax, 3)}
g.name = "glass"
g["vt_profile"] = json.dumps(prof)
g["vt_role"] = "glass"
g.data.materials.clear()
g.data.materials.append(flat_mat("VT_Glass", (0.85, 0.93, 1.0), 0.05, alpha=0.3))
report = {"tris": sum(len(p.vertices) - 2 for p in g.data.polygons), "height": round(H, 3), "rMax": round(rmax, 3), "floorZ": prof["floorZ"],
          "inner_first": sm[:3], "inner_last": sm[-3:], "inner_points": len(sm), "K": round(K, 4)}
out = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/export/water_glass_002"
bpy.ops.wm.save_as_mainfile(filepath="C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/water_glass2.blend")
for o in bpy.context.view_layer.objects:
    o.select_set(False)
g.select_set(True)
wins = list(bpy.context.window_manager.windows)
res = {}
for suffix, extra in (("", {}), ("_meshopt", {"export_meshopt_compression_enable": True})):
    kw = dict(filepath=out + suffix + ".glb", export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_extras=True,
              export_lights=False, export_cameras=False, export_materials="EXPORT", export_animations=False)
    kw.update(extra)
    with bpy.context.temp_override(window=wins[0] if wins else None, active_object=g, selected_objects=[g], selected_editable_objects=[g]):
        bpy.ops.export_scene.gltf(**kw)
    res[suffix or "raw"] = round(os.path.getsize(out + suffix + ".glb") / 1e6, 4)
report["glb_mb"] = res
result = report
