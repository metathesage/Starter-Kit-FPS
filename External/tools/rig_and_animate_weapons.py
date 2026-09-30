"""
Automated weapon preparation and animation pipeline for all new Apex weapon models:
Standardizes sockets (Grip_Main, Muzzle, Sight_ADS, Weapon_Root), normalizes scale/orientation,
bakes 4 game-ready animations (Idle, Fire, Reload, Inspect), and exports to GLB and Unity FBX.
"""
import bpy
import os
import re
import math
import shutil
import mathutils

WEAPON_CONFIGS = [
    {
        'src': 'Weapons/apex_legends_car_smg_brimstone.glb',
        'key': 'car_brimstone',
        'name': 'CAR SMG (Brimstone)',
        'target_len': 0.58,
        'type': 'smg'
    },
    {
        'src': 'Weapons/apex_legends_car_smg_mythic_allfathers_fury.glb',
        'key': 'car_allfathers_fury',
        'name': 'CAR SMG Mythic (Allfathers Fury)',
        'target_len': 0.58,
        'type': 'smg'
    },
    {
        'src': 'Weapons/apex_legends_car_smg_prism_heart.glb',
        'key': 'car_prism_heart',
        'name': 'CAR SMG (Prism Heart)',
        'target_len': 0.58,
        'type': 'smg'
    },
    {
        'src': 'Weapons/apex_legends_g7_scout_relentless_pursuit.glb',
        'key': 'g7_scout',
        'name': 'G7 Scout (Relentless Pursuit)',
        'target_len': 0.98,
        'type': 'rifle'
    },
    {
        'src': 'Weapons/apex_legends_heirlooms_grand_slam.glb',
        'key': 'heirloom_grand_slam',
        'name': 'Grand Slam Heirloom',
        'target_len': 0.42,
        'type': 'melee'
    },
    {
        'src': 'Weapons/apex_legends_r99_cutting_edge.glb',
        'key': 'r99_cutting_edge',
        'name': 'R-99 (Cutting Edge)',
        'target_len': 0.54,
        'type': 'smg'
    },
    {
        'src': 'Weapons/apex_legends_r99_outlands_avalanche.glb',
        'key': 'r99_avalanche',
        'name': 'R-99 (Outlands Avalanche)',
        'target_len': 0.54,
        'type': 'smg'
    },
    {
        'src': 'Weapons/apex_legends_r99_system_error.glb',
        'key': 'r99_system_error',
        'name': 'R-99 (System Error)',
        'target_len': 0.54,
        'type': 'smg'
    },
    {
        'src': 'Weapons/apex_legends_volt_smg_tech_noir.glb',
        'key': 'volt_tech_noir',
        'name': 'Volt SMG (Tech Noir)',
        'target_len': 0.60,
        'type': 'smg'
    }
]

def compute_mesh_bounds(meshes):
    min_c = mathutils.Vector((float('inf'), float('inf'), float('inf')))
    max_c = mathutils.Vector((float('-inf'), float('-inf'), float('-inf')))
    for m in meshes:
        for c in m.bound_box:
            wc = m.matrix_world @ mathutils.Vector(c)
            for i in range(3):
                min_c[i] = min(min_c[i], wc[i])
                max_c[i] = max(max_c[i], wc[i])
    return min_c, max_c

