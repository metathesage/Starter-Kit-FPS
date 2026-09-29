import bpy, sys, json
p = sys.argv[sys.argv.index("--") + 1:][0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=p)
out = []
for img in bpy.data.images:
    out.append({"n": img.name, "has_data": bool(img.has_data), "src": str(img.source),
                "fp": img.filepath[:40], "sz": [img.size[0], img.size[1]], "colors": img.colorspace_settings.name})
print("IMGDIAG:" + json.dumps(out))
