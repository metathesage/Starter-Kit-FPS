"""Scan GLB/VRM files: report armature presence, bone count, bone-name sample.
Usage: blender --background --python scan_glbs.py -- LISTFILE
LISTFILE: one path per line. Prints RESULT:{json} per file.
"""
import bpy
import json
import os
import sys


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def sample_names(bones, want=("hips", "spine", "head", "arm", "leg", "shoulder")):
    hits = []
    for b in bones:
        ln = b.name.lower()
        if any(w in ln for w in want):
            hits.append(b.name)
        if len(hits) >= 14:
            break
    return hits


def scan(path):
    try:
        clear_scene()
        bpy.ops.import_scene.gltf(filepath=path)
        arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
        meshes = [o for o in bpy.data.objects if o.type == "MESH"]
        actions = len(bpy.data.actions)
        if arm is None:
            return {"f": os.path.basename(path), "arm": None, "bones": 0,
                    "meshes": len(meshes), "actions": actions}
        return {"f": os.path.basename(path), "arm": arm.name,
                "bones": len(arm.data.bones), "meshes": len(meshes),
                "actions": actions, "sample": sample_names(arm.data.bones)}
    except Exception as e:
        return {"f": os.path.basename(path), "error": str(e)[:120]}


def main():
    listfile = sys.argv[sys.argv.index("--") + 1:][0]
    with open(listfile, "r", encoding="utf-8") as fh:
        paths = [l.strip() for l in fh if l.strip()]
    for p in paths:
        if not os.path.exists(p):
            print("RESULT:" + json.dumps({"f": p, "error": "missing"}), flush=True)
            continue
        print("RESULT:" + json.dumps(scan(p), ensure_ascii=True), flush=True)


main()


