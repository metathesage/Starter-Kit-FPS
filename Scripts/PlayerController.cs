using UnityEngine;

/// <summary>
/// FPS controller. Pad look uses slight Apex-style assist (friction + magnetism).
/// Dash is LS click / Left Ctrl / V.
/// </summary>
[RequireComponent(typeof(CharacterController))]
public class PlayerController : MonoBehaviour
{
    public static PlayerController Instance { get; private set; }

    [Header("Movement")]
    public float walkSpeed = 6.2f;
    public float sprintSpeed = 10.4f;
    public float jumpForce = 7.2f;
    public float gravity = -22f;
    public float coyoteTime = 0.11f;
    public float jumpBuffer = 0.12f;

    [Header("Dash")]
    public float dashSpeed = 32f;
    public float dashTime = 0.15f;
    public float dashCooldown = 1.05f;
    public float dashInvuln = 0.12f;

    [Header("Look")]
    public Transform cameraTransform;
    public float padLookSpeed = 140f;
    public float adsFov = 52f;
    public float hipFov = 78f;

    [Header("Recoil")]
    public float recoilSnap = 26f;      // how fast the kick reaches the view
    public float recoilRecover = 8f;    // how fast the view settles back

    [Header("Aim assist (pad only, Apex-like, slight)")]
    public float aaHipCone = 5.8f;
    public float aaAdsCone = 4.2f;
    public float aaMagnetHip = 1.55f;   // deg/sec extra yaw
    public float aaMagnetAds = 2.35f;
    public float aaFrictionHip = 0.78f; // stick scale on target
    public float aaFrictionAds = 0.62f;
    public float aaPitchScale = 0.38f;  // weaker vertical, like Apex
    public float aaMaxRange = 72f;

    CharacterController cc;
    Health hp;
    float pitch;
    Vector3 velocity;
    float coyote;
    float buffer;
    Camera cam;
    float fovVel;
    float dashLeft;
    float dashReadyAt;
    Vector3 dashVel;
    float dashFovKick;
    float kickPitch, kickYaw;             // recoil currently shown in the view
    float kickPitchTarget, kickYawTarget; // recoil still owed, decays to zero

    public float DashReady01 => dashCooldown <= 0.01f ? 1f : Mathf.Clamp01(1f - (dashReadyAt - Time.time) / dashCooldown);
    public bool Dashing => dashLeft > 0f;

    /// <summary>Degrees of view kick still settling; HUD uses it to bloom the reticle.</summary>
    public float KickAmount => Mathf.Abs(kickPitch) + Mathf.Abs(kickYaw);

    /// <summary>Weapons push the view here. Fully recovers, so aim never drifts.</summary>
    public void AddRecoil(float pitchDeg, float yawDeg)
    {
        kickPitchTarget += pitchDeg;
        kickYawTarget += yawDeg;
    }

    void Awake() => Instance = this;

    void Start()
    {
        cc = GetComponent<CharacterController>();
        hp = GetComponent<Health>();
        if (!cameraTransform && Camera.main) cameraTransform = Camera.main.transform;
        cam = cameraTransform ? cameraTransform.GetComponent<Camera>() : Camera.main;
        if (cam) hipFov = cam.fieldOfView;
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
    }

    void Update()
    {
        if (OptionsMenu.IsOpen || ArenaDirector.MatchOver) return;
        LookTick();
        MoveTick();
        DashTick();
        FovTick();
        BobTick();
        GearTick();
        Announcer.Tick();

        // power buffs expire
        if (overshieldUntil > 0f && Time.time > overshieldUntil && hp) { hp.maxShield = 100f; hp.shield = Mathf.Min(hp.shield, 100f); overshieldUntil = 0f; }
        if (boostUntil > 0f && Time.time > boostUntil) boostUntil = 0f;
        if (speedUntil > 0f && Time.time > speedUntil) speedUntil = 0f;
#if UNITY_WEBGL && !UNITY_EDITOR
        // one-shot playtest telemetry (browser console)
        if (!logged && Time.time > 2f)
        {
            logged = true;
            Debug.Log("[PC] look: pitch += my (user-verified sign). invertY=" + SettingsManager.invertY + " sens=" + SettingsManager.mouseSensitivity);
        }
#endif
    }
    bool logged;
    float assistYaw;   // smoothed soft-snap yaw from the aim assist

