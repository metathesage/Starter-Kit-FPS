import bpy, os, sys, math, mathutils, shutil

def log(msg):
    print(f"[NEW-BATCH] {msg}", flush=True)

ANIM_REF = r'halo-waifu-arena\assets\chars\loba.glb'

# Directories
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

NEW_CHARACTERS = [
    # (filepath, out_name, target_height)
    (r'bikini-royal-waifus\character design\aoi.glb', 'aoi_rigged', 1.68),
    (r'bikini-royal-waifus\character design\baizhi_wuthering_waves.glb', 'baizhi_rigged', 1.72),
    (r'bikini-royal-waifus\character design\carlotta_montelli_wuthering_waves.glb', 'carlotta_rigged', 1.68),
    (r'bikini-royal-waifus\character design\chisa_wuthering_waves.glb', 'chisa_rigged', 1.68),
    (r'bikini-royal-waifus\character design\jinhsi_wuthering_waves.glb', 'jinhsi_rigged', 1.70),
    (r'bikini-royal-waifus\character design\fortnite_lynx.glb', 'fortnite_lynx_rigged', 1.72),
    (r'bikini-royal-waifus\character design\metroid_onlineinventorygravity_suit.glb', 'samus_gravity_suit_rigged', 1.90),
    (r'bikini-royal-waifus\character design\mint_-_neverness_to_everness.glb', 'mint_casual_rigged', 1.65),
    (r'bikini-royal-waifus\character design\ps1_halo_ce_master_chief.glb', 'ps1_master_chief_rigged', 2.05),
    (r'bikini-royal-waifus\character design\ruri_tinytale.glb', 'ruri_tinytale_rigged', 1.62),
    (r'Characters\enemies\yugioh_fm_-_magician_of_black_chaos.glb', 'magician_black_chaos_rigged', 1.95),
    (r'Weapons\mualani_genshin_impact.glb', 'mualani_rigged', 1.65),
    (r'Characters\enemies\halo_elite_minor_-_halo.glb', 'halo_elite_minor_rigged', 2.25),
    (r'Characters\enemies\grim_reaper_-_glowing_rune_scythe.glb', 'grim_reaper_rigged', 2.10),
    (r'Characters\enemies\bone_seraph_skeletal_angel.glb', 'bone_seraph_rigged', 2.20),
    (r'bikini-royal-waifus\character design\cleopatra_and_asp_in_marble.glb', 'cleopatra_rigged', 1.72),
    (r'Characters\alice_-_nikke_goddess_of_victory.glb', 'alice_nikke_rigged', 1.65),
    (r'Characters\black_panther.glb', 'black_panther_rigged', 1.88),
    (r'Characters\bunny_girl_dark.glb', 'bunny_girl_dark_rigged', 1.70),
    (r'Characters\elaina_-_the_witchs_journey.glb', 'elaina_witch_rigged', 1.62),
    (r'Characters\Kasumi_Tactical_Sailor.glb', 'kasumi_tactical_rigged', 1.68),
    (r'Characters\SciFi_Waifu_Soldier.glb', 'scifi_soldier_rigged', 1.72),
    (r'Characters\venus_goddess..glb', 'venus_goddess_rigged', 1.75),
    (r'Characters\wuthering_waves_lucy_downloadable.glb', 'wuthering_lucy_rigged', 1.68),
    (r'Characters\enemies\swat.glb', 'swat_enemy_rigged', 1.85),
    (r'Characters\enemies\sofia 3d anime.glb', 'sofia_anime_rigged', 1.65),
    (r'Characters\girl-sexy\source\girl_.glb', 'cyber_girl_rigged', 1.68)
]

