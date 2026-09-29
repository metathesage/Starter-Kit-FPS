using UnityEngine;

/// <summary>
/// Pause menu, ECHO style. Esc opens; mouse hover drives focus, click
/// activates; stick/keys still work. Rows are full-width slabs, cyan accent,
/// phosphor values, dim slate labels.
/// </summary>
public class OptionsMenu : MonoBehaviour
{
    public static bool IsOpen { get; private set; }
    int focus;
    int hoverRow = -1;
    readonly string[] rows =
    {
        "SENSITIVITY", "FIELD OF VIEW", "INVERT Y", "AIM ASSIST", "ASSIST MODE", "CROSSHAIR",
        "REDUCE SHAKE", "VOLUME", "UI VOLUME", "MUSIC", "PAD LAYOUT", "QUALITY", "RESUME"
    };

    static readonly string[] AssistModes = { "CLASSIC", "LINEAR" };
    static readonly string[] PadLayouts = { "HALO", "BUMPER JUMPER" };

    // ECHO palette — d3 moodboard bible
    static readonly Color NoirDim   = new Color32(0x64, 0x74, 0x8b, 0xe6);
    static readonly Color NoirBlue  = new Color32(0x00, 0xf3, 0xff, 0xff);
    static readonly Color Rose      = new Color32(0xf4, 0x3f, 0x5e, 0xff);
    static readonly Color NoirWhite = new Color32(0xf1, 0xf5, 0xf9, 0xff);
    static readonly Color Slab      = new Color(0.045f, 0.055f, 0.075f, 0.97f);
    static readonly Color SlabHi    = new Color(0.08f, 0.10f, 0.14f, 0.98f);
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
        float h = 96f + rows.Length * 40f + 44f;
        box = new Rect(Screen.width * 0.5f - w * 0.5f, Screen.height * 0.5f - h * 0.5f, w, h);
        rowRects = new Rect[rows.Length];
        for (int i = 0; i < rows.Length; i++)
            rowRects[i] = new Rect(box.x, box.y + 92f + i * 40f, box.width, 36f);
    }

    void FocusMouse()
    {
        hoverRow = -1;
        var mp = new Vector2(Input.mousePosition.x, Screen.height - Input.mousePosition.y);
        for (int i = 0; i < rowRects.Length; i++)
            if (rowRects[i].Contains(mp)) { hoverRow = i; break; }
        if (hoverRow >= 0 && hoverRow != focus) AudioDirector.UiMove();
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
        AudioDirector.UiAccept();
        switch (focus)
        {
            case 2: SettingsManager.invertY = !SettingsManager.invertY; break;
            case 3:
                SettingsManager.aimAssistStrength = (SettingsManager.aimAssistStrength + 1) % 3;
                break;
            case 4: SettingsManager.aimAssistMode = (SettingsManager.aimAssistMode + 1) % 2; break;
            case 5: SettingsManager.crosshairStyle = (SettingsManager.crosshairStyle + 1) % 40; break;
            case 6: SettingsManager.reduceShake = !SettingsManager.reduceShake; break;
            case 10:
                GameInput.BumperJumper = !GameInput.BumperJumper;
                PlayerPrefs.SetInt("bumper", GameInput.BumperJumper ? 1 : 0);
                PlayerPrefs.Save();
                break;
            case 12: SetOpen(false); break;
        }
        SettingsManager.Save();
        SettingsManager.Apply();
    }

    void Nudge(float dir)
    {
        switch (focus)
        {
            case 0: SettingsManager.mouseSensitivity = Mathf.Clamp(SettingsManager.mouseSensitivity + dir * 0.25f, 1f, 10f); break;
            case 1: SettingsManager.fieldOfView = Mathf.Clamp(SettingsManager.fieldOfView + dir * 3f, 60f, 110f); break;
            case 5: SettingsManager.crosshairStyle = Mathf.Clamp(SettingsManager.crosshairStyle + (int)dir, 0, 39); break;
            case 7: SettingsManager.masterVolume = Mathf.Clamp01(SettingsManager.masterVolume + dir * 0.05f); break;
            case 8: SettingsManager.uiVolume = Mathf.Clamp01(SettingsManager.uiVolume + dir * 0.05f); break;
            case 9: SettingsManager.musicVolume = Mathf.Clamp01(SettingsManager.musicVolume + dir * 0.05f); break;
            case 11: SettingsManager.qualityLevel = Mathf.Clamp(SettingsManager.qualityLevel + (int)dir, 0, 2); break;
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
        AudioDirector.UiToggle();
        if (open) AudioDirector.ToMenu(); else AudioDirector.ToCombat();
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
        Fill(box.x, box.y, 120f, 2f, Rose);
        GUI.Label(new Rect(box.x + 24f, box.y + 18f, box.width - 48f, 28f), "P A U S E", titleStyle);
        var sub = new GUIStyle(GUI.skin.label) { fontSize = 10, alignment = TextAnchor.UpperLeft };
        sub.normal.textColor = NoirDim;
        GUI.Label(new Rect(box.x + 24f, box.y + 46f, box.width - 48f, 18f),
            "WAIFU HALO // ACTION TERMINAL", sub);

        for (int i = 0; i < rows.Length; i++)
        {
            var r = rowRects[i];
            bool on = i == focus;
            bool isResume = i == 12;

            if (on)
            {
                GUI.color = SlabHi;
                GUI.DrawTexture(r, Texture2D.whiteTexture);
                GUI.color = Color.white;
                Fill(r.x, r.y, 3f, r.height, NoirBlue);
            }

            var row = new GUIStyle(GUI.skin.label) { fontSize = 14, alignment = TextAnchor.UpperLeft, fontStyle = on ? FontStyle.Bold : FontStyle.Normal };
            row.normal.textColor = isResume ? Rose : on ? NoirWhite : NoirDim;
            if (i == 4 && on) row.normal.textColor = Rose;   // assist mode = the fun row
            GUI.Label(new Rect(r.x + 24f, r.y + 11f, r.width * 0.6f, 22f), rows[i], row);

            string v = Value(i);
            var val = new GUIStyle(GUI.skin.label) { fontSize = 13, alignment = TextAnchor.UpperRight };
            val.normal.textColor = on ? NoirWhite : NoirDim;
            GUI.Label(new Rect(r.x + r.width * 0.5f, r.y + 12f, r.width - 48f, 20f), v, val);

            if (IsSliderRow(i))
            {
                int pips = i == 0
                    ? Mathf.RoundToInt((SettingsManager.mouseSensitivity - 1f) / 9f * 14f)
                    : i == 1
                    ? Mathf.RoundToInt((SettingsManager.fieldOfView - 60f) / 50f * 14f)
                    : i == 8
                    ? Mathf.RoundToInt(SettingsManager.uiVolume * 14f)
                    : i == 9
                    ? Mathf.RoundToInt(SettingsManager.musicVolume * 14f)
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

    static bool IsSliderRow(int i) => i == 0 || i == 1 || i == 7 || i == 8 || i == 9;

    static string Value(int i)
    {
        switch (i)
        {
            case 0: return SettingsManager.mouseSensitivity.ToString("0.00") + "x";
            case 1: return Mathf.RoundToInt(SettingsManager.fieldOfView) + "°";
            case 2: return SettingsManager.invertY ? "ON" : "OFF";
            case 3: return SettingsManager.aimAssistStrength == 0 ? "OFF" : SettingsManager.aimAssistStrength == 1 ? "STANDARD" : "STRONG";
            case 4: return AssistModes[SettingsManager.aimAssistMode];
            case 5: return "STYLE " + (SettingsManager.crosshairStyle + 1);
            case 6: return SettingsManager.reduceShake ? "ON" : "OFF";
            case 7: return Mathf.RoundToInt(SettingsManager.masterVolume * 100) + "%";
            case 8: return Mathf.RoundToInt(SettingsManager.uiVolume * 100) + "%";
            case 9: return Mathf.RoundToInt(SettingsManager.musicVolume * 100) + "%";
            case 10: return PadLayouts[GameInput.BumperJumper ? 1 : 0];
            case 11: return SettingsManager.qualityLevel == 0 ? "LOW" : SettingsManager.qualityLevel == 1 ? "MED" : "HIGH";
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
