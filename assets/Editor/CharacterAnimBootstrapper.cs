using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using CharacterRig;

/// One-shot setup: configures Humanoid importers, builds a shared Animator
/// Controller wired to the Universal Animation Library clips, creates
/// "AnimReady" prefabs and a demo scene.
/// Menu: Tools > Character Anim > Setup Everything  (also runs headless via
/// Unity -batchmode -executeMethod CharacterAnimBootstrapper.SetupAll)
public static class CharacterAnimBootstrapper
{
    private static readonly (string name, string fbx, string prefab)[] Characters =
    {
        ("Miyazawa",  "Assets/Characters/Miyazawa/chr100_000_00.fbx",                    "Assets/Characters/Miyazawa/Miyazawa_AnimReady.prefab"),
        ("MaiMaid",   "Assets/Characters/MaiMaid/PL002_000.fbx",                          "Assets/Characters/MaiMaid/MaiMaid_AnimReady.prefab"),
        ("Elaina",    "Assets/Characters/Elaina/YLN_GYRemakeF3.fbx",                      "Assets/Characters/Elaina/Elaina_AnimReady.prefab"),
        ("LucyED",    "Assets/Characters/LucyED/LucyED.fbx",                     "Assets/Characters/LucyED/LucyED_AnimReady.prefab"),
        ("WuwaLucy",  "Assets/Characters/WuwaLucy/Wuwalucy.fbx",                          "Assets/Characters/WuwaLucy/WuwaLucy_AnimReady.prefab"),
        ("Kagome",    "Assets/Characters/Kagome/Kagome_rigged.fbx",                       "Assets/Characters/Kagome/Kagome_AnimReady.prefab"),
        ("PsxDoctor", "Assets/Characters/PsxDoctor/Character_23_Female_Doctor.fbx",       "Assets/Characters/PsxDoctor/PsxDoctor_AnimReady.prefab"),
 ("Swat",      "Assets/Characters/Swat/Swat.fbx",                                  "Assets/Characters/Swat/Swat_AnimReady.prefab"),
 ("Kasumi",    "Assets/Characters/Kasumi/Kasumi.fbx",                              "Assets/Characters/Kasumi/Kasumi_AnimReady.prefab"),
 ("SciFiWaifu","Assets/Characters/SciFiWaifu/SciFiWaifu.fbx",                      "Assets/Characters/SciFiWaifu/SciFiWaifu_AnimReady.prefab"),
 ("Pomni",     "Assets/Characters/Pomni/Pomni.fbx",                           "Assets/Characters/Pomni/Pomni_AnimReady.prefab"),
 ("Gekkou",    "Assets/Characters/Gekkou/Gekkou.fbx",                                "Assets/Characters/Gekkou/Gekkou_AnimReady.prefab"),
 ("Kurenai",   "Assets/Characters/Kurenai/Kurenai.fbx",                              "Assets/Characters/Kurenai/Kurenai_AnimReady.prefab"),
 ("Shogun",    "Assets/Characters/Shogun/Shogun.fbx",                                "Assets/Characters/Shogun/Shogun_AnimReady.prefab"),
 ("Samidale",  "Assets/Characters/Samidale/Samidale.fbx",                            "Assets/Characters/Samidale/Samidale_AnimReady.prefab"),
 ("Drizzle",   "Assets/Characters/Drizzle/Drizzle.fbx",                              "Assets/Characters/Drizzle/Drizzle_AnimReady.prefab"),
 ("Kasa",      "Assets/Characters/Kasa/Kasa.fbx",                                    "Assets/Characters/Kasa/Kasa_AnimReady.prefab"),
 ("Sofia",     "Assets/Characters/Sofia/Sofia.fbx",                                  "Assets/Characters/Sofia/Sofia_AnimReady.prefab"),
    };
    private const string Ual1Fbx = "Assets/Animations/UniversalAnimationLibrary/UAL1_Standard.fbx";
    private const string Ual2Fbx = "Assets/Animations/UniversalAnimationLibrary/UAL2_Standard.fbx";
    private const string ControllerPath = "Assets/Animations/Controllers/CharacterAnim.controller";
    private const string UpperMaskPath = "Assets/Animations/Controllers/UpperBody.mask";
    private const string DerivedDir = "Assets/Animations/Derived";
    private const string DemoScenePath = "Assets/Scenes/AnimDemo.unity";

    private static readonly List<string> Failures = new List<string>();

