using UnityEngine;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Runs the Shrine Range: drill selection, target scheduling, scoring, combo,
/// medals, ranks and the gacha card pull. Owns entering/leaving the range.
/// </summary>
public class RangeMaster : MonoBehaviour
{
    public static RangeMaster Instance { get; private set; }

    public enum Mode { FreeFire, Precision, SplitTarget, HaloWave, Popcorn, Count }

    public struct ModeDef
    {
        public string name, subtitle, howTo;
        public float duration;      // 0 = untimed
        public float respawnDelay;
        public int targetHp;
        public bool spawnsDrones;
        public bool spawnsPlates;
        public bool missPenalty;
        public ModeDef(string n, string s, string h, float d, float rd, int hp, bool drones, bool plates, bool miss)
        {
            name = n; subtitle = s; howTo = h; duration = d; respawnDelay = rd;
            targetHp = hp; spawnsDrones = drones; spawnsPlates = plates; missPenalty = miss;
        }
    }

    public static readonly ModeDef[] Modes =
    {
        new ModeDef("FREE FIRE",    "SANDBOX",      "No timer. Plates respawn forever. Find your rhythm.",
            0f, 1.4f, 1, false, true, false),
        new ModeDef("PRECISION",    "MARKSMANSHIP", "Halo cores pay 4×. Body shots feed the combo break. 60 seconds.",
            60f, 1.6f, 1, false, false, true),
        new ModeDef("SPLIT TARGET", "REFLEX",       "Popups drop in pairs. Clear each pair before the next. 75 seconds.",
            75f, 0.9f, 2, false, false, true),
        new ModeDef("HALO WAVE",    "TRACKING",     "Drones orbit the shrines. Wave after wave, faster. 90 seconds.",
            90f, 1.0f, 1, true, false, true),
        new ModeDef("POPCORN",      "FLICK",        "One target at a time, anywhere on the field. No timer. Chase the combo.",
            0f, 0.35f, 1, false, false, true),
    };

    public Mode mode = Mode.FreeFire;
    public bool InRange { get; private set; }

    // scoring
    public int Score { get; private set; }
    public int Combo { get; private set; }
    public int BestCombo { get; private set; }
    public int Hits { get; private set; }
    public int Shots { get; private set; }
    public int WeakHits { get; private set; }
    public float TimeLeft { get; private set; }
    public bool DrillLive { get; private set; }

    string lastWeaponId;
    public string BestScoreId => lastWeaponId;

    // gacha
    public enum Rarity { Common, Rare, Epic, Legendary }
    public struct Pull
    {
        public Rarity rarity;
        public string girlName;
        public string title;
        public Color color;
    }
    public Pull? LastPull { get; private set; }
    public List<Pull> Collection { get; } = new List<Pull>();
    int pullsOwed;

    // persistent bests
    const string PrefBase = "range_best_";
    public static int BestFor(Mode m) => PlayerPrefs.GetInt(PrefBase + (int)m, 0);

    // internals
    readonly List<RangeTarget> popups = new List<RangeTarget>();
    readonly List<RangeTarget> drones = new List<RangeTarget>();
    readonly List<RangeTarget> plates = new List<RangeTarget>();
    ShrineRange shrine;
    Transform player;
    Vector3 arenaReturn = new Vector3(-10f, 3f, 20f);
    float nextSpawnAt;
    int wave;
    ModeDef def;   // the live drill definition, refreshed by Schedule

    // ---------------------------------------------------------- lifecycle ----

    public static RangeMaster Ensure()
    {
        if (Instance) return Instance;
        var existing = FindFirstObjectByType<RangeMaster>();
        if (existing) { Instance = existing; return existing; }
        var go = new GameObject("RangeMaster");
        return go.AddComponent<RangeMaster>();
    }

