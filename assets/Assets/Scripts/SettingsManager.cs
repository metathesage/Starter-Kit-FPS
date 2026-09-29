using UnityEngine;

public static class SettingsManager
{
    public static float masterVolume = 1f;
    public static float sfxVolume = 1f;
    public static float musicVolume = 0.55f;
    public static float mouseSensitivity = 3f;
    public static bool invertY;
    public static int qualityLevel = 2;
    public static bool aimAssist = true;
    public static bool reduceShake;

    public static void Apply()
    {
        AudioListener.volume = masterVolume;
        QualitySettings.SetQualityLevel(Mathf.Clamp(qualityLevel, 0, QualitySettings.names.Length - 1), true);
    }

    public static void Load()
    {
        masterVolume = PlayerPrefs.GetFloat("vol", 1f);
        mouseSensitivity = PlayerPrefs.GetFloat("sens", 3f);
        invertY = PlayerPrefs.GetInt("inv", 0) == 1;
        qualityLevel = PlayerPrefs.GetInt("qual", 2);
        aimAssist = PlayerPrefs.GetInt("aa", 1) == 1;
        reduceShake = PlayerPrefs.GetInt("noshake", 0) == 1;
        Apply();
    }

    public static void Save()
    {
        PlayerPrefs.SetFloat("vol", masterVolume);
        PlayerPrefs.SetFloat("sens", mouseSensitivity);
        PlayerPrefs.SetInt("inv", invertY ? 1 : 0);
        PlayerPrefs.SetInt("qual", qualityLevel);
        PlayerPrefs.SetInt("aa", aimAssist ? 1 : 0);
        PlayerPrefs.SetInt("noshake", reduceShake ? 1 : 0);
        PlayerPrefs.Save();
    }
}