    // ---- Halo gear: grenades + grapple + power buffs ----
    Grenade grappleRefUnused;   // (type anchor only)
    Grapple grapple;
    int grenadeCount = 2;
    float grenadeReadyAt;
    float overshieldUntil, boostUntil, speedUntil;

    public int Grenades => grenadeCount;
    public bool GrappleAttached => grapple != null && grapple.Attached;
    public bool GrappleReady => grapple != null && grapple.Ready;

    /// <summary>External movement from gear (grapple pull). Consumed in MoveTick.</summary>
    public void ExternalPull(Vector3 v) => pullVec += v;
    Vector3 pullVec;

    public void ThrowGrenade()
    {
        if (grenadeCount <= 0 || Time.time < grenadeReadyAt || !cameraTransform) return;
        grenadeCount--;
        grenadeReadyAt = Time.time + 0.7f;
        Vector3 origin = cameraTransform.position + cameraTransform.forward * 0.5f;
        Grenade.Throw(origin, cameraTransform.forward, hp);
        SoundManager.Jump();   // throw grunt placeholder until a real clip lands
    }

    public void FireGrapple()
    {
        if (grapple == null) grapple = GetComponent<Grapple>();
        grapple.Fire();
    }

    public void Overshield()
    {
        overshieldUntil = Time.time + 22f;
        if (hp) { hp.maxShield = 140f; hp.shield = 140f; }
    }

    public void DamageBoost() => boostUntil = Time.time + 20f;
    public void SpeedBoost() => speedUntil = Time.time + 18f;
    public bool DamageBoosted => Time.time < boostUntil;

    /// <summary>Halo respawn rule: two fresh frags, buffs and grapple state wiped.</summary>
    public void ResetGearOnRespawn()
    {
        grenadeCount = 2;
        grenadeReadyAt = 0f;
        overshieldUntil = boostUntil = speedUntil = 0f;
        if (hp) { hp.maxShield = 100f; hp.shield = hp.maxShield; }
        if (grapple != null && grapple.Attached) grapple.Detach();
    }

