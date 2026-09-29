using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Procedural SFX. Every cue is synthesized once into a small bank of pitch
/// variants, cached, then played through a pooled voice (2D for the player,
/// spatialised for anything happening out in the world).
/// </summary>
public class SoundManager : MonoBehaviour
{
    public static SoundManager Instance { get; private set; }

    const int Voices = 20;
    const int Variants = 4;
    const int SampleRate = 22050;

    AudioSource[] flat;     // 2D, player-owned sounds
    AudioSource[] world;    // 3D, positional
    AudioClip windClip;     // cached shrine wind bed
    int flatNext, worldNext;
    readonly Dictionary<string, AudioClip[]> bank = new Dictionary<string, AudioClip[]>();

    /// <summary>Recipe for one synthesized one-shot.</summary>
    struct Spec
    {
        public float dur;       // seconds
        public float freq;      // start pitch
        public float endFreq;   // swept-to pitch
        public float amp;
        public float noise;     // 0..1 blend of filtered noise over the tone
        public float attack;    // seconds of fade-in
        public float decay;     // envelope power; higher = snappier
        public float drive;     // soft-clip grit
        public float body;      // sub-octave weight
        public float damp;      // 0..1 one-pole lowpass on the noise
    }

    void Awake()
    {
        if (Instance && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);

        flat = new AudioSource[Voices];
        world = new AudioSource[Voices];
        for (int i = 0; i < Voices; i++)
        {
            flat[i] = NewSource(0f);
            world[i] = NewSource(1f);
        }
    }

    AudioSource NewSource(float blend)
    {
        var go = new GameObject(blend > 0f ? "Voice3D" : "Voice2D");
        go.transform.SetParent(transform, false);
        var s = go.AddComponent<AudioSource>();
        s.playOnAwake = false;
        s.spatialBlend = blend;
        s.rolloffMode = AudioRolloffMode.Linear;
        s.minDistance = 6f;
        s.maxDistance = 110f;
        s.dopplerLevel = 0f;
        return s;
    }

    // ---- playback --------------------------------------------------------------

    static void Play(string key, Spec spec, float vol, float pitchJitter = 0.06f)
    {
        var s = Pick(key, spec);
        if (!s) return;
        var src = Instance.flat[Instance.flatNext++ % Voices];
        src.pitch = 1f + Random.Range(-pitchJitter, pitchJitter);
        src.PlayOneShot(s, vol * SettingsManager.sfxVolume * SettingsManager.masterVolume);
    }

    static void PlayAt(string key, Spec spec, Vector3 pos, float vol, float pitchJitter = 0.08f)
    {
        var s = Pick(key, spec);
        if (!s) return;
        var src = Instance.world[Instance.worldNext++ % Voices];
        src.transform.position = pos;
        src.pitch = 1f + Random.Range(-pitchJitter, pitchJitter);
        src.PlayOneShot(s, vol * SettingsManager.sfxVolume * SettingsManager.masterVolume);
    }

    /// <summary>Lazily build a bank of variants for this cue, then pick one.</summary>
    static AudioClip Pick(string key, Spec spec)
    {
        if (!Instance) return null;
        if (!Instance.bank.TryGetValue(key, out var clips))
        {
            clips = new AudioClip[Variants];
            for (int i = 0; i < Variants; i++)
            {
                var v = spec;
                float k = 1f + (i - Variants * 0.5f) * 0.045f;
                v.freq *= k;
                v.endFreq *= k;
                v.dur *= 1f + (i - Variants * 0.5f) * 0.03f;
                clips[i] = Render(key + i, v);
            }
            Instance.bank[key] = clips;
        }
        return clips[Random.Range(0, clips.Length)];
    }

