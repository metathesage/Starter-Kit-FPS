using UnityEngine;
using System.Runtime.InteropServices;

/// <summary>
/// Named actions for keyboard+mouse and Xbox / generic gamepads.
/// WebGL reads the browser Gamepad API via XboxPad.jslib (standard mapping).
/// Standalone/editor also reads Unity joystick axes (XInput-style).
/// </summary>
public static class GameInput
{
    const float StickDead = 0.18f;
    const float TriggerDead = 0.15f;

    public static Vector2 Move;
    public static Vector2 Look;          // mouse deltas OR stick * dt-scaled later
    public static Vector2 LookStick;     // raw stick, frame-rate independent (scale in controller)
    public static float MouseLookX;
    public static float MouseLookY;
    public static bool FireHeld;
    public static bool FirePressed;
    public static bool AimHeld;
    public static bool JumpPressed;
    public static bool JumpHeld;
    public static bool ReloadPressed;
    public static bool SprintHeld;
    public static bool DashPressed;
    public static bool MenuPressed;
    public static bool RangeTogglePressed;   // V — Shrine Range enter/leave
    public static bool WeaponNextPressed;
    public static bool WeaponPrevPressed;
    public static int WeaponSlotPressed; // 1..3, else 0
    public static bool UsingGamepad;
    public static bool GamepadConnected;

    static bool fireWas;
    static bool jumpWas;
    static bool menuWas;
    static bool rangeWas;
    static bool reloadWas;
    static bool nextWas;
    static bool prevWas;
    static bool dashWas;
    static readonly float[] Pad = new float[24];

#if UNITY_WEBGL && !UNITY_EDITOR
    [DllImport("__Internal")]
    static extern int XboxPad_Read(float[] buffer);
#endif

    public static void Tick()
    {
        Vector2 kbmMove = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
        MouseLookX = Input.GetAxis("Mouse X");
        MouseLookY = Input.GetAxis("Mouse Y");

        bool kbmFire = Input.GetButton("Fire1") || Input.GetMouseButton(0);
        bool kbmAim = Input.GetButton("Fire2") || Input.GetMouseButton(1);
        bool kbmJump = Input.GetButton("Jump") || Input.GetKey(KeyCode.Space);
        bool kbmReload = Input.GetKey(KeyCode.R);
        bool kbmSprint = Input.GetKey(KeyCode.LeftShift);
        bool kbmMenu = Input.GetKey(KeyCode.Escape);
        bool kbmNext = Input.GetKey(KeyCode.E) || Input.mouseScrollDelta.y < -0.01f;
        bool kbmPrev = Input.GetKey(KeyCode.Q) || Input.mouseScrollDelta.y > 0.01f;
        int slot = 0;
        if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Keypad1)) slot = 1;
        if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.Keypad2)) slot = 2;
        if (Input.GetKeyDown(KeyCode.Alpha3) || Input.GetKeyDown(KeyCode.Keypad3)) slot = 3;
        if (Input.GetKeyDown(KeyCode.Alpha4) || Input.GetKeyDown(KeyCode.Keypad4)) slot = 4;
        if (Input.GetKeyDown(KeyCode.Alpha5) || Input.GetKeyDown(KeyCode.Keypad5)) slot = 5;
        // F1..F5 belong to the Shrine Range drill selector; never touch gun slots.
        if (Input.GetKeyDown(KeyCode.F1) || Input.GetKeyDown(KeyCode.F2) || Input.GetKeyDown(KeyCode.F3)
            || Input.GetKeyDown(KeyCode.F4) || Input.GetKeyDown(KeyCode.F5)) slot = 0;

        Vector2 padMove = Vector2.zero;
        Vector2 padLook = Vector2.zero;
        float rt = 0f, lt = 0f;
        bool padA = false, padB = false, padX = false, padY = false;
        bool padStart = false, padBack = false, padLB = false, padRB = false, padLS = false, padRS = false;
        bool padConnected = false;
        bool padDpadUp = false, padDpadDown = false, padDpadLeft = false, padDpadRight = false;

#if UNITY_WEBGL && !UNITY_EDITOR
        for (int i = 0; i < Pad.Length; i++) Pad[i] = 0f;
        try { XboxPad_Read(Pad); } catch { /* plugin missing in some embeds */ }
        if (Pad[0] > 0.5f)
        {
            padConnected = true;
            padMove = RadialDead(new Vector2(Pad[1], -Pad[2]));
            padLook = RadialDead(new Vector2(Pad[3], -Pad[4]));
            // jslib writes set(5+b) for standard button b:
            // 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT,
            // 8 Back/View, 9 Start/Menu, 10 LS, 11 RS,
            // 12 dpadU, 13 dpadD, 14 dpadL, 15 dpadR
            padA = Pad[5] > 0.5f;
            padB = Pad[6] > 0.5f;
            padX = Pad[7] > 0.5f;
            padY = Pad[8] > 0.5f;
            padLB = Pad[9] > 0.5f;
            padRB = Pad[10] > 0.5f;
            lt = Pad[11];
            rt = Pad[12];
            padBack = Pad[13] > 0.5f;
            padStart = Pad[14] > 0.5f;
            padLS = Pad[15] > 0.5f;
            padRS = Pad[16] > 0.5f;
            padDpadUp = Pad[17] > 0.5f;
            padDpadDown = Pad[18] > 0.5f;
            padDpadLeft = Pad[19] > 0.5f;
            padDpadRight = Pad[20] > 0.5f;
            // Legacy comment above this block had the indices off by one
            // (Pad[9]/Pad[10] are LB/RB, not Pad[9]...slot). Dpad mapping:
            if (padDpadUp) slot = 1;
            else if (padDpadDown) slot = 2;
            else if (padDpadRight) slot = 3;
        }
