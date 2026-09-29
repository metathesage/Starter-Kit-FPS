using UnityEngine;

/// <summary>
/// Pause menu, noir brutalist. Esc opens; mouse hover drives focus, click
/// activates; stick/keys still work. Rows are full-width slabs, steel-blue
/// accent, white values, dim silver labels.
/// </summary>
public class OptionsMenu : MonoBehaviour
{
    public static bool IsOpen { get; private set; }
    int focus;
    int hoverRow = -1;
    readonly string[] rows =
    {
        "SENSITIVITY", "INVERT Y", "AIM ASSIST (PAD)", "REDUCE SHAKE", "VOLUME", "QUALITY", "RESUME"
    };

    // Noir palette - single source of truth for the menu
    static readonly Color NoirDim   = new Color(0.45f, 0.50f, 0.56f, 0.90f);
    static readonly Color NoirBlue  = new Color(0.36f, 0.62f, 1.00f, 1.00f);
    static readonly Color NoirWhite = new Color(0.97f, 0.98f, 1.00f, 1.00f);
    static readonly Color Slab      = new Color(0.055f, 0.065f, 0.085f, 0.97f);
    static readonly Color SlabHi    = new Color(0.09f, 0.11f, 0.15f, 0.98f);
    static readonly Color Ink       = new Color(0.02f, 0.03f, 0.045f, 0.94f);

    Rect box;
    Rect[] rowRects;

    void Update()
    {
        if (GameInput.MenuPressed)
        {
            if (ArenaDirector.MatchOver) return;
            SetOpen(!IsOpen);
        }
        if (!IsOpen) return;

        ComputeLayout();
        FocusMouse();

        if (GameInput.JumpPressed || Input.GetKeyDown(KeyCode.Return)) Activate();
        if (GameInput.Move.y > 0.5f && Pulse("u")) focus = (focus + rows.Length - 1) % rows.Length;
        if (GameInput.Move.y < -0.5f && Pulse("d")) focus = (focus + 1) % rows.Length;
        float x = GameInput.Move.x + GameInput.LookStick.x;
        if (Mathf.Abs(x) > 0.4f && Pulse("x")) Nudge(Mathf.Sign(x));
        if (Input.GetKeyDown(KeyCode.LeftArrow)) Nudge(-1);
        if (Input.GetKeyDown(KeyCode.RightArrow)) Nudge(1);
        if (Input.GetKeyDown(KeyCode.UpArrow)) focus = (focus + rows.Length - 1) % rows.Length;
        if (Input.GetKeyDown(KeyCode.DownArrow)) focus = (focus + 1) % rows.Length;

        // click a row to activate it; wheel scrolls focus
        if (Input.GetMouseButtonDown(0) && hoverRow >= 0) { focus = hoverRow; Activate(); }
        if (Input.mouseScrollDelta.y < -0.01f && Pulse("w")) focus = (focus + 1) % rows.Length;
        if (Input.mouseScrollDelta.y > 0.01f && Pulse("w")) focus = (focus + rows.Length - 1) % rows.Length;
    }

    void ComputeLayout()
    {
        float w = Mathf.Min(560f, Screen.width * 0.86f);
        float h = 96f + rows.Length * 44f + 44f;
        box = new Rect(Screen.width * 0.5f - w * 0.5f, Screen.height * 0.5f - h * 0.5f, w, h);
        rowRects = new Rect[rows.Length];
        for (int i = 0; i < rows.Length; i++)
            rowRects[i] = new Rect(box.x, box.y + 92f + i * 44f, box.width, 40f);
    }

    void FocusMouse()
    {
        hoverRow = -1;
        var mp = new Vector2(Input.mousePosition.x, Screen.height - Input.mousePosition.y);
        for (int i = 0; i < rowRects.Length; i++)
            if (rowRects[i].Contains(mp)) { hoverRow = i; break; }
        if (hoverRow >= 0) focus = hoverRow; // hover drives focus like a real menu
    }

    float pulseT;
    string pulseK;
    bool Pulse(string k)
    {
        if (pulseK == k && Time.unscaledTime < pulseT) return false;
        pulseK = k; pulseT = Time.unscaledTime + 0.18f;
        return true;
    }

    void Activate()
    {
        switch (focus)
        {
            case 1: SettingsManager.invertY = !SettingsManager.invertY; break;
            case 2: SettingsManager.aimAssist = !SettingsManager.aimAssist; break;
            case 3: SettingsManager.reduceShake = !SettingsManager.reduceShake; break;
            case 6: SetOpen(false); break;
        }
        SettingsManager.Save();
        SettingsManager.Apply();
    }

    void Nudge(float dir)
    {
        switch (focus)
        {
            case 0: SettingsManager.mouseSensitivity = Mathf.Clamp(SettingsManager.mouseSensitivity + dir * 0.25f, 1f, 10f); break;
            case 4: SettingsManager.masterVolume = Mathf.Clamp01(SettingsManager.masterVolume + dir * 0.05f); SettingsManager.Apply(); break;
            case 5: SettingsManager.qualityLevel = Mathf.Clamp(SettingsManager.qualityLevel + (int)dir, 0, 2); break;
        }
        SettingsManager.Save();
        SettingsManager.Apply();
    }

