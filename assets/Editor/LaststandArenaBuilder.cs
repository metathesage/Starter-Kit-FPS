using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

/// Generates Assets/Scenes/LaststandArena.unity: a wave-survival arena using the
/// rigged prefabs, the mac10 pipeline, and the Laststand gameplay components.
public static class LaststandArenaBuilder
{
    private const string ScenePath = "Assets/Scenes/LaststandArena.unity";

    private static readonly string[] EnemyPrefabPaths =
    {
        "Assets/Characters/Gekkou/Gekkou_AnimReady.prefab",
        "Assets/Characters/Kurenai/Kurenai_AnimReady.prefab",
        "Assets/Characters/Samidale/Samidale_AnimReady.prefab",
        "Assets/Characters/Drizzle/Drizzle_AnimReady.prefab",
        "Assets/Characters/Quad_Fox/Quad_Fox_AnimReady.prefab",
        "Assets/Characters/Quad_Dragon/Quad_Dragon_AnimReady.prefab",
        "Assets/Characters/SkeletonWarrior/SkeletonWarrior_AnimReady.prefab",
        "Assets/Characters/SkeletonRogue/SkeletonRogue_AnimReady.prefab",
        "Assets/Characters/SkeletonMage/SkeletonMage_AnimReady.prefab",
        "Assets/Characters/Soldier/Soldier_AnimReady.prefab",
    };

    [MenuItem("Tools/Character Anim/Build Laststand Arena")]
    public static void BuildAll()
    {
        CharacterAnimBootstrapper.CreateDemoScene();
        BuildArena();
    }

    public static void PrepareAndOpen()
    {
        EditorBuildSettings.scenes = new[]
        {
            new EditorBuildSettingsScene(ScenePath, true),
            new EditorBuildSettingsScene("Assets/Scenes/AnimDemo.unity", true),
        };
        EditorSceneManager.OpenScene("Assets/Scenes/AnimDemo.unity", OpenSceneMode.Single);
        EditorSceneManager.OpenScene(ScenePath, OpenSceneMode.Single);
        Debug.Log("[Arena] opened scene + build settings registered");
    }

    public static void BuildArena()
    {
        EnsureTag("Enemy");
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // ---- environment
        var ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
        ground.name = "Ground";
        ground.transform.position = new Vector3(0f, -0.05f, 0f);
        ground.transform.localScale = new Vector3(120f, 0.1f, 120f);
        ground.GetComponent<Renderer>().sharedMaterial =
            new Material(Shader.Find("Standard")) { color = new Color(0.22f, 0.24f, 0.28f) };

        var lightGo = new GameObject("Directional Light");
        var light = lightGo.AddComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = 1.05f;
        light.color = new Color(1f, 0.93f, 0.85f);
        lightGo.transform.rotation = Quaternion.Euler(48f, -35f, 0f);
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.32f, 0.34f, 0.42f);
        RenderSettings.fog = true;
        RenderSettings.fogColor = new Color(0.16f, 0.15f, 0.2f);
        RenderSettings.fogDensity = 0.018f;

        // ---- Japanese prop dressing (static FBX props, auto-scaled)
        PlacePropScaled("Assets/Environment/torii.fbx", new Vector3(0f, 0f, -6f), 5.5f, 0f);
        PlacePropScaled("Assets/Environment/cyberpagoda.fbx", new Vector3(-18f, 0f, -14f), 8f, 30f);
        PlacePropScaled("Assets/Environment/machiya.fbx", new Vector3(18f, 0f, -14f), 7f, -30f);
        PlacePropScaled("Assets/Environment/kiosk.fbx", new Vector3(-20f, 0f, 8f), 3f, 90f);
        PlacePropScaled("Assets/Environment/stall.fbx", new Vector3(20f, 0f, 8f), 3f, -90f);
        PlacePropScaled("Assets/Environment/bridge.fbx", new Vector3(0f, 0f, 18f), 4f, 0f);
        for (int i = 0; i < 6; i++)
        {
            float a = i * Mathf.PI / 3f;
            PlacePropScaled("Assets/Environment/lantern.fbx",
                new Vector3(Mathf.Cos(a) * 12f, 0f, Mathf.Sin(a) * 12f), 1.2f, 0f);
        }
        for (int i = 0; i < 4; i++)
        {
            float a = i * Mathf.PI / 2f + 0.5f;
            PlacePropScaled("Assets/Environment/sakura.fbx",
                new Vector3(Mathf.Cos(a) * 26f, 0f, Mathf.Sin(a) * 26f), 5f, a * 57f);
        }
        for (int i = 0; i < 6; i++)
        {
            float a = UnityEngine.Random.Range(0f, Mathf.PI * 2f);
            PlacePropScaled("Assets/Environment/chest.fbx",
                new Vector3(Mathf.Cos(a) * UnityEngine.Random.Range(8f, 22f), 0f, Mathf.Sin(a) * UnityEngine.Random.Range(8f, 22f)),
                0.7f, UnityEngine.Random.Range(0f, 360f));
        }

