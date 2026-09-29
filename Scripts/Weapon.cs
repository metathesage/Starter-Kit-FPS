using UnityEngine;

/// <summary>
/// Hitscan weapon with recoil pattern, first-shot accuracy, falloff, pellets.
/// </summary>
public class Weapon : MonoBehaviour
{
    public enum Kind { Rifle, Carbine, SMG, Pistol, HandCannon, Shotgun, Sniper, Bow, Launcher, Swarm }

    [Header("Weapon")]
    public Kind kind = Kind.Rifle;
    public string weaponName = "MA5K";
    public int damage = 22;
    public int magSize = 36;
    public int reserveAmmo = 108;
    public float fireRate = 0.095f;
    public float reloadTime = 1.15f;
    public float range = 140f;
    public bool automatic = true;
    public int pellets = 1;
    public float spreadHip = 0.6f;
    public float spreadAds = 0.12f;
    public float recoilPitch = 0.55f;
    public float recoilYaw = 0.18f;
    public float falloffStart = 22f;
    public float falloffEnd = 70f;

    [Header("Muzzle")]
    public Transform muzzleTip;   // set from the GLB's forward-most point; drives tracers

    [Header("ADS")]
    public float adsFovOverride;  // >0: scoped FOV while aiming (0 = global ads FOV)

    [Header("Runtime")]
    public int currentAmmo;
    public bool isReloading;
    public float lastShot = -999f;

    const float MagOutAt = 0.26f;   // normalised points in the reload where the
    const float MagInAt = 0.68f;    // magazine leaves and seats again

    Vector3 restLocal;
    Vector3 punch;
    Quaternion kickRot = Quaternion.identity;
    Vector2 sway;
    Camera cam;
    int shotIndex;
    float adsBlend;
    float reloadStartTime, reloadEndTime;
    bool magOutDone, magInDone;
    float nextDryAt;

    public static Weapon Active { get; private set; }

    /// <summary>0..1 through the current reload; 0 when not reloading.</summary>
    public float ReloadProgress01 =>
        isReloading && reloadEndTime > reloadStartTime
            ? Mathf.Clamp01((Time.time - reloadStartTime) / (reloadEndTime - reloadStartTime))
            : 0f;

    public float Ammo01 => magSize > 0 ? currentAmmo / (float)magSize : 0f;
    public bool LowAmmo => !isReloading && currentAmmo <= Mathf.Max(1, Mathf.CeilToInt(magSize * 0.25f));
    public bool Empty => currentAmmo <= 0;
    public float SpreadNow => GameInput.AimHeld ? spreadAds : spreadHip;
    public float AdsBlend => adsBlend;

    Vector3 AdsLocal => new Vector3(0f, restLocal.y + 0.035f, restLocal.z + 0.09f);

    void Awake()
    {
        restLocal = transform.localPosition;
        currentAmmo = magSize;
    }

    void OnEnable()
    {
        Active = this;
        ResetReload();
    }

    // Switching weapons mid-reload used to leave a pending Invoke that later
    // refilled the mag out of nowhere. Reload is now a plain timer we can drop.
    void OnDisable() => ResetReload();

    void ResetReload()
    {
        CancelInvoke();
        isReloading = false;
        magOutDone = magInDone = false;
        kickRot = Quaternion.identity;
        adsBlend = 0f;
    }

    void Start()
    {
        cam = Camera.main;
        if (currentAmmo <= 0) currentAmmo = magSize;
    }

    void Update()
    {
        if (!gameObject.activeInHierarchy) return;
        if (OptionsMenu.IsOpen || ArenaDirector.MatchOver) return;
        if (!cam) cam = Camera.main;

        TickReload();
        PoseTick();

        if (isReloading) return;
        if (GameInput.ReloadPressed) StartReload(true);

        bool want = automatic ? GameInput.FireHeld : GameInput.FirePressed;
        if (want) TryFire();
        if (!GameInput.FireHeld) shotIndex = 0;
    }

    void TickReload()
    {
        if (!isReloading) return;
        float t = ReloadProgress01;
        if (!magOutDone && t >= MagOutAt) { magOutDone = true; SoundManager.MagOut(); }
        if (!magInDone && t >= MagInAt) { magInDone = true; SoundManager.MagIn(); }
        if (t >= 1f) FinishReload();
    }