def apply_transforms(obj, children=True):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    if children:
        for ch in obj.children:
            ch.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def bake_weapon_animations(arm, main_bone_name, is_melee=False):
    """Bake Idle, Fire, Reload, and Inspect animations onto the weapon armature."""
    arm.animation_data_create()
    pb = arm.pose.bones.get(main_bone_name) or arm.pose.bones[0]
    
    # 1. Idle (60 frames, subtle breathing/sway)
    act_idle = bpy.data.actions.new('Idle')
    arm.animation_data.action = act_idle
    bpy.context.scene.frame_set(0)
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.keyframe_insert('location', frame=0)
    pb.keyframe_insert('rotation_euler', frame=0)
    
    bpy.context.scene.frame_set(30)
    pb.location = (0, 0.001, 0.002)
    pb.rotation_euler = (math.radians(-0.25), 0, math.radians(0.35))
    pb.keyframe_insert('location', frame=30)
    pb.keyframe_insert('rotation_euler', frame=30)
    
    bpy.context.scene.frame_set(60)
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.keyframe_insert('location', frame=60)
    pb.keyframe_insert('rotation_euler', frame=60)
    
    tr_idle = arm.animation_data.nla_tracks.new()
    tr_idle.name = 'Idle'
    tr_idle.strips.new('Idle', 0, act_idle)
    
    # 2. Fire (or Swing for melee) (12 frames)
    act_fire = bpy.data.actions.new('Fire')
    arm.animation_data.action = act_fire
    bpy.context.scene.frame_set(0)
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.keyframe_insert('location', frame=0)
    pb.keyframe_insert('rotation_euler', frame=0)
    
    if not is_melee:
        # Gun recoil: kick backward (-Y) and pitch muzzle up (+X rot)
        bpy.context.scene.frame_set(2)
        pb.location = (0, -0.045, 0.006)
        pb.rotation_euler = (math.radians(4.2), 0, math.radians(0.4))
        pb.keyframe_insert('location', frame=2)
        pb.keyframe_insert('rotation_euler', frame=2)
        
        # Spring rebound
        bpy.context.scene.frame_set(6)
        pb.location = (0, 0.005, -0.001)
        pb.rotation_euler = (math.radians(-0.6), 0, math.radians(-0.1))
        pb.keyframe_insert('location', frame=6)
        pb.keyframe_insert('rotation_euler', frame=6)
    else:
        # Melee heavy swing
        bpy.context.scene.frame_set(3)
        pb.location = (-0.05, 0.08, 0.05)
        pb.rotation_euler = (math.radians(-15), math.radians(25), math.radians(-40))
        pb.keyframe_insert('location', frame=3)
        pb.keyframe_insert('rotation_euler', frame=3)
        
        bpy.context.scene.frame_set(6)
        pb.location = (0.08, -0.05, -0.05)
        pb.rotation_euler = (math.radians(20), math.radians(-30), math.radians(45))
        pb.keyframe_insert('location', frame=6)
        pb.keyframe_insert('rotation_euler', frame=6)
        
    bpy.context.scene.frame_set(12)
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.keyframe_insert('location', frame=12)
    pb.keyframe_insert('rotation_euler', frame=12)
    
    tr_fire = arm.animation_data.nla_tracks.new()
    tr_fire.name = 'Fire'
    tr_fire.strips.new('Fire', 0, act_fire)
    
    # 3. Reload (45 frames)
    act_reload = bpy.data.actions.new('Reload')
    arm.animation_data.action = act_reload
    bpy.context.scene.frame_set(0)
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.keyframe_insert('location', frame=0)
    pb.keyframe_insert('rotation_euler', frame=0)
    
    # Weapon tilts down & left to drop mag
    bpy.context.scene.frame_set(12)
    pb.location = (-0.02, -0.03, -0.04)
    pb.rotation_euler = (math.radians(-12), math.radians(-15), math.radians(10))
    pb.keyframe_insert('location', frame=12)
    pb.keyframe_insert('rotation_euler', frame=12)
    
    # Mag seated with upward pop
    bpy.context.scene.frame_set(28)
    pb.location = (0, -0.01, 0.01)
    pb.rotation_euler = (math.radians(6), math.radians(4), math.radians(-2))
    pb.keyframe_insert('location', frame=28)
    pb.keyframe_insert('rotation_euler', frame=28)
    
    # Slide rack
    bpy.context.scene.frame_set(36)
    pb.location = (0, -0.02, -0.005)
    pb.rotation_euler = (math.radians(2), math.radians(-6), math.radians(4))
    pb.keyframe_insert('location', frame=36)
    pb.keyframe_insert('rotation_euler', frame=36)
    
    # Settle to ready
    bpy.context.scene.frame_set(45)
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.keyframe_insert('location', frame=45)
    pb.keyframe_insert('rotation_euler', frame=45)
    
    tr_reload = arm.animation_data.nla_tracks.new()
    tr_reload.name = 'Reload'
    tr_reload.strips.new('Reload', 0, act_reload)
    
    # 4. Inspect (75 frames)
    act_inspect = bpy.data.actions.new('Inspect')
    arm.animation_data.action = act_inspect
    bpy.context.scene.frame_set(0)
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.keyframe_insert('location', frame=0)
    pb.keyframe_insert('rotation_euler', frame=0)
    
    # Turn left to inspect chamber
    bpy.context.scene.frame_set(22)
    pb.location = (-0.04, -0.02, 0.02)
    pb.rotation_euler = (math.radians(10), math.radians(-35), math.radians(20))
    pb.keyframe_insert('location', frame=22)
    pb.keyframe_insert('rotation_euler', frame=22)
    
    # Turn right to inspect magazine & barrel
    bpy.context.scene.frame_set(48)
    pb.location = (0.04, 0.01, -0.01)
    pb.rotation_euler = (math.radians(-8), math.radians(35), math.radians(-18))
    pb.keyframe_insert('location', frame=48)
    pb.keyframe_insert('rotation_euler', frame=48)
    
    # Return to aim
    bpy.context.scene.frame_set(75)
    pb.location = (0, 0, 0)
    pb.rotation_euler = (0, 0, 0)
    pb.keyframe_insert('location', frame=75)
    pb.keyframe_insert('rotation_euler', frame=75)
    
    tr_inspect = arm.animation_data.nla_tracks.new()
    tr_inspect.name = 'Inspect'
    tr_inspect.strips.new('Inspect', 0, act_inspect)

