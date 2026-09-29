using UnityEngine;
using UnityEngine.AI;
using Unity.AI.Navigation;

/// <summary>
/// TERMINUS — a cyan-on-black brutalist terminus arena (Lockout blood, ECHO skin).
/// One-story ground game on a gloss-black floor scored with a glowing grid,
/// a central plateau for the hill, twin sniper towers (y=3) joined by a north
/// skybridge (y=2), a glowing shotgun pit and 1 m jump crates. Every level is
/// ramp- or jump-connected. Palette: structure #0d1117, tops snow-white,
/// trim emission #00f3ff. Movement budget: jump apex 1.18 m → steps 1.0 m.
/// </summary>
public class Lockout : MonoBehaviour
{
    static readonly Color Structure = new Color(0.05f, 0.07f, 0.09f);   // near-black blue
    static readonly Color Top = new Color(0.82f, 0.86f, 0.9f);          // snow
    static readonly Color PanelDk = new Color(0.1f, 0.12f, 0.15f);
    static readonly Color Trim = new Color(0f, 0.95f, 1f);              // #00f3ff

    public static Vector3 HillSpot = new Vector3(0f, 1.02f, 4f);    // plateau centre
    public static Vector3 PlayerSpot = new Vector3(0f, 1.4f, 11f);  // plateau south edge

    static Material matStruct, matTop, matPanel, matTrim, matFloor;

    static Transform rootT;

    public static void Build(Transform parent)
    {
        EnsureMats();
        if (!parent) parent = new GameObject("LockoutMap").transform;
        rootT = parent;

        Dress();
        Floor();
        Plateau();
        TwinTowers();
        Skybridge();
        Pit();
        Bunker();
        Crates();
        Perimeter();
        Lights();
    }

    static void EnsureMats()
    {
        if (!matStruct) matStruct = RuntimeAssets.LitMaterial(Structure, 0.15f);
        if (!matTop) matTop = RuntimeAssets.LitMaterial(Top, 0.25f);
        if (!matPanel) matPanel = RuntimeAssets.LitMaterial(PanelDk, 0.35f);
        if (!matTrim) matTrim = RuntimeAssets.LitMaterial(Trim * 1.5f, 1.7f);
        if (!matFloor) matFloor = RuntimeAssets.LitMaterial(new Color(0.03f, 0.045f, 0.06f), 0.9f);
    }

    static GameObject Box(Vector3 c, Vector3 s, Material m)
    {
        var b = GameObject.CreatePrimitive(PrimitiveType.Cube);
        b.transform.position = c;
        b.transform.localScale = s;
        b.GetComponent<Renderer>().sharedMaterial = m;
        b.isStatic = true;
        if (rootT) b.transform.SetParent(rootT, true);
        return b;
    }

    /// <summary>Walkable ramp slab from a to b (width w). Rise ≤ 1 m per ~5 m run.</summary>
    static GameObject Ramp(Vector3 a, Vector3 b, float w)
    {
        var r = GameObject.CreatePrimitive(PrimitiveType.Cube);
        Vector3 mid = (a + b) * 0.5f;
        Vector3 dir = b - a;
        float len = dir.magnitude;
        r.transform.rotation = Quaternion.LookRotation(dir.normalized, Vector3.up) * Quaternion.Euler(90f, 0f, 0f);
        r.transform.position = mid;
        r.transform.localScale = new Vector3(w, 0.35f, len);
        r.GetComponent<Renderer>().sharedMaterial = matStruct;
        r.isStatic = true;
        if (rootT) r.transform.SetParent(rootT, true);
        return r;
    }

    /// <summary>Keep fog on; atmosphere values are owned by ArenaDirector.DressScene
    /// (the old void-black ambient here buried the waifus — that's gone).</summary>
    static void Dress()
    {
        RenderSettings.fog = true;
    }

    /// <summary>Gloss-black floor scored with a glowing cyan grid.</summary>
    static void Floor()
    {
        Box(new Vector3(0f, -0.25f, 4f), new Vector3(68f, 0.5f, 50f), matFloor);          // ground, top y=0
        for (int i = -3; i <= 3; i++)                                                     // N-S grid strips
            Box(new Vector3(i * 9f, 0.015f, 4f), new Vector3(0.09f, 0.03f, 50f), matTrim);
        for (int i = -2; i <= 2; i++)                                                     // E-W grid strips
            Box(new Vector3(0f, 0.015f, 4f + i * 9f), new Vector3(68f, 0.03f, 0.09f), matTrim);
    }

