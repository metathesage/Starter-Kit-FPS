using UnityEngine;

/// <summary>
/// Halo Infinite-style grappling hook: LB fires a ray (~24m) at whatever's
/// ahead; you get yanked to the point with a smooth pull and a visible rope
/// while attached. Detaches on arrival, jump, or firing.
/// </summary>
public class Grapple : MonoBehaviour
{
    public float maxRange = 24f;
    public float pullSpeed = 30f;
    public float cooldown = 3.5f;

    public bool Attached { get; private set; }
    public Vector3 Point { get; private set; }

    float readyAt;
    LineRenderer rope;
    CharacterController cc;
    PlayerController pc;

    public bool Ready => Time.time >= readyAt;

    public void Fire()
    {
        if (!Ready || Attached) return;
        var cam = Camera.main;
        if (!cam) return;
        if (Physics.Raycast(cam.transform.position, cam.transform.forward, out var hit, maxRange, ~0, QueryTriggerInteraction.Ignore))
        {
            Point = hit.point;
            Attached = true;
            readyAt = Time.time + cooldown;
            EnsureRope();
        }
    }

    public void Detach()
    {
        Attached = false;
        if (rope) rope.enabled = false;
    }

    public void Tick()
    {
        if (!Attached) return;
        if (!rope) EnsureRope();
        Vector3 hand = transform.position + Vector3.up * 1.5f;
        rope.SetPosition(0, hand);
        rope.SetPosition(1, Point);
        rope.enabled = true;

        Vector3 to = Point - transform.position;
        float d = to.magnitude;
        if (d < 1.6f || GameInput.FireHeld || GameInput.JumpPressed)
        {
            Detach();
            return;
        }
        // steer the CharacterController toward the anchor at pull speed
        if (!cc) cc = GetComponent<CharacterController>();
        if (!pc) pc = GetComponent<PlayerController>();
        if (cc && pc) pc.ExternalPull(to.normalized * pullSpeed);
    }

    void EnsureRope()
    {
        if (rope) return;
        var go = new GameObject("GrappleRope");
        go.transform.SetParent(transform, false);
        rope = go.AddComponent<LineRenderer>();
        rope.positionCount = 2;
        rope.startWidth = 0.03f;
        rope.endWidth = 0.012f;
        rope.material = new Material(RuntimeAssets.Sprite);
        rope.startColor = new Color(0f, 0.95f, 1f, 0.9f);
        rope.endColor = new Color(0f, 0.95f, 1f, 0.2f);
    }
}
