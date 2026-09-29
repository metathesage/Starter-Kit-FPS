using UnityEngine;

/// <summary>
/// Trauma-based camera shake + short hit-stop. Shake is visual offset only.
/// </summary>
public class FeelDirector : MonoBehaviour
{
    public static FeelDirector Instance { get; private set; }

    public Transform cameraTransform;
    public float decay = 1.35f;
    public float maxOffset = 0.12f;
    public float maxRoll = 2.2f;

    float trauma;
    float t;
    Vector3 restLocal;
    bool restSet;
    Coroutine stopCo;

    void Awake()
    {
        Instance = this;
        if (!cameraTransform && Camera.main) cameraTransform = Camera.main.transform;
    }

    void LateUpdate()
    {
        if (!cameraTransform) return;
        if (!restSet)
        {
            restLocal = cameraTransform.localPosition;
            restSet = true;
        }

        if (SettingsManager.reduceShake) trauma = 0f;
        trauma = Mathf.Max(0f, trauma - decay * Time.unscaledDeltaTime);
        t += Time.unscaledDeltaTime * 28f;
        float shake = trauma * trauma;
        Vector3 off = new Vector3(
            maxOffset * shake * Mathf.Sin(t * 1.7f),
            maxOffset * 0.7f * shake * Mathf.Sin(t * 2.3f),
            0f);
        cameraTransform.localPosition = restLocal + off;
        var e = cameraTransform.localEulerAngles;
        // roll is applied as extra z; pitch is owned by PlayerController on this transform
    }

    public static void Pulse(float amount)
    {
        if (!Instance) return;
        Instance.trauma = Mathf.Clamp01(Instance.trauma + amount);
    }

    public static void HitStop(float duration = 0.05f, float scale = 0.08f)
    {
        if (!Instance || SettingsManager.reduceShake) return;
        if (Instance.stopCo != null) Instance.StopCoroutine(Instance.stopCo);
        Instance.stopCo = Instance.StartCoroutine(Instance.DoStop(duration, scale));
    }

    System.Collections.IEnumerator DoStop(float duration, float scale)
    {
        Time.timeScale = scale;
        yield return new WaitForSecondsRealtime(duration);
        if (!OptionsMenu.IsOpen) Time.timeScale = 1f;
        stopCo = null;
    }
}
