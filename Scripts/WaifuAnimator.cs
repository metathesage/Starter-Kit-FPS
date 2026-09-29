using UnityEngine;

/// <summary>
/// Thin state machine over a live UalRig retarget: idle / run / sprint / shoot
/// / death. The rig's shoot one-shot wins until it expires; death latches.
/// Move() + Pump() once per frame from the owner.
/// </summary>
public class WaifuAnimator
{
    readonly UalRig rig;
    string moveState = "idle";
    string current;
    bool dying;

    public bool Ok => rig != null && rig.Ok;

    public WaifuAnimator(GameObject rigRoot)
    {
        rig = UalRig.Create(rigRoot);
    }

    /// <summary>Set the locomotion state; the shoot one-shot wins until it expires.</summary>
    public void Move(string state)
    {
        moveState = state;
    }

    public void Shoot()
    {
        if (!Ok || dying || !rig.Has("shoot")) return;
        rig.Shoot();
    }

    public void Die()
    {
        if (!Ok || dying) return;
        dying = true;
        rig.MarkDead();
    }

    public void Reset()
    {
        dying = false;
        current = null;
    }

    /// <summary>Advance + pose the rig. Call once per frame from the owner.</summary>
    public void Pump()
    {
        if (!Ok) return;
        string want = dying && rig.Has("death") ? "death"
            : rig.Shooting && rig.Has("shoot") ? "shoot"
            : rig.Has(moveState) ? moveState : "idle";
        if (want != current)
        {
            rig.Play(want, 0.22f);
            current = want;
        }
        rig.Tick(Time.deltaTime);
        rig.Pose();
    }
}