    /// <summary>
    /// Procedural viewmodel pose: idle sway, ADS pull-in, and the reload dip.
    /// Rotation is base-pose * decaying fire kick so the two never fight.
    /// </summary>
    void PoseTick()
    {
        float dt = Time.deltaTime;
        punch = Vector3.Lerp(punch, Vector3.zero, 1f - Mathf.Exp(-12f * dt));
        kickRot = Quaternion.Slerp(kickRot, Quaternion.identity, 1f - Mathf.Exp(-10f * dt));

        adsBlend = Mathf.MoveTowards(adsBlend, GameInput.AimHeld && !isReloading ? 1f : 0f, dt * 9f);
        Vector3 pos = Vector3.Lerp(restLocal, AdsLocal, Mathf.SmoothStep(0f, 1f, adsBlend));
        Quaternion pose = Quaternion.identity;

        // recovery from the sideways muzzle shove (camera frame)
        if (sideShove != Vector3.zero)
        {
            pos += sideShove;
            sideShove = Vector3.Lerp(sideShove, Vector3.zero, 1f - Mathf.Exp(-14f * dt));
            if (sideShove.sqrMagnitude < 1e-6f) sideShove = Vector3.zero;
        }

        if (isReloading)
        {
            float t = ReloadProgress01;
            float dip = Mathf.SmoothStep(0f, 1f, Mathf.Sin(t * Mathf.PI));
            pos += new Vector3(0.05f, -0.17f, -0.11f) * dip;
            pose = Quaternion.Euler(36f * dip, -14f * dip, 20f * dip);
            // magazine slaps out, then seats back in with a sharper snap
            pose *= Quaternion.Euler(0f, 0f, -9f * Beat(t, MagOutAt) + 11f * Beat(t, MagInAt));
            pos += Vector3.down * 0.035f * Beat(t, MagInAt);
        }

        float swayScale = (1f - 0.65f * adsBlend) * 0.01f;
        Vector2 swayTarget = new Vector2(
            Mathf.Clamp(-GameInput.MouseLookX, -6f, 6f),
            Mathf.Clamp(-GameInput.MouseLookY, -6f, 6f)) * swayScale;
        sway = Vector2.Lerp(sway, swayTarget, 1f - Mathf.Exp(-9f * dt));

        transform.localPosition = pos + punch + new Vector3(sway.x, sway.y, 0f);
        // fire kick + reload dip act in the CAMERA frame, with the per-kind yaw
        // baked underneath — this keeps the barrel pointing forward while it kicks
        transform.localRotation = kickRot * pose * baseRot;
    }

    Vector3 sideShove;
    Quaternion baseRot = Quaternion.identity;   // per-kind yaw set by Make()

    /// <summary>Short 0..1 pulse centred on a point in the reload timeline.</summary>
    static float Beat(float t, float at)
    {
        float pulse = 1f - Mathf.Abs(t - at) / 0.09f;
        return Mathf.Clamp01(pulse);
    }

    void TryFire()
    {
        if (Time.time < lastShot + fireRate) return;
        if (currentAmmo <= 0)
        {
            if (reserveAmmo > 0) { StartReload(); return; }
            if (Time.time < nextDryAt) return;
            nextDryAt = Time.time + 0.3f;
            SoundManager.DryFire();
            ArenaHUD.Notify("OUT OF AMMO", ArenaHUD.Note.Bad);
            kickRot *= Quaternion.Euler(-1.4f, 0f, 0f);
            return;
        }
        lastShot = Time.time;
        currentAmmo--;
        Shoot();
        OnFired?.Invoke(this);
        RangeMaster.NotifyShot(this);
        SoundManager.Shot(kind);
        FeelDirector.Pulse(kind == Kind.Sniper ? 0.45f : kind == Kind.Shotgun ? 0.38f : 0.16f);
        punch += new Vector3(Random.Range(-0.01f, 0.01f), 0.018f, -0.04f);
        kickRot *= Quaternion.Euler(-recoilPitch * 4f, Random.Range(-2f, 2f), Random.Range(-3f, 3f));
        // brief sideways muzzle shove — the sideways jolt reads as lateral recoil
        sideShove += (Vector3)Random.insideUnitCircle.normalized * 0.02f;

        // View kick climbs with sustained fire and fully recovers afterwards.
        if (PlayerController.Instance)
        {
            float ads = GameInput.AimHeld ? 0.72f : 1f;
            float climb = recoilPitch * (1f + shotIndex * 0.05f) * ads;
            float drift = Random.Range(-recoilYaw, recoilYaw) * (1f + shotIndex * 0.06f) * ads;
            PlayerController.Instance.AddRecoil(climb, drift);
        }

        shotIndex++;
        ArenaHUD.MuzzleFlash();

        if (currentAmmo == Mathf.Max(1, Mathf.CeilToInt(magSize * 0.25f)))
        {
            SoundManager.LowAmmo();
            ArenaHUD.Notify("LOW AMMO", ArenaHUD.Note.Warn);
        }
        else if (currentAmmo == 0)
        {
            ArenaHUD.Notify(reserveAmmo > 0 ? "MAG EMPTY" : "OUT OF AMMO", ArenaHUD.Note.Bad);
        }
    }

