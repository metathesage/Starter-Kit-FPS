using UnityEngine;

/// <summary>
/// Character hitboxes: head / torso / pelvis / upper legs as invisible solid
/// boxes parented to the operative. They drift with the visual (bob, death
/// topple) and give shots clean, location-aware hit registration. Names matter:
/// Weapon.Shoot detects headshots by collider name containing "head".
/// </summary>
public class WaifuHitboxes : MonoBehaviour
{
    public static WaifuHitboxes Attach(GameObject host, WaifuBotBody body)
    {
        var hb = host.GetComponent<WaifuHitboxes>();
        if (!hb) hb = host.AddComponent<WaifuHitboxes>();
        hb.Build(body);
        return hb;
    }

    Transform head, chest, pelvis, legL, legR;
    WaifuBotBody body;

    void Build(WaifuBotBody owner)
    {
        body = owner;
        if (head) return;   // already built
        head = Box("Head", new Vector3(0f, 1.63f, 0.01f), new Vector3(0.26f, 0.3f, 0.28f));
        chest = Box("Chest", new Vector3(0f, 1.2f, 0.01f), new Vector3(0.42f, 0.56f, 0.3f));
        pelvis = Box("Pelvis", new Vector3(0f, 0.82f, 0f), new Vector3(0.38f, 0.28f, 0.28f));
        legL = Box("LegL", new Vector3(-0.11f, 0.4f, 0f), new Vector3(0.16f, 0.72f, 0.18f));
        legR = Box("LegR", new Vector3(0.11f, 0.4f, 0f), new Vector3(0.16f, 0.72f, 0.18f));
        Debug.Log("[HITBOX] operative hitboxes armed (head/chest/pelvis/legs)");
    }

    Transform Box(string name, Vector3 pos, Vector3 size)
    {
        var b = GameObject.CreatePrimitive(PrimitiveType.Cube);
        b.name = name;
        Object.Destroy(b.GetComponent<Renderer>());
        var col = b.GetComponent<BoxCollider>();
        col.size = size;
        b.transform.SetParent(transform, false);
        b.transform.localPosition = pos;
        return b.transform;
    }

    void LateUpdate()
    {
        // follow the visual's death topple so dead bodies stop registering hits
        bool dead = body && body.IsDying;
        if (head) head.gameObject.SetActive(!dead);
        if (chest) chest.gameObject.SetActive(!dead);
        if (pelvis) pelvis.gameObject.SetActive(!dead);
        if (legL) legL.gameObject.SetActive(!dead);
        if (legR) legR.gameObject.SetActive(!dead);
    }
}
