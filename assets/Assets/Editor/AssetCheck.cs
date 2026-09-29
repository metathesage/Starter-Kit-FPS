using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;

/// <summary>
/// Tools → Waifu Halo → Verify Assets / Reimport GLBs.
/// Every key here is one the runtime asks Resources.Load for, so a MISSING line
/// means a silent fallback to placeholder primitives or cube guns at play time.
/// </summary>
public static class AssetCheck
{
    // Must match WaifuBody.Build()
    static readonly string[] CharacterKeys = { "Characters/lucy", "Characters/citlali", "Characters/angle" };
    // Must match Weapon.Make()
    static readonly string[] WeaponKeys = { "Weapons/chaperone", "Weapons/lament" };
    // Must match ArenaHUD.Awake() and MapLook.Apply()
    static readonly string[] TextureKeys = { "kira7", "Map/city", "Map/sidewalk", "Map/police", "Map/ground" };

    // Must match SceneBuilder.BuildScene()
    const string MapPath = "Assets/Map/invasion_map.obj";
    const string ScenePath = "Assets/Scenes/Arena.unity";

    static readonly string[] GlbPaths =
    {
        "Assets/Map/invasion_map.glb",
        "Assets/Resources/Characters/lucy.glb",
        "Assets/Resources/Characters/citlali.glb",
        "Assets/Resources/Characters/angle.glb",
        "Assets/Resources/Weapons/chaperone.glb",
        "Assets/Resources/Weapons/lament.glb",
    };

    /// <summary>
    /// True when something other than Unity's fallback DefaultImporter claimed the file.
    /// Uses the live importer first (the .meta on disk can lag behind the AssetDatabase).
    /// </summary>
    static bool HasRealImporter(string assetPath)
    {
        var imp = AssetImporter.GetAtPath(assetPath);
        if (imp != null) return imp.GetType().Name != "DefaultImporter";
        string meta = assetPath + ".meta";
        if (!File.Exists(meta)) return false;
        return File.ReadAllText(meta).IndexOf("DefaultImporter:") < 0;
    }