#else
        string[] joys = Input.GetJoystickNames();
        for (int i = 0; i < joys.Length; i++)
            if (!string.IsNullOrEmpty(joys[i])) padConnected = true;

        if (padConnected)
        {
            padMove = RadialDead(new Vector2(Input.GetAxis("Horizontal"), Input.GetAxis("Vertical")));
            // If keyboard also writes Horizontal, prefer stick when magnitude is high.
            float lx = AxisOrZero("JoyLookX");
            float ly = AxisOrZero("JoyLookY");
            padLook = RadialDead(new Vector2(lx, ly));
            rt = Mathf.Max(Axis01("JoyRT"), Input.GetAxis("JoyRT"));
            lt = Mathf.Max(Axis01("JoyLT"), Input.GetAxis("JoyLT"));
            if (rt < 0f) rt = 0f;
            if (lt < 0f) lt = 0f;
            padA = Input.GetKey(KeyCode.JoystickButton0);
            padB = Input.GetKey(KeyCode.JoystickButton1);
            padX = Input.GetKey(KeyCode.JoystickButton2);
            padY = Input.GetKey(KeyCode.JoystickButton3);
            padLB = Input.GetKey(KeyCode.JoystickButton4);
            padRB = Input.GetKey(KeyCode.JoystickButton5);
            padBack = Input.GetKey(KeyCode.JoystickButton6);
            padStart = Input.GetKey(KeyCode.JoystickButton7) || Input.GetKey(KeyCode.JoystickButton9);
            padLS = Input.GetKey(KeyCode.JoystickButton8);
            padRS = Input.GetKey(KeyCode.JoystickButton10);
            // Dpad on most XInput mappings: buttons 12..15 = Up/Down/Left/Right
            padDpadUp = Input.GetKey(KeyCode.JoystickButton12);
            padDpadDown = Input.GetKey(KeyCode.JoystickButton13);
            padDpadLeft = Input.GetKey(KeyCode.JoystickButton14);
            padDpadRight = Input.GetKey(KeyCode.JoystickButton15);
            if (padDpadUp) slot = 1;
            else if (padDpadDown) slot = 2;
            else if (padDpadRight) slot = 3;
        }
#endif

        GamepadConnected = padConnected;

        bool fireHeld = kbmFire || rt > TriggerDead;
        bool jumpHeld = kbmJump || padA;
        // B cancels ADS-zoom zoom / closes menu vibe: treat as reload-cancel? keep as extra reload on pad
        bool menuHeld = kbmMenu || padStart || padBack;
        bool reloadHeld = kbmReload || padX;
        bool nextHeld = kbmNext || padRB;
        bool prevHeld = kbmPrev || padLB;
        bool dashHeld = padLS || Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.V) && !Input.GetKeyDown(KeyCode.V);
        bool rangeToggle = Input.GetKeyDown(KeyCode.V) && !padLS;

        FirePressed = fireHeld && !fireWas;
        JumpPressed = jumpHeld && !jumpWas;
        MenuPressed = menuHeld && !menuWas;
        RangeTogglePressed = rangeToggle && !rangeWas;
        ReloadPressed = reloadHeld && !reloadWas;
        WeaponNextPressed = nextHeld && !nextWas;
        WeaponPrevPressed = prevHeld && !prevWas;
        DashPressed = dashHeld && !dashWas;
        fireWas = fireHeld;
        jumpWas = jumpHeld;
        menuWas = menuHeld;
        rangeWas = rangeToggle;
        reloadWas = reloadHeld;
        nextWas = nextHeld;
        prevWas = prevHeld;
        dashWas = dashHeld;

        FireHeld = fireHeld;
        JumpHeld = jumpHeld;
        AimHeld = kbmAim || lt > TriggerDead;
        // B on pad = sprint too (hold to sprint), RS-click also sprints
        SprintHeld = kbmSprint || padB || padRS || padMove.sqrMagnitude > 0.88f * 0.88f;
        WeaponSlotPressed = slot;
        Move = padMove.sqrMagnitude > 0.01f ? padMove : Vector2.ClampMagnitude(kbmMove, 1f);
        LookStick = padLook;
        Look = padLook;
        UsingGamepad = padConnected && (padMove.sqrMagnitude > 0.04f || padLook.sqrMagnitude > 0.04f || rt > TriggerDead || lt > TriggerDead || padA || padB || padX || padY || padStart || padBack || padLS || padRS);
        if (Mathf.Abs(MouseLookX) > 0.02f || Mathf.Abs(MouseLookY) > 0.02f) UsingGamepad = false;
    }

    static Vector2 RadialDead(Vector2 v, float dead = StickDead)
    {
        float mag = v.magnitude;
        if (mag < dead) return Vector2.zero;
        float scaled = (mag - dead) / (1f - dead);
        return v.normalized * Mathf.Clamp01(scaled);
    }

    static float AxisOrZero(string name)
    {
        try { return Input.GetAxis(name); }
        catch { return 0f; }
    }

    static float Axis01(string name)
    {
        float a = AxisOrZero(name);
        // Some XInput mappings rest at -1 for triggers.
        if (a < 0f) a = (a + 1f) * 0.5f;
        return a;
    }
}
