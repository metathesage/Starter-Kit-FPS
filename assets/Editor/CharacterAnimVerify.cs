using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

/// Headless proof-of-motion: instantiates each ready prefab, drives the animator
/// via Animator.Update() in edit mode and measures LOCAL BONE ROTATION per state
/// (rotation is immune to root-motion/world-position artifacts of editor updates).
/// Run: Unity -batchmode -executeMethod CharacterAnimVerify.VerifyAll
public static class CharacterAnimVerify
{
    private const string ControllerPath = "Assets/Animations/Controllers/CharacterAnim.controller";
    // Optional: -mocapEvery N as extra command-line arg samples X_* mocap states
    // (1 = every state, default 1). Use e.g. 12 when the mocap library is huge.
    private static int MocapEvery
    {
        get
        {
            var a = System.Environment.GetCommandLineArgs();
            for (int i = 0; i < a.Length - 1; i++)
                if (a[i] == "-mocapEvery" && int.TryParse(a[i + 1], out int n) && n > 0) return n;
            return 1;
        }
    }
    private static string[] DiscoverPrefabs()
    {
        var guids = AssetDatabase.FindAssets("t:Prefab _AnimReady", new[] { "Assets/Characters" });
        var list = new List<string>();
        foreach (var g in guids)
        {
            var p = AssetDatabase.GUIDToAssetPath(g);
            if (p.EndsWith("_AnimReady.prefab")) list.Add(p);
        }
        list.Sort();
        return list.ToArray();
    }