    /// <summary>Central plateau — the hill fight. White top, glowing rim, four ways up.</summary>
    static void Plateau()
    {
        Box(new Vector3(0f, 0.5f, 4f), new Vector3(30f, 1f, 18f), matStruct);             // deck, top y=1
        Box(new Vector3(0f, 1.04f, 4f), new Vector3(28f, 0.08f, 16f), matTop);            // white top inlay
        Box(new Vector3(0f, 1.07f, -5.1f), new Vector3(30f, 0.14f, 0.4f), matTrim);       // glowing rim N
        Box(new Vector3(0f, 1.07f, 13.1f), new Vector3(30f, 0.14f, 0.4f), matTrim);       // rim S
        Box(new Vector3(-15.1f, 1.07f, 4f), new Vector3(0.4f, 0.14f, 18f), matTrim);      // rim W
        Box(new Vector3(15.1f, 1.07f, 4f), new Vector3(0.4f, 0.14f, 18f), matTrim);       // rim E
        Ramp(new Vector3(-20f, 0f, 4f), new Vector3(-15.5f, 1f, 4f), 3f);                 // W ground ramp
        Ramp(new Vector3(20f, 0f, 4f), new Vector3(15.5f, 1f, 4f), 3f);                   // E ground ramp
        Ramp(new Vector3(0f, 0f, 17.5f), new Vector3(0f, 1f, 13.5f), 3f);                 // S ramp from player side
    }

    /// <summary>Twin sniper towers NW/NE, deck top y=3, each with a switchback climb.</summary>
    static void TwinTowers()
    {
        for (int side = -1; side <= 1; side += 2)
        {
            float x = 17f * side;
            Box(new Vector3(x, 1.5f, -14f), new Vector3(2.6f, 3f, 2.6f), matStruct);      // pillar
            Box(new Vector3(x, 2.5f, -14f), new Vector3(8f, 1f, 7f), matStruct);          // deck, top y=3
            Box(new Vector3(x, 3.05f, -14f), new Vector3(6.4f, 0.1f, 5.4f), matTop);      // snow inlay
            Box(new Vector3(x - 3.7f * side, 3.5f, -14f), new Vector3(0.6f, 1f, 7f), matStruct); // inner rail
            Box(new Vector3(x, 3.5f, -17.35f), new Vector3(8f, 1f, 0.7f), matStruct);     // back rail
            Box(new Vector3(x, 4.06f, -17.35f), new Vector3(8f, 0.12f, 0.76f), matTrim);  // glowing rail cap
            Box(new Vector3(x - 3.7f * side, 4.06f, -14f), new Vector3(0.66f, 0.12f, 7f), matTrim);

            // climb: plateau (1) → landing (2) → tower (3)
            Box(new Vector3(x + 4.5f * side, 1.5f, -9.5f), new Vector3(2.6f, 2f, 2.6f), matPanel); // landing top 2
            Ramp(new Vector3(x + 2f * side, 1f, -6.5f), new Vector3(x + 4.2f * side, 2f, -8.8f), 2.2f);
            Ramp(new Vector3(x + 4.9f * side, 2f, -10.4f), new Vector3(x + 1.6f * side, 3f, -13.2f), 2.2f);
            Box(new Vector3(x + 4.5f * side, 2.56f, -9.5f), new Vector3(2.7f, 0.12f, 2.7f), matTrim); // landing glow ring
        }
    }

    /// <summary>North skybridge y=2 joining both towers — rockets live out here.</summary>
    static void Skybridge()
    {
        Box(new Vector3(0f, 1.6f, -19f), new Vector3(27f, 0.8f, 2.6f), matStruct);        // walk, top y=2
        Box(new Vector3(0f, 2.04f, -19f), new Vector3(25f, 0.08f, 2f), matTop);
        Box(new Vector3(0f, 2.5f, -20.2f), new Vector3(27f, 1f, 0.35f), matStruct);       // rail
        Box(new Vector3(0f, 3.02f, -20.2f), new Vector3(27f, 0.1f, 0.4f), matTrim);
        Box(new Vector3(-8f, 0.8f, -19f), new Vector3(1f, 1.6f, 1f), matStruct);          // pylons
        Box(new Vector3(8f, 0.8f, -19f), new Vector3(1f, 1.6f, 1f), matStruct);
        // jump-up from the ground: crate 1 → ledge 2 at the west end
        Box(new Vector3(-16.5f, 0.5f, -19f), new Vector3(1.5f, 1f, 1.5f), matPanel);
        Box(new Vector3(-13.9f, 1f, -19f), new Vector3(1.4f, 2f, 2.2f), matStruct);       // ledge, top 2
    }

