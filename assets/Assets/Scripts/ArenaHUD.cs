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

    // Palette
    static readonly Color Cyan = new Color(0.44f, 0.89f, 0.85f, 0.95f);
    static readonly Color Phosphor = new Color(0.78f, 0.95f, 0.84f, 0.92f);
    static readonly Color Amber = new Color(0.95f, 0.70f, 0.36f, 0.95f);
    static readonly Color Rose = new Color(1.00f, 0.37f, 0.63f, 0.95f);
    static readonly Color Hot = new Color(1.00f, 0.30f, 0.30f, 0.95f);
    static readonly Color Good = new Color(0.49f, 0.89f, 0.55f, 0.95f);
    static readonly Color Dim = new Color(0.78f, 0.95f, 0.84f, 0.38f);
    static readonly Color Ink = new Color(0.03f, 0.05f, 0.07f, 0.55f);

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
    }

    // ---- public feedback hooks -------------------------------------------------

    public static void Hitmarker(bool kill)
    {
        if (!Instance) return;
        Instance.hitUntil = Time.unscaledTime + 0.1f;
        if (kill) Instance.killUntil = Time.unscaledTime + 0.4f;
    }

    public static void DamageFlash() { if (Instance) Instance.flashUntil = Time.unscaledTime + 0.14f; }
    public static void MuzzleFlash() { if (Instance) Instance.muzzleUntil = Time.unscaledTime + 0.05f; }
    public static void DashFlash() { if (Instance) Instance.dashUntil = Time.unscaledTime + 0.12f; }

    /// <summary>Queue a short on-screen message under the reticle.</summary>
    public static void Notify(string text, Note kind = Note.Info)
    {
        if (!Instance || string.IsNullOrEmpty(text)) return;
        Instance.Push(text, Tint(kind));
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

        Header(pad);
        Objective(sw);
        Vitals(pad, sh);
        Ammo(sw, sh, pad);
        CompanionCard(pad);
        Reticle(sw, sh);
        Toasts(sw, sh);
        Footer(sw, sh, pad);

        if (ArenaDirector.MatchOver) MatchOver(sw, sh);
    }

    void Header(float pad)
    {
        Fill(pad, 20f, 3f, 34f, Rose);
        Label(pad + 12f, 16f, 420f, 34f, "WAIFU ARENA", 25, TextAnchor.UpperLeft, Phosphor);
        Label(pad + 13f, 48f, 420f, 16f, "KOTH  ·  FIRST TO 100", 11, TextAnchor.UpperLeft, Amber);
    }

    void Objective(float sw)
    {
        var hill = KingOfTheHill.Instance;
        if (!hill || (RangeMaster.Instance && RangeMaster.Instance.InRange)) return;

        bool ours = hill.currentOwner == KingOfTheHill.Owner.Player;
        Color owner = ours ? Cyan
            : hill.currentOwner == KingOfTheHill.Owner.Bots ? Hot
            : hill.currentOwner == KingOfTheHill.Owner.Contested ? Amber : Dim;
        float cx = sw * 0.5f;

        Panel(cx - 150f, 14f, 300f, 58f);
        Label(cx - 150f, 20f, 300f, 14f, hill.currentOwner.ToString().ToUpper(), 11, TextAnchor.MiddleCenter, owner);

        // capture meter
        Fill(cx - 90f, 38f, 180f, 3f, new Color(owner.r, owner.g, owner.b, 0.15f));
        Fill(cx - 90f, 38f, 180f * Mathf.Clamp01(hill.progress), 3f, owner);

        int ps = Mathf.FloorToInt(hill.playerScore);
        int bs = Mathf.FloorToInt(hill.botScore);
        Label(cx - 150f, 46f, 140f, 20f, ps.ToString(), 17, TextAnchor.MiddleRight, Cyan);
        Label(cx - 8f, 48f, 16f, 18f, "·", 14, TextAnchor.MiddleCenter, Dim);
        Label(cx + 10f, 46f, 140f, 20f, bs.ToString(), 17, TextAnchor.MiddleLeft, Hot);

        // score race: two bars growing toward the centre
        Fill(cx - 150f, 68f, 140f * Mathf.Clamp01(ps / 100f), 2f, Cyan);
        Fill(cx + 10f, 68f, 140f * Mathf.Clamp01(bs / 100f), 2f, Hot);
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

        // slot chips
        if (loadout != null && loadout.weapons != null)
        {
            float chipW = 20f, gap = 5f;
            float x = right - (loadout.weapons.Length * (chipW + gap) - gap);
            for (int i = 0; i < loadout.weapons.Length; i++)
            {
                bool on = i == loadout.index;
                float cx = x + i * (chipW + gap);
                Fill(cx, sh - 12f, chipW, 2f, on ? Rose : Dim);
                Label(cx, sh - 28f, chipW, 14f, (i + 1).ToString(), 10, TextAnchor.MiddleCenter, on ? Rose : Dim);
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
        var pc = PlayerController.Instance;
        float cx = sw * 0.5f, cy = sh * 0.5f;

        bool kill = Time.unscaledTime < killUntil;
        bool hit = Time.unscaledTime < hitUntil;
        Color xh = kill ? Rose : hit ? Amber : w != null && w.Empty ? Hot : Cyan;

        // gap opens with weapon spread and leftover view kick
        float gap = 6f;
        if (w) gap += w.SpreadNow * 2.6f * (1f - 0.5f * w.AdsBlend);
        if (pc) gap += Mathf.Min(pc.KickAmount * 2.2f, 14f);
        if (Time.unscaledTime < muzzleUntil) gap += 3f;
        gap = Mathf.Clamp(gap, 4f, 34f);

        float len = 6f;
        Fill(cx - gap - len, cy, len, 1f, xh);
        Fill(cx + gap, cy, len, 1f, xh);
        Fill(cx, cy - gap - len, 1f, len, xh);
        Fill(cx, cy + gap, 1f, len, xh);
        Fill(cx, cy, 1f, 1f, xh);

        if (kill)
        {
            // rotated X on a confirmed kill
            for (int i = -6; i <= 6; i++)
            {
                Fill(cx + i, cy + i, 1.6f, 1.6f, Rose);
                Fill(cx + i, cy - i, 1.6f, 1.6f, Rose);
            }
        }

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

    void MatchOver(float sw, float sh)
    {
        Tintscreen(new Color(0.03f, 0.04f, 0.06f, 0.76f));
        bool won = ArenaDirector.PlayerWon;
        Color c = won ? Cyan : Hot;
        Fill(sw * 0.5f - 130f, sh * 0.42f - 14f, 260f, 2f, c);
        Label(0f, sh * 0.42f, sw, 52f, won ? "HILL SECURED" : "SECTOR LOST", 42, TextAnchor.MiddleCenter, c);
        Label(0f, sh * 0.52f, sw, 22f, "X  /  R   rematch", 13, TextAnchor.MiddleCenter, Amber);
    }

    // ---- primitives ------------------------------------------------------------

    void Scanlines(float sw, float sh)
    {
        GUI.color = new Color(0.78f, 0.95f, 0.84f, 0.03f);
        for (int y = 0; y < sh; y += 8)
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
