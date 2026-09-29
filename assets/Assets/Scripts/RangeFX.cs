using UnityEngine;

/// <summary>
/// Cheap pooled feedback for the Shrine Range: sparks, pop rings, rising score
/// sprites. Everything is primitive + FadeMaterial, matching the game's style.
/// </summary>
public static class RangeFX
{
    static Material sparkMat, roseMat, ringMat, cyanMat, goldMat;

    static Material FadeMat(Color c)
    {
        var m = new Material(RuntimeAssets.Sprite) { color = c };
        return m;
    }

    static Material SparkM
    {
        get { if (!sparkMat) sparkMat = FadeMat(new Color(1f, 0.95f, 0.75f, 0.95f)); return sparkMat; }
    }
    static Material RoseM
    {
        get { if (!roseMat) roseMat = FadeMat(new Color(1f, 0.4f, 0.66f, 0.95f)); return roseMat; }
    }
    static Material RingM
    {
        get { if (!ringMat) ringMat = FadeMat(new Color(0.55f, 0.4f, 0.95f, 0.7f)); return ringMat; }
    }
    static Material CyanM
    {
        get { if (!cyanMat) cyanMat = FadeMat(new Color(0.4f, 0.95f, 0.9f, 0.8f)); return cyanMat; }
    }
    static Material GoldM
    {
        get { if (!goldMat) goldMat = FadeMat(new Color(1f, 0.82f, 0.4f, 0.9f)); return goldMat; }
    }

    /// <summary>Small bright spark burst at a hit point.</summary>
    public static void Spark(Vector3 pos, bool weak)
    {
        var m = weak ? GoldM : SparkM;
        int n = weak ? 10 : 6;
        for (int i = 0; i < n; i++)
        {
            var s = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            var col = s.GetComponent<Collider>();
            if (col) Object.Destroy(col);
            s.transform.position = pos;
            s.transform.localScale = Vector3.one * Random.Range(0.04f, 0.1f);
            s.GetComponent<Renderer>().sharedMaterial = m;
            s.AddComponent<FXPiece>().vel = Random.onUnitSphere * Random.Range(2.4f, 6.5f);
            Object.Destroy(s, 0.4f);
        }
    }

    /// <summary>Rose burst when a waifu target drops.</summary>
    public static void Burst(Vector3 pos)
    {
        for (int i = 0; i < 12; i++)
        {
            var s = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            var col = s.GetComponent<Collider>();
            if (col) Object.Destroy(col);
            s.transform.position = pos + new Vector3(Random.Range(-0.2f, 0.2f), Random.Range(-0.1f, 0.3f), Random.Range(-0.2f, 0.2f));
            s.transform.localScale = new Vector3(0.09f, 0.05f, 0.13f);   // little petal shapes
            s.transform.rotation = Random.rotation;
            s.GetComponent<Renderer>().sharedMaterial = RoseM;
            var fx = s.AddComponent<FXPiece>();
            fx.vel = Random.onUnitSphere * Random.Range(1.5f, 3.5f) + Vector3.up * 1.4f;
            fx.gravity = 2.2f;
            fx.spin = true;
            Object.Destroy(s, 1.1f);
        }
        Ring(pos, RoseM, 2.6f);
    }

    /// <summary>Expanding holo ring — target raise / drone pop.</summary>
    public static void Pop(Vector3 pos, Color c)
    {
        Ring(pos, c == Color.clear ? CyanM : c.a > 0.85f && c.r > 0.9f && c.g > 0.75f && c.b < 0.5f ? GoldM : CyanM, 1.8f);
    }

    public static void Ring(Vector3 pos, Material m, float maxScale)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        var col = go.GetComponent<Collider>();
        if (col) Object.Destroy(col);
        go.transform.position = pos;
        go.transform.localScale = new Vector3(0.1f, 0.01f, 0.1f);
        go.GetComponent<Renderer>().sharedMaterial = m;
        go.AddComponent<FXRing>().maxScale = maxScale;
        Object.Destroy(go, 0.5f);
    }

    public static void Ring(Vector3 pos, Color c, float maxScale)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        var col = go.GetComponent<Collider>();
        if (col) Object.Destroy(col);
        go.transform.position = pos;
        go.transform.localScale = new Vector3(0.1f, 0.01f, 0.1f);
        go.GetComponent<Renderer>().sharedMaterial = FadeMat(c);
        go.AddComponent<FXRing>().maxScale = maxScale;
        Object.Destroy(go, 0.5f);
    }

    /// <summary>Rising text sprite is overkill; a rising glow quad does the job.</summary>
    public static void ScorePuff(Vector3 pos, Color c)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Quad);
        var col = go.GetComponent<Collider>();
        if (col) Object.Destroy(col);
        go.transform.position = pos;
        go.transform.localScale = new Vector3(0.3f, 0.3f, 0.3f);
        var r = go.GetComponent<Renderer>();
        var m = new Material(RuntimeAssets.Sprite) { color = c };
        r.sharedMaterial = m;
        go.AddComponent<FXPuff>().m = m;
        Object.Destroy(go, 0.7f);
    }

    class FXPiece : MonoBehaviour
    {
        public Vector3 vel;
        public float gravity;
        public bool spin;
        void Update()
        {
            vel.y -= (gravity > 0f ? gravity : 9f) * Time.deltaTime;
            transform.position += vel * Time.deltaTime;
            if (spin) transform.Rotate(120f * Time.deltaTime, 90f * Time.deltaTime, 60f * Time.deltaTime, Space.Self);
            var s = transform.localScale;
            transform.localScale = s * (1f - 1.6f * Time.deltaTime);
        }
    }

    class FXRing : MonoBehaviour
    {
        public float maxScale = 2f;
        void Update()
        {
            float t = Mathf.Clamp01(transform.localScale.x / maxScale);
            float u = 1f - Mathf.Exp(-9f * Time.deltaTime);
            var s = transform.localScale;
            s.x = Mathf.Lerp(s.x, maxScale, u);
            s.z = s.x;
            transform.localScale = s;
        }
    }

    class FXPuff : MonoBehaviour
    {
        public Material m;
        float t;
        void Update()
        {
            t += Time.deltaTime;
            transform.position += Vector3.up * 0.9f * Time.deltaTime;
            transform.localScale = Vector3.one * (0.3f + t * 0.5f);
            if (m) m.color = new Color(m.color.r, m.color.g, m.color.b, Mathf.Clamp01(1f - t / 0.7f));
            var mr = GetComponent<Renderer>();
            transform.rotation = Camera.main ? Camera.main.transform.rotation : Quaternion.identity;
        }
    }
}