    [MenuItem("Tools/Waifu Halo/Reimport GLBs")]
    public static void ReimportGlbs()
    {
        foreach (var p in GlbPaths)
        {
            if (!File.Exists(p)) { Debug.LogWarning("No such file: " + p); continue; }
            AssetDatabase.ImportAsset(p, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
            Debug.Log("Reimported " + p + " (realImporter=" + HasRealImporter(p) + ")");
        }
        AssetDatabase.Refresh();
        Verify();
    }

    [MenuItem("Tools/Waifu Halo/Diagnose GLB")]
    public static void DiagnoseGlb()
    {
        var sb = new StringBuilder();
        sb.AppendLine("=== GLB diagnose ===");
        string[] paths =
        {
            "Assets/Resources/Characters/lucy.glb",
            "Assets/Resources/Weapons/chaperone.glb",
            "Assets/Map/invasion_map.glb",
        };
        foreach (var p in paths)
        {
            sb.AppendLine();
            sb.AppendLine(p);
            sb.AppendLine("  on disk          : " + (File.Exists(p) ? new FileInfo(p).Length + " bytes" : "MISSING"));
            var imp = AssetImporter.GetAtPath(p);
            sb.AppendLine("  AssetImporter    : " + (imp == null ? "NULL" : imp.GetType().FullName));
            sb.AppendLine("  main asset type  : " + (AssetDatabase.GetMainAssetTypeAtPath(p)?.FullName ?? "NULL"));
            var all = AssetDatabase.LoadAllAssetsAtPath(p);
            sb.AppendLine("  sub-assets       : " + (all == null ? "NULL" : all.Length.ToString()));
            sb.AppendLine("  guid             : " + AssetDatabase.AssetPathToGUID(p));
            var go = AssetDatabase.LoadAssetAtPath<GameObject>(p);
            sb.AppendLine("  LoadAssetAtPath  : " + (go ? "GameObject '" + go.name + "' meshes=" + go.GetComponentsInChildren<MeshFilter>(true).Length : "NULL"));
        }

        sb.AppendLine();
        sb.AppendLine("=== glTFast importer presence ===");
        string[] probed =
        {
            "GLTFast.Editor.GltfImporter, glTFast.Editor",
            "GLTFast.GltfImport, glTFast",
            "GLTFast.GltfAsset, glTFast",
        };
        foreach (var n in probed)
            sb.AppendLine("  " + n + " -> " + (System.Type.GetType(n, false) != null ? "FOUND" : "not found"));

        Debug.Log(sb.ToString());
        Verify();
    }

    [MenuItem("Tools/Waifu Halo/Verify Assets")]
    public static void Verify()
    {
        var sb = new StringBuilder();
        sb.AppendLine("=== WAIFU ARENA asset check ===");
        int problems = 0;

        sb.AppendLine();
        sb.AppendLine("-- glb importer claim --");
        foreach (var p in GlbPaths)
        {
            if (!File.Exists(p)) { sb.AppendLine("  " + p + " -> NOT ON DISK"); problems++; continue; }
            bool real = HasRealImporter(p);
            if (!real) problems++;
            sb.AppendLine("  " + p + " -> " + (real ? "imported as a model" : "DefaultImporter (no glTF importer installed!)"));
        }

        sb.AppendLine();
        sb.AppendLine("-- Resources keys the runtime loads --");
        problems += Report<GameObject>("model  ", CharacterKeys, sb);
        problems += Report<GameObject>("model  ", WeaponKeys, sb);
        problems += Report<Texture2D>("texture", TextureKeys, sb);

        sb.AppendLine();
        sb.AppendLine("-- map + scene --");
        var map = AssetDatabase.LoadAssetAtPath<GameObject>(MapPath);
        sb.AppendLine("  " + MapPath + " -> " + (map ? "OK (" + map.GetComponentsInChildren<MeshFilter>(true).Length + " meshes)" : "MISSING"));
        if (!map) problems++;
        var scene = AssetDatabase.LoadAssetAtPath<SceneAsset>(ScenePath);
        sb.AppendLine("  " + ScenePath + " -> " + (scene ? "OK" : "MISSING (run Tools → Waifu Halo → Build Arena Scene)"));
        if (!scene) problems++;

        string[] navMeshes = scene ? AssetDatabase.FindAssets("t:NavMeshData", new[] { "Assets" }) : new string[0];
        sb.AppendLine("  NavMeshData assets: " + navMeshes.Length);

        string[] buildScenes = new string[EditorBuildSettings.scenes.Length];
        for (int i = 0; i < EditorBuildSettings.scenes.Length; i++) buildScenes[i] = EditorBuildSettings.scenes[i].path;
        sb.AppendLine("  Build scenes: " + (buildScenes.Length == 0 ? "(none!)" : string.Join(", ", buildScenes)));
        if (buildScenes.Length == 0) problems++;

        sb.AppendLine();
        if (problems == 0)
        {
            sb.AppendLine("RESULT: OK - every runtime Resources key resolves.");
            Debug.Log(sb.ToString());
        }
        else
        {
            sb.AppendLine("RESULT: " + problems + " problem(s). Runtime falls back to placeholder visuals.");
            Debug.LogError(sb.ToString());
        }
    }

    /// <summary>
    /// Guarantees the built-in shaders the game asks for at runtime survive the build.
    /// Nothing in this project references "Standard" from a saved material, so shader
    /// stripping drops it and every runtime-made material renders magenta.
    /// </summary>
    [MenuItem("Tools/Waifu Halo/Include Runtime Shaders")]
    public static void IncludeRuntimeShaders()
    {
        string[] wanted = { "Standard", "Sprites/Default", "Unlit/Color", "Legacy Shaders/Diffuse" };

        var graphics = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset")[0];
        var so = new SerializedObject(graphics);
        var list = so.FindProperty("m_AlwaysIncludedShaders");
        if (list == null) { Debug.LogError("Could not find m_AlwaysIncludedShaders."); return; }

        int added = 0;
        foreach (var name in wanted)
        {
            var shader = Shader.Find(name);
            if (!shader) { Debug.LogWarning("Shader not found in editor: " + name); continue; }
            bool present = false;
            for (int i = 0; i < list.arraySize; i++)
                if (list.GetArrayElementAtIndex(i).objectReferenceValue == shader) { present = true; break; }
            if (present) continue;
            list.InsertArrayElementAtIndex(list.arraySize);
            list.GetArrayElementAtIndex(list.arraySize - 1).objectReferenceValue = shader;
            added++;
            Debug.Log("Added always-included shader: " + name);
        }

        so.ApplyModifiedProperties();
        AssetDatabase.SaveAssets();

        var verify = new SerializedObject(graphics);
        var check = verify.FindProperty("m_AlwaysIncludedShaders");
        Debug.Log("Always-included shaders now: " + check.arraySize + " (added " + added + ")");
    }

    static int Report<T>(string label, string[] keys, StringBuilder sb) where T : Object
    {
        int missing = 0;
        foreach (var k in keys)
        {
            var a = Resources.Load<T>(k);
            if (a) sb.AppendLine("  " + label + " Resources/" + k + " -> OK (" + a.name + ")");
            else { sb.AppendLine("  " + label + " Resources/" + k + " -> MISSING"); missing++; }
        }
        return missing;
    }
}
