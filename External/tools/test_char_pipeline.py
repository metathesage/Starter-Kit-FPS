import bpy, os, sys, math, mathutils

def log(msg):
    print(f"[CHAR-PIPE] {msg}", flush=True)

def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def setup_standard_armature(anim_source_path):
    bpy.ops.import_scene.gltf(filepath=anim_source_path)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    # Remove meshes
    for m in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.data.objects.remove(m, do_unlink=True)
    return arm

def get_mesh_bounds(meshes):
    pts = [m.matrix_world @ mathutils.Vector(c) for m in meshes for c in m.bound_box]
    min_x = min(p.x for p in pts); max_x = max(p.x for p in pts)
    min_y = min(p.y for p in pts); max_y = max(p.y for p in pts)
    min_z = min(p.z for p in pts); max_z = max(p.z for p in pts)
    return (min_x, max_x), (min_y, max_y), (min_z, max_z)

def process_unrigged_character(src_glb, out_glb, out_fbx, anim_source_glb, target_height=1.70):
    clean_scene()
    
    # 1. Load standard humanoid armature with animations
    log(f"Loading animation reference: {anim_source_glb}")
    bpy.ops.import_scene.gltf(filepath=anim_source_glb)
    ref_arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    actions = list(bpy.data.actions)
    log(f"Extracted {len(actions)} animations from reference")
    
    # Delete reference meshes
    for m in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.data.objects.remove(m, do_unlink=True)
        
    # 2. Load target unrigged character
    log(f"Importing target: {src_glb}")
    bpy.ops.import_scene.gltf(filepath=src_glb)
    target_meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not target_meshes:
        raise ValueError(f"No meshes found in {src_glb}")
        
    (min_x, max_x), (min_y, max_y), (min_z, max_z) = get_mesh_bounds(target_meshes)
    curr_height = max_z - min_z
    scale_factor = target_height / max(curr_height, 0.001)
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    
    log(f"Centering & Scaling: curr_h={curr_height:.2f}m -> target={target_height:.2f}m (scale={scale_factor:.2f})")
    
    for m in target_meshes:
        m.matrix_world.translation.x -= center_x
        m.matrix_world.translation.y -= center_y
        m.matrix_world.translation.z -= min_z
        
    bpy.ops.object.select_all(action='DESELECT')
    for m in target_meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = target_meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    
    bpy.ops.transform.resize(value=(scale_factor, scale_factor, scale_factor))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # 3. Bind target meshes to the humanoid armature
    log("Binding meshes to standard humanoid skeleton...")
    bpy.ops.object.select_all(action='DESELECT')
    for m in target_meshes:
        m.select_set(True)
    ref_arm.select_set(True)
    bpy.context.view_layer.objects.active = ref_arm
    
    # Automatic heat weighting
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    except Exception as e:
        log(f"Standard auto parent warning: {e}, applying envelope fallback")
        bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
        
    # Ensure unweighted vertices get assigned to closest bone
    bone_positions = {b.name: ref_arm.matrix_world @ b.head_local for b in ref_arm.data.bones}
    
    for m in target_meshes:
        if not m.vertex_groups:
            # Create vertex groups for all bones if none exist
            for bname in bone_positions:
                m.vertex_groups.new(name=bname)
                
        # Check for unweighted vertices
        unweighted = [v for v in m.data.vertices if len(v.groups) == 0]
        if unweighted:
            log(f"Mesh {m.name}: Resolving {len(unweighted)}/{len(m.data.vertices)} unweighted boundary vertices...")
            # Assign to nearest bone by distance
            for v in unweighted:
                v_co = m.matrix_world @ v.co
                closest_bone = min(bone_positions.keys(), key=lambda b: (bone_positions[b] - v_co).length_squared)
                vg = m.vertex_groups.get(closest_bone)
                if not vg:
                    vg = m.vertex_groups.new(name=closest_bone)
                vg.add([v.index], 1.0, 'REPLACE')
                
    # 4. Push actions to NLA tracks so GLTF exporter exports all animations
    log(f"Setting up NLA tracks for {len(actions)} animations...")
    if not ref_arm.animation_data:
        ref_arm.animation_data_create()
        
    for act in actions:
        track = ref_arm.animation_data.nla_tracks.new()
        track.name = act.name
        strip = track.strips.new(act.name, int(act.frame_range[0]), act)
        strip.action = act
        
    # 5. Export GLB
    os.makedirs(os.path.dirname(out_glb), exist_ok=True)
    log(f"Exporting GLB: {out_glb}")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS'
    )
    
    # 6. Export FBX (if path provided)
    if out_fbx:
        os.makedirs(os.path.dirname(out_fbx), exist_ok=True)
        log(f"Exporting FBX: {out_fbx}")
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.fbx(
            filepath=out_fbx,
            use_selection=True,
            object_types={'ARMATURE', 'MESH'},
            bake_anim=True,
            apply_unit_scale=True,
            apply_scale_options='FBX_SCALE_ALL'
        )
    log(f"Finished processing {src_glb} successfully!")

if __name__ == '__main__':
    anim_ref = r'halo-waifu-arena\assets\chars\loba.glb'
    test_src = r'bikini-royal-waifus\character design\android_18__anime_girl__hot_denum_bikini.glb'
    test_out_glb = r'External\tools\test_out\android_18_rigged.glb'
    test_out_fbx = r'External\tools\test_out\android_18_rigged.fbx'
    
    process_unrigged_character(test_src, test_out_glb, test_out_fbx, anim_ref, target_height=1.70)
