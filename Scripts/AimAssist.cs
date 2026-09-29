using UnityEngine;

/// <summary>
/// Universal aim assist — works for mouse AND gamepad.
///  • Friction: look input slows while the crosshair is over a target.
///  • Magnetism: gentle rotation toward the nearest target inside the aim cone.
///  • Bullet bending: shots within a small radius of a target curve onto it.
/// Strength scales with SettingsManager.aimAssistStrength (0=off .. 2=strong).
/// Purely rotational + per-shot: never fights the player, never aims for you.
/// </summary>
public static class AimAssist
{
    const float ConeDeg = 5.5f;          // half-angle of the assist cone
    const float MaxRange = 80f;
    const float FrictionHip = 0.82f;
    const float FrictionAds = 0.6f;
    const float MagnetHip = 1.3f;        // deg/sec at cone edge... scaled by closeness
    const float MagnetAds = 2.1f;
    const float BendRadius = 1.1f;       // metres a bullet may bend at mid-range

    static Transform best;
    static float bestCloseness;
    static float lastScan;

    /// <summary>Scan for the best assist target near the crosshair. Cheap; runs at 20 Hz.</summary>
    public static void Scan(Transform cam, bool ads)
    {
        if (Time.unscaledTime - lastScan < 0.05f && best != null) return;
        lastScan = Time.unscaledTime;
        best = null;
        bestCloseness = 0f;
        if (SettingsManager.aimAssistStrength <= 0f || cam == null) return;

        var bots = ArenaDirector.Bots;
        if (bots == null) return;

        Vector3 origin = cam.position;
        Vector3 fwd = cam.forward;
        float cone = ConeDeg * (ads ? 0.8f : 1f);

        foreach (var t in bots)
        {
            if (!t) continue;
            var h = t.GetComponent<Health>();
            if (h && h.IsDead) continue;
            Vector3 to = (t.position + Vector3.up * 1.35f) - origin;
            float dist = to.magnitude;
            if (dist < 2f || dist > MaxRange) continue;
            float ang = Vector3.Angle(fwd, to);
            if (ang > cone) continue;
            // line of sight required
            if (Physics.Raycast(origin, to.normalized, out RaycastHit hit, dist, ~0, QueryTriggerInteraction.Ignore)
                && hit.transform.root != t.root) continue;
            float closeness = 1f - ang / cone;
            if (closeness > bestCloseness) { bestCloseness = closeness; best = t; }
        }
    }

    /// <summary>
    /// Rotational assist on a frame of look input. MOUSE input passes through
    /// untouched (friction on a mouse is the classic "aim feels like mud" bug) —
    /// mouse players get only bullet bending. Stick input gets slow + magnetism.
    /// </summary>
    public static void Apply(ref float mx, ref float my, bool ads, Transform cam)
    {
        float s = SettingsManager.aimAssistStrength;
        if (s <= 0f || best == null || cam == null) return;
        float closeness = bestCloseness;

        if (!GameInput.UsingGamepad)
            return;   // raw mouse stays raw — never fight the player's wrist

        // stick: slow slightly over the target, then ease toward it
        float sf = 0.4f + 0.3f * s;
        float fric = Mathf.Lerp(1f, ads ? FrictionAds : FrictionHip, closeness * sf);
        mx *= fric; my *= fric;

        Vector3 to = (best.position + Vector3.up * 1.35f) - cam.position;
        Vector3 local = Quaternion.Inverse(cam.rotation) * to.normalized;
        float yawErr = Mathf.Atan2(local.x, local.z) * Mathf.Rad2Deg;
        float pitchErr = -Mathf.Asin(Mathf.Clamp(local.y, -1f, 1f)) * Mathf.Rad2Deg;
        // LINEAR: pull grows straight with angle off-center (predictable).
        // CLASSIC: front-loaded pull that's strongest dead-center.
        float shape = SettingsManager.aimAssistMode == 1 ? closeness : Mathf.Sqrt(closeness);
        float magnet = (ads ? MagnetAds : MagnetHip) * shape * s * Time.deltaTime;
        mx += Mathf.Clamp(yawErr, -magnet, magnet);
        my += Mathf.Clamp(pitchErr, -magnet * 0.45f, magnet * 0.45f);
    }

    /// <summary>Bend a shot direction slightly onto the assisted target. Returns adjusted dir.</summary>
    public static Vector3 BendShot(Vector3 origin, Vector3 dir, Transform cam)
    {
        float s = SettingsManager.aimAssistStrength;
        if (s <= 0f || best == null) return dir;
        Vector3 to = (best.position + Vector3.up * 1.35f) - origin;
        float dist = to.magnitude;
        if (dist < 2f || dist > MaxRange) return dir;
        float miss = Vector3.Angle(dir, to.normalized);
        // bend only near-misses; falloff with distance. Stronger for stick players.
        float allow = Mathf.Atan2(BendRadius, dist) * Mathf.Rad2Deg * s * (GameInput.UsingGamepad ? 1f : 0.7f);
        if (miss > allow || miss < 0.05f) return dir;
        return Vector3.Slerp(dir, to.normalized, GameInput.UsingGamepad ? 0.85f : 0.6f);
    }

    /// <summary>True when the crosshair is on an assist target (HUD readout).</summary>
    public static bool OnTarget => best != null && bestCloseness > 0.35f;

    /// <summary>A live assist target exists (for the soft-snap pre-pass).</summary>
    public static bool HasTarget => best != null;

    /// <summary>Aim point of the current assist target (chest height).</summary>
    public static Vector3 TargetPos => best ? best.position + Vector3.up * 1.35f : Vector3.zero;
}
