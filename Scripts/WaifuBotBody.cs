using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

/// <summary>
/// Rumble-pit operative visual. ANIMATED ROSTER ONLY: the official trio from
/// the pack (Kasumi + SciFi Soldier get UAL-retargeted locomotion, mai_maid
/// plays her own 13 embedded clips) — no more gliding statues. Falls back to
/// a procedural breathing idle only if a rig somehow produces no animation./// Also owns her gun, eye-trace lasers and ground snapping.
/// </summary>
public class WaifuBotBody : MonoBehaviour
{
    [Header("Roster")]
    public int modelIndex;              // which GLB this operative wears

    static string[] pool;               // all loadable char GLBs, hero rigs first

    Transform visual;
    Animator animator;
    Animation legacyAnim;
    string idleClip;
    bool dying;
    float deathAt;
    Light flashLight;
    float flashUntil;
    float clipSearchAt;      // glTFast builds the rig a frame or two late
    bool clipSearched;
    Transform botGun;
    LineRenderer[] lasers;   // cyan eye-traces while she's engaged
    public Transform aimTarget;   // set by BotAI every frame
    WaifuAnimator waifu;     // UAL-retargeted locomotion (VRoid rigs)
    NavMeshAgent agent;
    bool deathPlayed;

    public bool IsDying => dying;

    public int Voice => modelIndex % 3;   // shot-pitch variety per operative

    // ------------------------------------------------------------ build ----

    public static WaifuBotBody Attach(GameObject host, int index)
    {
        var w = host.GetComponent<WaifuBotBody>();
        if (!w) w = host.AddComponent<WaifuBotBody>();
        w.modelIndex = index;
        w.Build();
        return w;
    }

