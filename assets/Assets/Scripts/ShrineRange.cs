using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// The Shrine Range: a moonlit torii-and-water training construct.
/// Firing deck at +z, downrange field toward -z, two reflecting ponds, torii
/// gates, halo statues, cherry blossom, a giant moon and a floating city.
/// Built entirely from primitives in the game's runtime-material style.
/// </summary>
public class ShrineRange : MonoBehaviour
{
    public static ShrineRange Instance { get; private set; }

    // palette — lifted from the concept plates
    static readonly Color StoneDark = new Color(0.16f, 0.19f, 0.27f);
    static readonly Color StoneLight = new Color(0.62f, 0.66f, 0.74f);
    static readonly Color ToriiRed = new Color(0.35f, 0.06f, 0.1f);
    static readonly Color ToriiGlow = new Color(1f, 0.36f, 0.55f);
    static readonly Color Water = new Color(0.1f, 0.16f, 0.28f);
    static readonly Color WaterGlow = new Color(0.45f, 0.75f, 0.9f);
    static readonly Color Blossom = new Color(0.92f, 0.72f, 0.82f);
    static readonly Color BlossomTrunk = new Color(0.2f, 0.14f, 0.16f);
    static readonly Color HaloWhite = new Color(0.88f, 0.9f, 0.95f);
    static readonly Color MoonColor = new Color(0.92f, 0.94f, 1f);

    public List<Vector3> PopupSpots { get; } = new List<Vector3>();
    public List<Vector3> PlateSpots { get; } = new List<Vector3>();
    public List<Vector3> DroneSpots { get; } = new List<Vector3>();

    static Material waterMat, glowMat;
    readonly List<Transform> petalFields = new List<Transform>();

    void Awake()
    {
        Instance = this;
        if (!waterMat) waterMat = RuntimeAssets.LitMaterial(Water, 0.35f);
        if (!glowMat) glowMat = RuntimeAssets.LitMaterial(WaterGlow, 1.6f);
    }

    /// <summary>Editor build helper: forward to the runtime path.</summary>
    public static ShrineRange Build(Transform parent)
    {
        var go = new GameObject("ShrineRange");
        if (parent) go.transform.SetParent(parent, false);
        var r = go.AddComponent<ShrineRange>();
        r.Generate();
        return r;
    }

    public void Generate()
    {
        Instance = this;

        Ground();
        FiringDeck();
        Ponds();
        Downrange();
        ToriiLine();
        Statues();
        Blossoms();
        Lanterns();
        Skyline();
        Moon();
        Ambience();
        SpawnSpots();

        EnsureWind();
    }

    /// <summary>Wind bed loops while the range exists; safe to call repeatedly.</summary>
    public void EnsureWind()
    {
        if (!SoundManager.Instance) return;
        if (transform.Find("ShrineWind")) return;
        var wind = new GameObject("ShrineWind");
        wind.transform.SetParent(transform, false);
        var src = wind.AddComponent<AudioSource>();
        src.loop = true;
        src.playOnAwake = false;
        src.spatialBlend = 0f;
        src.volume = 0.14f * SettingsManager.sfxVolume * SettingsManager.masterVolume;
        var clip = SoundManager.WindClip();
        if (clip) { src.clip = clip; src.Play(); }
    }

    // ------------------------------------------------------------ terrain ----

    void Ground()
    {
        var deck = GameObject.CreatePrimitive(PrimitiveType.Cube);
        deck.name = "StoneFloor";
        deck.transform.position = new Vector3(0f, -0.15f, 0f);
        deck.transform.localScale = new Vector3(46f, 0.3f, 90f);
        deck.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneDark, 0f);
        if (deck.GetComponent<Renderer>().sharedMaterial.HasProperty("_Glossiness"))
            deck.GetComponent<Renderer>().sharedMaterial.SetFloat("_Glossiness", 0.42f);

