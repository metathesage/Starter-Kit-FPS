using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

/// Generic (non-Humanoid) creatures shipped with their own baked animation
/// takes (fox, t-rex, dragon, eagle). Creates a per-creature Animator
/// controller with one state per FBX clip and an <Name>_AnimReady prefab.
/// Runs inside CharacterAnimBootstrapper.SetupAll or standalone:
/// Unity -batchmode -executeMethod QuadAnimIntegrator.IntegrateAll
public static class QuadAnimIntegrator
{
    private static readonly (string name, string fbx)[] Creatures =
    {
        ("Fox",     "Assets/Characters/Quad_Fox/Quad_Fox.fbx"),
        ("TRex",    "Assets/Characters/Quad_TRex/Quad_TRex.fbx"),
        ("Dragon",  "Assets/Characters/Quad_Dragon/Quad_Dragon.fbx"),
        ("Eagle",   "Assets/Characters/Quad_Eagle/Quad_Eagle.fbx"),
    };

    public static void IntegrateAll()
    {
        foreach (var (name, fbx) in Creatures)
        {
            try { IntegrateOne(name, fbx); }
            catch (System.Exception e)
            {
                Debug.LogError($"[QuadAnim] {name}: {e.Message}");
            }
        }
    }

    private static void IntegrateOne(string name, string fbxPath)
    {
        if (!File.Exists(fbxPath))
        {
            Debug.LogWarning($"[QuadAnim] {name}: {fbxPath} missing (skipped)");
            return;
        }

        var importer = AssetImporter.GetAtPath(fbxPath) as ModelImporter;
        if (importer == null) { Debug.LogError($"[QuadAnim] {name}: no importer"); return; }
        if (importer.animationType != ModelImporterAnimationType.Generic)
        {
            importer.animationType = ModelImporterAnimationType.Generic;
            importer.SaveAndReimport();
        }

        var clips = AssetDatabase.LoadAllAssetsAtPath(fbxPath)
            .OfType<AnimationClip>()
            .Where(c => !c.name.EndsWith("{,}") && !c.name.StartsWith("__preview__") && c.length > 0.1f)
            .GroupBy(c => c.name)
            .Select(g => g.First())
            .OrderBy(c => c.name)
            .ToList();
        if (clips.Count == 0)
        {
            Debug.LogWarning($"[QuadAnim] {name}: no animation clips found on {fbxPath}");
            return;
        }

        string ctrlPath = $"{Path.GetDirectoryName(fbxPath)}/Quad_{name}_Anim.controller";
        if (AssetDatabase.LoadAssetAtPath<AnimatorController>(ctrlPath) != null)
            AssetDatabase.DeleteAsset(ctrlPath);
        var controller = AnimatorController.CreateAnimatorControllerAtPath(ctrlPath);
        var sm = controller.layers[0].stateMachine;
        foreach (var clip in clips)
        {
            var st = sm.AddState(clip.name);
            st.motion = clip;
            st.writeDefaultValues = true;
        }
        EditorUtility.SetDirty(controller);
        AssetDatabase.SaveAssets();

        string prefabPath = $"{Path.GetDirectoryName(fbxPath)}/Quad_{name}_AnimReady.prefab";
        var all = AssetDatabase.LoadAllAssetsAtPath(fbxPath);
        var modelRoot = all.OfType<GameObject>()
            .FirstOrDefault(go => go.transform.parent == null
                                  && go.GetComponentInChildren<SkinnedMeshRenderer>() != null)
            ?? all.OfType<GameObject>().FirstOrDefault(go => go.transform.parent == null);
        if (modelRoot == null) { Debug.LogError($"[QuadAnim] {name}: no root GO"); return; }

        var root = (GameObject)PrefabUtility.InstantiatePrefab(modelRoot);
        root.name = $"Quad_{name}_AnimReady";
        var anim = root.GetComponent<Animator>() ?? root.GetComponentInChildren<Animator>();
        if (anim == null) anim = root.AddComponent<Animator>();
        anim.applyRootMotion = false;
        anim.runtimeAnimatorController = controller;
        anim.cullingMode = AnimatorCullingMode.AlwaysAnimate;

        if (AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath) != null)
            AssetDatabase.DeleteAsset(prefabPath);
        PrefabUtility.SaveAsPrefabAsset(root, prefabPath);
        Object.DestroyImmediate(root);
        Debug.Log($"[QuadAnim] {name}: {clips.Count} states -> {prefabPath} [{string.Join(", ", clips.Select(c => c.name).Take(6))}...]");
    }
}
