import bpy, os, sys, math, mathutils, shutil

def log(msg):
    print(f"[EXTRA-BATCH] {msg}", flush=True)

ANIM_REF = r'halo-waifu-arena\assets\chars\loba.glb'

ROOT_CHARS = r'Characters'
ROOT_WEAPONS = r'Weapons'
BIKINI_CHARS = r'bikini-royal-waifus\public\assets\characters\animated'
BIKINI_WEAPONS = r'bikini-royal-waifus\public\assets\weapons'
HALO_CHARS = r'halo-waifu-arena\assets\chars'
HALO_WEAPONS = r'halo-waifu-arena\assets\weapons'
UNITY_CHARS = r'Assets\Characters'
UNITY_WEAPONS = r'Assets\Weapons'

for d in [ROOT_CHARS, ROOT_WEAPONS, BIKINI_CHARS, BIKINI_WEAPONS, HALO_CHARS, HALO_WEAPONS, UNITY_CHARS, UNITY_WEAPONS]:
    os.makedirs(d, exist_ok=True)

EXTRA_CHARACTERS = [
    (r'pomni-censored\source\Pomni C2.glb', 'pomni_rigged', 1.55),
    (r'bikini-royal-waifus\character design\goddess_of_victory_nikke_-_nayuta_wu_wei_ver..glb', 'nayuta_nikke_rigged', 1.68),
    (r'bikini-royal-waifus\character design\stylized_cyberpunk_anime_catgirl_mecha_3d_model.glb', 'catgirl_mecha_rigged', 1.70),
    (r'bikini-royal-waifus\character design\cute_anime_girl_3d_model__stylized_blue_hair.glb', 'blue_hair_girl_rigged', 1.62),
    (r'bikini-royal-waifus\character design\dark_necromancer_-_corrupted_staff__skulls.glb', 'dark_necromancer_rigged', 2.10),
    (r'Weapons\game_ready_cemetery_angel_-_leubner.glb', 'cemetery_angel_rigged', 1.95),
    (r'Weapons\angel_old_marble_version.glb', 'marble_angel_rigged', 1.95)
]

EXTRA_WEAPONS = [
    (r'bikini-royal-waifus\character design\destiny_ice_breaker_sniper_rifle.glb', 'destiny_ice_breaker_rigged', 1.15, False),
    (r'bikini-royal-waifus\character design\chicken_gun_fruzer_cyberpunk.glb', 'chicken_gun_fruzer_rigged', 0.45, False)
]

def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def get_mesh_bounds(meshes):
    pts = [m.matrix_world @ mathutils.Vector(c) for m in meshes for c in m.bound_box]
    if not pts:
        return (0, 0), (0, 0), (0, 0)
    min_x, max_x = min(p.x for p in pts), max(p.x for p in pts)
    min_y, max_y = min(p.y for p in pts), max(p.y for p in pts)
    min_z, max_z = min(p.z for p in pts), max(p.z for p in pts)
    return (min_x, max_x), (min_y, max_y), (min_z, max_z)