        var edgeA = GameObject.CreatePrimitive(PrimitiveType.Cube);
        edgeA.name = "EdgeGlowA";
        edgeA.transform.position = new Vector3(-5.6f, 0.02f, 0f);
        edgeA.transform.localScale = new Vector3(0.08f, 0.02f, 86f);
        edgeA.GetComponent<Renderer>().sharedMaterial = glowMat;
        Strip(edgeA);
        var edgeB = Object.Instantiate(edgeA);
        edgeB.name = "EdgeGlowB";
        edgeB.transform.position = new Vector3(5.6f, 0.02f, 0f);
    }

    void FiringDeck()
    {
        // raised observation deck at +z
        var d = GameObject.CreatePrimitive(PrimitiveType.Cube);
        d.name = "FiringDeck";
        d.transform.position = new Vector3(0f, 0.12f, 30f);
        d.transform.localScale = new Vector3(14f, 0.55f, 7f);
        d.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneLight * 0.75f, 0f);

        // cyan deck lip
        var lip = GameObject.CreatePrimitive(PrimitiveType.Cube);
        lip.name = "DeckLip";
        lip.transform.position = new Vector3(0f, 0.4f, 26.6f);
        lip.transform.localScale = new Vector3(14f, 0.03f, 0.1f);
        lip.GetComponent<Renderer>().sharedMaterial = glowMat;
        Strip(lip);

        // the armory bench from the concept art: guns laid out on a low table
        var bench = GameObject.CreatePrimitive(PrimitiveType.Cube);
        bench.name = "ArmoryBench";
        bench.transform.position = new Vector3(-4.6f, 0.62f, 31.4f);
        bench.transform.localScale = new Vector3(3.4f, 0.12f, 1.1f);
        bench.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(new Color(0.07f, 0.08f, 0.1f), 0f);
        Strip(bench);
        for (int i = 0; i < 3; i++)
        {
            var gun = GameObject.CreatePrimitive(PrimitiveType.Cube);
            gun.name = "DisplayGun" + i;
            gun.transform.SetParent(bench.transform, false);
            gun.transform.localPosition = new Vector3(-1.1f + i * 1.1f, 0.1f, 0f);
            gun.transform.localRotation = Quaternion.Euler(0f, 8f * i - 8f, 0f);
            gun.transform.localScale = new Vector3(0.9f, 0.05f, 0.08f);
            gun.GetComponent<Renderer>().sharedMaterial =
                RuntimeAssets.LitMaterial(new Color(0.25f, 0.27f, 0.3f), 0.1f);
            Strip(gun);
        }

        // low rails so you don't stroll into the pond
        Rail(new Vector3(-6.6f, 0.5f, 29f), Quaternion.Euler(0f, 0f, 0f));
        Rail(new Vector3(6.6f, 0.5f, 29f), Quaternion.Euler(0f, 0f, 0f));
    }

    void Rail(Vector3 at, Quaternion rot)
    {
        var r = GameObject.CreatePrimitive(PrimitiveType.Cube);
        r.name = "Rail";
        r.transform.position = at;
        r.transform.rotation = rot;
        r.transform.localScale = new Vector3(0.08f, 0.9f, 6f);
        r.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneDark * 1.2f, 0f);
        Strip(r);
        var g = Object.Instantiate(r);
        g.name = "RailGlow";
        g.transform.position = at + new Vector3(0f, 0.42f, 0f);
        g.transform.localScale = new Vector3(0.02f, 0.02f, 5.8f);
        g.GetComponent<Renderer>().sharedMaterial = glowMat;
    }

    void Ponds()
    {
        Pond(new Vector3(-12.5f, 0.02f, 4f), new Vector3(9f, 0.06f, 34f));
        Pond(new Vector3(12.5f, 0.02f, 4f), new Vector3(9f, 0.06f, 34f));
    }

    void Pond(Vector3 at, Vector3 size)
    {
        var w = GameObject.CreatePrimitive(PrimitiveType.Cube);
        w.name = "Pond";
        w.transform.position = at;
        w.transform.localScale = size;
        w.GetComponent<Renderer>().sharedMaterial = waterMat;
        if (w.GetComponent<Renderer>().sharedMaterial.HasProperty("_Glossiness"))
            w.GetComponent<Renderer>().sharedMaterial.SetFloat("_Glossiness", 0.85f);
        Strip(w);

        // stone coping
        var cop = GameObject.CreatePrimitive(PrimitiveType.Cube);
        cop.name = "PondCoping";
        cop.transform.position = at + new Vector3(0f, 0.14f, 0f);
        cop.transform.localScale = size + new Vector3(0.7f, 0.2f, 0.7f);
        cop.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneDark, 0f);
        // a glowing seam around the water line
        var seam = GameObject.CreatePrimitive(PrimitiveType.Cube);
        seam.name = "PondSeam";
        seam.transform.position = at + new Vector3(0f, 0.02f, 0f);
        seam.transform.localScale = new Vector3(size.x + 0.75f, 0.015f, size.z + 0.75f);
        seam.GetComponent<Renderer>().sharedMaterial = glowMat;
        Strip(seam);
        // keep the coping visible but let the water show: shrink water slightly above seam
        w.transform.localScale = size - new Vector3(0.5f, 0f, 0.5f);
    }

    void Downrange()
    {
        // step platforms the popups stand on
        for (int i = 0; i < 4; i++)
        {
            float z = 12f - i * 9f;
            var step = GameObject.CreatePrimitive(PrimitiveType.Cube);
            step.name = "RangeStep" + i;
            step.transform.position = new Vector3(0f, -0.1f, z);
            step.transform.localScale = new Vector3(20f, 0.26f, 3.2f);
            step.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneDark * 1.25f, 0f);

            var lip = GameObject.CreatePrimitive(PrimitiveType.Cube);
            lip.name = "StepLip" + i;
            lip.transform.position = new Vector3(0f, 0.03f, z + 1.5f);
            lip.transform.localScale = new Vector3(20f, 0.02f, 0.07f);
            lip.GetComponent<Renderer>().sharedMaterial = glowMat;
            Strip(lip);
        }

        // boulder clusters for cover / silhouette
        Boulders(new Vector3(-8.5f, 0f, -6f));
        Boulders(new Vector3(8.2f, 0f, -14f));
        Boulders(new Vector3(-9.5f, 0f, -22f));
    }

    void Boulders(Vector3 at)
    {
        for (int i = 0; i < 4; i++)
        {
            var b = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            b.name = "Boulder";
            b.transform.position = at + new Vector3(Random.Range(-1.6f, 1.6f), Random.Range(-0.2f, 0.15f), Random.Range(-1.6f, 1.6f));
            b.transform.localScale = new Vector3(Random.Range(0.7f, 1.5f), Random.Range(0.5f, 1f), Random.Range(0.7f, 1.5f));
            b.transform.rotation = Random.rotation;
            b.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneLight * 0.55f, 0f);
            Strip(b);
        }
    }

    // ------------------------------------------------------------ landmark ----

    void ToriiLine()
    {
        // three gates marching downrange — the signature silhouette
        Torii(new Vector3(0f, 0f, 2f), 1.35f);
        Torii(new Vector3(0f, 0f, -10f), 1.9f);
        Torii(new Vector3(0f, 0f, -26f), 2.6f);
    }

    void Torii(Vector3 at, float scale)
    {
        var g = new GameObject("Torii");
        g.transform.position = at;
        g.transform.localScale = Vector3.one * scale;

        // two pillars, slight inward lean
        foreach (float s in new[] { -1f, 1f })
        {
            var p = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            p.name = "Pillar";
            p.transform.SetParent(g.transform, false);
            p.transform.localPosition = new Vector3(s * 2.1f, 2.1f, 0f);
            p.transform.localRotation = Quaternion.Euler(0f, 0f, -s * 2.5f);
            p.transform.localScale = new Vector3(0.3f, 2.2f, 0.3f);
            p.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(ToriiRed, 0f);
            Strip(p);
        }

        // lower beam (nuki)
        var nuki = GameObject.CreatePrimitive(PrimitiveType.Cube);
        nuki.name = "Nuki";
        nuki.transform.SetParent(g.transform, false);
        nuki.transform.localPosition = new Vector3(0f, 3.35f, 0f);
        nuki.transform.localScale = new Vector3(5.2f, 0.24f, 0.24f);
        nuki.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(ToriiRed, 0f);
        Strip(nuki);

        // upper lintel (kasagi) with lifted ends and a glow underside
        var kasagi = GameObject.CreatePrimitive(PrimitiveType.Cube);
        kasagi.name = "Kasagi";
        kasagi.transform.SetParent(g.transform, false);
        kasagi.transform.localPosition = new Vector3(0f, 4.05f, 0f);
        kasagi.transform.localScale = new Vector3(6.4f, 0.3f, 0.4f);
        kasagi.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(ToriiRed, 0f);
        Strip(kasagi);
        foreach (float s in new[] { -1f, 1f })
        {
            var tip = GameObject.CreatePrimitive(PrimitiveType.Cube);
            tip.name = "KasagiTip";
            tip.transform.SetParent(g.transform, false);
            tip.transform.localPosition = new Vector3(s * 3.15f, 4.16f, 0f);
            tip.transform.localRotation = Quaternion.Euler(0f, 0f, -s * 7f);
            tip.transform.localScale = new Vector3(1.1f, 0.28f, 0.42f);
            tip.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(ToriiRed, 0f);
            Strip(tip);
        }
        var under = GameObject.CreatePrimitive(PrimitiveType.Cube);
        under.name = "KasagiGlow";
        under.transform.SetParent(g.transform, false);
        under.transform.localPosition = new Vector3(0f, 3.88f, 0f);
        under.transform.localScale = new Vector3(6.2f, 0.04f, 0.2f);
        under.GetComponent<Renderer>().sharedMaterial =
            RuntimeAssets.LitMaterial(ToriiGlow, 1.8f);
        Strip(under);
    }

    void Statues()
    {
        HaloStatue(new Vector3(-15.5f, 0f, 8f), 14f);
        HaloStatue(new Vector3(15.5f, 0f, 8f), 166f);
    }

    void HaloStatue(Vector3 at, float yaw)
    {
        var s = new GameObject("HaloStatue");
        s.transform.position = at;
        s.transform.rotation = Quaternion.Euler(0f, yaw, 0f);

        // plinth
        var plinth = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        plinth.name = "Plinth";
        plinth.transform.SetParent(s.transform, false);
        plinth.transform.localPosition = new Vector3(0f, 0.35f, 0f);
        plinth.transform.localScale = new Vector3(1.6f, 0.35f, 1.6f);
        plinth.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneLight * 0.5f, 0f);
        Strip(plinth);

        // robed figure: stacked cones + capsule, all halo-white
        var robe = GameObject.CreatePrimitive(PrimitiveType.Capsule);
        robe.name = "Robe";
        robe.transform.SetParent(s.transform, false);
        robe.transform.localPosition = new Vector3(0f, 1.5f, 0f);
        robe.transform.localScale = new Vector3(0.72f, 1.1f, 0.55f);
        robe.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(HaloWhite, 0.06f);
        Strip(robe);
        var chest = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        chest.name = "Chest";
        chest.transform.SetParent(s.transform, false);
        chest.transform.localPosition = new Vector3(0f, 2.5f, 0f);
        chest.transform.localScale = new Vector3(0.5f, 0.55f, 0.36f);
        chest.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(HaloWhite, 0.06f);
        Strip(chest);
        var head = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        head.name = "Head";
        head.transform.SetParent(s.transform, false);
        head.transform.localPosition = new Vector3(0f, 2.95f, 0.02f);
        head.transform.localScale = new Vector3(0.3f, 0.34f, 0.3f);
        head.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(HaloWhite, 0.08f);
        Strip(head);
        // hair mass
        var hair = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        hair.name = "Hair";
        hair.transform.SetParent(s.transform, false);
        hair.transform.localPosition = new Vector3(0f, 2.9f, -0.12f);
        hair.transform.localScale = new Vector3(0.36f, 0.5f, 0.34f);
        hair.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(HaloWhite, 0.1f);
        Strip(hair);

        // THE HALO — glowing ring above the head, the whole landmark read
        var halo = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        halo.name = "Halo";
        halo.transform.SetParent(s.transform, false);
        halo.transform.localPosition = new Vector3(0f, 3.5f, 0.02f);
        halo.transform.localScale = new Vector3(0.62f, 0.02f, 0.62f);
        halo.GetComponent<Renderer>().sharedMaterial =
            RuntimeAssets.LitMaterial(new Color(0.95f, 0.8f, 0.5f), 2.4f);
        Strip(halo);

        // rifle cradled in arms (concept art: statues hold sniper rifles)
        var rifle = GameObject.CreatePrimitive(PrimitiveType.Cube);
        rifle.name = "Rifle";
        rifle.transform.SetParent(s.transform, false);
        rifle.transform.localPosition = new Vector3(0.12f, 1.7f, 0.3f);
        rifle.transform.localRotation = Quaternion.Euler(0f, -12f, 62f);
        rifle.transform.localScale = new Vector3(0.09f, 1.5f, 0.09f);
        rifle.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(new Color(0.3f, 0.32f, 0.38f), 0f);
        Strip(rifle);

        // the statue lights its surroundings
        var glow = new GameObject("StatueLight");
        glow.transform.SetParent(s.transform, false);
        glow.transform.localPosition = new Vector3(0f, 3.2f, 0.4f);
        var l = glow.AddComponent<Light>();
        l.type = LightType.Point;
        l.color = new Color(0.75f, 0.8f, 1f);
        l.range = 12f;
        l.intensity = 1.4f;
    }

    void Blossoms()
    {
        BlossomTree(new Vector3(-14.5f, 0f, 18f), 0.9f);
        BlossomTree(new Vector3(14.2f, 0f, 12f), 1.05f);
        BlossomTree(new Vector3(-13.8f, 0f, -16f), 1.15f);
        BlossomTree(new Vector3(13.6f, 0f, -21f), 0.95f);
    }

    void BlossomTree(Vector3 at, float scale)
    {
        var t = new GameObject("BlossomTree");
        t.transform.position = at;
        t.transform.localScale = Vector3.one * scale;

        var trunk = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        trunk.name = "Trunk";
        trunk.transform.SetParent(t.transform, false);
        trunk.transform.localPosition = new Vector3(0f, 1.1f, 0f);
        trunk.transform.localRotation = Quaternion.Euler(0f, 0f, 4f);
        trunk.transform.localScale = new Vector3(0.22f, 1.2f, 0.22f);
        trunk.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(BlossomTrunk, 0f);
        Strip(trunk);
        var limb = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        limb.name = "Limb";
        limb.transform.SetParent(t.transform, false);
        limb.transform.localPosition = new Vector3(0.4f, 1.9f, 0.1f);
        limb.transform.localRotation = Quaternion.Euler(0f, 0f, -55f);
        limb.transform.localScale = new Vector3(0.13f, 0.8f, 0.13f);
        limb.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(BlossomTrunk, 0f);
        Strip(limb);

        // blossom cloud: clumps of soft pink spheres
        for (int i = 0; i < 7; i++)
        {
            var c = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            c.name = "Blossom";
            c.transform.SetParent(t.transform, false);
            float a = i * Mathf.PI * 2f / 7f;
            c.transform.localPosition = new Vector3(Mathf.Cos(a) * 0.85f, 2.3f + Mathf.Sin(i * 1.7f) * 0.35f, Mathf.Sin(a) * 0.75f);
            c.transform.localScale = new Vector3(Random.Range(0.7f, 1.15f), Random.Range(0.45f, 0.7f), Random.Range(0.7f, 1.15f));
            c.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(Blossom, 0.12f);
            Strip(c);
        }
    }

    void Lanterns()
    {
        Lantern(new Vector3(-7.4f, 0f, 22f));
        Lantern(new Vector3(7.4f, 0f, 22f));
        Lantern(new Vector3(-7.6f, 0f, -1f));
        Lantern(new Vector3(7.6f, 0f, -1f));
        Lantern(new Vector3(-7.8f, 0f, -19f));
        Lantern(new Vector3(7.8f, 0f, -19f));
    }

    void Lantern(Vector3 at)
    {
        var l = new GameObject("StoneLantern");
        l.transform.position = at;

        var baseP = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        baseP.name = "Base";
        baseP.transform.SetParent(l.transform, false);
        baseP.transform.localPosition = new Vector3(0f, 0.25f, 0f);
        baseP.transform.localScale = new Vector3(0.3f, 0.25f, 0.3f);
        baseP.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneLight * 0.6f, 0f);
        Strip(baseP);

        var box = GameObject.CreatePrimitive(PrimitiveType.Cube);
        box.name = "Box";
        box.transform.SetParent(l.transform, false);
        box.transform.localPosition = new Vector3(0f, 0.66f, 0f);
        box.transform.localScale = new Vector3(0.34f, 0.32f, 0.34f);
        box.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneLight * 0.6f, 0f);
        Strip(box);

        // warm light panel inside
        var panel = GameObject.CreatePrimitive(PrimitiveType.Cube);
        panel.name = "Panel";
        panel.transform.SetParent(l.transform, false);
        panel.transform.localPosition = new Vector3(0f, 0.66f, 0f);
        panel.transform.localScale = new Vector3(0.24f, 0.2f, 0.24f);
        panel.GetComponent<Renderer>().sharedMaterial =
            RuntimeAssets.LitMaterial(new Color(1f, 0.85f, 0.6f), 1.5f);
        Strip(panel);

        var cap = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        cap.name = "Cap";
        cap.transform.SetParent(l.transform, false);
        cap.transform.localPosition = new Vector3(0f, 0.9f, 0f);
        cap.transform.localScale = new Vector3(0.42f, 0.12f, 0.42f);
        cap.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(StoneLight * 0.6f, 0f);
        Strip(cap);

        var glow = new GameObject("Warm");
        glow.transform.SetParent(l.transform, false);
        glow.transform.localPosition = new Vector3(0f, 0.7f, 0f);
        var li = glow.AddComponent<Light>();
        li.type = LightType.Point;
        li.color = new Color(1f, 0.78f, 0.5f);
        li.range = 7f;
        li.intensity = 0.9f;
    }

    // ------------------------------------------------------------ sky ----

    void Skyline()
    {
        // floating city spires, far and high, mostly silhouette
        var group = new GameObject("Skyline");
        group.transform.position = new Vector3(0f, 0f, 0f);
        for (int i = 0; i < 16; i++)
        {
            float a = i * Mathf.PI * 2f / 16f + 0.3f;
            float r = 120f + Random.Range(-18f, 26f);
            Vector3 at = new Vector3(Mathf.Cos(a) * r, Random.Range(14f, 52f), Mathf.Sin(a) * r - 30f);
            var spire = GameObject.CreatePrimitive(PrimitiveType.Cube);
            spire.name = "Spire";
            spire.transform.SetParent(group.transform, false);
            spire.transform.position = at;
            spire.transform.rotation = Quaternion.Euler(0f, Random.Range(0f, 90f), 0f);
            float h = Random.Range(14f, 40f);
            spire.transform.localScale = new Vector3(Random.Range(2f, 5f), h, Random.Range(2f, 5f));
            spire.GetComponent<Renderer>().sharedMaterial =
                RuntimeAssets.LitMaterial(new Color(0.1f, 0.11f, 0.17f), 0f);
            Strip(spire);
            // window glow near the top
            var win = GameObject.CreatePrimitive(PrimitiveType.Cube);
            win.name = "SpireWindow";
            win.transform.SetParent(group.transform, false);
            win.transform.position = at + new Vector3(0f, h * 0.5f, 0f);
            win.transform.localScale = new Vector3(2.4f, 0.4f, 2.4f);
            win.GetComponent<Renderer>().sharedMaterial =
                RuntimeAssets.LitMaterial(new Color(0.55f, 0.7f, 0.95f), 1.2f);
            Strip(win);
        }

        // the great ring gate on the horizon (from the concept)
        var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        ring.name = "GreatRing";
        ring.transform.position = new Vector3(26f, 34f, -150f);
        ring.transform.rotation = Quaternion.Euler(90f, 0f, 20f);
        ring.transform.localScale = new Vector3(34f, 2f, 34f);
        ring.GetComponent<Renderer>().sharedMaterial =
            RuntimeAssets.LitMaterial(new Color(0.5f, 0.42f, 0.7f), 0.35f);
        Strip(ring);
    }

    void Moon()
    {
        // big billboard moon far back — no collider, unaffected by fog magnitude in play feel
        var moon = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        moon.name = "Moon";
        moon.transform.position = new Vector3(-6f, 44f, -190f);
        moon.transform.localScale = Vector3.one * 22f;
        moon.GetComponent<Renderer>().sharedMaterial =
            RuntimeAssets.LitMaterial(MoonColor, 0.85f);
        Strip(moon);

        // moon glow halo
        var halo = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        halo.name = "MoonHalo";
        halo.transform.position = moon.transform.position;
        halo.transform.localScale = Vector3.one * 27f;
        var hr = halo.GetComponent<Renderer>();
        hr.sharedMaterial = new Material(RuntimeAssets.Sprite)
        {
            color = new Color(0.7f, 0.78f, 1f, 0.08f)
        };
        Strip(halo);

        var moonLightGo = new GameObject("MoonLight");
        var ml = moonLightGo.AddComponent<Light>();
        ml.type = LightType.Directional;
        ml.color = new Color(0.62f, 0.7f, 0.95f);
        ml.intensity = 0.85f;
        ml.shadows = LightShadows.Soft;
        moonLightGo.transform.rotation = Quaternion.Euler(38f, 12f, 0f);
    }

    void Ambience()
    {
        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.ExponentialSquared;
        RenderSettings.fogColor = new Color(0.07f, 0.09f, 0.14f);
        RenderSettings.fogDensity = 0.011f;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(0.28f, 0.33f, 0.48f);
        RenderSettings.ambientEquatorColor = new Color(0.14f, 0.15f, 0.22f);
        RenderSettings.ambientGroundColor = new Color(0.05f, 0.05f, 0.08f);
        RenderSettings.ambientIntensity = 1.05f;
    }

    void SpawnSpots()
    {
        // four firing lanes x four depth rows for popups
        float[] lanes = { -6.75f, -2.25f, 2.25f, 6.75f };
        float[] rows = { 12f, 3f, -7.5f, -18f };
        for (int r = 0; r < rows.Length; r++)
        {
            for (int l = 0; l < lanes.Length; l++)
            {
                // leave the centre lane of the far row clear for the statue vista
                if (r == 3 && Mathf.Abs(lanes[l]) < 3f) continue;
                Vector3 at = new Vector3(lanes[l] + Random.Range(-0.6f, 0.6f), 0.06f, rows[r]);
                PopupSpots.Add(at);
            }
        }
        // plate wall row, close
        for (int i = 0; i < 5; i++)
            PlateSpots.Add(new Vector3(-4.5f + i * 2.25f, 0.3f, 8.5f));
        // drone hover points — mid field and over ponds
        DroneSpots.Add(new Vector3(0f, 3.2f, -13f));
        DroneSpots.Add(new Vector3(-12.5f, 2.8f, 4f));
        DroneSpots.Add(new Vector3(12.5f, 2.8f, 4f));
        DroneSpots.Add(new Vector3(-4f, 3.6f, -24f));
        DroneSpots.Add(new Vector3(4f, 3.6f, -24f));
    }

    static void Strip(GameObject go)
    {
        var c = go.GetComponent<Collider>();
        if (c) { if (Application.isPlaying) Object.Destroy(c); else Object.DestroyImmediate(c); }
    }

    /// <summary>Rebuild this range's petal drift (call once after Generate).</summary>
    public void AttachPetals(int fieldCount = 3)
    {
        for (int i = 0; i < fieldCount; i++)
        {
            var f = new GameObject("Petals" + i);
            f.transform.SetParent(transform, false);
            var drift = f.AddComponent<PetalDrift>();
            drift.fieldCenter = new Vector3(0f, 6f + i * 3f, 4f);
            drift.count = 60;
            drift.Build();
            petalFields.Add(f.transform);
        }
    }

    /// <summary>A gentle rain of sakura petals — cheap quads, wraps around the player.</summary>
    class PetalDrift : MonoBehaviour
    {
        public Vector3 fieldCenter;
        public int count = 60;
        struct P { public Vector3 pos; public Vector3 vel; public float spin; }
        P[] ps;
        Mesh mesh;
        Material mat;

        public void Build()
        {
            ps = new P[count];
            for (int i = 0; i < count; i++) ps[i] = RandomP(true);
            mesh = new Mesh();
            var verts = new Vector3[count * 4];
            var tris = new int[count * 6];
            var uvs = new Vector2[count * 4];
            for (int i = 0; i < count; i++)
            {
                int v = i * 4;
                verts[v] = Vector3.zero; verts[v + 1] = Vector3.right * 0.14f;
                verts[v + 2] = Vector3.right * 0.14f + Vector3.up * 0.1f;
                verts[v + 3] = Vector3.up * 0.1f;
                tris[v] = v; tris[v + 1] = v + 2; tris[v + 2] = v + 1;
                tris[v + 3] = v; tris[v + 4] = v + 3; tris[v + 5] = v + 2;
                uvs[v] = new Vector2(0, 0); uvs[v + 1] = new Vector2(1, 0);
                uvs[v + 2] = new Vector2(1, 1); uvs[v + 3] = new Vector2(0, 1);
            }
            mesh.vertices = verts; mesh.triangles = tris; mesh.uv = uvs;
            var mf = gameObject.AddComponent<MeshFilter>();
            mf.sharedMesh = mesh;
            mat = new Material(RuntimeAssets.Sprite) { color = new Color(0.95f, 0.75f, 0.85f, 0.85f) };
            var mr = gameObject.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        P RandomP(bool init) => new P
        {
            pos = fieldCenter + new Vector3(Random.Range(-24f, 24f), init ? Random.Range(-6f, 4f) : Random.Range(-2f, 2f), Random.Range(-40f, 20f)),
            vel = new Vector3(Random.Range(-0.35f, 0.05f), Random.Range(-0.9f, -0.45f), Random.Range(-0.12f, 0.12f)),
            spin = Random.Range(1.5f, 4f)
        };

        void LateUpdate()
        {
            if (ps == null) return;
            var verts = mesh.vertices;
            float t = Time.time;
            var cam = Camera.main;
            Vector3 anchor = cam ? cam.transform.position : Vector3.zero;
            for (int i = 0; i < count; i++)
            {
                var p = ps[i];
                p.pos += p.vel * Time.deltaTime;
                p.pos.x += Mathf.Sin(t * p.spin + i) * 0.012f;
                if (p.pos.y < fieldCenter.y - 8f)
                {
                    p = RandomP(false);
                    p.pos = new Vector3(anchor.x + Random.Range(-22f, 22f), fieldCenter.y + 2f, anchor.z + Random.Range(-34f, 16f));
                    p.pos += Vector3.zero;
                }
                // wrap x/z near the player
                if (Mathf.Abs(p.pos.x - anchor.x) > 26f) p.pos.x = anchor.x - Mathf.Sign(p.pos.x - anchor.x) * 25f;
                if (p.pos.z - anchor.z > 18f || p.pos.z - anchor.z < -38f)
                    p.pos.z = anchor.z - Random.Range(-34f, 16f);
                ps[i] = p;

                float sway = Mathf.Sin(t * p.spin + i * 2f) * 0.07f;
                int v = i * 4;
                verts[v] = p.pos + new Vector3(0f, 0f, 0f);
                verts[v + 1] = p.pos + new Vector3(0.12f + sway, 0f, 0f);
                verts[v + 2] = p.pos + new Vector3(0.12f, 0.09f, 0f);
                verts[v + 3] = p.pos + new Vector3(sway, 0.09f, 0f);
            }
            mesh.vertices = verts;
        }
    }
}