    void LookTick()
    {
        float sens = SettingsManager.mouseSensitivity;
        // Mouse deltas (InputManager axes) are raw counts at sensitivity 1.0; the
        // settings slider is a direct 1.0-10.0 multiplier. Default 3.0 ≈ FPS-standard.
        bool ads = GameInput.AimHeld;
        AimAssist.Scan(cameraTransform, ads);   // pick assist target before blending
        float mx = GameInput.MouseLookX * sens;
        // PLAYER REPORT: old sign felt inverted. Mouse Y is up-positive here,
        // so non-inverted = pitch += my. Esc → Invert Y flips it.
        float my = GameInput.MouseLookY * sens * (SettingsManager.invertY ? -1f : 1f);

        // FIX: right stick was inverted on Y in WebGL (jslib sends -Pad[4] already,
        // and joy axis 4 is already inverted in InputManager). Unify: stick up = look up.
        Vector2 stick = GameInput.LookStick;
        stick.y = -stick.y;
        if (SettingsManager.invertY) stick.y = -stick.y;
        float adsScale = GameInput.AimHeld ? 0.48f : 1f;
        float stickMx = stick.x * padLookSpeed * adsScale * Time.deltaTime * (sens * 0.5f + 0.5f);
        float stickMy = stick.y * padLookSpeed * adsScale * Time.deltaTime * (sens * 0.5f + 0.5f);

        if (GameInput.UsingGamepad && SettingsManager.aimAssistStrength > 0)
            ApplyApexAssist(ref stickMx, ref stickMy);

        mx += stickMx;
        my += stickMy;

        // universal assist: friction + magnetism on the combined look frame
        AimAssist.Apply(ref mx, ref my, ads, cameraTransform);

        pitch = Mathf.Clamp(pitch + my, -88f, 88f);

        // COD-style soft snap: while aiming down sights, a thin slice of yaw
        // eases the view toward the assist target. Mouse stays raw otherwise.
        if (SettingsManager.aimAssistStrength > 0 && AimAssist.HasTarget && ads && cameraTransform)
        {
            Vector3 to = AimAssist.TargetPos - cameraTransform.position;
            Vector3 local = Quaternion.Inverse(cameraTransform.rotation) * to.normalized;
            float yawErr = Mathf.Atan2(local.x, local.z) * Mathf.Rad2Deg;
            float desired = Mathf.Abs(yawErr) < 8f
                ? Mathf.Clamp(yawErr, -5f, 5f) * 0.18f * SettingsManager.aimAssistStrength
                : 0f;
            assistYaw = Mathf.Lerp(assistYaw, desired, 1f - Mathf.Exp(-10f * Time.deltaTime));
        }
        else
        {
            assistYaw = Mathf.Lerp(assistYaw, 0f, 1f - Mathf.Exp(-10f * Time.deltaTime));
        }
        mx += assistYaw;

        // Recoil: the owed kick decays to zero while the view chases it, so the
        // muzzle climbs hard and then walks back down to where you were aiming.
        float rec = 1f - Mathf.Exp(-recoilRecover * Time.deltaTime);
        float snap = 1f - Mathf.Exp(-recoilSnap * Time.deltaTime);
        kickPitchTarget = Mathf.Lerp(kickPitchTarget, 0f, rec);
        kickYawTarget = Mathf.Lerp(kickYawTarget, 0f, rec);
        float yawWas = kickYaw;
        kickPitch = Mathf.Lerp(kickPitch, kickPitchTarget, snap);
        kickYaw = Mathf.Lerp(kickYaw, kickYawTarget, snap);

        transform.Rotate(0f, mx + (kickYaw - yawWas), 0f);
        if (cameraTransform)
            cameraTransform.localEulerAngles = new Vector3(Mathf.Clamp(pitch - kickPitch, -89f, 89f), 0f, 0f);
    }

    void ApplyApexAssist(ref float mx, ref float my)
    {
        if (!cameraTransform) return;
        var bots = ArenaDirector.Bots;
        if (bots == null) return;

        bool ads = GameInput.AimHeld;
        float cone = ads ? aaAdsCone : aaHipCone;
        Vector3 origin = cameraTransform.position;
        Vector3 fwd = cameraTransform.forward;

        Transform best = null;
        float bestAng = cone;
        Vector3 bestTo = Vector3.zero;

        foreach (var t in bots)
        {
            if (!t) continue;
            var h = t.GetComponent<Health>();
            if (h && h.IsDead) continue;
            Vector3 to = (t.position + Vector3.up * 1.42f) - origin;
            float dist = to.magnitude;
            if (dist < 2.4f || dist > aaMaxRange) continue;
            float ang = Vector3.Angle(fwd, to);
            if (ang >= bestAng) continue;
            if (Physics.Raycast(origin, to.normalized, out RaycastHit hit, dist, ~0, QueryTriggerInteraction.Ignore)
                && hit.transform.root != t.root && !hit.transform.root.CompareTag("Player"))
                continue;
            bestAng = ang;
            best = t;
            bestTo = to;
        }
        if (!best) return;

        float closeness = 1f - Mathf.Clamp01(bestAng / cone);
        float friction = Mathf.Lerp(1f, ads ? aaFrictionAds : aaFrictionHip, closeness * closeness);
        mx *= friction;
        my *= friction;

        bool tracking = GameInput.LookStick.sqrMagnitude > 0.01f || GameInput.FireHeld;
        if (!tracking) return;

        Vector3 dir = bestTo.normalized;
        Vector3 local = transform.InverseTransformDirection(dir);
        float yawErr = Mathf.Atan2(local.x, local.z) * Mathf.Rad2Deg;
        float pitchErr = Mathf.Asin(Mathf.Clamp(local.y, -1f, 1f)) * Mathf.Rad2Deg;

        float magnet = ads ? aaMagnetAds : aaMagnetHip;
        float rangeFade = Mathf.Clamp01(1.1f - bestTo.magnitude / aaMaxRange);
        float onTargetCut = Mathf.Clamp01(bestAng / 0.55f);
        float str = magnet * closeness * rangeFade * (0.35f + 0.65f * onTargetCut) * Time.deltaTime;
        mx += Mathf.Sign(yawErr) * Mathf.Min(Mathf.Abs(yawErr), str);
        my += Mathf.Sign(pitchErr) * Mathf.Min(Mathf.Abs(pitchErr), str * aaPitchScale);
    }

