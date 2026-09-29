using UnityEngine;
using System.Runtime.InteropServices;

/// <summary>
/// Halo-style match narrator: queues short callouts ("SLAYER", "DOUBLE KILL",
/// "OVERSHIELD"…) and speaks them through the browser TTS voice (WebGL) with
/// a matching UI stinger. Lines are rate-limited so the announcer never rambles.
/// </summary>
public static class Announcer
{
#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    static extern void WebSpeech_Speak(string s);
    [DllImport("__Internal")]
    static extern void WebSpeech_Cancel();
#endif

    static readonly System.Collections.Generic.Queue<string> queue = new System.Collections.Generic.Queue<string>();
    static float nextAt;

    /// <summary>Queue a callout. Long lines win priority by simply being queued last.</summary>
    public static void Say(string line)
    {
        if (string.IsNullOrEmpty(line)) return;
        if (queue.Count < 4) queue.Enqueue(line);
    }

    public static void Tick()
    {
        if (queue.Count == 0 || Time.unscaledTime < nextAt) return;
        string line = queue.Dequeue();
        nextAt = Time.unscaledTime + Mathf.Max(1.1f, line.Length * 0.06f);
#if UNITY_WEBGL && !UNITY_EDITOR
        try { WebSpeech_Speak(line); } catch { }
#endif
        AudioDirector.UiAccept();   // stinger under every line
    }

    // ---- match callouts -------------------------------------------------------

    public static void MatchStart() => Say("Slayer");
    public static void Victory() { Say("Victory"); }
    public static void Defeat() { Say("Defeat"); }

    public static void Streak(int n)
    {
        switch (n)
        {
            case 2: Say("Double Kill"); break;
            case 3: Say("Triple Kill"); break;
            case 4: Say("Overkill"); break;
            case 5: Say("Killing Spree"); break;
            case 6: Say("Rampage"); break;
            default: if (n >= 7) Say("Unstoppable"); break;
        }
    }

    public static void Headshot() => Say("Headshot");
    public static void Overshield() => Say("Overshield");
    public static void DamageBoost() => Say("Damage Boost");
    public static void RocketUp() => Say("Rocket Launcher on the map");
}
