using UnityEngine;

/// <summary>
/// Halo-style frag grenade: arcing lob with a ~1s timing fuse, sphere cast
/// damage with falloff, camera shake for the player, resists friendly geometry.
/// </summary>
public class Grenade : MonoBehaviour
{
    public float fuse = 1.05f;
    public float radius = 6.5f;
    public float maxDamage = 110f;

    Vector3 velocity;
    Health thrower;
    float born;

    /// <summary>Fired for every detonation — bots use this to throw back, HUD draws the beat.</summary>
    public static event System.Action<Vector3> AnyExploded;

    public static void Throw(Vector3 origin, Vector3 dir, Health owner)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        go.name = "Grenade";
        go.transform.localScale = Vector3.one * 0.17f;
        go.transform.position = origin;
        var g = go.AddComponent<Grenade>();
        g.velocity = dir * 17f + Vector3.up * 4.5f;
        g.thrower = owner;
        g.born = Time.time;
        var r = go.GetComponent<Renderer>();
        r.material = RuntimeAssets.LitMaterial(new Color(0.13f, 0.16f, 0.12f), 0.4f);
        var rb = go.AddComponent<Rigidbody>();
        rb.mass = 0.4f;
        rb.linearDamping = 0.05f;
        rb.useGravity = true;
        rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
    }

    void Update()
    {
        if (Time.time - born >= fuse) Explode();
    }

    void Explode()
    {
        var cam = Camera.main;
        var center = transform.position;

        var hits = Physics.OverlapSphere(center, radius, ~0, QueryTriggerInteraction.Ignore);
        foreach (var h in hits)
        {
            if (!h) continue;   // a chain reaction may have deleted this collider already
            var hp = h.GetComponentInParent<Health>();
            if (!hp || hp.IsDead) continue;
            Vector3 to = hp.transform.position + Vector3.up - center;
            float d = to.magnitude;
            if (d > radius) continue;
            float dmg = maxDamage * Mathf.Lerp(1f, 0.25f, d / radius);
            hp.TakeDamage(dmg, center, thrower);
        }

        // shockwave visuals: a flash sphere + HUD pulse
        var boom = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        Object.Destroy(boom.GetComponent<Collider>());
        boom.transform.position = center;
        boom.transform.localScale = Vector3.one * radius * 1.6f;
        boom.GetComponent<Renderer>().material = RuntimeAssets.FadeMaterial(new Color(1f, 0.55f, 0.2f, 0.5f));
        Object.Destroy(boom, 0.28f);
        if (cam)
        {
            float d = Vector3.Distance(cam.transform.position, center);
            if (d < radius * 3f) FeelDirector.Pulse(Mathf.Clamp01(1f - d / (radius * 3f)) * 0.9f);
        }
        SoundManager.Impact(center);
        ArenaHUD.Beat("FRAG OUT", ArenaHUD.Note.Warn);
        try { AnyExploded?.Invoke(center); } catch { }
        Destroy(gameObject);
    }
}
