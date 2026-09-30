"""
Full automated pipeline: Standardize skeleton/rig, animate, and export Apex character models
(Loba, Wraith Void Prowler, Revenant) for WebGL/Three.js (.glb) and Unity Humanoid (.fbx).
"""
import bpy
import os
import re
import math
import shutil
import mathutils

APEX_BONE_MAP = {
    # Torso & Spine
    'def_c_hip': 'Hips',
    'def_c_spinea': 'Spine',
    'def_c_spineb': 'Chest',
    'def_c_spinec': 'UpperChest',
    'def_c_necka': 'Neck',
    'def_c_neckb': 'Neck1',
    'def_c_head': 'Head',
    
    # Left Arm
    'def_l_clav': 'LeftShoulder',
    'def_l_clavicle': 'LeftShoulder',
    'def_l_shoulder': 'LeftUpperArm',
    'def_l_forearm': 'LeftLowerArm',
    'def_l_elbow': 'LeftLowerArm',
    'def_l_wrist': 'LeftHand',
    'def_l_hand': 'LeftHand',
    
    # Right Arm
    'def_r_clav': 'RightShoulder',
    'def_r_clavicle': 'RightShoulder',
    'def_r_shoulder': 'RightUpperArm',
    'def_r_forearm': 'RightLowerArm',
    'def_r_elbow': 'RightLowerArm',
    'def_r_wrist': 'RightHand',
    'def_r_hand': 'RightHand',
    
    # Left Leg
    'def_l_thigh': 'LeftUpperLeg',
    'def_l_knee': 'LeftLowerLeg',
    'def_l_leg': 'LeftLowerLeg',
    'def_l_ankle': 'LeftFoot',
    'def_l_foot': 'LeftFoot',
    'def_l_toe': 'LeftToes',
    'def_l_toes': 'LeftToes',
    'def_l_ball': 'LeftToes',
    
    # Right Leg
    'def_r_thigh': 'RightUpperLeg',
    'def_r_knee': 'RightLowerLeg',
    'def_r_leg': 'RightLowerLeg',
    'def_r_ankle': 'RightFoot',
    'def_r_foot': 'RightFoot',
    'def_r_toe': 'RightToes',
    'def_r_toes': 'RightToes',
    'def_r_ball': 'RightToes',
}

FINGER_MAP = {
    'finthumba': 'ThumbProximal',
    'finthumbb': 'ThumbIntermediate',
    'finthumbc': 'ThumbDistal',
    'finindexa': 'IndexProximal',
    'finindexb': 'IndexIntermediate',
    'finindexc': 'IndexDistal',
    'finmida': 'MiddleProximal',
    'finmidb': 'MiddleIntermediate',
    'finmidc': 'MiddleDistal',
    'finringa': 'RingProximal',
    'finringb': 'RingIntermediate',
    'finringc': 'RingDistal',
    'finpinkya': 'LittleProximal',
    'finpinkyb': 'LittleIntermediate',
    'finpinkyc': 'LittleDistal',
}

ACTIONS_TO_BAKE = [
    'Idle_Loop',
    'Walk_Loop',
    'Sprint_Loop',
    'Jog_Fwd_Loop',
    'Crouch_Idle_Loop',
    'Crouch_Fwd_Loop',
    'Pistol_Aim_Neutral',
    'Pistol_Shoot',
    'Pistol_Reload',
    'Jump_Start',
    'Jump_Loop',
    'Jump_Land',
    'Death01',
    'Dance_Loop',
    'Roll',
]

def clean_bone_key(name):
    k = re.sub(r'(_\d+)+$', '', name.lower())
    k = re.sub(r'(_end)+$', '', k)
    return k

def map_bone_name(old_name):
    k = clean_bone_key(old_name)
    if k in APEX_BONE_MAP:
        return APEX_BONE_MAP[k]
    
    for f_key, f_val in FINGER_MAP.items():
        if f_key in k:
            side = 'Left' if '_l_' in k else 'Right'
            return side + f_val
            
    return None

def compute_bounds(meshes):
    min_c = mathutils.Vector((float('inf'), float('inf'), float('inf')))
    max_c = mathutils.Vector((float('-inf'), float('-inf'), float('-inf')))
    for m in meshes:
        for c in m.bound_box:
            wc = m.matrix_world @ mathutils.Vector(c)
            for i in range(3):
                min_c[i] = min(min_c[i], wc[i])
                max_c[i] = max(max_c[i], wc[i])
    return min_c, max_c