NEW_WEAPONS = [
    # (filepath, out_name, target_length, is_melee)
    (r'Weapons\weaponshumanhalo_2_anniversarybattle_rifle.glb', 'halo2_battle_rifle_rigged', 0.85, False),
    (r'Weapons\the_last_word.glb', 'the_last_word_rigged', 0.38, False),
    (r'Weapons\scar_-_fortnite_gun.glb', 'scar_assault_rifle_rigged', 0.82, False),
    (r'Weapons\sci_fi_weapon_gameready_gun_rifle.glb', 'scifi_rifle_rigged', 0.80, False),
    (r'Weapons\futuristic_sci-fi_rifle.glb', 'futuristic_rifle_rigged', 0.82, False),
    (r'Weapons\bushmaster_acr.glb', 'bushmaster_acr_rigged', 0.78, False),
    (r'Weapons\cyberpunk_pistol.glb', 'cyberpunk_pistol_rigged', 0.32, False),
    (r'Weapons\izanagis_burden.glb', 'izanagis_burden_rigged', 1.15, False),
    (r'Weapons\mindbenders_ambition.glb', 'mindbenders_ambition_rigged', 0.88, False),
    (r'Weapons\vex_mythoclast_final.glb', 'vex_mythoclast_rigged', 0.85, False),
    (r'Weapons\wste-m5_combat_shotgun.glb', 'wste_m5_shotgun_rigged', 0.72, False),
    (r'bikini-royal-waifus\character design\overwatch_-_sentinel_gun_sombra.glb', 'sombra_sentinel_gun_rigged', 0.38, False),
    (r'bikini-royal-waifus\character design\sombra_gun.glb', 'sombra_gun_rigged', 0.38, False),
    (r'Weapons\energy_sword_halo.glb', 'halo_energy_sword_rigged', 0.95, True),
    (r'Weapons\energy_sword_-_halo_prop.glb', 'halo_energy_prop_rigged', 0.95, True),
    (r'Weapons\Energy_Sword_Plasma.glb', 'halo_plasma_sword_rigged', 0.95, True),
    (r'Weapons\mourning_angel_kneeling_greatsword.glb', 'mourning_greatsword_rigged', 1.35, True),
    (r'Weapons\neptunia_sword_pack.glb', 'neptunia_sword_rigged', 1.10, True),
    (r'Weapons\purple_sycthe.glb', 'purple_scythe_rigged', 1.40, True),
    (r'Weapons\futuristic_cyberpunk_ninja_star.glb', 'cyberpunk_ninja_star_rigged', 0.28, True),
    (r'Weapons\low_poly_acr_pdw.glb', 'low_poly_acr_rigged', 0.65, False),
    (r'Weapons\xyz_coursework_-_hand_cannon_high_poly (1).glb', 'hand_cannon_high_poly_rigged', 0.38, False),
    (r'Weapons\ace_of_spades_destiny_2.glb', 'ace_of_spades_rigged', 0.38, False),
    (r'Weapons\chaperone_from_destiny_2.glb', 'chaperone_shotgun_rigged', 0.98, False),
    (r'Weapons\Hawkmoon_Exotic_HandCannon.glb', 'hawkmoon_rigged', 0.38, False),
    (r'Weapons\outbreak_perfected_destiny_2.glb', 'outbreak_perfected_rigged', 0.85, False),
    (r'Weapons\apex_legends_heirlooms_grand_slam.glb', 'gibraltar_war_club_rigged', 0.65, True)
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
    
    # 1. Load Animation Reference Armature
    bpy.ops.import_scene.gltf(filepath=ANIM_REF)
    ref_arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    actions = list(bpy.data.actions)
    for m in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.data.objects.remove(m, do_unlink=True)
        
    arm_scale = target_height / 1.78
    ref_arm.scale = (arm_scale, arm_scale, arm_scale)
    bpy.context.view_layer.objects.active = ref_arm
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # 2. Import Target Character Mesh
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
    
    # 3. Parent to Armature
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
                
    # 4. Setup NLA Tracks
    if not ref_arm.animation_data:
        ref_arm.animation_data_create()
    for act in actions:
        track = ref_arm.animation_data.nla_tracks.new()
        track.name = act.name
        strip = track.strips.new(act.name, int(act.frame_range[0]), act)
        strip.action = act
        
    out_glb = os.path.join(ROOT_CHARS, f"{out_name}.glb")
    out_fbx = os.path.join(ROOT_CHARS, f"{out_name}.fbx")
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
            root_bone.rotation_euler = (math.sin((f / 60.0) * math.pi * 2) * 0.008, 0, 0)
            root_bone.keyframe_insert(data_path='location', frame=f)
            root_bone.keyframe_insert(data_path='rotation_euler', frame=f)
    actions.append(act_idle)
    
    # 2. Fire
    act_fire = bpy.data.actions.new(name='Fire')
    if root_bone:
        root_bone.location = (0, 0, 0)
        root_bone.rotation_euler = (0, 0, 0)
        root_bone.keyframe_insert(data_path='location', frame=0)
        root_bone.keyframe_insert(data_path='rotation_euler', frame=0)
        
        root_bone.location = (0, -0.045, 0.015)
        root_bone.rotation_euler = (0.075, 0, 0)
        root_bone.keyframe_insert(data_path='location', frame=2)
        root_bone.keyframe_insert(data_path='rotation_euler', frame=2)
        
        root_bone.location = (0, 0, 0)
        root_bone.rotation_euler = (0, 0, 0)
        root_bone.keyframe_insert(data_path='location', frame=6)
        root_bone.keyframe_insert(data_path='rotation_euler', frame=6)
    actions.append(act_fire)
    
    # 3. Reload
    act_reload = bpy.data.actions.new(name='Reload')
    if root_bone:
        frames = [
            (0, (0, 0, 0), (0, 0, 0)),
            (10, (0, -0.02, -0.06), (-0.35, 0.15, -0.1)),
            (25, (0, 0.01, -0.04), (-0.15, 0.05, 0)),
            (38, (0, 0, 0), (0.1, 0, 0)),
            (50, (0, 0, 0), (0, 0, 0))
        ]
        for f, loc, rot in frames:
            root_bone.location = loc
            root_bone.rotation_euler = rot
            root_bone.keyframe_insert(data_path='location', frame=f)
            root_bone.keyframe_insert(data_path='rotation_euler', frame=f)
    actions.append(act_reload)
    
    # 4. Inspect
    act_inspect = bpy.data.actions.new(name='Inspect')
    if root_bone:
        frames = [
            (0, (0, 0, 0), (0, 0, 0)),
            (15, (0.03, 0.02, 0.02), (0.1, -0.45, 0.2)),
            (35, (-0.03, 0.04, 0.02), (-0.1, 0.55, -0.3)),
            (55, (0, 0.01, 0.01), (0.05, 0.1, 0)),
            (70, (0, 0, 0), (0, 0, 0))
        ]
        for f, loc, rot in frames:
            root_bone.location = loc
            root_bone.rotation_euler = rot
            root_bone.keyframe_insert(data_path='location', frame=f)
            root_bone.keyframe_insert(data_path='rotation_euler', frame=f)
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
    existing_arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not meshes:
        log(f"No meshes in {src_path}!")
        return False
        
    (min_x, max_x), (min_y, max_y), (min_z, max_z) = get_mesh_bounds(meshes)
    dx = max_x - min_x
    dy = max_y - min_y
    dz = max_z - min_z
    
    # Check if weapon forward is along X, Y, or Z
    curr_len = max(dy, dz) if is_melee else max(dx, dy, dz)
    if dx > dy and dx > dz and not is_melee:
        # Rotate -90 on Z to align forward with +Y
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
    
    # Create Weapon Armature with Sockets
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm_obj = bpy.context.view_layer.objects.active
    arm_obj.name = f"{out_name}_Armature"
    
    edit_bones = arm_obj.data.edit_bones
    root_b = edit_bones[0]
    root_b.name = "Weapon_Root"
    root_b.head = (0, 0, 0)
    root_b.tail = (0, 0, 0.1)
    
    # Grip Main
    grip_m = edit_bones.new("Grip_Main")
    grip_m.parent = root_b
    grip_m.head = (0, 0, 0)
    grip_m.tail = (0, 0, 0.05)
    
    # Forehand
    grip_f = edit_bones.new("Grip_Forehand")
    grip_f.parent = root_b
    grip_f.head = (0, target_length * 0.45, 0.02)
    grip_f.tail = (0, target_length * 0.45, 0.07)
    
    # Muzzle
    muzzle_b = edit_bones.new("Muzzle")
    muzzle_b.parent = root_b
    muzzle_b.head = (0, target_length * 0.95, 0.05)
    muzzle_b.tail = (0, target_length * 0.95, 0.1)
    
    # Sight ADS
    sight_b = edit_bones.new("Sight_ADS")
    sight_b.parent = root_b
    sight_b.head = (0, target_length * 0.25, 0.08)
    sight_b.tail = (0, target_length * 0.25, 0.13)
    
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Bind Meshes to Weapon_Root
    for m in meshes:
        vg = m.vertex_groups.get("Weapon_Root") or m.vertex_groups.new(name="Weapon_Root")
        all_verts = [v.index for v in m.data.vertices]
        vg.add(all_verts, 1.0, 'REPLACE')
        
        m.parent = arm_obj
        mod = m.modifiers.new(name="Armature", type='ARMATURE')
        mod.object = arm_obj
        
    # Generate Animations
    actions = create_weapon_animations(arm_obj)
    
    # NLA tracks
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    for act in actions:
        tr = arm_obj.animation_data.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, int(act.frame_range[0]), act)
        st.action = act
        
    out_glb = os.path.join(ROOT_WEAPONS, f"{out_name}.glb")
    out_fbx = os.path.join(ROOT_WEAPONS, f"{out_name}.fbx")
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
    log("=== STARTING NEW BATCH: CHARACTERS & WEAPONS ===")
    
    # 1. Process Weapons First (Fast & lightweight)
    w_success = 0
    for idx, (path, name, length, is_melee) in enumerate(NEW_WEAPONS, 1):
        log(f"[WEAPON {idx}/{len(NEW_WEAPONS)}] {name}...")
        try:
            if process_weapon(path, name, length, is_melee):
                w_success += 1
        except Exception as e:
            log(f"ERROR on weapon {name}: {e}")
            
    # 2. Process Characters
    c_success = 0
    for idx, (path, name, height) in enumerate(NEW_CHARACTERS, 1):
        log(f"[CHAR {idx}/{len(NEW_CHARACTERS)}] {name}...")
        try:
            if process_character(path, name, height):
                c_success += 1
        except Exception as e:
            log(f"ERROR on char {name}: {e}")
            
    log(f"=== BATCH COMPLETE: {w_success}/{len(NEW_WEAPONS)} Weapons & {c_success}/{len(NEW_CHARACTERS)} Characters Rigged & Animated! ===")