    public static void SetupAll()
    {
        Debug.Log("[CharacterAnim] ===== setup start =====");
        try { ConfigureImporters(); } catch (Exception e) { Fail("importers", e); }
        Dictionary<string, AnimationClip> clips = null;
        try { clips = CloneClips(); } catch (Exception e) { Fail("clips", e); }
        try { Mesh2MotionIntegrator.IntegrateAll(); } catch (Exception e) { Fail("mesh2motion", e); }
        try { QuadAnimIntegrator.IntegrateAll(); } catch (Exception e) { Fail("quad", e); }
        AnimatorController controller = null;
        try { controller = BuildController(clips); } catch (Exception e) { Fail("controller", e); }
        try
        {
            if (controller != null) CreatePrefabs(controller);
        }
        catch (Exception e) { Fail("prefabs", e); }
        try
        {
            if (controller != null) CreateDemoScene();
        }
        catch (Exception e) { Fail("scene", e); }
        AssetDatabase.SaveAssets();
        Debug.Log(Failures.Count == 0
            ? "[CharacterAnim] ===== SETUP COMPLETE ====="
            : "[CharacterAnim] ===== SETUP FINISHED WITH FAILURES =====\n" + string.Join("\n", Failures));
    }

    // ------------------------------------------------------------------ importers

    // Character names whose FBX failed avatar/scale config this run; skipped downstream.
    private static readonly HashSet<string> Skipped = new HashSet<string>();

    private static void ConfigureImporters()
    {
        foreach (var ch in Characters)
        {
            if (!File.Exists(ch.fbx)) { Fail("importer", $"{ch.name}: missing {ch.fbx}"); Skipped.Add(ch.name); continue; }
            try { if (!ConfigureCharacter(ch.fbx)) Skipped.Add(ch.name); }
            catch (Exception e) { Fail($"configure {ch.name}", e); Skipped.Add(ch.name); }
        }
        ConfigureSourceLibrary(Ual1Fbx);
        ConfigureSourceLibrary(Ual2Fbx);
    }

    private static bool ConfigureCharacter(string path)
    {
        var importer = AssetImporter.GetAtPath(path) as ModelImporter;
        if (importer == null) { Fail("importer", path); return false; }
        // Force a fresh avatar build every run: a crashed batch can poison Unity's
        // avatar cache so an unchanged reimport silently returns a non-writing avatar.
        if (importer.animationType != ModelImporterAnimationType.Generic)
        {
            importer.animationType = ModelImporterAnimationType.Generic;
            importer.SaveAndReimport();
            importer = AssetImporter.GetAtPath(path) as ModelImporter;
        }
        importer.animationType = ModelImporterAnimationType.Human;
        importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
        importer.importAnimation = true;
        importer.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
        importer.materialSearch = ModelImporterMaterialSearch.Everywhere;
        importer.globalScale = 1f;
        importer.SaveAndReimport();

        var go = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        var av = go != null ? go.GetComponent<Animator>() : null;
        Debug.Log($"[CharacterAnim] {Path.GetFileName(path)}: avatar={(av != null && av.avatar != null ? "assigned" : "MISSING")} human={(av != null && av.avatar != null && av.avatar.isHuman)}");
        if (av == null || av.avatar == null || !av.avatar.isHuman)
        {
            Fail("avatar", $"{path}: auto Humanoid mapping failed - map bones manually in the Rig tab.");
            return false;
        }

        // game dumps commonly import at cm or 0.01x; auto-fit to ~1.75 m
        var h = MeasureHeight(path);
        if (h > 0.001f && (h < 0.3f || h > 3f))
        {
            importer.globalScale = Mathf.Round(1.75f / h * 100f) / 100f;
            importer.SaveAndReimport();
            h = MeasureHeight(path);
            Debug.Log($"[CharacterAnim] {Path.GetFileName(path)}: rescaled to globalScale={importer.globalScale} -> height {h:F2}m");
        }
        else
        {
            Debug.Log($"[CharacterAnim] {Path.GetFileName(path)}: height {h:F2}m (no rescale)");
        }
        return true;
    }

    private static float MeasureHeight(string path)
    {
        var go = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (go == null) return 0f;
        var inst = (GameObject)PrefabUtility.InstantiatePrefab(go);
        try
        {
            float min = float.MaxValue, max = float.MinValue;
            foreach (var r in inst.GetComponentsInChildren<Renderer>())
            {
                min = Mathf.Min(min, r.bounds.min.y);
                max = Mathf.Max(max, r.bounds.max.y);
            }
            return max > min ? max - min : 0f;
        }
        finally { UnityEngine.Object.DestroyImmediate(inst); }
    }

