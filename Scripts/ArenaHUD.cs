using System.Collections.Generic;
using UnityEngine;

/// <summary>
/// Visor HUD: phosphor hairlines with a warm/cyan/rose accent set, segmented
/// vitals, a live ammo readout, a reload ring and a toast stack for feedback.
/// </summary>
public class ArenaHUD : MonoBehaviour
{
    public enum Note { Info, Good, Warn, Bad, Dim }

    public static ArenaHUD Instance { get; private set; }
    public Texture2D kira;

    float hitUntil, killUntil, flashUntil, dashUntil, muzzleUntil;
    Health playerHp;
    WeaponLoadout loadout;

    // floating combat feedback
    struct DmgNum { public Vector3 pos; public int value; public bool head; public float born; public float life; }
    readonly List<DmgNum> dmgNums = new List<DmgNum>();
    struct ElimMark { public bool head; public bool nade; public float born; }
    readonly List<ElimMark> elims = new List<ElimMark>();

    // Palette — 90s ACTION TERMINAL: black/white brutalist, rose = lethal accent.
    // (Cyan/Phosphor kept as names so every call site flips to monochrome at once.)
    static readonly Color Cyan = new Color(0.96f, 0.97f, 0.98f, 0.96f);        // now INK-WHITE
    static readonly Color Phosphor = new Color(0.92f, 0.93f, 0.95f, 0.92f);    // white
    static readonly Color Amber = new Color(0.85f, 0.86f, 0.88f, 0.95f);       // pale steel (warnings)
    static readonly Color Rose = new Color(0.96f, 0.25f, 0.37f, 0.95f);        // #f43f5e — the ONLY color
    static readonly Color Hot = new Color(1.00f, 0.28f, 0.28f, 0.95f);
    static readonly Color Good = new Color(0.92f, 0.93f, 0.95f, 0.95f);
    static readonly Color Dim = new Color(0.62f, 0.64f, 0.67f, 0.6f);          // mid grey
    static readonly Color Ink = new Color(0.03f, 0.03f, 0.04f, 0.92f);         // solid black slabs

    readonly List<Toast> toasts = new List<Toast>();
    GUIStyle style;

    struct Toast
    {
        public string text;
        public Color color;
        public float born;
        public int stack;
    }

    const float ToastLife = 2.2f;

    void Awake()
    {
        Instance = this;
        kira = Resources.Load<Texture2D>("kira7");
        // Kenney crosshair pack — sorted by index so settings map 1:1
        xhairs = Resources.LoadAll<Texture2D>("UI/Crosshairs");
        System.Array.Sort(xhairs, (a, b) => string.CompareOrdinal(a.name, b.name));
    }

    Texture2D[] xhairs;

    // ---- public feedback hooks -------------------------------------------------

    public static void Hitmarker(bool kill) => Hitmarker(kill, false);

    /// <param name="head">Headshot — the X burns longer and shows up red-hot.</param>
    public static void Hitmarker(bool kill, bool head)
    {
        if (!Instance) return;
        Instance.hitUntil = Time.unscaledTime + (head ? 0.18f : 0.1f);
        if (kill) Instance.killUntil = Time.unscaledTime + 0.4f;
    }

    /// <summary>Player took damage — a 2-frame flash instead of a 14-frame strobe.</summary>
    public static void DamageFlash()
    {
        if (!Instance) return;
        float life = 0.05f;                    // two frames at 40fps: present, not blinding
        Instance.flashUntil = Mathf.Max(Instance.flashUntil, Time.unscaledTime + life);
    }
    public static void MuzzleFlash() { if (Instance) Instance.muzzleUntil = Time.unscaledTime + 0.05f; }
    public static void DashFlash() { if (Instance) Instance.dashUntil = Time.unscaledTime + 0.12f; }

    /// <summary>Queue a short on-screen message under the reticle.</summary>
    /// <summary>One-shot center-screen beat — the terminal treatment for announcer lines
    /// (PICKUP TAKEN, OVERSHIELD, MAP ITEM RESPAWNED…). Fades like the score pop.</summary>
    public static void Beat(string text, Note kind = Note.Info)
    {
        if (!Instance || string.IsNullOrEmpty(text)) return;
        Instance.beatText = text.ToUpperInvariant();
        Instance.beatKind = kind;
        Instance.beatUntil = Time.unscaledTime + 1.6f;
    }
    string beatText;
    Note beatKind;
    float beatUntil;

    public static void Notify(string text, Note kind = Note.Info)
    {
        if (!Instance || string.IsNullOrEmpty(text)) return;
        Instance.Push(text, Tint(kind));
    }

    /// <summary>Tiny floating damage number at a world hit point (11px, amber / rose).</summary>
    public static void DamageNumber(Vector3 worldPos, int amount, bool head)
    {
        if (!Instance) return;
        Instance.dmgNums.Add(new DmgNum { pos = worldPos, value = amount, head = head, born = Time.unscaledTime, life = 0.7f });
        if (Instance.dmgNums.Count > 12) Instance.dmgNums.RemoveAt(0);
    }

