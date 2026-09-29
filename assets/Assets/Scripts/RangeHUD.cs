using UnityEngine;

/// <summary>
/// Shrine Range overlay: warm cyan-on-ink ECHO panels, drill card, live combo
/// meter, rank results screen and the gacha card reveal.
/// Drawn with the same OnGUI primitives as ArenaHUD.
/// </summary>
public class RangeHUD : MonoBehaviour
{
    public static RangeHUD Instance { get; private set; }

    GUIStyle style;
    static bool resultsUp;
    static string rankText;
    static bool recordFlag;
    static float resultsAt;
    static RangeMaster.Pull pullData;
    static bool pullUp;
    static float pullAt;
    static int pullStage;                       // 0 = crystal, 1 = burst, 2 = card

    // palette
    static readonly Color Cyan = new Color(0.44f, 0.89f, 0.85f, 0.95f);
    static readonly Color Phosphor = new Color(0.82f, 0.93f, 0.95f, 0.92f);
    static readonly Color Rose = new Color(1.00f, 0.37f, 0.63f, 0.95f);
    static readonly Color Amber = new Color(0.95f, 0.70f, 0.36f, 0.95f);
    static readonly Color Dim = new Color(0.78f, 0.9f, 0.92f, 0.4f);
    static readonly Color Ink = new Color(0.03f, 0.05f, 0.08f, 0.62f);

    void Awake()
    {
        Instance = this;
    }

    public static void ShowResults(RangeMaster m, string rank, bool record)
    {
        resultsUp = true;
        rankText = rank;
        recordFlag = record;
        resultsAt = Time.unscaledTime;
        SoundManager.MedalStinger(rank == "S");
    }

    public static void CloseResults() => resultsUp = false;

    public static void ShowGacha(RangeMaster.Pull p)
    {
        pullData = p;
        pullUp = true;
        pullAt = Time.unscaledTime;
        pullStage = 0;
    }

    public static void CloseGacha()
    {
        pullUp = false;
        resultsUp = false;
    }

    void OnGUI()
    {
        if (!RangeMaster.Instance || !RangeMaster.Instance.InRange) return;
        if (OptionsMenu.IsOpen) return;
        if (style == null) style = new GUIStyle(GUI.skin.label) { fontStyle = FontStyle.Bold };

        float sw = Screen.width, sh = Screen.height;
        float pad = Mathf.Max(22f, Screen.safeArea.xMin + 16f);

        Header(pad);
        DrillCard(sw);
        ComboMeter(sw, sh);
        ScoreBlock(sw, sh, pad);
        Footer(sw, sh, pad);

        if (resultsUp && Time.unscaledTime - resultsAt < 3.4f) Results(sw, sh);
        else if (resultsUp && Time.unscaledTime - resultsAt >= 3.4f) resultsUp = false;

        if (pullUp) Gacha(sw, sh);
    }

    void Header(float pad)
    {
        var m = RangeMaster.Instance;
        Fill(pad, 20f, 3f, 40f, Rose);
        Label(pad + 12f, 16f, 420f, 30f, "SHRINE RANGE", 24, TextAnchor.UpperLeft, Phosphor);
        Label(pad + 13f, 48f, 420f, 16f, "ECHO PROTOCOL // TRAINING CONSTRUCT", 11, TextAnchor.UpperLeft, Amber);

        var def = RangeMaster.Modes[(int)m.mode];
        Label(pad + 13f, 66f, 420f, 16f, def.name + "  ·  " + def.subtitle, 12, TextAnchor.UpperLeft, Cyan);
    }

    void DrillCard(float sw)
    {
        var m = RangeMaster.Instance;
        var def = RangeMaster.Modes[(int)m.mode];
        float w = 240f, x = sw - 262f, y = 20f;
        Panel(x, y, w, def.howTo.Length > 60 ? 92f : 78f);
        Fill(x, y, 2f, 40f, Cyan);
        Label(x + 12f, y + 8f, w - 20f, 16f, def.name, 14, TextAnchor.UpperLeft, Cyan);
        Label(x + 12f, y + 28f, w - 20f, 40f, def.howTo, 10, TextAnchor.UpperLeft, Dim);

        if (m.TimeLeft > 0f && m.DrillLive)
            Label(x + 12f, y + 62f, w - 20f, 18f, "T-" + m.TimeLeft.ToString("0.0"), 16, TextAnchor.UpperLeft, Amber);
        else if (!m.DrillLive)
            Label(x + 12f, y + 62f, w - 20f, 18f, "LMB — BEGIN", 12, TextAnchor.UpperLeft,
                0.6f + 0.4f * Mathf.Sin(Time.unscaledTime * 5f) > 0.5f ? Rose : Dim);

        Label(x + 12f, y + 80f, w - 20f, 14f, "BEST  " + RangeMaster.BestFor(m.mode), 11, TextAnchor.UpperLeft, Amber);
    }

