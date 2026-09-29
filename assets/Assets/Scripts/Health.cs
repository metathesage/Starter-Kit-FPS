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

    float lastDamageTime;
    float invulnUntil;
    bool dead;

    void Update()
    {
        if (dead) return;
        if (shield < maxShield && Time.time - lastDamageTime > shieldRegenDelay)
            shield = Mathf.Min(maxShield, shield + shieldRegenRate * Time.deltaTime);
    }

    public void PulseInvuln(float seconds) => invulnUntil = Time.time + seconds;

    public void TakeDamage(float dmg, Vector3 hitPoint)
    {
        if (dead || Time.time < invulnUntil) return;
        lastDamageTime = Time.time;
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
        OnHealthChanged?.Invoke(this);
        if (isPlayer)
        {
            FeelDirector.Pulse(0.28f);
            ArenaHUD.DamageFlash();
            if (health < 30f) WaifuCompanion.OnLowHealth();
        }
    }

    void Die()
    {
        dead = true;
        OnDeath?.Invoke(this);
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
