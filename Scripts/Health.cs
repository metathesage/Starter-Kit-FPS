using UnityEngine;

/// <summary>
/// Halo-style shields over health with delayed regen. Player and bots share this.
/// </summary>
public class Health : MonoBehaviour
{
    [Header("Vitals")]
    public float maxHealth = 100f;
    public float health = 100f;
    public float maxShield = 100f;
    public float shield = 100f;
    public float shieldRegenDelay = 3f;
    public float shieldRegenRate = 38f;
    public bool isPlayer;

    /// <summary>Outgoing damage scale (Damage Boost power-up). Applied in TakeDamage
    /// against the attacker, so bullets AND grenades benefit from one switch.</summary>
    public float damageMultiplier = 1f;

    float lastDamageTime;
    float invulnUntil;
    bool dead;
    bool shieldWasFull = true;
    bool lowWarned;

    void Update()
    {
        if (dead) return;
        float dt = Time.deltaTime;
        if (shield < maxShield && Time.time - lastDamageTime > shieldRegenDelay)
        {
            bool wasEmpty = shield <= 0.5f;
            shield = Mathf.Min(maxShield, shield + shieldRegenRate * dt);
            // Halo-style recharge-complete chirp when the bar refills
            if (isPlayer && wasEmpty && shield >= maxShield - 0.5f) { SoundManager.ShieldReady(); lowWarned = false; shieldWasFull = true; }
        }

        // bot buff expiry (the player's buffs expire in PlayerController)
        if (!isPlayer)
        {
            if (maxShield > 100.5f) { buffShield += dt; if (buffShield >= 22f) { maxShield = 100f; buffShield = 0f; } } else buffShield = 0f;
            if (damageMultiplier > 1.01f) { buffDmg += dt; if (buffDmg >= 20f) { damageMultiplier = 1f; buffDmg = 0f; } } else buffDmg = 0f;
        }
    }
    float buffShield, buffDmg;

    public void PulseInvuln(float seconds) => invulnUntil = Time.time + seconds;

    public void TakeDamage(float dmg, Vector3 hitPoint, Health from = null)
    {
        if (dead || Time.time < invulnUntil) return;
        if (from != null && from.damageMultiplier != 1f) dmg *= from.damageMultiplier;   // Damage Boost
        lastDamageTime = Time.time;
        lastHitBy = from;
        float beforeShield = shield;
        if (shield >= dmg) shield -= dmg;
        else
        {
            dmg -= shield;
            shield = 0f;
            health -= dmg;
            if (beforeShield > 0f && shield <= 0f) SoundManager.ShieldBreak();
            if (health <= 0f) { health = 0f; Die(); }
        }
        if (isPlayer)
        {
            // shield hit blip (only when it actually ate shield), low warning once per drop
            if (beforeShield > 0f && shield > 0f) SoundManager.ShieldHit();
            if (shield <= 0.5f && !lowWarned) { SoundManager.ShieldLow(); lowWarned = true; }
            shieldWasFull = shield > maxShield * 0.99f;
        }
        OnHealthChanged?.Invoke(this);
        if (isPlayer)
        {
            FeelDirector.Pulse(0.28f);
            ArenaHUD.DamageFlash();
            if (health < 30f) WaifuCompanion.OnLowHealth();
        }
    }

    Vector3 lastHitFrom;
    Health lastHitBy;

    void Die()
    {
        dead = true;
        OnDeath?.Invoke(this);
        RumblePit.FeedKill(this, lastHitBy);   // FFA scoreboard + kill feed
        if (isPlayer) WaifuCompanion.Say("Spartan down. I have your drop. Stay with me.");
    }

    public void Revive(Vector3 respawnAt)
    {
        dead = false;
        health = maxHealth;
        shield = maxShield;
        var cc = GetComponent<CharacterController>();
        if (cc) { cc.enabled = false; transform.position = respawnAt; cc.enabled = true; }
        else transform.position = respawnAt;
        OnRevive?.Invoke(this);
        OnHealthChanged?.Invoke(this);
    }

    public bool IsDead => dead;
    public event System.Action<Health> OnHealthChanged;
    public event System.Action<Health> OnDeath;
    public event System.Action<Health> OnRevive;
}