def process_weapon(cfg):
    src_path = cfg['src']
    key = cfg['key']
    name = cfg['name']
    target_len = cfg['target_len']
    is_melee = (cfg['type'] == 'melee')
    
    print(f"\n=======================================================")
    print(f"PROCESSING WEAPON: {name} ({key})")
    print(f"=======================================================")
    
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src_path)
    
    # 1. Clean stray helper objects (like skydive trail particles, etc.)
    for o in list(bpy.data.objects):
        if 'skydive' in o.name.lower() or 'trail' in o.name.lower():
            bpy.data.objects.remove(o, do_unlink=True)
            
    arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    
    # 2. Check alignment and bring barrel to +Y, top to +Z
    min_c, max_c = compute_mesh_bounds(meshes)
    span_x = max_c.x - min_c.x
    span_y = max_c.y - min_c.y
    span_z = max_c.z - min_c.z
    print(f"Initial spans: X={span_x:.2f}, Y={span_y:.2f}, Z={span_z:.2f}")
    
    # If X is the longest axis, rotate -90 on Z to align barrel with Y
    if span_x > span_y and span_x > span_z:
        print("Barrel aligned on X. Rotating -90 degrees on Z to align with +Y...")
        rot = mathutils.Euler((0, 0, math.radians(-90))).to_matrix().to_4x4()
        if arm:
            arm.matrix_world = rot @ arm.matrix_world
        for m in meshes:
            m.matrix_world = rot @ m.matrix_world
        if arm:
            apply_transforms(arm)
        for m in meshes:
            apply_transforms(m, children=False)
        min_c, max_c = compute_mesh_bounds(meshes)
        span_x, span_y, span_z = max_c.x - min_c.x, max_c.y - min_c.y, max_c.z - min_c.z
        
    # 3. Create or standardize Armature
    if not arm:
        print("No armature in source model. Creating standardized game-ready weapon armature...")
        arm_data = bpy.data.armatures.new(f"{key}_Rig")
        arm = bpy.data.objects.new(f"{key}_Armature", arm_data)
        bpy.context.collection.objects.link(arm)
        
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode='EDIT')
        
        # Add core socket bones
        b_root = arm_data.edit_bones.new('Weapon_Root')
        b_root.head = (0, 0, 0)
        b_root.tail = (0, 0, 0.05)
        
        b_grip = arm_data.edit_bones.new('Grip_Main')
        b_grip.head = (0, 0, 0)
        b_grip.tail = (0, 0, -0.05)
        b_grip.parent = b_root
        
        b_base = arm_data.edit_bones.new('def_c_base')
        b_base.head = (0, (min_c.y + max_c.y)/2, (min_c.z + max_c.z)/2)
        b_base.tail = (0, (min_c.y + max_c.y)/2, (min_c.z + max_c.z)/2 + 0.05)
        b_base.parent = b_root
        
        b_muzzle = arm_data.edit_bones.new('Muzzle')
        b_muzzle.head = (0, max_c.y, (min_c.z + max_c.z)/2)
        b_muzzle.tail = (0, max_c.y + 0.05, (min_c.z + max_c.z)/2)
        b_muzzle.parent = b_base
        
        b_ads = arm_data.edit_bones.new('Sight_ADS')
        b_ads.head = (0, (min_c.y + max_c.y)*0.4, max_c.z)
        b_ads.tail = (0, (min_c.y + max_c.y)*0.4, max_c.z + 0.05)
        b_ads.parent = b_base
        
        b_fore = arm_data.edit_bones.new('Grip_Forehand')
        b_fore.head = (0, min_c.y + span_y*0.65, min_c.z + span_z*0.35)
        b_fore.tail = (0, min_c.y + span_y*0.65, min_c.z + span_z*0.35 + 0.05)
        b_fore.parent = b_base
        
        bpy.ops.object.mode_set(mode='OBJECT')
        
        # Parent meshes to armature with def_c_base weight
        for m in meshes:
            m.modifiers.clear()
            vg = m.vertex_groups.new(name='def_c_base')
            all_indices = list(range(len(m.data.vertices)))
            vg.add(all_indices, 1.0, 'REPLACE')
            mod = m.modifiers.new('Armature', 'ARMATURE')
            mod.object = arm
            m.parent = arm
    else:
        # Standardize existing Apex weapon bones
        arm.name = f"{key}_Armature"
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode='EDIT')
        
        bone_names = [b.name for b in arm.data.edit_bones]
        
        # Map or ensure Grip_Main
        grip_bone = next((b for b in arm.data.edit_bones if 'propgun' in b.name.lower() or b.name == 'Grip_Main'), None)
        if grip_bone:
            grip_bone.name = 'Grip_Main'
        else:
            b_grip = arm.data.edit_bones.new('Grip_Main')
            b_grip.head = (0, 0, 0)
            b_grip.tail = (0, 0, -0.05)
            
        # Map or ensure Weapon_Root
        root_bone = next((b for b in arm.data.edit_bones if b.name in ['_rootJoint', 'weapon_bone_02', 'Weapon_Root']), None)
        if root_bone:
            root_bone.name = 'Weapon_Root'
            
        # Map or ensure Muzzle
        muzzle_bone = next((b for b in arm.data.edit_bones if 'muzzle' in b.name.lower() or b.name == 'Muzzle'), None)
        if muzzle_bone:
            muzzle_bone.name = 'Muzzle'
        else:
            b_muz = arm.data.edit_bones.new('Muzzle')
            b_muz.head = (0, max_c.y, (min_c.z + max_c.z)/2)
            b_muz.tail = (0, max_c.y + 0.05, (min_c.z + max_c.z)/2)
            
        # Map or ensure Sight_ADS
        ads_bone = next((b for b in arm.data.edit_bones if 'ads' in b.name.lower() or b.name == 'Sight_ADS'), None)
        if ads_bone:
            ads_bone.name = 'Sight_ADS'
        else:
            b_ads = arm.data.edit_bones.new('Sight_ADS')
            b_ads.head = (0, (min_c.y + max_c.y)*0.4, max_c.z)
            b_ads.tail = (0, (min_c.y + max_c.y)*0.4, max_c.z + 0.05)
            
        # Map or ensure Grip_Forehand
        if 'Grip_Forehand' not in [b.name for b in arm.data.edit_bones]:
            b_fore = arm.data.edit_bones.new('Grip_Forehand')
            b_fore.head = (0, min_c.y + span_y*0.65, min_c.z + span_z*0.35)
            b_fore.tail = (0, min_c.y + span_y*0.65, min_c.z + span_z*0.35 + 0.05)
            
        bpy.ops.object.mode_set(mode='OBJECT')
        
    # 4. Scale to target real-world length
    min_c, max_c = compute_mesh_bounds(meshes)
    raw_length = max_c.y - min_c.y
    print(f"Raw barrel length: {raw_length:.2f}, Target length: {target_len:.2f}m")
    if raw_length > 0.01:
        scale_fac = target_len / raw_length
        print(f"Applying scale factor: {scale_fac:.4f}")
        arm.scale = (scale_fac, scale_fac, scale_fac)
        for m in meshes:
            if m.parent != arm:
                m.scale = (scale_fac, scale_fac, scale_fac)
        apply_transforms(arm)
        for m in meshes:
            apply_transforms(m, children=False)
            
    # 5. Center Grip_Main exactly at (0, 0, 0)
    grip_b = arm.data.bones.get('Grip_Main')
    if grip_b:
        grip_pos = arm.matrix_world @ grip_b.head_local
        print(f"Centering grip offset: X={-grip_pos.x:.3f}, Y={-grip_pos.y:.3f}, Z={-grip_pos.z:.3f}")
        arm.location -= grip_pos
        for m in meshes:
            if m.parent != arm:
                m.location -= grip_pos
        apply_transforms(arm)
        for m in meshes:
            apply_transforms(m, children=False)
            
    # 6. Bake Game-Ready Animations (Idle, Fire, Reload, Inspect)
    main_deform_bone = next((b.name for b in arm.data.bones if 'base' in b.name.lower() or b.name == 'def_c_base'), arm.data.bones[0].name)
    bake_weapon_animations(arm, main_deform_bone, is_melee=is_melee)
    print(f"Baked 4 game-ready animations (Idle, Fire, Reload, Inspect) onto {main_deform_bone}.")
    
    # 7. Export outputs
    out_glb_root = f"Weapons/{key}_rigged.glb"
    out_fbx_root = f"Weapons/{key}_rigged.fbx"
    
    # Select all for export
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = arm
    
    # Export GLB (with baked animations, sockets, textures)
    print(f"Exporting GLB to {out_glb_root}...")
    bpy.ops.export_scene.gltf(
        filepath=out_glb_root,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
    )
    
    # Export FBX (for Unity / GunAttacher)
    print(f"Exporting FBX to {out_fbx_root}...")
    bpy.ops.export_scene.fbx(
        filepath=out_fbx_root,
        use_selection=True,
        object_types={'ARMATURE', 'MESH'},
        add_leaf_bones=False,
        bake_anim=True,
        apply_unit_scale=True,
        apply_scale_options='FBX_SCALE_ALL',
        use_armature_deform_only=False,
        mesh_smooth_type='FACE',
        path_mode='COPY',
        embed_textures=False,
    )
    
    # Copy to game asset directories
    halo_dir = "halo-waifu-arena/assets/weapons"
    unity_dir = "Assets/Weapons"
    if os.path.exists(halo_dir):
        shutil.copy2(out_glb_root, os.path.join(halo_dir, f"{key}_rigged.glb"))
    if os.path.exists(unity_dir):
        shutil.copy2(out_fbx_root, os.path.join(unity_dir, f"{key}_rigged.fbx"))
        
    print(f"SUCCESS: {name} game-ready!")
    return True

def main():
    os.makedirs("halo-waifu-arena/assets/weapons", exist_ok=True)
    os.makedirs("Assets/Weapons", exist_ok=True)
    
    for cfg in WEAPON_CONFIGS:
        if os.path.exists(cfg['src']):
            process_weapon(cfg)
        else:
            print(f"File not found: {cfg['src']}")

if __name__ == '__main__':
    main()
