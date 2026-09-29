using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.AI;
using Unity.AI.Navigation;
using UnityEditor.Build.Reporting;

/// <summary>
/// Tools → Waifu Halo → Build Arena Scene / Build WebGL.
/// </summary>
public static class SceneBuilder
{
    const string ScenePath = "Assets/Scenes/Arena.unity";
    const string ShrineScenePath = "Assets/Scenes/ShrineRange.unity";

    [MenuItem("Tools/Waifu Halo/Diagnose Map")]
    public static void DiagnoseMap()
    {
        string p = "Assets/Map/invasion_map.obj";
        var g = AssetDatabase.LoadAssetAtPath<GameObject>(p);
        Debug.Log("GameObject load: " + (g ? g.name : "NULL"));
        var all = AssetDatabase.LoadAllAssetsAtPath(p);
        Debug.Log("All assets at path: " + all.Length);
        foreach (var a in all) Debug.Log("  sub: " + a.GetType().Name + " → " + a.name);
    }

    [MenuItem("Tools/Waifu Halo/Build Arena Scene")]
    public static void BuildScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        string mapPath = "Assets/Map/invasion_map.obj";
        var map = AssetDatabase.LoadAssetAtPath<GameObject>(mapPath);
        if (!map)
        {
            AssetDatabase.ImportAsset(mapPath, ImportAssetOptions.ForceSynchronousImport);
            map = AssetDatabase.LoadAssetAtPath<GameObject>(mapPath);
        }
        GameObject mapInst = null;
        if (map)
        {
            mapInst = PrefabUtility.InstantiatePrefab(map) as GameObject;
            mapInst.name = "InvasionMap";
            mapInst.transform.position = Vector3.zero;
            foreach (var mf in mapInst.GetComponentsInChildren<MeshFilter>())
            {
                if (!mf.sharedMesh) continue;
                var mc = mf.GetComponent<MeshCollider>();
                if (!mc) mc = mf.gameObject.AddComponent<MeshCollider>();
                mc.sharedMesh = mf.sharedMesh;
                GameObjectUtility.SetStaticEditorFlags(mf.gameObject,
                    StaticEditorFlags.BatchingStatic | StaticEditorFlags.NavigationStatic);
            }
        }
        else Debug.LogWarning("Map missing — director will spawn a fallback ground.");

        var ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
        ground.name = "FallbackGround";
        ground.transform.position = new Vector3(0, -0.5f, 0);
        ground.transform.localScale = new Vector3(400, 1, 400);
        GameObjectUtility.SetStaticEditorFlags(ground, StaticEditorFlags.BatchingStatic | StaticEditorFlags.NavigationStatic);

        var player = new GameObject("Player");
        player.tag = "Player";
        var cc = player.AddComponent<CharacterController>();
        cc.height = 1.8f; cc.radius = 0.4f; cc.center = new Vector3(0, 0.9f, 0);
        var pc = player.AddComponent<PlayerController>();
        var php = player.AddComponent<Health>();
        php.isPlayer = true;
        WaifuBody.Attach(player, true, 0);
        player.transform.position = new Vector3(-10f, 4f, 20f);

        var camGo = new GameObject("MainCamera");
        var cam = camGo.AddComponent<Camera>();
        cam.tag = "MainCamera";
        camGo.transform.SetParent(player.transform);
        camGo.transform.localPosition = new Vector3(0, 1.65f, 0);
        cam.nearClipPlane = 0.07f; cam.farClipPlane = 600f; cam.fieldOfView = 78f;
        camGo.AddComponent<AudioListener>();
        pc.cameraTransform = camGo.transform;
        camGo.AddComponent<FeelDirector>().cameraTransform = camGo.transform;
        player.AddComponent<WeaponLoadout>().Build(camGo.transform);

        var bots = new Transform[7];
        for (int i = 0; i < 7; i++)
        {
            var bot = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            bot.name = "Bot_" + i;
            float ang = i * Mathf.PI * 2f / 7f;
            bot.transform.position = new Vector3(-8f + Mathf.Cos(ang) * 28f, 2f, Mathf.Sin(ang) * 28f);
            var ai = bot.AddComponent<BotAI>();
            bot.AddComponent<Health>();
            BotBody.Attach(bot, (BotBody.Archetype)(i % 3));
            ai.SetPlayer(player.transform);
            bots[i] = bot.transform;
        }

        var hill = new GameObject("CaptureHill");
        hill.transform.position = new Vector3(-8f, 0f, 0f);
        var koth = hill.AddComponent<KingOfTheHill>();
        koth.playerTransform = player.transform;
        koth.botTransforms = bots;
        var beacon = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        beacon.transform.SetParent(hill.transform);
        beacon.transform.localPosition = new Vector3(0, 8f, 0);
        beacon.transform.localScale = new Vector3(0.35f, 8f, 0.35f);
        Object.DestroyImmediate(beacon.GetComponent<Collider>());
        beacon.GetComponent<Renderer>().sharedMaterial = new Material(Shader.Find("Standard"))
        {
            color = new Color(0.2f, 1f, 0.85f)
        };

        var sunGo = new GameObject("Sun");
        var sun = sunGo.AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.intensity = 1.35f;
        sun.color = new Color(1f, 0.93f, 0.82f);
        sun.shadows = LightShadows.Soft;
        sunGo.transform.rotation = Quaternion.Euler(48f, -32f, 0f);
        RenderSettings.fog = true;
        RenderSettings.fogColor = new Color(0.08f, 0.09f, 0.12f);
        RenderSettings.fogDensity = 0.008f;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(0.35f, 0.42f, 0.5f);
        RenderSettings.ambientEquatorColor = new Color(0.18f, 0.16f, 0.2f);
        RenderSettings.ambientGroundColor = new Color(0.05f, 0.05f, 0.06f);

