using UnityEngine;

/// <summary>
/// Cached, strip-proof handles to the built-in shaders and collider types this game
/// creates at runtime.
///
/// Two things silently break a player build here:
///  * "Strip Engine Code" drops component classes that no managed code references, so
///    GameObject.CreatePrimitive(PrimitiveType.Sphere) fails with
///    "Can't add component because class 'SphereCollider' doesn't exist!".
///  * Shader.Find("Standard") returns null once no material in the build references
///    the shader, and new Material(null) renders magenta — the whole map turns pink.
///
/// Pin() is registered for subsystem startup so the components survive stripping, and
/// the shader lookups walk a fallback chain instead of ever going magenta.
/// </summary>
public static class RuntimeAssets
{
    static Shader lit, sprite, unlit;

    /// <summary>Lit surface shader for the map, bodies, bots and weapons.</summary>
    public static Shader Lit
    {
        get
        {
            if (!lit) lit = First("Standard", "Universal Render Pipeline/Lit",
                "Legacy Shaders/Diffuse", "Diffuse", "Unlit/Texture");
            return lit;
        }
    }

    /// <summary>Transparent/unlit shader for tracers, hit sparks and dash afterimages.</summary>
    public static Shader Sprite
    {
        get
        {
            if (!sprite) sprite = First("Sprites/Default", "Unlit/Transparent", "Unlit/Color", "Standard");
            return sprite;
        }
    }

    public static Shader Unlit
    {
        get
        {
            if (!unlit) unlit = First("Unlit/Color", "Sprites/Default", "Standard");
            return unlit;
        }
    }

    static Shader First(params string[] names)
    {
        for (int i = 0; i < names.Length; i++)
        {
            var s = Shader.Find(names[i]);
            if (s) return s;
        }
        return null;
    }

    /// <summary>Opaque lit material, optionally emissive. Used for everything solid.</summary>
    public static Material LitMaterial(Color c, float emission = 0f)
    {
        var m = new Material(Lit) { color = c };
        if (emission > 0f)
        {
            m.EnableKeyword("_EMISSION");
            m.SetColor("_EmissionColor", c * emission);
        }
        return m;
    }

    /// <summary>Transparent unlit material for tracers, sparks and afterimages.</summary>
    public static Material FadeMaterial(Color c)
    {
        var m = new Material(Sprite) { color = c };
        return m;
    }

    /// <summary>
    /// Keeps this method (and therefore every typeof below) reachable, which is what
    /// stops the engine code stripper removing the components that
    /// GameObject.CreatePrimitive adds internally.
    /// </summary>
    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
    static void Pin()
    {
        // CreatePrimitive(Sphere) needs SphereCollider, (Cube) BoxCollider,
        // (Capsule) and (Cylinder) CapsuleCollider, (Plane) and (Quad) MeshCollider.
        Pin(typeof(BoxCollider), typeof(SphereCollider), typeof(CapsuleCollider), typeof(MeshCollider));
        Pin(typeof(Rigidbody), typeof(CharacterController), typeof(UnityEngine.AI.NavMeshAgent));
        Pin(typeof(AudioSource), typeof(AudioListener), typeof(LineRenderer), typeof(Light));
        Pin(typeof(MeshFilter), typeof(MeshRenderer));   // shrine petal drift
    }

    static void Pin(params System.Type[] types)
    {
        // The references are the point; walk them so nothing can be optimised away.
        for (int i = 0; i < types.Length; i++)
            if (types[i] == null) Debug.LogWarning("RuntimeAssets: null pin at " + i);
    }
}