    void MoveTick()
    {
        Vector2 m = GameInput.Move;
        Vector3 dir = (transform.right * m.x + transform.forward * m.y);
        if (dir.sqrMagnitude > 1f) dir.Normalize();
        float speed = GameInput.SprintHeld && !GameInput.AimHeld ? sprintSpeed : walkSpeed;
        if (GameInput.AimHeld) speed *= 0.72f;
        if (Time.time < speedUntil) speed *= 1.35f;   // speed boost power-up
        Vector3 move = dir * speed;
        if (pullVec != Vector3.zero)
        {
            move += pullVec;
            pullVec = Vector3.zero;
        }

        bool grounded = cc.isGrounded;
        coyote = grounded ? coyoteTime : coyote - Time.deltaTime;
        if (GameInput.JumpPressed) buffer = jumpBuffer;
        else buffer -= Time.deltaTime;

        if (grounded && velocity.y < 0f) velocity.y = -2f;
        if (buffer > 0f && coyote > 0f && dashLeft <= 0f)
        {
            velocity.y = jumpForce;
            buffer = 0f;
            coyote = 0f;
            SoundManager.Jump();
        }
        if (dashLeft <= 0f)
        {
            velocity.y += gravity * Time.deltaTime;
            move.y = velocity.y;
            cc.Move(move * Time.deltaTime);
        }
        else
            velocity.y = 0f;
    }

    /// <summary>Grenade + grapple input handling (Halo pad layout / PC keys).</summary>
    void GearTick()
    {
        if (GameInput.GrenadePressed) ThrowGrenade();
        if (GameInput.GrapplePressed) FireGrapple();
    }

    void DashTick()
    {
        if (GameInput.DashPressed && Time.time >= dashReadyAt)
        {
            Vector2 m = GameInput.Move;
            Vector3 dir = (transform.right * m.x + transform.forward * m.y);
            dir.y = 0f;
            if (dir.sqrMagnitude < 0.04f) dir = transform.forward;
            dir.y = 0f;
            dir.Normalize();
            dashVel = dir * dashSpeed;
            dashLeft = dashTime;
            dashReadyAt = Time.time + dashCooldown;
            dashFovKick = 14f;
            if (hp) hp.PulseInvuln(dashInvuln);
            FeelDirector.Pulse(0.32f);
            SoundManager.Dash();
            ArenaHUD.DashFlash();
            SpawnAfterimage(dir);
        }

        if (dashLeft <= 0f) return;
        dashLeft -= Time.deltaTime;
        float u = 1f - Mathf.Exp(-10f * Time.deltaTime);
        dashVel = Vector3.Lerp(dashVel, Vector3.zero, u);
        cc.Move(dashVel * Time.deltaTime);
        if (dashLeft <= 0f) dashVel = Vector3.zero;
    }