    public void Build()
    {
        // hide the placeholder capsule shell but keep its collider for hits
        foreach (var r in GetComponents<Renderer>()) r.enabled = false;
        if (visual) Destroy(visual.gameObject);

        string[] keys = Roster();
        string key = keys[Mathf.Clamp(modelIndex, 0, keys.Length - 1)];
        var prefab = Resources.Load<GameObject>(key);
        if (!prefab)
        {
            // importer never claimed it — fall through to the next loadable key
            foreach (var k in keys)
            {
                prefab = Resources.Load<GameObject>(k);
                if (prefab) { key = k; break; }
            }
        }
        if (!prefab) { Debug.LogWarning("[WBOT] no character GLBs loadable"); return; }

        var inst = Instantiate(prefab);
        inst.name = "WaifuVisual";
        inst.transform.SetParent(transform, false);
        StripColliders(inst);
        FitHeight(inst.transform, 1.72f);
        visual = inst.transform;

        // clip discovery is DEFERRED to Update — glTFast wires the Animator
        // asynchronously, so scanning here always found nothing (idle=none)
        animator = inst.GetComponentInChildren<Animator>();
        if (animator) animator.applyRootMotion = false;
        legacyAnim = inst.GetComponentInChildren<Animation>();
        idleClip = null;
        clipSearched = false;
        clipSearchAt = Time.unscaledTime + 0.25f;

        int rends = inst.GetComponentsInChildren<Renderer>().Length;
        Debug.Log("[WBOT] operative " + modelIndex + " ← " + key + " (" + rends + " renderers, idle=" + (idleClip ?? "none") + ")");

        // muzzle flash: one small light per operative, toggled on shots
        var lightGo = new GameObject("MuzzleLight");
        lightGo.transform.SetParent(transform, false);
        lightGo.transform.localPosition = new Vector3(0.22f, 1.32f, 0.5f);
        flashLight = lightGo.AddComponent<Light>();
        flashLight.type = LightType.Point;
        flashLight.color = new Color(1f, 0.55f, 0.45f);
        flashLight.range = 6f;
        flashLight.intensity = 0f;

        // operative's gun: a compact carbine in her hands so she reads ARMED,
        // with cyan front-sight emissive matching the ECHO look
        var gun = new GameObject("OpGun");
        gun.transform.SetParent(transform, false);
        gun.transform.localPosition = new Vector3(0.22f, 1.24f, 0.3f);
        gun.transform.localRotation = Quaternion.Euler(0f, 0f, 0f);
        var body = GameObject.CreatePrimitive(PrimitiveType.Cube);
        Object.Destroy(body.GetComponent<Collider>());
        body.transform.SetParent(gun.transform, false);
        body.transform.localScale = new Vector3(0.055f, 0.09f, 0.36f);
        body.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(new Color(0.10f, 0.11f, 0.13f), 0.05f);
        var mag = GameObject.CreatePrimitive(PrimitiveType.Cube);
        Object.Destroy(mag.GetComponent<Collider>());
        mag.transform.SetParent(gun.transform, false);
        mag.transform.localPosition = new Vector3(0f, -0.09f, 0.03f);
        mag.transform.localScale = new Vector3(0.04f, 0.12f, 0.07f);
        mag.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(new Color(0.13f, 0.14f, 0.16f), 0.05f);
        var sight = GameObject.CreatePrimitive(PrimitiveType.Cube);
        Object.Destroy(sight.GetComponent<Collider>());
        sight.transform.SetParent(gun.transform, false);
        sight.transform.localPosition = new Vector3(0f, 0.065f, 0.16f);
        sight.transform.localScale = new Vector3(0.012f, 0.02f, 0.03f);
        sight.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(new Color(0f, 0.95f, 1f), 1.6f);
        var barrel = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        Object.Destroy(barrel.GetComponent<Collider>());
        barrel.transform.SetParent(gun.transform, false);
        barrel.transform.localPosition = new Vector3(0f, 0.005f, 0.24f);
        barrel.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
        barrel.transform.localScale = new Vector3(0.03f, 0.12f, 0.03f);
        barrel.GetComponent<Renderer>().sharedMaterial = RuntimeAssets.LitMaterial(new Color(0.16f, 0.17f, 0.19f), 0.05f);
        botGun = gun.transform;

        // eye-trace lasers: two hairlines that lock onto whoever she's hunting
        lasers = new LineRenderer[2];
        for (int i = 0; i < 2; i++)
        {
            var lgo = new GameObject("EyeLaser" + i);
            lgo.transform.SetParent(transform, false);
            var lr = lgo.AddComponent<LineRenderer>();
            lr.positionCount = 2;
            lr.startWidth = 0.008f;
            lr.endWidth = 0.002f;
            lr.material = new Material(RuntimeAssets.Sprite);
            lr.startColor = new Color(0f, 0.95f, 1f, 0.5f);
            lr.endColor = new Color(0f, 0.95f, 1f, 0f);
            lr.enabled = false;
            lasers[i] = lr;
        }
    }

    /// <summary>Roster order: animated/hero rigs lead, then everything else loadable.</summary>


    static string[] PreferredOrder =
    {
        "Characters/kasumi_tactical_sailor_aaa_100k",   // VRoid — UAL locomotion
        "Characters/scifi_waifu_soldier",               // VRoid — UAL locomotion
        "Characters/mai_maid",                          // 13 embedded clips
    };

    static string[] Roster()
    {
        if (pool != null) return pool;
        // ANIMATED-ONLY roster: verify each key loads before offering it, so
        // static mannequins (bunny/citlali/ghost/…) never take a slot again
        var list = new List<string>();
        foreach (var k in PreferredOrder)
            if (Resources.Load<GameObject>(k)) list.Add(k);
        pool = list.ToArray();
        return pool;
    }

    static readonly string[] IdleClips = { "standby", "touchingloop", "reactionloop", "idle" };
    static readonly string[] HitClips = { "reaction2", "reaction", "step" };

    // ------------------------------------------------------------ runtime ----

    public Vector3 MuzzlePosition => transform.position + Vector3.up * 1.32f + transform.forward * 0.35f;
    public Vector3 EyePosition => transform.position + Vector3.up * 1.55f;

