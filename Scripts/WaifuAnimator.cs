using UnityEngine;

/// <summary>
/// Waifu locomotion state machine — TWO engines, baked clips first:
///   1. BAKED (production): editor-baked legacy clips (Tools → Waifu Halo →
///      Bake Waifu Animations) played by a plain Animation component.
///      Deterministic, zero runtime sampling, works identically everywhere.
///   2. LIVE (fallback): the UalRig runtime retarget, if no baked clips exist.
/// Move() + Pump() once per frame from the owner.
/// </summary>
public class WaifuAnimator
{
    // baked clip names (shared with WaifuBakeMenu)
    public const string IdleClip = "NW_Idle_Loop";
    public const string JogClip = "NW_Jog_Loop";
    public const string SprintClip = "NW_Sprint_Loop";
    public const string ShootClip = "NW_Shoot";
    public const string DeathClip = "NW_Death";

    // ---- engine 1: baked ----
    Animation anim;
    string currentBaked;
    bool bakedMode;

    // ---- engine 2: live retarget fallback ----
    readonly UalRig rig;
    string moveStateRaw = "idle";
    string currentLive;
    bool dying;
    float shootUntil;

    public bool Ok => bakedMode || (rig != null && rig.Ok);

    public WaifuAnimator(GameObject rigRoot, string rigKey)
    {
        // 1) baked clips for THIS rig (clip names start with the rig's short name)
        string shortName = rigKey.Substring(rigKey.LastIndexOf('/') + 1);
        if (shortName.Length > 18) shortName = shortName.Substring(0, 18);
        var all = Resources.LoadAll<AnimationClip>("Animation/Baked");
        var mine = new System.Collections.Generic.List<AnimationClip>();
        if (all != null)
            foreach (var c in all)
                if (c.name.StartsWith(shortName)) mine.Add(c);

        if (mine.Count >= 3)
        {
            anim = rigRoot.GetComponent<Animation>();
            if (!anim) anim = rigRoot.AddComponent<Animation>();
            foreach (var a in rigRoot.GetComponentsInChildren<Animator>(true)) a.enabled = false;
            anim.playAutomatically = false;
            foreach (var c in mine)
            {
                c.legacy = true;
                c.wrapMode = c.name.Contains("Loop") ? WrapMode.Loop : WrapMode.ClampForever;
                // register under the bare state name (strip the rig prefix):
                // "kasumi_tactical_sa_NW_Idle_Loop" → "NW_Idle_Loop"
                anim.AddClip(c, c.name.Substring(shortName.Length));
            }
            anim.CrossFade(IdleClip, 0.1f);
            currentBaked = IdleClip;
            bakedMode = true;
            Debug.Log("[WAIFU] baked animation engine on " + rigRoot.name + " (" + mine.Count + " clips)");
            return;
        }

        // 2) live retarget fallback
        rig = UalRig.Create(rigRoot);
        if (rig != null && rig.Ok)
            Debug.Log("[WAIFU] live retarget fallback on " + rigRoot.name);
    }

    /// <summary>Set the locomotion state: "idle" / "run" / "sprint".</summary>
    public void Move(string state) => moveStateRaw = state;

    public void Shoot()
    {
        shootUntil = Time.time + 0.45f;
        if (bakedMode && anim && anim.GetClip(ShootClip) != null && currentBaked != ShootClip)
        {
            // restart the one-shot cleanly
            anim.Stop(ShootClip);
            anim.CrossFade(ShootClip, 0.08f);
            currentBaked = ShootClip;
        }
        else if (rig != null && rig.Ok) rig.Shoot();
    }

    public void Die()
    {
        dying = true;
        if (bakedMode && anim && anim.GetClip(DeathClip) != null)
        {
            anim.CrossFade(DeathClip, 0.12f);
            currentBaked = DeathClip;
        }
        else if (rig != null && rig.Ok) rig.MarkDead();
    }

    public void Reset()
    {
        dying = false;
        currentBaked = null;
        currentLive = null;
        shootUntil = 0f;
    }

    string Loco()
    {
        var t = Time.time;
        return t < shootUntil ? ShootClip
            : moveStateRaw == "sprint" && Has(SprintClip) ? SprintClip
            : moveStateRaw == "run" && Has(JogClip) ? JogClip
            : IdleClip;
    }

    bool Has(string clip) => bakedMode ? anim && anim.GetClip(clip) != null : rig != null && rig.Ok && rig.Has(StateKey(clip));

    static string StateKey(string clip) =>
        clip == JogClip ? "run" : clip == SprintClip ? "sprint" : clip == ShootClip ? "shoot" : clip == DeathClip ? "death" : "idle";

    /// <summary>Advance + pose. Call once per frame from the owner.</summary>
    public void Pump()
    {
        if (bakedMode)
        {
            // the Animation component advances itself; we just switch states
            if (dying) return;   // death clamps on its last frame
            string want = Loco();
            if (want != currentBaked && anim.GetClip(want) != null)
            {
                anim.CrossFade(want, 0.22f);
                currentBaked = want;
            }
            return;
        }

        if (rig == null || !rig.Ok) return;
        string live = dying && rig.Has("death") ? "death"
            : Time.time < shootUntil && rig.Has("shoot") ? "shoot"
            : rig.Has(moveStateRaw) ? moveStateRaw : "idle";
        if (live != currentLive)
        {
            rig.Play(live, 0.22f);
            currentLive = live;
        }
        rig.Tick(Time.deltaTime);
        rig.Pose();
    }
}
