import bpy, sys, json
p = sys.argv[sys.argv.index("--") + 1:][0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=p)
for img in bpy.data.images:
    try:
        _ = img.pixels[0]          # force lazy load
    except Exception as e:
        print("ACCESSERR", img.name, str(e)[:80])
    print(json.dumps({"n": img.name, "has_data": bool(img.has_data), "sz": [img.size[0], img.size[1]]}))
    # try pack + save
    try:
        img.filepath_raw = sys.argv[-1] + "_" + img.name + ".png"
        img.file_format = "PNG"
        img.save()
        print("SAVED", img.name, img.filepath_raw)
    except Exception as e:
        print("SAVEERR", img.name, str(e)[:120])