def process_character(src_path, out_name, target_height):
    if not os.path.exists(src_path):
        log(f"Character file not found: {src_path}")
        return False
    out_glb = os.path.join(ROOT_CHARS, f"{out_name}.glb")
    out_fbx = os.path.join(ROOT_CHARS, f"{out_name}.fbx")
    if os.path.exists(out_glb) and os.path.exists(out_fbx) and os.path.getsize(out_glb) > 10000:
        log(f"Character already completed: {out_name}")
        return True
    clean_scene()
    log(f"--- Processing Character: {out_name} (target={target_height}m) ---")
    
    bpy.ops.import_scene.gltf(filepath=ANIM_REF)
    ref_arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    actions = list(bpy.data.actions)
    for m in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.data.objects.remove(m, do_unlink=True)
        
    arm_scale = target_height / 1.78
    ref_arm.scale = (arm_scale, arm_scale, arm_scale)
    bpy.context.view_layer.objects.active = ref_arm
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    bpy.ops.import_scene.gltf(filepath=src_path)
    for a in [o for o in bpy.data.objects if o.type == 'ARMATURE' and o != ref_arm]:
        bpy.data.objects.remove(a, do_unlink=True)
        
    target_meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not target_meshes:
        log(f"No meshes in {src_path}!")
        return False
        
    for m in target_meshes:
        m.parent = None
        for mod in list(m.modifiers):
            if mod.type == 'ARMATURE':
                m.modifiers.remove(mod)
        m.vertex_groups.clear()
        
    (min_x, max_x), (min_y, max_y), (min_z, max_z) = get_mesh_bounds(target_meshes)
    curr_height = max_z - min_z
    scale_factor = target_height / max(curr_height, 0.001)
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    
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
    
    bpy.ops.object.select_all(action='DESELECT')
    for m in target_meshes:
        m.select_set(True)
    ref_arm.select_set(True)
    bpy.context.view_layer.objects.active = ref_arm
    
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    except Exception as e:
        log(f"Auto-weight fallback: {e}")
        bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
        
    bone_positions = {b.name: ref_arm.matrix_world @ b.head_local for b in ref_arm.data.bones}
    for m in target_meshes:
        if not m.vertex_groups:
            for bname in bone_positions:
                m.vertex_groups.new(name=bname)
        unweighted = [v for v in m.data.vertices if len(v.groups) == 0]
        if unweighted:
            for v in unweighted:
                v_co = m.matrix_world @ v.co
                closest_bone = min(bone_positions.keys(), key=lambda b: (bone_positions[b] - v_co).length_squared)
                vg = m.vertex_groups.get(closest_bone) or m.vertex_groups.new(name=closest_bone)
                vg.add([v.index], 1.0, 'REPLACE')
                
    if not ref_arm.animation_data:
        ref_arm.animation_data_create()
    for act in actions:
        track = ref_arm.animation_data.nla_tracks.new()
        track.name = act.name
        strip = track.strips.new(act.name, int(act.frame_range[0]), act)
        strip.action = act
        
    unity_folder = os.path.join(UNITY_CHARS, out_name)
    os.makedirs(unity_folder, exist_ok=True)
    
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS'
    )
    bpy.ops.export_scene.fbx(
        filepath=out_fbx,
        use_selection=True,
        object_types={'ARMATURE', 'MESH'},
        bake_anim=True,
        apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_ALL'
    )
    
    shutil.copy2(out_glb, os.path.join(BIKINI_CHARS, f"{out_name}.glb"))
    shutil.copy2(out_glb, os.path.join(HALO_CHARS, f"{out_name}.glb"))
    shutil.copy2(out_fbx, os.path.join(unity_folder, f"{out_name}.fbx"))
    log(f"Completed character: {out_name}")
    return True

