using UnityEngine;

/// <summary>
/// An animated GLB range target. Waifu models with embedded clips (mai_maid:
/// Standby/Reaction/Throw/Charaselect...) play real hit-reactions; rigged-but-
/// static models still flinch via procedural T-pose break, so every waifu in
/// the pool reads as alive even without clips.
/// </summary>
public class AnimatedWaifu : MonoBehaviour
{
    // Pool = everything in Resources/Characters, mai first (she has 13 clips).
    static string[] poolKeys;
    public static int PoolCount { get { LoadPool(); return poolKeys.Length; } }

    public int poolIndex;
    public float strafeHalfWidth = 1.2f;
    public float strafeSpeed = 1.4f;
    public float laneCenterX;
    public float respawnDelay = 2.2f;

    Animator animator;
    Animation legacyAnim;
    Health hp;
    Transform visual;
    GameObject visualGo;

    int strafeDir = 1;
    float respawnAt;
    bool dead;
    float deathAt;

    // clip names (lowercased match) → try in order when hit
    static readonly string[] HitClips = { "reaction2", "reaction", "touchingend", "step" };
    static readonly string[] IdleClips = { "standby", "touchingloop", "reactionloop", "idle" };
    static readonly string[] IntroClips = { "charaselect", "costumechange", "throw" };

    static void LoadPool()
    {
        if (poolKeys != null) return;
        // mai is the star (13 embedded clips); everything else in Resources/Characters joins
        var set = new System.Collections.Generic.List<string>();
        var extras = Resources.LoadAll<GameObject>("Characters");
        foreach (var e in extras)
        {
            string key = "Characters/" + e.name;
            if (!set.Contains(key)) set.Add(key);
        }
        // mai first so pool index 0 is the fully-animated one
        string maiKey = "Characters/mai_maid_-bourin";
        if (set.Contains(maiKey)) { set.Remove(maiKey); set.Insert(0, maiKey); }
        poolKeys = set.ToArray();
    }

    public static int PlayableCount { get { LoadPool(); return poolKeys.Length; } }

    public static string DisplayName(int i)
    {
        LoadPool();
        string k = poolKeys[Mathf.Clamp(i, 0, poolKeys.Length - 1)];
        return k.Substring(k.LastIndexOf('/') + 1).Replace('_', ' ');
    }

    void Start()
    {
        SpawnVisual(poolIndex, false);
        if (hp) hp.OnDeath += OnDeathEvent;
    }

    public void Bind(Health health)
    {
        hp = health;
        hp.OnDeath += OnDeathEvent;
    }

    /// <summary>Swap this dummy's model; optionally play her intro clip.</summary>
    public void Swap(int newPoolIdx, bool playIntro = false)
    {
        poolIndex = newPoolIdx;
        if (visualGo) Destroy(visualGo);
        SpawnVisual(newPoolIdx, playIntro);
        if (hp && hp.IsDead) hp.Revive(transform.position);
        dead = false;
    }

    void SpawnVisual(int idx, bool intro)
    {
        LoadPool();
        string key = poolKeys[Mathf.Clamp(idx, 0, poolKeys.Length - 1)];
        var prefab = Resources.Load<GameObject>(key);
        if (!prefab)
        {
            WaifuCompanion.Say("Missing GLB: " + key + ". Drop it in Resources/Characters.", 3f);
            return;
        }
        var inst = Instantiate(prefab, transform, false);
        inst.name = "WaifuVisual";
        visual = inst.transform;
        visualGo = inst;
        StripColliders(inst);
        FitHeight(visual, 1.68f);

        animator = inst.GetComponentInChildren<Animator>();
        legacyAnim = inst.GetComponentInChildren<Animation>();
        if (legacyAnim)
        {
            foreach (AnimationState st in legacyAnim) st.wrapMode = WrapMode.Loop;
            TryPlay(intro ? FirstOf(IntroClips) : FirstOf(IdleClips));
        }
        else if (animator)
        {
            animator.applyRootMotion = false;
            TryPlay(intro ? FirstOf(IntroClips) : FirstOf(IdleClips));
        }
    }

    string FirstOf(string[] names)
    {
        // glTFast registers each embedded clip by its GLB name (legacy mode)
        // or as controller states (Animator mode). Match loosely.
        if (legacyAnim)
        {
            foreach (AnimationState st in legacyAnim)
                foreach (var n in names)
                    if (st.name.ToLowerInvariant().Contains(n))
                        return st.name;
        }
        else if (animator && animator.runtimeAnimatorController)
        {
            foreach (var clip in animator.runtimeAnimatorController.animationClips)
                foreach (var n in names)
                    if (clip.name.ToLowerInvariant().Contains(n))
                        return clip.name;
        }
        return null;
    }

    void TryPlay(string clip, float fade = 0.12f)
    {
        if (string.IsNullOrEmpty(clip)) return;
        if (legacyAnim) legacyAnim.CrossFade(clip, fade);
        else if (animator) animator.CrossFadeInFixedTime(clip, fade);
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
        t.localScale = Vector3.one * (target / h);
    }

    void OnDeathEvent(Health h)
    {
        dead = true;
        deathAt = Time.time;
        // death clip if she has one, else the procedural topple takes over
        TryPlay(FirstOf(new[] { "reaction" }));
    }

    public void Despawn()
    {
        if (hp) hp.OnDeath -= OnDeathEvent;
        if (visualGo) Destroy(visualGo);
        Destroy(gameObject);
    }

    void Update()
    {
        // strafe along the lane: alive targets are fun targets
        if (!dead && visual && Active())
        {
            float x = transform.position.x;
            if (x > laneCenterX + strafeHalfWidth) strafeDir = -1;
            else if (x < laneCenterX - strafeHalfWidth) strafeDir = 1;
            var p = transform.position;
            p.x += strafeDir * strafeSpeed * Time.deltaTime;
            transform.position = p;
            if (visual) visual.rotation = Quaternion.Slerp(visual.rotation,
                Quaternion.LookRotation(new Vector3(strafeDir, 0f, 0f), Vector3.up), 2f * Time.deltaTime);
        }

        if (dead)
        {
            // procedural topple (works with or without clips)
            float u = Mathf.Clamp01((Time.time - deathAt) / 0.8f);
            if (visual) visual.localRotation = Quaternion.Euler(Mathf.SmoothStep(0f, 82f, u), 0f, Mathf.SmoothStep(0f, 14f, u));
            if (visual) visual.localPosition = Vector3.down * (0.45f * u);
            if (u >= 1f && Time.time > deathAt + respawnDelay)
            {
                if (hp) hp.Revive(transform.position);
                dead = false;
                if (visual)
                {
                    visual.localRotation = Quaternion.identity;
                    visual.localPosition = Vector3.zero;
                }
                TryPlay(FirstOf(IdleClips));
            }
        }
    }

    bool Active() => RangeMode.Active;
}
