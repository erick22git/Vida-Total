import bpy, os, collections, math

def analyze(path):
    bpy.ops.wm.open_mainfile(filepath=path)
    dg = bpy.context.evaluated_depsgraph_get()
    out = {"file": os.path.basename(path), "size_mb": round(os.path.getsize(path) / 1e6, 1)}
    out["saved_with_version"] = list(bpy.data.version)
    objs = list(bpy.data.objects)
    out["objects_total"] = len(objs)
    out["objects_by_type"] = dict(collections.Counter(o.type for o in objs))
    # polígonos
    poly_raw = 0
    poly_unique = 0
    tris_eval = 0
    verts_eval = 0
    seen = set()
    for o in objs:
        if o.type == "MESH":
            poly_raw += len(o.data.polygons)
            if o.data.name not in seen:
                seen.add(o.data.name)
                poly_unique += len(o.data.polygons)
    # evaluado (con modificadores / instancias de GN): solo objetos visibles en el view layer
    vl_objs = [o for o in bpy.context.view_layer.objects]
    inst_count = 0
    for inst in dg.object_instances:
        ob = inst.object
        if ob.type == "MESH":
            try:
                m = ob.data
                tris_eval += sum(max(len(p.vertices) - 2, 1) for p in m.polygons) if len(m.polygons) < 400000 else len(m.polygons) * 2
                verts_eval += len(m.vertices)
            except Exception:
                pass
            inst_count += 1
    out["mesh_datablocks"] = len(bpy.data.meshes)
    out["polys_sum_objects(mesh data users)"] = poly_raw
    out["polys_unique_meshdata"] = poly_unique
    out["tris_evaluated_visible(approx)"] = tris_eval
    out["verts_evaluated_visible(approx)"] = verts_eval
    out["evaluated_mesh_instances"] = inst_count
    # colecciones
    def coll_tree(c, depth=0):
        return {"name": c.name, "objects": len(c.objects), "children": [coll_tree(ch, depth + 1) for ch in c.children]}
    out["collections_count"] = len(bpy.data.collections)
    out["collection_tree"] = coll_tree(bpy.context.scene.collection)
    # jerarquía
    def depth(o):
        d = 0
        while o.parent:
            o = o.parent
            d += 1
        return d
    out["max_parent_depth"] = max((depth(o) for o in objs), default=0)
    out["root_objects"] = sum(1 for o in objs if o.parent is None)
    out["empties"] = sum(1 for o in objs if o.type == "EMPTY")
    out["instanced_collections(empties)"] = sum(1 for o in objs if o.instance_type == "COLLECTION" and o.instance_collection)
    # modificadores
    mods = collections.Counter()
    gn_groups = set()
    for o in objs:
        for m in o.modifiers:
            mods[m.type] += 1
            if m.type == "NODES" and m.node_group:
                gn_groups.add(m.node_group.name)
    out["modifiers"] = dict(mods)
    out["geometry_nodes_groups_used"] = sorted(gn_groups)[:20]
    out["particle_systems"] = sum(len(o.particle_systems) for o in objs if hasattr(o, "particle_systems"))
    # materiales / texturas
    out["materials"] = len(bpy.data.materials)
    used_mats = [m for m in bpy.data.materials if m.users > 0]
    out["materials_used"] = len(used_mats)
    node_types = collections.Counter()
    for m in bpy.data.materials:
        if m.use_nodes and m.node_tree:
            for n in m.node_tree.nodes:
                node_types[n.bl_idname] += 1
    out["material_node_types_top"] = dict(node_types.most_common(8))
    imgs = []
    tex_bytes = 0
    for im in bpy.data.images:
        if im.type in ("RENDER_RESULT", "COMPOSITING"):
            continue
        w, h = im.size[0], im.size[1]
        tex_bytes += w * h * 4
        ext = ""
        if im.filepath and not im.packed_file:
            p = bpy.path.abspath(im.filepath)
            ext = "OK" if os.path.exists(p) else "FALTA"
        imgs.append({"name": im.name, "size": [w, h], "packed": bool(im.packed_file), "source": im.source, "external": ext})
    out["images_count"] = len(imgs)
    out["images_biggest"] = sorted(imgs, key=lambda i: -(i["size"][0] * i["size"][1]))[:6]
    out["images_missing_external"] = [i["name"] for i in imgs if i["external"] == "FALTA"][:10]
    out["images_packed"] = sum(1 for i in imgs if i["packed"])
    out["texture_ram_mb_rgba(approx)"] = round(tex_bytes / 1e6, 1)
    # cámaras, luces, mundo
    out["cameras"] = [c.name for c in bpy.data.cameras]
    out["lights"] = dict(collections.Counter(l.type for l in bpy.data.lights))
    w = bpy.context.scene.world
    out["world"] = w.name if w else None
    out["world_uses_hdri"] = bool(w and w.use_nodes and any(n.bl_idname == "ShaderNodeTexEnvironment" for n in w.node_tree.nodes))
    # animaciones
    out["actions"] = [a.name for a in bpy.data.actions][:10]
    out["objects_with_animation"] = sum(1 for o in objs if o.animation_data and o.animation_data.action)
    out["frame_range"] = [bpy.context.scene.frame_start, bpy.context.scene.frame_end]
    # dependencias
    out["linked_libraries"] = [l.filepath for l in bpy.data.libraries]
    out["render_engine"] = bpy.context.scene.render.engine
    # bounding box global de meshes visibles
    mn = [1e18] * 3
    mx = [-1e18] * 3
    for o in vl_objs:
        if o.type in ("MESH", "CURVE", "SURFACE", "META", "FONT"):
            for c in o.bound_box:
                wc = o.matrix_world @ mathutils.Vector(c)
                for i in range(3):
                    mn[i] = min(mn[i], wc[i])
                    mx[i] = max(mx[i], wc[i])
    out["bbox_min"] = [round(v, 2) for v in mn]
    out["bbox_max"] = [round(v, 2) for v in mx]
    out["scene_unit_scale"] = bpy.context.scene.unit_settings.scale_length
    # nombres representativos: los 60 objetos con más polígonos y muestra de nombres
    top = sorted([o for o in objs if o.type == "MESH"], key=lambda o: -len(o.data.polygons))[:12]
    out["top_meshes"] = [{"name": o.name, "polys": len(o.data.polygons), "parent": o.parent.name if o.parent else None,
                           "collections": [c.name for c in o.users_collection]} for o in top]
    out["sample_names"] = [o.name for o in objs][:60]
    return out

result = analyze(__PATH__)
