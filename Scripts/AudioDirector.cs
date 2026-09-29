using UnityEngine;

/// <summary>
/// Futuristic audio presentation layer:
///  - three procedural synthwave loops (menu / arena / intense), 100 BPM, A minor
///  - clean UI bus (nav ticks, accept chimes, back chirps) separate from SFX
///  - ambience bus (shrine wind bed)
///  - music ducks while aiming and crossfades between combat states
/// Everything is rendered once into small clips, then looped — zero CPU after boot.
/// </summary>
public class AudioDirector : MonoBehaviour
{
    public static AudioDirector Instance { get; private set; }

    const int SR = 22050;
    const float BPM = 100f;
    const float Eighth = 60f / BPM / 2f;        // 0.3s per 8th note
    const int Steps = 64;                        // 8 bars of 4/4 in 8ths
    static int TrackSamples => Mathf.CeilToInt(Steps * Eighth * SR);

    AudioSource music, ui, amb;
    AudioClip[] tracks;                          // 0 arena, 1 intense, 2 menu
    int current = -1;
    float fade;
    float duck = 1f;
    bool duckWanted;
    float menuUntil = float.MaxValue;

    void Awake()
    {
        if (Instance && Instance != this) { Destroy(gameObject); return; }
        Instance = this;
        DontDestroyOnLoad(gameObject);

        music = Bus("MusicBus");
        ui = Bus("UiBus");
        amb = Bus("AmbienceBus");

        tracks = new[] { BuildTrack(0), BuildTrack(1), BuildTrack(2) };

        var wind = SoundManager.WindClip();
        if (wind) { amb.clip = wind; amb.loop = true; amb.Play(); }

        PlayMusic(2);
        menuUntil = Time.unscaledTime + 7f;      // splash/menu vibe, then the arena takes over
        Debug.Log("[AUDIO] director up — uiVol " + SettingsManager.uiVolume.ToString("0.00") + " musicVol " + SettingsManager.musicVolume.ToString("0.00"));
    }

    AudioSource Bus(string name)
    {
        var go = new GameObject(name);
        go.transform.SetParent(transform, false);
        var s = go.AddComponent<AudioSource>();
        s.playOnAwake = false;
        return s;
    }

    void Update()
    {
        // music ducks while ADS — tactical focus
        duck = Mathf.MoveTowards(duck, duckWanted ? 0.4f : 1f, Time.unscaledDeltaTime * 1.8f);
        fade = Mathf.MoveTowards(fade, 1f, Time.unscaledDeltaTime * 1.4f);

        float master = SettingsManager.masterVolume;
        music.volume = SettingsManager.musicVolume * master * duck * fade;
        ui.volume = SettingsManager.uiVolume * master;
        amb.volume = 0.3f * SettingsManager.sfxVolume * master;

        if (Time.unscaledTime > menuUntil && current == 2) PlayMusic(0);
    }

    // ------------------------------------------------------------ public ----

    /// <summary>Aim-down-sights duck. Call every frame with the current state.</summary>
    public static void Duck(bool on)
    {
        if (Instance) Instance.duckWanted = on;
    }

    public static void ToMenu() => PlayMusic(2);
    public static void ToCombat() => PlayMusic(0);
    public static void ToCombatIntense() => PlayMusic(1);

    public static void UiMove()
    {
        if (!Instance) return;
        var clip = Instance.Loaded("ui_nav");
        if (clip) { Instance.ui.PlayOneShot(clip, 0.5f); return; }
        Instance.SynthUi(1750f, 1750f, 0.035f, 0.22f, 3.5f);
    }

    public static void UiAccept()
    {
        if (!Instance) return;
        var clip = Instance.Loaded("ui_accept");
        if (clip) { Instance.ui.PlayOneShot(clip, 0.55f); return; }
        Instance.SynthUi(880f, 1320f, 0.14f, 0.3f, 2.2f);
        Instance.SynthUi(1760f, 1760f, 0.1f, 0.14f, 3f, 0.06f);
    }

