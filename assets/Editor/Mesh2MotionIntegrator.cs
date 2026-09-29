using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

/// Integrates Mesh2Motion CMU mocap FBX files into humanoid .anim clips that
/// retarget onto any Humanoid character in the project (muscle-curve clips).
/// Run headless: Unity -batchmode -executeMethod Mesh2MotionIntegrator.IntegrateAll
public static class Mesh2MotionIntegrator
{
    public const string CmuDir = "Assets/Animations/Mesh2Motion/CMU";
    public const string ClipsDir = "Assets/Animations/Mesh2MotionClips";
    public const string StatePrefix = "X_";   // extras states in the main controller

    [MenuItem("Tools/Character Anim/Integrate Mesh2Motion Mocap")]
    public static void IntegrateAll()
    {
        Directory.CreateDirectory(ClipsDir);
        var report = new List<string>();
        string cmuRoot = new DirectoryInfo(CmuDir).Name;
        foreach (var fbx in Directory.GetFiles(CmuDir, "*.fbx", SearchOption.AllDirectories).OrderBy(f => f))
        {
            var path = fbx.Replace('\\', '/');
            string parent = Path.GetFileName(Path.GetDirectoryName(path));
            string nsPrefix = parent == cmuRoot ? "" : Sanitize(parent) + "_";
            try
            {
                var importer = AssetImporter.GetAtPath(path) as ModelImporter;
                if (importer == null) { report.Add($"{Path.GetFileName(path)}: no importer"); continue; }
                importer.animationType = ModelImporterAnimationType.Human;
                importer.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
                importer.SaveAndReimport();

                var srcs = AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>()
                    .Where(c => !c.name.Contains("__preview") && c.isHumanMotion && c.length > 0.3f)
                    .ToList();

                int idx = 0;
                foreach (var src in srcs)
                {
                    string baseName = Path.GetFileNameWithoutExtension(path).Replace(".", "_");
                    string key = nsPrefix + (srcs.Count > 1 ? $"{baseName}_{Sanitize(src.name)}" : baseName);
                    var dst = Object.Instantiate(src);
                    dst.name = key;
                    float amp = AutoScaleRootMotion(dst);
                    string assetPath = $"{ClipsDir}/{key}.anim";
                    if (AssetDatabase.LoadAssetAtPath<AnimationClip>(assetPath) != null)
                        AssetDatabase.DeleteAsset(assetPath);
                    AssetDatabase.CreateAsset(dst, assetPath);
                    report.Add($"{key}: human={dst.isHumanMotion} len={dst.length:F1}s rootAmp={amp:F2}");
                    idx++;
                }
                if (srcs.Count == 0) report.Add($"{Path.GetFileName(path)}: NO human clips (check mapping)");
            }
            catch (System.Exception e) { report.Add($"{Path.GetFileName(path)}: {e.Message}"); }
        }
        AssetDatabase.SaveAssets();
        foreach (var r in report) Debug.Log("[M2M] " + r);
        Debug.Log($"[M2M] ===== INTEGRATE DONE ({report.Count} entries) =====");
    }

    private static string Sanitize(string n)
    {
        var keep = new string(n.Where(ch => char.IsLetterOrDigit(ch) || ch == '_').ToArray());
        return keep.Length == 0 ? "clip" : keep;
    }

    /// Returns max abs RootT amplitude; if values look cm-scale (>30), divides by 100.
    private static float AutoScaleRootMotion(AnimationClip clip)
    {
        float amp = 0f;
        foreach (var b in AnimationUtility.GetCurveBindings(clip))
        {
            if (!b.propertyName.StartsWith("RootT", System.StringComparison.Ordinal)) continue;
            var c = AnimationUtility.GetEditorCurve(clip, b);
            if (c == null) continue;
            foreach (var k in c.keys) amp = Mathf.Max(amp, Mathf.Abs(k.value));
        }
        if (amp > 30f)
        {
            foreach (var b in AnimationUtility.GetCurveBindings(clip))
            {
                if (!b.propertyName.StartsWith("RootT", System.StringComparison.Ordinal)) continue;
                var c = AnimationUtility.GetEditorCurve(clip, b);
                if (c == null) continue;
                var keys = c.keys;
                for (int i = 0; i < keys.Length; i++)
                {
                    var k = keys[i];
                    k.value *= 0.01f; k.inTangent *= 0.01f; k.outTangent *= 0.01f;
                    keys[i] = k;
                }
                c.keys = keys;
                AnimationUtility.SetEditorCurve(clip, b, c);
            }
            amp *= 0.01f;
        }
        return amp;
    }
}
