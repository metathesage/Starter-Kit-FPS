using UnityEngine;

/// <summary>
/// One target on the Shrine Range.
///  Popup  — holo waifu figure with a gold halo core weak point, flips down on kill.
///  Drone  — hovering halo ring that drifts and pops with a rose burst.
/// _plate — red plastic cutout that respawns; free-fire only.
/// Downrange callouts are wired by RangeMaster.
/// </summary>
public class RangeTarget : MonoBehaviour
{
    public enum Kind { Popup, Drone, Plate }
    public Kind kind;

    [Header("Score values")]
    public int score = 100;
    public int weakScore = 250;          // halo core hit
    public float lifeSeconds = 6f;       // popups expire back down

    [Header("Runtime")]
    public bool active;
    public float deathAt;
    public int hp = 1;

    public int PointsFor(bool weak) => weak ? weakScore : score;
    public bool IsDown => !active;
    public bool IsAnimating => flipping;

    // parts
    Transform root;          // flips / bobs
    Renderer coreRend;       // the halo heart
    Light coreLight;
    Vector3 upLocal, downLocal;
    Quaternion upRot;
    bool flipping;
    float flipT;

    const float FlipSpeed = 9f;

    // ------------------------------------------------------------ build ----

    public static RangeTarget MakePopup(Transform parent, Vector3 pos, float yaw)
    {
        var t = New(parent, "RangeTarget_Popup", pos, yaw);
        t.kind = Kind.Popup;

        // holo pedestal: dark plinth + cyan lip
        Prim(t.transform, PrimitiveType.Cylinder, new Vector3(0f, 0.06f, 0f), new Vector3(0.5f, 0.06f, 0.5f),
            new Color(0.05f, 0.07f, 0.1f));
        Prim(t.transform, PrimitiveType.Cylinder, new Vector3(0f, 0.13f, 0f), new Vector3(0.44f, 0.02f, 0.44f),
            new Color(0.4f, 0.95f, 0.9f), 1.4f);

        // the waifu hologram
        t.root = new GameObject("Holo").transform;
        t.root.SetParent(t.transform, false);
        t.root.localPosition = new Vector3(0f, 0.16f, 0f);
        t.upLocal = t.root.localPosition;
        t.downLocal = t.upLocal + new Vector3(0f, -0.55f, 0f);
        t.upRot = Quaternion.identity;
        BuildWaifuHolo(t.root);
        t.BuildCore();

        var shell = t.root.gameObject.AddComponent<HoloShader>();
        shell.core = t.coreRend;
        t.AddHitbox(new Vector3(0f, 1.15f, 0f), new Vector3(0.55f, 1.35f, 0.45f));   // body
        return t;
    }

    public static RangeTarget MakeDrone(Transform parent, Vector3 pos)
    {
        var t = New(parent, "RangeTarget_Drone", pos, 0f);
        t.kind = Kind.Drone;
        t.score = 150;
        t.weakScore = 300;
        t.lifeSeconds = 999f;   // drones live until shot

        t.root = new GameObject("Ring").transform;
        t.root.SetParent(t.transform, false);
        t.root.localPosition = Vector3.zero;
        t.upLocal = Vector3.zero;
        t.downLocal = new Vector3(0f, -8f, 0f);
        t.upRot = Quaternion.Euler(90f, 0f, 0f);
        t.root.localRotation = t.upRot;

        Prim(t.root, PrimitiveType.Cylinder, Vector3.zero, new Vector3(0.9f, 0.05f, 0.9f),
            new Color(0.5f, 0.3f, 0.75f), 0.5f);
        Prim(t.root, PrimitiveType.Cylinder, Vector3.zero, new Vector3(1.05f, 0.02f, 1.05f),
            new Color(1f, 0.4f, 0.65f), 1.2f);
        // heart core at the centre
        var heart = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        heart.name = "HaloCore";
        heart.transform.SetParent(t.root, false);
        heart.transform.localScale = new Vector3(0.42f, 0.5f, 0.3f);
        Strip(heart);
        t.coreRend = heart.GetComponent<Renderer>();
        t.coreRend.sharedMaterial = CoreMat();
        t.AddCoreLight(heart.transform, 0.5f);
        var hb = t.root.gameObject.AddComponent<BoxCollider>();   // whole ring is hittable
        hb.isTrigger = false;
        hb.center = Vector3.zero;
        hb.size = new Vector3(1.9f, 1.9f, 0.5f);
        // weak-point sphere nudged toward +Y world (local −Z after the ring's 90° tilt)
        var coreCol = t.root.gameObject.AddComponent<SphereCollider>();
        coreCol.name = "HaloCoreHit";
        coreCol.center = new Vector3(0f, 0f, -0.3f);
        coreCol.radius = 0.24f;
        return t;
    }

