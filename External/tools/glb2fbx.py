"""Convert a GLB/glTF model scene into an FBX (armature + meshes + textures)
that Unity can auto-map to Humanoid. Also supports --split-actions: export each
animation action of the file as a separa te FBX into an output directory.

Usage:
  blender --background --python glb2fbx.py -- INPUT OUTPUT [--split-actions]
Prints RESULT:{json} with stats.
"""
import re as _re
import bpy
import json
import os
import sys


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def parse_args():
    argv = sys.argv
    args = argv[argv.index("--") + 1:]
    inp, outp = args[0], args[1]
    split = "--split-actions" in args
    return inp, outp, split


def import_model(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".glb":
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".gltf":
        bpy.ops.import_scene.gltf(filepath=path)
    else:
        raise RuntimeError("unsupported ext " + ext)


def fbx_model_args(out_path):
    return dict(
        filepath=out_path,
        use_selection=True,
        object_types={"ARMATURE", "MESH"},
        add_leaf_bones=False,
        bake_anim=False,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_ALL",
        use_armature_deform_only=True,
        mesh_smooth_type="FACE",
        path_mode="COPY",
        embed_textures=False,
    )


J_BIP_MAP = {
    "J_Bip_C_Hips": "Hips",
    "J_Bip_C_Spine": "Spine",
    "J_Bip_C_Chest": "Chest",
    "J_Bip_C_UpperChest": "UpperChest",
    "J_Bip_C_Neck": "Neck",
    "J_Bip_C_Head": "Head",
    "J_Bip_L_Shoulder": "LeftShoulder",
    "J_Bip_L_UpperArm": "LeftUpperArm",
    "J_Bip_L_LowerArm": "LeftLowerArm",
    "J_Bip_L_Hand": "LeftHand",
    "J_Bip_R_Shoulder": "RightShoulder",
    "J_Bip_R_UpperArm": "RightUpperArm",
    "J_Bip_R_LowerArm": "RightLowerArm",
    "J_Bip_R_Hand": "RightHand",
    "J_Bip_L_UpperLeg": "LeftUpperLeg",
    "J_Bip_L_LowerLeg": "LeftLowerLeg",
    "J_Bip_L_Foot": "LeftFoot",
    "J_Bip_L_Ball": "LeftToes",
    "J_Bip_R_UpperLeg": "RightUpperLeg",
    "J_Bip_R_LowerLeg": "RightLowerLeg",
    "J_Bip_R_Foot": "RightFoot",
    "J_Bip_R_Ball": "RightToes",
}
FINGER_REMAP = {"Thumb": "Thumb", "Index": "Index", "Middle": "Middle",
                "Ring": "Ring", "Little": "Pinky"}


def rename_to_mixamo(arm):
    """Rename J_Bip_* (UE mannequin) bones to Unity-recognized standard names."""
    for bone in arm.data.bones:
        n = bone.name
        if n in J_BIP_MAP:
            bone.name = J_BIP_MAP[n]
            continue
        if n.startswith("J_Bip_L_Finger") or n.startswith("J_Bip_R_Finger"):
            continue  # numeric finger naming unreliable; hand mapping auto from wrist
    # second pass for exact Unity-recognized names
    return arm


UE_MAP = {
    "pelvis": "Hips",
    "spine": "SpineBase",
    "spine_01": "Spine",
    "spine_02": "Chest",
    "spine_03": "UpperChest",
    "neck_01": "Neck",
    "head": "Head",
    "clavicle_l": "LeftShoulder",
    "upperarm_l": "LeftUpperArm",
    "lowerarm_l": "LeftLowerArm",
    "hand_l": "LeftHand",
    "clavicle_r": "RightShoulder",
    "upperarm_r": "RightUpperArm",
    "lowerarm_r": "RightLowerArm",
    "hand_r": "RightHand",
    "thigh_l": "LeftUpperLeg",
    "calf_l": "LeftLowerLeg",
    "foot_l": "LeftFoot",
    "ball_l": "LeftToes",
    "thigh_r": "RightUpperLeg",
    "calf_r": "RightLowerLeg",
    "foot_r": "RightFoot",
    "ball_r": "RightToes",
    "ik_foot_root": "LeftFootIK",
    "ik_handroot_l": "LeftHandIK",
}
FINGERS = {("l", "thumb"): "Thumb", ("l", "index"): "Index", ("l", "middle"): "Middle",
           ("l", "ring"): "Ring", ("l", "pinky"): "Pinky", ("r", "thumb"): "Thumb",
           ("r", "index"): "Index", ("r", "middle"): "Middle", ("r", "ring"): "Ring",
           ("r", "pinky"): "Pinky"}
FINGERSIDE = {"thumb_01_l": ("l", "thumb", 1), "thumb_02_l": ("l", "thumb", 2), "thumb_03_l": ("l", "thumb", 3),
              "index_01_l": ("l", "index", 1), "index_02_l": ("l", "index", 2), "index_03_l": ("l", "index", 3),
              "middle_01_l": ("l", "middle", 1), "middle_02_l": ("l", "middle", 2), "middle_03_l": ("l", "middle", 3),
              "ring_01_l": ("l", "ring", 1), "ring_02_l": ("l", "ring", 2), "ring_03_l": ("l", "ring", 3),
              "pinky_01_l": ("l", "pinky", 1), "pinky_02_l": ("l", "pinky", 2), "pinky_03_l": ("l", "pinky", 3),
              "thumb_01_r": ("r", "thumb", 1), "thumb_02_r": ("r", "thumb", 2), "thumb_03_r": ("r", "thumb", 3),
              "index_01_r": ("r", "index", 1), "index_02_r": ("r", "index", 2), "index_03_r": ("r", "index", 3),
              "middle_01_r": ("r", "middle", 1), "middle_02_r": ("r", "middle", 2), "middle_03_r": ("r", "middle", 3),
              "ring_01_r": ("r", "ring", 1), "ring_02_r": ("r", "ring", 2), "ring_03_r": ("r", "ring", 3),
              "pinky_01_r": ("r", "pinky", 1), "pinky_02_r": ("r", "pinky", 2), "pinky_03_r": ("r", "pinky", 3)}
FINGERNUM = {1: "Proximal", 2: "Intermediate", 3: "Distal"}


def rename_bones(arm):
    renamed = 0
    pairs = [(b, b.name) for b in arm.data.bones]
    for b, old in pairs:
        key = old
        # strip trailing numeric suffixes and _adjust tokens: "upperarm_l_adjust_086" -> "upperarm_l"
        key = _re.sub(r'(_\d+)+$', '', key)
        key = _re.sub(r'(_adjust)+$', '', key)
        key = _re.sub(r'(_\d+)+$', '', key)
        is_leaf = key.endswith("_end")
        new = None
        if is_leaf:
            pass
        elif old in J_BIP_MAP:
            new = J_BIP_MAP[old]
        elif key in UE_MAP:
            new = UE_MAP[key]
        elif key in FINGERSIDE:
            side, finger, idx = FINGERSIDE[key]
            new = ("Left" if side == "l" else "Right") + finger + FINGERNUM[idx]
        elif key.lower() in UE_MAP:
            new = UE_MAP[key.lower()]
        if new:
            try:
                b.name = new
                renamed += 1
            except Exception:
                pass
    return renamed


def save_packed_images(out_dir):
    """GLB textures live in memory only; the FBX exporter skips them unless the
    image datablocks have real on-disk files. Save them next to the output."""
    os.makedirs(out_dir, exist_ok=True)
    saved = 0
    for img in bpy.data.images:
        try:
            _ = img.pixels[0]  # gltf importer lazy-loads; touch forces the data in
        except Exception:
            continue
        if not img.has_data or img.size[0] == 0:
            continue
        fp = bpy.path.abspath(img.filepath) if img.filepath else ""
        real_img = fp and os.path.exists(fp) and not fp.lower().endswith(
            (".glb", ".gltf", ".bin"))
        if real_img:
            continue
        safe = _re.sub(r'[^A-Za-z0-9_.-]', '_', img.name)[:60]
        if not safe.lower().endswith(".png"):
            safe += ".png"
        path = os.path.join(out_dir, safe)
        img.filepath_raw = path
        img.file_format = "PNG"
        try:
            img.save()
            saved += 1
        except Exception:
            pass
    return saved


def main():
    inp, outp, split = parse_args()
    argv = sys.argv[sys.argv.index("--") + 1:]
    limit = 0
    with_anims = "--with-anims" in argv
    if "--limit" in argv:
        limit = int(argv[argv.index("--limit") + 1])
    clear_scene()
    import_model(os.path.abspath(inp))

    arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    stats = {
        "armature": arm.name if arm else None,
        "bones": len(arm.data.bones) if arm else 0,
        "meshes": len(meshes),
        "actions": len(bpy.data.actions),
    }

    os.makedirs(os.path.dirname(os.path.abspath(outp)) or ".", exist_ok=True)

    if arm is None:
        if not meshes:
            stats["error"] = "no armature"
            print("RESULT:" + json.dumps(stats))
            return
        # mesh-only (props/guns): no armature needed
        stats["textures"] = save_packed_images(os.path.dirname(os.path.abspath(outp)))
        bpy.ops.object.select_all(action="DESELECT")
        for m in meshes:
            m.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        args = fbx_model_args(os.path.abspath(outp))
        args["object_types"] = {"MESH"}
        bpy.ops.export_scene.fbx(**args)
        stats["mesh_only"] = True
        print("RESULT:" + json.dumps(stats))
        return

    if isinstance(stats.get("bones"), int):
        pass
    n_renamed = rename_bones(arm)
    if n_renamed:
        stats["renamed"] = n_renamed

    if split:
        out_dir = outp  # directory for action FBX files
        os.makedirs(out_dir, exist_ok=True)
        # actions bound via NLA on any object; gather all actions in file
        actions = list(bpy.data.actions)
        actions.sort(key=lambda a: a.name.lower())
        if limit:
            actions = actions[:limit]
        stats["exported"] = []
        # include armature mesh-less deform: select armature only
        for act in actions:
            safe = "".join(c if (c.isalnum() or c in "-_") else "_" for c in act.name)[:80]
            fbx_path = os.path.join(out_dir, safe + ".fbx")
            arm.animation_data_create()
            arm.animation_data.action = act
            bpy.ops.object.select_all(action="DESELECT")
            arm.select_set(True)
            bpy.context.view_layer.objects.active = arm
            bpy.ops.export_scene.fbx(
                filepath=fbx_path,
                use_selection=True,
                object_types={"ARMATURE"},
                add_leaf_bones=False,
                bake_anim=True,
                bake_anim_use_all_actions=False,
                bake_anim_use_nla_strips=False,
                bake_anim_simplify_factor=0.0,
                apply_unit_scale=True,
                apply_scale_options="FBX_SCALE_ALL",
                use_armature_deform_only=True,
                path_mode="STRIP",
            )
            stats["exported"].append(safe)
        stats["actions"] = len(actions)
    else:
        stats["textures"] = save_packed_images(os.path.dirname(os.path.abspath(outp)))
        bpy.ops.object.select_all(action="DESELECT")
        arm.select_set(True)
        for m in meshes:
            m.select_set(True)
        bpy.context.view_layer.objects.active = arm
        if with_anims:
            args = fbx_model_args(os.path.abspath(outp))
            args["use_armature_deform_only"] = False
            args["bake_anim"] = True
            args["bake_anim_use_all_actions"] = True
            args["bake_anim_use_nla_strips"] = False
            args["bake_anim_simplify_factor"] = 0.0
            args["bake_anim_step"] = 1.0
            bpy.ops.export_scene.fbx(**args)
        else:
            bpy.ops.export_scene.fbx(**fbx_model_args(os.path.abspath(outp)))

    print("RESULT:" + json.dumps(stats))


main()



