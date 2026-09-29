using System.Text;
using UnityEngine;
using UnityEngine.AI;

/// <summary>
/// One compact boot summary in the player log — which is the browser console in WebGL.
/// Every asset here fails *silently* into a placeholder (primitive girl, cube gun,
/// flat ground) if it is missing, so this line is the cheapest way to tell whether
/// the GLB models, the baked navmesh and the bots actually came up.
/// </summary>
public class BootReport : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (FindFirstObjectByType<BootReport>()) return;
        new GameObject("BootReport").AddComponent<BootReport>();
    }

    void Start()
    {
        // ArenaDirector builds the world in Awake; give the navmesh agents a beat to attach.
        Invoke(nameof(Report), 1.5f);
    }

    void Report()
    {
        var sb = new StringBuilder("WAIFU ARENA boot: ");

        var map = GameObject.Find("LockoutMap");
        if (!map) map = GameObject.Find("HavenMap");
        if (!map) map = GameObject.Find("InvasionMap");
        sb.Append(map ? (map.name == "LockoutMap" ? "map=LOCKOUT(" : "map=GLB(") + map.GetComponentsInChildren<MeshFilter>(true).Length + " pieces)" : "map=none");
        sb.Append(" ground=").Append(GameObject.Find("FallbackGround") ? "yes" : "no");

        var player = ArenaDirector.Player;
        if (player)
        {
            var body = player.GetComponent<WaifuBody>();
            string vis = body && body.visual ? body.visual.name : "none";
            sb.Append(" avatar=").Append(vis.StartsWith("WaifuVisual") ? "GLB" : vis.StartsWith("WaifuFallback") ? "PRIMITIVE" : vis);
        }
        else sb.Append(" avatar=NO PLAYER");

        var load = player ? player.GetComponentInChildren<WeaponLoadout>(true) : null;
        if (load && load.weapons != null && load.weapons.Length > 0)
        {
            sb.Append(" guns=");
            for (int i = 0; i < load.weapons.Length; i++)
            {
                var w = load.weapons[i];
                if (i > 0) sb.Append('/');
                if (!w) { sb.Append("null"); continue; }
                bool glb = w.transform.Find("WeaponVisual") != null;
                sb.Append(w.weaponName).Append(glb ? ":GLB" : ":cube");
            }
        }
        else sb.Append(" guns=none");

        // Navmesh is the single biggest silent failure: without it no bot ever moves.
        int bots = 0, onMesh = 0, offMesh = 0;
        var found = FindObjectsByType<BotAI>(FindObjectsSortMode.None);
        foreach (var b in found)
        {
            if (!b) continue;
            bots++;
            var agent = b.GetComponent<NavMeshAgent>();
            if (agent && agent.isOnNavMesh) onMesh++; else offMesh++;
        }
        sb.Append(" bots=").Append(bots).Append("(nav:").Append(onMesh).Append(" off:").Append(offMesh).Append(')');

        if (player && NavMesh.SamplePosition(player.position, out NavMeshHit hit, 4f, NavMesh.AllAreas))
            sb.Append(" navmesh=OK(").Append(hit.position.y.ToString("0.0")).Append(')');
        else sb.Append(" navmesh=MISSING");

        sb.Append(" hill=").Append(KingOfTheHill.Instance ? "yes" : "no");
        sb.Append(" kira=").Append(Resources.Load<Texture2D>("kira7") ? "yes" : "no");

        Debug.Log(sb.ToString());
    }
}