    private static void ConfigureSourceLibrary(string path)
    {
        var importer = AssetImporter.GetAtPath(path) as ModelImporter;
        if (importer == null) { Fail("importer", path); return; }
        importer.animationType = ModelImporterAnimationType.Human;
        importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
        importer.SaveAndReimport();
    }

    // ------------------------------------------------------------------ clips

    private static readonly (string key, string clip, bool loop)[] ClipTable =
    {
        ("idle",        "Idle_Loop",        true),
        ("walk",        "Walk_Loop",        true),
        ("jog",         "Jog_Fwd_Loop",     true),
        ("sprint",      "Sprint_Loop",      true),
        ("crouchIdle",  "Crouch_Idle_Loop", true),
        ("crouchFwd",   "Crouch_Fwd_Loop",  true),
        ("jumpStart",   "Jump_Start",       false),
        ("jumpLoop",    "Jump_Loop",        true),
        ("jumpLand",    "Jump_Land",        false),
        ("slideStart",  "Slide_Start",      false),
        ("slideLoop",   "Slide_Loop",       false),
        ("slideExit",   "Slide_Exit",       false),
        ("pistolIdle",  "Pistol_Idle_Loop", true),
        ("pistolAimUp", "Pistol_Aim_Up",    false),
        ("pistolAimDn", "Pistol_Aim_Down",  false),
        ("shoot",       "Pistol_Shoot",     false),
        ("reload",      "Pistol_Reload",    false),
        ("dance",       "Dance_Loop",       true),
        ("death",       "Death01",          false),
    };

    private static Dictionary<string, AnimationClip> CloneClips()
    {
        EnsureFolder(DerivedDir);

        var source = LoadClipsFrom(Ual1Fbx);
        foreach (var kv in LoadClipsFrom(Ual2Fbx))
            if (!source.ContainsKey(kv.Key)) source[kv.Key] = kv.Value;
        System.IO.File.WriteAllText("Logs/ual_clip_names.txt",
            string.Join("\n", source.Keys.OrderBy(k => k)));
        Debug.Log($"[CharacterAnim] source clips found: {source.Count} (names in Logs/ual_clip_names.txt)");

        var result = new Dictionary<string, AnimationClip>();
        foreach (var (key, clipName, loop) in ClipTable)
        {
            var src = FindClip(source, clipName);
            if (src == null)
            {
                Fail("clips", $"missing source clip '{clipName}' ({key})");
                continue;
            }
            var dst = UnityEngine.Object.Instantiate(src);
            dst.name = key;
            dst.wrapMode = loop ? WrapMode.Loop : WrapMode.ClampForever;
            ScaleRootMotion(dst, 0.01f);   // UE-sourced clips carry root motion in cm
            string assetPath = $"{DerivedDir}/{key}.anim";
            if (AssetDatabase.LoadAssetAtPath<AnimationClip>(assetPath) != null)
                AssetDatabase.DeleteAsset(assetPath);
            AssetDatabase.CreateAsset(dst, assetPath);
            result[key] = dst;
        }
        AssetDatabase.Refresh();
        Debug.Log($"[CharacterAnim] cloned {result.Count}/{ClipTable.Length} clips to {DerivedDir}");
        return result;
    }

    private static AnimationClip FindClip(Dictionary<string, AnimationClip> source, string clipName)
    {
        if (source.TryGetValue(clipName, out var exact)) return exact;
        foreach (var kv in source)
        {
            var last = kv.Key.Split('|').Last().Trim();
            var paren = last.IndexOf(" (", StringComparison.Ordinal);
            if (paren > 0) last = last.Substring(0, paren);
            if (last == clipName) return kv.Value;
        }
        foreach (var kv in source)
            if (Regex.IsMatch(kv.Key, $@"(^|[|(_ ]){Regex.Escape(clipName)}($|[\(_ ])", RegexOptions.IgnoreCase))
                return kv.Value;
        return null;
    }