    public void Flinch()
    {
        if (dying) return;
        string hitClip = FirstOf(HitClips);
        if (hitClip != null)
        {
            TryPlay(hitClip, 0.06f);
            Invoke(nameof(BackToIdle), 0.5f);
        }
    }

    public void PlayShoot()
    {
        if (dying || !visual) return;
        if (waifu != null && waifu.Ok) waifu.Shoot();
        // tiny recoil jerk + muzzle light reads as "she's firing" even without an arm rig
        visual.localPosition = new Vector3(0f, 0f, -0.05f);
        flashUntil = Time.time + 0.055f;
    }

    public void PlayDeath()
    {
        dying = true;
        deathAt = Time.time;
    }

    public void ResetBody()
    {
        dying = false;
        deathPlayed = false;
        if (waifu != null) waifu.Reset();
        if (botGun)
            foreach (var r in botGun.GetComponentsInChildren<Renderer>()) r.enabled = true;
        if (!visual) return;
        visual.localRotation = Quaternion.identity;
        visual.localPosition = Vector3.zero;
        foreach (var r in visual.GetComponentsInChildren<Renderer>()) r.enabled = true;
        if (idleClip != null) TryPlay(idleClip);
    }

    void BackToIdle()
    {
        if (!dying && idleClip != null) TryPlay(idleClip);
    }

    /// <summary>Second-chance rig wiring: UAL bake for VRoid rigs, own clips for mai.</summary>
    void DiscoverClips()
    {
        clipSearched = true;
        if (dying) return;
        if (!animator) animator = GetComponentInChildren<Animator>();
        if (!legacyAnim) legacyAnim = GetComponentInChildren<Animation>();

        // 1) mai's own embedded clips (real animations straight from the GLB)
        if (legacyAnim)
        {
            foreach (AnimationState st in legacyAnim) st.wrapMode = WrapMode.Loop;
            idleClip = FirstOf(IdleClips);
            if (idleClip != null)
                Debug.Log("[WBOT] operative " + modelIndex + " own clip = " + idleClip);
        }
        else if (animator && animator.runtimeAnimatorController)
        {
            idleClip = FirstOf(IdleClips);
            if (idleClip != null)
            {
                animator.CrossFadeInFixedTime(idleClip, 0.2f);
                Debug.Log("[WBOT] operative " + modelIndex + " animator clip = " + idleClip);
            }
        }

        // 2) UAL locomotion for VRoid rigs (Kasumi / SciFi) — the real fix
        if (idleClip == null)
        {
            agent = GetComponent<NavMeshAgent>();
            waifu = new WaifuAnimator(visual.gameObject);
            if (waifu.Ok)
                Debug.Log("[WBOT] operative " + modelIndex + " ← UAL live locomotion (idle/jog/sprint/shoot/death)");
        }
    }

