using UnityEngine;

/// <summary>
/// Visual for player/bots. Prefers imported GLB (Lucy / Citlali / Angle).
/// Falls back to a readable low-poly girl so nobody is a naked capsule.
/// Unrigged meshes get a walk-bob until a Mixamo/UAL humanoid is dropped in.
/// </summary>
public class WaifuBody : MonoBehaviour
{
    public enum Outfit { Lucy, Citlali, Angle, Fallback }

    [Header("First person")]
    public bool showPlayerBody;   // off: your GLB is hidden so the camera never clips it

    public Transform visual;
    public bool isPlayer;
    public int variant;
    CharacterController cc;
    UnityEngine.AI.NavMeshAgent agent;
    float bob;
    float baseY;

    struct NavMeshAgentMaybe
    {
        public UnityEngine.AI.NavMeshAgent a;
        public bool ok;
    }

    public static WaifuBody Attach(GameObject host, bool player, int variant)
    {
        var w = host.GetComponent<WaifuBody>();
        if (!w) w = host.AddComponent<WaifuBody>();
        w.isPlayer = player;
        w.variant = variant;
        w.Build();
        return w;
    }

    public void Build()
    {
        cc = GetComponent<CharacterController>();
        agent = GetComponent<UnityEngine.AI.NavMeshAgent>();
        foreach (var r in GetComponents<Renderer>()) r.enabled = false;

        if (visual) Destroy(visual.gameObject);

        // the full waifu roster — every rigged GLB the pack ships, hero rigs first
        string[] keys =
        {
            "Characters/scifi_waifu_soldier", "Characters/mai_maid_-bourin", "Characters/mai_maid",
            "Characters/miyazawa", "Characters/lucy_edgerunner", "Characters/bunny_girl_dark",
            "Characters/waifu_noir", "Characters/angel", "Characters/kasumi_tactical_sailor_aaa_100k",
            "Characters/ghost", "Characters/reaper", "Characters/wraith"
        };
        foreach (var key in keys)
        {
            var prefab = Resources.Load<GameObject>(key);
            if (!prefab) continue;
            var inst = Instantiate(prefab);
            inst.name = "WaifuVisual";
            inst.transform.SetParent(transform, false);
            StripColliders(inst);
            FitHeight(inst.transform, 1.72f);
            // bots get a team tint on their materials so allies read at a glance
            if (!isPlayer && Mathf.Abs(variant) > 0)
                TintAll(inst, new Color(1f, 0.75f, 0.8f));
            // first person: never render your own body — the camera lives inside it
            if (isPlayer && !showPlayerBody)
                foreach (var r in inst.GetComponentsInChildren<Renderer>())
                    r.enabled = false;
            visual = inst.transform;
            baseY = visual.localPosition.y;
            int rends = inst.GetComponentsInChildren<Renderer>().Length;
            Debug.Log("[BODY] " + (isPlayer ? "player" : "bot v" + variant) + " ← " + key + " (" + rends + " renderers" + (isPlayer && !showPlayerBody ? ", hidden for FPS" : "") + ")");
            return;
        }
        visual = BuildFallback(variant).transform;
        baseY = visual.localPosition.y;
    }

    /// <summary>Team tint that keeps texture detail; skips already-tinted shared mats.</summary>
    static readonly System.Collections.Generic.Dictionary<int, Material> TintCache = new System.Collections.Generic.Dictionary<int, Material>();
    void TintAll(GameObject go, Color c)
    {
        foreach (var r in go.GetComponentsInChildren<Renderer>())
        {
            if (!r.sharedMaterial) continue;
            int key = r.sharedMaterial.GetHashCode(); // GetInstanceID is error-obsolete in Unity 6000.6
            if (!TintCache.TryGetValue(key, out var m) || !m)
            {
                m = new Material(r.sharedMaterial);
                if (m.HasProperty("_BaseColor")) m.SetColor("_BaseColor", Color.Lerp(Color.white, c, 0.35f));
                if (m.HasProperty("_Color")) m.SetColor("_Color", Color.Lerp(Color.white, c, 0.35f));
                TintCache[key] = m;
            }
            r.sharedMaterial = m;
        }
    }

    void StripColliders(GameObject go)
    {
        foreach (var c in go.GetComponentsInChildren<Collider>(true))
        {
            if (Application.isPlaying) Destroy(c);
            else DestroyImmediate(c);
        }
        go.layer = gameObject.layer;
    }