    static AudioClip Render(string name, Spec p)
    {
        int n = Mathf.Max(8, Mathf.CeilToInt(SampleRate * p.dur));
        var clip = AudioClip.Create(name, n, 1, SampleRate, false);
        var data = new float[n];

        float phase = 0f, subPhase = 0f, lp = 0f;
        float damp = Mathf.Clamp01(p.damp);
        int attackN = Mathf.Max(1, Mathf.CeilToInt(SampleRate * p.attack));

        for (int i = 0; i < n; i++)
        {
            float u = i / (float)n;

            // exponential pitch sweep reads far more "designed" than a flat tone
            float f = p.endFreq > 0f ? Mathf.Lerp(p.freq, p.endFreq, u * u) : p.freq;
            phase += 2f * Mathf.PI * f / SampleRate;
            subPhase += 2f * Mathf.PI * (f * 0.5f) / SampleRate;

            float tone = Mathf.Sin(phase) + p.body * Mathf.Sin(subPhase);

            float raw = Random.value * 2f - 1f;
            lp = Mathf.Lerp(raw, lp, damp);          // one-pole lowpass = weight
            float s = Mathf.Lerp(tone, lp, p.noise);

            if (p.drive > 0f) s = Mathf.Tan(Mathf.Clamp(s * (1f + p.drive), -1.4f, 1.4f)) * 0.6f;

            float env = Mathf.Pow(1f - u, Mathf.Max(0.2f, p.decay));
            if (i < attackN) env *= i / (float)attackN;

            data[i] = Mathf.Clamp(s * env * p.amp, -1f, 1f);
        }

        clip.SetData(data, 0);
        return clip;
    }

    // ---- recorded SFX (Desert Eagle pack) -------------------------------------

    readonly Dictionary<string, AudioClip> clipCache = new Dictionary<string, AudioClip>();

    /// <summary>Load a real recording from Resources/Audio, cached; null if absent.</summary>
    AudioClip Clip(string key)
    {
        if (clipCache.TryGetValue(key, out var c)) return c;
        c = Resources.Load<AudioClip>("Audio/" + key);
        clipCache[key] = c;
        return c;
    }

    /// <summary>Play a real clip through the 2D voice pool with slight pitch jitter.</summary>
    void PlayRaw(AudioClip clip, float vol, float pitchJitter = 0.04f)
    {
        var src = flat[flatNext++ % Voices];
        src.pitch = 1f + Random.Range(-pitchJitter, pitchJitter);
        src.PlayOneShot(clip, vol * SettingsManager.sfxVolume * SettingsManager.masterVolume);
    }

    /// <summary>Play a real clip spatialised in the world (bot gunfire, impacts).</summary>
    void PlayRawAt(AudioClip clip, Vector3 pos, float vol, float pitchJitter = 0.06f)
    {
        var src = world[worldNext++ % Voices];
        src.transform.position = pos;
        src.pitch = 1f + Random.Range(-pitchJitter, pitchJitter);
        src.PlayOneShot(clip, vol * SettingsManager.sfxVolume * SettingsManager.masterVolume);
    }

    readonly Dictionary<int, float> pitchCache = new Dictionary<int, float>();

    /// <summary>Remember the last 2D pitch per voice so enemy shots can mirror it exactly —
    /// your rifle and hers are the same gunshot, you just hear hers from out there.</summary>
    float LastPitch2D(int slot)
    {
        if (!pitchCache.TryGetValue(slot, out var p)) p = 1f;
        return p;
    }

    // ---- player weapon ---------------------------------------------------------

    /// <summary>Real recorded Desert Eagle fire cue (Resources/Audio); null if missing.</summary>
    static AudioClip DeagleFire => Resources.Load<AudioClip>("Audio/Desert_Eagle_-_Fire_-_1");

    public static void Shot(Weapon.Kind k)
    {
        // real recording for every gun; pitched per class so they read differently
        var clip = DeagleFire;
        if (clip)
        {
            var slot = Instance.flatNext++ % Voices;
            var src = Instance.flat[slot];
            src.pitch = (k == Weapon.Kind.Sniper ? 0.7f : k == Weapon.Kind.Shotgun ? 0.8f : k == Weapon.Kind.SMG ? 1.12f : 1f)
                + Random.Range(-0.035f, 0.035f);
            Instance.pitchCache[slot] = src.pitch;   // bots mirror this exact pitch
            src.PlayOneShot(clip, (k == Weapon.Kind.Sniper ? 0.55f : k == Weapon.Kind.Shotgun ? 0.5f : 0.4f) * SettingsManager.sfxVolume * SettingsManager.masterVolume);
            return;
        }
        switch (k)
        {
            case Weapon.Kind.Shotgun:
                Play("sg", new Spec { dur = 0.28f, freq = 220, endFreq = 48, amp = 0.85f, noise = 0.72f, decay = 2.2f, drive = 1.5f, body = 0.7f, damp = 0.55f }, 0.75f);
                break;
            case Weapon.Kind.Sniper:
                Play("sr", new Spec { dur = 0.42f, freq = 320, endFreq = 55, amp = 0.9f, noise = 0.55f, decay = 1.8f, drive = 2.2f, body = 0.9f, damp = 0.4f }, 0.8f);
                break;
            default:
                Play("ri", new Spec { dur = 0.1f, freq = 420, endFreq = 130, amp = 0.7f, noise = 0.6f, decay = 2.6f, drive = 1.2f, body = 0.5f, damp = 0.35f }, 0.5f);
                break;
        }
    }