    /// <summary>Elim feed right of the reticle + medal badges + narrator callouts.</summary>
    public static void Elim(bool head, bool nade = false)
    {
        if (!Instance) return;
        float now = Time.unscaledTime;
        Instance.scorePopAt = now;
        Instance.elims.Add(new ElimMark { head = head, nade = nade, born = now });
        if (Instance.elims.Count > 4) Instance.elims.RemoveAt(0);

        // killstreaks: kills inside a 4-second window escalate
        if (now - Instance.lastKillAt < 4f) Instance.streak++;
        else Instance.streak = 1;
        Instance.lastKillAt = now;
        string text = Instance.streak == 2 ? "DOUBLE KILL"
            : Instance.streak == 3 ? "TRIPLE KILL"
            : Instance.streak == 4 ? "RAMPAGE"
            : Instance.streak >= 5 ? "UNSTOPPABLE" : null;
        if (text != null)
        {
            Instance.streakText = text;
            Instance.streakColor = Instance.streak >= 3 ? Rose : Amber;
            Instance.streakAt = now;
            Announcer.Streak(Instance.streak);
        }
        if (head) Announcer.Headshot();
    }

    float lastKillAt, streakAt;
    int streak;
    string streakText;
    Color streakColor;

    void Streaks(float sw, float sh)
    {
        if (streakText == null || Time.unscaledTime - streakAt > 1.6f) return;
        float age = Time.unscaledTime - streakAt;
        float fade = Mathf.Clamp01((1.6f - age) / 0.4f);
        float pop = 1f + 0.4f * Mathf.Clamp01(1f - age / 0.15f);
        Color c = streakColor; c.a *= fade;
        Label(0f, sh * 0.5f + 64f, sw, 28f, streakText, Mathf.RoundToInt(18 * pop), TextAnchor.MiddleCenter, c);
    }

    static Color Tint(Note k)
    {
        switch (k)
        {
            case Note.Good: return Good;
            case Note.Warn: return Amber;
            case Note.Bad: return Hot;
            case Note.Dim: return Dim;
            default: return Cyan;
        }
    }

    void Push(string text, Color c)
    {
        int last = toasts.Count - 1;
        if (last >= 0 && toasts[last].text == text)
        {
            // Repeat of the live message: refresh it instead of stacking dupes.
            var t = toasts[last];
            t.born = Time.unscaledTime;
            t.stack++;
            toasts[last] = t;
            return;
        }
        toasts.Add(new Toast { text = text, color = c, born = Time.unscaledTime, stack = 1 });
        if (toasts.Count > 4) toasts.RemoveAt(0);
    }

    // ---- drawing ---------------------------------------------------------------

    void OnGUI()
    {
        // Shrine Range owns the screen while we're in the training construct.
        if (RangeMaster.Instance && RangeMaster.Instance.InRange)
        {
            if (!OptionsMenu.IsOpen)
            {
                if (style == null) style = new GUIStyle(GUI.skin.label) { fontStyle = FontStyle.Bold, wordWrap = true };
                DrawCompanionOnly();
            }
            return;
        }
        if (OptionsMenu.IsOpen) return;
        if (style == null) style = new GUIStyle(GUI.skin.label) { fontStyle = FontStyle.Bold, wordWrap = true };

        toasts.RemoveAll(t => Time.unscaledTime - t.born > ToastLife);
        Draw();
    }

    /// <summary>Minimal overlay at the range: companion card + queued toasts.</summary>
    void DrawCompanionOnly()
    {
        toasts.RemoveAll(t => Time.unscaledTime - t.born > ToastLife);
        float sw = Screen.width, sh = Screen.height;
        float pad = Mathf.Max(22f, Screen.safeArea.xMin + 16f);
        CompanionCard(pad);
        Toasts(sw, sh);
    }

    void Draw()
    {
        float sw = Screen.width, sh = Screen.height;
        float pad = Mathf.Max(22f, Screen.safeArea.xMin + 16f);

        if (!playerHp || !loadout)
        {
            var p = ArenaDirector.Player;
            if (p)
            {
                if (!playerHp) playerHp = p.GetComponent<Health>();
                if (!loadout) loadout = p.GetComponentInChildren<WeaponLoadout>(true);
            }
        }

        Scanlines(sw, sh);
        Vignette(sw, sh);
        Fullscreen();

        // RUMBLE PIT chrome: score bar + radar + live scoreboard
        if (RumblePit.Active)
        {
            RumbleHeader(sw);
            Killfeed();
            Radar(sw, sh);
            Scoreboard(sw, sh);
        }

        Vitals(pad, sh);
        Ammo(sw, sh, pad);
        Reticle(sw, sh);
        DamageNumbersLayer(sw, sh);
        Elims(sw, sh);
        Streaks(sw, sh);
        CenterBeat(sw, sh);
        Toasts(sw, sh);

        if (ArenaDirector.MatchOver) MatchOver(sw, sh);
    }

