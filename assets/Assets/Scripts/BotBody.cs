using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Procedural enemy visual. Three archetypes with deliberately different
/// silhouettes so you can read the threat before you read the health bar:
/// Grunt is small and spindly, Ranger is sleek and shouldered, Heavy is a wall.
/// Animates a walk cycle, aim pose, flinch and a death topple.
/// </summary>
public class BotBody : MonoBehaviour
{
    public enum Archetype { Grunt, Ranger, Heavy }

    public Archetype archetype = Archetype.Grunt;
    public Color accent = Color.red;

    Transform root, torso, head, visor, armL, armR, legL, legR, gun, muzzle;
    Renderer visorRend, muzzleRend;
    Light muzzleLight;
    readonly List<Renderer> shell = new List<Renderer>();

    UnityEngine.AI.NavMeshAgent agent;
    float cycle, flinchUntil, muzzleUntil, aimBlend, deathT;
    bool dying;
    float stepPhase;

    static readonly Dictionary<int, Material> MatCache = new Dictionary<int, Material>();

    public Vector3 MuzzlePosition => muzzle ? muzzle.position : transform.position + Vector3.up * 1.4f;
    public Vector3 EyePosition => head ? head.position : transform.position + Vector3.up * 1.5f;

    public static BotBody Attach(GameObject host, Archetype type)
    {
        var b = host.GetComponent<BotBody>();
        if (!b) b = host.AddComponent<BotBody>();
        b.archetype = type;
        b.Build();
        return b;
    }

    // ---- construction ----------------------------------------------------------

    void Build()
    {
        agent = GetComponent<UnityEngine.AI.NavMeshAgent>();

        // hide the placeholder capsule but keep its collider for hit detection
        foreach (var r in GetComponents<Renderer>()) r.enabled = false;
        if (root) Destroy(root.gameObject);
        shell.Clear();

        var go = new GameObject("BotVisual");
        go.transform.SetParent(transform, false);
        root = go.transform;

        switch (archetype)
        {
            case Archetype.Heavy: BuildHeavy(); break;
            case Archetype.Ranger: BuildRanger(); break;
            default: BuildGrunt(); break;
        }
    }

    void BuildGrunt()
    {
        accent = new Color(0.55f, 0.72f, 1f);
        Color plate = new Color(0.16f, 0.19f, 0.17f);
        Color under = new Color(0.09f, 0.1f, 0.11f);

        torso = Node(root, new Vector3(0f, 0.92f, 0f));
        Prim(torso, PrimitiveType.Capsule, new Vector3(0f, 0.06f, 0f), new Vector3(0.3f, 0.26f, 0.24f), plate);
        Prim(torso, PrimitiveType.Sphere, new Vector3(0f, -0.14f, 0.02f), new Vector3(0.26f, 0.2f, 0.22f), under);
        // hunched backpack tank
        Prim(torso, PrimitiveType.Capsule, new Vector3(0f, 0.08f, -0.2f), new Vector3(0.2f, 0.17f, 0.16f), accent * 0.4f);

        head = Node(torso, new Vector3(0f, 0.3f, 0.02f));
        Prim(head, PrimitiveType.Sphere, Vector3.zero, Vector3.one * 0.22f, plate);
        visor = Node(head, new Vector3(0f, 0.01f, 0.1f));
        visorRend = Prim(visor, PrimitiveType.Sphere, Vector3.zero, new Vector3(0.14f, 0.07f, 0.08f), accent, 2.2f);
        // antenna reads instantly at distance
        Prim(head, PrimitiveType.Cylinder, new Vector3(0.08f, 0.22f, -0.04f), new Vector3(0.012f, 0.18f, 0.012f), under);

        armL = Limb(torso, new Vector3(-0.22f, 0.14f, 0f), new Vector3(0.075f, 0.2f, 0.075f), plate);
        armR = Limb(torso, new Vector3(0.22f, 0.14f, 0f), new Vector3(0.075f, 0.2f, 0.075f), plate);
        legL = Limb(root, new Vector3(-0.1f, 0.62f, 0f), new Vector3(0.085f, 0.3f, 0.085f), under);
        legR = Limb(root, new Vector3(0.1f, 0.62f, 0f), new Vector3(0.085f, 0.3f, 0.085f), under);

        BuildGun(new Vector3(0.2f, 0.05f, 0.3f), new Vector3(0.05f, 0.05f, 0.34f), plate);
        root.localScale = Vector3.one * 0.86f;
    }