    void Shoot()
    {
        if (!cam) return;
        int n = Mathf.Max(1, pellets);
        bool anyHit = false;
        bool anyKill = false;
        bool headKill = false;
        bool anyHead = false;
        Vector3 lastPoint = cam.transform.position + cam.transform.forward * 4f;
        for (int i = 0; i < n; i++)
        {
            float spread = GameInput.AimHeld ? spreadAds : spreadHip;
            if (shotIndex == 0 && i == 0) spread *= 0.15f;
            Vector2 jitter = Random.insideUnitCircle * spread;
            Vector3 dir = Quaternion.Euler(jitter.y, jitter.x, 0f) * cam.transform.forward;
            // bullet bending: near-misses curve onto the assisted target
            dir = AimAssist.BendShot(cam.transform.position, dir, cam.transform);
            if (Physics.Raycast(cam.transform.position, dir, out RaycastHit hit, range, ~0, QueryTriggerInteraction.Ignore))
            {
                lastPoint = hit.point;
                RangeMaster.NotifyHit(hit);          // shrine range scoring hook
                var h = hit.collider.GetComponentInParent<Health>();
                // range targets are scored by the router, not the health system
                if (h && h.transform.root != transform.root && !hit.collider.GetComponentInParent<RangeTarget>())
                {
                    bool head = hit.collider.name.ToLowerInvariant().Contains("head");
                    float dmg = damage * Falloff(hit.distance) * (head ? 2f : 1f);   // headshots pay double
                    bool wasAlive = !h.IsDead;
                    h.TakeDamage(dmg, hit.point, transform.root.GetComponentInParent<Health>());
                    ArenaHUD.DamageNumber(hit.point, Mathf.RoundToInt(dmg), head);
                    anyHit = true;
                    if (head) anyHead = true;
                    if (wasAlive && h.IsDead)
                    {
                        anyKill = true;
                        if (head) headKill = true;
                    }
                    SpawnImpact(hit, true);
                }
                else SpawnImpact(hit, false);
            }
        }
        Tracer(MuzzleWorld(), lastPoint);
        if (anyHit)
        {
            ArenaHUD.Hitmarker(anyKill, anyHead);
            SoundManager.Hitmarker();                if (anyKill)
                {
                    SoundManager.KillConfirm();
                    FeelDirector.HitStop(0.055f, 0.12f);
                    WaifuCompanion.OnKill();
                    ArenaHUD.Elim(headKill);
                }
        }
    }

    float Falloff(float dist)
    {
        if (dist <= falloffStart) return 1f;
        if (dist >= falloffEnd) return 0.45f;
        return Mathf.Lerp(1f, 0.45f, (dist - falloffStart) / (falloffEnd - falloffStart));
    }

    void SpawnImpact(RaycastHit hit, bool flesh)
    {
        var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        go.name = "Impact";
        Destroy(go.GetComponent<Collider>());
        go.transform.position = hit.point + hit.normal * 0.02f;
        go.transform.localScale = Vector3.one * (flesh ? 0.09f : 0.05f);
        var r = go.GetComponent<Renderer>();
        r.material = RuntimeAssets.FadeMaterial(flesh ? new Color(1f, 0.25f, 0.45f, 1f) : new Color(1f, 0.85f, 0.4f, 1f));
        Destroy(go, 0.18f);
    }

    void Tracer(Vector3 a, Vector3 b)
    {
        var go = new GameObject("Tracer");
        var lr = go.AddComponent<LineRenderer>();
        lr.positionCount = 2;
        lr.SetPosition(0, a);
        lr.SetPosition(1, b);
        lr.startWidth = 0.02f;
        lr.endWidth = 0.005f;
        lr.material = new Material(RuntimeAssets.Sprite);
        lr.startColor = new Color(1f, 0.92f, 0.55f, 0.9f);
        lr.endColor = new Color(1f, 0.4f, 0.1f, 0f);
        Destroy(go, 0.06f);
    }

