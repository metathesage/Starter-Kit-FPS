using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// RUMBLE PIT — free-for-all team deathmatch. Everyone vs everyone, first to
/// KillGoal wins. Bots fight each other as well as the player (target lottery
/// with a slight player bias so the pit feels fair). Kills feed a live
/// scoreboard and a killfeed banner; replaces the KOTH objective when active.
/// </summary>
public class RumblePit : MonoBehaviour
{
    public static RumblePit Instance { get; private set; }
    public static bool Active => Instance != null && Instance.enabled && !ArenaDirector.MatchOver;

    [Header("Rules")]
    public int killGoal = 15;
    public float biasToPlayer = 0.4f;   // portion of bot attention aimed at you

    public int PlayerKills { get; private set; }
    public int PlayerDeaths { get; private set; }

    class BotEntry { public BotAI ai; public int kills; public int deaths; public string name; }
    readonly List<BotEntry> bots = new List<BotEntry>();

    static readonly string[] Callsigns =
    {
        "KIRA-7", "MIRA-4", "SORA-9", "YUKI-12", "AOI-3", "HOSHI-5", "LUNA-8", "REI-2"
    };

    void Awake() => Instance = this;

    public static void Ensure()
    {
        if (Instance) return;
        var existing = FindFirstObjectByType<RumblePit>();
        if (existing) { Instance = existing; return; }
        var go = new GameObject("RumblePit");
        go.AddComponent<RumblePit>();
    }

    public void Register(Transform bot, int index)
    {
        foreach (var e in bots) if (e.ai && e.ai.transform == bot) return;
        bots.Add(new BotEntry
        {
            ai = bot.GetComponent<BotAI>(),
            name = Callsigns[index % Callsigns.Length],
        });
    }

    public void ResetMatch()
    {
        PlayerKills = 0; PlayerDeaths = 0;
        foreach (var b in bots) { b.kills = 0; b.deaths = 0; }
    }

    // ------------------------------------------------------------ feed ----

    public static void FeedKill(Health victim, Health killer, bool headshot = false)
    {
        if (Instance == null) return;
        bool victimPlayer = victim && victim.isPlayer;
        bool killerPlayer = killer && killer.isPlayer;
        var victimBot = victim ? victim.GetComponentInParent<BotAI>() : null;
        var killerBot = killer ? killer.GetComponentInParent<BotAI>() : null;

        if (victimPlayer) Instance.PlayerDeaths++;
        if (killerPlayer) Instance.PlayerKills++;

        foreach (var e in Instance.bots)
        {
            if (!e.ai) continue;
            if (killerBot == e.ai) e.kills++;
            if (victimBot == e.ai) e.deaths++;
        }

        // killfeed entry — suicide/no-attacker rows read as environment kills
        feed.Add(new FeedEntry
        {
            killer = killer ? NameOf(killer) : "",
            victim = victim ? NameOf(victim) : "?",
            killerPlayer = killerPlayer,
            victimPlayer = victimPlayer,
            headshot = headshot,
            born = Time.unscaledTime,
        });
        if (feed.Count > 6) feed.RemoveAt(0);

        if (Instance.PlayerKills >= Instance.killGoal) { lastWinner = "YOU"; ArenaDirector.EndMatch(true); }
        else if (Instance.bots.Exists(b => b.kills >= Instance.killGoal))
        {
            lastWinner = Instance.bots.Find(b => b.kills >= Instance.killGoal).name;
            ArenaDirector.EndMatch(false);
        }
    }

    /// <summary>Bot targeting lottery: sometimes hunt the player, otherwise the nearest bot.</summary>
    public static Transform PickTargetFor(BotAI self, Transform player)
    {
        if (Instance == null || !Active) return player;
        if (Random.value < Instance.biasToPlayer && player) return player;

        float bestD = float.MaxValue;
        Transform pick = player;    // fallback
        foreach (var e in Instance.bots)
        {
            if (e.ai == null || e.ai == self || e.ai.GetComponent<Health>() == null || e.ai.GetComponent<Health>().IsDead) continue;
            float d = Vector3.SqrMagnitude(e.ai.transform.position - self.transform.position);
            if (d < bestD) { bestD = d; pick = e.ai.transform; }
        }
        return pick;
    }

    // ------------------------------------------------------------ killfeed ----

    public struct FeedEntry
    {
        public string killer, victim;
        public bool killerPlayer, victimPlayer, headshot;
        public float born;
    }

    static readonly List<FeedEntry> feed = new List<FeedEntry>();

    /// <summary>Kill events for the HUD killfeed banner. Snapshot, caller-owned.</summary>
    public static List<FeedEntry> Feed()
    {
        PruneFeed();
        return new List<FeedEntry>(feed);
    }

    static void PruneFeed()
    {
        float now = Time.unscaledTime;
        feed.RemoveAll(f => now - f.born > 5.5f);
    }

    /// <summary>Name for the HUD: callsign for bots, YOU for the player.</summary>
    public static string NameOf(Health h)
    {
        if (!h) return "?";
        if (h.isPlayer) return "YOU";
        var bot = h.GetComponentInParent<BotAI>();
        if (bot && Instance)
        {
            var e = Instance.bots.Find(x => x.ai == bot);
            if (e != null) return e.name;
        }
        return "OP-" + Mathf.Abs(h.GetHashCode() % 90 + 10);
    }

    /// <summary>Callsign of whoever hit the kill goal (for the match-over screen).</summary>
    public static string LastWinner => lastWinner;
    static string lastWinner;

    // ------------------------------------------------------------ board ----

    public struct Row { public string name; public int kills, deaths; public bool you; }

    /// <summary>Live scoreboard, sorted by kills.</summary>
    public List<Row> Board()
    {
        var rows = new List<Row> { new Row { name = "YOU", kills = PlayerKills, deaths = PlayerDeaths, you = true } };
        foreach (var b in bots)
            if (b.ai) rows.Add(new Row { name = b.name, kills = b.kills, deaths = b.deaths });
        rows.Sort((a, b) => b.kills.CompareTo(a.kills));
        return rows;
    }
}