    void ComboMeter(float sw, float sh)
    {
        var m = RangeMaster.Instance;
        if (!m.DrillLive || m.Combo < 2) return;
        float cx = sw * 0.5f;
        float heat = Mathf.Clamp01(m.Combo / 20f);
        Color c = Color.Lerp(Cyan, Rose, heat);
        Label(cx - 120f, sh * 0.62f, 240f, 40f, "×" + m.Combo, 30, TextAnchor.MiddleCenter, c);
        Fill(cx - 90f, sh * 0.62f + 42f, 180f, 3f, new Color(c.r, c.g, c.b, 0.18f));
        Fill(cx - 90f, sh * 0.62f + 42f, 180f * heat, 3f, c);
        if (heat >= 1f)
            Label(cx - 120f, sh * 0.62f + 48f, 240f, 16f, "MAX HEAT", 11, TextAnchor.MiddleCenter, Amber);
    }

    void ScoreBlock(float sw, float sh, float pad)
    {
        var m = RangeMaster.Instance;
        float right = sw - pad;
        Label(right - 300f, sh - 118f, 300f, 40f, m.Score.ToString(), 34, TextAnchor.LowerRight, Phosphor);
        float acc = m.Shots > 0 ? (float)m.Hits / m.Shots : 0f;
        Label(right - 300f, sh - 74f, 300f, 16f,
            "ACC " + (acc * 100f).ToString("0") + "%   CORE ×" + m.WeakHits + "   COMBO " + m.BestCombo,
            11, TextAnchor.LowerRight, Dim);
    }

    void Footer(float sw, float sh, float pad)
    {
        Fill(pad, sh - pad - 1f, sw - pad * 2f, 1f, new Color(Dim.r, Dim.g, Dim.b, 0.2f));
        Label(pad, sh - 24f, sw - pad * 2f, 16f,
            "[ ] or F1-F5  MODE   ·   LMB  FIRE/START   ·   B  LEAVE RANGE   ·   R  RELOAD",
            10, TextAnchor.LowerLeft, Dim);
    }

    void Results(float sw, float sh)
    {
        float age = Time.unscaledTime - resultsAt;
        float fade = Mathf.Clamp01(age / 0.25f);
        Tint(new Color(0.02f, 0.03f, 0.05f, 0.6f * fade));

        float cy = sh * 0.42f;
        Color rc = rankText == "S" ? Amber : rankText == "A" ? Rose : Cyan;
        Fill(sw * 0.5f - 120f, cy - 34f, 240f, 2f, rc);
        Label(0f, cy - 28f, sw, 64f, "RANK  " + rankText, 48, TextAnchor.MiddleCenter, rc);
        Label(0f, cy + 40f, sw, 20f, recordFlag ? "NEW RECORD ♥" : "SET COMPLETE", 14, TextAnchor.MiddleCenter,
            recordFlag ? Rose : Phosphor);

        var m = RangeMaster.Instance;
        float acc = m.Shots > 0 ? (float)m.Hits / m.Shots : 0f;
        Label(0f, cy + 66f, sw, 18f,
            m.Score + " PTS   ·   ACC " + (acc * 100f).ToString("0") + "%   ·   BEST COMBO ×" + m.BestCombo +
            "   ·   CORE HITS " + m.WeakHits,
            12, TextAnchor.MiddleCenter, Dim);
        Label(0f, cy + 90f, sw, 16f, "LMB — run it back", 11, TextAnchor.MiddleCenter, Amber);
    }