    void FitHeight(Transform t, float target)
    {
        var rends = t.GetComponentsInChildren<Renderer>();
        if (rends.Length == 0) return;
        Bounds b = rends[0].bounds;
        foreach (var r in rends) b.Encapsulate(r.bounds);
        float h = Mathf.Max(0.2f, b.size.y);
        float s = target / h;
        t.localScale = Vector3.one * s;
        t.localPosition = new Vector3(0f, -b.min.y * s + (cc ? 0f : 0f), 0f);
        // recompute feet
        b = rends[0].bounds;
        foreach (var r in rends) b.Encapsulate(r.bounds);
        float feet = b.min.y - transform.position.y;
        t.localPosition += new Vector3(0f, -feet, 0f);
    }

    GameObject BuildFallback(int v)
    {
        var root = new GameObject("WaifuFallback");
        root.transform.SetParent(transform, false);
        Color skin = new Color(1f, 0.82f, 0.72f);
        Color[] hairs = {
            new Color(0.95f, 0.95f, 1f),
            new Color(0.15f, 0.12f, 0.2f),
            new Color(0.35f, 0.85f, 1f),
            new Color(1f, 0.35f, 0.55f),
            new Color(0.55f, 0.25f, 0.85f)
        };
        Color[] fits = {
            new Color(0.08f, 0.08f, 0.1f),
            new Color(0.12f, 0.35f, 0.55f),
            new Color(0.15f, 0.55f, 0.4f),
            new Color(0.45f, 0.1f, 0.22f)
        };
        Color hair = hairs[Mathf.Abs(v) % hairs.Length];
        Color fit = fits[Mathf.Abs(v) % fits.Length];
        Color accent = new Color(0.2f, 0.95f, 1f);

        Prim(root, PrimitiveType.Capsule, new Vector3(0, 0.95f, 0), new Vector3(0.34f, 0.42f, 0.22f), fit); // torso
        Prim(root, PrimitiveType.Sphere, new Vector3(0, 1.52f, 0.02f), Vector3.one * 0.28f, skin); // head
        Prim(root, PrimitiveType.Sphere, new Vector3(0, 1.58f, -0.04f), new Vector3(0.32f, 0.34f, 0.3f), hair); // hair
        Prim(root, PrimitiveType.Sphere, new Vector3(0, 1.46f, 0.12f), new Vector3(0.26f, 0.1f, 0.12f), hair); // bangs
        Prim(root, PrimitiveType.Capsule, new Vector3(-0.28f, 1.05f, 0), new Vector3(0.1f, 0.28f, 0.1f), skin); // arm L
        Prim(root, PrimitiveType.Capsule, new Vector3(0.28f, 1.05f, 0), new Vector3(0.1f, 0.28f, 0.1f), skin);
        Prim(root, PrimitiveType.Capsule, new Vector3(-0.12f, 0.42f, 0), new Vector3(0.12f, 0.32f, 0.12f), fit); // leg L
        Prim(root, PrimitiveType.Capsule, new Vector3(0.12f, 0.42f, 0), new Vector3(0.12f, 0.32f, 0.12f), fit);
        Prim(root, PrimitiveType.Cube, new Vector3(0, 1.18f, 0.12f), new Vector3(0.22f, 0.04f, 0.08f), accent); // visor bar
        return root;
    }

    static void Prim(GameObject parent, PrimitiveType type, Vector3 pos, Vector3 scale, Color col)
    {
        var g = GameObject.CreatePrimitive(type);
        g.transform.SetParent(parent.transform, false);
        g.transform.localPosition = pos;
        g.transform.localScale = scale;
        var c = g.GetComponent<Collider>();
        if (c)
        {
            if (Application.isPlaying) Object.Destroy(c);
            else Object.DestroyImmediate(c);
        }
        var r = g.GetComponent<Renderer>();
        r.material = RuntimeAssets.LitMaterial(col, (col.g > 0.8f && col.b > 0.8f && col.r < 0.5f) ? 0.6f : 0f);
    }

    void Update()
    {
        if (!visual) return;
        float spd = 0f;
        if (cc) spd = new Vector3(cc.velocity.x, 0f, cc.velocity.z).magnitude;
        else if (agent) spd = agent.velocity.magnitude;
        if (spd > 0.4f) bob += Time.deltaTime * 9f;
        float y = Mathf.Abs(Mathf.Sin(bob)) * Mathf.Clamp01(spd / 6f) * 0.06f;
        var p = visual.localPosition;
        visual.localPosition = new Vector3(p.x, baseY + y, p.z);
    }
}
