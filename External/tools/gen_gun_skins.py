"""Generate hue-shifted gun skin variants (pixel-level) and export FBX per skin.
Usage: blender --background --python gen_gun_skins.py -- INGLB OUTDIR [HUE_DEGS...]
Writes <out>/skins.txt listing produced files. Uses numpy (bundled with Blender).
"""
import bpy
import json
import numpy as np
import os
import sys


def hue_shift(img, deg):
    w, h = img.size
    if w == 0 or h == 0:
        return None
    n = w * h
    buf = np.empty(n * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    px = buf.reshape(-1, 4)
    rgb = px[:, :3]
    mx = rgb.max(axis=1)
    mn = rgb.min(axis=1)
    d = mx - mn
    v = mx
    s = np.where(mx > 0, d / np.where(mx == 0, 1, mx), 0)
    rc = np.zeros_like(mx)
    gc = np.zeros_like(mx)
    bc = np.zeros_like(mx)
    nz = d > 1e-8
    rmask = nz & (mx == rgb[:, 0])
    gmask = nz & (mx == rgb[:, 1]) & ~rmask
    bmask = nz & ~rmask & ~gmask
    rc[rmask] = (((rgb[:, 1] - rgb[:, 2]) / d)[rmask] % 6)
    gc[gmask] = (((rgb[:, 2] - rgb[:, 0]) / d)[gmask] + 2)
    bc[bmask] = (((rgb[:, 0] - rgb[:, 1]) / d)[bmask] + 4)
    hue = np.where(d > 1e-8, (rc + gc + bc) / 6.0, 0.0)
    hue = (hue + (deg / 360.0)) % 1.0
    i = np.floor(hue * 6.0).astype(int) % 6
    f = hue * 6.0 - np.floor(hue * 6.0)
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    out = np.zeros_like(rgb)
    sel = i == 0; out[sel] = np.stack([v[sel], t[sel], p[sel]], axis=1)
    sel = i == 1; out[sel] = np.stack([q[sel], v[sel], p[sel]], axis=1)
    sel = i == 2; out[sel] = np.stack([p[sel], v[sel], t[sel]], axis=1)
    sel = i == 3; out[sel] = np.stack([p[sel], q[sel], v[sel]], axis=1)
    sel = i == 4; out[sel] = np.stack([t[sel], p[sel], v[sel]], axis=1)
    sel = i == 5; out[sel] = np.stack([v[sel], p[sel], q[sel]], axis=1)
    px[:, :3] = out
    new = bpy.data.images.new(img.name + "_shift", w, h, alpha=True)
    new.pixels.foreach_set(px.ravel())
    return new


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    inp, outdir = args[0], args[1]
    shifts = [float(a) for a in args[2:]] or [60.0, 140.0, 220.0, 300.0]
    stem = os.path.splitext(os.path.basename(inp))[0]
    os.makedirs(outdir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(inp))
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        print("RESULT:" + json.dumps({"error": "no meshes"}))
        return

    # remember ORIGINAL pixel data per image (shifts must not stack)
    originals = {}
    tex_nodes = []
    for mat in bpy.data.materials:
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image:
                    originals[node.image] = np.array(node.image.pixels[:])
                    tex_nodes.append((node, node.image))

    produced = []
    bpy.ops.object.select_all(action="DESELECT")
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]

    for deg in shifts:
        name = f"{stem}_skin_{int(deg):03d}"
        for node, orig in tex_nodes:  # reset to unshifted source first
            node.image = orig
        for node, orig in tex_nodes:
            src = orig
            buf = np.empty(originals[src].shape[0], dtype=np.float32)
            buf[:] = originals[src]
            tmp = bpy.data.images.new("tmp", src.size[0], src.size[1], alpha=True)
            tmp.pixels.foreach_set(buf)
            shifted = hue_shift(tmp, deg)
            bpy.data.images.remove(tmp)
            if shifted is None:
                continue
            png = os.path.join(outdir, name + ".png")
            shifted.filepath_raw = png
            shifted.file_format = "PNG"
            shifted.save()
            node.image = shifted
        fbx = os.path.join(outdir, name + ".fbx")
        bpy.ops.export_scene.fbx(
            filepath=fbx,
            use_selection=True,
            object_types={"MESH"},
            add_leaf_bones=False,
            bake_anim=False,
            path_mode="COPY",
            embed_textures=False,
            apply_unit_scale=True,
            apply_scale_options="FBX_SCALE_ALL",
            mesh_smooth_type="FACE",
        )
        produced.append(fbx)

    with open(os.path.join(outdir, "skins.txt"), "w") as fh:
        fh.write("\n".join(produced))
    print("RESULT:" + json.dumps({"skins": [os.path.basename(p) for p in produced]}))


main()