    public static void ReloadStart()
    {
        var real = Instance.Clip("de_reload");
        if (real) { Instance.PlayRaw(real, 0.4f, 0.02f); return; }
        Play("rls", new Spec { dur = 0.1f, freq = 300, endFreq = 190, amp = 0.4f, noise = 0.5f, decay = 2.4f, damp = 0.6f }, 0.45f);
    }
    public static void MagOut() => Play("mgo", new Spec { dur = 0.09f, freq = 260, endFreq = 150, amp = 0.45f, noise = 0.66f, decay = 3f, damp = 0.5f }, 0.4f);
    public static void MagIn() => Play("mgi", new Spec { dur = 0.08f, freq = 520, endFreq = 300, amp = 0.5f, noise = 0.6f, decay = 3.4f, drive = 0.6f, damp = 0.35f }, 0.45f);
    public static void ReloadEnd() => Play("rle", new Spec { dur = 0.07f, freq = 900, endFreq = 640, amp = 0.4f, noise = 0.2f, decay = 3.2f }, 0.4f);
    public static void DryFire()
    {
        var real = Instance.Clip("de_dry");
        if (real) { Instance.PlayRaw(real, 0.4f); return; }
        Play("dry", new Spec { dur = 0.06f, freq = 180, endFreq = 90, amp = 0.45f, noise = 0.8f, decay = 4f, damp = 0.3f }, 0.4f);
    }
    public static void LowAmmo() => Play("low", new Spec { dur = 0.07f, freq = 1150, endFreq = 1150, amp = 0.3f, noise = 0.05f, decay = 2.6f }, 0.28f, 0.01f);

    // ---- feedback --------------------------------------------------------------

    /// <summary>Hit feedback: mechanical action-cycle tick — feels like gear, not a bird.</summary>
    public static void Hitmarker()
    {
        Play("ht1", new Spec { dur = 0.03f, freq = 1900, endFreq = 1600, amp = 0.4f, noise = 0.1f, decay = 5f }, 0.32f, 0.01f);
        Play("ht2", new Spec { dur = 0.05f, freq = 950, endFreq = 700, amp = 0.35f, noise = 0.2f, decay = 4f, damp = 0.3f }, 0.3f, 0.02f);
    }
    public static void ShieldHit() => Play("shh", new Spec { dur = 0.07f, freq = 1450, endFreq = 1100, amp = 0.3f, noise = 0.06f, decay = 3f }, 0.3f, 0.02f);

    public static void ShieldBreak()
    {
        // halo-style: descending flat tone + energy collapse whoosh
        Play("shb1", new Spec { dur = 0.5f, freq = 880, endFreq = 830, amp = 0.42f, noise = 0.03f, attack = 0.01f, decay = 1.1f }, 0.45f, 0.005f);
        Play("shb2", new Spec { dur = 0.55f, freq = 700, endFreq = 110, amp = 0.5f, noise = 0.35f, attack = 0.05f, decay = 1.6f, drive = 0.6f, damp = 0.75f }, 0.4f, 0.01f);
    }
    public static void ShieldRecharge() => Play("shr", new Spec { dur = 0.45f, freq = 260, endFreq = 880, amp = 0.35f, noise = 0.2f, attack = 0.12f, decay = 1.1f, damp = 0.7f }, 0.35f, 0.02f);
    public static void KillConfirm() => Play("kil", new Spec { dur = 0.16f, freq = 760, endFreq = 1250, amp = 0.5f, noise = 0.08f, decay = 2.2f, body = 0.4f }, 0.55f, 0.02f);
    /// <summary>Short exertion breath on jump — a person, not a theremin.</summary>
    public static void Jump() => Play("jmp", new Spec { dur = 0.11f, freq = 300, endFreq = 150, amp = 0.28f, noise = 0.92f, attack = 0.02f, decay = 2.4f, damp = 0.85f }, 0.26f);
    public static void Dash() => Play("dsh", new Spec { dur = 0.26f, freq = 620, endFreq = 90, amp = 0.55f, noise = 0.7f, decay = 1.7f, drive = 0.7f, damp = 0.78f }, 0.5f);
    /// <summary>Halo-style double-beep shield low warning.</summary>
    public static void ShieldLow()
    {
        Play("shl1", new Spec { dur = 0.09f, freq = 980, endFreq = 980, amp = 0.3f, noise = 0.03f, decay = 2.2f }, 0.3f, 0.005f);
        Play("shl2", new Spec { dur = 0.09f, freq = 980, endFreq = 980, amp = 0.3f, noise = 0.03f, decay = 2.2f }, 0.3f, 0.005f);
    }