    void BuildRanger()
    {
        accent = new Color(0.78f, 0.86f, 1f);
        Color plate = new Color(0.22f, 0.13f, 0.12f);
        Color trim = new Color(0.35f, 0.2f, 0.18f);

        torso = Node(root, new Vector3(0f, 1.02f, 0f));
        Prim(torso, PrimitiveType.Capsule, new Vector3(0f, 0.04f, 0f), new Vector3(0.34f, 0.3f, 0.24f), plate);
        Prim(torso, PrimitiveType.Cube, new Vector3(0f, 0.1f, 0.13f), new Vector3(0.26f, 0.22f, 0.06f), trim); // chest plate
        Prim(torso, PrimitiveType.Cube, new Vector3(0f, 0.12f, 0.16f), new Vector3(0.07f, 0.07f, 0.03f), accent, 1.6f); // core light
        // pauldrons widen the shoulder line
        Prim(torso, PrimitiveType.Sphere, new Vector3(-0.28f, 0.22f, 0f), new Vector3(0.2f, 0.14f, 0.2f), trim);
        Prim(torso, PrimitiveType.Sphere, new Vector3(0.28f, 0.22f, 0f), new Vector3(0.2f, 0.14f, 0.2f), trim);
        Prim(torso, PrimitiveType.Cube, new Vector3(0f, 0.02f, -0.2f), new Vector3(0.24f, 0.28f, 0.12f), trim); // pack

        head = Node(torso, new Vector3(0f, 0.36f, 0.01f));
        Prim(head, PrimitiveType.Capsule, Vector3.zero, new Vector3(0.2f, 0.13f, 0.22f), plate);
        visor = Node(head, new Vector3(0f, 0.0f, 0.1f));
        visorRend = Prim(visor, PrimitiveType.Cube, Vector3.zero, new Vector3(0.17f, 0.05f, 0.05f), accent, 2.4f);
        Prim(visor, PrimitiveType.Cube, new Vector3(0f, 0.05f, 0f), new Vector3(0.04f, 0.09f, 0.05f), accent, 2.4f); // T-slit

        armL = Limb(torso, new Vector3(-0.28f, 0.14f, 0f), new Vector3(0.09f, 0.22f, 0.09f), plate);
        armR = Limb(torso, new Vector3(0.28f, 0.14f, 0f), new Vector3(0.09f, 0.22f, 0.09f), plate);
        legL = Limb(root, new Vector3(-0.12f, 0.68f, 0f), new Vector3(0.1f, 0.34f, 0.1f), plate);
        legR = Limb(root, new Vector3(0.12f, 0.68f, 0f), new Vector3(0.1f, 0.34f, 0.1f), plate);

        BuildGun(new Vector3(0.24f, 0.04f, 0.34f), new Vector3(0.055f, 0.06f, 0.46f), trim);
        root.localScale = Vector3.one;
    }

