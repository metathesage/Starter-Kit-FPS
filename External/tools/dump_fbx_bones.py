import bpy, sys, json, os
path = sys.argv[sys.argv.index("--") + 1:][0]
try:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=path)
    arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    if arm is None:
        objs = [o.name for o in bpy.data.objects][:10]
        print("RESULT:" + json.dumps({"f": os.path.basename(path), "arm": None, "objs": objs}))
    else:
        names = [b.name for b in arm.data.bones][:40]
        print("RESULT:" + json.dumps({"f": os.path.basename(path), "bones": len(arm.data.bones), "names": names}))
except Exception as e:
    print("RESULT:" + json.dumps({"f": os.path.basename(path), "error": str(e)[:200]}))
