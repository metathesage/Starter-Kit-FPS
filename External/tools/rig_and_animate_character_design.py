import bpy, os, sys, math, mathutils, shutil

def log(msg):
    print(f"[CHAR-PIPE] {msg}", flush=True)

ANIM_REF = r'halo-waifu-arena\assets\chars\loba.glb'
SRC_DIR = r'bikini-royal-waifus\character design'

ROOT_CHARS = r'Characters'
BIKINI_CHARS = r'bikini-royal-waifus\public\assets\characters\animated'
HALO_CHARS = r'halo-waifu-arena\assets\chars'
UNITY_CHARS = r'Assets\Characters'

CHARACTER_MANIFEST = [
    # (filename, output_name, target_height)
    ('android_18__anime_girl__hot_denum_bikini.glb', 'android_18_rigged', 1.70),
    ('citlali.glb', 'citlali_rigged', 1.65),
    ('crimson_beach_siren_rias_gremory.glb', 'rias_gremory_rigged', 1.72),
    ('eishin_flash_uma_musume_pretty_derby.glb', 'eishin_flash_rigged', 1.68),
    ('eishin_flash_uma_musume_pretty_derby2.glb', 'eishin_flash_swim_rigged', 1.68),
    ('eva.glb', 'eva_asuka_rigged', 1.66),
    ('female_anime_base_model.glb', 'female_anime_base_rigged', 1.70),
    ('goku.glb', 'goku_rigged', 1.78),
    ('halo_lewd_suit__update_v2.glb', 'spartan_valkyrie_rigged', 1.80),
    ('halo_mk_v_model.glb', 'master_chief_mkv_rigged', 2.05),
    ('hinata_-_naruto_-_bikini.glb', 'hinata_bikini_rigged', 1.68),
    ('jump_force___future_trunks_by_petventh_dd3369z.glb', 'future_trunks_rigged', 1.78),
    ('kagome.glb', 'kagome_rigged', 1.65),
    ('kim_kardashian_fortnite_skin.glb', 'kim_kardashian_rigged', 1.70),
    ('kitasan_black_uma_musume_pretty_derby.glb', 'kitasan_black_rigged', 1.68),
    ('kylie_jenner_-_fortnite_skin_-_playboy_bunny.glb', 'kylie_jenner_rigged', 1.70),
    ('lowpoy_shenhe_genshin_impact.glb', 'shenhe_rigged', 1.72),
    ('lucy_edgerunner.glb', 'lucy_edgerunner_rigged', 1.68),
    ('magik_fortnite.glb', 'magik_rigged', 1.72),
    ('master_chief_-_green.glb', 'master_chief_green_rigged', 2.05),
    ('master_chief_fortnite_skin.glb', 'master_chief_fortnite_rigged', 2.05),
    ('miki_bikini_-_bourin.glb', 'miki_bikini_rigged', 1.68),
    ('mint_swimsuit_animated-_neverness_to_everness.glb', 'mint_swimsuit_rigged', 1.65),
    ('mita_ashley_-_anime_girl_-_3d_stylized_tpose.glb', 'mita_ashley_rigged', 1.68),
    ('mt._lady_-_my_hero_ultra_rumble.glb', 'mt_lady_rigged', 1.75),
    ('oguri homescreen.glb', 'oguri_cap_home_rigged', 1.68),
    ('oguri_cap_-_uma_musume.glb', 'oguri_cap_rigged', 1.68),
    ('pink_valkyrie_sci-fi_female_mech_armor_character.glb', 'pink_valkyrie_rigged', 1.75),
    ('sci-fi_girl_v.02_walkcycle_test.glb', 'scifi_girl_rigged', 1.70),
    ('skuddbutt_helen_parr.glb', 'helen_parr_rigged', 1.74),
    ('umamusume_sirius_symboli_the_twinkle_legends.glb', 'sirius_symboli_rigged', 1.70),
    ('violet_parr.glb', 'violet_parr_rigged', 1.65),
    ('vivlos_summer.glb', 'vivlos_summer_rigged', 1.65),
    ('yugi_moto.glb', 'yugi_moto_rigged', 1.68),
    ('yugioh__summoned_skull.glb', 'summoned_skull_rigged', 2.20),
    ('yugioh_evil_hero__evil_hero_dark_gaia.glb', 'dark_gaia_rigged', 2.30),
]

def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def get_mesh_bounds(meshes):
    pts = []
    for m in meshes:
        for c in m.bound_box:
            pts.append(m.matrix_world @ mathutils.Vector(c))
    if not pts:
        return (0, 0), (0, 0), (0, 0)
    min_x = min(p.x for p in pts); max_x = max(p.x for p in pts)
    min_y = min(p.y for p in pts); max_y = max(p.y for p in pts)
    min_z = min(p.z for p in pts); max_z = max(p.z for p in pts)
    return (min_x, max_x), (min_y, max_y), (min_z, max_z)