    void BuildHeavy()
    {
        accent = new Color(0.45f, 0.55f, 0.95f);
        Color plate = new Color(0.2f, 0.19f, 0.26f);
        Color trim = new Color(0.4f, 0.4f, 0.5f);

        torso = Node(root, new Vector3(0f, 1.1f, 0f));
        Prim(torso, PrimitiveType.Cube, new Vector3(0f, 0.04f, 0f), new Vector3(0.52f, 0.46f, 0.36f), plate);
        Prim(torso, PrimitiveType.Cube, new Vector3(0f, 0.12f, 0.2f), new Vector3(0.4f, 0.24f, 0.05f), trim);
        // enormous pauldrons: the whole read of this archetype
        Prim(torso, PrimitiveType.Cube, new Vector3(-0.38f, 0.24f, 0f), new Vector3(0.24f, 0.22f, 0.34f), trim);
        Prim(torso, PrimitiveType.Cube, new Vector3(0.38f, 0.24f, 0f), new Vector3(0.24f, 0.22f, 0.34f), trim);
        Prim(torso, PrimitiveType.Cube, new Vector3(0f, 0.06f, -0.24f), new Vector3(0.36f, 0.4f, 0.16f), plate);
        Prim(torso, PrimitiveType.Sphere, new Vector3(0f, 0.2f, -0.3f), new Vector3(0.16f, 0.16f, 0.12f), accent, 1.4f);

        // head sunk between the shoulders
        head = Node(torso, new Vector3(0f, 0.3f, 0.04f));
        Prim(head, PrimitiveType.Cube, Vector3.zero, new Vector3(0.22f, 0.18f, 0.24f), plate);
        visor = Node(head, new Vector3(0f, 0f, 0.12f));
        visorRend = Prim(visor, PrimitiveType.Cube, Vector3.zero, new Vector3(0.16f, 0.04f, 0.04f), accent, 2.6f);

        armL = Limb(torso, new Vector3(-0.4f, 0.06f, 0f), new Vector3(0.13f, 0.24f, 0.13f), plate);
        armR = Limb(torso, new Vector3(0.4f, 0.06f, 0f), new Vector3(0.13f, 0.24f, 0.13f), plate);
        legL = Limb(root, new Vector3(-0.17f, 0.66f, 0f), new Vector3(0.15f, 0.34f, 0.15f), plate);
        legR = Limb(root, new Vector3(0.17f, 0.66f, 0f), new Vector3(0.15f, 0.34f, 0.15f), plate);

        BuildGun(new Vector3(0.34f, 0.0f, 0.36f), new Vector3(0.09f, 0.09f, 0.5f), trim);
        root.localScale = Vector3.one * 1.18f;
    }

    void BuildGun(Vector3 pos, Vector3 scale, Color c)
    {
        gun = Node(torso, pos);
        Prim(gun, PrimitiveType.Cube, Vector3.zero, scale, c);
        muzzle = Node(gun, new Vector3(0f, 0f, scale.z * 0.55f));
        muzzleRend = Prim(muzzle, PrimitiveType.Sphere, Vector3.zero, Vector3.one * 0.13f, new Color(0.8f, 0.88f, 1f), 3f);
        muzzleRend.enabled = false;

        var lightGo = new GameObject("MuzzleLight");
        lightGo.transform.SetParent(muzzle, false);
        muzzleLight = lightGo.AddComponent<Light>();
        muzzleLight.type = LightType.Point;
        muzzleLight.color = new Color(0.75f, 0.85f, 1f);
        muzzleLight.range = 7f;
        muzzleLight.intensity = 0f;
    }

    Transform Node(Transform parent, Vector3 local)
    {
        var go = new GameObject("J");
        go.transform.SetParent(parent, false);
        go.transform.localPosition = local;
        return go.transform;
    }

    /// <summary>A limb is a pivot at the joint with the segment hung below it, so rotation swings.</summary>
    Transform Limb(Transform parent, Vector3 joint, Vector3 scale, Color c)
    {
        var pivot = Node(parent, joint);
        Prim(pivot, PrimitiveType.Capsule, new Vector3(0f, -scale.y * 0.9f, 0f), scale, c);
        return pivot;
    }

    Renderer Prim(Transform parent, PrimitiveType type, Vector3 pos, Vector3 scale, Color col, float emission = 0f)
    {
        var g = GameObject.CreatePrimitive(type);
        g.transform.SetParent(parent, false);
        g.transform.localPosition = pos;
        g.transform.localScale = scale;
        var c = g.GetComponent<Collider>();
        if (c) { if (Application.isPlaying) Destroy(c); else DestroyImmediate(c); }
        g.layer = gameObject.layer;

        var r = g.GetComponent<Renderer>();
        r.sharedMaterial = SharedMat(col, emission);
        if (emission <= 0f) shell.Add(r);
        return r;
    }

    static Material SharedMat(Color c, float emission)
    {
        int key = c.GetHashCode() ^ (Mathf.RoundToInt(emission * 100f) << 16);
        if (MatCache.TryGetValue(key, out var m) && m) return m;
        m = RuntimeAssets.LitMaterial(c, emission);
        if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", 0.25f);
        MatCache[key] = m;
        return m;
    }

    // ---- runtime ---------------------------------------------------------------

    public void Flinch() => flinchUntil = Time.time + 0.12f;

    public void MuzzleFlash()
    {
        muzzleUntil = Time.time + 0.055f;
        aimBlend = 1f;
        if (gun) gun.localPosition -= new Vector3(0f, 0f, 0.05f);
    }