    /// <summary>World position of the muzzle for tracers; falls back to a camera offset.</summary>
    Vector3 MuzzleWorld()
    {
        if (muzzleTip) return muzzleTip.position;
        return cam.transform.position + cam.transform.right * 0.18f - cam.transform.up * 0.08f + cam.transform.forward * 0.4f;
    }

    /// <param name="manual">True when the player pressed reload, so refusals get a message.</param>
    public void StartReload(bool manual = false)
    {
        if (isReloading) return;
        if (currentAmmo >= magSize)
        {
            if (manual) ArenaHUD.Notify("MAG FULL", ArenaHUD.Note.Dim);
            return;
        }
        if (reserveAmmo <= 0)
        {
            if (manual) ArenaHUD.Notify("NO RESERVE AMMO", ArenaHUD.Note.Bad);
            return;
        }
        isReloading = true;
        magOutDone = magInDone = false;
        reloadStartTime = Time.time;
        reloadEndTime = Time.time + Mathf.Max(0.05f, reloadTime);
        SoundManager.ReloadStart();
        WaifuCompanion.OnReload();
        ArenaHUD.Notify("RELOADING", ArenaHUD.Note.Warn);
        OnReloadStart?.Invoke(this);
    }

    void FinishReload()
    {
        int need = magSize - currentAmmo;
        int take = Mathf.Min(need, reserveAmmo);
        currentAmmo += take;
        reserveAmmo -= take;
        isReloading = false;
        magOutDone = magInDone = false;
        SoundManager.ReloadEnd();
        ArenaHUD.Notify(weaponName + " READY", ArenaHUD.Note.Good);
        OnReloadEnd?.Invoke(this);
    }