def apply_all_transforms(arm, meshes):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def process_character(input_glb, name, target_height=1.75, ual_library_path='characters_archive/ual1_standard.glb'):
    print(f"\n=======================================================")
    print(f"PROCESSING: {name} from {input_glb}")
    print(f"=======================================================")
    
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=input_glb)
    
    # 1. Clean scene: remove stray unskinned objects (Icospheres, etc.)
    to_delete = []
    arm = None
    for o in bpy.data.objects:
        if o.type == 'ARMATURE':
            arm = o
        elif o.type == 'MESH':
            if o.name.lower().startswith('icosphere') or len(o.vertex_groups) == 0:
                to_delete.append(o)
                
    for o in to_delete:
        print(f"Removing unskinned/test object: {o.name}")
        bpy.data.objects.remove(o, do_unlink=True)
        
    if not arm:
        print(f"ERROR: No armature found in {input_glb}")
        return False
        
    arm.name = f"{name}_Armature"
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    
    # 2. Standardize Bone Names
    renamed = 0
    mapping_used = {}
    for b in arm.data.bones:
        new_name = map_bone_name(b.name)
        if new_name and new_name not in arm.data.bones:
            mapping_used[b.name] = new_name
            b.name = new_name
            renamed += 1
    print(f"Renamed {renamed} bones to standard Humanoid names.")
    
    # 3. Orient Upright (+Z up, +Y forward)
    min_c, max_c = compute_bounds(meshes)
    span_x = max_c.x - min_c.x
    span_y = max_c.y - min_c.y
    span_z = max_c.z - min_c.z
    print(f"Initial spans: X={span_x:.2f}, Y={span_y:.2f}, Z={span_z:.2f}")
    
    if span_y > span_z and span_y > span_x:
        print("Detected Y-up coordinates. Rotating +90 degrees around X to bring upright to Z...")
        rot = mathutils.Euler((math.radians(90), 0, 0)).to_matrix().to_4x4()
        arm.matrix_world = rot @ arm.matrix_world
        for m in meshes:
            m.matrix_world = rot @ m.matrix_world
        apply_all_transforms(arm, meshes)
        min_c, max_c = compute_bounds(meshes)
        
    # 4. Scale to real-world character height
    current_height = max_c.z - min_c.z
    print(f"Current height: {current_height:.3f}m, Target: {target_height:.3f}m")
    if current_height > 0.01:
        scale_fac = target_height / current_height
        print(f"Applying uniform scale factor: {scale_fac:.4f}")
        arm.scale = (scale_fac, scale_fac, scale_fac)
        for m in meshes:
            if m.parent != arm:
                m.scale = (scale_fac, scale_fac, scale_fac)
        apply_all_transforms(arm, meshes)
        min_c, max_c = compute_bounds(meshes)
        
    # 5. Ground feet to Z=0 and center X and Y to 0
    offset_x = (min_c.x + max_c.x) / 2.0
    offset_y = (min_c.y + max_c.y) / 2.0
    offset_z = min_c.z
    print(f"Grounded offset: X={-offset_x:.3f}, Y={-offset_y:.3f}, Z={-offset_z:.3f}")
    
    arm.location.x -= offset_x
    arm.location.y -= offset_y
    arm.location.z -= offset_z
    for m in meshes:
        if m.parent != arm:
            m.location.x -= offset_x
            m.location.y -= offset_y
            m.location.z -= offset_z
    apply_all_transforms(arm, meshes)
    
    # 6. Retarget and bake animations from UAL library
    if os.path.exists(ual_library_path):
        print(f"Importing animations from {ual_library_path}...")
        bpy.ops.import_scene.gltf(filepath=ual_library_path)
        arm_src = next(o for o in bpy.data.objects if o.type == 'ARMATURE' and o != arm)
        arm_src.name = "UAL_SOURCE"
        
        # Bone correspondence: Standardized target bone -> UAL source bone
        retarget_map = {
            'Hips': 'pelvis',
            'Spine': 'spine_01',
            'Chest': 'spine_02',
            'UpperChest': 'spine_03',
            'Neck': 'neck_01',
            'Head': 'Head',
            'LeftShoulder': 'clavicle_l',
            'LeftUpperArm': 'upperarm_l',
            'LeftLowerArm': 'lowerarm_l',
            'LeftHand': 'hand_l',
            'RightShoulder': 'clavicle_r',
            'RightUpperArm': 'upperarm_r',
            'RightLowerArm': 'lowerarm_r',
            'RightHand': 'hand_r',
            'LeftUpperLeg': 'thigh_l',
            'LeftLowerLeg': 'calf_l',
            'LeftFoot': 'foot_l',
            'RightUpperLeg': 'thigh_r',
            'RightLowerLeg': 'calf_r',
            'RightFoot': 'foot_r',
        }
        
        baked_count = 0
        arm.animation_data_create()
        
        for act_name in ACTIONS_TO_BAKE:
            act = bpy.data.actions.get(act_name)
            if not act:
                continue
                
            # Set source action
            arm_src.animation_data_create()
            arm_src.animation_data.action = act
            f_start = int(act.frame_range[0])
            f_end = int(act.frame_range[1])
            
            # Clear any previous constraints
            for pb in arm.pose.bones:
                for c in list(pb.constraints):
                    pb.constraints.remove(c)
                    
            # Add constraints
            for tgt_b, src_b in retarget_map.items():
                pb = arm.pose.bones.get(tgt_b)
                if pb and src_b in arm_src.data.bones:
                    c = pb.constraints.new('COPY_ROTATION')
                    c.target = arm_src
                    c.subtarget = src_b
                    c.target_space = 'LOCAL'
                    c.owner_space = 'LOCAL'
                    
            pb_hips = arm.pose.bones.get('Hips')
            if pb_hips and 'pelvis' in arm_src.data.bones:
                c_loc = pb_hips.constraints.new('COPY_LOCATION')
                c_loc.target = arm_src
                c_loc.subtarget = 'pelvis'
                c_loc.target_space = 'LOCAL'
                c_loc.owner_space = 'LOCAL'
                
            # Bake action
            bpy.context.view_layer.objects.active = arm
            bpy.ops.object.select_all(action='DESELECT')
            arm.select_set(True)
            
            bpy.ops.nla.bake(
                frame_start=f_start,
                frame_end=f_end,
                only_selected=False,
                visual_keying=True,
                clear_constraints=True,
                clear_parents=False,
                use_current_action=False,
                bake_types={'POSE'}
            )
            
            baked_act = arm.animation_data.action
            if baked_act:
                baked_act.name = act_name
                # Push to NLA Track
                track = arm.animation_data.nla_tracks.new()
                track.name = act_name
                track.strips.new(act_name, f_start, baked_act)
                baked_count += 1
                
        print(f"Baked and queued {baked_count} animation clips to NLA tracks.")
        
        # Remove UAL Source object and its unskinned meshes
        ual_objs = [o for o in bpy.data.objects if o.name.startswith('UAL') or o.name.startswith('Mannequin')]
        for o in ual_objs:
            bpy.data.objects.remove(o, do_unlink=True)
            
    # 7. Export Outputs
    out_glb_root = f"{name}_rigged.glb"
    out_fbx_char = f"Characters/{name}_rigged.fbx"
    out_glb_char = f"Characters/{name}_rigged.glb"
    
    os.makedirs("Characters", exist_ok=True)
    os.makedirs(f"Assets/Characters/{name}", exist_ok=True)
    
    # Export GLB (with baked animations, textures, armature)
    print(f"Exporting rigged GLB to {out_glb_root}...")
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = arm
    
    bpy.ops.export_scene.gltf(
        filepath=out_glb_root,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
    )
    shutil.copy2(out_glb_root, out_glb_char)
    
    # Export FBX (Unity Humanoid ready)
    print(f"Exporting Humanoid FBX to {out_fbx_char}...")
    bpy.ops.export_scene.fbx(
        filepath=out_fbx_char,
        use_selection=True,
        object_types={'ARMATURE', 'MESH'},
        add_leaf_bones=False,
        bake_anim=True,
        apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_ALL',
        use_armature_deform_only=True,
        mesh_smooth_type='FACE',
        path_mode='COPY',
        embed_textures=False,
    )
    shutil.copy2(out_fbx_char, f"Assets/Characters/{name}/{name}_rigged.fbx")
    
    # Copy to game asset directories
    halo_dir = "halo-waifu-arena/assets/chars"
    bikini_dir = "bikini-royal-waifus/public/assets/characters/animated"
    if os.path.exists(halo_dir):
        shutil.copy2(out_glb_root, os.path.join(halo_dir, f"{name}.glb"))
    if os.path.exists(bikini_dir):
        shutil.copy2(out_glb_root, os.path.join(bikini_dir, f"{name}.glb"))
        
    print(f"SUCCESS: {name} fully rigged, animated, and exported!")
    return True

def main():
    targets = [
        ('loba_3d_model_apex_legends.glb', 'loba', 1.78),
        ('wraith_void_prowler_from_apex_legends.glb', 'wraith_void_prowler', 1.70),
        ('Weapons/apex_legend_revenant.glb', 'revenant', 1.95),
    ]
    
    for glb_path, name, height in targets:
        if os.path.exists(glb_path):
            process_character(glb_path, name, target_height=height)
        else:
            print(f"File not found: {glb_path}")

if __name__ == '__main__':
    main()
