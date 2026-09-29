using UnityEngine;

/// <summary>
/// Paints the grey invasion mesh with the city / sidewalk / police textures
/// and a brighter outdoor light so the arena actually has color.
/// </summary>
public class MapLook : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        if (FindFirstObjectByType<MapLook>()) return;
        var g = new GameObject("MapLook");
        g.AddComponent<MapLook>();
    }

    void Start() => Apply();

    public void Apply()
    {
        var city = Resources.Load<Texture2D>("Map/city");
        var walk = Resources.Load<Texture2D>("Map/sidewalk");
        var cop = Resources.Load<Texture2D>("Map/police");
        var ground = Resources.Load<Texture2D>("Map/ground");
        Texture2D[] set = { city, walk, cop, ground };

        RenderSettings.fog = true;
        RenderSettings.fogMode = FogMode.ExponentialSquared;
        RenderSettings.fogColor = new Color(0.45f, 0.62f, 0.82f);
        RenderSettings.fogDensity = 0.0045f;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(0.55f, 0.72f, 0.95f);
        RenderSettings.ambientEquatorColor = new Color(0.62f, 0.55f, 0.48f);
        RenderSettings.ambientGroundColor = new Color(0.22f, 0.2f, 0.18f);
        RenderSettings.ambientIntensity = 1.15f;

        var sun = FindFirstObjectByType<Light>();
        if (sun && sun.type == LightType.Directional)
        {
            sun.color = new Color(1f, 0.94f, 0.82f);
            sun.intensity = 1.65f;
            sun.shadows = LightShadows.Soft;
        }

        int i = 0;
        foreach (var r in FindObjectsByType<Renderer>(FindObjectsSortMode.None))
        {
            if (!r) continue;
            string n = r.gameObject.name.ToLowerInvariant();
            if (n.Contains("beacon") || n.Contains("waifu") || n.StartsWith("bot") || n == "player") continue;
            if (r.GetComponentInParent<WaifuBody>()) continue;
            if (r.GetComponentInParent<Weapon>()) continue;
            if (r.GetComponentInParent<ArenaHUD>()) continue;

            var tex = set[i++ % set.Length];
            if (!tex) continue;
            var mat = new Material(RuntimeAssets.Lit);
            mat.mainTexture = tex;
            mat.color = Color.white;
            if (mat.HasProperty("_Glossiness")) mat.SetFloat("_Glossiness", 0.18f);
            if (n.Contains("ground") || n.Contains("fallback"))
            {
                mat.mainTexture = ground ? ground : tex;
                mat.mainTextureScale = new Vector2(40f, 40f);
                mat.color = new Color(0.55f, 0.62f, 0.48f);
            }
            else
            {
                mat.mainTextureScale = new Vector2(4f, 4f);
                mat.color = new Color(1.05f, 1.02f, 0.98f);
            }
            r.material = mat;
        }
    }
}