def create_weapon_animations(arm_obj):
    actions = []
    # 1. Idle
    act_idle = bpy.data.actions.new(name='Idle')
    root_bone = arm_obj.pose.bones.get('Weapon_Root')
    if root_bone:
        for f in [0, 30, 60]:
            z_off = math.sin((f / 60.0) * math.pi * 2) * 0.003
            root_bone.location = (0, 0, z_off)
            root_bone.keyframe_insert(data_path="location", frame=f)
    actions.append(act_idle)
    
    # 2. Fire
    act_fire = bpy.data.actions.new(name='Fire')
    if root_bone:
        root_bone.location = (0, 0, 0)
        root_bone.rotation_euler = (0, 0, 0)
        root_bone.keyframe_insert(data_path="location", frame=0)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=0)
        root_bone.location = (0, -0.04, 0.015)
        root_bone.rotation_euler = (math.radians(-4.0), 0, 0)
        root_bone.keyframe_insert(data_path="location", frame=2)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=2)
        root_bone.location = (0, 0, 0)
        root_bone.rotation_euler = (0, 0, 0)
        root_bone.keyframe_insert(data_path="location", frame=10)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=10)
    actions.append(act_fire)
    
    # 3. Reload
    act_reload = bpy.data.actions.new(name='Reload')
    if root_bone:
        root_bone.location = (0, 0, 0)
        root_bone.rotation_euler = (0, 0, 0)
        root_bone.keyframe_insert(data_path="location", frame=0)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=0)
        root_bone.location = (0.02, -0.02, -0.08)
        root_bone.rotation_euler = (math.radians(-15.0), math.radians(20.0), math.radians(-10.0))
        root_bone.keyframe_insert(data_path="location", frame=20)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=20)
        root_bone.location = (0.01, -0.01, -0.04)
        root_bone.rotation_euler = (math.radians(5.0), 0, 0)
        root_bone.keyframe_insert(data_path="location", frame=40)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=40)
        root_bone.location = (0, 0, 0)
        root_bone.rotation_euler = (0, 0, 0)
        root_bone.keyframe_insert(data_path="location", frame=60)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=60)
    actions.append(act_reload)
    
    # 4. Inspect
    act_inspect = bpy.data.actions.new(name='Inspect')
    if root_bone:
        root_bone.location = (0, 0, 0)
        root_bone.rotation_euler = (0, 0, 0)
        root_bone.keyframe_insert(data_path="location", frame=0)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=0)
        root_bone.location = (-0.03, 0.05, 0.02)
        root_bone.rotation_euler = (math.radians(10.0), math.radians(-35.0), math.radians(25.0))
        root_bone.keyframe_insert(data_path="location", frame=35)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=35)
        root_bone.location = (0.03, 0.05, 0.02)
        root_bone.rotation_euler = (math.radians(-5.0), math.radians(35.0), math.radians(-25.0))
        root_bone.keyframe_insert(data_path="location", frame=70)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=70)
        root_bone.location = (0, 0, 0)
        root_bone.rotation_euler = (0, 0, 0)
        root_bone.keyframe_insert(data_path="location", frame=100)
        root_bone.keyframe_insert(data_path="rotation_euler", frame=100)
    actions.append(act_inspect)
    return actions