    /// <summary>SW shotgun pit: glowing rim, sunk floor, jump-out is 0.8 m.</summary>
    static void Pit()
    {
        Box(new Vector3(-15f, -1.1f, 20f), new Vector3(24f, 0.6f, 9f), matFloor);         // floor top −0.8
        Box(new Vector3(-15f, 0.1f, 15.55f), new Vector3(25f, 1.8f, 0.6f), matStruct);    // walls (top 1)
        Box(new Vector3(-15f, 0.1f, 24.45f), new Vector3(25f, 1.8f, 0.6f), matStruct);
        Box(new Vector3(-27.3f, 0.1f, 20f), new Vector3(0.6f, 1.8f, 9f), matStruct);
        Box(new Vector3(-2.7f, 0.1f, 20f), new Vector3(0.6f, 1.8f, 9f), matStruct);
        Box(new Vector3(-15f, 1.04f, 15.55f), new Vector3(25f, 0.1f, 0.66f), matTrim);    // glowing rims
        Box(new Vector3(-15f, 1.04f, 24.45f), new Vector3(25f, 0.1f, 0.66f), matTrim);
        Box(new Vector3(-8f, -0.3f, 20f), new Vector3(1.4f, 1f, 1.4f), matPanel);         // crates in-pit
        Box(new Vector3(-22f, -0.3f, 21f), new Vector3(1.4f, 1f, 1.4f), matPanel);
    }

    /// <summary>SE bunker: solid block, roof y=2 with the overshield.</summary>
    static void Bunker()
    {
        Box(new Vector3(20f, 1f, 19f), new Vector3(9f, 2f, 7f), matStruct);               // top y=2
        Box(new Vector3(20f, 2.04f, 19f), new Vector3(7.6f, 0.08f, 5.6f), matTop);
        Box(new Vector3(20f, 2.5f, 22.4f), new Vector3(9f, 1f, 0.3f), matStruct);
        Box(new Vector3(24.4f, 2.5f, 19f), new Vector3(0.3f, 1f, 7f), matStruct);
        Box(new Vector3(20f, 3.02f, 22.4f), new Vector3(9f, 0.1f, 0.36f), matTrim);
        Box(new Vector3(24.4f, 3.02f, 19f), new Vector3(0.36f, 0.1f, 7f), matTrim);
        Box(new Vector3(15.4f, 1f, 19f), new Vector3(0.25f, 1.7f, 2.6f), matTrim);        // glowing door face
        Box(new Vector3(12f, 0.5f, 19f), new Vector3(1.5f, 1f, 1.5f), matPanel);          // jump crate to roof
    }

    /// <summary>Jump crates — every one exactly 1 m, cyan-capped so they read as steps.</summary>
    static void Crates()
    {
        Vector3[] spots =
        {
            new Vector3(-6f, 0.5f, -8f), new Vector3(6f, 0.5f, -8f),      // plateau N pair (bridge access feel)
            new Vector3(-25f, 0.5f, 8f), new Vector3(25f, 0.5f, 8f),      // flanks
            new Vector3(-6f, 1.5f, 8f), new Vector3(6f, 1.5f, 8f),        // plateau cover
            new Vector3(-24f, 0.5f, -6f), new Vector3(24f, 0.5f, -2f),    // tower-side
            new Vector3(0f, 0.5f, 22f),                                    // S ground centre
            new Vector3(28f, 0.5f, -14f),                                  // NE tower ground
        };
        foreach (var s in spots)
        {
            Box(s, new Vector3(1.4f, 1f, 1.4f), matPanel);
            Box(s + new Vector3(0f, 0.52f, 0f), new Vector3(1.46f, 0.06f, 1.46f), matTrim); // glowing cap edge
        }
    }

