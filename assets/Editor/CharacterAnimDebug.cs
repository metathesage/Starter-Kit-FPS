using System.Linq;
using System.Text;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

/// Dumps curve-level facts about derived clips and the controller's blend trees.
public static class CharacterAnimDebug
{
    [MenuItem("Tools/Character Anim/Debug Curves")]
    public static void Dump()
    {
        var sb = new StringBuilder();
        foreach (var key in new[] { "walk", "idle", "shoot", "dance", "slideStart", "jumpStart", "crouchFwd" })
        {
            var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>($"Assets/Animations/Derived/{key}.anim");
            if (clip == null) { sb.AppendLine($"{key}: MISSING"); continue; }
            var sb2 = new StringBuilder();
            sb2.AppendLine($"=== {key}: human={clip.isHumanMotion} len={clip.length:F2}s fps={clip.frameRate} bindings={AnimationUtility.GetCurveBindings(clip).Length}");
            foreach (var b in AnimationUtility.GetCurveBindings(clip).Take(4))
                sb2.AppendLine($"   path={b.path} | attr={b.propertyName}");
            foreach (var ax in new[] { "RootT.x", "RootT.y", "RootT.z" })
            {
                var b = new EditorCurveBinding { path = "", type = typeof(Animator), propertyName = ax };
                var c = AnimationUtility.GetEditorCurve(clip, b);
                if (c == null) { sb2.AppendLine($"   {ax}: no curve"); continue; }
                float mn = float.MaxValue, mx = float.MinValue;
                foreach (var k in c.keys) { mn = Mathf.Min(mn, k.value); mx = Mathf.Max(mx, k.value); }
                sb2.AppendLine($"   {ax}: keys={c.keys.Length} min={mn:F4} max={mx:F4}");
            }
            var hipRot = AnimationUtility.GetCurveBindings(clip)
                .Where(b => b.path.Contains("Hips") || b.path.Contains("hips") || b.path.Contains("Pelvis"))
                .Select(b => new { b.path, b.propertyName, curve = AnimationUtility.GetEditorCurve(clip, b) })
                .OrderBy(x => x.path).ThenBy(x => x.propertyName).Take(6).ToList();
            foreach (var h in hipRot)
                sb2.AppendLine($"   HIP {h.path} {h.propertyName} min={h.curve.Evaluate(0f):F2} range={Range(h.curve)}");
            sb.Append(sb2);
        }

        foreach (var fbx in new[] { "Assets/Animations/UniversalAnimationLibrary/UAL1_Standard.fbx", "Assets/Animations/UniversalAnimationLibrary/UAL2_Standard.fbx" })
        {
            foreach (var c in AssetDatabase.LoadAllAssetsAtPath(fbx).OfType<AnimationClip>())
            {
                if (!c.name.Contains("Walk_Loop") && !c.name.Contains("Dance_Loop")) continue;
                var b = new EditorCurveBinding { path = "", type = typeof(Animator), propertyName = "RootT.z" };
                var cur = AnimationUtility.GetEditorCurve(c, b);
                string r = "none";
                if (cur != null && cur.length > 0)
                {
                    float mn = float.MaxValue, mx = float.MinValue;
                    foreach (var k in cur.keys) { mn = Mathf.Min(mn, k.value); mx = Mathf.Max(mx, k.value); }
                    r = $"min={mn:F4} max={mx:F4} len={c.length:F2}";
                }
                sb.AppendLine($"SRC {c.name} [{System.IO.Path.GetFileName(fbx)}] RootT.z: {r}");
            }
        }

        var controller = AssetDatabase.LoadAssetAtPath<AnimatorController>("Assets/Animations/Controllers/CharacterAnim.controller");
        if (controller == null) { sb.AppendLine("controller MISSING"); }
        else
        {
            foreach (var layer in controller.layers)
            {
                sb.AppendLine($"--- layer {layer.name} weight={layer.defaultWeight} mask={(layer.avatarMask != null ? layer.avatarMask.name : "None")} states={layer.stateMachine.states.Length}");
                foreach (var st in layer.stateMachine.states)
                {
                    var m = st.state.motion;
                    if (m is BlendTree bt)
                        sb.AppendLine($"   {st.state.name}: blend '{bt.name}' param='{bt.blendParameter}' children=[{string.Join(", ", bt.children.Select(c => c.motion != null ? $"{c.motion.name}@{c.threshold}" : "NULL"))}]");
                    else
                        sb.AppendLine($"   {st.state.name}: motion={(m != null ? m.name : "NULL")}");
                }
            }
        }
        System.IO.File.WriteAllText("Logs/anim_debug.txt", sb.ToString());
        Debug.Log("[Debug] written to Logs/anim_debug.txt");
    }

    [MenuItem("Tools/Character Anim/Motion Probe")]
    public static void MotionProbe()
    {
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Characters/Miyazawa/Miyazawa_AnimReady.prefab");
        var controller = AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>("Assets/Animations/Controllers/CharacterAnim.controller");
        var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        try
        {
            var anim = go.GetComponentInChildren<Animator>();
            anim.runtimeAnimatorController = controller;
            Debug.Log($"[Probe] enabled={anim.enabled} active={anim.isActiveAndEnabled} isHuman={anim.avatar.isHuman} culling={anim.cullingMode}");
            anim.Play("Base Layer.Jog");
            var shin = anim.GetBoneTransform(HumanBodyBones.LeftLowerLeg);
            var arm = anim.GetBoneTransform(HumanBodyBones.LeftUpperArm);
            var hips = anim.GetBoneTransform(HumanBodyBones.Hips);
            float armAcc = 0f, shinAcc = 0f;
            Quaternion pa = arm.localRotation, ps = shin.localRotation;
            for (int i = 0; i < 40; i++)
            {
                anim.Update(0.05f);
                armAcc += Quaternion.Angle(pa, arm.localRotation); pa = arm.localRotation;
                shinAcc += Quaternion.Angle(ps, shin.localRotation); ps = shin.localRotation;
                if (i % 10 == 9)
                {
                    var si = anim.GetCurrentAnimatorStateInfo(0);
                    Debug.Log($"[Probe] t={i} state={si.fullPathHash} norm={si.normalizedTime:F2} looping={si.loop} armAcc={armAcc:F1} shinAcc={shinAcc:F1} hipsLR={hips.localRotation.eulerAngles}");
                }
            }
            Debug.Log($"[Probe] FINAL armAcc={armAcc:F1} shinAcc={shinAcc:F1}");
        }
        finally { UnityEngine.Object.DestroyImmediate(go); }
    }

    private static string Range(AnimationCurve c)
    {
        float min = float.MaxValue, max = float.MinValue;
        for (float t = 0f; t <= 1f; t += 0.01f)
        {
            var v = c.Evaluate(t * 2f);
            min = Mathf.Min(min, v); max = Mathf.Max(max, v);
        }
        return $"{min:F2}..{max:F2}";
    }
}