    private static Dictionary<string, AnimationClip> LoadClipsFrom(string fbxPath)
    {
        var dict = new Dictionary<string, AnimationClip>();
        foreach (var obj in AssetDatabase.LoadAllAssetsAtPath(fbxPath))
            if (obj is AnimationClip c && !string.IsNullOrEmpty(c.name)
                && !c.name.StartsWith("__preview__") && !dict.ContainsKey(c.name))
                dict[c.name] = c;
        return dict;
    }

    // ------------------------------------------------------------------ masks

    private static AvatarMask MakeUpperBodyMask()
    {
        var mask = new AvatarMask { name = "UpperBody" };
        if (AssetDatabase.LoadAssetAtPath<AvatarMask>(UpperMaskPath) != null)
            AssetDatabase.DeleteAsset(UpperMaskPath);
        EnsureFolder("Assets/Animations/Controllers");
        AssetDatabase.CreateAsset(mask, UpperMaskPath);

        // Unity 6 compact body-part set; upper body + arms + fingers + hand IK.
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.Root, false);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.Body, true);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.Head, true);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.LeftLeg, false);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.RightLeg, false);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.LeftArm, true);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.RightArm, true);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.LeftFingers, true);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.RightFingers, true);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.LeftFootIK, false);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.RightFootIK, false);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.LeftHandIK, true);
        mask.SetHumanoidBodyPartActive(AvatarMaskBodyPart.RightHandIK, true);
        EditorUtility.SetDirty(mask);
        Debug.Log("[CharacterAnim] upper-body mask configured via SetHumanoidBodyPartActive.");
        return mask;
    }

    // ------------------------------------------------------------------ controller

    private static AnimatorController BuildController(Dictionary<string, AnimationClip> clips)
    {
        if (clips == null || clips.Count == 0) { Fail("controller", "no clips available"); return null; }
        if (AssetDatabase.LoadAssetAtPath<AnimatorController>(ControllerPath) != null)
            AssetDatabase.DeleteAsset(ControllerPath);
        EnsureFolder("Assets/Animations/Controllers");
        var controller = AnimatorController.CreateAnimatorControllerAtPath(ControllerPath);

        controller.AddParameter("Speed", AnimatorControllerParameterType.Float);
        controller.AddParameter("Grounded", AnimatorControllerParameterType.Bool);
        controller.AddParameter("Crouch", AnimatorControllerParameterType.Bool);
        controller.AddParameter("Jump", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("Slide", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("Shoot", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("Reload", AnimatorControllerParameterType.Trigger);
        controller.AddParameter("EmoteActive", AnimatorControllerParameterType.Bool);
        controller.AddParameter("AimPitch", AnimatorControllerParameterType.Float);
        controller.AddParameter("Dead", AnimatorControllerParameterType.Bool);

        var sm = controller.layers[0].stateMachine;
        // Unity 6 cannot create serializable BlendTrees from script (CreateBlendTree removed,
        // BlendTree no longer a ScriptableObject) -> use speed-gated states with hysteresis.
        var idle = AddMotionState(sm, "Idle", "idle", new Vector3(-300, 100, 0), clips);
        var walk = AddMotionState(sm, "Walk", "walk", new Vector3(-100, 100, 0), clips);
        var jog = AddMotionState(sm, "Jog", "jog", new Vector3(100, 100, 0), clips);
        var sprint = AddMotionState(sm, "Sprint", "sprint", new Vector3(300, 100, 0), clips);
        ConnectSpeedPair(sm, idle, walk, 0.5f, 0.4f);
        ConnectSpeedPair(sm, walk, jog, 2.4f, 2.2f);
        ConnectSpeedPair(sm, jog, sprint, 4.5f, 4.2f);
        sm.defaultState = idle;

        var crouchIdle = AddMotionState(sm, "CrouchIdle", "crouchIdle", new Vector3(-100, -100, 0), clips);
        var crouchFwd = AddMotionState(sm, "CrouchFwd", "crouchFwd", new Vector3(100, -100, 0), clips);
        ConnectSpeedPair(sm, crouchIdle, crouchFwd, 0.9f, 0.8f);
        var anyToCrouch = sm.AddAnyStateTransition(crouchIdle);
        AddIf(anyToCrouch, "Crouch"); anyToCrouch.hasExitTime = false; anyToCrouch.duration = 0.15f;
        anyToCrouch.canTransitionToSelf = false;
        foreach (var cs in new[] { crouchIdle, crouchFwd })
        {
            var back = cs.AddTransition(idle);
            AddIfNot(back, "Crouch"); back.hasExitTime = false; back.duration = 0.15f;
            var backFast = cs.AddTransition(idle);
            AddGreater(backFast, "Speed", 1.8f); backFast.hasExitTime = false; backFast.duration = 0.15f;
        }

        if (clips.Has("jumpStart"))
        {
            var jumpStart = sm.AddState("JumpStart", new Vector3(150, 250, 0)); jumpStart.motion = clips.Get("jumpStart");
            var jumpLoop = sm.AddState("JumpLoop", new Vector3(400, 250, 0)); jumpLoop.motion = clips.Get("jumpLoop");
            var land = sm.AddState("Land", new Vector3(650, 250, 0)); land.motion = clips.Get("jumpLand");
            var aj = sm.AddAnyStateTransition(jumpStart);
            AddTrigger(aj, "Jump"); AddIf(aj, "Grounded");
            aj.hasExitTime = false; aj.canTransitionToSelf = false; aj.duration = 0.1f;
            ExitTo(jumpStart, jumpLoop);
            var loopToLand = jumpLoop.AddTransition(land);
            AddIf(loopToLand, "Grounded"); loopToLand.hasExitTime = false; loopToLand.duration = 0.1f;
            ExitTo(land, idle);
        }

        if (clips.Has("slideStart"))
        {
            var s1 = sm.AddState("SlideStart", new Vector3(150, -250, 0)); s1.motion = clips.Get("slideStart");
            var s2 = sm.AddState("SlideLoop", new Vector3(400, -250, 0)); s2.motion = clips.Get("slideLoop");
            var s3 = sm.AddState("SlideExit", new Vector3(650, -250, 0)); s3.motion = clips.Get("slideExit");
            var as_ = sm.AddAnyStateTransition(s1);
            AddTrigger(as_, "Slide"); as_.hasExitTime = false; as_.canTransitionToSelf = false; as_.duration = 0.1f;
            ExitTo(s1, s2); ExitTo(s2, s3); ExitTo(s3, idle);
        }

        if (clips.Has("death"))
        {
            var death = sm.AddState("Death", new Vector3(150, 450, 0)); death.motion = clips.Get("death");
            var at = sm.AddAnyStateTransition(death);
            AddIf(at, "Dead"); at.hasExitTime = false; at.duration = 0.2f;
        }

        // layer 1: weapon aim (upper body override)
        var upperMask = MakeUpperBodyMask();
        controller.AddLayer("Weapon Aim");
        var layersArr = controller.layers;
        layersArr[1].name = "Weapon Aim";
        layersArr[1].defaultWeight = 1f;
        layersArr[1].avatarMask = upperMask;
        controller.layers = layersArr;
        var asm = controller.layers[1].stateMachine;
        var aimIdle = AddMotionState(asm, "AimIdle", "pistolIdle", new Vector3(-100, 0, 0), clips);
        var aimUp = AddMotionState(asm, "AimUp", "pistolAimUp", new Vector3(100, 100, 0), clips);
        var aimDn = AddMotionState(asm, "AimDn", "pistolAimDn", new Vector3(100, -100, 0), clips);
        asm.defaultState = aimIdle;
        ConnectPitchPair(asm, aimIdle, aimUp, 0.5f, 0.2f);
        ConnectPitchPair(asm, aimIdle, aimDn, -0.5f, -0.2f);
        if (clips.Has("shoot"))
        {
            var shoot = asm.AddState("Shoot", new Vector3(350, 100, 0)); shoot.motion = clips.Get("shoot");
            var t = aimIdle.AddTransition(shoot); AddTrigger(t, "Shoot"); t.hasExitTime = false; t.duration = 0.05f;
            ExitTo(shoot, aimIdle);
        }
        if (clips.Has("reload"))
        {
            var reload = asm.AddState("Reload", new Vector3(350, -100, 0)); reload.motion = clips.Get("reload");
            var t = aimIdle.AddTransition(reload); AddTrigger(t, "Reload"); t.hasExitTime = false; t.duration = 0.05f;
            ExitTo(reload, aimIdle);
        }

        // layer 2: emote (full-body override, weight driven at runtime)
        controller.AddLayer("Emote");
        var emoteArr = controller.layers;
        emoteArr[2].name = "Emote";
        emoteArr[2].defaultWeight = 0f;
        controller.layers = emoteArr;
        var esm = controller.layers[2].stateMachine;
        if (clips.Has("dance"))
        {
            var dance = esm.AddState("Dance");
            dance.motion = clips.Get("dance");
            esm.defaultState = dance;
        }

        // Mesh2Motion / extra mocap clips: playble via Play("X_...") from code.
        if (Directory.Exists(Mesh2MotionIntegrator.ClipsDir))
        {
            int ex = 0;
            foreach (var animPath in Directory.GetFiles(Mesh2MotionIntegrator.ClipsDir, "*.anim").OrderBy(f => f))
            {
                var clip = AssetDatabase.LoadAssetAtPath<AnimationClip>(animPath.Replace('\\', '/'));
                if (clip == null) continue;
                var st = sm.AddState(Mesh2MotionIntegrator.StatePrefix + Path.GetFileNameWithoutExtension(animPath), new Vector3(400 + ex * 250, 550, 0));
                st.motion = clip;
                ex++;
            }
            Debug.Log($"[CharacterAnim] extra mocap states added: {ex}");
        }

        // SerializedObject patch: ensure base layer weight = 1 (array write-back lost it before).
        var so = new SerializedObject(controller);
        var layersProp = so.FindProperty("m_AnimatorLayers");
        layersProp.GetArrayElementAtIndex(0).FindPropertyRelative("m_DefaultWeight").floatValue = 1f;
        so.ApplyModifiedProperties();
        EditorUtility.SetDirty(controller);

        var finalLayers = (AssetDatabase.LoadAssetAtPath<AnimatorController>(ControllerPath) ?? controller).layers;
        for (int li = 0; li < finalLayers.Length; li++)
            Debug.Log("[CharacterAnim] layer[" + li + "] '" + finalLayers[li].name + "' weight=" + finalLayers[li].defaultWeight
                + " mask=" + (finalLayers[li].avatarMask != null ? finalLayers[li].avatarMask.name : "None"));

        Debug.Log("[CharacterAnim] controller created: " + ControllerPath);
        return controller;
    }

    private static AnimatorState AddMotionState(AnimatorStateMachine sm, string stateName, string clipKey, Vector3 pos, Dictionary<string, AnimationClip> clips)
    {
        var st = sm.AddState(stateName, pos);
        if (clips.Has(clipKey)) st.motion = clips.Get(clipKey);
        else Debug.LogWarning("[CharacterAnim] missing clip for state " + stateName + " (key=" + clipKey + ")");
        return st;
    }

    private static void ConnectSpeedPair(AnimatorStateMachine sm, AnimatorState a, AnimatorState b, float up, float down)
    {
        var ab = a.AddTransition(b); AddGreater(ab, "Speed", up); ab.hasExitTime = false; ab.duration = 0.1f;
        var ba = b.AddTransition(a); AddLess(ba, "Speed", down); ba.hasExitTime = false; ba.duration = 0.1f;
    }

    private static void ConnectPitchPair(AnimatorStateMachine sm, AnimatorState a, AnimatorState b, float go, float back)
    {
        bool up = go > 0;
        var ab = a.AddTransition(b);
        if (up) AddGreater(ab, "AimPitch", go); else AddLess(ab, "AimPitch", go);
        ab.hasExitTime = false; ab.duration = 0.1f;
        var ba = b.AddTransition(a);
        if (up) AddLess(ba, "AimPitch", back); else AddGreater(ba, "AimPitch", back);
        ba.hasExitTime = false; ba.duration = 0.1f;
    }

    private static void ScaleRootMotion(AnimationClip clip, float factor)
    {
        foreach (var b in AnimationUtility.GetCurveBindings(clip))
        {
            if (!b.propertyName.StartsWith("RootT", StringComparison.Ordinal)) continue;
            var curve = AnimationUtility.GetEditorCurve(clip, b);
            if (curve == null) continue;
            var keys = curve.keys;
            for (int i = 0; i < keys.Length; i++)
            {
                var k = keys[i];
                k.value *= factor;
                k.inTangent *= factor;
                k.outTangent *= factor;
                keys[i] = k;
            }
            curve.keys = keys;
            AnimationUtility.SetEditorCurve(clip, b, curve);
        }
    }

    private static void ExitTo(AnimatorState from, AnimatorState to)
    {
        var t = from.AddTransition(to);
        t.hasExitTime = true;
        t.exitTime = 0.9f;
        t.duration = 0.1f;
    }

    private static void AddTrigger(AnimatorStateTransition t, string p) => t.AddCondition(AnimatorConditionMode.If, 0f, p);
    private static void AddIf(AnimatorStateTransition t, string p) => t.AddCondition(AnimatorConditionMode.If, 0f, p);
    private static void AddIfNot(AnimatorStateTransition t, string p) => t.AddCondition(AnimatorConditionMode.IfNot, 0f, p);
    private static void AddLess(AnimatorStateTransition t, string p, float v) => t.AddCondition(AnimatorConditionMode.Less, v, p);
    private static void AddGreater(AnimatorStateTransition t, string p, float v) => t.AddCondition(AnimatorConditionMode.Greater, v, p);

    // ------------------------------------------------------------------ prefabs

    private static void CreatePrefabs(RuntimeAnimatorController controller)
    {
        foreach (var ch in Characters)
        {
            if (Skipped.Contains(ch.name)) { Debug.LogWarning($"[CharacterAnim] skipping prefab for {ch.name} (rig config failed)"); continue; }
            try { CreateOnePrefab(ch.fbx, ch.prefab, controller); }
            catch (Exception e) { Fail($"prefab {ch.name}", e); }
        }
    }

    private static void CreateOnePrefab(string fbxPath, string prefabPath, RuntimeAnimatorController controller)
    {
        var all = AssetDatabase.LoadAllAssetsAtPath(fbxPath);
        var root = all.OfType<GameObject>()
            .FirstOrDefault(go => go.transform.parent == null
                                  && go.GetComponentInChildren<SkinnedMeshRenderer>() != null)
            ?? all.OfType<GameObject>().FirstOrDefault(go => go.transform.parent == null);
        if (root == null) { Fail("prefab", $"{fbxPath}: no root GameObject"); return; }

        var inst = PrefabUtility.InstantiatePrefab(root) as GameObject;
        inst.name = Path.GetFileNameWithoutExtension(prefabPath);
        var animator = inst.GetComponent<Animator>() ?? inst.GetComponentInChildren<Animator>();
        if (animator != null)
        {
            animator.runtimeAnimatorController = controller;
            // Default CullUpdateTransforms silences bone output when no camera
            // sees the renderer (also breaks headless verification).
            animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
        }
        inst.AddComponent<CharacterAnimDriver>();
        inst.AddComponent<WeaponSocket>();
        var renderers = inst.GetComponentsInChildren<Renderer>();
        Bounds b = new Bounds(Vector3.zero, Vector3.zero);
        if (renderers.Length > 0)
        {
            b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
        }
        var cc = inst.AddComponent<CharacterController>();
        float h = Mathf.Clamp(b.size.y, 0.5f, 3.5f);
        cc.height = h * 0.95f;
        cc.center = new Vector3(b.center.x - inst.transform.position.x, h / 2f, b.center.z - inst.transform.position.z);
        cc.radius = Mathf.Clamp(Mathf.Min(b.size.x, b.size.z) * 0.4f, 0.1f, 0.5f);
        Debug.Log($"[CharacterAnim] {inst.name}: height={h:F2}m controller h={cc.height:F2} r={cc.radius:F2}");
        if (AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath) != null)
            AssetDatabase.DeleteAsset(prefabPath);
        PrefabUtility.SaveAsPrefabAsset(inst, prefabPath);
        UnityEngine.Object.DestroyImmediate(inst);
        Debug.Log("[CharacterAnim] prefab: " + prefabPath);
    }

    // ------------------------------------------------------------------ demo scene

    public static void CreateDemoScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        var camGo = new GameObject("Main Camera");
        camGo.tag = "MainCamera";
        camGo.AddComponent<Camera>();
        camGo.AddComponent<AudioListener>();
        var cam = camGo.AddComponent<ThirdPersonCamera>();
        cam.distance = 4.5f;

        var lightGo = new GameObject("Directional Light");
        var light = lightGo.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.15f;
        light.color = new Color(1f, 0.96f, 0.9f);
        lightGo.transform.rotation = Quaternion.Euler(52f, -32f, 0f);
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.45f, 0.5f, 0.58f);
        RenderSettings.fog = true;
        RenderSettings.fogColor = new Color(0.62f, 0.68f, 0.75f);
        RenderSettings.fogDensity = 0.012f;

        var ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
        ground.name = "Ground";
        ground.transform.position = new Vector3(12f, -0.05f, 4f);
        ground.transform.localScale = new Vector3(70f, 0.1f, 40f);
        var groundMat = new Material(Shader.Find("Standard")) { color = new Color(0.34f, 0.36f, 0.4f) };
        ground.GetComponent<Renderer>().sharedMaterial = groundMat;

        GameObject first = null;
        float x = 0f;
        foreach (var ch in Characters)
        {
            var go = LoadPrefabAndPlace(ch.prefab, new Vector3(x, 0, 0));
            if (go != null)
            {
                if (first == null) go.AddComponent<CharacterRig.DemoLocomotion>();
                else go.AddComponent<CharacterRig.DemoShowcase>();
                if (first == null) first = go;
            }
            x += 3f;
        }
        x = 1.5f;
        foreach (var q in new[] { "Quad_Fox", "Quad_TRex", "Quad_Dragon", "Quad_Eagle" })
        {
            var qo = LoadPrefabAndPlace($"Assets/Characters/{q}/{q}_AnimReady.prefab", new Vector3(x, 0, 4.5f));
            if (qo != null) qo.AddComponent<CharacterRig.DemoShowcase>();
            x += 3f;
        }
        if (first != null)
        {
            cam.target = first.transform;
            var gun = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Weapons/mac10.fbx");
            if (gun != null)
            {
                var att = first.GetComponent<CharacterRig.GunAttacher>() ?? first.AddComponent<CharacterRig.GunAttacher>();
                var swp = first.GetComponent<CharacterRig.GunSkinSwapper>() ?? first.AddComponent<CharacterRig.GunSkinSwapper>();
                var soA = new SerializedObject(att);
                soA.FindProperty("gunPrefab").objectReferenceValue = gun;
                soA.ApplyModifiedPropertiesWithoutUndo();
                var soS = new SerializedObject(swp);
                var arr = soS.FindProperty("skins");
                var paths = new[]
                {
                    "Assets/Weapons/mac10.fbx",
                    "Assets/Weapons/skins/mac10/mac10_skin_060.fbx",
                    "Assets/Weapons/skins/mac10/mac10_skin_140.fbx",
                    "Assets/Weapons/skins/mac10/mac10_skin_220.fbx",
                    "Assets/Weapons/skins/mac10/mac10_skin_300.fbx",
                };
                arr.arraySize = paths.Length;
                for (int gi = 0; gi < paths.Length; gi++)
                    arr.GetArrayElementAtIndex(gi).objectReferenceValue =
                        AssetDatabase.LoadAssetAtPath<GameObject>(paths[gi]);
                soS.ApplyModifiedPropertiesWithoutUndo();
                Debug.Log("[CharacterAnim] demo: first character equipped mac10 + 4 skins (G key cycles)");
            }
        }

        EnsureFolder("Assets/Scenes");
        EditorSceneManager.SaveScene(scene, DemoScenePath);
        Debug.Log("[CharacterAnim] demo scene saved: " + DemoScenePath);
    }

    private static GameObject LoadPrefabAndPlace(string prefabPath, Vector3 pos)
    {
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath);
        if (prefab == null) { Debug.LogWarning($"[CharacterAnim] scene: {prefabPath} not created (skipped)"); return null; }
        var go = PrefabUtility.InstantiatePrefab(prefab) as GameObject;
        go.transform.position = pos;
        return go;
    }

    // ------------------------------------------------------------------ helpers

    private static void EnsureFolder(string path)
    {
        if (AssetDatabase.IsValidFolder(path)) return;
        var parts = path.Split('/');
        var cur = parts[0];
        for (int i = 1; i < parts.Length; i++)
        {
            var child = cur + "/" + parts[i];
            if (!AssetDatabase.IsValidFolder(child))
                AssetDatabase.CreateFolder(cur, parts[i]);
            cur = child;
        }
    }

    private static bool Has(this Dictionary<string, AnimationClip> d, string k) => d != null && d.ContainsKey(k);
    private static AnimationClip Get(this Dictionary<string, AnimationClip> d, string k) => d != null && d.TryGetValue(k, out var c) ? c : null;

    private static void Fail(string step, Exception e) { Failures.Add($"{step}: {e}"); Debug.LogError($"[CharacterAnim] {step}: {e}"); }
    private static void Fail(string step, string message) { Failures.Add($"{step}: {message}"); Debug.LogWarning($"[CharacterAnim] {step}: {message}"); }

    [MenuItem("Tools/Character Anim/Setup Everything")]
    public static void SetupFromMenu() => SetupAll();
}



