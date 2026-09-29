using UnityEngine;
using System.Collections;
using System.Collections.Generic;

/// <summary>
/// Waifu shooting range. B toggles the mode: bots pause, a firing pad
/// materialises and animated GLB dummies spawn on lanes. T rolls the
/// gacha: a random waifu is drawn in on the jackpot pad with her intro
/// clip. Dummies react with their own embedded clips — mai_maid carries
/// 13 (Standby, Reaction, Throw, Charaselect, CostumeChange...), so a
/// hit never looks the same twice.
/// </summary>
public class RangeMode : MonoBehaviour
{
    public static RangeMode Instance { get; private set; }
    public static bool Active { get; private set; }

    [Header("Tuning")]
    public float laneSpacing = 2.6f;
    public int laneCount = 7;
    public float laneDistance = 16f;
    public float strafeSpeed = 1.6f;
    public float respawnSeconds = 2.2f;

    // live state
    readonly List<AnimatedWaifu> dummies = new List<AnimatedWaifu>();
    GameObject padRoot;
    Transform playerT;
    bool padWasBuilt;

    void Awake() => Instance = this;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (FindFirstObjectByType<RangeMode>()) return;
        var go = new GameObject("RangeMode");
        go.AddComponent<RangeMode>();
    }

    void Update()
    {
        // the Shrine Range (V) owns input while active; this quick pad stays dormant
        if (RangeMaster.Instance && RangeMaster.Instance.InRange) return;
        if (Input.GetKeyDown(KeyCode.B)) Toggle();
        bool gachaKey = Input.GetKeyDown(KeyCode.T) || Input.GetKeyDown(KeyCode.JoystickButton5);
        if (Active && gachaKey && RangeMode.Instance)
            StartCoroutine(GachaRoll());
    }

    // ---- mode toggle ---------------------------------------------------

    void Toggle()
    {
        Active = !Active;
        if (Active) Enter();
        else Exit();
    }

    void Enter()
    {
        playerT = ArenaDirector.Player;
        if (!playerT) { Active = false; return; }

        BuildPad();

        // pause the war: bots stop hunting, scores freeze
        foreach (var b in ArenaDirector.Bots)
        {
            if (!b) continue;
            var ai = b.GetComponent<BotAI>();
            if (ai) ai.enabled = false;
            var agent = b.GetComponent<UnityEngine.AI.NavMeshAgent>();
            if (agent) agent.isStopped = true;
        }
        var koth = KingOfTheHill.Instance;
        if (koth) koth.enabled = false;

        WaifuCompanion.Say("Range open. B to go back to the hill. T to pull.");
        SpawnAllDummies();
    }

    void Exit()
    {
        foreach (var b in ArenaDirector.Bots)
        {
            if (!b) continue;
            var ai = b.GetComponent<BotAI>();
            if (ai) ai.enabled = true;
            var agent = b.GetComponent<UnityEngine.AI.NavMeshAgent>();
            if (agent) agent.isStopped = false;
        }
        var koth = KingOfTheHill.Instance;
        if (koth) koth.enabled = true;

        foreach (var d in dummies) if (d) d.Despawn();
        dummies.Clear();
        if (padRoot) Destroy(padRoot);

        WaifuCompanion.Say("Back to the hill. Show me what you practised.");
    }

    // ---- range pad -----------------------------------------------------

    void BuildPad()
    {
        if (padWasBuilt && padRoot)
        {
            padRoot.SetActive(true);
            return;
        }
        padRoot = new GameObject("RangePad");
        padWasBuilt = true;

        // firing line: a low wall with lane numbers is all a range needs
        var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
        wall.name = "FiringWall";
        wall.transform.SetParent(padRoot.transform, false);
        wall.transform.position = playerT.position + playerT.forward * 2.5f;
        wall.transform.rotation = Quaternion.LookRotation(playerT.forward, Vector3.up);
        wall.transform.localScale = new Vector3(laneCount * laneSpacing + 2f, 1.05f, 0.35f);
        wall.GetComponent<Renderer>().material = RuntimeAssets.LitMaterial(new Color(0.08f, 0.09f, 0.12f));

        for (int i = 0; i < laneCount; i++)
        {
            float off = (i - (laneCount - 1) * 0.5f) * laneSpacing;
            Vector3 lanePos = wall.transform.position + wall.transform.right * off;

            var plate = GameObject.CreatePrimitive(PrimitiveType.Cube);
            plate.name = "Lane_" + i;
            plate.transform.SetParent(padRoot.transform, false);
            plate.transform.position = lanePos + Vector3.up * 0.55f;
            plate.transform.rotation = wall.transform.rotation;
            plate.transform.localScale = new Vector3(laneSpacing * 0.7f, 0.08f, 0.6f);
            var r = plate.GetComponent<Renderer>();
            r.material = RuntimeAssets.LitMaterial(new Color(0.05f, 0.06f, 0.08f), 0f);
        }
    }

    // ---- dummies -------------------------------------------------------

    void SpawnAllDummies()
    {
        ClearDummies();
        for (int i = 0; i < laneCount; i++)
            SpawnDummy(i, Random.Range(0, AnimatedWaifu.PoolCount));
    }

    void ClearDummies()
    {
        foreach (var d in dummies) if (d) d.Despawn();
        dummies.Clear();
    }

    void SpawnDummy(int lane, int poolIdx)
    {
        if (!padRoot || !playerT) return;
        var wall = padRoot.transform.Find("FiringWall");
        if (!wall) return;

        float off = (lane - (laneCount - 1) * 0.5f) * laneSpacing;
        Vector3 pos = wall.position + wall.right * off + wall.forward * laneDistance;

        var go = new GameObject("RangeDummy_" + lane);
        go.transform.position = pos;
        var anim = go.AddComponent<AnimatedWaifu>();
        anim.poolIndex = poolIdx;
        anim.strafeHalfWidth = laneSpacing * 0.5f;
        anim.strafeSpeed = strafeSpeed;
        anim.laneCenterX = pos.x;
        anim.respawnDelay = respawnSeconds;
        dummies.Add(anim);

        // a target needs to be hittable: capsule collider + Health
        var col = go.AddComponent<CapsuleCollider>();
        col.height = 1.6f;
        col.center = new Vector3(0f, 0.8f, 0f);
        col.radius = 0.38f;
        var hp = go.AddComponent<Health>();
        hp.maxHealth = 60f; hp.health = 60f;
        hp.maxShield = 0f; hp.shield = 0f;   // raw HP: every hit reads instantly
        anim.Bind(hp);
    }

    // ---- gacha ---------------------------------------------------------

    IEnumerator GachaRoll()
    {
        if (!padRoot || dummies.Count == 0) yield break;

        WaifuCompanion.Say("Rolling the pull...", 1.2f);
        ArenaHUD.Notify("PULLING...", ArenaHUD.Note.Info);

        // drama: cycle 3 rapid lane swaps on the centre lane, then settle
        int centre = laneCount / 2;
        for (int i = 0; i < 3; i++)
        {
            dummies[centre].Swap(Random.Range(0, AnimatedWaifu.PoolCount));
            yield return new WaitForSeconds(0.22f);
        }
        int winner = Random.Range(0, AnimatedWaifu.PlayableCount);
        dummies[centre].Swap(winner, playIntro: true);
        WaifuCompanion.Say("Jackpot lane: " + AnimatedWaifu.DisplayName(winner) + ". Make her dance.", 4f);
    }
}