    public static RangeTarget MakePlate(Transform parent, Vector3 pos, float yaw)
    {
        var t = New(parent, "RangeTarget_Plate", pos, yaw);
        t.kind = Kind.Plate;
        t.score = 10;
        t.weakScore = 10;

        t.root = new GameObject("Plate").transform;
        t.root.SetParent(t.transform, false);
        t.root.localPosition = Vector3.zero;
        t.upLocal = Vector3.zero;
        t.downLocal = new Vector3(0f, -0.24f, 0f);
        t.upRot = Quaternion.identity;

        var plate = GameObject.CreatePrimitive(PrimitiveType.Cube);
        plate.transform.SetParent(t.root, false);
        plate.transform.localPosition = new Vector3(0f, 0.22f, 0f);
        plate.transform.localScale = new Vector3(0.62f, 0.44f, 0.05f);
        Strip(plate);
        var r = plate.GetComponent<Renderer>();
        r.sharedMaterial = RuntimeAssets.LitMaterial(new Color(0.55f, 0.07f, 0.1f), 0.25f);
        t.root.localRotation = Quaternion.Euler(12f, 0f, 0f);
        t.upRot = t.root.localRotation;
        return t;
    }

    static RangeTarget New(Transform parent, string name, Vector3 pos, float yaw)
    {
        var go = new GameObject(name);
        go.transform.SetParent(parent, false);
        go.transform.position = pos;
        go.transform.rotation = Quaternion.Euler(0f, yaw, 0f);
        return go.AddComponent<RangeTarget>();
    }

    /// <summary>Stylised low-poly girl built from primitives, cel-lit.</summary>
    static void BuildWaifuHolo(Transform root)
    {
        Color skin = new Color(1f, 0.85f, 0.78f);
        Color suit = new Color(0.1f, 0.12f, 0.17f);
        Color trim = new Color(0.95f, 0.45f, 0.68f);

        Prim(root, PrimitiveType.Capsule, new Vector3(0f, 0.62f, 0f), new Vector3(0.26f, 0.3f, 0.2f), suit);   // torso
        Prim(root, PrimitiveType.Cube, new Vector3(0f, 0.66f, 0.1f), new Vector3(0.16f, 0.14f, 0.03f), trim, 1.2f); // chest emblem
        Prim(root, PrimitiveType.Sphere, new Vector3(0f, 1.02f, 0f), Vector3.one * 0.21f, skin);               // head
        Prim(root, PrimitiveType.Sphere, new Vector3(0f, 1.06f, -0.03f), new Vector3(0.25f, 0.26f, 0.24f),
            new Color(0.12f, 0.1f, 0.16f));                                                                     // hair
        Prim(root, PrimitiveType.Cube, new Vector3(0f, 1.0f, 0.09f), new Vector3(0.14f, 0.03f, 0.02f),
            new Color(0.5f, 0.95f, 0.95f), 2.2f);                                                               // visor
        // ponytail
        Prim(root, PrimitiveType.Capsule, new Vector3(0f, 0.92f, -0.18f), new Vector3(0.07f, 0.22f, 0.07f),
            new Color(0.12f, 0.1f, 0.16f));
        // arms
        Prim(root, PrimitiveType.Capsule, new Vector3(-0.2f, 0.6f, 0f), new Vector3(0.06f, 0.2f, 0.06f), suit);
        Prim(root, PrimitiveType.Capsule, new Vector3(0.2f, 0.6f, 0f), new Vector3(0.06f, 0.2f, 0.06f), suit);
        // legs
        Prim(root, PrimitiveType.Capsule, new Vector3(-0.08f, 0.18f, 0f), new Vector3(0.07f, 0.2f, 0.07f), suit);
        Prim(root, PrimitiveType.Capsule, new Vector3(0.08f, 0.18f, 0f), new Vector3(0.07f, 0.2f, 0.07f), suit);
        // cat ears — the gacha signature
        Prim(root, PrimitiveType.Cube, new Vector3(-0.1f, 1.2f, 0f), new Vector3(0.05f, 0.09f, 0.03f), trim, 0.7f);
        Prim(root, PrimitiveType.Cube, new Vector3(0.1f, 1.2f, 0f), new Vector3(0.05f, 0.09f, 0.03f), trim, 0.7f);
    }

    void BuildCore()
    {
        var heart = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        heart.name = "HaloCore";
        heart.transform.SetParent(root, false);
        heart.transform.localPosition = new Vector3(0f, 1.02f, 0.14f);
        heart.transform.localScale = new Vector3(0.16f, 0.19f, 0.11f);
        Strip(heart);
        coreRend = heart.GetComponent<Renderer>();
        coreRend.sharedMaterial = CoreMat();
        AddCoreLight(heart.transform, 0.55f);
        // dedicated weak-point collider, slightly generous so cores feel fair
        var coreCol = root.gameObject.AddComponent<SphereCollider>();
        coreCol.name = "HaloCoreHit";
        coreCol.center = new Vector3(0f, 1.02f, 0.14f);
        coreCol.radius = 0.14f;
    }

    /// <summary>One box collider so bullets can land; named for the hit router.</summary>
    void AddHitbox(Vector3 center, Vector3 size)
    {
        var box = gameObject.AddComponent<BoxCollider>();
        box.center = root ? root.TransformPoint(center) - transform.position : center;
        box.size = new Vector3(size.x, size.y, size.z);
    }