    public static void UiBack()
    {
        if (!Instance) return;
        Instance.SynthUi(660f, 392f, 0.12f, 0.26f, 2.2f);
    }

    public static void UiToggle()
    {
        if (!Instance) return;
        Instance.SynthUi(1200f, 900f, 0.05f, 0.2f, 3f);
    }

    // ------------------------------------------------------------ music ----

    static void PlayMusic(int track) { if (Instance) Instance.PlayTrack(track); }

    void PlayTrack(int track)
    {
        if (track == current || tracks == null || tracks[track] == null) return;
        current = track;
        fade = 0f;
        music.clip = tracks[track];
        music.loop = true;
        music.Play();
        Debug.Log("[AUDIO] music → " + (track == 0 ? "ARENA" : track == 1 ? "INTENSE" : "MENU") + " (len " + tracks[track].length.ToString("0") + "s)");
    }

    /// <summary>
    /// Renders one 8-bar loop. variant: 0 arena (groove), 1 intense (drive),
    /// 2 menu (pad + arp, no drums). A minor: Am F C G.
    /// </summary>
    static AudioClip BuildTrack(int variant)
    {
        var st = Random.state;
        Random.InitState(0xA07 + variant);

        int n = TrackSamples;
        var data = new float[n];

        // chord roots (A2, F2, C3, G2) × 2 passes
        float[] roots = { 110f, 87.31f, 130.81f, 98f, 110f, 87.31f, 130.81f, 98f };
        float step = Eighth;
        int spb = Mathf.CeilToInt(step * SR);        // samples per 8th

        for (int bar = 0; bar < 8; bar++)
        {
            float root = roots[bar];
            int barStart = bar * 8 * spb;

            // pad chord: root + fifth + octave, one soft swell per bar
            Add(data, barStart, 8 * spb, root, 0.045f, 0.35f, 0.7f, 0f, 0f);
            Add(data, barStart, 8 * spb, root * 1.5f, 0.032f, 0.45f, 0.7f, 0f, 0f);
            Add(data, barStart, 8 * spb, root * 2f, 0.026f, 0.5f, 0.7f, 0f, 0f);

            // bass: 8ths, skipping beat 4 rest on bars 4/8
            for (int s = 0; s < 8; s++)
            {
                if (variant != 2 && (bar == 3 || bar == 7) && s == 7) continue;
                float f = root * 0.5f * ((s == 3 || s == 6) ? 1.5f : 1f);
                Add(data, barStart + s * spb, spb, f, variant == 1 ? 0.17f : 0.13f, 0.008f, 2.4f, 0.06f, 0f);
            }

            // drums (not on menu)
            if (variant != 2)
            {
                for (int s = 0; s < 8; s += 2)
                {
                    if (s == 0 || s == 4) Kick(data, barStart + s * spb);           // 1 & 3
                    Hat(data, barStart + s * spb + spb / 2, variant == 1 ? 0.05f : 0.035f);
                    if (s == 2 || s == 6) Snare(data, barStart + s * spb);
                }
            }

            // arp: 16ths, pentatonic shimmer — every bar on menu, back half on combat
            int arpFrom = variant == 2 ? 0 : 4;
            for (int s = arpFrom; s < 8; s++)
            {
                int[] pent = { 0, 3, 5, 7, 10 };
                int deg = pent[(bar * 2 + s) % pent.Length];
                float f = root * 2f * Mathf.Pow(2f, deg / 12f);
                Add(data, barStart + s * spb, spb / 2, f,
                    variant == 2 ? 0.05f : 0.062f, 0.005f, 3.2f, 0f, 0f);
            }

            // lead: long notes on odd bars, menu + intense only
            if (variant != 0 || bar % 2 == 1)
            {
                int[] lead = { 12, 15, 12, 19 };
                float f = root * Mathf.Pow(2f, lead[bar % lead.Length] / 12f);
                Add(data, barStart, 6 * spb, f, 0.055f, 0.5f, 1.1f, 0f, 0f);
            }
        }

        Random.state = st;

        var clip = AudioClip.Create("waifu_track_" + variant, n, 1, SR, false);
        clip.SetData(data, 0);
        return clip;
    }