        var dir = new GameObject("ArenaDirector");
        dir.AddComponent<ArenaDirector>();
        dir.AddComponent<SoundManager>();
        dir.AddComponent<OptionsMenu>();
        dir.AddComponent<ArenaHUD>();
        dir.AddComponent<WaifuCompanion>();

        var navHost = mapInst ? mapInst : ground;
        var surface = navHost.GetComponent<NavMeshSurface>();
        if (!surface) surface = navHost.AddComponent<NavMeshSurface>();
        surface.collectObjects = CollectObjects.All;
        surface.useGeometry = NavMeshCollectGeometry.PhysicsColliders;
        surface.BuildNavMesh();

        System.IO.Directory.CreateDirectory("Assets/Scenes");
        EditorSceneManager.SaveScene(scene, ScenePath);
        var scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        EditorBuildSettings.scenes = scenes;
        Debug.Log("Arena scene built + navmesh baked. Play, or Tools → Waifu Halo → Build WebGL.");
    }

    [MenuItem("Tools/Waifu Halo/Build Shrine Range Scene")]
    public static void BuildShrineScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        // the shrine itself (map, lights, sky)
        ShrineRange.Build(null);

        // player on the firing deck
        var player = new GameObject("Player");
        player.tag = "Player";
        var cc = player.AddComponent<CharacterController>();
        cc.height = 1.8f; cc.radius = 0.4f; cc.center = new Vector3(0, 0.9f, 0);
        var pc = player.AddComponent<PlayerController>();
        var php = player.AddComponent<Health>();
        php.isPlayer = true;
        WaifuBody.Attach(player, true, 0);
        player.transform.position = new Vector3(0f, 1.4f, 31f);

        var camGo = new GameObject("MainCamera");
        var cam = camGo.AddComponent<Camera>();
        cam.tag = "MainCamera";
        camGo.transform.SetParent(player.transform);
        camGo.transform.localPosition = new Vector3(0, 1.65f, 0);
        cam.nearClipPlane = 0.07f; cam.farClipPlane = 900f; cam.fieldOfView = 78f;
        camGo.AddComponent<AudioListener>();
        pc.cameraTransform = camGo.transform;
        camGo.AddComponent<FeelDirector>().cameraTransform = camGo.transform;
        player.AddComponent<WeaponLoadout>().Build(camGo.transform);

        // ground plane for navmesh host (the shrine floor is 46x90 at y≈-0.15)
        var ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
        ground.name = "RangeFloor";
        ground.transform.position = new Vector3(0, -0.15f, 0);
        ground.transform.localScale = new Vector3(46, 0.3f, 90);
        GameObjectUtility.SetStaticEditorFlags(ground, StaticEditorFlags.NavigationStatic);

        var dir = new GameObject("ArenaDirector");
        dir.AddComponent<ArenaDirector>();
        dir.AddComponent<SoundManager>();
        dir.AddComponent<OptionsMenu>();
        dir.AddComponent<RangeHUD>();
        dir.AddComponent<WaifuCompanion>();
        dir.AddComponent<RangeMaster>();   // Start() auto-enters on the Shrine scene

        // navmesh on the range floor (popups are static; bots aren't used here)
        var surface = ground.GetComponent<NavMeshSurface>();
        if (!surface) surface = ground.AddComponent<NavMeshSurface>();
        surface.collectObjects = CollectObjects.All;
        surface.useGeometry = NavMeshCollectGeometry.PhysicsColliders;
        surface.BuildNavMesh();

        System.IO.Directory.CreateDirectory("Assets/Scenes");
        EditorSceneManager.SaveScene(scene, ShrineScenePath);
        var scenes = new System.Collections.Generic.List<EditorBuildSettingsScene>(EditorBuildSettings.scenes);
        if (!scenes.Exists(s => s.path == ShrineScenePath)) scenes.Add(new EditorBuildSettingsScene(ShrineScenePath, true));
        EditorBuildSettings.scenes = scenes.ToArray();
        Debug.Log("Shrine Range scene built. Play to train. V returns to the arena when loaded from the Arena scene.");
    }

    [MenuItem("Tools/Waifu Halo/Build WebGL")]
    public static void BuildWebGL()
    {
        BuildScene();
        BuildShrineScene();   // both scenes ship in the build

        // Must happen before the player is built: shader stripping drops "Standard"
        // unless it is listed as always-included, and the game makes its materials at runtime.
        AssetCheck.IncludeRuntimeShaders();

        PlayerSettings.companyName = "WaifuFoundry";
        PlayerSettings.productName = "HALO WAIFU";
        PlayerSettings.WebGL.template = "PROJECT:WaifuHalo";
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
        PlayerSettings.WebGL.decompressionFallback = true;
        PlayerSettings.runInBackground = true;

        var opts = new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = "Build/WebGL",
            target = BuildTarget.WebGL,
            options = BuildOptions.CompressWithLz4HC
        };
        var report = BuildPipeline.BuildPlayer(opts);
        Debug.Log("WebGL build: " + report.summary.result + " → Build/WebGL  size=" + report.summary.totalSize);
        if (report.summary.result != BuildResult.Succeeded)
            throw new System.Exception("WebGL build failed: " + report.summary.result);
    }
}