    /// <summary>Perimeter: dark rails with a glowing top line — the void stays out.</summary>
    static void Perimeter()
    {
        Box(new Vector3(0f, 0.5f, -22f), new Vector3(70f, 1f, 0.6f), matStruct);
        Box(new Vector3(0f, 0.5f, 30f), new Vector3(70f, 1f, 0.6f), matStruct);
        Box(new Vector3(-35f, 0.5f, 4f), new Vector3(0.6f, 1f, 53f), matStruct);
        Box(new Vector3(35f, 0.5f, 4f), new Vector3(0.6f, 1f, 53f), matStruct);
        Box(new Vector3(0f, 1.05f, -22f), new Vector3(70f, 0.1f, 0.66f), matTrim);
        Box(new Vector3(0f, 1.05f, 30f), new Vector3(70f, 0.1f, 0.66f), matTrim);
        Box(new Vector3(-35f, 1.05f, 4f), new Vector3(0.66f, 0.1f, 53f), matTrim);
        Box(new Vector3(35f, 1.05f, 4f), new Vector3(0.66f, 0.1f, 53f), matTrim);
    }

    /// <summary>Four cyan point lights — one per quadrant — plus corner monoliths.</summary>
    static void Lights()
    {
        Vector3[] quads = { new Vector3(-17f, 6f, -6f), new Vector3(17f, 6f, -6f), new Vector3(-17f, 6f, 16f), new Vector3(17f, 6f, 16f) };
        foreach (var q in quads)
        {
            var lgo = new GameObject("TerminusLight");
            lgo.transform.position = q;
            var l = lgo.AddComponent<Light>();
            l.type = LightType.Point;
            l.color = new Color(0.3f, 0.85f, 1f);
            l.range = 30f;
            l.intensity = 0.9f;
            if (rootT) lgo.transform.SetParent(rootT, true);
        }
        Vector3[] corners = { new Vector3(-31f, 3f, -18f), new Vector3(31f, 3f, -18f), new Vector3(-31f, 3f, 26f), new Vector3(31f, 3f, 26f) };
        foreach (var c in corners)
        {
            Box(c, new Vector3(1.2f, 6f, 1.2f), matStruct);
            Box(c + new Vector3(0f, 3.3f, 0f), new Vector3(0.8f, 0.7f, 0.8f), matTrim);
        }
    }

    // -------------------------------------------------------------- seats --

    static readonly Vector3[] Seats =
    {
        new Vector3(-20f, 0.2f, -18f), new Vector3(20f, 0.2f, -18f),
        new Vector3(-28f, 0.2f, 10f),  new Vector3(28f, 0.2f, 10f),
        new Vector3(-10f, 0.2f, 18f),  new Vector3(10f, 0.2f, 18f),
        new Vector3(0f, 0.2f, -20f),
    };

    static int seatCursor;

    /// <summary>Next spawn seat, cycled — always inside the walls, never stranded.</summary>
    public static Vector3 SpawnSeat() => Seats[seatCursor++ % Seats.Length];

    /// <summary>Re-seat all bots on the grid (warp keeps NavMeshAgents happy later).</summary>
    public static void SeatBots()
    {
        int i = 0;
        foreach (var b in Object.FindObjectsByType<BotAI>(FindObjectsSortMode.None))
        {
            if (!b) continue;
            Vector3 p = Seats[i++ % Seats.Length];
            var a = b.GetComponent<NavMeshAgent>();
            if (a && a.isOnNavMesh) a.Warp(p);
            else b.transform.position = p;
            var hp = b.GetComponent<Health>();
            if (hp && hp.IsDead) hp.Revive(p);
        }
    }

    /// <summary>Bake a navmesh over the whole arena once its colliders exist.</summary>
    public static System.Collections.IEnumerator BakeNav(GameObject root)
    {
        yield return null;
        var s = root.AddComponent<NavMeshSurface>();
        s.collectObjects = CollectObjects.All;
        s.useGeometry = NavMeshCollectGeometry.PhysicsColliders;
        s.BuildNavMesh();
        Debug.Log("[TERMINUS] navmesh baked");
        int fixedAgents = 0;
        foreach (var b in Object.FindObjectsByType<BotAI>(FindObjectsSortMode.None))
        {
            var a = b ? b.GetComponent<NavMeshAgent>() : null;
            if (a && !a.isOnNavMesh && NavMesh.SamplePosition(b.transform.position, out var nh, 8f, NavMesh.AllAreas))
            {
                a.Warp(nh.position);
                fixedAgents++;
            }
        }
        if (fixedAgents > 0) Debug.Log("[TERMINUS] re-gripped " + fixedAgents + " agents");
    }
}
