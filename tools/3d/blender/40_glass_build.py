# VASO DE AGUA (Gym/Agua) — solo el VASO. Trabaja sobre la COPIA (`originales_copia/vaso de agua.blend`), nunca el original.
# Del archivo original se conserva únicamente `Circle` (el vaso; era un efector de la simulación de fluido). Se descartan la simulación,
# la caja de dominio de 160 mil triángulos, el suelo, el fondo, las piedras y las esferas. El AGUA no viene del original: es una pieza propia
# generada en runtime (src/lib/3d/water-glass.ts) que sube y ondula según el dato de agua del día. El perfil interior del vaso se guarda como
# propiedad `vt_profile` del nodo para que el agua encaje.
# Licencia/origen: UNVERIFIED (BlendSwap "Glass of Water" según el dueño; la página no se ha revisado; el archivo no trae texto de licencia).
# @include lib_stages.py
import os, time
bpy.ops.wm.open_mainfile(filepath="C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/originales_copia/vaso de agua.blend")
include_everything()
bpy.context.view_layer.update()
O = bpy.data.objects
g = O["Circle"]
for o in list(O):
    if o is not g:
        bpy.data.objects.remove(o, do_unlink=True)
for m in list(g.modifiers):
    if m.type == "FLUID":
        g.modifiers.remove(m)
    elif m.type == "SUBSURF":
        m.levels = 1
        m.render_levels = 1
apply_modifiers(g)
g.data.transform(g.matrix_basis)
g.matrix_basis = Matrix.Identity(4)
vs = [v.co for v in g.data.vertices]
zmin, zmax = min(v.z for v in vs), max(v.z for v in vs)
K = 2.0 / (zmax - zmin)                      # el vaso mide 2 unidades de alto
g.data.transform(Matrix.Scale(K, 4))
for p in g.data.polygons:
    p.use_smooth = True
vs = [v.co for v in g.data.vertices]
# radio exterior por altura (máximo por franja) → recta r = r0 + s·z ; interior = exterior − pared
bins = {}
for v in vs:
    bins.setdefault(round(v.z / 0.1), []).append(math.hypot(v.x, v.y))
pts = [(k * 0.1, max(r)) for k, r in sorted(bins.items()) if max(r) > 0.2]
n = len(pts)
sx = sum(p[0] for p in pts); sy = sum(p[1] for p in pts); sxx = sum(p[0] ** 2 for p in pts); sxy = sum(p[0] * p[1] for p in pts)
slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
r0 = (sy - slope * sx) / n
maxdev = max(abs(r - (r0 + slope * z)) for z, r in pts)
wall = 0.03
# el fondo interior: primera altura con radio > 0.2 más el grosor de la base
floor_z = 0.12
prof = {"floorZ": round(floor_z, 3), "topZ": round(zmax * K - zmin * K - 0.02, 3), "rOuter0": round(r0, 4), "slope": round(slope, 4), "wall": wall, "maxDev": round(maxdev, 4)}
g.name = "glass"
g["vt_profile"] = json.dumps(prof)
g["vt_role"] = "glass"
g.data.materials.clear()
g.data.materials.append(flat_mat("VT_Glass", (0.85, 0.93, 1.0), 0.05, alpha=0.3))
report = {"profile": prof, "tris": sum(len(p.vertices) - 2 for p in g.data.polygons), "height": [round(min(v.z for v in vs), 3), round(max(v.z for v in vs), 3)]}
out = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/export/water_glass_001"
bpy.ops.wm.save_as_mainfile(filepath="C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/water_glass.blend")
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