    void Awake()
    {
        if (Instance && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
    }

    void Start()
    {
        // Standalone Shrine Range scene boots straight into training.
        if (!InRange && UnityEngine.SceneManagement.SceneManager.GetActiveScene().name.Contains("Shrine"))
            EnterRange();
    }

    void Update()
    {
        if (!InRange) return;

        // toggle back to the arena; V is handled once by ArenaDirector
        if (Input.GetKeyDown(KeyCode.B)) { LeaveRange(); return; }

        // mode select: brackets or F1..F5
        int want = -1;
        if (Input.GetKeyDown(KeyCode.F1)) want = 0;
        if (Input.GetKeyDown(KeyCode.F2)) want = 1;
        if (Input.GetKeyDown(KeyCode.F3)) want = 2;
        if (Input.GetKeyDown(KeyCode.F4)) want = 3;
        if (Input.GetKeyDown(KeyCode.F5)) want = 4;
        if (Input.GetKeyDown(KeyCode.LeftBracket)) want = Mathf.Clamp(((int)mode + Modes.Length - 1) % (int)Mode.Count, 0, 4);
        if (Input.GetKeyDown(KeyCode.RightBracket)) want = Mathf.Clamp(((int)mode + 1) % (int)Mode.Count, 0, 4);
        if (want >= 0) { SelectMode((Mode)want); }

        // start drill: fire while drill not live (fresh spawn or after results)
        if (!DrillLive && GameInput.FirePressed && !OptionsMenu.IsOpen) BeginDrill();

        // sandbox has no timer — call the set manually to bank the run
        if (DrillLive && mode == Mode.FreeFire && Input.GetKeyDown(KeyCode.C)) EndDrill();

        RespawnPlates();

        if (DrillLive)
        {
            if (Modes[(int)mode].duration > 0f)
            {
                TimeLeft -= Time.deltaTime;
                if (TimeLeft <= 0f) { TimeLeft = 0f; EndDrill(); }
            }
        }

        Schedule();
    }

    // ------------------------------------------------------------ travel ----

    public void EnterRange()
    {
        if (InRange) return;
        InRange = true;

        shrine = ShrineRange.Instance;
        if (!shrine)
        {
            var go = new GameObject("ShrineRange");
            shrine = go.AddComponent<ShrineRange>();
            shrine.Generate();
            shrine.AttachPetals();
        }
        shrine.EnsureWind();   // covers the pre-built standalone scene too

        player = ArenaDirector.Player;
        if (player)
        {
            arenaReturn = player.position;
            var cc = player.GetComponent<CharacterController>();
            var spot = new Vector3(0f, 1.2f, 31f);
            if (cc) { cc.enabled = false; player.position = spot; cc.enabled = true; }
            else player.position = spot;
            var hp = player.GetComponent<Health>();
            if (hp) hp.Revive(spot);
        }

        BuildTargets();
        SelectMode(mode);
        WaifuCompanion.Say("Shrine Range. No respawns out here — just you, the moon, and my scorecard.");
        ArenaHUD.Notify("V  ARENA   ·   B  LEAVE RANGE", ArenaHUD.Note.Info);
    }

    public void LeaveRange()
    {
        if (!InRange) return;
        InRange = false;
        DrillLive = false;
        ClearTargets();
        RangeHUD.CloseGacha();

        if (player)
        {
            var cc = player.GetComponent<CharacterController>();
            if (cc) { cc.enabled = false; player.position = arenaReturn; cc.enabled = true; }
            else player.position = arenaReturn;
        }
        WaifuCompanion.Say("Back to the arena. Bring what the range taught you.");
    }

    // ------------------------------------------------------------ targets ----

    void BuildTargets()
    {
        ClearTargets();
        if (!shrine) return;
        foreach (var s in shrine.PopupSpots)
        {
            var t = RangeTarget.MakePopup(transform, s, Random.Range(0f, 360f));
            t.hp = 1;
            popups.Add(t);
            t.gameObject.SetActive(false);
        }
        foreach (var s in shrine.DroneSpots)
        {
            var d = RangeTarget.MakeDrone(transform, s);
            drones.Add(d);
            d.gameObject.SetActive(false);
        }
        foreach (var s in shrine.PlateSpots)
        {
            var p = RangeTarget.MakePlate(transform, s, 180f);
            plates.Add(p);
        }
    }

    void ClearTargets()
    {
        foreach (var t in popups) if (t) Destroy(t.gameObject);
        foreach (var t in drones) if (t) Destroy(t.gameObject);
        foreach (var t in plates) if (t) Destroy(t.gameObject);
        popups.Clear(); drones.Clear(); plates.Clear();
    }

    void Schedule()
    {
        def = Modes[(int)mode];   // keep fresh for drill changes mid-run
        if (!DrillLive) return;
        float now = Time.time;
        if (now < nextSpawnAt) return;

        int live = LiveCount();
        int want = mode == Mode.SplitTarget ? 2 : 1;
        if (mode == Mode.Popcorn) want = 1;

        if (live >= want) { nextSpawnAt = now + 0.2f; return; }

        if (def.spawnsDrones) SpawnDrone();
        else SpawnPopup();
        nextSpawnAt = now + def.respawnDelay;
    }

    /// <summary>Sandbox plates pop back up a beat after they fall.</summary>
    void RespawnPlates()
    {
        if (!Modes[(int)mode].spawnsPlates) return;
        if (Time.time < nextPlateAt) return;
        bool raised = false;
        foreach (var p in plates)
            if (p && !p.active && !p.IsAnimating) { p.Raise(999f); raised = true; }
        if (raised) nextPlateAt = Time.time + 1.2f;
    }

    float nextPlateAt;

    int LiveCount()
    {
        int n = 0;
        foreach (var t in popups) if (t && t.gameObject.activeSelf && t.active) n++;
        foreach (var d in drones) if (d && d.gameObject.activeSelf && d.active) n++;
        return n;
    }

    void SpawnPopup()
    {
        RangeTarget pick = null;
        foreach (var t in popups)
        {
            if (!t || t.gameObject.activeSelf || t.active) continue;
            if (!pick || Random.value > 0.5f) pick = t;
        }
        if (!pick) return;
        pick.hp = Mathf.Max(1, def.targetHp);
        pick.score = 100;
        pick.weakScore = 250;
        pick.Raise(def.duration > 0f ? 7.5f : 6f);
    }

    void SpawnDrone()
    {
        RangeTarget pick = null;
        foreach (var d in drones)
        {
            if (!d || d.gameObject.activeSelf || d.active) continue;
            if (!pick || Random.value > 0.5f) pick = d;
        }
        if (!pick) return;
        pick.score = 150;
        pick.weakScore = 300;
        float life = 4.2f - Mathf.Min(2f, wave * 0.15f);
        pick.Raise(life);
        wave++;
    }

    // ------------------------------------------------------------ drill ----

    public void SelectMode(Mode m)
    {
        mode = m;
        DrillLive = false;
        Score = 0; Combo = 0; Hits = 0; Shots = 0; WeakHits = 0; BestCombo = 0;
        TimeLeft = Modes[(int)m].duration;
        LastPull = null;
        foreach (var t in popups) if (t) { t.Lower(); t.gameObject.SetActive(true); }
        foreach (var d in drones) if (d) { d.Lower(); d.gameObject.SetActive(true); }
        foreach (var p in plates) if (p) { p.gameObject.SetActive(Modes[(int)m].spawnsPlates); p.Raise(999f); if (!Modes[(int)m].spawnsPlates) p.gameObject.SetActive(false); }
        RangeHUD.CloseGacha();
        ArenaHUD.Notify(Modes[(int)m].name + " — " + Modes[(int)m].howTo, ArenaHUD.Note.Info);
        WaifuCompanion.Say(Modes[(int)m].howTo);
        nextSpawnAt = Time.time + 0.4f;
        wave = 0;
    }

    void BeginDrill()
    {
        DrillLive = true;
        Score = 0; Combo = 0; Hits = 0; Shots = 0; WeakHits = 0; BestCombo = 0;
        TimeLeft = Modes[(int)mode].duration;
        wave = 0;
        nextSpawnAt = Time.time;
        SoundManager.UiTick();
    }

    void EndDrill()
    {
        DrillLive = false;
        foreach (var t in popups) if (t) t.Lower();
        foreach (var d in drones) if (d) d.Lower();

        int best = BestFor(mode);
        bool record = Score > best;
        if (record) { PlayerPrefs.SetInt(PrefBase + (int)mode, Score); PlayerPrefs.Save(); }

        float acc = Shots > 0 ? (float)Hits / Shots : 0f;
        string rank = RankFor(Score, acc);
        RangeHUD.ShowResults(this, rank, record);

        // gacha: S rank pays out big, every drill pays the meter
        int owed = rank == "S" ? 3 : rank == "A" ? 2 : 1;
        pullsOwed += owed;
        if (pullsOwed > 0) StartCoroutine(DelayedPull(1.1f));
        WaifuCompanion.Say(record
            ? "New record. I'm framing this one."
            : rank == "S" ? "S rank. You are glowing, Spartan."
            : "Good set. Again, but meaner.");
    }

    string RankFor(int score, float acc)
    {
        if (mode == Mode.FreeFire) return acc > 0.9f ? "S" : acc > 0.75f ? "A" : acc > 0.55f ? "B" : "C";
        int[] s = SThresholds();
        if (score >= s[0] && acc > 0.72f) return "S";
        if (score >= s[1]) return "A";
        if (score >= s[2]) return "B";
        return "C";
    }

    int[] SThresholds()
    {
        switch (mode)
        {
            case Mode.Precision: return new[] { 4200, 3000, 1800 };
            case Mode.SplitTarget: return new[] { 5200, 3600, 2200 };
            case Mode.HaloWave: return new[] { 6000, 4200, 2600 };
            case Mode.Popcorn: return new[] { 7000, 4800, 3000 };
            default: return new[] { 9999, 9999, 9999 };
        }
    }

    IEnumerator DelayedPull(float wait)
    {
        yield return new WaitForSecondsRealtime(wait);
        while (pullsOwed > 0)
        {
            pullsOwed--;
            GrantPull();
            RangeHUD.ShowGacha(LastPull.Value);
            yield return new WaitForSecondsRealtime(1.6f);
        }
    }

    void GrantPull()
    {
        // weighting shifts with score: great drills pull better pools
        float roll = Random.value;
        float bonus = Mathf.Clamp01(Score / 7000f) * 0.25f;
        Rarity r;
        if (roll < 0.02f + bonus * 0.35f) r = Rarity.Legendary;
        else if (roll < 0.10f + bonus * 0.6f) r = Rarity.Epic;
        else if (roll < 0.34f + bonus) r = Rarity.Rare;
        else r = Rarity.Common;

        string[] common = { "ECHO-02", "ECHO-11", "ECHO-19", "ECHO-23" };
        string[] rare = { "KIRA-7", "MIRA-4", "SORA-9", "YUKI-12" };
        string[] epic = { "SERAPH-01", "LUNA-8", "AOI-3", "HOSHI-5" };
        string[] leg = { "AMATERASU-0", "TSUKUYOMI-2", "ECHO ZERO" };
        string[] titlesC = { "CADET", "TRAINEE", "ROOKIE" };
        string[] titlesR = { "GUNNER", "SCOUT", "VANGUARD" };
        string[] titlesE = { "SENTINEL", "VALKYRIE", "WARDEN" };
        string[] titlesL = { "GODDESS OF VICTORY", "MOON SAINT", "PRIME ECHO" };

        string n, t;
        switch (r)
        {
            case Rarity.Legendary: n = leg[Random.Range(0, leg.Length)]; t = titlesL[Random.Range(0, titlesL.Length)]; break;
            case Rarity.Epic: n = epic[Random.Range(0, epic.Length)]; t = titlesE[Random.Range(0, epic.Length)]; break;
            case Rarity.Rare: n = rare[Random.Range(0, rare.Length)]; t = titlesR[Random.Range(0, rare.Length)]; break;
            default: n = common[Random.Range(0, common.Length)]; t = titlesC[Random.Range(0, titlesC.Length)]; break;
        }
        var p = new Pull { rarity = r, girlName = n, title = t, color = RarityColor(r) };
        Collection.Add(p);
        LastPull = p;
        SoundManager.GachaJingle(r == Rarity.Epic || r == Rarity.Legendary);
    }

    public static Color RarityColor(Rarity r)
    {
        switch (r)
        {
            case Rarity.Legendary: return new Color(1f, 0.72f, 0.25f);
            case Rarity.Epic: return new Color(0.72f, 0.45f, 1f);
            case Rarity.Rare: return new Color(0.35f, 0.7f, 1f);
            default: return new Color(0.65f, 0.7f, 0.75f);
        }
    }

    // ------------------------------------------------------------ hooks ----

    /// <summary>Called by Weapon after every trigger pull.</summary>
    public static void NotifyShot(Weapon w)
    {
        var i = Instance;
        if (i == null || !i.InRange || !i.DrillLive) return;
        i.Shots++;
        string id = w ? w.kind.ToString() : "";
        if (id != i.lastWeaponId)
        {
            i.lastWeaponId = id;
            i.Shots = 1; i.Hits = 0;   // accuracy is per-weapon-session
        }
    }

    /// <summary>Called by Weapon when a ray hits something on the range.</summary>
    public static void NotifyHit(RaycastHit hit)
    {
        var i = Instance;
        if (i == null || !i.InRange) return;

        var t = hit.collider.GetComponentInParent<RangeTarget>();
        if (t == null)
        {
            // stray bullet during a drill = combo break on strict modes
            if (i.DrillLive && Modes[(int)i.mode].missPenalty && i.Combo > 0)
            {
                i.Combo = 0;
                ArenaHUD.Notify("COMBO BROKEN", ArenaHUD.Note.Bad);
            }
            return;
        }
        bool weak = IsWeakPoint(hit, t);
        i.RegisterHit(t, hit.point, weak);
    }

    static bool IsWeakPoint(RaycastHit hit, RangeTarget t)
    {
        // halo cores get their own sphere collider named for the router;
        // every other collider on a target is a body shot
        return hit.collider.name.Contains("HaloCore");
    }

    void RegisterHit(RangeTarget t, Vector3 point, bool weak)
    {
        int basePts = t.Hit(point, weak);
        if (basePts <= 0) return;

        Hits++;
        if (weak) WeakHits++;

        bool strict = Modes[(int)mode].missPenalty;
        if (strict) Combo++;
        else Combo = Mathf.Max(Combo, 0) + (weak ? 1 : 0);
        if (Combo > BestCombo) BestCombo = Combo;

        float mult = 1f + Mathf.Min(Combo, 20) * 0.05f;      // up to x2
        mult *= weak ? 1.6f : 1f;
        int pts = Mathf.RoundToInt(basePts * mult);
        Score += pts;

        RangeFX.ScorePuff(point + Vector3.up * 0.25f, weak ? new Color(1f, 0.82f, 0.4f) : new Color(0.5f, 0.95f, 0.9f));
        SoundManager.TargetDing(weak, Combo);

        if (t.kind == RangeTarget.Kind.Popup || t.kind == RangeTarget.Kind.Drone)
        {
            RangeFX.Burst(point);
            if (Combo >= 8 && Combo % 8 == 0) WaifuCompanion.Say(Combo + " chain. Keep the line hot.");
        }

        // popcorn: instantly schedule the next one
        if (mode == Mode.Popcorn) nextSpawnAt = Time.time + 0.12f;
    }

    // --------------------------------------------------- weapon suppression ----

    /// <summary>Bots stand down while you're at the range.</summary>
    public static bool BotsFrozen => Instance != null && Instance.InRange;
}
