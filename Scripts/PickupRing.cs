using UnityEngine;

/// <summary>
/// Map pickup: spinning pedestal item. Two families —
///   POWER WEAPON (rocket launcher / shotgun / sniper): swaps into your loadout
///   POWER-UP (overshield / damage boost / speed): timed buff with announcer
/// Power weapons are player-only; power-ups are contested — the waifus will
/// sprint for overshields too. Everything respawns on a Halo-style cycle.
/// </summary>
public class PickupRing : MonoBehaviour
{
    public enum Kind { RocketLauncher, Shotgun, Sniper, Overshield, DamageBoost, Speed }
    public Kind kind;

    [Header("Respawn")]
    public float respawnDelay = 30f;   // Halo map-weapons pulse back after ~30s
    bool taken;
    float takenAt;
    Transform root;      // visuals live under root so we can hide/show the whole pedestal
    Collider trigger;

    float spin;
    Transform core;
    Color glow;

    public static void SpawnAll()
    {
        if (GameObject.Find("LockoutMap")) { SpawnLockout(); return; }

        // seeded around the hill so the pit fights over them
        Vector3 c = ArenaDirector.HillPos;
        Spawn(Kind.RocketLauncher, c + new Vector3(11f, 0.4f, 6f));
        Spawn(Kind.Sniper, c + new Vector3(-13f, 0.4f, -8f));
        Spawn(Kind.Shotgun, c + new Vector3(-6f, 0.4f, 14f));
        Spawn(Kind.Overshield, c + new Vector3(4f, 0.4f, -15f));
        Spawn(Kind.DamageBoost, c + new Vector3(16f, 0.4f, -4f));
        Spawn(Kind.Speed, c + new Vector3(-18f, 0.4f, 2f));
    }

    /// <summary>TERMINUS power item layout: each level guards something —
    /// NE tower owns the sniper, skybridge the rockets, bunker the overshield.</summary>
    static void SpawnLockout()
    {
        Spawn(Kind.RocketLauncher, new Vector3(0f, 2.7f, -19f));     // skybridge centre, y2
        Spawn(Kind.Sniper, new Vector3(17f, 3.7f, -14f));            // NE tower top, y3
        Spawn(Kind.Shotgun, new Vector3(-15f, -0.2f, 20f));          // SW pit floor
        Spawn(Kind.Overshield, new Vector3(20f, 2.7f, 19f));         // SE bunker roof, y2
        Spawn(Kind.DamageBoost, new Vector3(-8f, 1.7f, 4f));         // plateau west
        Spawn(Kind.Speed, new Vector3(8f, 1.7f, 4f));                // plateau east
    }

    static void Spawn(Kind k, Vector3 at)
    {
        var go = new GameObject("Pickup_" + k);
        go.transform.position = at;
        var p = go.AddComponent<PickupRing>();
        p.kind = k;
        p.Build();
    }

    void Build()
    {
        glow = kind switch
        {
            Kind.RocketLauncher => new Color(1f, 0.45f, 0.2f),
            Kind.Sniper => new Color(0.55f, 0.9f, 1f),
            Kind.Shotgun => new Color(1f, 0.75f, 0.3f),
            Kind.Overshield => new Color(0.3f, 0.8f, 1f),
            Kind.DamageBoost => new Color(1f, 0.25f, 0.35f),
            _ => new Color(0.7f, 1f, 0.4f),
        };

        // visuals under a child root so Take() can hide the pedestal whole
        root = new GameObject("Visual").transform;
        root.SetParent(transform, false);

        // pedestal ring (torus-ish: flattened cylinder) + floating core
        var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
        Object.Destroy(ring.GetComponent<Collider>());
        ring.transform.SetParent(root, false);
        ring.transform.localScale = new Vector3(0.9f, 0.04f, 0.9f);
        ring.GetComponent<Renderer>().material = RuntimeAssets.LitMaterial(glow * 0.4f, 0.7f);

        core = GameObject.CreatePrimitive(PrimitiveType.Cube).transform;
        Object.Destroy(core.gameObject.GetComponent<Collider>());
        core.SetParent(root, false);
        core.localPosition = new Vector3(0f, 0.55f, 0f);
        core.localScale = Vector3.one * 0.34f;
        core.GetComponent<Renderer>().material = RuntimeAssets.LitMaterial(glow, 1.6f);

        // trigger volume
        trigger = gameObject.AddComponent<SphereCollider>();
        trigger.isTrigger = true;
        ((SphereCollider)trigger).radius = 1.4f;
    }

    void Update()
    {
        // Halo respawn cycle: pedestal goes dark, then pulses back in
        if (taken)
        {
            if (Time.time - takenAt >= respawnDelay)
            {
                taken = false;
                if (root) root.gameObject.SetActive(true);
                trigger.enabled = true;
                ArenaHUD.Beat(kind.ToString().ToUpperInvariant() + " RESPAWNED", ArenaHUD.Note.Info);
                Announcer.Say("Power item respawned");
            }
            return;
        }

        if (!core) return;
        spin += Time.deltaTime * 2.4f;
        core.localRotation = Quaternion.Euler(0f, spin * 57f, 25f);
        core.localPosition = new Vector3(0f, 0.55f + Mathf.Sin(spin) * 0.09f, 0f);
    }

    void OnTriggerEnter(Collider other)
    {
        if (taken) return;
        var hp = other.GetComponentInParent<Health>();
        if (!hp || hp.IsDead) return;

        bool playerTaker = hp.isPlayer;
        bool botTaker = !playerTaker && hp.GetComponent<BotAI>() != null;
        // power weapons are player-only; power-ups are contested turf
        bool wantsWeapon = kind == Kind.RocketLauncher || kind == Kind.Sniper || kind == Kind.Shotgun;
        if (!playerTaker && !(botTaker && !wantsWeapon)) return;

        var pc = hp.GetComponent<PlayerController>();
        var load = other.GetComponentInParent<WeaponLoadout>();

        switch (kind)
        {
            case Kind.Overshield:
                if (pc) { pc.Overshield(); Announcer.Overshield(); }
                else if (hp) { hp.maxShield = 140f; hp.shield = 140f; }   // bot edition
                break;
            case Kind.DamageBoost:
                if (pc) { pc.DamageBoost(); Announcer.DamageBoost(); }
                else if (hp) hp.damageMultiplier = 2f;                    // bot edition
                break;
            case Kind.Speed:
                if (playerTaker) { pc.SpeedBoost(); Announcer.Say("Speed Boost"); }
                break;
            case Kind.RocketLauncher:
                if (load) load.GrantPowerWeapon(Weapon.Kind.Launcher);
                Announcer.RocketUp();
                break;
            case Kind.Sniper:
                if (load) load.GrantPowerWeapon(Weapon.Kind.Sniper);
                Announcer.Say("Sniper Rifle on the map");
                break;
            case Kind.Shotgun:
                if (load) load.GrantPowerWeapon(Weapon.Kind.Shotgun);
                Announcer.Say("Shotgun on the map");
                break;
        }

        if (playerTaker)
        {
            ArenaHUD.Notify(kind.ToString().ToUpperInvariant().Replace("KIND", ""), ArenaHUD.Note.Good);
            ArenaHUD.Beat("PICKUP TAKEN", ArenaHUD.Note.Good);
        }

        // Halo-style: item despawns, pedestal goes dark, respawns on the cycle
        taken = true;
        takenAt = Time.time;
        if (root) root.gameObject.SetActive(false);
        trigger.enabled = false;
    }
}
