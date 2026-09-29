using UnityEngine;

public static class SettingsManager
{
    public static float masterVolume = 1f;
    public static float sfxVolume = 1f;
    public static float musicVolume = 0.55f;
    public static float uiVolume = 0.7f;
    public static float mouseSensitivity = 3f;
    public static bool invertY;
    public static int qualityLevel = 2;
    public static bool aimAssist = true;
    public static int aimAssistStrength = 1;   // 0 off, 1 standard, 2 strong
    public static int aimAssistMode = 1;       // 0 classic (center-weighted), 1 linear
    public static int crosshairStyle;          // index into the Kenney pack
    public static float fieldOfView = 78f;
    public static bool reduceShake;

    public static void Apply()
    {
        AudioListener.volume = masterVolume;
        QualitySettings.SetQualityLevel(Mathf.Clamp(qualityLevel, 0, QualitySettings.names.Length - 1), true);
    }

    public static void Load()
    {
        masterVolume = PlayerPrefs.GetFloat("vol", 1f);
        uiVolume = PlayerPrefs.GetFloat("uivol", 0.7f);
        mouseSensitivity = PlayerPrefs.GetFloat("sens", 3f);
        invertY = PlayerPrefs.GetInt("inv", 0) == 1;
        qualityLevel = PlayerPrefs.GetInt("qual", 2);
        aimAssist = PlayerPrefs.GetInt("aa", 1) == 1;
        aimAssistStrength = PlayerPrefs.GetInt("aast", 1);
        aimAssistMode = PlayerPrefs.GetInt("aamod", 1);
        crosshairStyle = PlayerPrefs.GetInt("xhair", 0);
        fieldOfView = PlayerPrefs.GetFloat("fov", 78f);
        reduceShake = PlayerPrefs.GetInt("noshake", 0) == 1;
        Apply();
    }

    public static void Save()
    {
        PlayerPrefs.SetFloat("vol", masterVolume);
        PlayerPrefs.SetFloat("uivol", uiVolume);
        PlayerPrefs.SetFloat("sens", mouseSensitivity);
        PlayerPrefs.SetInt("inv", invertY ? 1 : 0);
        PlayerPrefs.SetInt("qual", qualityLevel);
        PlayerPrefs.SetInt("aa", aimAssist ? 1 : 0);
        PlayerPrefs.SetInt("aast", aimAssistStrength);
        PlayerPrefs.SetInt("aamod", aimAssistMode);
        PlayerPrefs.SetInt("xhair", crosshairStyle);
        PlayerPrefs.SetFloat("fov", fieldOfView);
        PlayerPrefs.SetInt("noshake", reduceShake ? 1 : 0);
        PlayerPrefs.Save();
    }
}