    static void Add(float[] data, int start, int len, float freq, float amp,
        float attack, float decayPow, float noise, float drive)
    {
        int n = data.Length;
        int atk = Mathf.Max(1, Mathf.CeilToInt(attack * SR));
        float phase = 0f, lp = 0f;
        float step = 2f * Mathf.PI * freq / SR;
        for (int i = 0; i < len; i++)
        {
            int idx = start + i;
            if (idx >= n) break;
            float u = i / (float)len;
            float tone = Mathf.Sin(phase);
            phase += step;
            float s = noise > 0f ? Mathf.Lerp(tone, Mathf.Lerp(Random.value * 2f - 1f, lp, 0.7f), noise) : tone;
            lp = s;
            if (drive > 0f) s = Mathf.Tan(s * (1f + drive)) * 0.6f;
            float env = Mathf.Pow(1f - u, decayPow);
            if (i < atk) env *= i / (float)atk;
            data[idx] += Mathf.Clamp(s * env * amp, -1f, 1f);
        }
    }

    static void Kick(float[] data, int start)
    {
        int len = Mathf.CeilToInt(0.13f * SR);
        float phase = 0f;
        for (int i = 0; i < len && start + i < data.Length; i++)
        {
            float u = i / (float)len;
            float f = Mathf.Lerp(150f, 42f, u * u);
            phase += 2f * Mathf.PI * f / SR;
            float env = Mathf.Pow(1f - u, 2.2f);
            data[start + i] += Mathf.Sin(phase) * env * 0.34f;
        }
    }

    static void Snare(float[] data, int start)
    {
        int len = Mathf.CeilToInt(0.09f * SR);
        float lp = 0f;
        for (int i = 0; i < len && start + i < data.Length; i++)
        {
            float u = i / (float)len;
            float raw = Random.value * 2f - 1f;
            lp = Mathf.Lerp(raw, lp, 0.35f);
            float env = Mathf.Pow(1f - u, 3.4f);
            data[start + i] += (lp * 0.7f + Mathf.Sin(2f * Mathf.PI * 190f / SR * i) * 0.2f) * env * 0.14f;
        }
    }

    static void Hat(float[] data, int start, float amp)
    {
        int len = Mathf.CeilToInt(0.03f * SR);
        for (int i = 0; i < len && start + i < data.Length; i++)
        {
            float u = i / (float)len;
            float env = Mathf.Pow(1f - u, 5f);
            data[start + i] += (Random.value * 2f - 1f) * env * amp;
        }
    }

    // ------------------------------------------------------------ ui synth ----

    AudioClip Loaded(string key)
    {
        return Resources.Load<AudioClip>("Audio/" + key);
    }

    /// <summary>Clean sine blip through the UI bus — no drive, no grit.</summary>
    void SynthUi(float from, float to, float dur, float amp, float decayPow, float delay = 0f)
    {
        int n = Mathf.CeilToInt(dur * SR);
        var d = new float[n];
        float phase = 0f;
        for (int i = 0; i < n; i++)
        {
            float u = i / (float)n;
            float f = Mathf.Lerp(from, to, u * u);
            phase += 2f * Mathf.PI * f / SR;
            float env = Mathf.Pow(1f - u, decayPow);
            if (i < Mathf.CeilToInt(0.004f * SR)) env *= i / (0.004f * SR);
            d[i] = Mathf.Sin(phase) * env * amp;
        }
        var clip = AudioClip.Create("ui_synth", n, 1, SR, false);
        clip.SetData(d, 0);
        if (delay > 0f) StartCoroutine(PlayDelayed(clip, delay));
        else ui.PlayOneShot(clip, 1f);
    }

    System.Collections.IEnumerator PlayDelayed(AudioClip clip, float delay)
    {
        yield return new WaitForSecondsRealtime(delay);
        if (ui) ui.PlayOneShot(clip, 1f);
    }
}
