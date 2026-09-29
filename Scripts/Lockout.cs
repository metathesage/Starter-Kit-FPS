using UnityEngine;
using UnityEngine.AI;
using Unity.AI.Navigation;
using System.Collections.Generic;

/// <summary>
/// LOCKOUT-style arena (Halo 2 homage) built from primitives:
/// one-story main plateau at ground level, sniper tower with a switchback
/// ramp, a north catwalk, an east bunker roof, a sunk shotgun pit and 1 m
/// jump-up ledges. Every level connects by ramp or jump — nobody gets
/// stranded. Movement budget: jump apex 1.18 m → ledges/crates/rails 1.0 m.
/// </summary>
public class Lockout : MonoBehaviour
{
    // winter terminus palette
    static readonly Color Structure = new Color(0.13f, 0.16f, 0.22f);
    static readonly Color Panel = new Color(0.62f, 0.66f, 0.74f);
    static readonly Color Snow = new Color(0.85f, 0.88f, 0.92f);
    static readonly Color Trim = new Color(0f, 0.55f, 0.6f);

    public static Vector3 HillSpot = new Vector3(0f, 1.02f, 2f);   // plateau centre
    public static Vector3 PlayerSpot = new Vector3(0f, 1.4f, 26f); // south spawn, faces the arena

    static Material matStruct, matPanel, matSnow, matTrim;

    public static void Build(Transform parent)
    {
        EnsureMats();
        if (!parent) parent = new GameObject("LockoutMap").transform;

        GroundPlateau();
        SniperTower();
        NorthCatwalk();
        EastBunker();
        ShotgunPit();
        ScatterCrates();
        Perimeter();
        Pylons();
    }

    static void EnsureMats()
    {
        if (!matStruct) matStruct = RuntimeAssets.LitMaterial(Structure, 0.25f);
        if (!matPanel) matPanel = RuntimeAssets.LitMaterial(Panel, 0.5f);
        if (!matSnow) matSnow = RuntimeAssets.LitMaterial(Snow, 0.35f);
        if (!matTrim) matTrim = RuntimeAssets.LitMaterial(Trim * 1.4f, 1.5f);
    }

    static GameObject Box(Vector3 c, Vector3 s, Material m)
    {
        var b = GameObject.CreatePrimitive(PrimitiveType.Cube);
        b.transform.position = c;
        b.transform.localScale = s;
        b.GetComponent<Renderer>().sharedMaterial = m;
        b.isStatic = true;
        return b;
    }

    /// <summary>Walkable ramp slab from a to b (width w). Rise ≤ 1 m per ~5 m run.</summary>
    static GameObject Ramp(Vector3 a, Vector3 b, float w)
    {
        var r = GameObject.CreatePrimitive(PrimitiveType.Cube);
        Vector3 mid = (a + b) * 0.5f;
        Vector3 dir = b - a;
        float len = dir.magnitude;
        r.transform.position = mid - dir.normalized * 0f;
        r.transform.rotation = Quaternion.LookRotation(dir.normalized, Vector3.up) * Quaternion.Euler(90f, 0f, 0f);
        r.transform.position = mid;
        r.transform.localScale = new Vector3(w, 0.35f, len);
        r.GetComponent<Renderer>().sharedMaterial = matStruct;
        r.isStatic = true;
        return r;
    }

    // ------------------------------------------------------------- pieces --

    /// <summary>The one-story main plateau — the whole ground game happens here.</summary>
    static void GroundPlateau()
    {
        Box(new Vector3(0f, 0.5f, 2f), new Vector3(46f, 1f, 22f), matStruct);          // deck, top y=1
        Box(new Vector3(0f, 1.04f, 2f), new Vector3(46f, 0.08f, 2.2f), matSnow);       // centre plank
        Box(new Vector3(0f, 1.06f, -8.8f), new Vector3(46f, 0.12f, 0.5f), matTrim);    // cyan trim N
        Box(new Vector3(0f, 1.06f, 12.8f), new Vector3(46f, 0.12f, 0.5f), matTrim);    // cyan trim S
        // ramp up from the west ground onto the deck (gentle 1:5)
        Ramp(new Vector3(-30f, 0f, 2f), new Vector3(-23f, 1f, 2f), 3f);
        Ramp(new Vector3(30f, 0f, 2f), new Vector3(23f, 1f, 2f), 3f);                  // mirrored east
    }

