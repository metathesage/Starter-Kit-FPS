using UnityEngine;

/// <summary>
/// KIRA-7 combat chatter. Event-driven lines, typewriter, cooldown so she doesn't spam.
/// </summary>
public class WaifuCompanion : MonoBehaviour
{
    public static WaifuCompanion Instance { get; private set; }
    public string display = "WAIFU ARENA. Hill is live. Click LS when you need the cut.";
    public float shownUntil;
    float nextKill, nextHill, nextHp, nextReload;
    string buffer;
    float typeAt;
    int typeIdx;

    void Awake() => Instance = this;

    void Update()
    {
        if (buffer != null && typeIdx < buffer.Length && Time.unscaledTime > typeAt)
        {
            typeIdx++;
            display = buffer.Substring(0, typeIdx);
            typeAt = Time.unscaledTime + 0.012f;
        }
        if (Time.time > shownUntil && display.Length > 0 && Time.timeScale > 0f)
            display = "";
    }

    public static void Say(string line, float hold = 3.4f)
    {
        if (!Instance) return;
        Instance.buffer = line;
        Instance.typeIdx = 0;
        Instance.typeAt = 0f;
        Instance.shownUntil = Time.time + hold;
    }

    public static void OnKill()
    {
        if (!Instance || Time.time < Instance.nextKill) return;
        Instance.nextKill = Time.time + 4f;
        string[] lines =
        {
            "Target down. You look good when you don't hesitate.",
            "Another one. Keep the hill, I'll keep score.",
            "Visor ping: hostile offline. Don't get cocky.",
            "That's the rhythm. Two more and they break."
        };
        Say(lines[Random.Range(0, lines.Length)]);
    }

    public static void OnHill()
    {
        if (!Instance || Time.time < Instance.nextHill) return;
        Instance.nextHill = Time.time + 8f;
        Say("Hill is ours. Hold the cylinder. I like you here.");
    }

    public static void OnLowHealth()
    {
        if (!Instance || Time.time < Instance.nextHp) return;
        Instance.nextHp = Time.time + 6f;
        Say("Shields screaming. Break LOS. I am not losing you.");
    }

    public static void OnReload()
    {
        if (!Instance || Time.time < Instance.nextReload) return;
        Instance.nextReload = Time.time + 7f;
        Say("Mag swap. I'll watch your six — mostly.");
    }

    public static void OnWeapon(string name)
    {
        if (string.IsNullOrEmpty(name)) return;
        Say("Switched to " + name + ". Make it count.", 1.8f);
    }
}