    public static Weapon Make(Kind k, Transform parent)
    {
        var go = new GameObject("Weapon_" + k);
        go.transform.SetParent(parent, false);
        var w = go.AddComponent<Weapon>();
        w.kind = k;
        // Styloo pack (emission) for all five slots; Destiny GLBs stay as alternates.
        string prefabKey = k switch
        {
            Kind.Rifle => "Weapons/ak47",
            Kind.Carbine => "Weapons/tsuki_carbine",
            Kind.SMG => "Weapons/hanami_smg",
            Kind.Pistol => "Weapons/pew",
            Kind.HandCannon => "Weapons/hawkmoon",
            Kind.Shotgun => "Weapons/sakura_shotgun",
            Kind.Sniper => "Weapons/awp",
            Kind.Bow => "Weapons/sakura_bow",
            Kind.Launcher => "Weapons/lotus_launcher",
            Kind.Swarm => "Weapons/quadrocket",
            _ => "Weapons/pew",
        };
        var prefab = Resources.Load<GameObject>(prefabKey);
        // NOTE: no lament/chaperone fallback — those are swords, not guns.
        // A missing gun GLB gets a neutral grey block, never a melee weapon.
        if (prefab)
        {
            var inst = Object.Instantiate(prefab, go.transform, false);
            inst.name = "WeaponVisual";
            foreach (var c in inst.GetComponentsInChildren<Collider>(true))
            {
                if (Application.isPlaying) Object.Destroy(c);
                else Object.DestroyImmediate(c);
            }
            // ---- LOCAL-space axis detection --------------------------------
            // Renderer.bounds are WORLD-space; GLB roots often carry import
            // rotation, which scrambles world AABB axes and made guns point
            // every which way. Mesh corners are transformed into the visual
            // root's local frame instead, so the measurement is honest.
            Vector3 lo = new Vector3(float.MaxValue, float.MaxValue, float.MaxValue);
            Vector3 hi = new Vector3(float.MinValue, float.MinValue, float.MinValue);
            var rends = inst.GetComponentsInChildren<Renderer>();
            int meshCount = 0;
            foreach (var r in rends)
            {
                var mf = r.GetComponent<MeshFilter>();
                if (!mf || !mf.sharedMesh) continue;
                meshCount++;
                var toRoot = inst.transform.worldToLocalMatrix * r.localToWorldMatrix;
                var mb = mf.sharedMesh.bounds;
                for (int cx = 0; cx < 2; cx++)
                for (int cy = 0; cy < 2; cy++)
                for (int cz = 0; cz < 2; cz++)
                {
                    var p = toRoot.MultiplyPoint3x4(new Vector3(
                        cx == 0 ? mb.min.x : mb.max.x,
                        cy == 0 ? mb.min.y : mb.max.y,
                        cz == 0 ? mb.min.z : mb.max.z));
                    lo = Vector3.Min(lo, p); hi = Vector3.Max(hi, p);
                }
            }
            if (rends.Length > 0)
            {
                // normalize to ~0.7m using the local extents
                var ext = hi - lo;
                float longest = Mathf.Max(ext.x, Mathf.Max(ext.y, ext.z));
                if (longest > 0.01f) inst.transform.localScale = Vector3.one * (0.7f / longest);
            }
            // which local axis is the barrel on, and does it face + or -
            // NOTE: several Destiny/Waifu packs author guns facing −Z (stock +Z),
            // which is why barrels pointed AT the player — −Z is the flip case.
            float exP = hi.x, exN = -lo.x, eyP = hi.y, eyN = -lo.y, ezP = hi.z, ezN = -lo.z;
            float ex = Mathf.Max(exP, exN), ey = Mathf.Max(eyP, eyN), ez = Mathf.Max(ezP, ezN);
            float yaw = 0f, pitch = 0f;
            if (ex >= ey && ex >= ez && ex > ez * 1.05f) yaw = exP >= exN ? -90f : 90f;       // barrel sideways
            else if (ey >= ex && ey >= ez && ey > ez * 1.05f) pitch = eyP >= eyN ? 90f : -90f; // barrel up/down
            else if (ez > ex * 1.05f) yaw = ezN > ezP * 1.03f ? 180f : 0f;                    // barrel backwards (−Z authors)
            inst.transform.localPosition = Vector3.zero;
            inst.transform.localRotation = Quaternion.Euler(pitch, yaw, 0f);
            Debug.Log("[GUN] " + k + " yaw=" + yaw + " pitch=" + pitch + " ext=" + (hi - lo).ToString("F2") + " meshes=" + meshCount);

            // muzzle anchor at the barrel tip (measured AFTER the corrective rotation)
            if (rends.Length > 0)
            {
                Bounds bb = rends[0].bounds;
                foreach (var r in rends) bb.Encapsulate(r.bounds);
                var tip = new GameObject("MuzzleTip");
                tip.transform.SetParent(go.transform, false);
                tip.transform.position = new Vector3(bb.center.x, bb.center.y, bb.max.z);
                w.muzzleTip = tip.transform;
            }
        }
        else
        {
            var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var col = cube.GetComponent<Collider>();
            if (col)
            {
                if (Application.isPlaying) Object.Destroy(col);
                else Object.DestroyImmediate(col);
            }
            cube.transform.SetParent(go.transform, false);
        }
        switch (k)
        {
            case Kind.Rifle:
                w.weaponName = "MA5K";
                w.damage = 22; w.magSize = 36; w.reserveAmmo = 144; w.fireRate = 0.09f;
                w.reloadTime = 1.15f; w.automatic = true; w.pellets = 1;
                w.spreadHip = 0.9f; w.spreadAds = 0.10f; w.recoilPitch = 0.5f;
                go.transform.localPosition = new Vector3(0.28f, -0.22f, 0.55f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
            case Kind.Carbine:
                w.weaponName = "TSUKI-47";
                w.damage = 26; w.magSize = 30; w.reserveAmmo = 120; w.fireRate = 0.1f;
                w.reloadTime = 1.6f; w.automatic = true; w.pellets = 1;
                w.spreadHip = 0.7f; w.spreadAds = 0.08f; w.recoilPitch = 0.45f;
                go.transform.localPosition = new Vector3(0.28f, -0.22f, 0.56f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
            case Kind.SMG:
                w.weaponName = "HANAMI SMG";
                w.damage = 13; w.magSize = 40; w.reserveAmmo = 160; w.fireRate = 0.075f;
                w.reloadTime = 1.3f; w.automatic = true; w.pellets = 1;
                w.spreadHip = 1.7f; w.spreadAds = 0.30f; w.recoilPitch = 0.28f;
                go.transform.localPosition = new Vector3(0.28f, -0.22f, 0.52f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
            case Kind.Shotgun:
                w.weaponName = "SAKURA SCATTERGUN";
                w.damage = 13; w.magSize = 6; w.reserveAmmo = 30; w.fireRate = 0.62f;
                w.reloadTime = 1.8f; w.automatic = false; w.pellets = 8;
                w.spreadHip = 3.8f; w.spreadAds = 1.4f; w.recoilPitch = 1.6f;
                w.range = 42f; w.falloffStart = 8f; w.falloffEnd = 28f;
                go.transform.localPosition = new Vector3(0.3f, -0.24f, 0.5f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
            case Kind.Pistol:
                w.weaponName = "NOIR SIDEARM";
                w.damage = 40; w.magSize = 15; w.reserveAmmo = 60; w.fireRate = 0.2f;
                w.reloadTime = 1.1f; w.automatic = false; w.pellets = 1;
                w.spreadHip = 0.7f; w.spreadAds = 0.04f; w.recoilPitch = 1.2f;
                go.transform.localPosition = new Vector3(0.26f, -0.2f, 0.5f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
            case Kind.HandCannon:
                w.weaponName = "HAWKMOON";
                w.damage = 72; w.magSize = 8; w.reserveAmmo = 40; w.fireRate = 0.26f;
                w.reloadTime = 1.4f; w.automatic = false; w.pellets = 1;
                w.spreadHip = 0.9f; w.spreadAds = 0.05f; w.recoilPitch = 1.7f;
                w.range = 120f; w.falloffStart = 30f; w.falloffEnd = 90f;
                go.transform.localPosition = new Vector3(0.26f, -0.2f, 0.5f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
            case Kind.Sniper:
                w.weaponName = "SRS99";
                w.damage = 90; w.magSize = 4; w.reserveAmmo = 16; w.fireRate = 0.85f;
                w.reloadTime = 2.1f; w.automatic = false; w.pellets = 1;
                w.spreadHip = 1.2f; w.spreadAds = 0.01f; w.recoilPitch = 1.8f;
                w.range = 280f; w.falloffStart = 80f; w.falloffEnd = 220f;
                w.adsFovOverride = 22f;   // real scope
                go.transform.localPosition = new Vector3(0.26f, -0.2f, 0.62f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
            case Kind.Bow:
                w.weaponName = "HANAMI LONGBOW";
                w.damage = 95; w.magSize = 12; w.reserveAmmo = 48; w.fireRate = 0.55f;
                w.reloadTime = 1.2f; w.automatic = false; w.pellets = 1;
                w.spreadHip = 0.5f; w.spreadAds = 0.01f; w.recoilPitch = 0.8f;
                w.range = 220f; w.falloffStart = 60f; w.falloffEnd = 160f;
                w.adsFovOverride = 42f;   // archer focus
                go.transform.localPosition = new Vector3(0.24f, -0.2f, 0.48f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
            case Kind.Launcher:
                w.weaponName = "CRIMSON LOTUS";
                w.damage = 130; w.magSize = 3; w.reserveAmmo = 12; w.fireRate = 1.05f;
                w.reloadTime = 2.2f; w.automatic = false; w.pellets = 1;
                w.spreadHip = 1.2f; w.spreadAds = 0.35f; w.recoilPitch = 2.4f;
                w.range = 160f; w.falloffStart = 120f; w.falloffEnd = 160f;
                go.transform.localPosition = new Vector3(0.3f, -0.24f, 0.55f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
            case Kind.Swarm:
                w.weaponName = "HANABI SWARM";
                w.damage = 55; w.magSize = 4; w.reserveAmmo = 16; w.fireRate = 0.9f;
                w.reloadTime = 2f; w.automatic = false; w.pellets = 4;
                w.spreadHip = 2.5f; w.spreadAds = 1.1f; w.recoilPitch = 1.9f;
                w.range = 140f; w.falloffStart = 100f; w.falloffEnd = 140f;
                go.transform.localPosition = new Vector3(0.3f, -0.24f, 0.54f);
                go.transform.localRotation = Quaternion.identity;   // model yaw baked into the visual
                break;
        }
        // Tint only when we fell back to a cube (no GLB visual)
        if (go.transform.childCount <= 1)
        {
            Color tint = k == Kind.Shotgun ? new Color(0.28f, 0.12f, 0.08f)
                : k == Kind.Sniper ? new Color(0.08f, 0.12f, 0.16f)
                : k == Kind.Pistol ? new Color(0.16f, 0.18f, 0.24f)
                : new Color(0.18f, 0.2f, 0.22f);
            Tint(go, tint);
        }
        w.currentAmmo = w.magSize;
        w.restLocal = go.transform.localPosition;
        w.baseRot = go.transform.localRotation;
        return w;
    }

    static void Tint(GameObject go, Color c)
    {
        var r = go.GetComponent<Renderer>();
        if (!r) return;
        r.material = RuntimeAssets.LitMaterial(c, 0.15f);
    }

    public event System.Action<Weapon> OnFired;
    public event System.Action<Weapon> OnReloadStart;
    public event System.Action<Weapon> OnReloadEnd;
}
