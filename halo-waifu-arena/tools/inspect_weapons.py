import bpy
import os
import mathutils

weapons_dir = r"c:\Users\young\OneDrive\Documents\Desktop\GAME D3V\halo-waifu-arena\assets\weapons"
weapons = [
    'ace_of_spades_rigged.glb',
    'outbreak_perfected_rigged.glb',
    'the_chaperone_rigged.glb',
    'energy_sword_rigged.glb',
    'the_lament_rigged.glb',
    'hawkmoon_rigged.glb',
    'hanami_smg_rigged.glb',
    'sakura_shotgun_rigged.glb',
    'lotus_launcher_rigged.glb'
]

for w in weapons:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(weapons_dir, w)
    if not os.path.exists(path):
        print(f"NOT FOUND: {path}")
        continue
    bpy.ops.import_scene.gltf(filepath=path)
    
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    armatures = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    
    # Calculate bounding box in world space
    min_co = [float('inf')]*3
    max_co = [float('-inf')]*3
    
    for obj in meshes:
        for corner in obj.bound_box:
            world_co = obj.matrix_world @ mathutils.Vector(corner)
            for i in range(3):
                min_co[i] = min(min_co[i], world_co[i])
                max_co[i] = max(max_co[i], world_co[i])
                
    dx = max_co[0] - min_co[0]
    dy = max_co[1] - min_co[1]
    dz = max_co[2] - min_co[2]
    
    # Longest dimension is barrel/blade length
    longest = 'X' if dx >= dy and dx >= dz else ('Y' if dy >= dx and dy >= dz else 'Z')
    print(f"=== {w} ===")
    print(f"   Bounds: X={dx:.3f}, Y={dy:.3f}, Z={dz:.3f} | Longest={longest}")
    print(f"   Center: X={(min_co[0]+max_co[0])/2:.3f}, Y={(min_co[1]+max_co[1])/2:.3f}, Z={(min_co[2]+max_co[2])/2:.3f}")
    if armatures:
        print(f"   Armature: {armatures[0].name}, Bones ({len(armatures[0].data.bones)}): {[b.name for b in armatures[0].data.bones[:4]]}")