    void AddCoreLight(Transform at, float range)
    {
        var go = new GameObject("CoreLight");
        go.transform.SetParent(at, false);
        coreLight = go.AddComponent<Light>();
        coreLight.type = LightType.Point;
        coreLight.color = new Color(1f, 0.55f, 0.75f);
        coreLight.range = range;
        coreLight.intensity = 0f;
    }

    static Material coreMat;
    static Material CoreMat()
    {
        if (coreMat) return coreMat;
        coreMat = RuntimeAssets.LitMaterial(new Color(1f, 0.5f, 0.72f), 2.6f);
        return coreMat;
    }

    // ------------------------------------------------------------ runtime ----

    /// <summary>Arm a target for a drill. h &lt;= 0 means one-shot.</summary>
    public void Raise(float life)
    {
        active = true;
        hp = Mathf.Max(1, hp);
        lifeSeconds = life;
        deathAt = life > 60f ? float.MaxValue : Time.time + life;
        flipping = false;
        flipT = 0f;
        if (root)
        {
            root.localPosition = upLocal;
            root.localRotation = upRot;
            root.localScale = Vector3.one;
        }
        if (coreRend) coreRend.enabled = true;
        gameObject.SetActive(true);
        RangeFX.Pop(transform.position + Vector3.up * 0.9f, new Color(0.4f, 0.95f, 0.9f));
    }

    public void Lower()
    {
        active = false;
        deathAt = float.MaxValue;
    }

    /// <summary>Called by Weapon through RangeMaster. Returns points earned, 0 on miss/down.</summary>
    public int Hit(Vector3 point, bool weakPoint)
    {
        if (!active) return 0;
        hp--;
        RangeFX.Spark(point, weakPoint);
        if (hp > 0) return 0;

        active = false;
        deathAt = Time.time;
        flipping = true;
        return weakPoint ? weakScore : score;
    }

    void Update()
    {
        float dt = Time.deltaTime;
        float t = Time.time;

        if (active && kind == Kind.Popup && t > deathAt) { active = false; deathAt = t; flipping = true; }
        if (!active && !flipping) return;

        // flip / drop animation
        float u = 1f - Mathf.Exp(-FlipSpeed * dt);
        Vector3 target = active ? upLocal : downLocal;
        Quaternion rot = active ? upRot
            : kind == Kind.Drone ? upRot * Quaternion.Euler(0f, 0f, 60f)
            : Quaternion.Euler(-80f, 0f, 0f);
        root.localPosition = Vector3.Lerp(root.localPosition, target, u);
        root.localRotation = Quaternion.Slerp(root.localRotation, rot, u);
        if (!active && (root.localPosition - downLocal).sqrMagnitude < 0.001f) flipping = false;

        // idle motion + glow
        if (active)
        {
            if (kind == Kind.Drone)
            {
                root.Rotate(0f, 0f, 40f * dt, Space.Self);
                root.localPosition = upLocal + new Vector3(0f, Mathf.Sin(t * 2.1f) * 0.12f, 0f);
            }
            else if (kind == Kind.Popup)
            {
                float sway = Mathf.Sin(t * 1.6f + transform.position.x) * 0.012f;
                root.localPosition = upLocal + new Vector3(sway, 0f, 0f);
            }
            float pulse = 0.75f + 0.25f * Mathf.Sin(t * 5f);
            if (coreRend) coreRend.material.SetColor("_EmissionColor", new Color(1f, 0.5f, 0.72f) * (2.2f + pulse));
            if (coreLight) coreLight.intensity = 1.1f + pulse;
        }
        else
        {
            if (coreLight) coreLight.intensity = 0f;
        }
    }

    static void Strip(GameObject go)
    {
        var c = go.GetComponent<Collider>();
        if (c) { if (Application.isPlaying) Object.Destroy(c); else Object.DestroyImmediate(c); }
    }

    static Renderer Prim(Transform parent, PrimitiveType type, Vector3 pos, Vector3 scale, Color col, float emission = 0f)
    {
        var g = GameObject.CreatePrimitive(type);
        g.transform.SetParent(parent, false);
        g.transform.localPosition = pos;
        g.transform.localScale = scale;
        Strip(g);
        var r = g.GetComponent<Renderer>();
        r.sharedMaterial = RuntimeAssets.LitMaterial(col, emission);
        return r;
    }

    /// <summary>Makes the hologram translucent + unlit so it reads as a projection.</summary>
    class HoloShader : MonoBehaviour
    {
        public Renderer core;
        Renderer[] rends;
        void Start()
        {
            rends = GetComponentsInChildren<Renderer>();
            foreach (var r in rends)
            {
                if (r == core || r.transform.name == "HaloCore") continue;
                // Sprites/Default honours vertex alpha, so the hologram reads as a projection
                var m = new Material(RuntimeAssets.Sprite) { color = new Color(0.72f, 0.9f, 0.95f, 0.55f) };
                r.sharedMaterial = m;
            }
        }
    }
}