    /// <summary>Rumble top bar: YOU vs LEADER, no panels, just the numbers.</summary>
    void RumbleHeader(float sw)
    {
        var board = RumblePit.Instance.Board();
        int mine = RumblePit.Instance.PlayerKills;
        int top = 0;
        string leaderName = "—";
        foreach (var row in board)
        {
            if (row.you) continue;
            if (row.kills > top) { top = row.kills; leaderName = row.name; }
        }
        float cx = sw * 0.5f;
        float pop = 1f + 0.25f * Mathf.Clamp01(1f - (Time.unscaledTime - scorePopAt) / 0.18f);

        Label(cx - 130f, 18f, 120f, 30f, mine.ToString(), Mathf.RoundToInt(22 * pop), TextAnchor.UpperRight, Cyan);
        Label(cx - 6f, 26f, 12f, 16f, ":", 13, TextAnchor.MiddleCenter, new Color(Dim.r, Dim.g, Dim.b, 0.7f));
        Label(cx + 10f, 18f, 120f, 30f, top.ToString(), 22, TextAnchor.UpperLeft, Rose);
        Label(cx - 130f, 50f, 260f, 14f, leaderName + " LEADS · FIRST TO " + RumblePit.Instance.killGoal, 9, TextAnchor.MiddleCenter, new Color(Dim.r, Dim.g, Dim.b, 0.8f));
        Fill(cx - 90f, 46f, 180f, 1f, new Color(Cyan.r, Cyan.g, Cyan.b, 0.25f));   // the only chrome
    }

    float scorePopAt;