    void Update()
    {
        if (!visual) return;
        if (!clipSearched && Time.unscaledTime > clipSearchAt) DiscoverClips();

        // ground snap: keep her soles on the floor (UV-animated water & stairs)
        if (!dying && Physics.Raycast(transform.position + Vector3.up * 1.2f, Vector3.down,
                out var ghit, 2.2f, ~0, QueryTriggerInteraction.Ignore))
        {
            var p = transform.position;
            p.y = Mathf.Lerp(p.y, ghit.point.y, 1f - Mathf.Exp(-10f * Time.deltaTime));
            transform.position = p;
        }

        if (dying)
        {
            if (waifu != null && waifu.Ok && !deathPlayed)
            {
                deathPlayed = true;
                waifu.Die();
                waifu.Pump();
                if (botGun) foreach (var r in botGun.GetComponentsInChildren<Renderer>()) r.enabled = false;
            }
            if (waifu != null && waifu.Ok) return;   // the death clip plays instead of a topple

            // topple back and sink, then vanish until respawn
            float u = Mathf.Clamp01((Time.time - deathAt) / 0.75f);
            visual.localRotation = Quaternion.Euler(-Mathf.SmoothStep(0f, 86f, u), 0f, Mathf.SmoothStep(0f, 12f, u));
            visual.localPosition = Vector3.down * (0.4f * u);
            if (u >= 1f)
                foreach (var r in visual.GetComponentsInChildren<Renderer>()) r.enabled = false;
            return;
        }

        if (flashLight) flashLight.intensity = Time.time < flashUntil ? 4f : 0f;

        // real locomotion: drive the UAL state machine from NavMesh velocity
        if (waifu != null && waifu.Ok)
        {
            float spd = agent ? agent.velocity.magnitude : 0f;
            waifu.Move(spd > 4.2f ? "sprint" : spd > 0.5f ? "run" : "idle");
            waifu.Pump();
            if (botGun) botGun.localPosition = new Vector3(0.22f, 1.24f, 0.3f);
            UpdateLasers();
            return;
        }

        if (idleClip != null)
        {
            // recover from the recoil jerk
            visual.localPosition = Vector3.Lerp(visual.localPosition, Vector3.zero, 1f - Mathf.Exp(-14f * Time.deltaTime));
            if (botGun) botGun.localPosition = new Vector3(0.22f, 1.24f, 0.3f);
            return;
        }

        // procedural idle: breathing bob + sway, so rigs without usable clips
        // still read as alive instead of frozen mannequins; her gun rides along
        float t = Time.unscaledTime * 1.7f + modelIndex * 1.3f;
        var rest = new Vector3(Mathf.Sin(t * 6.3f) * 0.004f, Mathf.Sin(t) * 0.015f, Mathf.Cos(t * 0.6f) * 0.008f);
        visual.localPosition = Vector3.Lerp(visual.localPosition, rest, 1f - Mathf.Exp(-8f * Time.deltaTime));
        visual.localRotation = Quaternion.Slerp(visual.localRotation,
            Quaternion.Euler(Mathf.Sin(t * 0.9f) * 2f, 0f, Mathf.Cos(t * 0.7f) * 1.5f),
            1f - Mathf.Exp(-6f * Time.deltaTime));
        if (botGun)
        {
            botGun.localPosition = new Vector3(0.22f, 1.24f + rest.y * 0.6f, 0.3f);
            botGun.localRotation = Quaternion.Euler(Mathf.Sin(t * 0.9f) * 1.5f, 0f, 0f);
        }
        UpdateLasers();
    }

    void UpdateLasers()
    {
        bool on = lasers != null && aimTarget && !dying;
        if (lasers == null) return;
        foreach (var lr in lasers) if (lr) lr.enabled = on;
        if (!on) return;
        Vector3 to = aimTarget.position + Vector3.up * 1.35f;
        for (int i = 0; i < 2; i++)
        {
            var eye = transform.TransformPoint(new Vector3(i == 0 ? -0.055f : 0.055f, 1.56f, 0.18f));
            lasers[i].SetPosition(0, eye);
            lasers[i].SetPosition(1, to);
        }
    }

    // ------------------------------------------------------------ clip glue ----

    string FirstOf(string[] names)
    {
        if (legacyAnim)
        {
            foreach (AnimationState st in legacyAnim)
                foreach (var n in names)
                    if (st.name.ToLowerInvariant().Contains(n)) return st.name;
        }
        else if (animator && animator.runtimeAnimatorController)
        {
            foreach (var clip in animator.runtimeAnimatorController.animationClips)
                foreach (var n in names)
                    if (clip.name.ToLowerInvariant().Contains(n)) return clip.name;
        }
        return null;
    }

    void TryPlay(string clip, float fade = 0.12f)
    {
        if (string.IsNullOrEmpty(clip)) return;
        if (legacyAnim) legacyAnim.CrossFade(clip, fade);
        else if (animator) animator.CrossFadeInFixedTime(clip, fade);
    }

    // ------------------------------------------------------------ plumbing ----

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
        t.localPosition = new Vector3(0f, -b.min.y * s, 0f);
        // recompute feet after scaling
        b = rends[0].bounds;
        foreach (var r in rends) b.Encapsulate(r.bounds);
        float feet = b.min.y - transform.position.y;
        t.localPosition += new Vector3(0f, -feet, 0f);
    }
}