def process_weapon(src_path, out_name, target_length, is_melee):
    if not os.path.exists(src_path):
        log(f"Weapon file not found: {src_path}")
        return False
    out_glb = os.path.join(ROOT_WEAPONS, f"{out_name}.glb")
    out_fbx = os.path.join(ROOT_WEAPONS, f"{out_name}.fbx")
    if os.path.exists(out_glb) and os.path.exists(out_fbx) and os.path.getsize(out_glb) > 10000:
        log(f"Weapon already completed: {out_name}")
        return True
    clean_scene()
    log(f"--- Processing Weapon: {out_name} (target_len={target_length}m, is_melee={is_melee}) ---")
    
    bpy.ops.import_scene.gltf(filepath=src_path)
    for a in [o for o in bpy.data.objects if o.type == 'ARMATURE']:
        bpy.data.objects.remove(a, do_unlink=True)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        log(f"No meshes in {src_path}!")
        return False
        
    (min_x, max_x), (min_y, max_y), (min_z, max_z) = get_mesh_bounds(meshes)
    dx = max_x - min_x
    dy = max_y - min_y
    dz = max_z - min_z
    
    curr_len = max(dy, dz) if is_melee else max(dx, dy, dz)
    if dx > dy and dx > dz and not is_melee:
        for m in meshes:
            m.rotation_euler.z -= math.pi / 2
        bpy.ops.object.select_all(action='DESELECT')
        for m in meshes:
            m.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        (min_x, max_x), (min_y, max_y), (min_z, max_z) = get_mesh_bounds(meshes)
        curr_len = max(max_y - min_y, max_z - min_z)
        
    scale_factor = target_length / max(curr_len, 0.001)
    center_x = (min_x + max_x) / 2
    
    for m in meshes:
        m.matrix_world.translation.x -= center_x
        m.matrix_world.translation.y -= min_y
        m.matrix_world.translation.z -= min_z
        
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    bpy.ops.transform.resize(value=(scale_factor, scale_factor, scale_factor))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    (min_x, max_x), (min_y, max_y), (min_z, max_z) = get_mesh_bounds(meshes)
    
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm_obj = bpy.context.active_object
    arm_obj.name = f"{out_name}_Armature"
    arm_data = arm_obj.data
    arm_data.name = f"{out_name}_ArmatureData"
    
    root_b = arm_data.edit_bones[0]
    root_b.name = "Weapon_Root"
    root_b.head = (0, 0, 0)
    root_b.tail = (0, 0.08, 0)
    
    b_grip = arm_data.edit_bones.new("Grip_Main")
    b_grip.parent = root_b
    b_grip.head = (0, (min_y + max_y) * 0.25, min_z + (max_z - min_z) * 0.2)
    b_grip.tail = (0, (min_y + max_y) * 0.25, min_z)
    
    b_fore = arm_data.edit_bones.new("Grip_Forehand")
    b_fore.parent = root_b
    b_fore.head = (0, (min_y + max_y) * 0.65, min_z + (max_z - min_z) * 0.35)
    b_fore.tail = (0, (min_y + max_y) * 0.65, min_z + (max_z - min_z) * 0.15)
    
    b_muzzle = arm_data.edit_bones.new("Muzzle")
    b_muzzle.parent = root_b
    b_muzzle.head = (0, max_y, min_z + (max_z - min_z) * 0.6)
    b_muzzle.tail = (0, max_y + 0.1, min_z + (max_z - min_z) * 0.6)
    
    b_sight = arm_data.edit_bones.new("Sight_ADS")
    b_sight.parent = root_b
    b_sight.head = (0, (min_y + max_y) * 0.45, max_z)
    b_sight.tail = (0, (min_y + max_y) * 0.45, max_z + 0.05)
    
    bpy.ops.object.mode_set(mode='OBJECT')
    
    for m in meshes:
        vg = m.vertex_groups.get("Weapon_Root") or m.vertex_groups.new(name="Weapon_Root")
        vg.add(list(range(len(m.data.vertices))), 1.0, 'REPLACE')
        mod = m.modifiers.new(name="Armature", type='ARMATURE')
        mod.object = arm_obj
        m.parent = arm_obj
        
    actions = create_weapon_animations(arm_obj)
    
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    for act in actions:
        track = arm_obj.animation_data.nla_tracks.new()
        track.name = act.name
        strip = track.strips.new(act.name, int(act.frame_range[0]), act)
        strip.action = act
        
    unity_folder = os.path.join(UNITY_WEAPONS, out_name)
    os.makedirs(unity_folder, exist_ok=True)
    
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS'
    )
    bpy.ops.export_scene.fbx(
        filepath=out_fbx,
        use_selection=True,
        object_types={'ARMATURE', 'MESH'},
        bake_anim=True,
        apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_ALL'
    )
    
    shutil.copy2(out_glb, os.path.join(BIKINI_WEAPONS, f"{out_name}.glb"))
    shutil.copy2(out_glb, os.path.join(HALO_WEAPONS, f"{out_name}.glb"))
    shutil.copy2(out_fbx, os.path.join(unity_folder, f"{out_name}.fbx"))
    shutil.copy2(out_fbx, os.path.join(UNITY_WEAPONS, f"{out_name}.fbx"))
    log(f"Completed weapon: {out_name}")
    return True

if __name__ == '__main__':
    log("=== STARTING EXTRA BATCH ===")
    for path, name, length, is_melee in EXTRA_WEAPONS:
        try:
            process_weapon(path, name, length, is_melee)
        except Exception as e:
            log(f"ERROR on weapon {name}: {e}")
            
    for path, name, height in EXTRA_CHARACTERS:
        try:
            process_character(path, name, height)
        except Exception as e:
            log(f"ERROR on char {name}: {e}")
            
    log("=== EXTRA BATCH FINISHED ===")