    public static void SetOpen(bool open)
    {
        IsOpen = open;
        Cursor.lockState = open ? CursorLockMode.None : CursorLockMode.Locked;
        Cursor.visible = open;
        Time.timeScale = open ? 0f : 1f;
    }

    void OnGUI()
    {
        if (!IsOpen) return;
        Draw();
    }

    void Draw()
    {
        ComputeLayout();

        // full-screen ink wash
        GUI.color = Ink;
        GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
        GUI.color = Color.white;

        // slab
        GUI.color = Slab;
        GUI.DrawTexture(box, Texture2D.whiteTexture);
        GUI.color = Color.white;
        // steel-blue edges
        Fill(box.x, box.y, box.width, 1f, NoirBlue);
        Fill(box.x, box.y, 2f, box.height, NoirBlue * new Color(1f, 1f, 1f, 0.35f));

        var titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 20, alignment = TextAnchor.UpperLeft, fontStyle = FontStyle.Bold };
        titleStyle.normal.textColor = NoirWhite;
        GUI.Label(new Rect(box.x + 24f, box.y + 18f, box.width - 48f, 28f), "P A U S E", titleStyle);
        var sub = new GUIStyle(GUI.skin.label) { fontSize = 10, alignment = TextAnchor.UpperLeft };
        sub.normal.textColor = NoirDim;
        GUI.Label(new Rect(box.x + 24f, box.y + 46f, box.width - 48f, 18f),
            "HALO WAIFU - NOIR BRUTALIST", sub);

        for (int i = 0; i < rows.Length; i++)
        {
            var r = rowRects[i];
            bool on = i == focus;
            bool isResume = i == 6;

            if (on)
            {
                GUI.color = SlabHi;
                GUI.DrawTexture(r, Texture2D.whiteTexture);
                GUI.color = Color.white;
                Fill(r.x, r.y, 3f, r.height, NoirBlue);
            }

            var row = new GUIStyle(GUI.skin.label) { fontSize = 14, alignment = TextAnchor.UpperLeft, fontStyle = on ? FontStyle.Bold : FontStyle.Normal };
            row.normal.textColor = isResume ? NoirBlue : on ? NoirWhite : NoirDim;
            GUI.Label(new Rect(r.x + 24f, r.y + 11f, r.width * 0.6f, 22f), rows[i], row);

            string v = Value(i);
            var val = new GUIStyle(GUI.skin.label) { fontSize = 13, alignment = TextAnchor.UpperRight };
            val.normal.textColor = on ? NoirWhite : NoirDim;
            GUI.Label(new Rect(r.x + r.width * 0.5f, r.y + 12f, r.width - 48f, 20f), v, val);

            if (IsSliderRow(i))
            {
                int pips = i == 0
                    ? Mathf.RoundToInt((SettingsManager.mouseSensitivity - 1f) / 9f * 14f)
                    : Mathf.RoundToInt(SettingsManager.masterVolume * 14f);
                for (int p = 0; p < 14; p++)
                    Fill(r.x + 24f + p * 10f, r.yMax - 5f, 7f, 2f,
                        p < pips ? NoirBlue * new Color(1f, 1f, 1f, on ? 1f : 0.55f)
                                 : new Color(1f, 1f, 1f, 0.10f));
            }
        }

        var hint = new GUIStyle(GUI.skin.label) { fontSize = 10, alignment = TextAnchor.MiddleCenter };
        hint.normal.textColor = NoirDim;
        GUI.Label(new Rect(box.x, box.yMax - 26f, box.width, 18f),
            "MOUSE / W S - SELECT      ENTER / CLICK - TOGGLE      A D - ADJUST      ESC - RESUME", hint);
    }

    static bool IsSliderRow(int i) => i == 0 || i == 4;

    static string Value(int i)
    {
        switch (i)
        {
            case 0: return SettingsManager.mouseSensitivity.ToString("0.00") + "x";
            case 1: return SettingsManager.invertY ? "ON" : "OFF";
            case 2: return SettingsManager.aimAssist ? "ON" : "OFF";
            case 3: return SettingsManager.reduceShake ? "ON" : "OFF";
            case 4: return Mathf.RoundToInt(SettingsManager.masterVolume * 100) + "%";
            case 5: return SettingsManager.qualityLevel == 0 ? "LOW" : SettingsManager.qualityLevel == 1 ? "MED" : "HIGH";
            default: return "";
        }
    }

    static void Fill(float x, float y, float w, float h, Color c)
    {
        if (w <= 0f || h <= 0f) return;
        GUI.color = c;
        GUI.DrawTexture(new Rect(x, y, w, h), Texture2D.whiteTexture);
        GUI.color = Color.white;
    }
}