    /// <summary>Rising three-tone shield-recharge confirm.</summary>
    public static void ShieldReady()
    {
        Play("shr1", new Spec { dur = 0.08f, freq = 660, endFreq = 660, amp = 0.26f, noise = 0.02f, decay = 2f }, 0.26f, 0.005f);
        Play("shr2", new Spec { dur = 0.08f, freq = 880, endFreq = 880, amp = 0.26f, noise = 0.02f, decay = 2f }, 0.26f, 0.005f);
        Play("shr3", new Spec { dur = 0.12f, freq = 1100, endFreq = 1100, amp = 0.28f, noise = 0.02f, decay = 2f }, 0.28f, 0.005f);
    }

    public static void UiTick() => AudioDirector.UiMove();
    public static void HillCapture() => Play("cap", new Spec { dur = 0.5f, freq = 180, endFreq = 720, amp = 0.5f, noise = 0.15f, attack = 0.05f, decay = 1.3f, body = 0.6f }, 0.5f, 0.01f);

    // ---- world / enemies -------------------------------------------------------

    /// <summary>Bot gunfire: the SAME recorded gunshot as your rifle, spatialised and
    /// pitch-mirrored — identical weapon, heard from out there. No more bee-farts.</summary>
    public static void EnemyShot(Vector3 pos, int archetype)
    {
        var real = DeagleFire;
        if (real)
        {
            float pitch = archetype == 2 ? 0.72f : archetype == 1 ? 0.94f : 1.06f;
            pitch += Random.Range(-0.03f, 0.03f);
            var slot = Instance.worldNext++ % Voices;
            var src = Instance.world[slot];
            src.transform.position = pos;
            src.pitch = pitch;                       // per-class voice, real recording
            src.PlayOneShot(real, (archetype == 2 ? 0.5f : archetype == 1 ? 0.4f : 0.35f) * SettingsManager.sfxVolume * SettingsManager.masterVolume);
            return;
        }
        switch (archetype)
        {
            case 2: // heavy: slow, deep thuds
                PlayAt("eh", new Spec { dur = 0.26f, freq = 190, endFreq = 60, amp = 0.9f, noise = 0.65f, decay = 2f, drive = 1.6f, body = 0.8f, damp = 0.6f }, pos, 0.85f);
                break;
            case 1: // ranger: tight, mid crack
                PlayAt("er", new Spec { dur = 0.13f, freq = 500, endFreq = 150, amp = 0.75f, noise = 0.5f, decay = 2.6f, drive = 1.3f, body = 0.4f, damp = 0.32f }, pos, 0.7f);
                break;
            default: // grunt: thin, buzzy
                PlayAt("eg", new Spec { dur = 0.09f, freq = 680, endFreq = 240, amp = 0.6f, noise = 0.55f, decay = 3f, drive = 0.9f, damp = 0.25f }, pos, 0.55f);
                break;
        }
    }

    /// <summary>Bot death: low synthesized thump + descent — no cartoon zapper.</summary>
    public static void BotDeath(Vector3 pos)
    {
        PlayAt("bdx", new Spec { dur = 0.4f, freq = 150, endFreq = 45, amp = 0.7f, noise = 0.45f, decay = 2.2f, drive = 1.1f, body = 0.9f, damp = 0.75f }, pos, 0.65f);
        PlayAt("bdw", new Spec { dur = 0.35f, freq = 420, endFreq = 160, amp = 0.3f, noise = 0.35f, decay = 2.4f, damp = 0.6f }, pos, 0.3f);
    }

    // ---- shrine range ---------------------------------------------------------

    /// <summary>Target hit: woodblock ding, brighter and higher as the combo climbs.</summary>
    public static void TargetDing(bool weak, int combo)
    {
        float lift = 1f + Mathf.Min(combo, 20) * 0.03f;
        if (weak)
            Play("wdk", new Spec { dur = 0.12f, freq = 1500 * lift, endFreq = 1050 * lift, amp = 0.5f, noise = 0.1f, decay = 2.8f, body = 0.3f }, 0.5f, 0.02f);
        else
            Play("din", new Spec { dur = 0.09f, freq = 980 * lift, endFreq = 700 * lift, amp = 0.42f, noise = 0.12f, decay = 3f }, 0.42f, 0.03f);
    }

