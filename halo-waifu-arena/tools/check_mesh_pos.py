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
    with open(path, 'rb') as f:
        magic, ver, length = struct.unpack('<III', f.read(12))
        chunk_len, chunk_type = struct.unpack('<II', f.read(8))
        json_data = json.loads(f.read(chunk_len).decode('utf-8'))
    
    # Read position accessors
    pos_accessor_idx = None
    for m in json_data.get('meshes', []):
        for p in m.get('primitives', []):
            if 'POSITION' in p.get('attributes', {}):
                pos_accessor_idx = p['attributes']['POSITION']
                break
        if pos_accessor_idx is not None:
            break
            
    if pos_accessor_idx is not None:
        acc = json_data['accessors'][pos_accessor_idx]
        print(f"{w}: min={acc.get('min')} max={acc.get('max')}")
