using UnityEngine;
using UnityEngine.AI;
using Unity.AI.Navigation;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Runtime bootstrap: wires player/bots/HUD even if the scene was built once.
/// Owns match state, respawns, fallback ground.
/// </summary>
[DefaultExecutionOrder(-100)]
public class ArenaDirector : MonoBehaviour
{
    public static ArenaDirector Instance { get; private set; }
    public static Transform Player { get; private set; }
    public static Transform[] Bots { get; private set; }
    public static Vector3 HillPos { get; private set; } = new Vector3(-8f, 0f, 0f);
    public static bool MatchOver { get; private set; }
    public static bool PlayerWon { get; private set; }

    public int botCount = 7;
    readonly List<BotAI> liveBots = new List<BotAI>();

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (FindFirstObjectByType<ArenaDirector>()) return;
        var go = new GameObject("ArenaDirector");
        go.AddComponent<ArenaDirector>();
    }

    void Awake()
    {
        Instance = this;
        SettingsManager.Load();
        GameInput.BumperJumper = PlayerPrefs.GetInt("bumper", 0) == 1;
        if (!FindFirstObjectByType<SoundManager>()) new GameObject("SoundManager").AddComponent<SoundManager>();
        if (!FindFirstObjectByType<AudioDirector>()) new GameObject("AudioDirector").AddComponent<AudioDirector>();
        RumblePit.Ensure();
        if (!FindFirstObjectByType<OptionsMenu>()) gameObject.AddComponent<OptionsMenu>();
        if (!FindFirstObjectByType<ArenaHUD>()) gameObject.AddComponent<ArenaHUD>();
        if (!FindFirstObjectByType<WaifuCompanion>()) gameObject.AddComponent<WaifuCompanion>();
        if (!FindFirstObjectByType<RangeHUD>()) gameObject.AddComponent<RangeHUD>();
        RangeMaster.Ensure();
        EnsureWorld();
        LoadLockout();
        PickupRing.SpawnAll();
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
        WaifuCompanion.Say("WAIFU ARENA uplink. Seven hostiles. RB throws grenades. LB is your grapple.");
        Announcer.MatchStart();
    }

    /// <summary>Swap the world onto the LOCKOUT arena: hide the GLB maps, build the
    /// primitive arena with ground-level play (no more stranded spawns), re-seat
    /// hill/player/bots, then bake its navmesh.</summary>
    void LoadLockout()
    {
        var old = GameObject.Find("HavenMap"); if (old) old.SetActive(false);
        var inv = GameObject.Find("InvasionMap"); if (inv) inv.SetActive(false);
        var ground = GameObject.Find("FallbackGround");
        if (ground) ground.transform.position = new Vector3(0f, -25f, 0f);   // far below — Lockout owns the floors

        var root = new GameObject("LockoutMap");
        Lockout.Build(root.transform);

        // hill on the plateau — the fight comes to YOU at ground level
        var hill = FindFirstObjectByType<KingOfTheHill>();
        if (hill)
        {
            hill.transform.position = Lockout.HillSpot;
            HillPos = Lockout.HillSpot;
        }

        // player: south spawn, facing the arena
        if (Player)
        {
            Player.position = Lockout.PlayerSpot;
            Player.rotation = Quaternion.Euler(0f, 180f, 0f);
        }

        // bots spread on the grid; navmesh re-grips them after the bake
        Lockout.SeatBots();

        StartCoroutine(Lockout.BakeNav(root));
        Debug.Log("[LOCKOUT] arena built — plateau y=1, catwalk y=2, tower y=3, pit -0.8");
    }
    void Update()
    {
        GameInput.Tick();
        if (MatchOver && (GameInput.ReloadPressed || GameInput.JumpPressed))
            Restart();

        // V — travel between the arena and the Shrine Range
        if (GameInput.RangeTogglePressed && !MatchOver && !OptionsMenu.IsOpen)
        {
            if (RangeMaster.Instance && RangeMaster.Instance.InRange) RangeMaster.Instance.LeaveRange();
            else RangeMaster.Instance.EnterRange();
        }
    }

    void EnsureWorld()
    {
        if (!gameObject.scene.name.Contains("Shrine")) EnsureGround();   // the shrine builds its own floor
        var playerGo = GameObject.FindGameObjectWithTag("Player");
        if (!playerGo) playerGo = BuildPlayer();
        Player = playerGo.transform;
        var hp = playerGo.GetComponent<Health>();
        if (hp) { hp.isPlayer = true; hp.OnDeath += OnPlayerDeath; }

        var cam = Camera.main ? Camera.main.transform : playerGo.GetComponentInChildren<Camera>()?.transform;
        if (cam && !FindFirstObjectByType<FeelDirector>())
        {
            var feel = cam.gameObject.AddComponent<FeelDirector>();
            feel.cameraTransform = cam;
        }
        if (cam)
        {
            var load = playerGo.GetComponent<WeaponLoadout>();
            if (!load) load = playerGo.AddComponent<WeaponLoadout>();
            // ALWAYS rebuild the loadout: saved scenes carry stale serialized
            // weapons, which silently skipped every Weapon.Make() improvement
            // (orientation, per-gun pose, ADS zoom) — guns looked wrong forever.
            foreach (var w in cam.GetComponentsInChildren<Weapon>(true))
                Destroy(w.gameObject);
            load.Build(cam);
        }

        // WaifuBody versions change between builds; rebuild every body fresh so
        // scene-serialized visuals never shadow the latest pipeline (textures,
        // first-person hiding, tints).
        foreach (var wb in FindObjectsByType<WaifuBody>(FindObjectsSortMode.None))
            if (wb) wb.Build();

        var existing = FindObjectsByType<BotAI>(FindObjectsSortMode.None);
        liveBots.Clear();
        liveBots.AddRange(existing);
        bool shrineScene = gameObject.scene.name.Contains("Shrine");
        if (liveBots.Count == 0 && !shrineScene)   // the range is a no-combat zone
        {
            for (int i = 0; i < botCount; i++)
                liveBots.Add(SpawnBot(i));
        }
        // swap stale procedural robot bodies (saved scenes) for the waifu roster
        for (int i = 0; i < liveBots.Count; i++)
        {
            var b = liveBots[i];
            if (!b) continue;
            var stale = b.GetComponent<BotBody>();
            if (stale) Destroy(stale);
            var oldVis = b.transform.Find("BotVisual");
            if (oldVis) Destroy(oldVis.gameObject);
            if (!b.GetComponent<WaifuBotBody>())
                WaifuBotBody.Attach(b.gameObject, i + 1);
            if (!b.GetComponent<WaifuHitboxes>())
                WaifuHitboxes.Attach(b.gameObject, b.GetComponent<WaifuBotBody>());
            b.SetPlayer(Player);
        }

        Bots = new Transform[liveBots.Count];
        for (int i = 0; i < liveBots.Count; i++)
        {
            if (liveBots[i])
            {
                Bots[i] = liveBots[i].transform;
                RumblePit.Instance.Register(liveBots[i].transform, i);   // rumble roster
            }
        }
        RumblePit.Instance?.ResetMatch();

        var hill = FindFirstObjectByType<KingOfTheHill>();
        if (!hill && !shrineScene)   // no capture point at the training range
        {
            var h = new GameObject("CaptureHill");
            h.transform.position = HillPos;
            hill = h.AddComponent<KingOfTheHill>();
            var beacon = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            beacon.name = "Beacon";
            beacon.transform.SetParent(h.transform, false);
            beacon.transform.localPosition = new Vector3(0, 8f, 0);
            beacon.transform.localScale = new Vector3(0.35f, 8f, 0.35f);
            var col = beacon.GetComponent<Collider>();
            if (col) Destroy(col);
            var r = beacon.GetComponent<Renderer>();
            r.material = RuntimeAssets.LitMaterial(new Color(0.2f, 1f, 0.85f, 0.35f), 0.85f);
        }
        if (hill)
        {
            hill.playerTransform = Player;
            hill.botTransforms = Bots;
            HillPos = hill.transform.position;
        }
    }

    void EnsureGround()
    {
        if (GameObject.Find("FallbackGround")) return;
        var ground = GameObject.CreatePrimitive(PrimitiveType.Cube);
        ground.name = "FallbackGround";
        ground.transform.position = new Vector3(0f, -0.5f, 0f);
        ground.transform.localScale = new Vector3(400f, 1f, 400f);
        var r = ground.GetComponent<Renderer>();
        r.material = RuntimeAssets.LitMaterial(new Color(0.12f, 0.13f, 0.14f));
        GameObjectUtilitySafeStatic(ground);
    }

    static void GameObjectUtilitySafeStatic(GameObject go)
    {
        // runtime: nothing; editor bake uses SceneBuilder
    }

    GameObject BuildPlayer()
    {
        var player = new GameObject("Player");
        player.tag = "Player";

        var cc = player.AddComponent<CharacterController>();
        cc.height = 1.8f; cc.radius = 0.4f; cc.center = new Vector3(0, 0.9f, 0);
        player.AddComponent<PlayerController>();
        player.AddComponent<Health>().isPlayer = true;
        WaifuBody.Attach(player, true, 0);
        player.transform.position = SpawnPoint(0);

        var camGo = new GameObject("MainCamera");
        var cam = camGo.AddComponent<Camera>();
        cam.tag = "MainCamera";
        camGo.transform.SetParent(player.transform);
        camGo.transform.localPosition = new Vector3(0, 1.65f, 0);
        cam.nearClipPlane = 0.07f; cam.farClipPlane = 600f; cam.fieldOfView = 78f;
        if (!FindFirstObjectByType<AudioListener>()) camGo.AddComponent<AudioListener>();
        player.GetComponent<PlayerController>().cameraTransform = camGo.transform;
        return player;
    }

    BotAI SpawnBot(int i)
    {
        var bot = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        bot.name = "Bot_" + i;
        bot.transform.localScale = new Vector3(0.85f, 1f, 0.85f);
        bot.transform.position = SpawnPoint(i + 1);
        var ai = bot.AddComponent<BotAI>();
        bot.AddComponent<Health>();
        WaifuBotBody.Attach(bot, i + 1);   // the waifu you actually see
        WaifuHitboxes.Attach(bot, bot.GetComponent<WaifuBotBody>());   // location hits
        ai.SetPlayer(Player);
        return ai;
    }

    public static Vector3 SpawnPoint(int i)
    {
        if (GameObject.Find("LockoutMap")) return Lockout.SpawnSeat();   // arena grid, always reachable
        Vector3 c = HillPos + new Vector3(Mathf.Cos(i * 0.9f) * (18f + i * 3f), 8f, Mathf.Sin(i * 0.9f) * (18f + i * 3f));
        if (Physics.Raycast(c + Vector3.up * 20f, Vector3.down, out RaycastHit hit, 80f))
            return hit.point + Vector3.up * 1.1f;
        if (NavMesh.SamplePosition(c, out NavMeshHit n, 30f, NavMesh.AllAreas))
            return n.position + Vector3.up * 0.1f;
        c.y = 2.5f;
        return c;
    }

    void OnPlayerDeath(Health h)
    {
        StartCoroutine(PlayerRespawn(h));
    }

    IEnumerator PlayerRespawn(Health h)
    {
        yield return new WaitForSeconds(2.4f);
        if (MatchOver) yield break;
        h.Revive(GameObject.Find("LockoutMap") ? Lockout.PlayerSpot : SpawnPoint(0));
        var pc = Player ? Player.GetComponent<PlayerController>() : null;
        if (pc) pc.ResetGearOnRespawn();
        WaifuCompanion.Say("Back on your feet. Hill's still hot.");
    }

    public static void ScheduleBotRespawn(BotAI bot)
    {
        if (Instance) Instance.StartCoroutine(Instance.BotRespawn(bot));
    }

    IEnumerator BotRespawn(BotAI bot)
    {
        yield return new WaitForSeconds(4.2f);
        if (MatchOver || !bot) yield break;
        bot.RespawnAt(Lockout.SpawnSeat());   // always inside the arena
    }

    public static void EndMatch(bool playerWon)
    {
        if (MatchOver) return;
        MatchOver = true;
        PlayerWon = playerWon;
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
        WaifuCompanion.Say(playerWon ? "That's the sector. You and me — ugly, perfect." : "We lost the hill. Again is a choice, Spartan.");
    }

    void Restart()
    {
        MatchOver = false;
        Time.timeScale = 1f;
        var hill = KingOfTheHill.Instance;
        if (hill) { hill.playerScore = 0; hill.botScore = 0; hill.progress = 0.5f; }
        if (Player)
        {
            var h = Player.GetComponent<Health>();
            if (h) h.Revive(GameObject.Find("LockoutMap") ? Lockout.PlayerSpot : SpawnPoint(0));
            var pc = Player.GetComponent<PlayerController>();
            if (pc) pc.ResetGearOnRespawn();
        }
        foreach (var b in liveBots)
            if (b) b.RespawnAt(Lockout.SpawnSeat());
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
        WaifuCompanion.Say("Reset. Same hill. Don't waste the second chance.");
    }
}