    /// <summary>Rank results stinger — two-note resolve, sparkling on S.</summary>
    public static void MedalStinger(bool sparkle)
    {
        Play("md1", new Spec { dur = 0.3f, freq = 520, endFreq = 520, amp = 0.4f, noise = 0.05f, attack = 0.02f, decay = 1.6f, body = 0.4f }, 0.45f, 0.01f);
        Play("md2", new Spec { dur = 0.5f, freq = 780, endFreq = 780, amp = 0.38f, noise = 0.05f, attack = 0.05f, decay = 1.4f, body = 0.35f }, 0.4f, 0.01f);
        if (sparkle)
        {
            Play("mds", new Spec { dur = 0.7f, freq = 1900, endFreq = 2600, amp = 0.28f, noise = 0.02f, attack = 0.1f, decay = 1.6f }, 0.3f, 0.01f);
        }
    }

    /// <summary>Gacha crystal hum while the card forms.</summary>
    public static void GachaJingle(bool big)
    {
        Play("gj1", new Spec { dur = 0.9f, freq = 240, endFreq = 720, amp = 0.32f, noise = 0.04f, attack = 0.25f, decay = 1.2f, body = 0.5f }, 0.4f, 0.01f);
        if (big)
            Play("gj2", new Spec { dur = 1.1f, freq = 480, endFreq = 1440, amp = 0.3f, noise = 0.03f, attack = 0.3f, decay = 1.3f }, 0.4f, 0.01f);
    }

    /// <summary>The burst when the crystal shatters into a card.</summary>
    public static void GachaBurst()
    {
        Play("gb1", new Spec { dur = 0.45f, freq = 900, endFreq = 120, amp = 0.55f, noise = 0.4f, decay = 2f, drive = 0.8f, damp = 0.5f }, 0.5f);
        Play("gb2", new Spec { dur = 0.6f, freq = 1400, endFreq = 2200, amp = 0.3f, noise = 0.06f, attack = 0.04f, decay = 1.8f }, 0.35f, 0.01f);
    }

    /// <summary>Soft wind bed for the shrine — long filtered noise, loopable.</summary>
    public static AudioClip WindClip()
    {
        var s = Instance;
        if (!s) return null;
        if (s.windClip) return s.windClip;
        s.windClip = Render("shrine_wind", new Spec { dur = 3f, freq = 180, endFreq = 160, amp = 0.5f, noise = 0.92f, attack = 1.4f, decay = 0.7f, damp = 0.92f });
        return s.windClip;
    }

    public static void ShrineWind()
    {
        Play("wnd", new Spec { dur = 2.4f, freq = 180, endFreq = 160, amp = 0.5f, noise = 0.92f, attack = 1.2f, decay = 0.8f, damp = 0.9f }, 0.22f, 0.02f);
    }

    public static void BotAlert(Vector3 pos) => PlayAt("alt", new Spec { dur = 0.13f, freq = 620, endFreq = 980, amp = 0.45f, noise = 0.1f, decay = 2.4f }, pos, 0.45f, 0.05f);
    public static void BotReload(Vector3 pos) => PlayAt("brl", new Spec { dur = 0.1f, freq = 280, endFreq = 170, amp = 0.4f, noise = 0.6f, decay = 2.8f, damp = 0.5f }, pos, 0.35f);
    public static void Whizz(Vector3 pos) => PlayAt("whz", new Spec { dur = 0.1f, freq = 1800, endFreq = 500, amp = 0.35f, noise = 0.5f, decay = 2.6f, damp = 0.2f }, pos, 0.3f, 0.12f);
    public static void Footstep(Vector3 pos) => PlayAt("stp", new Spec { dur = 0.07f, freq = 150, endFreq = 80, amp = 0.35f, noise = 0.8f, decay = 3.4f, damp = 0.62f }, pos, 0.25f, 0.14f);
    public static void Impact(Vector3 pos) => PlayAt("imp", new Spec { dur = 0.06f, freq = 320, endFreq = 120, amp = 0.4f, noise = 0.85f, decay = 3.6f, damp = 0.4f }, pos, 0.3f, 0.15f);
}