    /// <summary>NE sniper tower: deck top y=3, switchback ramp + two landings.</summary>
    static void SniperTower()
    {
        Box(new Vector3(15f, 1.5f, -13f), new Vector3(2.5f, 3f, 2.5f), matStruct);     // pillar
        Box(new Vector3(15f, 2.5f, -13f), new Vector3(8f, 1f, 8f), matStruct);         // deck top y=3
        Box(new Vector3(15f, 3.06f, -13f), new Vector3(6f, 0.12f, 6f), matSnow);       // snow top inlay
        Box(new Vector3(11.65f, 3.5f, -13f), new Vector3(0.7f, 1f, 8f), matStruct);    // west rail
        Box(new Vector3(15f, 3.5f, -16.65f), new Vector3(8f, 1f, 0.7f), matStruct);    // north rail
        Box(new Vector3(11.65f, 4.04f, -13f), new Vector3(0.76f, 0.1f, 8f), matTrim);
        Box(new Vector3(15f, 4.04f, -16.65f), new Vector3(8f, 0.1f, 0.76f), matTrim);

        // switchback: ground → crate A (top 1) → landing B (top 2) → tower (top 3)
        Box(new Vector3(9.5f, 0.5f, -8.5f), new Vector3(2.2f, 1f, 2.2f), matPanel);    // crate A
        Box(new Vector3(11.5f, 1f, -11f), new Vector3(2.6f, 2f, 2.6f), matStruct);     // landing B
        Ramp(new Vector3(5f, 0f, -7.2f), new Vector3(9f, 1f, -8.2f), 2.4f);            // ground → A
        Ramp(new Vector3(9.8f, 1f, -8.8f), new Vector3(11.3f, 2f, -10.6f), 2.2f);      // A → B
        Ramp(new Vector3(12.2f, 2f, -11.6f), new Vector3(13.8f, 3f, -12.9f), 2.2f);    // B → tower
    }

    /// <summary>North catwalk, top y=2: ledge jump-up then hop across.</summary>
    static void NorthCatwalk()
    {
        Box(new Vector3(-12f, 1.6f, -16f), new Vector3(20f, 0.8f, 3f), matStruct);     // walk, top y=2
        Box(new Vector3(-12f, 2.05f, -16f), new Vector3(18f, 0.1f, 2.2f), matSnow);
        Box(new Vector3(-12f, 2.5f, -17.35f), new Vector3(20f, 1f, 0.4f), matStruct);  // rail
        Box(new Vector3(-12f, 3.04f, -17.35f), new Vector3(20f, 0.1f, 0.46f), matTrim);
        Box(new Vector3(-20f, 0.8f, -16f), new Vector3(1.2f, 1.6f, 1.2f), matStruct);  // pillars
        Box(new Vector3(-4f, 0.8f, -16f), new Vector3(1.2f, 1.6f, 1.2f), matStruct);
        Box(new Vector3(-19f, 0.5f, -11f), new Vector3(2.5f, 1f, 2.5f), matPanel);     // ledge: ground→1, hop→2
    }

    /// <summary>East bunker: solid block, roof top y=2 reachable from the plateau.</summary>
    static void EastBunker()
    {
        Box(new Vector3(27f, 1f, 6f), new Vector3(8f, 2f, 6f), matStruct);             // block, top y=2
        Box(new Vector3(27f, 2.05f, 6f), new Vector3(7f, 0.1f, 5f), matPanel);
        Box(new Vector3(27f, 2.5f, 9.15f), new Vector3(8f, 1f, 0.3f), matStruct);      // roof rails
        Box(new Vector3(31.15f, 2.5f, 6f), new Vector3(0.3f, 1f, 6f), matStruct);
        Box(new Vector3(27f, 3.04f, 9.15f), new Vector3(8f, 0.1f, 0.36f), matTrim);
        Box(new Vector3(31.15f, 3.04f, 6f), new Vector3(0.36f, 0.1f, 6f), matTrim);
        Box(new Vector3(22.9f, 1f, 6f), new Vector3(0.2f, 1.6f, 2.4f), matTrim);       // glowing door face
    }