    void Gacha(float sw, float sh)
    {
        float age = Time.unscaledTime - pullAt;
        // stage timing: crystal 0-0.9s, burst 0.9-1.3s, card 1.3s+
        if (pullStage == 0 && age > 0.9f) { pullStage = 1; SoundManager.GachaBurst(); }
        if (pullStage == 1 && age > 1.3f) pullStage = 2;
        if (age > 4.6f) { pullUp = false; return; }

        Color c = pullData.color;
        float cx = sw * 0.5f, cy = sh * 0.5f;

        if (pullStage < 2)
        {
            // floating crystal that pulses brighter toward the burst
            float pulse = 0.6f + 0.4f * Mathf.Sin(age * 14f);
            float size = Mathf.Lerp(30f, 46f, pullStage == 1 ? age - 0.9f : 0f) * (0.8f + 0.2f * pulse);
            Tint(new Color(0.02f, 0.03f, 0.06f, 0.5f));
            Label(cx - 200f, cy - 90f, 400f, 22f, "INCOMING TRANSMISSION", 13, TextAnchor.MiddleCenter, Dim);
            DrawCrystal(cx, cy, size, Color.Lerp(Cyan, c, pullStage), pulse);
            return;
        }

        // card reveal
        float cardAge = age - 1.3f;
        float slide = Mathf.SmoothStep(40f, 0f, Mathf.Clamp01(cardAge / 0.3f));
        float w = 320f, h = 400f;
        var box = new Rect(cx - w / 2f, cy - h / 2f + slide, w, h);

        Tint(new Color(0.02f, 0.03f, 0.06f, 0.55f));
        GUI.color = new Color(0.04f, 0.05f, 0.09f, 0.96f);
        GUI.DrawTexture(box, Texture2D.whiteTexture);

        // rarity frame
        var frame = c;
        frame.a = 0.95f;
        DrawFrame(box, frame, 3f);
        DrawFrame(new Rect(box.x + 6f, box.y + 6f, box.width - 12f, box.height - 12f),
            new Color(frame.r, frame.g, frame.b, 0.35f), 1f);

        // halo behind the silhouette
        float hcx = box.center.x, hcy = box.y + 150f;
        for (int i = 6; i > 0; i--)
        {
            var haloC = frame;
            haloC.a = 0.05f * i * Mathf.Clamp01(cardAge * 3f);
            GUI.color = haloC;
            GUI.DrawTexture(new Rect(hcx - i * 11f, hcy - i * 11f, i * 22f, i * 22f), Texture2D.whiteTexture);
        }
        GUI.color = Color.white;

        // silhouette bust — layered quads reading as a girl with halo
        GUI.color = new Color(0.14f, 0.16f, 0.22f, 1f);
        GUI.DrawTexture(new Rect(hcx - 42f, hcy + 34f, 84f, 120f), Texture2D.whiteTexture);   // shoulders
        GUI.DrawTexture(new Rect(hcx - 26f, hcy - 16f, 52f, 60f), Texture2D.whiteTexture);    // head
        GUI.DrawTexture(new Rect(hcx - 34f, hcy - 30f, 68f, 30f), Texture2D.whiteTexture);    // hair top
        GUI.color = Color.white;
        // the halo
        GUI.color = frame;
        GUI.DrawTexture(new Rect(hcx - 30f, hcy - 44f, 60f, 5f), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(hcx - 30f, hcy - 41f, 5f, 5f), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(hcx + 25f, hcy - 41f, 5f, 5f), Texture2D.whiteTexture);
        GUI.color = Color.white;

        Label(box.x + 16f, box.yMax - 128f, box.width - 32f, 30f, pullData.girlName, 24, TextAnchor.UpperCenter, frame);
        Label(box.x + 16f, box.yMax - 92f, box.width - 32f, 18f, pullData.title, 12, TextAnchor.UpperCenter, Phosphor);
        Label(box.x + 16f, box.yMax - 68f, box.width - 32f, 18f,
            pullData.rarity == RangeMaster.Rarity.Legendary ? "★★★★★ SSR" :
            pullData.rarity == RangeMaster.Rarity.Epic ? "★★★★ SR" :
            pullData.rarity == RangeMaster.Rarity.Rare ? "★★★ R" : "★★ N",
            14, TextAnchor.UpperCenter, frame);
        Label(box.x + 16f, box.yMax - 44f, box.width - 32f, 16f, "ECHO ARCHIVE +" + RangeMaster.Instance.Collection.Count,
            10, TextAnchor.UpperCenter, Dim);
    }

    static void DrawCrystal(float cx, float cy, float size, Color c, float pulse)
    {
        // diamond made of two stacked quads
        GUI.color = new Color(c.r, c.g, c.b, 0.85f * pulse);
        GUI.DrawTexture(new Rect(cx - size * 0.32f, cy - size * 0.5f, size * 0.64f, size * 0.5f), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(cx - size * 0.5f, cy, size, size * 0.32f), Texture2D.whiteTexture);
        GUI.color = new Color(1f, 1f, 1f, 0.5f * pulse);
        GUI.DrawTexture(new Rect(cx - size * 0.1f, cy - size * 0.42f, size * 0.14f, size * 0.4f), Texture2D.whiteTexture);
        GUI.color = Color.white;
    }

    static void DrawFrame(Rect r, Color c, float t)
    {
        GUI.color = c;
        GUI.DrawTexture(new Rect(r.x, r.y, r.width, t), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(r.x, r.yMax - t, r.width, t), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(r.x, r.y, t, r.height), Texture2D.whiteTexture);
        GUI.DrawTexture(new Rect(r.xMax - t, r.y, t, r.height), Texture2D.whiteTexture);
        GUI.color = Color.white;
    }

    // ---- primitives ------------------------------------------------------------

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

    void Tint(Color c)
    {
        GUI.color = c;
        GUI.DrawTexture(new Rect(0f, 0f, Screen.width, Screen.height), Texture2D.whiteTexture);
        GUI.color = Color.white;
    }

    void Label(float x, float y, float w, float h, string s, int size, TextAnchor a, Color col)
    {
        style.fontSize = size;
        style.alignment = a;
        style.normal.textColor = col;
        GUI.Label(new Rect(x, y, w, h), s, style);
    }
}