        // ---- player
        var playerPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(
            "Assets/Characters/WuwaLucy/WuwaLucy_AnimReady.prefab");
        if (playerPrefab == null)
        {
            Debug.LogError("[Arena] player prefab missing");
            return;
        }
        var player = (GameObject)PrefabUtility.InstantiatePrefab(playerPrefab);
        player.name = "Player";
        player.tag = "Player";
        player.transform.position = Vector3.zero;
        player.AddComponent<CharacterRig.DemoLocomotion>();
        var att = player.GetComponent<CharacterRig.GunAttacher>()
                  ?? player.AddComponent<CharacterRig.GunAttacher>();
        var gun = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Weapons/mac10.fbx");
        var soA = new SerializedObject(att);
        soA.FindProperty("gunPrefab").objectReferenceValue = gun;
        soA.ApplyModifiedPropertiesWithoutUndo();
        player.AddComponent<Laststand.PlayerShooter>();
        var ph = player.AddComponent<Laststand.Health>();
        ph.maxHp = 100f;

        // ---- camera
        var camGo = new GameObject("Main Camera");
        camGo.tag = "MainCamera";
        camGo.AddComponent<Camera>();
        camGo.AddComponent<AudioListener>();
        var cam = camGo.AddComponent<CharacterRig.ThirdPersonCamera>();
        cam.target = player.transform;
        cam.distance = 4.2f;

        // ---- game manager
        var gmGo = new GameObject("LaststandGame");
        var gm = gmGo.AddComponent<Laststand.LaststandGame>();
        var soG = new SerializedObject(gm);
        var arr = soG.FindProperty("enemyPrefabs");
        var loaded = new System.Collections.Generic.List<Object>();
        foreach (var p in EnemyPrefabPaths)
        {
            var pf = AssetDatabase.LoadAssetAtPath<GameObject>(p);
            if (pf != null) loaded.Add(pf);
            else Debug.LogWarning("[Arena] enemy prefab missing: " + p);
        }
        arr.arraySize = loaded.Count;
        for (int i = 0; i < loaded.Count; i++)
            arr.GetArrayElementAtIndex(i).objectReferenceValue = loaded[i];
        soG.FindProperty("player").objectReferenceValue = player.transform;
        soG.ApplyModifiedPropertiesWithoutUndo();

        if (!AssetDatabase.IsValidFolder("Assets/Scenes"))
            AssetDatabase.CreateFolder("Assets", "Scenes");
        EditorSceneManager.SaveScene(scene, ScenePath);
        Debug.Log($"[Arena] scene saved: {ScenePath} with {loaded.Count} enemy prefabs");
    }

    private static void PlacePropScaled(string path, Vector3 pos, float targetHeight, float rotY)
    {
        var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (prefab == null) { Debug.LogWarning("[Arena] prop missing: " + path); return; }
        var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
        var renderers = go.GetComponentsInChildren<Renderer>();
        float h = 0f;
        if (renderers.Length > 0)
        {
            var b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            h = b.size.y;
        }
        if (h > 0.0001f)
        {
            float s = targetHeight / h;
            go.transform.localScale = go.transform.localScale * s;
        }
        go.transform.position = pos;
        go.transform.rotation = Quaternion.Euler(0f, rotY, 0f);
    }

    private static void EnsureTag(string tag)
    {
        var tags = AssetDatabase.LoadAssetAtPath<Object>("ProjectSettings/TagManager.asset");
        var so = new SerializedObject(tags);
        var prop = so.FindProperty("tags");
        for (int i = 0; i < prop.arraySize; i++)
            if (prop.GetArrayElementAtIndex(i).stringValue == tag)
                return;
        prop.InsertArrayElementAtIndex(prop.arraySize);
        prop.GetArrayElementAtIndex(prop.arraySize - 1).stringValue = tag;
        so.ApplyModifiedProperties();
        Debug.Log("[Arena] added tag: " + tag);
    }
}
