import struct
import json
import os

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
    path = os.path.join(weapons_dir, w)
    if not os.path.exists(path):
        print("Missing:", w)
        continue
    with open(path, 'rb') as f:
        magic, ver, length = struct.unpack('<III', f.read(12))
        chunk_len, chunk_type = struct.unpack('<II', f.read(8))
        json_data = json.loads(f.read(chunk_len).decode('utf-8'))
        
    print(f"\n=== {w} ===")
    nodes = json_data.get('nodes', [])
    for idx, node in enumerate(nodes[:5]):
        print(f"  node[{idx}] {node.get('name')}: rot={node.get('rotation')}, scale={node.get('scale')}, trans={node.get('translation')}")
    
    # Check accessors for min/max to find actual mesh extents
    accessors = json_data.get('accessors', [])
    mins = [float('inf')]*3
    maxs = [float('-inf')]*3
    for a in accessors:
        if 'min' in a and 'max' in a and len(a['min']) == 3:
            for i in range(3):
                mins[i] = min(mins[i], a['min'][i])
                maxs[i] = max(maxs[i], a['max'][i])
    dx = maxs[0] - mins[0]
    dy = maxs[1] - mins[1]
    dz = maxs[2] - mins[2]
    print(f"  Accessors Extents: X={dx:.3f}, Y={dy:.3f}, Z={dz:.3f}")
    print(f"  Min: {[round(x, 3) for x in mins]} Max: {[round(x, 3) for x in maxs]}")
