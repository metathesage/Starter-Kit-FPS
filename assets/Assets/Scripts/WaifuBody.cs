using UnityEngine;

/// <summary>
/// Visual for player/bots. Prefers imported GLB (Lucy / Citlali / Angle).
/// Falls back to a readable low-poly girl so nobody is a naked capsule.
/// Unrigged meshes get a walk-bob until a Mixamo/UAL humanoid is dropped in.
/// </summary>
public class WaifuBody : MonoBehaviour
{
    public enum Outfit { Lucy, Citlali, Angle, Fallback }

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

        string[] keys = { "Characters/lucy", "Characters/citlali", "Characters/angle" };
        string key = isPlayer ? keys[0] : keys[Mathf.Abs(variant) % keys.Length];
        var prefab = Resources.Load<GameObject>(key);
        if (prefab)
        {
            var inst = Instantiate(prefab);
            inst.name = "WaifuVisual";
            inst.transform.SetParent(transform, false);
            StripColliders(inst);
            FitHeight(inst.transform, 1.72f);
            visual = inst.transform;
            baseY = visual.localPosition.y;
            return;
        }
        visual = BuildFallback(variant).transform;
        baseY = visual.localPosition.y;
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