    /// <summary>South shotgun pit: sunk floor −0.8, walls up to +1. Jump out is 0.8 m. </summary>
    static void ShotgunPit()
    {
        Box(new Vector3(0f, -1.1f, 19.5f), new Vector3(26f, 0.6f, 10f), matSnow);      // floor top −0.8
        Box(new Vector3(0f, 0.1f, 14.55f), new Vector3(27f, 1.8f, 0.7f), matStruct);   // north wall (top 1)
        Box(new Vector3(0f, 0.1f, 24.45f), new Vector3(27f, 1.8f, 0.7f), matStruct);   // south wall
        Box(new Vector3(-13.3f, 0.1f, 19.5f), new Vector3(0.7f, 1.8f, 10f), matStruct);// west wall
        Box(new Vector3(13.3f, 0.1f, 19.5f), new Vector3(0.7f, 1.8f, 10f), matStruct); // east wall
        Box(new Vector3(-6f, -0.3f, 20f), new Vector3(1.4f, 1f, 1.4f), matPanel);      // crates inside
        Box(new Vector3(6f, -0.3f, 19f), new Vector3(1.4f, 1f, 1.4f), matPanel);
        Box(new Vector3(0f, 1.04f, 14.55f), new Vector3(27f, 0.1f, 0.76f), matTrim);   // trim on N wall
    }

    /// <summary>Jump crates: cover + mobility steps, every one exactly 1 m tall.</summary>
    static void ScatterCrates()
    {
        Vector3[] spots =
        {
            new Vector3(-8f, 0.5f, -14f), new Vector3(8f, 0.5f, -14f),      // north ground pair
            new Vector3(-27f, 0.5f, 8f), new Vector3(27f, 0.5f, -8f),       // flanks
            new Vector3(-3f, 1.5f, 8f), new Vector3(3f, 1.5f, 8f),          // plateau cover (sit on deck)
            new Vector3(20f, 0.5f, -6f), new Vector3(-16f, 1.5f, 8f),       // tower-side + plateau W
        };
        foreach (var s in spots) Box(s, new Vector3(1.4f, 1f, 1.4f), matPanel);
    }

    /// <summary>Perimeter walls, 1 m — out of bounds is a hop, not a mystery.</summary>
    static void Perimeter()
    {
        Box(new Vector3(0f, 0.5f, -21f), new Vector3(70f, 1f, 0.6f), matStruct);
        Box(new Vector3(0f, 0.5f, 29f), new Vector3(70f, 1f, 0.6f), matStruct);
        Box(new Vector3(-34f, 0.5f, 4f), new Vector3(0.6f, 1f, 51f), matStruct);
        Box(new Vector3(34f, 0.5f, 4f), new Vector3(0.6f, 1f, 51f), matStruct);
        Box(new Vector3(0f, 1.04f, -21f), new Vector3(70f, 0.1f, 0.66f), matTrim);
        Box(new Vector3(0f, 1.04f, 29f), new Vector3(70f, 0.1f, 0.66f), matTrim);
        Box(new Vector3(-34f, 1.04f, 4f), new Vector3(0.66f, 0.1f, 51f), matTrim);
        Box(new Vector3(34f, 1.04f, 4f), new Vector3(0.66f, 0.1f, 51f), matTrim);
    }

    /// <summary>Corner pylons with cyan caps — the terminal monolith look.</summary>
    static void Pylons()
    {
        Vector3[] corners = { new Vector3(-31f, 3f, -19f), new Vector3(31f, 3f, -19f), new Vector3(-31f, 3f, 27f), new Vector3(31f, 3f, 27f) };
        foreach (var c in corners)
        {
            Box(c, new Vector3(1.2f, 6f, 1.2f), matStruct);
            Box(c + new Vector3(0f, 3.3f, 0f), new Vector3(0.8f, 0.6f, 0.8f), matTrim);
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

    /// <summary>Re-seat all bots on the Lockout grid (warp keeps NavMeshAgents happy later).</summary>
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
        Debug.Log("[LOCKOUT] navmesh baked");
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
        if (fixedAgents > 0) Debug.Log("[LOCKOUT] re-gripped " + fixedAgents + " agents");
    }
}