    public void SetAiming(bool on) => aimBlend = Mathf.Max(aimBlend, on ? 1f : 0f);

    public void PlayHit() => Flinch();

    public void PlayShoot() => MuzzleFlash();

    public void PlayDeath()
    {
        dying = true;
        deathT = 0f;
    }

    public void ResetBody()
    {
        dying = false;
        deathT = 0f;
        if (!root) return;
        root.localRotation = Quaternion.identity;
        root.localPosition = Vector3.zero;
        foreach (var r in shell) if (r) r.enabled = true;
        if (visorRend) visorRend.enabled = true;
    }

    void Update()
    {
        if (!root) return;
        float dt = Time.deltaTime;

        if (dying)
        {
            // topple forward and sink, then vanish until respawn
            deathT += dt;
            float u = Mathf.Clamp01(deathT / 0.7f);
            root.localRotation = Quaternion.Euler(Mathf.SmoothStep(0f, 88f, u), 0f, Mathf.SmoothStep(0f, 18f, u));
            root.localPosition = new Vector3(0f, -Mathf.SmoothStep(0f, 0.45f, u), 0f);
            if (visorRend) visorRend.enabled = u < 0.35f;
            if (u >= 1f) foreach (var r in shell) if (r) r.enabled = false;
            return;
        }

        float speed = agent ? agent.velocity.magnitude : 0f;
        float gait = Mathf.Clamp01(speed / 5.5f);
        cycle += dt * (4f + speed * 1.6f);
        aimBlend = Mathf.MoveTowards(aimBlend, 0f, dt * 1.4f);

        float swing = Mathf.Sin(cycle) * 38f * gait;
        if (legL) legL.localRotation = Quaternion.Euler(swing, 0f, 0f);
        if (legR) legR.localRotation = Quaternion.Euler(-swing, 0f, 0f);

        // arms counter-swing while moving, then fold up into an aim pose
        float armSwing = -swing * 0.55f;
        float aim = Mathf.SmoothStep(0f, 1f, aimBlend);
        if (armL) armL.localRotation = Quaternion.Euler(Mathf.Lerp(armSwing, -72f, aim), 0f, Mathf.Lerp(0f, 14f, aim));
        if (armR) armR.localRotation = Quaternion.Euler(Mathf.Lerp(-armSwing, -82f, aim), 0f, Mathf.Lerp(0f, -12f, aim));

        if (torso)
        {
            float bob = Mathf.Abs(Mathf.Sin(cycle)) * 0.035f * gait;
            torso.localPosition = new Vector3(0f, TorsoY + bob, 0f);
            torso.localRotation = Quaternion.Euler(Mathf.Lerp(0f, 6f, aim), 0f, Mathf.Sin(cycle) * 3.5f * gait);
        }

        // footfall audio on each leg's lowest point
        if (gait > 0.15f)
        {
            float ph = Mathf.Repeat(cycle, Mathf.PI);
            if (ph < stepPhase) SoundManager.Footstep(transform.position);
            stepPhase = ph;
        }

        if (gun) gun.localPosition = Vector3.Lerp(gun.localPosition, GunRest, 1f - Mathf.Exp(-14f * dt));

        bool flash = Time.time < muzzleUntil;
        if (muzzleRend) muzzleRend.enabled = flash;
        if (muzzleLight) muzzleLight.intensity = flash ? 4.5f : 0f;

        // visor brightens when engaged, whites out briefly when hit
        if (visorRend)
        {
            bool hurt = Time.time < flinchUntil;
            Color c = hurt ? Color.white : Color.Lerp(accent, Color.white, aim * 0.35f);
            float e = hurt ? 6f : 2.2f + aim * 1.5f;
            visorRend.material.color = c;
            visorRend.material.SetColor("_EmissionColor", c * e);
        }
    }

    float TorsoY => archetype == Archetype.Heavy ? 1.1f : archetype == Archetype.Ranger ? 1.02f : 0.92f;

    Vector3 GunRest => archetype == Archetype.Heavy ? new Vector3(0.34f, 0f, 0.36f)
        : archetype == Archetype.Ranger ? new Vector3(0.24f, 0.04f, 0.34f)
        : new Vector3(0.2f, 0.05f, 0.3f);
}