    [MenuItem("Tools/Character Anim/Verify Motion")]
    public static void VerifyAll()
    {
        var controller = AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(ControllerPath);
        if (controller == null) { Debug.LogError("[Verify] controller missing"); return; }

        foreach (var prefabPath in DiscoverPrefabs())
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
            if (prefab == null) { Debug.LogWarning($"[Verify] missing {prefabPath}"); continue; }
            var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            go.transform.position = Vector3.zero;
            try { VerifyOne(go, controller); }
            finally { Object.DestroyImmediate(go); }
        }
        Debug.Log("[Verify] ===== VERIFY DONE =====");
        AssetDatabase.Refresh();
    }

    private static void VerifyOne(GameObject go, RuntimeAnimatorController controller)
    {
        var anim = go.GetComponentInChildren<Animator>();
        if (anim == null) { Log(go.name, "animator", false, ""); return; }
        if (anim.avatar == null || !anim.avatar.isHuman)
        {
            VerifyGeneric(go, anim);
            return;
        }
        anim.runtimeAnimatorController = controller;
        anim.cullingMode = AnimatorCullingMode.AlwaysAnimate;

        var leftLeg = anim.GetBoneTransform(HumanBodyBones.LeftLowerLeg);
        var leftThigh = anim.GetBoneTransform(HumanBodyBones.LeftUpperLeg);
        var leftForearm = anim.GetBoneTransform(HumanBodyBones.LeftLowerArm);
        var rightForearm = anim.GetBoneTransform(HumanBodyBones.RightLowerArm);
        if (leftLeg == null || leftThigh == null || leftForearm == null || rightForearm == null)
        {
            Log(go.name, "bones", false, "GetBoneTransform returned null");
            return;
        }

        anim.SetFloat("Speed", 0f);
        anim.SetBool("Grounded", true);
        anim.Play("Base Layer.Idle");
        for (int i = 0; i < 10; i++) anim.Update(0.05f);

        Test(go.name, "walk (Speed 1.5, left shin rot)", anim, () => anim.SetFloat("Speed", 1.5f), leftLeg, 30);
        Test(go.name, "jog (Speed 3.2, left shin rot)", anim, () => anim.SetFloat("Speed", 3.2f), leftLeg, 30);
        Test(go.name, "sprint (Speed 5.5, left shin rot)", anim, () => anim.SetFloat("Speed", 5.5f), leftLeg, 30);
        Test(go.name, "crouch (Speed 0, left shin bend)", anim, () => { anim.SetFloat("Speed", 0f); anim.SetBool("Crouch", true); }, leftLeg, 30);
        anim.SetBool("Crouch", false);
        for (int i = 0; i < 10; i++) anim.Update(0.05f);
        anim.SetLayerWeight(1, 1f);
        anim.Play("AimIdle", 1);
        for (int i = 0; i < 5; i++) anim.Update(0.05f);
        Test(go.name, "shoot (right forearm rot)", anim, () => anim.Play("Shoot", 1), rightForearm, 25);
        anim.Play("AimIdle", 1);
        for (int i = 0; i < 8; i++) anim.Update(0.05f);
        Test(go.name, "reload (right forearm rot)", anim, () => anim.Play("Reload", 1), rightForearm, 30);
        Test(go.name, "slide (left thigh rot)", anim, () => anim.Play("Base Layer.SlideStart"), leftThigh, 20);
        Test(go.name, "dance (left forearm rot)", anim, () => { anim.SetLayerWeight(2, 1f); anim.Play("Dance", 2); }, leftForearm, 30);
        Test(go.name, "jump (left thigh rot)", anim, () => { anim.SetLayerWeight(2, 0f); anim.Play("Base Layer.JumpStart"); }, leftThigh, 20);

        // Mesh2Motion / extra mocap states (X_*): each playable via Play().
        var ac = controller as UnityEditor.Animations.AnimatorController;
        if (ac != null)
        {
            int xi = 0;
            foreach (var st in ac.layers[0].stateMachine.states)
            {
                if (!st.state.name.StartsWith("X_", System.StringComparison.Ordinal)) continue;
                bool sample = (xi++ % MocapEvery) == 0;
                if (!sample) continue;
                Test(go.name, $"mocap {st.state.name}", anim, () =>
                {
                    anim.SetLayerWeight(1, 0f);
                    anim.Play(st.state.name);
                }, leftForearm, 40);
                anim.SetLayerWeight(1, 1f);
                anim.Play("Base Layer.Idle");
                for (int i = 0; i < 6; i++) anim.Update(0.05f);
            }
        }
    }

    // Generic (quadruped/creature) prefabs ship their own controller: play each
    // state and measure accumulated local rotation across the whole skeleton.
    private static void VerifyGeneric(GameObject go, Animator anim)
    {
        anim.cullingMode = AnimatorCullingMode.AlwaysAnimate;
        var ac = anim.runtimeAnimatorController as UnityEditor.Animations.AnimatorController;
        if (ac == null || ac.layers.Length == 0)
        {
            Log(go.name, "controller", false, "no AnimatorController");
            return;
        }
        var bones = anim.transform.GetComponentsInChildren<Transform>(true)
            .Take(24).ToArray();
        foreach (var st in ac.layers[0].stateMachine.states)
        {
            anim.Play(st.state.name);
            float total = 0f;
            var prev = bones.Select(b => b.localRotation).ToArray();
            for (int i = 0; i < 40; i++)
            {
                anim.Update(0.05f);
                for (int b = 0; b < bones.Length; b++)
                {
                    total += Quaternion.Angle(prev[b], bones[b].localRotation);
                    prev[b] = bones[b].localRotation;
                }
            }
            Log(go.name, $"state {st.state.name}", total > 15f, $"localRotAccum={total:F1}deg");
        }
    }

    private static void Test(string who, string label, Animator anim, System.Action setup,
                             Transform bone, int frames)
    {
        setup();
        float total = 0f;
        var prev = bone.localRotation;
        for (int i = 0; i < frames; i++)
        {
            anim.Update(0.05f);
            var cur = bone.localRotation;
            total += Quaternion.Angle(prev, cur);
            prev = cur;
        }
        bool moved = total > 15f;   // degrees of accumulated local rotation
        Log(who, label, moved, $"localRotAccum={total:F1}deg");
    }

    private static void Log(string who, string label, bool pass, string detail)
    {
        Debug.Log($"[Verify] {who} | {label} | {(pass ? "PASS" : "FAIL")} | {detail}");
    }
}