    /// <summary>Center-screen announcer beat: huge mono caps under the score bar,
    /// flanked by bracket ticks, hard pop-in then fade. The terminal voice of the arena.</summary>
    void CenterBeat(float sw, float sh)
    {
        if (beatText == null || Time.unscaledTime > beatUntil) return;
        float t = beatUntil - Time.unscaledTime;
        float a = t > 1.25f ? (1.6f - t) / 0.35f : Mathf.Clamp01(t / 0.6f);   // pop in, ease out
        Color ink = beatKind switch
        {
            Note.Good => Cyan,
            Note.Warn => new Color(1f, 0.72f, 0.25f),
            Note.Bad => Rose,
            _ => Color.white,
        };
        ink.a = a;
        int size = Mathf.RoundToInt(Mathf.Min(40f, sw * 0.032f));
        var beatStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = size,
            fontStyle = FontStyle.Bold,
            alignment = TextAnchor.MiddleCenter,
        };
        GUI.color = ink;
        GUI.Label(new Rect(sw * 0.5f - 340f, sh * 0.16f, 680f, size + 10f), beatText, beatStyle);
        float half = Mathf.Min(300f, 18f * beatText.Length);
        Fill(sw * 0.5f - half - 34f, sh * 0.16f + size * 0.5f, 10f, 2f, ink);   // bracket ticks
        Fill(sw * 0.5f + half + 24f, sh * 0.16f + size * 0.5f, 10f, 2f, ink);
        GUI.color = Color.white;
    }

    /// <summary>Circular radar, bottom-right above ammo: player-centred, north-up.</summary>
    void Radar(float sw, float sh)
    {
        var p = ArenaDirector.Player;
        if (!p) return;
        float r = 74f;
        float cx = sw - 24f - r, cy = sh - 130f - r;
        var ink = new Color(0.02f, 0.05f, 0.07f, 0.6f);

        // dish: layered rings via stacked squares (no circle primitive in IMGUI)
        GUI.color = ink;
        GUI.DrawTexture(new Rect(cx - r, cy - r, r * 2f, r * 2f), Texture2D.whiteTexture);
        GUI.color = Color.white;
        // angular corner ticks frame the dish without a box
        Fill(cx - r - 6f, cy - 0.5f, 4f, 1f, new Color(Cyan.r, Cyan.g, Cyan.b, 0.4f));
        Fill(cx + r + 2f, cy - 0.5f, 4f, 1f, new Color(Cyan.r, Cyan.g, Cyan.b, 0.4f));
        Fill(cx - 0.5f, cy - r - 6f, 1f, 4f, new Color(Cyan.r, Cyan.g, Cyan.b, 0.4f));
        Fill(cx - 0.5f, cy + r + 2f, 1f, 4f, new Color(Cyan.r, Cyan.g, Cyan.b, 0.4f));
        for (int ring = 1; ring <= 2; ring++)
        {
            float rr = r * ring / 3f;
            DrawRing(cx, cy, rr, new Color(Cyan.r, Cyan.g, Cyan.b, 0.16f));
        }
        // sweep line rotating
        float a = Time.unscaledTime * 1.6f;
        DrawRadarLine(cx, cy, r, a, new Color(Cyan.r, Cyan.g, Cyan.b, 0.35f));
        DrawRadarLine(cx, cy, r, a - 0.35f, new Color(Cyan.r, Cyan.g, Cyan.b, 0.18f));
        DrawRadarLine(cx, cy, r, a - 0.7f, new Color(Cyan.r, Cyan.g, Cyan.b, 0.08f));
        // crosshair
        Fill(cx - 0.5f, cy - r, 1f, r * 2f, new Color(Cyan.r, Cyan.g, Cyan.b, 0.10f));
        Fill(cx - r, cy - 0.5f, r * 2f, 1f, new Color(Cyan.r, Cyan.g, Cyan.b, 0.10f));

        const float Range = 60f;   // metres mapped to dish radius
        var bots = ArenaDirector.Bots;
        if (bots != null)
        {
            foreach (var b in bots)
            {
                if (!b) continue;
                var bh = b.GetComponent<Health>();
                if (bh && bh.IsDead) continue;
                Vector3 d = b.position - p.position;
                Vector2 blip = WorldToRadar(d, Range, r);
                Fill(cx + blip.x - 2.5f, cy + blip.y - 2.5f, 5f, 5f, Rose);
            }
        }
        // hill direction (if KOTH were active we'd show it; rumble shows nothing)
        // player wedge
        Fill(cx - 2.5f, cy - 2.5f, 5f, 5f, Cyan);
    }

    static Vector2 WorldToRadar(Vector3 delta, float range, float radius)
    {
        // north-up, x = east
        float nx = Mathf.Clamp(delta.x / range, -1f, 1f);
        float ny = Mathf.Clamp(delta.z / range, -1f, 1f);
        var v = new Vector2(nx * radius, -ny * radius);
        if (v.magnitude > radius - 4f) v = v.normalized * (radius - 4f);
        return v;
    }

    void DrawRing(float cx, float cy, float radius, Color c)
    {
        int seg = 40;
        for (int i = 0; i < seg; i++)
        {
            float a0 = i / (float)seg * Mathf.PI * 2f;
            float a1 = (i + 1) / (float)seg * Mathf.PI * 2f;
            DrawSeg(cx, cy, radius, a0, a1, c);
        }
    }

    void DrawRadarLine(float cx, float cy, float radius, float ang, Color c)
    {
        DrawSeg(cx, cy, radius, ang, ang + 0.05f, c);
        DrawSeg(cx, cy, radius * 0.99f, ang, ang + 0.1f, c);
    }

    static void DrawSeg(float cx, float cy, float radius, float a0, float a1, Color c)
    {
        int steps = 3;
        for (int i = 0; i < steps; i++)
        {
            float t = Mathf.Lerp(a0, a1, i / (float)steps);
            float x = cx + Mathf.Cos(t) * radius;
            float y = cy + Mathf.Sin(t) * radius;
            GUI.color = c;
            GUI.DrawTexture(new Rect(x - 1f, y - 1f, 2f, 2f), Texture2D.whiteTexture);
        }
        GUI.color = Color.white;
    }

    /// <summary>Compact live scoreboard, right side under the radar.</summary>
    void Scoreboard(float sw, float sh)
    {
        var board = RumblePit.Instance.Board();
        int show = Mathf.Min(board.Count, 6);
        float w = 150f;
        float x = sw - 24f - w;
        float y = 20f;

        for (int i = 0; i < show; i++)
        {
            var row = board[i];
            Color c = row.you ? Cyan : i == 0 ? Rose : Dim;
            if (!row.you && i != 0) c.a *= 0.55f;
            Label(x, y + i * 17f, w - 34f, 15f, row.name, 11, TextAnchor.UpperLeft, c);
            Label(x + w - 30f, y + i * 17f, 30f, 15f, row.kills.ToString(), 11, TextAnchor.UpperRight, c);
        }
    }

    void Vitals(float pad, float sh)
    {
        if (playerHp)
        {
            float shd = playerHp.shield / Mathf.Max(1f, playerHp.maxShield);
            float bio = playerHp.health / Mathf.Max(1f, playerHp.maxHealth);
            Stat(pad, sh - 92f, "SHD", shd, Cyan, Mathf.CeilToInt(playerHp.shield).ToString());
            Stat(pad, sh - 70f, "BIO", bio, bio < 0.34f ? Hot : Good, Mathf.CeilToInt(playerHp.health).ToString());
        }

        var pc = PlayerController.Instance;
        if (pc)
        {
            bool ready = pc.DashReady01 >= 1f;
            Stat(pad, sh - 48f, "DSH", pc.DashReady01,
                pc.Dashing ? Rose : ready ? Amber : Dim, ready ? "RDY" : "");
        }
    }

    void Stat(float x, float y, string label, float t, Color c, string value)
    {
        Label(x, y - 2f, 40f, 14f, label, 10, TextAnchor.UpperLeft, Dim);
        Segments(x + 34f, y, 210f, 5f, Mathf.Clamp01(t), 16, c);
        if (!string.IsNullOrEmpty(value))
            Label(x + 250f, y - 4f, 46f, 14f, value, 11, TextAnchor.UpperLeft, c);
    }

    void Ammo(float sw, float sh, float pad)
    {
        var w = Weapon.Active;
        if (!w) return;

        float right = sw - pad;
        bool low = w.LowAmmo;
        float pulse = 0.72f + 0.28f * Mathf.Sin(Time.unscaledTime * 9f);
        Color mag = w.isReloading ? Amber : w.Empty ? Hot : low ? Lerp(Amber, Hot, pulse) : Phosphor;

        string big = w.isReloading ? "--" : w.currentAmmo.ToString();
        Label(right - 300f, sh - 88f, 240f, 44f, big, 38, TextAnchor.LowerRight, mag);
        Label(right - 56f, sh - 72f, 56f, 22f, "/ " + w.reserveAmmo, 14, TextAnchor.LowerRight,
            w.reserveAmmo > 0 ? Dim : Hot);

        // magazine readout: discrete rounds for small mags, a segmented bar for big ones
        float barY = sh - 42f;
        if (w.magSize <= 12) Pips(right - 300f, barY, 300f, 6f, w.currentAmmo, w.magSize, mag);
        else Segments(right - 300f, barY, 300f, 5f, w.Ammo01, 24, mag);

        Label(right - 300f, sh - 30f, 300f, 18f, w.weaponName, 12, TextAnchor.LowerRight, Amber);

        // gear readout: grenades + grapple (Halo pad mapping shown)
        var pcg = PlayerController.Instance;
        if (pcg)
        {
            for (int i = 0; i < 2; i++)
                Fill(right - 300f + i * 17f, sh - 150f, 12f, 12f,
                    i < pcg.Grenades ? Rose : new Color(1f, 1f, 1f, 0.14f));
            bool gr = pcg.GrappleReady;
            Label(right - 300f, sh - 134f, 300f, 14f,
                gr ? "GRAPPLE READY [LB]" : "GRAPPLE RECHARGING", 9, TextAnchor.UpperLeft,
                gr ? Cyan : Dim);
        }

        // FORTNITE-STYLE weapon slots: active slot is a wide nameplate,
        // the rest stay small keycap squares. Solid black, hairline borders.
        if (loadout != null && loadout.weapons != null)
        {
            int n = loadout.weapons.Length;
            float slotH = 36f, bigW = 158f, smallW = 32f, gap = 4f;
            float total = 0f;
            for (int i = 0; i < n; i++) total += (i == loadout.index ? bigW : smallW) + gap;
            total -= gap;
            float x = right - total;
            float y = sh - 16f - slotH;
            for (int i = 0; i < n; i++)
            {
                bool on = i == loadout.index;
                float slotW = on ? bigW : smallW;
                Fill(x, y, sw, slotH, Ink);                                // slab
                if (on)
                {
                    Fill(x, y, slotW, 1f, Color.white);                            // full white frame
                    Fill(x, y + slotH - 1f, slotW, 1f, Color.white);
                    Fill(x, y, 1f, slotH, Color.white);
                    Fill(x + slotW - 1f, y, 1f, slotH, Color.white);
                    var wpn = loadout.weapons[i];
                    Label(x + 8f, y + 4f, slotW - 46f, 16f, wpn ? wpn.weaponName.ToUpperInvariant() : "?", 10, TextAnchor.UpperLeft, Color.white);
                    Label(x + 8f, y + 18f, slotW - 46f, 14f, wpn ? (wpn.isReloading ? "RELOAD" : wpn.currentAmmo + " / " + wpn.reserveAmmo) : "", 9, TextAnchor.UpperLeft, Dim);
                    Label(x + slotW - 34f, y + 4f, 26f, 16f, ((i + 1) % 10).ToString(), 11, TextAnchor.UpperRight, Color.white);
                }
                else
                {
                    Fill(x, y, slotW, 1f, new Color(1f, 1f, 1f, 0.28f));       // ghost frame
                    Fill(x, y + slotH - 1f, slotW, 1f, new Color(1f, 1f, 1f, 0.28f));
                    Label(x, y + 9f, slotW, 16f, ((i + 1) % 10).ToString(), 11, TextAnchor.MiddleCenter, Dim);
                }
                x += slotW + gap;
            }
        }
    }

    void CompanionCard(float pad)
    {
        var companion = WaifuCompanion.Instance;
        float x = pad, y = 78f;
        Panel(x, y, 268f, 72f);
        Fill(x, y, 2f, 72f, Rose);
        if (kira) GUI.DrawTexture(new Rect(x + 8f, y + 10f, 52f, 52f), kira, ScaleMode.ScaleAndCrop);
        Label(x + 68f, y + 8f, 192f, 14f, "KIRA-7", 11, TextAnchor.UpperLeft, Rose);
        Label(x + 68f, y + 24f, 192f, 44f, companion ? companion.display : "", 12, TextAnchor.UpperLeft, Phosphor);
    }

    void Reticle(float sw, float sh)
    {
        var w = Weapon.Active;
        float cx = sw * 0.5f, cy = sh * 0.5f;

        bool kill = Time.unscaledTime < killUntil;
        bool hit = Time.unscaledTime < hitUntil;

        // Kenney crosshair sprite, tinted: white idle → rose on hit/kill
        if (xhairs != null && xhairs.Length > 0)
        {
            var tex = xhairs[Mathf.Clamp(SettingsManager.crosshairStyle, 0, xhairs.Length - 1)];
            float size = kill ? 36f : hit ? 31f : 26f;
            GUI.color = kill || hit ? Rose : Color.white;
            GUI.DrawTexture(new Rect(cx - size * 0.5f, cy - size * 0.5f, size, size), tex, ScaleMode.ScaleToFit, true);
            GUI.color = Color.white;
        }
        else
        {
            // fallback hairline cross if the pack is missing
            Fill(cx - 9f, cy, 7f, 1f, Color.white);
            Fill(cx + 3f, cy, 7f, 1f, Color.white);
            Fill(cx, cy - 9f, 1f, 7f, Color.white);
            Fill(cx, cy + 3f, 1f, 7f, Color.white);
        }

        if (kill) DrawSkull(cx + 34f, cy - 22f, 12f, Rose);

        if (w && w.isReloading) ReloadIndicator(cx, cy, w);
    }

    void ReloadIndicator(float cx, float cy, Weapon w)
    {
        float t = w.ReloadProgress01;

        // dotted ring filling clockwise from the top
        const int dots = 28;
        float radius = 30f;
        for (int i = 0; i < dots; i++)
        {
            float a = (i / (float)dots) * Mathf.PI * 2f - Mathf.PI * 0.5f;
            bool filled = (i / (float)dots) <= t;
            Color c = filled ? Amber : new Color(Amber.r, Amber.g, Amber.b, 0.16f);
            Fill(cx + Mathf.Cos(a) * radius - 1.5f, cy + Mathf.Sin(a) * radius - 1.5f, 3f, 3f, c);
        }

        Label(cx - 80f, cy + 44f, 160f, 16f, "RELOADING", 12, TextAnchor.MiddleCenter, Amber);
        Fill(cx - 46f, cy + 62f, 92f, 2f, new Color(Amber.r, Amber.g, Amber.b, 0.18f));
        Fill(cx - 46f, cy + 62f, 92f * t, 2f, Amber);
    }

    /// <summary>Tiny floating damage numbers at their world hit points.</summary>
    void DamageNumbersLayer(float sw, float sh)
    {
        for (int i = dmgNums.Count - 1; i >= 0; i--)
        {
            var d = dmgNums[i];
            float age = Time.unscaledTime - d.born;
            if (age > d.life) { dmgNums.RemoveAt(i); continue; }
            var mainCam = Camera.main;
            if (!mainCam) continue;
            Vector3 v = mainCam.WorldToScreenPoint(d.pos);
            if (v.z <= 0f) continue;                       // behind the camera
            float x = v.x, y = Screen.height - v.y;
            if (x < -40f || x > sw + 40f || y < -40f || y > sh + 40f) continue;
            float t = age / d.life;
            float rise = Mathf.SmoothStep(0f, 26f, t);     // drifts up as it fades
            float pop = 1f + 0.35f * Mathf.Clamp01(1f - age / 0.09f);   // impact pop
            Color c = d.head ? Rose : Amber;
            c.a = Mathf.Clamp01((1f - t) * 1.4f) * 0.9f;
            int size = Mathf.RoundToInt(11f * pop * (d.head ? 1.25f : 1f));
            Label(x - 60f, y - rise - 8f, 120f, 16f, d.value.ToString(), size, TextAnchor.LowerCenter, c);
        }
    }

    /// <summary>Elim feed right of the reticle: a red skull, +halo for headshots.</summary>
    void Elims(float sw, float sh)
    {
        for (int i = elims.Count - 1; i >= 0; i--)
        {
            var e = elims[i];
            float age = Time.unscaledTime - e.born;
            if (age > 1.6f) { elims.RemoveAt(i); continue; }
            float fade = Mathf.Clamp01((1.6f - age) / 0.4f);
            float pop = 1f + 0.5f * Mathf.Clamp01(1f - age / 0.12f);
            float s = 13f * pop;
            float x = sw * 0.5f + 34f;
            float y = sh * 0.5f - 26f - i * (s + 7f);
            Color bc = new Color(Rose.r, Rose.g, Rose.b, Rose.a * fade);
            if (e.nade) DrawNade(x + s * 0.5f, y + s * 0.5f, s, bc);
            else
            {
                DrawSkull(x + s * 0.5f, y + s * 0.5f, s, bc);
                if (e.head)
                    Fill(x + s * 0.15f, y - 3f, s * 0.7f, 2f, new Color(0.96f, 0.97f, 0.98f, 0.9f * fade));   // headshot halo
            }
        }
    }

    /// <summary>Blocky pixel-art skull, pure rects: cranium, jaw, sockets, teeth.</summary>
    static void DrawSkull(float cx, float cy, float s, Color c)
    {
        var dark = new Color(0.04f, 0.05f, 0.08f, c.a);
        GUI.color = c;
        GUI.DrawTexture(new Rect(cx - s * 0.42f, cy - s * 0.5f, s * 0.84f, s * 0.62f), Texture2D.whiteTexture);   // cranium
        GUI.DrawTexture(new Rect(cx - s * 0.26f, cy + s * 0.1f, s * 0.52f, s * 0.34f), Texture2D.whiteTexture);   // jaw
        GUI.color = dark;
        GUI.DrawTexture(new Rect(cx - s * 0.3f, cy - s * 0.26f, s * 0.2f, s * 0.24f), Texture2D.whiteTexture);    // eye L
        GUI.DrawTexture(new Rect(cx + s * 0.1f, cy - s * 0.26f, s * 0.2f, s * 0.24f), Texture2D.whiteTexture);    // eye R
        GUI.DrawTexture(new Rect(cx - s * 0.06f, cy + s * 0.02f, s * 0.12f, s * 0.14f), Texture2D.whiteTexture);  // nose
        GUI.DrawTexture(new Rect(cx - s * 0.1f, cy + s * 0.1f, s * 0.05f, s * 0.3f), Texture2D.whiteTexture);     // teeth gap L
        GUI.DrawTexture(new Rect(cx + s * 0.05f, cy + s * 0.1f, s * 0.05f, s * 0.3f), Texture2D.whiteTexture);    // teeth gap R
        GUI.color = Color.white;
    }

    /// <summary>Grenade badge: round bomb with a lit cap.</summary>
    static void DrawNade(float cx, float cy, float s, Color c)
    {
        var dark = new Color(0.04f, 0.05f, 0.08f, c.a);
        GUI.color = c;
        GUI.DrawTexture(new Rect(cx - s * 0.32f, cy - s * 0.28f, s * 0.64f, s * 0.64f), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(cx - s * 0.14f, cy - s * 0.46f, s * 0.28f, s * 0.2f), Texture2D.whiteTexture);   // cap
        GUI.color = dark;
        GUI.DrawTexture(new Rect(cx - s * 0.3f, cy - s * 0.06f, s * 0.6f, s * 0.1f), Texture2D.whiteTexture);    // band
        GUI.color = new Color(1f, 0.8f, 0.3f, c.a);
        GUI.DrawTexture(new Rect(cx + s * 0.1f, cy - s * 0.62f, s * 0.14f, s * 0.14f), Texture2D.whiteTexture);  // spark
        GUI.color = Color.white;
    }

    void Toasts(float sw, float sh)
    {
        float cx = sw * 0.5f;
        float baseY = sh * 0.5f + 96f;
        for (int i = toasts.Count - 1; i >= 0; i--)
        {
            var t = toasts[i];
            float age = Time.unscaledTime - t.born;
            float fade = Mathf.Clamp01((ToastLife - age) / 0.45f);
            float rise = Mathf.SmoothStep(8f, 0f, Mathf.Clamp01(age / 0.14f));
            int fromTop = toasts.Count - 1 - i;
            float y = baseY + fromTop * 20f + rise;

            var c = t.color;
            c.a *= fade;
            string text = t.stack > 1 ? t.text + "  ×" + t.stack : t.text;
            Label(cx - 200f, y, 400f, 18f, text, fromTop == 0 ? 14 : 12, TextAnchor.MiddleCenter, c);
        }
    }

    void Footer(float sw, float sh, float pad)
    {
        Fill(pad, pad, sw - pad * 2f, 1f, new Color(Dim.r, Dim.g, Dim.b, 0.22f));
        Fill(pad, sh - pad, sw - pad * 2f, 1f, new Color(Dim.r, Dim.g, Dim.b, 0.22f));
        string device = GameInput.GamepadConnected
            ? "LS MOVE   RS LOOK   RT FIRE   LS-CLICK DASH   A JUMP   X RELOAD   MENU"
            : "WASD  MOUSE  LMB FIRE  CTRL DASH  SHIFT SPRINT  R RELOAD  ESC";
        Label(pad, sh - 22f, sw - pad * 2f, 14f, device, 10, TextAnchor.LowerLeft, Dim);
    }

    void Fullscreen()
    {
        if (Time.unscaledTime < flashUntil) Tintscreen(new Color(1f, 0.2f, 0.25f, 0.2f));
        if (Time.unscaledTime < dashUntil) Tintscreen(new Color(0.44f, 0.89f, 0.85f, 0.09f));
    }

    /// <summary>Top-left killfeed banner: KILLER ☠ VICTIM, cyan rows are yours.</summary>
    void Killfeed()
    {
        var entries = RumblePit.Feed();
        for (int i = entries.Count - 1; i >= 0; i--)
        {
            var f = entries[i];
            float age = Time.unscaledTime - f.born;
            float fade = Mathf.Clamp01((5.5f - age) / 0.5f);
        float y = 42f + (entries.Count - 1 - i) * 22f;
            Color kc = Alpha(f.killerPlayer ? Cyan : Phosphor, fade);
            Color vc = Alpha(f.victimPlayer ? Rose : Dim, fade);
            Label(24f, y, 150f, 18f, f.killer, 12, TextAnchor.UpperRight, kc);
            DrawSkull(184f, y + 9f, 11f, Alpha(f.headshot ? Rose : Dim, fade));
            Label(196f, y, 150f, 18f, f.victim, 12, TextAnchor.UpperLeft, vc);
        }
    }

    static Color Alpha(Color c, float a) { c.a *= a; return c; }

    void MatchOver(float sw, float sh)
    {
        Tintscreen(new Color(0.03f, 0.04f, 0.06f, 0.76f));
        bool won = ArenaDirector.PlayerWon;
        Color c = won ? Cyan : Hot;
        string winner = RumblePit.LastWinner;
        Fill(sw * 0.5f - 130f, sh * 0.40f - 14f, 260f, 2f, c);
        Label(0f, sh * 0.40f, sw, 52f, won ? "RUMBLE WON" : "RUMBLE LOST", 42, TextAnchor.MiddleCenter, c);
        Label(0f, sh * 0.50f, sw, 22f,
            won ? "YOU TAKE THE PIT" : winner + " TAKES THE PIT", 15, TextAnchor.MiddleCenter,
            won ? Phosphor : Amber);
        Label(0f, sh * 0.57f, sw, 18f, "X  /  R   REMATCH", 12, TextAnchor.MiddleCenter, Dim);
    }

    // ---- primitives ------------------------------------------------------------

    void Scanlines(float sw, float sh)
    {
        // terminal scanlines, near-invisible, neutral dark — texture, not color
        GUI.color = new Color(0f, 0f, 0f, 0.10f);
        for (int y = 0; y < sh; y += 4)
            GUI.DrawTexture(new Rect(0f, y, sw, 1f), Texture2D.whiteTexture);
        GUI.color = Color.white;
    }

    void Vignette(float sw, float sh)
    {
        // cheap corner darkening: a few stacked translucent edge bands
        const int bands = 8;
        for (int i = 0; i < bands; i++)
        {
            float a = 0.03f * (1f - i / (float)bands);
            float t = (i + 1) * 9f;
            GUI.color = new Color(0f, 0f, 0f, a);
            GUI.DrawTexture(new Rect(0f, 0f, sw, t), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(0f, sh - t, sw, t), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(0f, 0f, t, sh), Texture2D.whiteTexture);
            GUI.DrawTexture(new Rect(sw - t, 0f, t, sh), Texture2D.whiteTexture);
        }
        GUI.color = Color.white;
    }

    void Tintscreen(Color c)
    {
        GUI.color = c;
        GUI.DrawTexture(new Rect(0f, 0f, Screen.width, Screen.height), Texture2D.whiteTexture);
        GUI.color = Color.white;
    }

    void Panel(float x, float y, float w, float h)
    {
        GUI.color = Ink;
        GUI.DrawTexture(new Rect(x, y, w, h), Texture2D.whiteTexture);
        GUI.color = Color.white;
    }

    void Fill(float x, float y, float w, float h, Color c)
    {
        if (w <= 0f || h <= 0f) return;
        GUI.color = c;
        GUI.DrawTexture(new Rect(x, y, w, h), Texture2D.whiteTexture);
        GUI.color = Color.white;
    }

    /// <summary>Segmented bar; the cell straddling the fill edge is drawn partial.</summary>
    void Segments(float x, float y, float w, float h, float t, int count, Color c)
    {
        float gap = 2f;
        float cell = (w - gap * (count - 1)) / count;
        float filled = t * count;
        for (int i = 0; i < count; i++)
        {
            float cx = x + i * (cell + gap);
            Fill(cx, y, cell, h, new Color(c.r, c.g, c.b, 0.14f));
            float amount = Mathf.Clamp01(filled - i);
            if (amount > 0f) Fill(cx, y, cell * amount, h, c);
        }
    }

    /// <summary>One tick per round, for small magazines.</summary>
    void Pips(float x, float y, float w, float h, int have, int max, Color c)
    {
        if (max <= 0) return;
        float gap = 4f;
        float cell = (w - gap * (max - 1)) / max;
        for (int i = 0; i < max; i++)
            Fill(x + i * (cell + gap), y, cell, h,
                i < have ? c : new Color(c.r, c.g, c.b, 0.14f));
    }

    void Label(float x, float y, float w, float h, string s, int size, TextAnchor a, Color col)
    {
        style.fontSize = size;
        style.alignment = a;
        style.normal.textColor = col;
        GUI.Label(new Rect(x, y, w, h), s, style);
    }

    static Color Lerp(Color a, Color b, float t) => Color.Lerp(a, b, t);
}
