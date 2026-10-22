"""
Renderiza el modelo decimado en gris con cuadrícula (Y, Z).
Frente del modelo = +X. Simetría en Y=0. Brazos a lo largo de ±Y.
  blender -b --python tools/3d/blender/70c_render_grid.py
"""
import bpy, math, os
from mathutils import Vector

SRC        = "C:/Erick/app movil/vida-total-web/biblioteca de assets/rangos/HumanBaseMale.blend"
OUT_DIR    = "C:/Erick/app movil/vida-total-web/biblioteca de assets/_trabajo/export/"
os.makedirs(OUT_DIR, exist_ok=True)

# ── FASE 1: recopilar geometría decimada + huesos ─────────────────────────────
bpy.ops.wm.open_mainfile(filepath=SRC)
body    = bpy.data.objects["MaleBASE"]
arm_obj = bpy.data.objects["Armature"]

for m in list(body.modifiers):
    if m.type == "DATA_TRANSFER":
        body.modifiers.remove(m)
dec = body.modifiers.new("Dec", "DECIMATE")
dec.ratio = 0.065
dec.use_collapse_triangulate = True
bpy.context.view_layer.update()

dg   = bpy.context.evaluated_depsgraph_get()
ev   = body.evaluated_get(dg)
me_d = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=False, depsgraph=dg)
mw   = body.matrix_world
verts_raw = [(mw @ v.co).to_tuple() for v in me_d.vertices]
polys_raw = [tuple(p.vertices) for p in me_d.polygons]

bw = arm_obj.matrix_world
bone_data = {}
for bone in arm_obj.data.bones:
    h = bw @ bone.head_local
    t = bw @ bone.tail_local
    bone_data[bone.name] = (h.to_tuple(), t.to_tuple())

# Centrar: pies en z=0, centrado en Y
zmin = min(v[2] for v in verts_raw)
cy   = sum(v[1] for v in verts_raw) / len(verts_raw)
verts_c = [(v[0], v[1] - cy, v[2] - zmin) for v in verts_raw]
zmax = max(v[2] for v in verts_c)
zmid = zmax / 2
# Corregir huesos también
bone_data_c = {name: (
    (h[0], h[1] - cy, h[2] - zmin),
    (t[0], t[1] - cy, t[2] - zmin)
) for name, (h, t) in bone_data.items()}

# Impresión de coordenadas clave
print(f"##BODY Y=[{min(v[1] for v in verts_c):.3f}, {max(v[1] for v in verts_c):.3f}]  Z=[0, {zmax:.3f}]")
for bname in sorted(bone_data_c):
    bh, bt = bone_data_c[bname]
    print(f"##B {bname:<16} Y={bh[1]:+.3f} Z={bh[2]:+.3f}  ->  Y={bt[1]:+.3f} Z={bt[2]:+.3f}")

# ── FASE 2: construir escena nueva ───────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col   = bpy.data.collections.new("RENDER")
scene.collection.children.link(col)

# Malla del cuerpo (gris)
me = bpy.data.meshes.new("body")
me.from_pydata(verts_c, [], polys_raw)
me.update()
mat = bpy.data.materials.new("grey")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.5, 0.5, 0.5, 1)
bsdf.inputs["Roughness"].default_value  = 0.85
me.materials.append(mat)
ob = bpy.data.objects.new("body", me)
col.objects.link(ob)

def add_line(p0, p1, name, r, g, b):
    gme = bpy.data.meshes.new(name)
    gme.from_pydata([p0, p1], [(0, 1)], [])
    gme.update()
    gob = bpy.data.objects.new(name, gme)
    col.objects.link(gob)
    gmat = bpy.data.materials.new(name + "_m")
    gmat.use_nodes = True
    emit = gmat.node_tree.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value    = (r, g, b, 1)
    emit.inputs["Strength"].default_value = 4.0
    out = gmat.node_tree.nodes["Material Output"]
    gmat.node_tree.links.new(emit.outputs[0], out.inputs[0])
    # Quitar el BSDF
    bsdf_node = gmat.node_tree.nodes.get("Principled BSDF")
    if bsdf_node:
        gmat.node_tree.nodes.remove(bsdf_node)
    gme.materials.append(gmat)

# Cuadrícula en el plano Y-Z (frente, X=0.3 para que sea visible desde +X)
gx = 0.3
yL, yR = -1.6, 1.6
# Líneas horizontales (Z fijo) cada 0.2
z = 0.0
while z <= zmax + 0.05:
    add_line((gx, yL, z), (gx, yR, z), f"hz_{z:.2f}", 0.2, 0.7, 0.2)
    z = round(z + 0.2, 3)
# Líneas verticales (Y fijo) cada 0.2
for yv in [-1.4, -1.2, -1.0, -0.8, -0.6, -0.4, -0.2, 0.0,
            0.2,  0.4,  0.6,  0.8,  1.0,  1.2,  1.4]:
    add_line((gx, yv, 0.0), (gx, yv, zmax + 0.1), f"vt_{yv:.2f}", 0.7, 0.2, 0.2)

# Huesos (amarillo)
for bname, (bh, bt) in bone_data_c.items():
    add_line(bh, bt, f"bone_{bname}", 1.0, 1.0, 0.1)

# ── FASE 3: render desde las tres vistas ─────────────────────────────────────
scene.render.engine              = "BLENDER_WORKBENCH"
scene.display.shading.light      = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.render.resolution_x, scene.render.resolution_y = 900, 1400
world = bpy.data.worlds.new("w")
world.color = (0.06, 0.06, 0.06)
scene.world  = world

cam_d = bpy.data.cameras.new("cam")
cam_d.type        = "ORTHO"
cam_d.ortho_scale = 3.8
cam = bpy.data.objects.new("cam", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam

# frente = desde +X mirando −X; espalda = desde −X mirando +X; lateral = desde +Y mirando −Y
for nm, loc, rot in [
    ("frente_X",   ( 10, 0, zmid), (math.radians(90), 0, math.radians( 90))),
    ("espalda_mX", (-10, 0, zmid), (math.radians(90), 0, math.radians(-90))),
    ("lateral_Y",  (  0,10, zmid), (math.radians(90), 0, math.radians(180))),
]:
    cam.location, cam.rotation_euler = loc, rot
    scene.render.filepath = f"{OUT_DIR}grid_{nm}.png"
    bpy.ops.render.render(write_still=True)
    print(f"##RENDER OK {nm}")