def process_character(src_filename, out_name, target_height):
    src_path = os.path.join(SRC_DIR, src_filename)
    if not os.path.exists(src_path):
        log(f"WARNING: File {src_path} does not exist. Skipping.")
        return False
        
    clean_scene()
    log(f"=== Processing [{src_filename}] -> [{out_name}] (target_height={target_height}m) ===")
    
    # 1. Load Standard Humanoid Armature with 15 Core Animations
    bpy.ops.import_scene.gltf(filepath=ANIM_REF)
    ref_arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    actions = list(bpy.data.actions)
    
    # Delete reference meshes
    for m in [o for o in bpy.data.objects if o.type == 'MESH']:
        bpy.data.objects.remove(m, do_unlink=True)
        
    # Scale ref armature to target_height (Loba is ~1.78m)
    arm_scale = target_height / 1.78
    ref_arm.scale = (arm_scale, arm_scale, arm_scale)
    bpy.context.view_layer.objects.active = ref_arm
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # 2. Import Target Character
    bpy.ops.import_scene.gltf(filepath=src_path)
    
    # Delete any existing old/broken armatures from the import
    target_arms = [o for o in bpy.data.objects if o.type == 'ARMATURE' and o != ref_arm]
    for a in target_arms:
        bpy.data.objects.remove(a, do_unlink=True)
        
    target_meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    if not target_meshes:
        log(f"ERROR: No meshes in {src_filename}!")
        return False
        
    # Clear existing modifiers/parents on target meshes
    for m in target_meshes:
        m.parent = None
        for mod in list(m.modifiers):
            if mod.type == 'ARMATURE':
                m.modifiers.remove(mod)
        m.vertex_groups.clear()
        
    # 3. Center and normalize scale
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
    
    # 4. Bind to Humanoid Armature
    bpy.ops.object.select_all(action='DESELECT')
    for m in target_meshes:
        m.select_set(True)
    ref_arm.select_set(True)
    bpy.context.view_layer.objects.active = ref_arm
    
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    except Exception as e:
        log(f"Auto-weight note: {e}, falling back to envelope")
        bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
        
    # Proximity fallback for any loose vertices
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
                
    # 5. Push NLA Tracks for GLTF export
    if not ref_arm.animation_data:
        ref_arm.animation_data_create()
    for act in actions:
        track = ref_arm.animation_data.nla_tracks.new()
        track.name = act.name
        strip = track.strips.new(act.name, int(act.frame_range[0]), act)
        strip.action = act
        
    # 6. Export Paths
    os.makedirs(ROOT_CHARS, exist_ok=True)
    os.makedirs(BIKINI_CHARS, exist_ok=True)
    os.makedirs(HALO_CHARS, exist_ok=True)
    unity_folder = os.path.join(UNITY_CHARS, out_name)
    os.makedirs(unity_folder, exist_ok=True)
    
    root_glb = os.path.join(ROOT_CHARS, f"{out_name}.glb")
    root_fbx = os.path.join(ROOT_CHARS, f"{out_name}.fbx")
    
    log(f"Exporting GLB to {root_glb}...")
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=root_glb,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS'
    )
    
    log(f"Exporting FBX to {root_fbx}...")
    bpy.ops.export_scene.fbx(
        filepath=root_fbx,
        use_selection=True,
        object_types={'ARMATURE', 'MESH'},
        bake_anim=True,
        apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_ALL'
    )
    
    # Copy to game folders
    shutil.copy2(root_glb, os.path.join(BIKINI_CHARS, f"{out_name}.glb"))
    shutil.copy2(root_glb, os.path.join(HALO_CHARS, f"{out_name}.glb"))
    shutil.copy2(root_fbx, os.path.join(unity_folder, f"{out_name}.fbx"))
    
    log(f"Completed [{out_name}] successfully!\n")
    return True

if __name__ == '__main__':
    log("=== Starting Batch Character Rigging & Animation Pipeline ===")
    success_count = 0
    total = len(CHARACTER_MANIFEST)
    
    for idx, (src_file, out_name, height) in enumerate(CHARACTER_MANIFEST, start=1):
        log(f"[{idx}/{total}] Starting {out_name}...")
        try:
            if process_character(src_file, out_name, height):
                success_count += 1
        except Exception as e:
            log(f"ERROR on {src_file}: {e}")
            
    log(f"=== BATCH COMPLETE: Successfully processed {success_count}/{total} characters! ===")