    static AfterimageGhost[] pool = new AfterimageGhost[16];
static int poolHead;

    class AfterimageGhost : MonoBehaviour
    {
        public float fade = 1f;
        void Update() => fade -= Time.deltaTime * 6f;
        void OnBecameInvisible() => Destroy(gameObject);
    }

    void SpawnAfterimage(Vector3 dir)
    {
        // Reuse from pool
        AfterimageGhost ghost;
        if (pool[poolHead] != null)
        {
            ghost = pool[poolHead];
            pool[poolHead] = null;
        }
        else
        {
            var go = new GameObject("DashGhost");
            ghost = go.AddComponent<AfterimageGhost>();
            ghost.fade = 0.35f;
        }
        poolHead = (poolHead + 1) % pool.Length;

        ghost.transform.position = transform.position - dir * 0.35f;
        ghost.transform.rotation = transform.rotation;
        ghost.transform.localScale = new Vector3(0.7f, 0.95f, 0.7f);
        var r = ghost.GetComponent<Renderer>();
        // Use a simple unlit fade material; create once if needed
        if (r.sharedMaterial == null || r.sharedMaterial.name.Contains("RuntimeAssets/Fade"))
        {
            var mat = new Material(Shader.Find("UI/Unlit/Color"));
            mat.color = new Color(0.70f, 0.82f, 1f, ghost.fade);
            r.sharedMaterial = mat;
        }
        else
        {
            r.sharedMaterial.color = new Color(0.70f, 0.82f, 1f, ghost.fade);
        }
        // Ghost fades over ~0.16s; OnBecameInvisible handles cleanup
    }

    [Header("View bob")]
    public float bobFreq = 8.5f;
    public float bobAmp = 0.032f;
    float bobPhase;
    float bobBlend;
    Vector3 camBasePos;
    bool camBaseCached;

    /// <summary>Classic FPS walk cycle on the camera — dips on footfalls, calms when still, quiets in ADS.</summary>
    void BobTick()
    {
        if (!cameraTransform) return;
        if (!camBaseCached) { camBasePos = cameraTransform.localPosition; camBaseCached = true; }
        float spd = cc ? new Vector3(cc.velocity.x, 0f, cc.velocity.z).magnitude : 0f;
        float gait = Mathf.Clamp01(spd / walkSpeed);
        bobBlend = Mathf.MoveTowards(bobBlend, gait > 0.05f ? 1f : 0f, Time.deltaTime * 5f);
        if (bobBlend <= 0.001f) return;
        if (gait > 0.05f) bobPhase += Time.deltaTime * bobFreq * (0.6f + gait * 0.8f);
        float adsK = GameInput.AimHeld ? 0.3f : 1f;
        float x = Mathf.Sin(bobPhase) * bobAmp * gait * adsK;
        float y = -Mathf.Abs(Mathf.Cos(bobPhase)) * bobAmp * gait * adsK;
        cameraTransform.localPosition = camBasePos + new Vector3(x * bobBlend, y * bobBlend, 0f);
    }

    void FovTick()
    {
        if (!cam) return;
        hipFov = SettingsManager.fieldOfView;   // live FOV setting
        dashFovKick = Mathf.Lerp(dashFovKick, 0f, 1f - Mathf.Exp(-8f * Time.deltaTime));
        // per-weapon ADS zoom: SRS99 scopes way in, the longbow breathes in a little
        float adsTarget = adsFov;
        var wpn = Weapon.Active;
        if (wpn && wpn.adsFovOverride > 0f) adsTarget = wpn.adsFovOverride;
        float target = (GameInput.AimHeld ? adsTarget : hipFov) + dashFovKick;
        cam.fieldOfView = Mathf.SmoothDamp(cam.fieldOfView, target, ref fovVel, 0.08f);
        AudioDirector.Duck(GameInput.AimHeld);   // music pulls back while you aim
    }
}
